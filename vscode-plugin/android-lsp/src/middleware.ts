/*
 * Original work Copyright (c) JetBrains s.r.o.
 * Modified work Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the Apache License, Version 2.0
 * This file is based on kotlin-vscode by JetBrains.
 * See THIRD-PARTY-NOTICES for license details.
 */
import {Middleware} from 'vscode-languageclient/node';

export const middleware: Middleware = {
    resolveInlayHint: async (hint, token, next) => {
        const result = await next(hint, token);

        if (result && result.label && typeof result.label === 'object' && Array.isArray(result.label)) {
            for (const part of result.label) {
                if ('location' in part && part.location) {
                    const uri = part.location.uri;

                    if (uri.scheme === 'jar' || uri.scheme === 'jrt') {
                        const range = part.location.range;

                        delete (part as any).location;
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
