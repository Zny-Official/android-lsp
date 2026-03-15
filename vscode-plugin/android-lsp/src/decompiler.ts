/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */

/**
 * @fileoverview JAR/JRT File Decompiler Support
 * 
 * This module provides functionality for viewing and navigating decompiled
 * Java/Kotlin code from JAR files and JRT (Java Runtime) modules. It enables
 * developers to inspect library source code without having the original sources.
 * 
 * Key features:
 * - On-the-fly decompilation of .class files from JARs
 * - Support for JRT (Java Runtime) modules
 * - Language detection and syntax highlighting for decompiled code
 * - Navigation to specific locations in decompiled files
 * 
 * @module decompiler
 */

import * as vscode from "vscode"
import {CancellationToken, commands, ExtensionContext, languages, TextDocumentContentProvider, Uri, workspace} from "vscode"

/**
 * Represents the content of a decompiled document.
 * 
 * @interface DecompiledDocumentContent
 * @property {string} code - The decompiled source code
 * @property {string} language - The language identifier (e.g., 'kotlin', 'java')
 */
interface DecompiledDocumentContent {
    code: string;
    language: string;
}

/**
 * Union type for document content, representing either valid content or an error state.
 * 
 * @typedef {DecompiledDocumentContent | 'error during decompilation'} DocumentContent
 */
type DocumentContent = DecompiledDocumentContent | 'error during decompilation';

/**
 * Registers the decompiler provider and related event handlers.
 * 
 * This function sets up:
 * 1. A TextDocumentContentProvider for 'jar' and 'jrt' URI schemes
 * 2. Event handlers for opening and closing decompiled documents
 * 3. Language switching for decompiled files
 * 
 * The decompiler works by:
 * 1. Intercepting requests to open jar:// or jrt:// URIs
 * 2. Sending a 'decompile' command to the LSP server
 * 3. Caching the decompiled content for subsequent requests
 * 4. Setting the appropriate language for syntax highlighting
 * 
 * @param {ExtensionContext} context - The VSCode extension context for registering disposables
 */
export function registerDecompiler(context: ExtensionContext) {
    /**
     * Cache for opened decompiled documents.
     * Maps URI strings to their decompiled content.
     */
    const openedDecompiledDocuments = new Map<string, DocumentContent>();
    
    /**
     * Disposer for clearing the document cache when the extension is deactivated.
     */
    const openDocumentsDisposer = {
        dispose() {
            openedDecompiledDocuments.clear();
        },
    }

    /**
     * Map of documents that need their language changed after opening.
     * This is needed because VSCode may open documents with the wrong language
     * initially, and we need to switch to the correct language after decompilation.
     */
    const documentsAwaitingToChangeTheirLanguage = new Map<string, string>();

    context.subscriptions.push(
        openDocumentsDisposer,
        
        /**
         * Handler for when a text document is opened.
         * Changes the document's language if it's awaiting a language switch.
         */
        workspace.onDidOpenTextDocument(async doc => {
            const uri = doc.uri;
            const language = documentsAwaitingToChangeTheirLanguage.get(uri.toString());
            if(!language) return
    
            if ((await languages.getLanguages()).includes(language) && doc.languageId !== language) {
                languages.setTextDocumentLanguage(doc, language);
            }
        }),
        
        /**
         * Handler for when a text document is closed.
         * Cleans up the language change map or document cache.
         */
        workspace.onDidCloseTextDocument(doc => {
            const uri = doc.uri;
            if (documentsAwaitingToChangeTheirLanguage.has(uri.toString())) {
                documentsAwaitingToChangeTheirLanguage.delete(uri.toString());
            } else {
                openedDecompiledDocuments.delete(uri.toString());
            }
        }),
    
    );

    /**
     * Event emitter for notifying when document content changes.
     */
    const onDidChange = new vscode.EventEmitter<vscode.Uri>();
    
    /**
     * TextDocumentContentProvider for decompiled JAR/JRT content.
     * 
     * This provider handles requests for documents with jar:// or jrt:// schemes,
     * decompiles the requested class files, and returns the source code.
     */
    const decompiler: TextDocumentContentProvider = {
        onDidChange: onDidChange.event,
        
        /**
         * Provides the text content for a decompiled document.
         * 
         * @param {Uri} uri - The URI of the document to provide content for
         * @param {CancellationToken} token - Cancellation token
         * @returns {Promise<string | null>} The decompiled source code, or null if cancelled
         */
        async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string | null> {
            // Return cached content if available
            if (openedDecompiledDocuments.has(uri.toString())) {
                const data = openedDecompiledDocuments.get(uri.toString())!;
                return data === 'error during decompilation' ? ERROR_DURING_DECOMPILATION_TEXT : data.code;
            }
            
            // Request decompilation from the LSP server
            let response: DecompiledDocumentContent | null = null;
            try {
                response = await commands.executeCommand("decompile", uri.toString());
            } catch (e) {
                console.error("Error executing decompile command:", e);
                response = null;
            }
            
            // Handle decompilation failure
            if (!response) {
                openedDecompiledDocuments.set(uri.toString(), 'error during decompilation');
                return ERROR_DURING_DECOMPILATION_TEXT;
            }
            
            // Store the decompiled content and queue language change
            documentsAwaitingToChangeTheirLanguage.set(uri.toString(), response.language);
            openedDecompiledDocuments.set(uri.toString(), response);
            return response.code;
        }
    };

    // Register the decompiler provider for supported URI schemes
    for (const scheme of supportedProtocols) {
        context.subscriptions.push(workspace.registerTextDocumentContentProvider(scheme, decompiler));
    }

    /**
     * Invalidates all open binary documents by clearing the cache and firing change events.
     * This forces re-decompilation on next access.
     */
    function invalidateAllOpenBinaryDocuments() {
        for (const document of vscode.workspace.textDocuments) {
            openedDecompiledDocuments.clear();
            if (document.uri.scheme in supportedProtocols) {
                onDidChange.fire(document.uri);
            }
        }
    }
}

/**
 * Registers the command for navigating to a specific location in a JAR file.
 * 
 * This command is used when clicking on inlay hints or other navigation elements
 * that reference code inside JAR files. It opens the decompiled file and positions
 * the cursor at the specified location.
 * 
 * @example
 * // Command is invoked with:
 * // uriString: 'jar:///path/to/file.jar!/com/example/SomeClass.class'
 * // line: 10
 * // character: 5
 */
export function registerOpeningJars() {
    vscode.commands.registerCommand('androidLsp.navigateToJarLocation', async (uriString: string, line: number, character: number) => {
        try {
            const uri = vscode.Uri.parse(uriString);

            // Validate the URI scheme
            if (!supportedProtocols.includes(uri.scheme)) {
                console.error(`[NavigateToJar] Invalid URI decompiled scheme: ${uri.scheme}, expected 'jar' or 'jrt'`);
                return;
            }

            // Open the decompiled document
            const doc = await vscode.workspace.openTextDocument(uri);

            // Position the cursor at the specified location
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

/** Error message displayed when decompilation fails */
const ERROR_DURING_DECOMPILATION_TEXT = 'Cannot decompile file'

/** Supported URI schemes for decompilation */
const supportedProtocols: readonly string[] = ["jar", "jrt"]
