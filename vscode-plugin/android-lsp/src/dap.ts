/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */

/**
 * @fileoverview Debug Adapter Protocol (DAP) Server Registration
 * 
 * This module registers the Debug Adapter Protocol server for Android/Kotlin
 * debugging support in VSCode. It provides the infrastructure for attaching
 * the debugger to running Android/Kotlin applications.
 * 
 * @module dap
 */

import {
    CancellationToken,
    commands,
    debug,
    DebugAdapterDescriptorFactory,
    DebugAdapterExecutable,
    DebugAdapterServer,
    DebugConfiguration,
    DebugConfigurationProvider,
    DebugSession,
    type ExtensionContext,
    WorkspaceFolder,
} from "vscode"

/**
 * Registers the DAP server and debug configuration provider.
 * 
 * This function sets up:
 * 1. A DebugAdapterDescriptorFactory that creates a connection to the debug server
 *    running on a dynamically allocated port
 * 2. A DebugConfigurationProvider that provides default debug configurations
 *    for Android/Kotlin projects
 * 
 * The debug server is started by the Kotlin LSP server, which communicates
 * the port back to the extension via the 'start_debug_server' command.
 * 
 * @param {ExtensionContext} context - The VSCode extension context for registering disposables
 */
export function registerDapServer(context: ExtensionContext) {
    /**
     * Factory for creating debug adapter descriptors.
     * 
     * This factory connects to a debug server started by the Kotlin LSP.
     * The LSP server starts a debug server on a port and returns it via
     * the 'start_debug_server' command.
     */
    const dapServerFactory: DebugAdapterDescriptorFactory = {
        /**
         * Creates a debug adapter descriptor for the given debug session.
         * 
         * @param {DebugSession} session - The debug session to create an adapter for
         * @param {DebugAdapterExecutable} executable - The default executable (unused)
         * @returns {Promise<DebugAdapterServer>} A debug adapter connected to the LSP debug server
         */
        async createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable) {
            const port: number = await commands.executeCommand("start_debug_server", session.workspaceFolder?.uri.toString());
            return new DebugAdapterServer(port)
        }
    }
    context.subscriptions.push(debug.registerDebugAdapterDescriptorFactory("android_debugger", dapServerFactory))

    /**
     * Provider for debug configurations.
     * 
     * Provides default configurations and resolves configurations for
     * the Android debugger type.
     */
    const debugConfigProvider: DebugConfigurationProvider = {
        /**
         * Provides initial debug configurations for a workspace folder.
         * 
         * Returns a default "attach" configuration for Android/Kotlin debugging.
         * 
         * @param {WorkspaceFolder} folder - The workspace folder
         * @param {CancellationToken} token - Cancellation token
         * @returns {Promise<DebugConfiguration[]>} Array of default configurations
         */
        async provideDebugConfigurations(folder: WorkspaceFolder, token: CancellationToken) {
            const config: DebugConfiguration = {
                type: "android_debugger",
                request: "attach",
                name: "Attach Android/Kotlin Program"
            }
            return [config];
        },

        /**
         * Resolves a debug configuration before it's used to start debugging.
         * 
         * @param {WorkspaceFolder} folder - The workspace folder
         * @param {DebugConfiguration} debugConfiguration - The configuration to resolve
         * @param {CancellationToken} token - Cancellation token
         * @returns {Promise<DebugConfiguration>} The resolved configuration
         */
        async resolveDebugConfiguration(folder: WorkspaceFolder, debugConfiguration: DebugConfiguration, token: CancellationToken) {
            return debugConfiguration;
        },

        /**
         * Resolves a debug configuration after variable substitution.
         * 
         * @param {WorkspaceFolder} folder - The workspace folder
         * @param {DebugConfiguration} debugConfiguration - The configuration with variables substituted
         * @param {CancellationToken} token - Cancellation token
         * @returns {Promise<DebugConfiguration>} The resolved configuration
         */
        async resolveDebugConfigurationWithSubstitutedVariables(folder: WorkspaceFolder, debugConfiguration: DebugConfiguration, token: CancellationToken) {
            return debugConfiguration;
        }
    }

    context.subscriptions.push(debug.registerDebugConfigurationProvider("android_debugger", debugConfigProvider))
}
