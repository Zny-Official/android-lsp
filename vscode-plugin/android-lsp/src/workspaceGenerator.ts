/*
 * Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE file for details.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getAdtManager } from './adtManager';
import { logInfo } from './extension';

export interface WorkspaceGenerationResult {
    success: boolean;
    workspacePath?: string;
    error?: string;
}

export class WorkspaceGenerator {
    private static WORKSPACE_FILE = 'workspace.json';
    
    async generateIfNeeded(projectPath: string): Promise<WorkspaceGenerationResult> {
        const workspacePath = path.join(projectPath, WorkspaceGenerator.WORKSPACE_FILE);
        
        if (fs.existsSync(workspacePath)) {
            fs.unlinkSync(workspacePath);
            logInfo('Removed existing workspace.json');
        }
        
        return await this.generate(projectPath, workspacePath);
    }
    
    async generate(projectPath: string, outputPath?: string): Promise<WorkspaceGenerationResult> {
        const workspacePath = outputPath || path.join(projectPath, WorkspaceGenerator.WORKSPACE_FILE);
        
        const adtManager = getAdtManager();
        
        if (!adtManager.isAvailable()) {
            const javaCheck = await adtManager.checkJavaVersion();
            if (!javaCheck.valid) {
                return {
                    success: false,
                    error: javaCheck.error || 'Java 21+ is required for workspace generation'
                };
            }
            
            return {
                success: false,
                error: 'ADT CLI not found. Please install adt-cli or configure androidLSP.adtCliPath setting.'
            };
        }
        
        logInfo(`Generating workspace.json for: ${projectPath}`);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Android LSP',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Generating workspace.json...', increment: 0 });
            
            const result = await adtManager.generateWorkspace(projectPath, workspacePath);
            
            progress.report({ message: 'Complete', increment: 100 });
            
            if (!result.success) {
                throw new Error(result.error);
            }
        });
        
        if (fs.existsSync(workspacePath)) {
            logInfo(`workspace.json generated: ${workspacePath}`);
            return { success: true, workspacePath };
        }
        
        return {
            success: false,
            error: 'workspace.json was not generated'
        };
    }
    
    async forceRegenerate(projectPath: string): Promise<WorkspaceGenerationResult> {
        const workspacePath = path.join(projectPath, WorkspaceGenerator.WORKSPACE_FILE);
        
        if (fs.existsSync(workspacePath)) {
            fs.unlinkSync(workspacePath);
        }
        
        return await this.generate(projectPath, workspacePath);
    }
}

let _workspaceGenerator: WorkspaceGenerator | undefined;

export function getWorkspaceGenerator(): WorkspaceGenerator {
    if (!_workspaceGenerator) {
        _workspaceGenerator = new WorkspaceGenerator();
    }
    return _workspaceGenerator;
}
