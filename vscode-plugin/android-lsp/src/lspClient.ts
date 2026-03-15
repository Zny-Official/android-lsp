/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */
import * as vscode from "vscode"
import {workspace} from "vscode"
import * as path from "node:path"
import {
    Disposable,
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    State,
    StateChangeEvent,
    StreamInfo
} from 'vscode-languageclient/node';
import {chmodSync} from 'fs';
import * as net from "node:net"
import * as os from 'node:os';
import {spawn} from 'node:child_process';
import {getContext, getOutputChannel, logInfo} from "./extension"
import {middleware} from "./middleware";
import * as readline from 'node:readline';

let _client: LanguageClient | undefined;

const clientSubscriptions: ((client: LanguageClient, stateChange: StateChangeEvent) => void)[] = [];

export function initLspClient() {
    getContext().subscriptions.push(
         Disposable.create(async () => await stopLspClient()),
         vscode.commands.registerCommand('androidLsp.restartLsp', async () => {
            await startLspClient();
            await vscode.window.showInformationMessage('Android LSP restarted');
        }),
    );
}

export function subscribeToClientEvent(subscription: (client: LanguageClient, stateChange: StateChangeEvent) => void) {
    clientSubscriptions.push(subscription)
    if (_client) {
        const client = _client
        getContext().subscriptions.push(
            client.onDidChangeState(e => subscription(client, e)),
        );
    }
}

export function getLspClient(): LanguageClient | undefined {
    return _client
}

export async function startLspClient(): Promise<void> {
    const runClient = await createLspClient()
    if (!runClient) return;
    await stopLspClient()
    _client = runClient;
    getContext().subscriptions.push(
        _client.onDidChangeState(e =>
            clientSubscriptions.forEach(s => s(runClient, e))
        )
   );

    await runClient.start()
}

export async function stopLspClient(): Promise<void> {
    if (!_client) return
    if (_client.state == State.Running) {
        await _client.stop();
    }
    _client = undefined
}

function getLauncherPath(): string {
    const relative = 'server'
    const launcherName = os.platform() === 'win32'
            ? 'kotlin-lsp.cmd'
            : 'kotlin-lsp.sh'
    const launcherPath = path.join(getContext().asAbsolutePath(relative), launcherName);
    if (os.platform() !== 'win32') {
        chmodSync(launcherPath, 0o755);
    }
    return launcherPath
}

async function createServerOptions(): Promise<ServerOptions | null> {
    const config = workspace.getConfiguration('androidLSP.dev');
    const predefinedPort = config.get<number>('serverPort', -1);
    if (predefinedPort != -1) {
        return await connectToLocalLspServer(predefinedPort);
    } else {
        return await getRunningJavaServerLspOptions()
    }
}

async function connectToLocalLspServer(port: number): Promise<(() => Promise<StreamInfo>) | null> {
    const maxRetries = 50;
    const retryDelayMs = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const socket = net.connect({port});
            await new Promise<void>((resolve, reject) => {
                socket.once('connect', () => resolve());
                socket.once('error', (err) => reject(err));
            });
            const result: StreamInfo = {
                writer: socket,
                reader: socket
            };
            return () => Promise.resolve(result);
        } catch (error) {
            if (attempt < maxRetries - 1) {
                logInfo(`Waiting for server on port ${port}... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            } else {
                vscode.window.showErrorMessage(
                        `Failed to connect to LSP server on port ${port} after ${maxRetries} attempts. ` +
                        `Please ensure the server is running.`
                );
                return null;
            }
        }
    }
    return null;
}

function buildDocumentSelector(): LanguageClientOptions['documentSelector'] {
    const ext = vscode.extensions.getExtension(getContext().extension.id);
    const contributedLanguageIds: string[] = (ext?.packageJSON?.contributes?.languages ?? [])
        .map((l: { id: string }) => l.id);
    logInfo(`Serving languages: ${contributedLanguageIds.join(', ')}`);

    let supportedSchemes = ['file', 'jar', 'jrt']
    const selector: NonNullable<LanguageClientOptions['documentSelector']> = [
        {scheme: 'jar', language: 'plaintext'},
        {scheme: 'jrt', language: 'plaintext'},
    ];

    for (const lang of contributedLanguageIds) {
        for (const scheme of supportedSchemes) {
            selector.push({scheme, language: lang});
        }
    }
    return selector;
}

async function createLspClient(): Promise<LanguageClient | null> {
    const clientOptions: LanguageClientOptions = {
        documentSelector: buildDocumentSelector(),
        progressOnInitialization: true,
        outputChannel: getOutputChannel(),
        initializationOptions: {
            defaultJdk: workspace.getConfiguration().get('androidLSP.jdkForSymbolResolution')
        },
        middleware: middleware,
        markdown: {
            supportHtml: true,
        }
    };
    let serverOptions = await createServerOptions()
    if (!serverOptions) return null
    const displayName = vscode.extensions.getExtension(getContext().extension.id)?.packageJSON?.displayName ?? 'Android LSP (fallback)'
    return new LanguageClient('androidLSP', displayName, serverOptions, clientOptions);
}


async function getRunningJavaServerLspOptions(): Promise<ServerOptions | null> {
    const launcherPath = getLauncherPath();

    const context = getContext()
    const args: string[] = []
    args.push('--socket', '0');
    if (context.storageUri) {
        args.push('--system-path', context.storageUri.fsPath)
    }
    const userJvmOptions = getUserJvmOptions()
    const env = buildJvmOptionsEnv(process.env, userJvmOptions)

    logInfo('Starting language server');
    logInfo(`  command: ${launcherPath}`);
    logInfo(`  args   : ${JSON.stringify(args)}`);
    logInfo(`  VM opts: ${JSON.stringify(userJvmOptions)}`);
    logInfo('');

    const serverProcess = spawn(launcherPath, args, {
        env,
        stdio: ['ignore', 'pipe', 'ignore'],
    });

    const port = await new Promise<number>((resolve, reject) => {
        const timeoutMs = 10_000;

        const cleanup = () => {
            serverProcess.removeAllListeners('exit');
            serverProcess.removeAllListeners('error');

            clearTimeout(timer);
        }

        const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
            reject(new Error(`Language server process exited before announcing port (code=${code}, signal=${signal})`));
        };

        const timer = setTimeout(() => {
            cleanup();
            serverProcess.kill();
            reject(new Error("Timed out waiting for language server port announcement"));
        }, timeoutMs);

        const rl = readline.createInterface({
            input: serverProcess.stdout,
            terminal: false
        });

        rl.on('line', (line: string) => {
            if (line.indexOf('Server is listening on ') >= 0) {
                const pos = line.lastIndexOf(':');
                if (pos > 0) {
                    const portString = line.substring(pos + 1);
                    const parsedPort = Number(portString);
                    if (Number.isInteger(parsedPort)) {
                        cleanup();
                        rl.close();
                        serverProcess.stdout.resume();
                        resolve(parsedPort);
                    }
                }
            }
        });

        serverProcess.once('error', reject);
        serverProcess.once('exit', onExit);
    });

    logInfo(`Language server is listening on port ${port}`);

    return await connectToLocalLspServer(port);
}

const jvmOptionsSettingName = 'androidLSP.additionalJvmArgs';

function getUserJvmOptions() : string[] {
    const settings = vscode.workspace.getConfiguration().get<string[]>(jvmOptionsSettingName)
    return settings ?? []
}

function buildJvmOptionsEnv(baseEnv: NodeJS.ProcessEnv, extraOptions: string[]): NodeJS.ProcessEnv {
    if (extraOptions.length === 0) {
        return baseEnv
    }
    const OPTION = 'IJ_JAVA_OPTIONS'
    const env: NodeJS.ProcessEnv = {...baseEnv}

    const current = env[OPTION] ?? ''
    const extra = extraOptions.map(shellQuoteIfNeeded).join(' ')
    env[OPTION] = current ? `${current} ${extra}` : extra

    return env
}

function shellQuoteIfNeeded(arg: string): string {
    if (/^[a-zA-Z0-9._=:/@-]+$/.test(arg)) {
        return arg
    }
    const escaped = arg.replace(/(["\\$`])/g, '\\$1')
    return `"${escaped}"`
}
