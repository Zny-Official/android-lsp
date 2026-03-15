/*
 * Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE file for details.
 */

/**
 * @fileoverview Status Bar Management
 * 
 * This module manages the status bar item that displays the current state
 * of the Android LSP extension. It shows:
 * - Project type (Android or Kotlin)
 * - LSP server status (Running, Starting, Stopped)
 * - Quick action buttons for restart and Gradle sync
 * 
 * The status bar provides visual feedback to users about the extension's
 * current state and allows quick access to common actions.
 * 
 * @module statusBar
 */

import * as vscode from "vscode";
import {State} from "vscode-languageclient/node";
import { getContext } from "./extension";
import { getLspClient, subscribeToClientEvent } from "./lspClient";

/** Display title for the extension */
const TITLE = 'Android LSP'

/** Display title for the LSP server status */
const LSP_TITLE = 'Kotlin LSP'

/** The status bar item instance */
let statusBarItem: vscode.StatusBarItem | undefined;

/** Whether the current project is an Android project */
let isAndroidProject: boolean = false;

/**
 * Registers and initializes the status bar item.
 * 
 * Creates a status bar item positioned on the right side with priority 100.
 * The item displays:
 * - An icon indicating project type (mobile device for Android, code for Kotlin)
 * - The extension name
 * - A tooltip with detailed status information
 * 
 * Also subscribes to LSP client state changes to update the display accordingly.
 */
export function registerStatusBarItem() {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = TITLE;
    statusBarItem.show();
    updateView();
    getContext().subscriptions.push(statusBarItem);
    subscribeToClientEvent(() => updateView());
}

/**
 * Sets whether the current project is an Android project.
 * 
 * This affects the icon displayed in the status bar:
 * - Android project: mobile device icon
 * - Kotlin project: code icon
 * 
 * @param {boolean} value - True if the project is an Android project
 */
export function setAndroidProject(value: boolean) {
    isAndroidProject = value;
    updateView();
}

/**
 * Updates the status bar display.
 * 
 * Refreshes both the tooltip and text content based on the current
 * project type and LSP client state.
 */
function updateView() {
    if (!statusBarItem) return;
    statusBarItem.tooltip = computeTooltip();
    statusBarItem.text = computeText();
}

/**
 * Computes the tooltip content for the status bar item.
 * 
 * The tooltip displays:
 * - Extension name as a header
 * - Project type (Android Project or Kotlin Project)
 * - LSP server status with action buttons
 * 
 * @returns {vscode.MarkdownString} The formatted tooltip content
 */
function computeTooltip(): vscode.MarkdownString {
    const text = new vscode.MarkdownString()
    text.isTrusted = true;
    text.supportThemeIcons = true;
    text.supportHtml = true;

    const projectType = isAndroidProject ? 'Android Project' : 'Kotlin Project';
    const lspState = `<div>${getLspClientStatus()}</div>`
    text.appendMarkdown(`
<div>
<h4>${TITLE}</h4>
<div>📁 ${projectType}</div>
${lspState}
</div>
        `   
    )
    return text;
}

/**
 * Computes the text content for the status bar item.
 * 
 * The text includes:
 * - An icon based on project type and LSP state
 * - The extension name
 * 
 * Icons used:
 * - $(device-mobile) - Android project with running LSP
 * - $(code) - Kotlin project with running LSP
 * - $(sync) - LSP is starting
 * - $(stop) - LSP is stopped
 * 
 * @returns {string} The formatted status bar text
 */
function computeText(): string {
    const clientState = getLspClient()?.state ?? State.Stopped;
    const prefix = isAndroidProject ? '$(device-mobile)' : '$(code)';

    switch (clientState) {
        case State.Running:
            return `${prefix} ${TITLE}`;
        case State.Starting:
            return `$(sync) ${TITLE}`;
        default:
            return `$(stop) ${TITLE}`;
    }
}

/**
 * Gets the LSP client status HTML for the tooltip.
 * 
 * Returns an HTML string containing:
 * - Status indicator icon and text
 * - Restart button (always visible when not starting)
 * - Sync Gradle button (only for Android projects)
 * 
 * @returns {string} HTML string for the LSP status section
 */
function getLspClientStatus(): string {
    const clientState = getLspClient()?.state ?? State.Stopped;
    const restartButton = `<a href="command:androidLsp.restartLsp" title="Restart">$(sync)</a>`
    const syncButton = isAndroidProject 
        ? `&nbsp;&nbsp;<a href="command:androidLsp.syncGradle" title="Sync Gradle">$(refresh)</a>` 
        : '';
    
    switch (clientState) {
        case State.Running:
            return `$(check) ${LSP_TITLE}: Running&nbsp;&nbsp;${restartButton}${syncButton}`;
        case State.Starting:
            return `$(sync) ${LSP_TITLE}: Starting`;
        default:
            return `$(stop) ${LSP_TITLE}: Stopped&nbsp;&nbsp;${restartButton}`;
    }
}
