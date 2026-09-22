import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { openFieldEditor } from '../other/fieldEditor';
import { AnnotationTemplate, Card, FormLocation, FormMessage } from '../types/annotation';


/**
 * Editing an annotation: a templated one's field values, a freeform one's
 * note, and which template either uses.
 *
 * Until these existed a templated annotation was write-once from VS Code —
 * the fields were filled when it was created and could never be corrected,
 * while Understand's own card edits every one of them (ext #26).
 *
 * A value the template no longer offers is shown as retired rather than
 * hidden or silently kept: Understand marks it "(no longer an option)", lets
 * it be changed, and never offers it again once it is. The same rule applies
 * here, so an option removed from a template reads the same in both places
 * (Rob 2026-09-01).
 */


type Annotated = {
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


// A Browser row carries the template and values itself. A hover link, the
// CodeLens and the gutter menu hand over only the id, and the server is
// asked for the rest: the annotation may sit in a file other than the one
// the cursor was last synced in, since the Browser opens files without
// moving the focus, so nothing the client kept about "the active file"
// can be trusted to know it (Rob 2026-09-17).
async function resolve(annotation: Annotated): Promise<Annotated | undefined>
{
	if (annotation.templateId !== undefined || annotation.body !== undefined)
		return annotation;
	try {
		const card: Card = await variables.languageClient.sendRequest(
			'understand/annotation', { id: annotation.id });
		return {
			...annotation,
			templateId: card.templateId,
			templateName: card.templateName,
			fieldValues: card.fieldValues,
			body: card.body,
			metadata: card.metadata,
			note: card.note,
			positionUri: card.positionUri,
			positionLine: card.positionLine,
			positionCharacter: card.positionCharacter,
			positionTitle: card.positionTitle,
		};
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : 'Failed to load the annotation');
		return undefined;
	}
}


// How the field editor opens: read-only -- the completed card, with the form
// a click away -- when the annotation is opened to be looked at; the form
// itself when an Edit command asked for it, on the field a click named.
type EditorOptions = { readOnly?: boolean, focusLabel?: string };


export async function editAnnotationFields(annotated: Annotated | undefined, options: EditorOptions = {})
{
	if (!annotated || !annotated.id) {
		vscode.window.showErrorMessage('Select an annotation to edit');
		return;
	}
	const annotation = await resolve(annotated);
	if (!annotation)
		return;

	// A freeform annotation has no template, and its note is the one thing
	// to edit. It takes the same form, with no field rows.
	let template: AnnotationTemplate | undefined;
	if (annotation.templateId) {
		template = await fetchTemplate(annotation.templateId);
		if (!template) {
			vscode.window.showErrorMessage(
				`The template for this annotation is no longer in the project.`);
			return;
		}
	}

	// The fields and the note as a form, like Understand's card, in the field
	// editor window. The note is on the form for a templated annotation too:
	// it is the one place its text can be changed from VS Code.
	const form: FormMessage = {
		method: 'form',
		mode: 'edit',
		id: annotation.id,
		title: annotation.templateName ?? template?.name ?? 'Note',
		template,
		values: annotation.fieldValues ?? {},
		// The note alone; the Metadata stamp is shown apart, read-only.
		body: annotation.note ?? annotation.body ?? '',
	};
	if (options.readOnly)
		form.readOnly = true;
	if (annotation.metadata)
		form.metadata = annotation.metadata;
	const location = locationOf(annotation);
	if (location)
		form.location = location;
	// A Browser row's field children know their label, not the template's
	// key; the template says which is which.
	const focused = template?.fields.find(f => f.label === options.focusLabel);
	if (focused)
		form.focusKey = focused.key;
	openFieldEditor(form);
}


// Where the annotation sits, for the line under the template name; only
// the facts the record has, so a card without a place carries none.
function locationOf(annotation: Annotated): FormLocation | undefined
{
	const location: FormLocation = {};
	if (annotation.positionUri) {
		location.uri = annotation.positionUri;
		if (annotation.positionLine !== undefined)
			location.line = annotation.positionLine;
		if (annotation.positionCharacter !== undefined)
			location.character = annotation.positionCharacter;
	}
	if (annotation.positionTitle)
		location.title = annotation.positionTitle;
	return Object.keys(location).length ? location : undefined;
}


/**
 * Change which template an annotation uses. The server reports what would be
 * lost before anything is written, so the warning names the fields rather
 * than saying that something, somewhere, will go.
 */
export async function retypeAnnotation(annotation: Annotated | undefined)
{
	if (!annotation || !annotation.id) {
		vscode.window.showErrorMessage('Select an annotation to retype');
		return;
	}
	// A new name rather than a reassignment: the narrowing has to hold inside
	// the closures below.
	const atn = await resolve(annotation);
	if (!atn)
		return;

	let templates: AnnotationTemplate[] = [];
	try {
		const result: { templates: AnnotationTemplate[] } =
			await variables.languageClient.sendRequest('understand/ignoreTemplates', {
				kind: 'annotation',
				// The templates that apply where this annotation sits.
				id: atn.id,
			});
		templates = result.templates ?? [];
	} catch {
		// Fall through: freeform is still a destination.
	}

	const picked = await vscode.window.showQuickPick(
		[
			...templates
				.filter(t => t.id !== atn.templateId)
				.map(t => ({ label: t.name, id: t.id })),
			{ label: 'Freeform (no template)', id: '' },
		],
		{ placeHolder: atn.templateName
			? `Change from "${atn.templateName}" to` : 'Use template' });
	if (picked === undefined)
		return;

	// Ask before writing: the same question Understand's picker asks.
	try {
		const preview: { dropped: string[], note?: boolean } =
			await variables.languageClient.sendRequest('understand/retypeAnnotation', {
				id: atn.id,
				templateId: picked.id,
				preview: true,
			});
		// A freeform note's text does not fit a template and is discarded
		// with the fields (#5188) -- the same warning Understand's picker gives.
		const lost: string[] = [];
		if (preview.dropped.length)
			lost.push(`what was entered in: ${preview.dropped.join(', ')}`);
		if (preview.note)
			lost.push('the note text');
		if (lost.length) {
			const answer = await vscode.window.showWarningMessage(
				`Changing template discards ${lost.join(', and ')}.`,
				{ modal: true }, 'Change Template');
			if (answer !== 'Change Template')
				return;
		}

		await variables.languageClient.sendRequest('understand/retypeAnnotation', {
			id: atn.id,
			templateId: picked.id,
		});
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : 'Failed to change the template');
	}
}


async function fetchTemplate(templateId: string)
	: Promise<AnnotationTemplate | undefined>
{
	try {
		const result: { templates: AnnotationTemplate[] } =
			await variables.languageClient.sendRequest('understand/ignoreTemplates', {
				templateId,
			});
		return (result.templates ?? [])[0];
	} catch {
		return undefined;
	}
}
