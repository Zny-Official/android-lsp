/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */
import {commands, type ExtensionContext, window,} from "vscode"

export function registerDatabase(context: ExtensionContext) {
    context.subscriptions.push(
            commands.registerCommand(
                    'androidLsp.database.createDataSource',
                    async () => {
                        const value = await window.showInputBox({
                            title: 'Create data source',
                            prompt: 'jdbc url',
                            placeHolder: '',
                            ignoreFocusOut: true,
                        });

                        if (value === undefined) {
                            return;
                        }

                        commands.executeCommand('database.create.data.source', value)
                    }
            )
    );
    context.subscriptions.push(
            commands.registerCommand(
                    'androidLsp.database.assignDataSource',
                    async () => {
                        const editor = window.activeTextEditor;
                        if (editor === undefined) {
                            window.showErrorMessage('No current file')
                            return;
                        }
                        const dataSources: any[] = await commands.executeCommand("database.list.data.sources")
                        if (dataSources.length == 0) {
                            window.showErrorMessage('No data sources available')
                            return;
                        }
                        const dataSource = await window.showQuickPick(dataSources.map((ds: any): any => ({label: ds.name, id: ds.uuid})));

                        if (dataSource === undefined) {
                            return;
                        }
                        const document = editor.document;
                        const url = document.uri.toString();
                        commands.executeCommand('database.assign.data.source', url, dataSource.id)
                    }
            )
    );
}
