import * as vscode from 'vscode';

import { checkIdOf } from '../commands/showCheck';
import { annotationsAt, annotationsEnabled } from './annotationDecorations';
import { annotationHover } from './annotationMarkdown';
import { fileStatusOf } from './fileDecorations';


/**
 * What the editor offers about annotations, beside the gutter icon:
 *
 *  - a hover on any line that has one, showing it in place with the actions
 *    that act on it;
 *  - a CodeLens on the line the cursor is on, to add one -- and, on a line
 *    with a violation, to ignore it with Details, the same offer as the
 *    quick fix without the light bulb in between (Rob 2026-09-21).
 *
 * The CodeLens follows the cursor rather than sitting on every line, so the
 * offer is where the user is working and nowhere else. Understand puts a "+"
 * on the hovered line; VS Code has no per-line hover affordance, and this is
 * the closest thing it does have (Rob 2026-09-01).
 */


export class AnnotationHoverProvider implements vscode.HoverProvider
{
	provideHover(document: vscode.TextDocument, position: vscode.Position)
	{
		if (!annotationsEnabled())
			return undefined;
		const annotations = annotationsAt(document.uri, position.line);
		if (annotations.length === 0)
			return undefined;

		// The same markdown the gutter icon's hover shows, so the two read
		// alike however the reader got there.
		return new vscode.Hover(
			annotationHover(document.uri, position.line, annotations),
			new vscode.Range(position.line, 0, position.line, 0));
	}
}


export class AnnotateCodeLensProvider implements vscode.CodeLensProvider
{
	private emitter = new vscode.EventEmitter<void>();
	onDidChangeCodeLenses = this.emitter.event;

	// The lens sits on the cursor's line, so it moves as the cursor does.
	refresh()
	{
		this.emitter.fire();
	}

	async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]>
	{
		if (!annotationsEnabled())
			return [];
		const editor = vscode.window.activeTextEditor;
		if (!editor || editor.document.uri.toString() !== document.uri.toString())
			return [];

		// Only a file Understand has an entity for can carry an annotation:
		// there is nothing to anchor one to otherwise, and the offer ended in
		// "An entity was not found for the file" (Rob 2026-09-14). The menus
		// were already gated on this; the lens was not.
		const status = await fileStatusOf(document.uri);
		if (!status || !status.resolved)
			return [];

		const line = editor.selection.active.line;
		const range = new vscode.Range(line, 0, line, 0);
		const existing = annotationsAt(document.uri, line);
		const lenses = [...this.annotationLenses(document, line, range, existing.length),
			...this.ignoreLenses(document, line, range)];
		return lenses;
	}

	private annotationLenses(document: vscode.TextDocument, line: number, range: vscode.Range, existing: number): vscode.CodeLens[]
	{

		// A line that already has annotations says so, and opening them is
		// the more likely intent than adding another. Opening is what a Browser
		// row click does -- the row selected, the fields in the field editor --
		// and the command is handed the line, so several on it can be opened in
		// turn, one per click.
		if (existing > 0) {
			return [
				new vscode.CodeLens(range, {
					command: 'understand.annotations.openNextOnLine',
					// The icon glyph has no right bearing, so a plain space reads as
					// none; the NBSP keeps a visible gap the renderer won't collapse.
					title: existing === 1
						? '$(understand-annotation)\u00A0 Annotation'
						: `$(understand-annotation)\u00A0 ${existing} annotations`,
					tooltip: existing === 1
						? 'Open the annotation: its row in the Browser, its fields in the field editor'
						: 'Open the annotations in turn, one per click',
					arguments: [{ lineNumber: line + 1, uri: document.uri }],
				}),
				new vscode.CodeLens(range, {
					command: 'understand.annotateLine',
					title: '$(understand-annotation)\u00A0 New Annotation',
					arguments: [document.uri, line],
				}),
			];
		}

		return [new vscode.CodeLens(range, {
			command: 'understand.annotateLine',
			title: '$(understand-annotation)\u00A0 Annotate',
			arguments: [document.uri, line],
		})];
	}

	// Two lenses per check with a violation on the line, the two quick fixes
	// without the light bulb: "Ignore <check>" stores an annotation with a
	// template, "Ignore <check> Inline" writes the UndCC_Line comment. Each
	// runs the server's quick fix of that name (commands/ignoreViolation.ts) at
	// the violation's own range: the server matches a violation to the
	// lexeme under the position it is asked at, so the line's start finds
	// nothing.
	private ignoreLenses(document: vscode.TextDocument, line: number, range: vscode.Range): vscode.CodeLens[]
	{
		const at = new Map<string, vscode.Range>();
		for (const diagnostic of vscode.languages.getDiagnostics(document.uri)) {
			if (diagnostic.range.start.line !== line)
				continue;
			const id = checkIdOf(diagnostic);
			if (id && !at.has(id))
				at.set(id, diagnostic.range);
		}
		return Array.from(at, ([id, where]) => [
			new vscode.CodeLens(range, {
				command: 'understand.violations.ignoreWithAnnotation',
				title: `$(exclude)\u00A0 Ignore ${id}`,
				tooltip: 'Ignore the violation with an annotation in the project, with a template',
				arguments: [document.uri, where, id],
			}),
			new vscode.CodeLens(range, {
				command: 'understand.violations.ignoreInline',
				title: `$(exclude)\u00A0 Ignore ${id} Inline`,
				tooltip: 'Ignore the violation with a UndCC_Line comment on the line',
				arguments: [document.uri, where, id],
			}),
		]).flat();
	}
}
