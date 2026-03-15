/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */
import * as path from 'path';
import * as vscode from "vscode"
import {commands, type ExtensionContext, extensions, type OutputChannel, Uri, window, workspace,} from "vscode"
import {registerDecompiler, registerOpeningJars} from "./decompiler"
import {initLspClient, startLspClient} from './lspClient';
import {registerStatusBarItem, setAndroidProject} from './statusBar';
import {registerDapServer} from "./dap"
import {registerDatabase} from "./database"
import {registerDebugJava} from "./debugjava"
import {detectProject, getWorkspaceRoot} from "./projectDetector";
import {initAdtManager} from "./adtManager";
import {getWorkspaceGenerator} from "./workspaceGenerator";

let _context: ExtensionContext | undefined
let _outputChannel: OutputChannel | undefined;

export function getContext(): ExtensionContext {
    return _context!;
}

export function getOutputChannel(): OutputChannel {
    return _outputChannel!;
}

export function logInfo(text: string) {
    if (_outputChannel) {
        _outputChannel.appendLine(text)
    } else {
        console.log(text);
    }
}

function registerCommands(context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerCommand('androidLsp.generateWorkspace', async () => {
            const workspaceRoot = getWorkspaceRoot();
            if (!workspaceRoot) {
                await window.showErrorMessage('No workspace opened');
                return;
            }
            
            const generator = getWorkspaceGenerator();
            const result = await generator.forceRegenerate(workspaceRoot);
            
            if (result.success) {
                const choice = await window.showInformationMessage(
                    'workspace.json generated successfully.',
                    'Open'
                );
                if (choice === 'Open' && result.workspacePath) {
                    const uri = Uri.file(result.workspacePath);
                    const doc = await workspace.openTextDocument(uri);
                    await window.showTextDocument(doc);
                }
            } else {
                await window.showErrorMessage(result.error || 'Failed to generate workspace.json');
            }
        }),
        
        commands.registerCommand('androidLsp.syncGradle', async () => {
            const workspaceRoot = getWorkspaceRoot();
            if (!workspaceRoot) {
                await window.showErrorMessage('No workspace opened');
                return;
            }
            
            await window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Android LSP',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Syncing Gradle...', increment: 0 });
                
                const generator = getWorkspaceGenerator();
                const result = await generator.forceRegenerate(workspaceRoot);
                
                progress.report({ message: 'Complete', increment: 100 });
                
                if (result.success) {
                    await window.showInformationMessage('Gradle sync completed. workspace.json regenerated.');
                    await commands.executeCommand('androidLsp.restartLsp');
                } else {
                    await window.showErrorMessage(result.error || 'Gradle sync failed');
                }
            });
        })
    );
}

export async function activate(context: ExtensionContext) {
    _context = context
    initOutputChannel(context)
    
    logInfo('Android LSP extension activating...');
    
    registerDecompiler(context)
    registerOpeningJars()
    registerDapServer(context);
    registerDebugJava(context)
    registerDatabase(context);
    registerCommands(context)
    registerStatusBarItem()
    initLspClient()
    
    const adtManager = initAdtManager(context);
    await adtManager.initialize();
    
    const workspaceRoot = getWorkspaceRoot();
    
    if (workspaceRoot) {
        logInfo(`Workspace root: ${workspaceRoot}`);
        
        const projectInfo = await detectProject(workspaceRoot);
        logInfo(`Project detection: Android=${projectInfo.isAndroid}, Gradle=${projectInfo.hasGradle}, Kotlin=${projectInfo.hasKotlin}`);
        
        setAndroidProject(projectInfo.isAndroid);
        
        if (projectInfo.isAndroid) {
            logInfo('Android project detected, generating workspace.json...');
            
            const generator = getWorkspaceGenerator();
            const result = await generator.generateIfNeeded(workspaceRoot);
            
            if (result.success) {
                logInfo(`workspace.json ready: ${result.workspacePath}`);
            } else {
                logInfo(`workspace.json generation failed: ${result.error}`);
                await window.showWarningMessage(
                    `Android LSP: ${result.error}. Some features may not work correctly.`
                );
            }
        }
    }
    
    await startLspClient()
    
    logInfo('Android LSP extension activated');
}

function initOutputChannel(context: ExtensionContext) {
    const extension = extensions.getExtension(context.extension.id);
    const pkg = extension?.packageJSON as { displayName?: string } | undefined;
    _outputChannel = window.createOutputChannel(pkg?.displayName ?? 'Android LSP');
}
