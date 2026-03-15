/*
 * Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE file for details.
 */

/**
 * @fileoverview Workspace.json Generation Manager
 * 
 * This module manages the generation of workspace.json files for Kotlin LSP.
 * The workspace.json file contains project structure information including:
 * - Module definitions
 * - Library dependencies
 * - SDK configurations
 * - Kotlin compiler settings
 * 
 * For Android projects, this file is essential for the Kotlin LSP to understand
 * the project structure and provide accurate code completion, navigation, and
 * other IDE features.
 * 
 * @module workspaceGenerator
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getAdtManager } from './adtManager';
import { logInfo } from './extension';

/**
 * Represents the result of a workspace.json generation operation.
 * 
 * @interface WorkspaceGenerationResult
 * @property {boolean} success - Whether the generation was successful
 * @property {string} [workspacePath] - The path to the generated workspace.json (on success)
 * @property {string} [error] - Error message (on failure)
 */
export interface WorkspaceGenerationResult {
    success: boolean;
    workspacePath?: string;
    error?: string;
}

/**
 * Manages workspace.json generation for Android projects.
 * 
 * This class provides methods to generate workspace.json files that are
 * required by the Kotlin LSP to understand Android project structure.
 * 
 * The generation process:
 * 1. Checks for ADT CLI availability
 * 2. Validates Java version (requires Java 21+)
 * 3. Executes ADT CLI to parse Gradle dependencies
 * 4. Generates workspace.json with module and library information
 * 
 * @class WorkspaceGenerator
 */
export class WorkspaceGenerator {
    /** The filename for the generated workspace configuration */
    private static WORKSPACE_FILE = 'workspace.json';
    
    /**
     * Generates workspace.json if it doesn't exist or needs updating.
     * 
     * This method will:
     * 1. Remove any existing workspace.json
     * 2. Generate a fresh workspace.json using ADT CLI
     * 
     * Use this for automatic generation during extension activation.
     * 
     * @async
     * @param {string} projectPath - The root path of the Android project
     * @returns {Promise<WorkspaceGenerationResult>} The result of the generation
     */
    async generateIfNeeded(projectPath: string): Promise<WorkspaceGenerationResult> {
        const workspacePath = path.join(projectPath, WorkspaceGenerator.WORKSPACE_FILE);
        
        if (fs.existsSync(workspacePath)) {
            fs.unlinkSync(workspacePath);
            logInfo('Removed existing workspace.json');
        }
        
        return await this.generate(projectPath, workspacePath);
    }
    
    /**
     * Generates a workspace.json file for the specified project.
     * 
     * This method performs the actual generation:
     * 1. Validates ADT CLI availability
     * 2. Checks Java version requirements
     * 3. Shows a progress notification during generation
     * 4. Calls ADT CLI to generate the file
     * 
     * @async
     * @param {string} projectPath - The root path of the Android project
     * @param {string} [outputPath] - Optional custom output path; defaults to projectPath/workspace.json
     * @returns {Promise<WorkspaceGenerationResult>} The result of the generation
     */
    async generate(projectPath: string, outputPath?: string): Promise<WorkspaceGenerationResult> {
        const workspacePath = outputPath || path.join(projectPath, WorkspaceGenerator.WORKSPACE_FILE);
        
        const adtManager = getAdtManager();
        
        // Check ADT CLI availability
        if (!adtManager.isAvailable()) {
            // Check Java version first to provide better error message
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
        
        // Show progress notification during generation
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
        
        // Verify the file was created
        if (fs.existsSync(workspacePath)) {
            logInfo(`workspace.json generated: ${workspacePath}`);
            return { success: true, workspacePath };
        }
        
        return {
            success: false,
            error: 'workspace.json was not generated'
        };
    }
    
    /**
     * Forces regeneration of workspace.json.
     * 
     * This method always regenerates the workspace.json file, regardless
     * of whether it already exists. Use this for manual sync operations
     * when the user wants to refresh the project configuration.
     * 
     * @async
     * @param {string} projectPath - The root path of the Android project
     * @returns {Promise<WorkspaceGenerationResult>} The result of the generation
     */
    async forceRegenerate(projectPath: string): Promise<WorkspaceGenerationResult> {
        const workspacePath = path.join(projectPath, WorkspaceGenerator.WORKSPACE_FILE);
        
        // Remove existing file if present
        if (fs.existsSync(workspacePath)) {
            fs.unlinkSync(workspacePath);
        }
        
        return await this.generate(projectPath, workspacePath);
    }
}

/** Singleton instance of WorkspaceGenerator */
let _workspaceGenerator: WorkspaceGenerator | undefined;

/**
 * Gets the singleton WorkspaceGenerator instance.
 * 
 * Creates a new instance if one doesn't exist.
 * 
 * @returns {WorkspaceGenerator} The WorkspaceGenerator instance
 */
export function getWorkspaceGenerator(): WorkspaceGenerator {
    if (!_workspaceGenerator) {
        _workspaceGenerator = new WorkspaceGenerator();
    }
    return _workspaceGenerator;
}
