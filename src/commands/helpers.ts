'use strict';


import * as vscode from 'vscode';

import { variables } from '../other/variables';


/** Execute the server-defined command at the current editor position */
export function executeAtPosition(command: string)
{
	// Stop if not in an editor
	const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
	if (editor === undefined)
		return;

	// Ask the server to do it
	// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocumentPositionParams
	variables.languageClient.sendRequest('workspace/executeCommand', {
		command: command,
		arguments: [
			{
				textDocument: {
					uri: editor.document.uri.toString(),
				},
				position: {
					line: editor.selection.start.line,
					character: editor.selection.start.character,
				},
			},
		],
	});
}
