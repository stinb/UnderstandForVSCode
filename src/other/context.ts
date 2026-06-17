import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { focusedUniqueName } from './sync';


export const contexts = {
	project: 'understandProject',
	file: 'understandFile',
};


const DELAY_MILLISECONDS = 100;


let preserveView = '';
let selectionTimeout: NodeJS.Timeout | undefined;


/** When the text cursor moves, notify the server */
export function actuallyChangedTextEditorSelection()
{
	preserveView = variables.preserveView;

	if (!selectionTimeout)
		selectionTimeout = setTimeout(sendSelection, DELAY_MILLISECONDS);
	else
		selectionTimeout.refresh();
}


export function onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent)
{
	// Filter out the "Output" view which spams this event
	if (event.textEditor.document.uri.scheme === 'output')
		return;
	actuallyChangedTextEditorSelection();
}


/** Enable/disable a context, which can enable/disable commands in package.json */
export async function setContext(name: string, enabled: boolean)
{
	setContextImpl(name, enabled);

	// If the project context was set, then set the file context also
	if (name === contexts.project) {
		const editor = vscode.window.activeTextEditor;
		if (enabled && editor) {
			const resolved: boolean = await variables.languageClient.sendRequest('understand/isResolved', {
				uri: editor.document.uri.toString(),
			});
			setContextImpl(contexts.file, resolved);
		}
		else {
			setContextImpl(contexts.file, false);
		}
	}
}


/** When the editor changes, tell the server */
async function sendSelection()
{
	const editor = vscode.window.activeTextEditor;

	if (!editor || !editor.selections.length || editor.document.uri.scheme !== 'file') {
		setContext(contexts.file, false);
		const uniqueName = focusedUniqueName();
		variables.languageClient.sendNotification('understand/sync', { uniqueName });
		return;
	}

	const position = editor.selections[0].active;

	variables.languageClient.sendNotification('understand/sync', {
		uri: editor.document.uri.toString(),
		line: position.line,
		character: position.character,
		preserve: preserveView,
	});

	const resolved: boolean = await variables.languageClient.sendRequest('understand/isResolved', {
		uri: editor.document.uri.toString(),
	});
	setContext(contexts.file, resolved);
}


/** Actually set the context */
function setContextImpl(name: string, enabled: boolean)
{
	vscode.commands.executeCommand('setContext', name, enabled || undefined);
}
