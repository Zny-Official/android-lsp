/*
 * Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE file for details.
 */
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { promisify } from 'util';

const exec = promisify(child_process.exec);
const execFile = promisify(child_process.execFile);

export interface AdtCliResult {
    success: boolean;
    output?: string;
    error?: string;
}

export class AdtManager {
    private context: vscode.ExtensionContext;
    private adtCliPath: string | undefined;
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }
    
    async initialize(): Promise<void> {
        this.adtCliPath = await this.findAdtCli();
    }
    
    private async findAdtCli(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('androidLSP');
        const customPath = config.get<string>('adtCliPath');
        
        if (customPath && fs.existsSync(customPath)) {
            return customPath;
        }
        
        const bundledPath = this.getBundledAdtCliPath();
        if (bundledPath && fs.existsSync(bundledPath)) {
            return bundledPath;
        }
        
        const systemPath = await this.findInSystemPath();
        if (systemPath) {
            return systemPath;
        }
        
        return undefined;
    }
    
    private getBundledAdtCliPath(): string {
        const platform = process.platform;
        const adtCliName = platform === 'win32' ? 'adt-cli.bat' : 'adt-cli';
        return path.join(this.context.extensionPath, 'adt-cli', 'bin', adtCliName);
    }
    
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
    
    isAvailable(): boolean {
        return this.adtCliPath !== undefined;
    }
    
    getAdtCliPath(): string | undefined {
        return this.adtCliPath;
    }
    
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

let _adtManager: AdtManager | undefined;

export function getAdtManager(): AdtManager {
    if (!_adtManager) {
        throw new Error('AdtManager not initialized');
    }
    return _adtManager;
}

export function initAdtManager(context: vscode.ExtensionContext): AdtManager {
    _adtManager = new AdtManager(context);
    return _adtManager;
}
