/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */

/**
 * @fileoverview Database Integration Commands
 * 
 * This module provides commands for database integration within the Android LSP
 * extension. It allows users to create and assign data sources for database
 * operations directly from VSCode.
 * 
 * @module database
 */

import {commands, type ExtensionContext, window,} from "vscode"

/**
 * Registers database-related commands with VSCode.
 * 
 * This function registers two commands:
 * 1. 'androidLsp.database.createDataSource' - Creates a new data source from a JDBC URL
 * 2. 'androidLsp.database.assignDataSource' - Assigns a data source to the current file
 * 
 * These commands integrate with the Kotlin LSP's database features, allowing
 * developers to work with databases directly in their IDE.
 * 
 * @param {ExtensionContext} context - The VSCode extension context for registering disposables
 */
export function registerDatabase(context: ExtensionContext) {
    /**
     * Command: Create a new data source.
     * 
     * Prompts the user for a JDBC URL and creates a new data source
     * that can be used for database operations.
     * 
     * Example JDBC URLs:
     * - jdbc:mysql://localhost:3306/mydb
     * - jdbc:postgresql://localhost:5432/mydb
     * - jdbc:sqlite:/path/to/database.db
     */
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
    
    /**
     * Command: Assign a data source to the current file.
     * 
     * This command:
     * 1. Gets the currently active text editor
     * 2. Retrieves available data sources from the LSP
     * 3. Prompts the user to select a data source
     * 4. Associates the selected data source with the current file
     * 
     * This is useful for SQL files or code that interacts with databases,
     * enabling features like schema completion and query execution.
     */
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
