'use strict';


import * as vscode from 'vscode';

import { variables } from '../other/variables';


// Created in JSON in the `data-vscode-context` attribute in
// - `AnnotationsViewProvider.draw`
interface AnnotationContext
{
	id: string,
}


export function addAnnotation(args: any)
{
	// Invoked from the file explorer
	if (args && typeof args.fsPath === 'string') {
		variables.languageClient.sendRequest('understand/addAnnotation', {
			kind: 'file',
			textDocument: {
				uri: vscode.Uri.file(args.fsPath),
			},
		});
		return;
	}

	// Invoked from the editor
	const editor = vscode.window.activeTextEditor;
	if (editor === undefined) {
		vscode.window.showErrorMessage('Expected an editor to annotate');
		return;
	}
	switch (args) {
		case 'entity':
			variables.languageClient.sendRequest('understand/addAnnotation', {
				kind: 'entity',
				position: {
					line: editor.selection.start.line,
					character: editor.selection.start.character,
				},
				textDocument: {
					uri: editor.document.uri.toString(),
				},
			});
			break;
		case 'file':
			variables.languageClient.sendRequest('understand/addAnnotation', {
				kind: 'file',
				textDocument: {
					uri: editor.document.uri.toString(),
				},
			});
			break;
		case 'line':
			variables.languageClient.sendRequest('understand/addAnnotation', {
				kind: 'line',
				textDocument: {
					uri: editor.document.uri.toString(),
				},
				position: {
					line: editor.selection.start.line,
					character: 0,
				}
			});
			break;
		default:
			variables.languageClient.sendRequest('understand/addAnnotation', {
				kind: 'auto',
				position: {
					line: editor.selection.start.line,
					character: editor.selection.start.character,
				},
				textDocument: {
					uri: editor.document.uri.toString(),
				},
			});
			break;
	}
}


export function deleteAnnotation(context: AnnotationContext)
{
	vscode.window.showWarningMessage(
		'Delete annotation', {modal: true}, 'Delete'
	).then(choice => {
		if (choice === 'Delete')
			variables.languageClient.sendRequest('understand/deleteAnnotation', {id: context.id});
	});
}


export function startEditingAnnotation(context: AnnotationContext)
{
	variables.annotationsViewProvider.edit(context.id);
}
