import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { textEditorColumn } from '../other/textEditorColumn';
import { editAnnotationFields } from './editAnnotationFields';


type BrowserRow = {
	id: string,
	templateId?: string,
	templateName?: string,
	fieldValues?: { [key: string]: string | string[] },
	missingRequired?: string[],
	body?: string,
	metadata?: string,
	note?: string,
	positionUri?: string,
	positionLine?: number,
	positionCharacter?: number,
	positionTitle?: string,
};


/**
 * Open one annotation, by id: its row selected in the Annotation Browser and
 * its card in the field editor -- what a click on the row does. The hover's
 * Open link runs this; the CodeLens and the gutter menu come through here
 * once they have chosen the line's annotation. A selection the extension
 * makes in the Browser fires no row click, so the editor is opened here
 * rather than expected to follow (Rob 2026-09-17).
 */
export async function openAnnotation(id?: string)
{
	if (!id)
		return;
	await variables.annotationsTreeProvider.reveal(id);
	await editAnnotationFields({ id }, { readOnly: true });
}


/**
 * A single click on an Annotation Browser row.
 *
 * Every row goes to its file and line first. The Browser can list a whole
 * project's annotations, so the code an annotation is attached to is the
 * thing the reader wants behind whatever opens next (Rob 2026-09-16).
 *
 * Then the annotation opens in the field editor window, whichever kind it is:
 * a templated annotation's fields and note, a freeform one's note. A second
 * row's form replaces the first's, so the editor is always on the row last
 * clicked.
 */
export async function openAnnotationFromBrowser(row: BrowserRow | undefined)
{
	if (!row || !row.id)
		return;

	// The field editor takes the keyboard focus, so showing the file must not
	// take it.
	await showInEditor(row);
	await editAnnotationFields(row, { readOnly: true });
}


/**
 * A click on one of a row's children -- its Template line or a field row:
 * the file at the anchor, then the annotation in the field editor, read-only
 * like a click on the row. The clicked field is named for the form the
 * webview opens instead when a required field is still empty (Rob
 * 2026-09-17).
 */
export async function openFieldFromBrowser(
	item: { parent?: BrowserRow, label?: string | { label: string } } | undefined)
{
	if (!item || !item.parent)
		return;
	await showInEditor(item.parent);
	const label = typeof item.label === 'string' ? item.label : item.label?.label;
	await editAnnotationFields(item.parent, { readOnly: true, focusLabel: label });
}


/**
 * Put the editor on the annotated line.
 *
 * This finishes before the field editor opens: the card form is drawn among
 * the active file's cards, so the file has to be active by then.
 *
 * The file opens as a preview, the way a single click from any other tree
 * does, so reading down the Browser reuses one tab instead of leaving a tab
 * per row behind.
 *
 * The focus is left where it is: the editor that opens next is the one the
 * reader is going to type in.
 *
 * A file that has moved or gone reports itself and is not fatal -- the
 * annotation is still editable without it.
 */
async function showInEditor(row: BrowserRow)
{
	if (!row.positionUri)
		return;
	await showLocation(row.positionUri, row.positionLine ?? 0, row.positionCharacter ?? 0);
}


/**
 * Show a place in a text editor without taking the focus: the field editor
 * keeps it. The place is a uri, or a path the way the ignore command names
 * one.
 */
export async function showLocation(where: string, line: number, character: number)
{
	const uri = /^[a-z][a-z0-9+.-]*:\/\//i.test(where) ? vscode.Uri.parse(where) : vscode.Uri.file(where);
	try {
		await vscode.commands.executeCommand('vscode.open', uri, {
			viewColumn: textEditorColumn(uri),
			preview: true,
			preserveFocus: true,
			selection: new vscode.Range(line, character, line, character),
		});
		// Opened without taking the focus, so VS Code reports no active text
		// editor change; the Browser's file scope is told directly.
		variables.annotationsTreeProvider.activeFileChanged(uri);
	} catch {
		// vscode.open has already said what went wrong.
	}
}
