'use strict';


import * as vscode from 'vscode';

import { variables } from '../other/variables';


export const contexts = {
	project: 'understandProject',
	file: 'understandFile',
};


/** Enable/disable a context, which can enable/disable commands in package.json */
export function setContext(name: string, enabled: boolean)
{
	setContextHelper(name, enabled);

	// If the project context was set, then set the file context also
	if (name === contexts.project) {
		if (enabled)
			onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
		else
			setContextHelper(contexts.file, false);
	}
}


/** When the editor changes (or when otherwise called) enable/disable the 'understandFile' context */
export async function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined)
{
	// Unresolved if no editor or the editor isn't a file
	if (editor === undefined || editor.document.uri.scheme !== 'file')
		return setContext(contexts.file, false);

	// Resolved if the language server says so
	const resolved: boolean = await variables.languageClient.sendRequest('understand/isResolved', {
		uri: editor.document.uri.toString(),
	});
	setContext(contexts.file, resolved);
}


/** Actually set the context */
function setContextHelper(name: string, enabled: boolean)
{
	vscode.commands.executeCommand('setContext', name, enabled || undefined);
}
