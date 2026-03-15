/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */

/**
 * @fileoverview Kotlin Language Server Protocol Client
 * 
 * This module manages the Kotlin LSP client lifecycle, including:
 * - Starting and stopping the LSP server process
 * - Establishing socket connections for communication
 * - Managing client state and subscriptions
 * - Configuring JVM options and server parameters
 * 
 * The LSP server can be started in two modes:
 * 1. Bundled mode: Uses the bundled kotlin-lsp.sh/cmd launcher
 * 2. Remote mode: Connects to an already-running server on a specified port
 * 
 * @module lspClient
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

/** Singleton LSP client instance */
let _client: LanguageClient | undefined;

/**
 * Array of subscription callbacks for client state changes.
 * These are called whenever the LSP client's state changes.
 */
const clientSubscriptions: ((client: LanguageClient, stateChange: StateChangeEvent) => void)[] = [];

/**
 * Initializes the LSP client module.
 * 
 * Registers:
 * - A disposable for stopping the client on extension deactivation
 * - The 'androidLsp.restartLsp' command for manual server restarts
 */
export function initLspClient() {
    getContext().subscriptions.push(
         Disposable.create(async () => await stopLspClient()),
         vscode.commands.registerCommand('androidLsp.restartLsp', async () => {
            await startLspClient();
            await vscode.window.showInformationMessage('Android LSP restarted');
        }),
    );
}

/**
 * Subscribes to LSP client state change events.
 * 
 * The subscription callback will be called whenever the client's state changes
 * (e.g., from Starting to Running, or from Running to Stopped).
 * 
 * @param {(client: LanguageClient, stateChange: StateChangeEvent) => void} subscription - 
 *        The callback function to invoke on state changes
 */
export function subscribeToClientEvent(subscription: (client: LanguageClient, stateChange: StateChangeEvent) => void) {
    clientSubscriptions.push(subscription)
    if (_client) {
        const client = _client
        getContext().subscriptions.push(
            client.onDidChangeState(e => subscription(client, e)),
        );
    }
}

/**
 * Gets the current LSP client instance.
 * 
 * @returns {LanguageClient | undefined} The LSP client, or undefined if not started
 */
export function getLspClient(): LanguageClient | undefined {
    return _client
}

/**
 * Starts the Kotlin LSP client.
 * 
 * This function:
 * 1. Creates a new LSP client instance
 * 2. Stops any existing client
 * 3. Registers state change handlers
 * 4. Starts the client connection
 * 
 * @async
 * @returns {Promise<void>}
 */
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

/**
 * Stops the Kotlin LSP client.
 * 
 * If the client is running, it will be stopped gracefully.
 * The client reference is cleared after stopping.
 * 
 * @async
 * @returns {Promise<void>}
 */
export async function stopLspClient(): Promise<void> {
    if (!_client) return
    if (_client.state == State.Running) {
        await _client.stop();
    }
    _client = undefined
}

/**
 * Gets the path to the Kotlin LSP launcher script.
 * 
 * Returns the platform-specific launcher:
 * - Windows: kotlin-lsp.cmd
 * - Unix/macOS: kotlin-lsp.sh
 * 
 * Also sets executable permissions on Unix/macOS platforms.
 * 
 * @returns {string} The absolute path to the launcher script
 */
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

/**
 * Creates the server options for the LSP client.
 * 
 * Determines whether to:
 * - Connect to a predefined port (development mode)
 * - Start a new bundled server process
 * 
 * @async
 * @returns {Promise<ServerOptions | null>} The server options, or null if setup failed
 */
async function createServerOptions(): Promise<ServerOptions | null> {
    const config = workspace.getConfiguration('androidLSP.dev');
    const predefinedPort = config.get<number>('serverPort', -1);
    if (predefinedPort != -1) {
        return await connectToLocalLspServer(predefinedPort);
    } else {
        return await getRunningJavaServerLspOptions()
    }
}

/**
 * Creates a connection factory for a local LSP server.
 * 
 * Attempts to connect to the specified port with retries.
 * This is used for both predefined ports and dynamically allocated ports
 * from the bundled server.
 * 
 * @async
 * @param {number} port - The port number to connect to
 * @returns {Promise<(() => Promise<StreamInfo>) | null>} A function that returns stream info, or null on failure
 */
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

/**
 * Builds the document selector for the LSP client.
 * 
 * Creates a selector that includes:
 * - All contributed language IDs from package.json
 * - Supported URI schemes: file, jar, jrt
 * 
 * @returns {LanguageClientOptions['documentSelector']} The document selector
 */
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

/**
 * Creates and configures the LSP client instance.
 * 
 * Sets up:
 * - Document selector for supported languages and schemes
 * - Output channel for logging
 * - Initialization options (JDK path)
 * - Middleware for request/response handling
 * - Markdown support
 * 
 * @async
 * @returns {Promise<LanguageClient | null>} The configured client, or null if setup failed
 */
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


/**
 * Starts the bundled Kotlin LSP server and returns connection options.
 * 
 * This function:
 * 1. Spawns the kotlin-lsp.sh/cmd process with socket mode
 * 2. Waits for the server to announce its listening port
 * 3. Creates a socket connection to that port
 * 
 * The server is started with:
 * - Dynamic port allocation (--socket 0)
 * - System path for storage
 * - User-configured JVM options
 * 
 * @async
 * @returns {Promise<ServerOptions | null>} The server options with socket connection, or null on failure
 */
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

    // Wait for the server to announce its port
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

/** Configuration key for additional JVM arguments */
const jvmOptionsSettingName = 'androidLSP.additionalJvmArgs';

/**
 * Gets user-configured JVM options from VSCode settings.
 * 
 * @returns {string[]} Array of JVM argument strings
 */
function getUserJvmOptions() : string[] {
    const settings = vscode.workspace.getConfiguration().get<string[]>(jvmOptionsSettingName)
    return settings ?? []
}

/**
 * Builds the environment variables with JVM options.
 * 
 * Merges user-configured JVM options into the IJ_JAVA_OPTIONS
 * environment variable, which is read by the Kotlin LSP launcher.
 * 
 * @param {NodeJS.ProcessEnv} baseEnv - The base environment variables
 * @param {string[]} extraOptions - Additional JVM options to include
 * @returns {NodeJS.ProcessEnv} The modified environment variables
 */
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

/**
 * Shell-quotes an argument if it contains special characters.
 * 
 * Arguments containing only safe characters are returned as-is.
 * Otherwise, they are quoted and escaped for shell safety.
 * 
 * @param {string} arg - The argument to potentially quote
 * @returns {string} The argument, possibly quoted and escaped
 */
function shellQuoteIfNeeded(arg: string): string {
    if (/^[a-zA-Z0-9._=:/@-]+$/.test(arg)) {
        return arg
    }
    const escaped = arg.replace(/(["\\$`])/g, '\\$1')
    return `"${escaped}"`
}
