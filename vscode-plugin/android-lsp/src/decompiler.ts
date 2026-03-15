/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */
import * as vscode from "vscode"
import {CancellationToken, commands, ExtensionContext, languages, TextDocumentContentProvider, Uri, workspace} from "vscode"

interface DecompiledDocumentContent {
    code: string;
    language: string;
}

type DocumentContent = DecompiledDocumentContent | 'error during decompilation';

export function registerDecompiler(context: ExtensionContext) {
    const openedDecompiledDocuments = new Map<string, DocumentContent>();
    const openDocumentsDisposer = {
        dispose() {
            openedDecompiledDocuments.clear();
        },
    }

    const documentsAwaitingToChangeTheirLanguage = new Map<string, string>();

    context.subscriptions.push(
        openDocumentsDisposer,
        workspace.onDidOpenTextDocument(async doc => {
            const uri = doc.uri;
            const language = documentsAwaitingToChangeTheirLanguage.get(uri.toString());
            if(!language) return
    
            if ((await languages.getLanguages()).includes(language) && doc.languageId !== language) {
                languages.setTextDocumentLanguage(doc, language);
            }
        }),
        workspace.onDidCloseTextDocument(doc => {
            const uri = doc.uri;
            if (documentsAwaitingToChangeTheirLanguage.has(uri.toString())) {
                documentsAwaitingToChangeTheirLanguage.delete(uri.toString());
            } else {
                openedDecompiledDocuments.delete(uri.toString());
            }
        }),
    
    );

    const onDidChange = new vscode.EventEmitter<vscode.Uri>();
    const decompiler: TextDocumentContentProvider = {
        onDidChange: onDidChange.event,
        async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string | null> {
            if (openedDecompiledDocuments.has(uri.toString())) {
                const data = openedDecompiledDocuments.get(uri.toString())!;
                return data === 'error during decompilation' ? ERROR_DURING_DECOMPILATION_TEXT : data.code;
            }
            let response: DecompiledDocumentContent | null = null;
            try {
                response = await commands.executeCommand("decompile", uri.toString());
            } catch (e) {
                console.error("Error executing decompile command:", e);
                response = null;
            }
            if (!response) {
                openedDecompiledDocuments.set(uri.toString(), 'error during decompilation');
                return ERROR_DURING_DECOMPILATION_TEXT;
            }
            documentsAwaitingToChangeTheirLanguage.set(uri.toString(), response.language);
            openedDecompiledDocuments.set(uri.toString(), response);
            return response.code;
        }
    };

    for (const scheme of supportedProtocols) {
        context.subscriptions.push(workspace.registerTextDocumentContentProvider(scheme, decompiler));
    }

    function invalidateAllOpenBinaryDocuments() {
        for (const document of vscode.workspace.textDocuments) {
            openedDecompiledDocuments.clear();
            if (document.uri.scheme in supportedProtocols) {
                onDidChange.fire(document.uri);
            }
        }
    }
}

export function registerOpeningJars() {
    vscode.commands.registerCommand('androidLsp.navigateToJarLocation', async (uriString: string, line: number, character: number) => {
        try {
            const uri = vscode.Uri.parse(uriString);

            if (!supportedProtocols.includes(uri.scheme)) {
                console.error(`[NavigateToJar] Invalid URI decompiled scheme: ${uri.scheme}, expected 'jar' or 'jrt'`);
                return;
            }

            const doc = await vscode.workspace.openTextDocument(uri);

            const position = new vscode.Position(line, character);
            const range = new vscode.Range(position, position);
            await vscode.window.showTextDocument(doc, {
                selection: range,
                preserveFocus: false
            });
        } catch (e) {
            console.error(`[NavigateToJar] Failed to navigate:`, e);
            vscode.window.showErrorMessage(`Failed to navigate: ${e}`);
        }
    })
}

const ERROR_DURING_DECOMPILATION_TEXT = 'Cannot decompile file'

const supportedProtocols: readonly string[] = ["jar", "jrt"]
