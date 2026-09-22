import {
	Command,
	commands,
	EventEmitter,
	FileDecoration,
	FileDecorationProvider,
	ThemeColor,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	TreeView,
	Uri,
	window,
} from 'vscode';
import { closeFieldEditorFor } from '../other/fieldEditor';
import { variables } from '../other/variables';


// The Annotation Browser (ext #26): every user annotation in the project —
// notes and CodeCheck ignores — grouped by file by default and re-groupable
// by author, template, or date from the same pushed payload. It is the one
// list of annotations in VS Code; a row opens in the field editor window.
export type AnnotationGroupBy = 'file' | 'author' | 'template' | 'date';

// Which annotations the Browser lists: every one in the project, or only
// those on the file in the active editor.
export type AnnotationScope = 'all' | 'file';
const kScopeContext = 'understand.annotationBrowserScope';
// Set while the Browser lists only the annotations still missing a required
// field: the title button flips between the two commands on it.
const kIncompleteContext = 'understand.annotationBrowserIncompleteOnly';
// Whether an annotation row is selected: the title bar's Delete button is
// enabled on it (Rob 2026-09-21).
const kSelectedContext = 'understand.annotationBrowserSelected';


export type AnnotationNode = AnnotationGroupItem | AnnotationItem | AnnotationFieldItem;


export class AnnotationTreeProvider implements TreeDataProvider<AnnotationNode>
{
	private annotations: Annotation[] = [];
	private total = 0;
	private truncated = false;
	private groupBy: AnnotationGroupBy = 'file';
	private scope: AnnotationScope = 'all';
	private incompleteOnly = false;
	private currentFile = '';
	private emitter = new EventEmitter<void>();
	private view: TreeView<AnnotationNode> | undefined;
	// An id asked for before its row arrived -- a just-created annotation,
	// whose listed push follows the create's answer -- revealed on the push
	// that brings it.
	private pendingReveal: string | undefined;

	onDidChangeTreeData = this.emitter.event;


	// The created TreeView, for the count badge on the view header.
	attach(view: TreeView<AnnotationNode>)
	{
		this.view = view;
		view.onDidChangeSelection?.(() => this.selectionChanged());
		this.selectionChanged();
	}


	// The annotation rows selected in the view; group headings and field
	// children are not annotations.
	selectedIds(): string[]
	{
		return (this.view?.selection ?? [])
			.filter((node): node is AnnotationItem => node instanceof AnnotationItem)
			.map(node => node.id);
	}


	private selectionChanged()
	{
		commands.executeCommand('setContext', kSelectedContext, this.selectedIds().length > 0);
	}


	getChildren(element: AnnotationNode | undefined): AnnotationNode[]
	{
		if (element === undefined)
			return this.groups();
		if (element instanceof AnnotationGroupItem)
			// Rows materialize when the group expands, like the Violations
			// view: groups nobody opens cost nothing on update or regroup.
			return element.rows.map(row => new AnnotationItem(row, element.groupBy, element));
		if (element instanceof AnnotationItem) {
			// The read-only record, the way Understand's card shows it: the
			// template's name first, then one row per entered field, label
			// beside value. A click on any of them opens the annotation in the
			// field editor, read-only unless a required field is still empty
			// (Rob 2026-09-17).
			const rows = (element.fields ?? []).map(f => new AnnotationFieldItem(f, element));
			if (element.templateName && rows.length)
				rows.unshift(new AnnotationFieldItem(
					{ label: 'Template', value: element.templateName }, element));
			return rows;
		}
		return [];
	}


	// For reveal: the tree walks up to the root and back down by id.
	getParent(element: AnnotationNode): AnnotationNode | undefined
	{
		return element instanceof AnnotationGroupItem ? undefined : element.parent;
	}


	/**
	 * Select and scroll to one annotation's row, from the gutter hover or the
	 * CodeLens. Rows materialise when their group expands, so the row is built
	 * here under its group for the tree to expand its way to; the ids on both
	 * are what it matches on. An annotation the Browser does not list -- kept
	 * out by the file scope, or never pushed -- is left alone.
	 */
	async reveal(id: string)
	{
		if (!this.view)
			return;
		this.pendingReveal = undefined;
		for (const group of this.groups()) {
			const annotation = group.rows.find(a => a.id === id);
			if (!annotation)
				continue;
			try {
				await this.view.reveal(new AnnotationItem(annotation, group.groupBy, group),
					{ select: true, focus: true });
			} catch {
				// The view cannot be brought up: its setting has it hidden.
				window.showInformationMessage('Turn on the Annotation Browser '
					+ '(understand.annotationBrowser.enabled) to show annotations there.');
			}
			return;
		}
		this.pendingReveal = id;
	}


	getTreeItem(element: AnnotationNode): TreeItem
	{
		return element;
	}


	update(params: Params)
	{
		this.annotations = params.annotations;
		this.total = params.total;
		this.truncated = params.truncated;
		this.refreshBadge();
		this.emitter.fire();
		if (this.pendingReveal && params.annotations.some(a => a.id === this.pendingReveal)) {
			const id = this.pendingReveal;
			this.pendingReveal = undefined;
			void this.reveal(id);
		}
	}


	setGroupBy(groupBy: AnnotationGroupBy)
	{
		this.groupBy = groupBy;
		this.emitter.fire();
	}


	setScope(scope: AnnotationScope)
	{
		this.scope = scope;
		commands.executeCommand('setContext', kScopeContext, scope);
		this.refreshBadge();
		this.emitter.fire();
	}


	/**
	 * Only the annotations still missing a required field -- the rows the
	 * Browser reads red -- or every annotation again. Independent of the file
	 * scope: both narrow the same list (Rob 2026-09-17).
	 */
	setIncompleteOnly(on: boolean)
	{
		this.incompleteOnly = on;
		commands.executeCommand('setContext', kIncompleteContext, on);
		this.refreshBadge();
		this.emitter.fire();
	}


	/**
	 * The file in front of the reader changed: the active text editor, or
	 * the file a Browser click just opened (`shown`). Remembered, because
	 * while the field editor window has the focus VS Code reports no active
	 * text editor at all, and the file scope went empty right after a row
	 * click until the editor was clicked (Rob 2026-09-17). Only a
	 * file-scoped Browser redraws.
	 */
	activeFileChanged(shown?: Uri)
	{
		const uri = shown ?? window.activeTextEditor?.document.uri;
		if (uri && uri.scheme === 'file')
			this.currentFile = pathOf(uri.toString());
		if (this.scope !== 'file')
			return;
		this.refreshBadge();
		this.emitter.fire();
	}


	// Every annotation, or only the current file's, or only those with a
	// required field still empty. The current file is the active text
	// editor's, or the last one shown when no text editor has the focus. An
	// editor showing something that is not a file -- a diff, output,
	// settings -- has nothing to list rather than falling back to the whole
	// project.
	private visible(): Annotation[]
	{
		let rows = this.annotations;
		if (this.scope === 'file') {
			const editor = window.activeTextEditor;
			const active = !editor ? this.currentFile
				: editor.document.uri.scheme === 'file' ? pathOf(editor.document.uri.toString()) : '';
			rows = active ? rows.filter(a => pathOf(a.positionUri) === active) : [];
		}
		if (this.incompleteOnly)
			rows = rows.filter(a => (a.missingRequired ?? []).length > 0);
		return rows;
	}


	private refreshBadge()
	{
		if (!this.view)
			return;
		const narrowed = this.scope === 'file' || this.incompleteOnly;
		const value = narrowed ? this.visible().length : this.total;
		this.view.badge = value
			? { value, tooltip: this.incompleteOnly
				? `${value} annotations missing a required field` : `${value} annotations` }
			: undefined;
	}


	private groups(): AnnotationGroupItem[]
	{
		const buckets = new Map<string, Annotation[]>();
		for (const annotation of this.visible()) {
			const key = this.keyOf(annotation);
			let bucket = buckets.get(key);
			if (bucket === undefined) {
				bucket = [];
				buckets.set(key, bucket);
			}
			bucket.push(annotation);
		}

		const entries: { name: string, key: string, rows: Annotation[], tooltip?: string }[] = [];
		buckets.forEach((rows, key) => {
			entries.push({
				name: this.groupBy === 'file' ? basename(key) : key,
				key,
				rows,
				tooltip: this.groupBy === 'file' ? key : undefined,
			});
		});
		entries.sort((a, b) => this.groupBy === 'date'
			? b.name.localeCompare(a.name) // newest first
			: a.name.localeCompare(b.name));
		const groups = entries.map(e => {
			const group = new AnnotationGroupItem(e.name, e.rows, this.groupBy, e.key);
			if (e.tooltip)
				group.tooltip = e.tooltip;
			return group;
		});

		if (this.truncated && this.scope === 'all') {
			const notice = new AnnotationGroupItem(
				`Showing a subset — ${this.total} annotations in the project`, []);
			notice.collapsibleState = TreeItemCollapsibleState.None;
			notice.iconPath = new ThemeIcon('info');
			groups.unshift(notice);
		}
		return groups;
	}


	private keyOf(annotation: Annotation): string
	{
		switch (this.groupBy) {
			case 'author':
				return annotation.author || '(no author)';
			case 'template':
				return annotation.templateName || 'Freeform';
			case 'date':
				return annotation.lastModified || '(no date)';
			default:
				return annotation.positionUri
					? decodeURIComponent(Uri.parse(annotation.positionUri).fsPath)
					: '(no file)';
		}
	}
}


export function handleUnderstandAnnotationsListed(params: Params)
{
	// The Browser's rows. The gutter has its own push (annotations/marks),
	// so it does not go dark when this one is turned off.
	variables.annotationsTreeProvider.update(params);
	// An annotation the list no longer has was deleted, wherever from; the
	// field editor does not keep showing it. A truncated list says nothing
	// about what it left out.
	if (!params.truncated) {
		const listed = new Set(params.annotations.map(a => a.id));
		closeFieldEditorFor(id => !listed.has(id));
	}
}


// The view-title command: one picker, like the Violations view's.
export async function annotationsGroupBy()
{
	// label is the display text; value is the stable key
	const picked = await window.showQuickPick(
		[
			{ label: 'File', value: 'file' as AnnotationGroupBy },
			{ label: 'Author', value: 'author' as AnnotationGroupBy },
			{ label: 'Template', value: 'template' as AnnotationGroupBy },
			{ label: 'Date', value: 'date' as AnnotationGroupBy },
		],
		{ placeHolder: 'Group annotations by' });
	if (picked)
		variables.annotationsTreeProvider.setGroupBy(picked.value);
}


export function annotationsShowAllFiles()
{
	variables.annotationsTreeProvider.setScope('all');
}


export function annotationsShowCurrentFile()
{
	variables.annotationsTreeProvider.setScope('file');
}


export function annotationsShowIncomplete()
{
	variables.annotationsTreeProvider.setIncompleteOnly(true);
}


export function annotationsShowComplete()
{
	variables.annotationsTreeProvider.setIncompleteOnly(false);
}


// A file's identity for comparing a row against the active editor. VS Code
// hands out a Windows drive letter in either case, so the comparison folds
// case there and is exact everywhere else.
function pathOf(uri: string | undefined): string
{
	if (!uri)
		return '';
	const path = decodeURIComponent(Uri.parse(uri).fsPath);
	return process.platform === 'win32' ? path.toLowerCase() : path;
}


export class AnnotationGroupItem extends TreeItem
{
	rows: Annotation[];
	groupBy: AnnotationGroupBy;

	constructor(name: string, rows: Annotation[], groupBy: AnnotationGroupBy = 'file', key: string = name)
	{
		super(name, rows.length ? TreeItemCollapsibleState.Collapsed
		                        : TreeItemCollapsibleState.None);
		// A stable id, so a reveal that builds the group afresh still names
		// the one the tree has. The key rather than the name: two files can
		// share a basename.
		this.id = `group:${groupBy}:${key}`;
		this.contextValue = 'understandAnnotationGroup';
		if (rows.length)
			this.description = `${rows.length}`;
		this.rows = rows;
		this.groupBy = groupBy;
	}
}


export class AnnotationItem extends TreeItem
{
	// The commands on this row act on the annotation, not on the row: they
	// take its id, its template, the values as stored, and its note.
	id: string;
	templateId?: string;
	templateName?: string;
	fieldValues?: { [key: string]: string | string[] };
	missingRequired?: string[];
	body?: string;
	positionUri?: string;
	positionLine?: number;
	positionCharacter?: number;
	metadata?: string;
	note?: string;
	// The record as rendered for display, which the row expands to show.
	fields?: { label: string, value: string }[];
	// The group the row was built under, for the tree to reach it by.
	parent?: AnnotationGroupItem;

	constructor(annotation: Annotation, groupBy: AnnotationGroupBy, parent?: AnnotationGroupItem)
	{
		const summary = annotationSummary(annotation.body, annotation.fields);
		// A templated annotation opens to its record, read-only, the way
		// Understand's completed card shows it. A freeform one has none.
		super(summary, (annotation.fields ?? []).length
			? TreeItemCollapsibleState.Collapsed
			: TreeItemCollapsibleState.None);

		this.fields = annotation.fields;
		this.parent = parent;
		this.id = annotation.id;
		this.body = annotation.body;
		this.metadata = annotation.metadata;
		this.note = annotation.note;
		this.templateId = annotation.templateId;
		this.templateName = annotation.templateName;
		this.fieldValues = annotation.fieldValues;
		this.missingRequired = annotation.missingRequired;
		this.positionUri = annotation.positionUri;
		this.positionLine = annotation.positionLine;
		this.positionCharacter = annotation.positionCharacter;

		// The two kinds offer different edits -- a freeform annotation its
		// text, a templated one its fields -- so the menu can tell them apart.
		this.contextValue = annotation.templateId
			? 'understandAnnotationTemplated' : 'understandAnnotation';
		// A required field left empty is worth seeing from the list, the way
		// the card marks the gap in red rather than waiting to be opened.
		const incomplete = (annotation.missingRequired ?? []).length > 0;
		// The label goes red for a gap, the way Understand marks it on the
		// card. A tree row's label takes its colour from a file decoration, so
		// the row carries a uri of its own scheme and
		// IncompleteAnnotationDecorations answers for that scheme alone.
		// An ignored violation's row reads yellow the same way (Rob
		// 2026-09-21); a gap outranks it.
		const ignore = annotation.kind === 'ignore';
		if (incomplete)
			this.resourceUri = Uri.from({ scheme: kIncompleteScheme, path: '/' + annotation.id });
		else if (ignore)
			this.resourceUri = Uri.from({ scheme: kIgnoreScheme, path: '/' + annotation.id });
		// The selected row's text takes the selection colour whatever its
		// decoration says -- VS Code's rule for every tree -- so the colour
		// rides on the icon as well, which keeps it. A tree item's icon may
		// only take the charts.* colours.
		this.iconPath = incomplete
			? new ThemeIcon('warning', new ThemeColor('charts.red'))
			: ignore
				? new ThemeIcon('exclude', new ThemeColor('charts.yellow')) : new ThemeIcon('note');

		// The row says what its group cannot: where it is and who wrote it.
		const where = annotation.positionUri
			? `${basename(decodeURIComponent(Uri.parse(annotation.positionUri).fsPath))} · ${annotation.positionTitle}`
			: annotation.positionTitle;
		const parts: string[] = [];
		if (groupBy !== 'file')
			parts.push(where);
		if (groupBy !== 'author' && annotation.author)
			parts.push(annotation.author);
		if (groupBy !== 'template' && annotation.templateName)
			parts.push(annotation.templateName);
		if (incomplete)
			parts.push(`missing: ${(annotation.missingRequired ?? []).join(', ')}`);
		this.description = parts.join(' · ');

		const fieldLines = (annotation.fields ?? [])
			.map(f => `${f.label}: ${f.value}`).join('\n');
		this.tooltip = [
			annotation.body,
			fieldLines,
			`${annotation.author} — ${annotation.lastModified}`,
		].filter(Boolean).join('\n\n');

		// A single click goes to the annotation in the editor and opens it for
		// editing, the way clicking a card in Understand does. A freeform
		// annotation has no fields to open, so its click ends in the editor.
		this.command = {
			command: 'understand.annotations.openFromBrowser',
			title: 'Open Annotation',
			arguments: [this],
		} as Command;
	}
}


/**
 * One row of an annotation's record: the field's label, and beside it the
 * value as the server rendered it.
 *
 * This is the read-only half of Understand's card. A tree row cannot draw the
 * card itself, but it can say the same thing in the same order, and the value
 * reads as a value because VS Code renders a description in the muted colour
 * next to the label (Rob 2026-09-14).
 */
export class AnnotationFieldItem extends TreeItem
{
	parent: AnnotationItem;

	constructor(field: { label: string, value: string }, parent: AnnotationItem)
	{
		super(field.label, TreeItemCollapsibleState.None);
		this.parent = parent;
		this.command = {
			command: 'understand.annotations.openFieldFromBrowser',
			title: 'Edit Field',
			arguments: [this],
		} as Command;
		this.description = field.value;
		// A long value is cut off in the row; the tooltip carries all of it.
		this.tooltip = `${field.label}: ${field.value}`;
		this.contextValue = 'understandAnnotationField';
	}
}


// The uri scheme a Browser row carries when its record has a required field
// still empty, and the decoration that paints such a row red.
export const kIncompleteScheme = 'understand-annotation-incomplete';
export const kIgnoreScheme = 'understand-annotation-ignore';

// A tree row's label takes its colour from a file decoration, so the rows
// carry uris of their own schemes and this answers for those alone: red for
// a required field still empty, yellow for an ignored violation.
export class AnnotationRowDecorations implements FileDecorationProvider
{
	provideFileDecoration(uri: Uri): FileDecoration | undefined
	{
		if (uri.scheme === kIncompleteScheme)
			return new FileDecoration(undefined, 'A required field is still empty',
				new ThemeColor('errorForeground'));
		if (uri.scheme === kIgnoreScheme)
			return new FileDecoration(undefined, 'An ignored violation',
				new ThemeColor('list.warningForeground'));
		return undefined;
	}
}


// How an annotation is named in a line: the first line of what was written,
// or the template's field rows when the body is only the record, or the fact
// that there is nothing. The Browser's rows and the gutter menu's picks say
// the same thing.
export function annotationSummary(body: string | undefined,
                                  fields?: { label: string, value: string }[]): string
{
	return firstLine(body ?? '')
		|| (fields ?? []).map(f => `${f.label}=${f.value}`).join(', ')
		|| '(empty)';
}


function firstLine(text: string): string
{
	const trimmed = (text || '').trim();
	const end = trimmed.indexOf('\n');
	return end < 0 ? trimmed : trimmed.substring(0, end);
}


function basename(path: string): string
{
	const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
	return i < 0 ? path : path.substring(i + 1);
}


type Params = {
	annotations: Annotation[],
	total: number,
	truncated: boolean,
};


type Annotation = {
	author: string,
	// The values as stored, keyed the way the template keys them -- what an
	// edit hands back. The rendered `fields` above read to a person and
	// cannot be parsed back into values.
	fieldValues?: { [key: string]: string | string[] },
	// The labels of required fields with nothing in them.
	missingRequired?: string[],
	body: string,
	// The Metadata stamp the body opens with and the note under it, apart.
	metadata?: string,
	note?: string,
	id: string,
	kind: 'note' | 'ignore',
	lastModified: string,
	positionCharacter: number,
	positionLine: number,
	positionTitle: string,
	positionUri: string,
	templateId?: string,
	templateName?: string,
	fields?: { label: string, value: string }[],
};
