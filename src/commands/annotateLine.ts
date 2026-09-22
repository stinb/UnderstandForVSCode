import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { draftForm, openFieldEditor } from '../other/fieldEditor';
import { AnnotationTemplate, FormAnchor } from '../types/annotation';


/**
 * Open the field editor on a new annotation. The templates that apply where
 * the annotation goes are offered, plus a plain note, and the annotation is
 * created on Create already filled in, so the template's defaults are stamped
 * at creation (Rob 2026-09-01). Templates are used and read here, never
 * created or edited — that stays in Understand.
 *
 * Every command that makes an annotation comes through here, bar Ignore with
 * Details, whose templates are the ignore-flagged ones.
 */
export async function openNewAnnotationForm(
	anchor: Exclude<FormAnchor, { kind: 'ignore' }>,
	title: string,
)
{
	// The server offers the templates that apply to the anchor, and says
	// which one a new annotation starts on; the form's droplist holds the
	// rest (Rob 2026-09-21: a picker with a filter box read as a text field).
	const where = anchor.kind === 'architecture'
		? { architecture: anchor.architecture }
		: { textDocument: anchor.textDocument, position: anchor.position };
	let templates: AnnotationTemplate[] = [];
	let starting = '';
	try {
		const result: { templates: AnnotationTemplate[], default?: string } =
			await variables.languageClient.sendRequest('understand/ignoreTemplates',
				{ kind: 'annotation', ...where });
		templates = result.templates ?? [];
		starting = result.default ?? '';
	} catch {
		// An older server without the request: a plain note is still offered.
	}

	openFieldEditor(await draftForm(title, templates, starting, anchor, where));
}


/** Annotate the line the cursor is on, or the line given. */
export async function annotateLine(uri?: vscode.Uri, line?: number)
{
	if (uri === undefined || line === undefined) {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('Open a file to annotate a line in it');
			return;
		}
		uri = editor.document.uri;
		line = editor.selection.active.line;
	}

	await openNewAnnotationForm(
		{
			kind: 'line',
			textDocument: { uri: uri.toString() },
			position: { line, character: 0 },
		},
		'New annotation');
}