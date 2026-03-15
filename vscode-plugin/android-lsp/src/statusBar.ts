/*
 * Copyright (c) 2024-2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE file for details.
 */
import * as vscode from "vscode";
import {State} from "vscode-languageclient/node";
import { getContext } from "./extension";
import { getLspClient, subscribeToClientEvent } from "./lspClient";

const TITLE = 'Android LSP'
const LSP_TITLE = 'Kotlin LSP'

let statusBarItem: vscode.StatusBarItem | undefined;
let isAndroidProject: boolean = false;

export function registerStatusBarItem() {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = TITLE;
    statusBarItem.show();
    updateView();
    getContext().subscriptions.push(statusBarItem);
    subscribeToClientEvent(() => updateView());
}

export function setAndroidProject(value: boolean) {
    isAndroidProject = value;
    updateView();
}

function updateView() {
    if (!statusBarItem) return;
    statusBarItem.tooltip = computeTooltip();
    statusBarItem.text = computeText();
}

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
