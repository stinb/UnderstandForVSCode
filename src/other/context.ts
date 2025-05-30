'use strict';


import * as vscode from 'vscode';

import { variables } from '../other/variables';


export const contexts = {
	project: 'understandProject',
	file: 'understandFile',
};


const DELAY_MILLISECONDS = 100;


let editor: vscode.TextEditor | undefined;
let editorTimeout: NodeJS.Timeout | undefined;
let preserveView = '';
let selectionTimeout: NodeJS.Timeout | undefined;


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


export async function onDidChangeActiveTextEditor(newEditor: vscode.TextEditor | undefined)
{
	if (newEditor && newEditor.document.uri.scheme !== 'file')
		return;

	editor = newEditor;
	if (!editorTimeout)
		editorTimeout = setTimeout(sendEditor, DELAY_MILLISECONDS);
	else
		editorTimeout.refresh();
}


/** When the text cursor moves, notify the server */
export async function onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent)
{
	preserveView = variables.preserveView;
	if (event.textEditor.document.uri.scheme !== 'file')
		return;

	if (!selectionTimeout)
		selectionTimeout = setTimeout(sendSelection, DELAY_MILLISECONDS);
	else
		selectionTimeout.refresh();
}


/** When the editor changes enable/disable the 'understandFile' context */
async function sendEditor()
{
	const isFile = editor && editor.document.uri.scheme === 'file';

	if (!editor || isFile) {
		// Tell the server the new current editor
		const params = {uri: ''};
		if (editor)
			params.uri = editor.document.uri.toString();
		variables.languageClient.sendNotification('understand/changedCurrentFile', params);
	}

	// Unresolved if no editor or the editor isn't a file
	if (!editor || !isFile)
		return setContext(contexts.file, false);

	// Resolved if the language server says so
	const resolved: boolean = await variables.languageClient.sendRequest('understand/isResolved', {
		uri: editor.document.uri.toString(),
	});
	setContext(contexts.file, resolved);
}


/** When the editor changes, tell the server */
function sendSelection()
{
	if (!editor || !editor.selections.length || editor.document.uri.scheme !== 'file')
		return;

	const position = editor.selections[0].active;

	variables.languageClient.sendNotification('understand/changedCurrentFileCursor', {
		line: position.line,
		character: position.character,
		preserveView: preserveView,
	});
}


/** Actually set the context */
function setContextImpl(name: string, enabled: boolean)
{
	vscode.commands.executeCommand('setContext', name, enabled || undefined);
}
