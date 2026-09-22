import * as vscode from 'vscode';

import { annotationHover } from './annotationMarkdown';
import { getBooleanFromConfig } from './config';
import { variables } from './variables';


// The two switches on the editor's annotation surface (Rob 2026-09-21):
// annotations as a whole -- gutter, ruler, hover, CodeLens, the Browser and
// the menus -- and the gutter icons alone, for a reader who wants the
// annotations but not the marks beside the code. Off as a whole means the
// icons are off too.
export function annotationsEnabled(): boolean
{
	return getBooleanFromConfig('understand.annotations.enabled', true);
}

export function gutterIconsShown(): boolean
{
	return annotationsEnabled() && getBooleanFromConfig('understand.annotations.gutterIcons', true);
}


/**
 * The annotation gutter, the editor's half of the Annotations view.
 *
 * A line carrying an annotation gets an icon in the gutter, the way
 * Understand marks one, and hovering the line reads the annotation in place
 * with a link that opens it in the Annotations view.
 *
 * A gutter icon cannot be clicked: decorations are paint only, and the glyph
 * margin's clicks belong to the debugger's add-a-breakpoint affordance, so
 * even a mouse heuristic would be taking someone else's gesture. The menu
 * Understand opens from the icon is therefore on the icon's hover instead --
 * the annotation, then a row of command links -- which is the one way an
 * extension can be acted on from the gutter (Rob 2026-09-14).
 */


/** Every annotation in the project, by the file it sits in. */
const byFile = new Map<string, LineAnnotation[]>();

// Three decorations -- blue for a note, yellow for an ignored violation, red
// for a required field still empty: the icon and the mark on the scrollbar's
// overview ruler differ in colour only, and a line takes exactly one of them.
let decoration: vscode.TextEditorDecorationType | undefined;
let ignoreDecoration: vscode.TextEditorDecorationType | undefined;
let incompleteDecoration: vscode.TextEditorDecorationType | undefined;


export type LineAnnotation = {
	id: string,
	kind?: 'note' | 'ignore',
	line: number,          // zero-based, as the payload sends it
	author: string,
	body: string,
	templateName?: string,
	fields?: { label: string, value: string }[],
	missingRequired?: string[],
};


export type AnnotationMark = {
	id: string,
	// An ignored violation's annotation, or a note.
	kind?: 'note' | 'ignore',
	positionUri: string,
	positionLine: number,
	author: string,
	body: string,
	templateName?: string,
	fields?: { label: string, value: string }[],
	// The required fields still empty, by label, when there are any.
	missingRequired?: string[],
};


export function activateAnnotationDecorations(context: vscode.ExtensionContext)
{
	// The same line is marked on the scrollbar's overview ruler, so an
	// annotation anywhere in the file can be seen and scrolled to (Rob
	// 2026-09-17): the icon's blue, yellow for an ignored violation, or the
	// Browser's red for an annotation with a required field still empty --
	// the icon itself takes the colour, the way the Browser row does (Rob
	// 2026-09-21). The centre lane: problems take the right one, the cursor
	// and selection the left.
	const marked = (icon: string, color: string) => vscode.window.createTextEditorDecorationType({
		gutterIconPath: vscode.Uri.joinPath(variables.extensionUri, 'res', icon),
		gutterIconSize: 'contain',
		overviewRulerColor: new vscode.ThemeColor(color),
		overviewRulerLane: vscode.OverviewRulerLane.Center,
		// The mark belongs to the line, so an edit above it carries it along
		// until the next list arrives.
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
	});
	decoration = marked('annotation.svg', 'understand.annotationRuler');
	ignoreDecoration = marked('annotationIgnore.svg', 'understand.annotationRulerIgnore');
	incompleteDecoration = marked('annotationIncomplete.svg', 'understand.annotationRulerIncomplete');
	context.subscriptions.push(decoration, ignoreDecoration, incompleteDecoration);

	// Editors come and go; each one is decorated as it appears.
	context.subscriptions.push(
		vscode.window.onDidChangeVisibleTextEditors(refreshAll));

	refreshAll();
}


/** Replace what the gutter knows, from a fresh annotation list. */
export function setAnnotations(annotations: AnnotationMark[])
{
	byFile.clear();
	for (const annotation of annotations) {
		if (!annotation.positionUri)
			continue;
		// Keyed by the parsed path rather than the raw string: the server's
		// uri and the editor's differ in case and escaping on Windows.
		const key = keyOf(vscode.Uri.parse(annotation.positionUri));
		let list = byFile.get(key);
		if (list === undefined) {
			list = [];
			byFile.set(key, list);
		}
		list.push({
			id: annotation.id,
			kind: annotation.kind,
			line: annotation.positionLine,
			author: annotation.author,
			body: annotation.body,
			templateName: annotation.templateName,
			fields: annotation.fields,
			missingRequired: annotation.missingRequired,
		});
	}
	refreshAll();
	// The CodeLens on the cursor's line counts these; without this it kept
	// saying "Annotate" over a line that had just been annotated until the
	// cursor moved.
	variables.annotateCodeLensProvider?.refresh();
}


/**
 * The server's feed for the editor -- understand/annotations/marks: the
 * file-anchored annotations with what the hover shows. Sent whatever the
 * Annotation Browser setting says, so the gutter never depends on a view.
 */
export function handleUnderstandAnnotationMarks(params: { annotations: AnnotationMark[] })
{
	setAnnotations(params.annotations);
}


/** The annotations on one line of one file, for the hover and the CodeLens. */
export function annotationsAt(uri: vscode.Uri, line: number): LineAnnotation[]
{
	return (byFile.get(keyOf(uri)) ?? []).filter(a => a.line === line);
}


function keyOf(uri: vscode.Uri): string
{
	return uri.fsPath.toLowerCase();
}


/** Redraw every editor's marks; a settings change calls this. */
export function refreshAnnotationDecorations()
{
	refreshAll();
}


function refreshAll()
{
	for (const editor of vscode.window.visibleTextEditors)
		refresh(editor);
}


function refresh(editor: vscode.TextEditor)
{
	if (!decoration || !ignoreDecoration || !incompleteDecoration)
		return;

	// Switched off: the marks come down and nothing else changes -- the
	// annotations are still known, the Browser still lists them.
	if (!gutterIconsShown()) {
		editor.setDecorations(decoration, []);
		editor.setDecorations(ignoreDecoration, []);
		editor.setDecorations(incompleteDecoration, []);
		return;
	}

	const annotations = byFile.get(keyOf(editor.document.uri)) ?? [];

	// One icon per line, however many annotations share it: the gutter has
	// room for one, and the hover lists them all. The hover message rides the
	// decoration, but VS Code shows a decoration's hover over the text only --
	// never over the icon in the margin -- so hovering the line is how it is
	// read, and the gutter's right-click menu (commands/gutterMenu.ts) is the
	// nearest thing to Understand's click-the-icon menu. A line where any
	// annotation still lacks a required field takes the red decoration, else
	// one with an ignored violation the yellow, else the blue.
	const lines = new Set<number>();
	const marks: vscode.DecorationOptions[] = [];
	const ignores: vscode.DecorationOptions[] = [];
	const incomplete: vscode.DecorationOptions[] = [];
	for (const annotation of annotations) {
		if (annotation.line < 0 || annotation.line >= editor.document.lineCount)
			continue;
		if (lines.has(annotation.line))
			continue;
		lines.add(annotation.line);
		const onLine = annotations.filter(a => a.line === annotation.line);
		const gap = onLine.some(a => (a.missingRequired ?? []).length > 0);
		const ignore = onLine.some(a => a.kind === 'ignore');
		(gap ? incomplete : ignore ? ignores : marks).push({
			range: new vscode.Range(annotation.line, 0, annotation.line, 0),
			hoverMessage: annotationHover(editor.document.uri, annotation.line, onLine),
		});
	}

	editor.setDecorations(decoration, marks);
	editor.setDecorations(ignoreDecoration, ignores);
	editor.setDecorations(incompleteDecoration, incomplete);
}
