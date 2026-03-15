/*
 * Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE file for details.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface ProjectInfo {
    isAndroid: boolean;
    hasGradle: boolean;
    hasKotlin: boolean;
    gradleFiles: string[];
    manifestPath?: string;
}

export async function detectProject(workspaceRoot: string): Promise<ProjectInfo> {
    const gradleFiles = await findGradleFiles(workspaceRoot);
    const hasGradle = gradleFiles.length > 0;
    
    const manifestPath = await findAndroidManifest(workspaceRoot);
    const hasAndroidManifest = manifestPath !== undefined;
    
    const hasAndroidPlugin = hasGradle && await checkAndroidPlugin(gradleFiles);
    const hasKotlin = await checkKotlinFiles(workspaceRoot);
    
    const isAndroid = hasAndroidManifest || hasAndroidPlugin;

    return {
        isAndroid,
        hasGradle,
        hasKotlin,
        gradleFiles,
        manifestPath
    };
}

async function findGradleFiles(workspaceRoot: string): Promise<string[]> {
    const gradleFiles: string[] = [];
    
    const possibleFiles = [
        'build.gradle',
        'build.gradle.kts',
        'settings.gradle',
        'settings.gradle.kts'
    ];

    for (const file of possibleFiles) {
        const filePath = path.join(workspaceRoot, file);
        if (fs.existsSync(filePath)) {
            gradleFiles.push(filePath);
        }
    }

    return gradleFiles;
}

async function findAndroidManifest(workspaceRoot: string): Promise<string | undefined> {
    const possiblePaths = [
        'app/src/main/AndroidManifest.xml',
        'src/main/AndroidManifest.xml'
    ];

    for (const relativePath of possiblePaths) {
        const manifestPath = path.join(workspaceRoot, relativePath);
        if (fs.existsSync(manifestPath)) {
            return manifestPath;
        }
    }

    return await searchForAndroidManifest(workspaceRoot);
}

async function searchForAndroidManifest(root: string): Promise<string | undefined> {
    const maxDepth = 4;
    
    async function search(dir: string, depth: number): Promise<string | undefined> {
        if (depth > maxDepth) return undefined;
        
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    if (entry.name === 'build' || entry.name === '.gradle' || entry.name.startsWith('.')) {
                        continue;
                    }
                    
                    const manifestPath = path.join(dir, entry.name, 'src', 'main', 'AndroidManifest.xml');
                    if (fs.existsSync(manifestPath)) {
                        return manifestPath;
                    }
                    
                    const result = await search(path.join(dir, entry.name), depth + 1);
                    if (result) return result;
                }
            }
        } catch (e) {
            // Ignore permission errors
        }
        
        return undefined;
    }
    
    return search(root, 0);
}

async function checkAndroidPlugin(gradleFiles: string[]): Promise<boolean> {
    const androidPatterns = [
        /com\.android\.application/,
        /com\.android\.library/,
        /android\s*\{/,
        /plugins\s*\{[^}]*android[^}]*\}/,
        /id\s*\(\s*['"]com\.android\./,
        /apply\s+plugin:\s*['"]com\.android\./
    ];

    for (const gradleFile of gradleFiles) {
        try {
            const content = fs.readFileSync(gradleFile, 'utf-8');
            
            for (const pattern of androidPatterns) {
                if (pattern.test(content)) {
                    return true;
                }
            }
        } catch (e) {
            // Ignore read errors
        }
    }

    return false;
}

async function checkKotlinFiles(workspaceRoot: string): Promise<boolean> {
    const kotlinExtensions = ['.kt', '.kts'];
    
    async function search(dir: string, depth: number): Promise<boolean> {
        if (depth > 5) return false;
        
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    if (entry.name === 'build' || entry.name.startsWith('.')) {
                        continue;
                    }
                    
                    if (await search(path.join(dir, entry.name), depth + 1)) {
                        return true;
                    }
                } else {
                    const ext = path.extname(entry.name);
                    if (kotlinExtensions.includes(ext)) {
                        return true;
                    }
                }
            }
        } catch (e) {
            // Ignore permission errors
        }
        
        return false;
    }
    
    return search(workspaceRoot, 0);
}

export function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
}

export async function isAndroidProject(workspaceRoot: string): Promise<boolean> {
    const info = await detectProject(workspaceRoot);
    return info.isAndroid;
}
