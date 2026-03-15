/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
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

export function registerDapServer(context: ExtensionContext) {
    const dapServerFactory: DebugAdapterDescriptorFactory = {
        async createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable) {
            const port: number = await commands.executeCommand("start_debug_server", session.workspaceFolder?.uri.toString());
            return new DebugAdapterServer(port)
        }
    }
    context.subscriptions.push(debug.registerDebugAdapterDescriptorFactory("android_debugger", dapServerFactory))

    const debugConfigProvider: DebugConfigurationProvider = {
        async provideDebugConfigurations(folder: WorkspaceFolder, token: CancellationToken) {
            const config: DebugConfiguration = {
                type: "android_debugger",
                request: "attach",
                name: "Attach Android/Kotlin Program"
            }
            return [config];
        },

        async resolveDebugConfiguration(folder: WorkspaceFolder, debugConfiguration: DebugConfiguration, token: CancellationToken) {
            return debugConfiguration;
        },

        async resolveDebugConfigurationWithSubstitutedVariables(folder: WorkspaceFolder, debugConfiguration: DebugConfiguration, token: CancellationToken) {
            return debugConfiguration;
        }
    }

    context.subscriptions.push(debug.registerDebugConfigurationProvider("android_debugger", debugConfigProvider))
}
