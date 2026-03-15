/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */

/**
 * @fileoverview LSP Middleware for Request/Response Processing
 * 
 * This module provides middleware functions that intercept and modify
 * LSP requests and responses between VSCode and the Kotlin LSP server.
 * 
 * Currently implements:
 * - Inlay hint resolution: Converts location references in JAR/JRT files
 *   to navigation commands, enabling click-to-navigate functionality
 *   for decompiled code.
 * 
 * @module middleware
 */

import {Middleware} from 'vscode-languageclient/node';

/**
 * LSP middleware configuration object.
 * 
 * This middleware intercepts LSP messages and can modify them before
 * they reach either the client or server. It's particularly useful for
 * handling edge cases that the standard LSP client doesn't support.
 * 
 * Currently configured middleware:
 * - resolveInlayHint: Handles navigation from inlay hints to JAR/JRT content
 */
export const middleware: Middleware = {
    /**
     * Middleware for resolving inlay hints.
     * 
     * This function intercepts inlay hint resolution responses and modifies
     * location references that point to JAR or JRT (Java Runtime) files.
     * 
     * Problem: VSCode's standard LSP client doesn't handle navigation to
     * JAR/JRT files correctly because these are virtual documents that need
     * to be decompiled on demand.
     * 
     * Solution: Convert location references to custom commands that:
     * 1. Open the decompiled file via our custom content provider
     * 2. Navigate to the specific line and character position
     * 
     * @param {any} hint - The inlay hint to resolve
     * @param {CancellationToken} token - Cancellation token
     * @param {Function} next - The next handler in the chain
     * @returns {Promise<any>} The modified or original inlay hint
     */
    resolveInlayHint: async (hint, token, next) => {
        const result = await next(hint, token);

        // Check if the result has a label with location references
        if (result && result.label && typeof result.label === 'object' && Array.isArray(result.label)) {
            for (const part of result.label) {
                // Check if this part has a location pointing to JAR or JRT
                if ('location' in part && part.location) {
                    const uri = part.location.uri;

                    if (uri.scheme === 'jar' || uri.scheme === 'jrt') {
                        const range = part.location.range;

                        // Remove the location property (VSCode can't handle it for JAR/JRT)
                        delete (part as any).location;
                        
                        // Add a command that will navigate to the decompiled content
                        (part as any).command = {
                            title: 'Go to definition',
                            command: 'androidLsp.navigateToJarLocation',
                            arguments: [uri.toString(), range.start.line, range.start.character]
                        };
                        (part as any).tooltip = (part as any).command.title;
                    }
                }
            }
        }

        return result;
    }
};
