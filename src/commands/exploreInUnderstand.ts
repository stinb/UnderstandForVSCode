'use strict';


import * as vscode from 'vscode';

import { variables } from '../other/variables';


/** Explore current file in Understand */
export function currentFile()
{
	// Stop if not in an editor
	const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
	if (editor === undefined)
		return;

	// Ask the server to open Understand
	// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocumentPositionParams
	variables.languageClient.sendNotification('openFileInUnderstand', {
		textDocument: {
			uri: editor.document.uri.toString(),
		},
		position: {
			line: editor.selection.start.line + 1,
			character: editor.selection.start.character,
		},
	});
}


/** Create a new project in Understand using the only directory or a prompt */
export async function newProject()
{
	// Get the folder or fail
	const uris = await vscode.window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: 'Select',
		title: 'Root directory of your source code',
	});
	if (!uris || uris.length !== 1)
		return;

	// Ask userver to open Understand
	variables.languageClient.sendNotification('newProjectInUnderstand', {
		uri: uris[0].toString(),
	});
}
