import * as vscode from 'vscode';

import { openAnnotation, showLocation } from '../commands/openAnnotation';
import { escapeHtml } from './html';
import { variables } from './variables';
import { AnnotationMessageFromSandbox, AnnotationTemplate, FormAnchor, FormMessage, FormSaveMessage } from '../types/annotation';
import { CheckMessage } from '../types/check';


/**
 * The field editor: a card form in a window beside the editor. It loads the
 * webview script the AI Overview view shares and posts it a form message, so
 * the fields, dependent options and Create / Save / Cancel are the one
 * implementation. Create and Save send the request the form's anchor or id
 * calls for, and the window then shows the annotation's card -- the one just
 * made, or the one saved; Cancel, Escape and closing the tab close it. The
 * same window shows a check card (a violation's check, read-only) when
 * handed a check message.
 */

// What the window shows: an annotation's form or card, or a check card.
export type PanelMessage = FormMessage | CheckMessage;

// The window, and the form it is on: the webview is answered with the form it
// is showing now rather than the one the window opened with, and the two are
// never meaningfully apart.
let open: { panel: vscode.WebviewPanel, message: PanelMessage } | undefined;


export function openFieldEditor(message: PanelMessage)
{
	// A second form replaces the first, and the window itself is kept and
	// retargeted rather than closed and made again. A new panel is created
	// Beside the active column, and once a form has the focus the active
	// column is the form's own, so each replacement landed one column further
	// right until the form was off the screen (Rob 2026-09-16).
	if (open) {
		open.message = message;
		open.panel.title = message.title;
		open.panel.webview.postMessage(message);
		open.panel.reveal();
		return;
	}

	const created = vscode.window.createWebviewPanel(
		'understandAnnotationForm',
		message.title,
		vscode.ViewColumn.Beside,
		{
			enableForms: true,
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
			retainContextWhenHidden: true,
		});
	open = { panel: created, message };

	const webview = created.webview;
	const asset = (...parts: string[]) => escapeHtml(webview.asWebviewUri(
		vscode.Uri.joinPath(variables.extensionUri, 'res', ...parts)).toString());
	const cspSource = escapeHtml(webview.cspSource);

	const close = () => {
		if (open?.panel === created) {
			open = undefined;
			created.dispose();
		}
	};

	webview.onDidReceiveMessage((received: AnnotationMessageFromSandbox) => {
		switch (received.method) {
			case 'ready':
				// Posted only now: sent earlier it would arrive before the
				// script's listener exists.
				if (open?.panel === created)
					webview.postMessage(open.message);
				break;
			case 'formSave': {
				// The window stays on the annotation. Create moves it to the
				// card of the one just made, the way Open shows it -- with the
				// Metadata now stamped (Rob 2026-09-21); Save brings the card
				// back read-only with what was saved once the server has taken
				// it. A refusal brings the form back with what was typed. All
				// of it unless another annotation has taken the window meanwhile.
				const shown = open?.panel === created && open.message.method === 'form'
					? open.message : undefined;
				saveForm(received).then(saved => {
					if (!shown || open?.panel !== created || open.message !== shown)
						return;
					if (received.mode === 'new' && saved.ok) {
						openAnnotation(saved.id);
						return;
					}
					// A draft's template is whatever its droplist was on when it
					// was sent, which the save names; its Metadata follows.
					const template = shown.mode === 'new' && shown.templates
						? shown.templates.find(t => t.id === received.templateId) : shown.template;
					const metadata = template && shown.metadataByTemplate?.[template.id];
					const { metadata: _shown, ...rest } = shown;
					open.message = { ...rest, template, ...(metadata ? { metadata } : {}),
						values: received.fields, body: received.body, readOnly: saved.ok };
					webview.postMessage(open.message);
				});
				break;
			}
			case 'formCancel':
				close();
				break;
			case 'open':
				// The file name on the card's location line.
				showLocation(received.uri, received.line, received.character);
				break;
			case 'error':
				vscode.window.showErrorMessage(received.body);
				break;
		}
	});

	created.onDidDispose(() => {
		if (open?.panel === created)
			open = undefined;
	});

	webview.html = '<!DOCTYPE html><html data-vscode-context=\'{"preventDefaultContextMenuItems": true}\'><head>'
		+ `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource};">`
		+ `<link rel='stylesheet' href='${asset('views', 'annotations.css')}'>`
		+ `<link rel='stylesheet' href='${asset('codicon.css')}'>`
		+ '</head><body class="popup"><div></div>'
		+ `<script src="${asset('views', 'markdown-it.min.js')}"></script>`
		+ `<script src="${asset('views', 'templateRules.js')}"></script>`
		+ `<script src="${asset('views', 'annotations.js')}"></script>`
		+ '</body></html>';
}


/**
 * Close the window when it shows an annotation that is gone: deleted from the
 * Browser, the gutter, a card, or in Understand (Rob 2026-09-21). Drafts and
 * check cards stay.
 */
export function closeFieldEditorFor(gone: (id: string) => boolean)
{
	if (!open || open.message.method !== 'form' || !open.message.id || !gone(open.message.id))
		return;
	const panel = open.panel;
	open = undefined;
	panel.dispose();
}


/**
 * A draft for the field editor: the templates offered for the place in a
 * droplist, the one the project starts a new annotation on selected, and the
 * Metadata each would stamp, fetched up front so the droplist switches
 * without a round trip. No templates offered means a plain note.
 */
export async function draftForm(title: string, templates: AnnotationTemplate[], startingId: string,
	anchor: FormAnchor, metadataParams: object): Promise<FormMessage>
{
	const template = templates.find(t => t.id === startingId);
	const metadataByTemplate: { [templateId: string]: string } = {};
	await Promise.all(templates.map(async t => {
		const text = await draftMetadata(t.id, metadataParams);
		if (text)
			metadataByTemplate[t.id] = text;
	}));
	const form: FormMessage = { method: 'form', mode: 'new', title, template, values: {}, anchor };
	if (templates.length)
		form.templates = templates;
	if (Object.keys(metadataByTemplate).length)
		form.metadataByTemplate = metadataByTemplate;
	if (template && metadataByTemplate[template.id])
		form.metadata = metadataByTemplate[template.id];
	return form;
}


/**
 * The Metadata a template will stamp on a new annotation, expanded for its
 * anchor the way the create will expand it, so the draft can show it. Empty
 * for a freeform draft, a template without Metadata, or an older server.
 */
export async function draftMetadata(templateId: string | undefined, anchor: object): Promise<string>
{
	if (!templateId)
		return '';
	try {
		const result: { metadata?: string } | null = await variables.languageClient.sendRequest(
			'understand/annotationMetadata', { templateId, ...anchor });
		return result?.metadata ?? '';
	} catch {
		return '';
	}
}


// Whether the server took the save, and for a create the id it gave.
type SaveOutcome = { ok: boolean, id?: string };


/**
 * What Create or Save sends. Where a new annotation goes is in its anchor,
 * in the shape of the request that creates it: addAnnotation for a line,
 * file, entity or architecture node; the server's ignoreAnnotation command
 * for a violation. An existing annotation is updated by id -- its fields when
 * it has a template, its note when it is freeform. Says whether the server
 * took it.
 */
async function saveForm(message: FormSaveMessage): Promise<SaveOutcome>
{
	try {
		if (message.mode === 'new') {
			const anchor = message.anchor;
			if (!anchor)
				throw new Error('The draft has no anchor');
			// Both creates answer with the new annotation's id.
			let made: { id?: string } | null;
			if (anchor.kind === 'ignore') {
				// An ignore is written by the server's command, which pairs the
				// annotation with the violation it silences.
				made = await variables.languageClient.sendRequest('workspace/executeCommand', {
					command: 'understand.server.violations.ignoreAnnotation',
					arguments: [{
						filePath: anchor.filePath,
						violationsToIgnore: anchor.violationsToIgnore,
						templateId: message.templateId ?? '',
						fields: message.fields,
						note: message.body ?? '',
					}],
				});
			} else {
				made = await variables.languageClient.sendRequest('understand/addAnnotation', {
					...anchor,
					templateId: message.templateId ?? '',
					fields: message.fields,
					body: message.body ?? '',
				});
			}
			return { ok: true, id: made?.id };
		} else if (message.templateId) {
			// The note goes along only when the form had it: a body that is
			// absent is one that was never offered, not one that was cleared.
			// It goes as the note: the server keeps the Metadata stamp above it.
			const update: { id?: string, templateId: string, fields: typeof message.fields, note?: string } =
				{ id: message.id, templateId: message.templateId, fields: message.fields };
			if (message.body !== undefined)
				update.note = message.body;
			await variables.languageClient.sendRequest('understand/updateAnnotation', update);
		} else {
			// A freeform annotation: the note is the whole of it.
			await variables.languageClient.sendRequest('understand/updateAnnotation', {
				id: message.id,
				note: message.body ?? '',
			});
		}
		return { ok: true };
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : 'Failed to save the annotation');
		return { ok: false };
	}
}
