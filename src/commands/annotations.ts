import * as vscode from 'vscode';
import { basename } from 'path';

import { variables } from '../other/variables';
import { openNewAnnotationForm } from './annotateLine';
import { closeFieldEditorFor } from '../other/fieldEditor';


/**
 * Add Annotation, from the editor's context menu, a file's context menu in
 * the explorer or on its tab, or the palette: the field editor opens on a new
 * annotation. In an editor the server anchors it -- to the entity under the
 * cursor, else the line, else the file; a file picked in the explorer gets a
 * file annotation.
 */
export async function addAnnotation(args: any, extra: any)
{
	if (args && typeof args.path === 'string' && extra) {
		if (args.scheme !== 'file') {
			vscode.window.showErrorMessage('Expected a file to annotate');
			return;
		}
		const name = basename(args.path);
		await openNewAnnotationForm(
			{ kind: 'file', textDocument: { uri: vscode.Uri.file(args.path).toString() } },
			name);
		return;
	}

	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('Expected an editor to annotate');
		return;
	}
	await openNewAnnotationForm(
		{
			kind: 'auto',
			textDocument: { uri: editor.document.uri.toString() },
			position: {
				line: editor.selection.start.line,
				character: editor.selection.start.character,
			},
		},
		'New annotation');
}


/**
 * Delete annotations after one question that counts them; the field editor
 * closes if it was showing one of them. Behind the row menu's Delete (one
 * id) and the Browser's Delete button (the selection).
 */
export async function deleteAnnotations(ids: string[])
{
	const choice = await vscode.window.showWarningMessage(
		ids.length === 1 ? 'Delete annotation' : `Delete ${ids.length} annotations`, { modal: true }, 'Delete');
	if (choice !== 'Delete')
		return;
	for (const id of ids)
		await variables.languageClient.sendRequest('understand/deleteAnnotation', { id });
	closeFieldEditorFor(id => ids.includes(id));
}


export function deleteAnnotation(context: { id: string })
{
	return deleteAnnotations([context.id]);
}


// The Browser's Delete button is enabled only while a row is selected, so
// the empty case is for the palette.
export function deleteSelectedAnnotations()
{
	const ids = variables.annotationsTreeProvider.selectedIds();
	if (ids.length === 0) {
		vscode.window.showInformationMessage('Select an annotation in the Annotation Browser to delete it');
		return Promise.resolve();
	}
	return deleteAnnotations(ids);
}
