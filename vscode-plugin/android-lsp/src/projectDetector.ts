/*
 * Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE file for details.
 */

/**
 * @fileoverview Android/Kotlin Project Detection
 * 
 * This module provides functionality to detect and analyze the type of
 * project in the current workspace. It determines whether the project is
 * an Android project, a pure Kotlin project, or neither.
 * 
 * Detection criteria for Android projects:
 * - Presence of AndroidManifest.xml
 * - Presence of Android Gradle plugin in build.gradle files
 * - Gradle configuration files (build.gradle, settings.gradle)
 * 
 * @module projectDetector
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Represents information about the detected project type.
 * 
 * @interface ProjectInfo
 * @property {boolean} isAndroid - Whether this is an Android project
 * @property {boolean} hasGradle - Whether Gradle build files exist
 * @property {boolean} hasKotlin - Whether Kotlin source files exist
 * @property {string[]} gradleFiles - List of found Gradle file paths
 * @property {string} [manifestPath] - Path to AndroidManifest.xml if found
 */
export interface ProjectInfo {
    isAndroid: boolean;
    hasGradle: boolean;
    hasKotlin: boolean;
    gradleFiles: string[];
    manifestPath?: string;
}

/**
 * Detects the project type and characteristics of the workspace.
 * 
 * This function performs a comprehensive analysis of the workspace to determine:
 * 1. Whether Gradle build files are present
 * 2. Whether an Android manifest exists
 * 3. Whether Android plugins are configured in Gradle
 * 4. Whether Kotlin source files exist
 * 
 * A project is considered an Android project if it has either:
 * - An AndroidManifest.xml file, OR
 * - Gradle files with Android plugin configuration
 * 
 * @async
 * @param {string} workspaceRoot - The root path of the workspace to analyze
 * @returns {Promise<ProjectInfo>} Information about the detected project type
 */
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

/**
 * Finds Gradle build files in the workspace root.
 * 
 * Searches for the following files:
 * - build.gradle (Groovy DSL)
 * - build.gradle.kts (Kotlin DSL)
 * - settings.gradle (Groovy DSL)
 * - settings.gradle.kts (Kotlin DSL)
 * 
 * @async
 * @param {string} workspaceRoot - The root path to search
 * @returns {Promise<string[]>} Array of found Gradle file paths
 */
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

/**
 * Finds the AndroidManifest.xml file in the workspace.
 * 
 * First checks common locations:
 * - app/src/main/AndroidManifest.xml
 * - src/main/AndroidManifest.xml
 * 
 * If not found, performs a recursive search up to a depth of 4 levels.
 * 
 * @async
 * @param {string} workspaceRoot - The root path to search
 * @returns {Promise<string | undefined>} The path to AndroidManifest.xml, or undefined if not found
 */
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

/**
 * Recursively searches for AndroidManifest.xml in the directory tree.
 * 
 * Skips common directories that don't contain source code:
 * - build/ (build outputs)
 * - .gradle/ (Gradle cache)
 * - Hidden directories (starting with .)
 * 
 * @async
 * @param {string} root - The root directory to start searching from
 * @returns {Promise<string | undefined>} The path to AndroidManifest.xml, or undefined if not found
 */
async function searchForAndroidManifest(root: string): Promise<string | undefined> {
    const maxDepth = 4;
    
    /**
     * Recursive helper function for directory traversal.
     * 
     * @param {string} dir - Current directory being searched
     * @param {number} depth - Current recursion depth
     * @returns {Promise<string | undefined>} The manifest path if found
     */
    async function search(dir: string, depth: number): Promise<string | undefined> {
        if (depth > maxDepth) return undefined;
        
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Skip build and hidden directories
                    if (entry.name === 'build' || entry.name === '.gradle' || entry.name.startsWith('.')) {
                        continue;
                    }
                    
                    // Check for manifest in standard location
                    const manifestPath = path.join(dir, entry.name, 'src', 'main', 'AndroidManifest.xml');
                    if (fs.existsSync(manifestPath)) {
                        return manifestPath;
                    }
                    
                    // Recurse into subdirectory
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

/**
 * Checks if Gradle files contain Android plugin configuration.
 * 
 * Searches for patterns indicating Android plugin usage:
 * - com.android.application
 * - com.android.library
 * - android { } block
 * - plugins { ... android ... }
 * - id('com.android.') or id("com.android.")
 * - apply plugin: 'com.android.'
 * 
 * @async
 * @param {string[]} gradleFiles - Array of Gradle file paths to check
 * @returns {Promise<boolean>} True if Android plugin is detected
 */
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

/**
 * Checks if Kotlin source files exist in the workspace.
 * 
 * Searches for files with extensions:
 * - .kt (Kotlin source files)
 * - .kts (Kotlin script files)
 * 
 * Skips build and hidden directories during the search.
 * 
 * @async
 * @param {string} workspaceRoot - The root path to search
 * @returns {Promise<boolean>} True if Kotlin files are found
 */
async function checkKotlinFiles(workspaceRoot: string): Promise<boolean> {
    const kotlinExtensions = ['.kt', '.kts'];
    
    /**
     * Recursive helper function for directory traversal.
     * 
     * @param {string} dir - Current directory being searched
     * @param {number} depth - Current recursion depth
     * @returns {Promise<boolean>} True if Kotlin file is found
     */
    async function search(dir: string, depth: number): Promise<boolean> {
        if (depth > 5) return false;
        
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Skip build and hidden directories
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

/**
 * Gets the workspace root path from the current VSCode workspace.
 * 
 * Returns the first workspace folder's path, or undefined if no
 * workspace is open.
 * 
 * @returns {string | undefined} The workspace root path, or undefined
 */
export function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
}

/**
 * Checks if the workspace contains an Android project.
 * 
 * Convenience function that wraps detectProject() and returns
 * only the isAndroid flag.
 * 
 * @async
 * @param {string} workspaceRoot - The root path to check
 * @returns {Promise<boolean>} True if the workspace is an Android project
 */
export async function isAndroidProject(workspaceRoot: string): Promise<boolean> {
    const info = await detectProject(workspaceRoot);
    return info.isAndroid;
}
