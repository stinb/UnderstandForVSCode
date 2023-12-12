'use strict';


import * as vscode from 'vscode';

import { variables } from '../other/variables';


// Explore current file in Understand
export function currentFile()
{
	// Stop if not in an editor
	const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
	if (editor === undefined)
		return;

	// Ask the server to open Understand
	// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#hoverParams
	variables.languageClient.sendNotification('openFileInUnderstand', {
		textDocument: editor.document.uri.toString(),
		position: {
			line: editor.selection.start.line + 1,
			character: editor.selection.start.character,
		},
	});
}
