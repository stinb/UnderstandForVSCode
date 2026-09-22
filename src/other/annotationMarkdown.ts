import * as vscode from 'vscode';

import type { LineAnnotation } from './annotationDecorations';


/**
 * One annotation rendered for a hover, with the actions under it.
 *
 * The line's hover uses this, and so does the gutter decoration's hover
 * message -- which VS Code shows over the text, not over the icon in the
 * margin. Understand's gutter icon opens a menu on click; VS Code gives the
 * glyph margin's left click to the debugger, so the actions live here in the
 * hover and in the gutter's right-click menu (commands/gutterMenu.ts)
 * (Rob 2026-09-14, 2026-09-16).
 */


// A body is arbitrary user text: it must read as itself rather than as
// markup, and it must not smuggle a link into a trusted string.
export function escapeMarkdown(text: string): string
{
	return text.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, m => '\\' + m);
}


export function renderAnnotation(annotation: LineAnnotation): string
{
	const lines: string[] = [];
	if (annotation.templateName)
		lines.push(`**${escapeMarkdown(annotation.templateName)}**`);
	for (const field of annotation.fields ?? [])
		lines.push(`**${escapeMarkdown(field.label)}:** ${escapeMarkdown(field.value)}`);
	if (annotation.body)
		lines.push(escapeMarkdown(annotation.body));
	if (annotation.author)
		lines.push(`_${escapeMarkdown(annotation.author)}_`);
	return lines.join('\n\n');
}


function link(label: string, command: string, args: unknown[]): string
{
	return `[${label}](command:${command}?${encodeURIComponent(JSON.stringify(args))})`;
}


// The actions Understand's own card offers, minus the ones that need a
// widget. Open is the one way in: the row selected in the Browser and the
// annotation in the field editor -- its fields, or a freeform note's text.
function actions(annotation: LineAnnotation): string
{
	const id = [{ id: annotation.id }];
	const parts = [
		link('$(go-to-file) Open', 'understand.annotations.open', [annotation.id]),
	];
	if (annotation.templateName)
		parts.push(link('$(replace) Retype', 'understand.annotations.retype', id));
	parts.push(link('$(file-media) Attach', 'understand.annotations.attachMedia', id));
	parts.push(link('$(trash) Delete', 'understand.annotations.deleteAnnotation', id));
	return parts.join(' &nbsp;&middot;&nbsp; ');
}


/**
 * The hover for one line: every annotation on it, each with its actions, and
 * one offer to add another.
 */
export function annotationHover(uri: vscode.Uri, line: number,
                                annotations: LineAnnotation[]): vscode.MarkdownString
{
	const markdown = new vscode.MarkdownString();
	// Command links are the only way to act from a hover, and they need the
	// string to be trusted. Only our own commands are linked, and every piece
	// of user text in here is escaped.
	markdown.isTrusted = true;
	markdown.supportHtml = false;
	markdown.supportThemeIcons = true;

	annotations.forEach((annotation, index) => {
		if (index > 0)
			markdown.appendMarkdown('\n\n---\n\n');
		markdown.appendMarkdown(renderAnnotation(annotation));
		markdown.appendMarkdown('\n\n' + actions(annotation));
	});

	markdown.appendMarkdown('\n\n---\n\n'
		+ link('$(add) Add Annotation', 'understand.annotateLine', [uri, line]));

	return markdown;
}
