'use strict';


import * as vscode from 'vscode';

import { variables } from '../other/variables';


/**
 * Created in JSON in the `data-vscode-context` attribute in
 * - `AnnotationsViewProvider.draw`
 */
interface AnnotationContext
{
	id: string,
}


export async function addAnnotation(args: any, extra: any)
{
	const editor = vscode.window.activeTextEditor;

	// Invoked from
	// - Right-clicking a file in the file explorer
	// - Right-clicking the file name in an editor tab
	if (args && typeof args.path === 'string' && extra) {
		if (args.scheme !== 'file') {
			vscode.window.showErrorMessage('Expected a file to annotate');
			return;
		}

		const targetUri = vscode.Uri.file(args.path);

		// Open the editor and its focus on its annotations
		if (!editor || editor.document.uri.path !== args.path)
			await vscode.window.showTextDocument(targetUri).then(focusOnAnnotations);

		variables.languageClient.sendRequest('understand/addAnnotation', {
			kind: 'file',
			textDocument: {
				uri: targetUri.toString(),
			},
		});
		return;
	}

	// Invoked from
	// - Command, hopefully in an editor
	switch (args) {
		case 'entity':
			addEntityAnnotation();
			break;
		case 'file':
			addFileAnnotation();
			break;
		case 'line':
			addLineAnnotation();
			break;
		default:
			if (editor === undefined)
				return showNoEditorError();
			await focusOnAnnotations();
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


export async function addEntityAnnotation()
{
	const editor = vscode.window.activeTextEditor;
	if (!editor)
		return showNoEditorError();

	await focusOnAnnotations();

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
}


export async function addLineAnnotation()
{
	const editor = vscode.window.activeTextEditor;
	if (!editor)
		return showNoEditorError();

	await focusOnAnnotations();

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
}


export async function addFileAnnotation()
{
	const editor = vscode.window.activeTextEditor;
	if (!editor)
		return showNoEditorError();

	await focusOnAnnotations();

	variables.languageClient.sendRequest('understand/addAnnotation', {
		kind: 'file',
		textDocument: {
			uri: editor.document.uri.toString(),
		},
	});
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


async function focusOnAnnotations()
{
	return vscode.commands.executeCommand('understandAnnotations.focus');
}


function showNoEditorError()
{
	vscode.window.showErrorMessage('Expected an editor to annotate');
}
