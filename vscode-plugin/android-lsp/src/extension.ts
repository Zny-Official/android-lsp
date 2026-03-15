/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */

/**
 * @fileoverview Android LSP Extension Entry Point
 * 
 * This is the main entry point for the Android LSP VSCode extension.
 * It orchestrates the initialization of all extension components and manages
 * the extension lifecycle.
 * 
 * Key responsibilities:
 * - Extension activation and deactivation
 * - Project detection and workspace.json generation
 * - LSP client initialization
 * - Command registration
 * - Status bar management
 * 
 * @module extension
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

/** Singleton extension context */
let _context: ExtensionContext | undefined

/** Singleton output channel for logging */
let _outputChannel: OutputChannel | undefined;

/**
 * Gets the extension context.
 * 
 * @returns {ExtensionContext} The extension context
 * @throws {Error} If the context has not been initialized
 */
export function getContext(): ExtensionContext {
    return _context!;
}

/**
 * Gets the output channel for logging.
 * 
 * @returns {OutputChannel} The output channel
 * @throws {Error} If the output channel has not been initialized
 */
export function getOutputChannel(): OutputChannel {
    return _outputChannel!;
}

/**
 * Logs an informational message to the output channel.
 * 
 * If the output channel is not yet initialized, logs to console instead.
 * 
 * @param {string} text - The message to log
 */
export function logInfo(text: string) {
    if (_outputChannel) {
        _outputChannel.appendLine(text)
    } else {
        console.log(text);
    }
}

/**
 * Registers all extension commands.
 * 
 * Commands registered:
 * - androidLsp.generateWorkspace - Manually generate workspace.json
 * - androidLsp.syncGradle - Sync Gradle and regenerate workspace.json
 * 
 * @param {ExtensionContext} context - The extension context for registering commands
 */
function registerCommands(context: ExtensionContext) {
    /**
     * Command: Generate workspace.json
     * 
     * Manually triggers workspace.json generation for the current workspace.
     * Shows the generated file on success or displays an error message.
     */
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
        
        /**
         * Command: Sync Gradle
         * 
         * Performs a Gradle sync by regenerating workspace.json and restarting
         * the LSP server. This is useful after modifying Gradle dependencies.
         */
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

/**
 * Activates the Android LSP extension.
 * 
 * This is the main entry point called by VSCode when the extension is activated.
 * The extension is activated when:
 * - A Kotlin file is opened
 * - A workspace contains build.gradle* files
 * - A workspace contains settings.gradle* files
 * - A workspace contains AndroidManifest.xml
 * 
 * Activation sequence:
 * 1. Initialize output channel for logging
 * 2. Register all feature modules (decompiler, DAP, database, debug, status bar)
 * 3. Initialize ADT manager for workspace.json generation
 * 4. Detect project type (Android vs pure Kotlin)
 * 5. Generate workspace.json if needed for Android projects
 * 6. Start the Kotlin LSP server
 * 
 * @async
 * @param {ExtensionContext} context - The VSCode extension context
 */
export async function activate(context: ExtensionContext) {
    _context = context
    initOutputChannel(context)
    
    logInfo('Android LSP extension activating...');
    
    // Register feature modules
    registerDecompiler(context)
    registerOpeningJars()
    registerDapServer(context);
    registerDebugJava(context)
    registerDatabase(context);
    registerCommands(context)
    registerStatusBarItem()
    initLspClient()
    
    // Initialize ADT manager
    const adtManager = initAdtManager(context);
    await adtManager.initialize();
    
    // Detect and configure project
    const workspaceRoot = getWorkspaceRoot();
    
    if (workspaceRoot) {
        logInfo(`Workspace root: ${workspaceRoot}`);
        
        // Detect project type
        const projectInfo = await detectProject(workspaceRoot);
        logInfo(`Project detection: Android=${projectInfo.isAndroid}, Gradle=${projectInfo.hasGradle}, Kotlin=${projectInfo.hasKotlin}`);
        
        // Update status bar
        setAndroidProject(projectInfo.isAndroid);
        
        // Generate workspace.json for Android projects
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
    
    // Start the LSP server
    await startLspClient()
    
    logInfo('Android LSP extension activated');
}

/**
 * Initializes the output channel for extension logging.
 * 
 * Creates a named output channel using the extension's display name
 * from package.json, or falls back to 'Android LSP' if not available.
 * 
 * @param {ExtensionContext} context - The extension context
 */
function initOutputChannel(context: ExtensionContext) {
    const extension = extensions.getExtension(context.extension.id);
    const pkg = extension?.packageJSON as { displayName?: string } | undefined;
    _outputChannel = window.createOutputChannel(pkg?.displayName ?? 'Android LSP');
}
