/*
 * Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE file for details.
 */

/**
 * @fileoverview ADT (Android Development Tools) CLI Manager
 * 
 * This module provides management functionality for the ADT CLI tool,
 * which is used to generate workspace.json files for Kotlin LSP integration.
 * It handles CLI discovery, execution, and result processing.
 * 
 * @module adtManager
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { promisify } from 'util';

const exec = promisify(child_process.exec);
const execFile = promisify(child_process.execFile);

/**
 * Represents the result of an ADT CLI operation.
 * 
 * @interface AdtCliResult
 * @property {boolean} success - Whether the operation completed successfully
 * @property {string} [output] - The stdout output from the CLI (on success)
 * @property {string} [error] - Error message (on failure)
 */
export interface AdtCliResult {
    success: boolean;
    output?: string;
    error?: string;
}

/**
 * Manages the ADT (Android Development Tools) CLI integration.
 * 
 * This class is responsible for:
 * - Discovering the ADT CLI executable (bundled, custom path, or system PATH)
 * - Executing ADT CLI commands for workspace generation
 * - Checking Java version requirements
 * 
 * @class AdtManager
 */
export class AdtManager {
    private context: vscode.ExtensionContext;
    private adtCliPath: string | undefined;
    
    /**
     * Creates an instance of AdtManager.
     * 
     * @param {vscode.ExtensionContext} context - The VSCode extension context
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }
    
    /**
     * Initializes the ADT manager by locating the ADT CLI executable.
     * 
     * Searches for the CLI in the following order:
     * 1. Custom path from configuration (androidLSP.adtCliPath)
     * 2. Bundled CLI in the extension directory
     * 3. System PATH
     * 
     * @async
     * @returns {Promise<void>}
     */
    async initialize(): Promise<void> {
        this.adtCliPath = await this.findAdtCli();
    }
    
    /**
     * Searches for the ADT CLI executable.
     * 
     * @private
     * @async
     * @returns {Promise<string | undefined>} The path to the CLI, or undefined if not found
     */
    private async findAdtCli(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('androidLSP');
        const customPath = config.get<string>('adtCliPath');
        
        if (customPath && fs.existsSync(customPath)) {
            return customPath;
        }
        
        const bundledPath = this.getBundledAdtCliPath();
        if (bundledPath && fs.existsSync(bundledPath)) {
            // Ensure the bundled CLI has execute permissions (VSIX doesn't preserve permissions)
            if (process.platform !== 'win32') {
                try {
                    await exec(`chmod +x "${bundledPath}"`);
                } catch (e) {
                    console.warn('Failed to set execute permission on bundled CLI:', e);
                }
            }
            return bundledPath;
        }
        
        const systemPath = await this.findInSystemPath();
        if (systemPath) {
            return systemPath;
        }
        
        return undefined;
    }
    
    /**
     * Gets the path to the bundled ADT CLI executable.
     * 
     * Returns the platform-specific executable name:
     * - Windows: adt-cli.bat
     * - Unix/macOS: adt-cli
     * 
     * @private
     * @returns {string} The absolute path to the bundled CLI
     */
    private getBundledAdtCliPath(): string {
        const platform = process.platform;
        const adtCliName = platform === 'win32' ? 'adt-cli.bat' : 'adt-cli';
        return path.join(this.context.extensionPath, 'adt-cli', 'bin', adtCliName);
    }
    
    /**
     * Searches for ADT CLI in the system PATH.
     * 
     * @private
     * @async
     * @returns {Promise<string | undefined>} The path to the CLI, or undefined if not found
     */
    private async findInSystemPath(): Promise<string | undefined> {
        try {
            const command = process.platform === 'win32' ? 'where adt-cli' : 'which adt-cli';
            const { stdout } = await exec(command);
            const trimmed = stdout.trim();
            if (trimmed && fs.existsSync(trimmed)) {
                return trimmed;
            }
        } catch (e) {
            // Not found in PATH
        }
        return undefined;
    }
    
    /**
     * Checks if the ADT CLI is available.
     * 
     * @returns {boolean} True if the CLI was found and is available
     */
    isAvailable(): boolean {
        return this.adtCliPath !== undefined;
    }
    
    /**
     * Gets the path to the ADT CLI executable.
     * 
     * @returns {string | undefined} The CLI path, or undefined if not available
     */
    getAdtCliPath(): string | undefined {
        return this.adtCliPath;
    }
    
    /**
     * Generates a workspace.json file for the specified Android project.
     * 
     * Executes the ADT CLI with the 'workspace' command, which:
     * - Parses Gradle dependencies
     * - Resolves Compose compiler plugin
     * - Attaches source JARs
     * - Generates module information
     * 
     * @async
     * @param {string} projectPath - The path to the Android project root
     * @param {string} outputPath - The output path for workspace.json
     * @returns {Promise<AdtCliResult>} The result of the operation
     */
    async generateWorkspace(projectPath: string, outputPath: string): Promise<AdtCliResult> {
        if (!this.adtCliPath) {
            return {
                success: false,
                error: 'ADT CLI not found. Please install adt-cli or configure androidLSP.adtCliPath setting.'
            };
        }
        
        const args = [
            'workspace',
            projectPath,
            '--output', outputPath,
            '--compose',
            '--sources'
        ];
        
        try {
            const { stdout, stderr } = await execFile(this.adtCliPath, args, {
                timeout: 300000, // 5 minutes timeout
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer
            });
            
            if (stderr && !stderr.includes('generated successfully')) {
                console.warn('ADT CLI stderr:', stderr);
            }
            
            return {
                success: true,
                output: stdout
            };
        } catch (error: any) {
            const errorMessage = error.message || String(error);
            console.error('ADT CLI error:', errorMessage);
            
            return {
                success: false,
                error: `Failed to generate workspace.json: ${errorMessage}`
            };
        }
    }
    
    /**
     * Resolves and analyzes the project structure.
     * 
     * Executes the ADT CLI with the 'resolve --workspace' command
     * to get detailed project structure information.
     * 
     * @async
     * @param {string} projectPath - The path to the Android project root
     * @returns {Promise<AdtCliResult>} The result containing project structure JSON
     */
    async resolveProject(projectPath: string): Promise<AdtCliResult> {
        if (!this.adtCliPath) {
            return {
                success: false,
                error: 'ADT CLI not found.'
            };
        }
        
        const args = [
            'resolve',
            projectPath,
            '--workspace'
        ];
        
        try {
            const { stdout } = await execFile(this.adtCliPath, args, {
                timeout: 300000,
                maxBuffer: 50 * 1024 * 1024
            });
            
            return {
                success: true,
                output: stdout
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }
    
    /**
     * Lists all available build variants for the project.
     * 
     * Executes the ADT CLI with the 'resolve --variants' command.
     * 
     * @async
     * @param {string} projectPath - The path to the Android project root
     * @returns {Promise<AdtCliResult>} The result containing variants JSON array
     */
    async listVariants(projectPath: string): Promise<AdtCliResult> {
        if (!this.adtCliPath) {
            return {
                success: false,
                error: 'ADT CLI not found.'
            };
        }
        
        const args = [
            'resolve',
            projectPath,
            '--variants'
        ];
        
        try {
            const { stdout } = await execFile(this.adtCliPath, args, {
                timeout: 60000
            });
            
            return {
                success: true,
                output: stdout
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }
    
    /**
     * Checks if the system has a valid Java installation (version 21+).
     * 
     * ADT CLI requires Java 21 or higher to run.
     * 
     * @async
     * @returns {Promise<{valid: boolean; version?: string; error?: string}>}
     *          Object containing validation result and version info
     */
    async checkJavaVersion(): Promise<{ valid: boolean; version?: string; error?: string }> {
        try {
            const { stdout } = await exec('java -version', {
                timeout: 10000
            });
            
            const versionMatch = stdout.match(/version "(\d+)/);
            if (versionMatch) {
                const majorVersion = parseInt(versionMatch[1]);
                return {
                    valid: majorVersion >= 21,
                    version: versionMatch[1]
                };
            }
            
            const altMatch = stdout.match(/version "1\.(\d+)/);
            if (altMatch) {
                const majorVersion = parseInt(altMatch[1]);
                return {
                    valid: majorVersion >= 21,
                    version: `1.${altMatch[1]}`
                };
            }
            
            return {
                valid: false,
                error: 'Could not determine Java version'
            };
        } catch (error: any) {
            return {
                valid: false,
                error: 'Java not found. Please install Java 21 or higher.'
            };
        }
    }
}

/** Singleton instance of AdtManager */
let _adtManager: AdtManager | undefined;

/**
 * Gets the singleton AdtManager instance.
 * 
 * @throws {Error} If AdtManager has not been initialized
 * @returns {AdtManager} The AdtManager instance
 */
export function getAdtManager(): AdtManager {
    if (!_adtManager) {
        throw new Error('AdtManager not initialized');
    }
    return _adtManager;
}

/**
 * Initializes and returns the singleton AdtManager instance.
 * 
 * @param {vscode.ExtensionContext} context - The VSCode extension context
 * @returns {AdtManager} The initialized AdtManager instance
 */
export function initAdtManager(context: vscode.ExtensionContext): AdtManager {
    _adtManager = new AdtManager(context);
    return _adtManager;
}
