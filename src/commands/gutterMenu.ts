import * as vscode from 'vscode';

import { annotationsAt, LineAnnotation } from '../other/annotationDecorations';
import { annotationSummary } from '../treeProviders/annotations';
import { annotateLine } from './annotateLine';
import { deleteAnnotation } from './annotations';
import { openAnnotation } from './openAnnotation';


/**
 * The gutter's right-click menu (editor/lineNumber/context): on the line
 * numbers, and on the glyph margin the annotation icon sits in.
 *
 * Understand's gutter icon shows the annotation on hover and opens a menu on
 * click. VS Code gives the glyph margin's left click to the debugger and
 * offers extensions no hover over a gutter icon at all -- a decoration's
 * hoverMessage is shown over the text, never over the margin. What it does
 * offer is a context menu on the gutter, whose commands are handed the line
 * they were opened on. So the icon's menu is this right-click menu, and the
 * icon's hover is the line's (Rob 2026-09-16).
 */

// What VS Code hands a line-number menu command: the line as the editor
// numbers it, from 1.
type GutterArg = { lineNumber: number, uri: vscode.Uri };

type Place = { uri: vscode.Uri, line: number };


// The line the menu was opened on; from the palette, the cursor's.
function placeOf(arg: GutterArg | undefined): Place | undefined
{
	if (arg && typeof arg.lineNumber === 'number' && arg.uri)
		return { uri: arg.uri, line: arg.lineNumber - 1 };
	const editor = vscode.window.activeTextEditor;
	if (!editor)
		return undefined;
	return { uri: editor.document.uri, line: editor.selection.active.line };
}


// The line's annotation to act on: the one there is, or the one picked when
// several share the line. A line with none says so.
async function pickAnnotation(place: Place, verb: string): Promise<LineAnnotation | undefined>
{
	const annotations = annotationsAt(place.uri, place.line);
	if (annotations.length === 0) {
		vscode.window.showInformationMessage(
			`Line ${place.line + 1} has no annotation to ${verb}.`);
		return undefined;
	}
	if (annotations.length === 1)
		return annotations[0];

	// Labelled the way the Browser labels its rows.
	const picked = await vscode.window.showQuickPick(
		annotations.map(annotation => ({
			label: annotationSummary(annotation.body, annotation.fields),
			description: [annotation.templateName, annotation.author].filter(Boolean).join(' · '),
			annotation,
		})),
		{ placeHolder: `Which annotation on line ${place.line + 1} to ${verb}` });
	return picked?.annotation;
}


export async function gutterAnnotate(arg?: GutterArg)
{
	const place = placeOf(arg);
	if (place)
		await annotateLine(place.uri, place.line);
}


// Open from the menu: with several on the line, a menu can ask which.
export async function gutterOpen(arg?: GutterArg)
{
	const place = placeOf(arg);
	if (!place)
		return;
	const annotation = await pickAnnotation(place, 'open');
	if (annotation)
		await openAnnotation(annotation.id);
}


// Where the last click on a line with several annotations landed, so the
// next click goes on to the next one. Keyed by file and line.
const lastOpened = new Map<string, number>();


/**
 * Open from the CodeLens on an annotated line. Several annotations on the
 * line are opened in turn, one per click, round and round: the lens is one
 * button, and a pick on every click would be a step in the way of the one
 * thing it does (Rob 2026-09-17).
 */
export async function openAnnotationHere(arg?: GutterArg)
{
	const place = placeOf(arg);
	if (!place)
		return;
	const annotations = annotationsAt(place.uri, place.line);
	const annotation = annotations.length > 1
		? nextInTurn(place, annotations)
		: await pickAnnotation(place, 'open');
	if (annotation)
		await openAnnotation(annotation.id);
}


function nextInTurn(place: Place, annotations: LineAnnotation[]): LineAnnotation
{
	const key = `${place.uri.fsPath.toLowerCase()}:${place.line}`;
	const index = ((lastOpened.get(key) ?? -1) + 1) % annotations.length;
	lastOpened.set(key, index);
	return annotations[index];
}


export async function gutterDelete(arg?: GutterArg)
{
	const place = placeOf(arg);
	if (!place)
		return;
	const annotation = await pickAnnotation(place, 'delete');
	if (annotation)
		deleteAnnotation({ id: annotation.id });
}
