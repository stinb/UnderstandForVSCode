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


/**
 * When the annotation was last changed, read in the reader's own zone. The
 * server sends UTC.
 *
 * Understand shows the time as well as the date wherever it shows this — on
 * its card, in its hover and in its Browser tooltip — and drops the time only
 * in the Annotations view's Date tree, which groups by day (ext #26 item
 * 3.3).
 */
export function annotationTime(lastModified: string,
                               style: 'card' | 'hover' | 'day' = 'hover'): string
{
	// An older Understand sends a bare yyyy-MM-dd, which Date reads as UTC
	// midnight and would show as the day before west of Greenwich. There is
	// no time in it to show, so it is shown as it came.
	if (!lastModified || !lastModified.includes('T'))
		return lastModified;
	const when = new Date(lastModified);
	if (Number.isNaN(when.getTime()))
		return lastModified;
	switch (style) {
		case 'card':
			return when.toLocaleString(undefined,
				{ dateStyle: 'short', timeStyle: 'short' });
		case 'day':
			return when.toLocaleDateString();
		default:
			return when.toLocaleString(undefined,
				{ dateStyle: 'full', timeStyle: 'long' });
	}
}


/**
 * Who last changed the annotation and when, as Understand writes it on the
 * card, in the hover and in the Browser tooltip: "author — when".
 */
export function attribution(author: string | undefined, lastModified: string | undefined,
                            style: 'card' | 'hover' = 'hover'): string
{
	return [author, annotationTime(lastModified ?? '', style)]
		.filter(Boolean).join(' — ');
}


/**
 * An attachment inside a body, which Understand stores as the marker
 * `<:|:>kind|:|id|:|name<:/:>`. An image or a file carries the api id of the
 * stored file and its name; a link carries its URL where the id would be.
 */
type Media = { kind: string, id: string, name: string };

const kMediaMarker = /<:\|:>(.+?)<:\/:>/g;

function splitMedia(payload: string): Media | undefined
{
	const parts = payload.split('|:|');
	if (parts.length < 2)
		return undefined;
	return { kind: parts[0], id: parts[1], name: parts[2] ?? parts[1] };
}


/** A marker where only text will do, read the way Understand reads it. */
function mediaText(media: Media): string
{
	switch (media.kind) {
		case 'img':  return `Image: ${media.name}`;
		case 'file': return `File: ${media.name}`;
		case 'link': return `Link: ${media.id}`;
		default:     return media.name;
	}
}


/** A body with its markers read for a person: the Browser's row and menus. */
export function readableBody(body: string): string
{
	return body.replace(kMediaMarker, (whole, payload) => {
		const media = splitMedia(payload);
		return media ? mediaText(media) : whole;
	});
}


function mediaLink(media: Media): string
{
	// The hover is a trusted markdown string, so a link out of it can run a
	// command. A body is user text: only the two schemes a browser would
	// follow are linked, and anything else stays as words (ext #26 4.3.2).
	if (media.kind === 'link') {
		return /^https?:\/\//i.test(media.id)
			? `[$(link-external) ${escapeMarkdown(media.id)}](<${media.id}>)`
			: escapeMarkdown(mediaText(media));
	}
	const icon = media.kind === 'img' ? '$(file-media)' : '$(file)';
	return link(`${icon} ${escapeMarkdown(media.name)}`,
		'understand.annotations.openMedia', [media.id, media.name]);
}


/** A body as markdown: text escaped, each attachment a link that opens it. */
function markdownBody(body: string): string
{
	let out = '';
	let pos = 0;
	kMediaMarker.lastIndex = 0;
	for (let match = kMediaMarker.exec(body); match; match = kMediaMarker.exec(body)) {
		out += escapeMarkdown(body.slice(pos, match.index));
		const media = splitMedia(match[1]);
		out += media ? mediaLink(media) : escapeMarkdown(match[0]);
		pos = match.index + match[0].length;
	}
	return out + escapeMarkdown(body.slice(pos));
}


export function renderAnnotation(annotation: LineAnnotation): string
{
	const lines: string[] = [];
	if (annotation.templateName)
		lines.push(`**${escapeMarkdown(annotation.templateName)}**`);
	for (const field of annotation.fields ?? [])
		lines.push(`**${escapeMarkdown(field.label)}:** ${escapeMarkdown(field.value)}`);
	if (annotation.body)
		lines.push(markdownBody(annotation.body));
	const who = attribution(annotation.author, annotation.lastModified);
	if (who)
		lines.push(`_${escapeMarkdown(who)}_`);
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
