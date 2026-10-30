import {
	Command,
	commands,
	EventEmitter,
	MarkdownString,
	Range,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	TreeView,
	Uri,
	window,
} from 'vscode';
import { variables } from '../other/variables';
import { contexts, setContext } from '../other/context';
import { pathOf } from '../other/filePath';
import { textEditorColumn } from '../other/textEditorColumn';
import { isCheckId } from '../types/check';
import { escapeMarkdown } from '../other/annotationMarkdown';


// The Violations view (sti #4719): every violation in the project, grouped
// by file by default and re-groupable by check, severity, or entity from
// the same pushed payload. Rows carry what the Problems panel cannot: the
// check's own severity and the entity the violation is on.
export type GroupBy = 'file' | 'check' | 'severity' | 'entity';

// Which violations the view lists: every one in the project, or only those
// in the file in the active editor, the same switch the Annotations view
// has (Rob 2026-10-01).
export type ViolationScope = 'all' | 'file';
const kScopeContext = 'understand.violationsListScope';
const kListedContext = 'understand.violationsListed';

// The view's two sections (Rob 2026-10-28): the analysis errors and warnings,
// which the parser stores and every licence shows, and what the background
// CodeChecks found, which needs CodeCheck
export type Section = 'analysis' | 'codecheck';


export class ViolationTreeProvider implements TreeDataProvider<Node>
{
	private files: File[] = [];
	private total = 0;
	private sectionTotals: Partial<Record<Section, number>> = {};
	private groupBy: GroupBy = 'file';
	private scope: ViolationScope = 'all';
	private codecheckLicensed = true;
	private currentFile = '';
	private emitter = new EventEmitter<void>();
	private view: TreeView<Node> | undefined;

	onDidChangeTreeData = this.emitter.event;


	// The created TreeView, for the count badge on the view header --
	// the same pill the Explore Violations webview renders in HTML.
	attach(view: TreeView<Node>)
	{
		this.view = view;
	}


	getChildren(element: Node | undefined): Node[] | Thenable<Node[]>
	{
		if (element === undefined)
			return this.sections();
		if (element instanceof SectionItem)
			return this.groups(element.section);
		if (element instanceof GroupItem)
			// Rows materialize when the group expands: at the 20k cap,
			// building every row up front on each update or regroup was
			// most of the work for groups nobody opens.
			//
			// Ordered the way the Problems panel orders a file's problems --
			// worst first, then down the file -- rather than the order the
			// server stored them in, which is by check id.
			return orderedRows(element.rows).map(
				row => new ViolationItem(row.file, row.violation, element.groupBy));
		// A violation's other locations, asked for when the row expands: the
		// list sends only their count.
		if (element instanceof ViolationItem)
			return element.loadNotes().then(notes => notes.map(note => new NoteItem(note)));
		return [];
	}


	getTreeItem(element: Node): TreeItem
	{
		return element;
	}


	update(params: Params)
	{
		if (params.hidden) {
			// The view is not showing, so the server sent only the count; the
			// whole list comes when it shows
			this.total = params.total;
			this.refreshBadge();
			return;
		}
		if (params.partial) {
			// Only the files whose violations changed: each replaces its old
			// entry, and one with none left goes
			const changed = new Map(params.files.map(file => [file.uri, file]));
			this.files = this.files.filter(file => !changed.has(file.uri));
			changed.forEach(file => {
				if (file.violations.length)
					this.files.push(file);
			});
		}
		else {
			this.files = params.files;
		}
		this.total = params.total;
		this.sectionTotals ={ analysis: params.analysisTotal, codecheck: params.codecheckTotal };
		// An empty list says "no violations" only once the server has
		// listed them (the view's welcome text in package.json)
		commands.executeCommand('setContext', kListedContext, true);
		this.refreshBadge();
		this.emitter.fire();
	}


	setGroupBy(groupBy: GroupBy)
	{
		this.groupBy = groupBy;
		this.emitter.fire();
	}


	setCodeCheckLicensed(licensed: boolean)
	{
		if (licensed === this.codecheckLicensed)
			return;
		this.codecheckLicensed = licensed;
		this.emitter.fire();
	}


	setScope(scope: ViolationScope)
	{
		this.scope = scope;
		commands.executeCommand('setContext', kScopeContext, scope);
		this.refreshBadge();
		this.emitter.fire();
	}


	/**
	 * The file in front of the reader changed. Remembered, because while a
	 * check card in the field editor window has the focus VS Code reports no
	 * active text editor at all, and the file scope would otherwise go empty
	 * right after a row click. Only a file-scoped view redraws.
	 */
	activeFileChanged()
	{
		const uri = window.activeTextEditor?.document.uri;
		if (uri && uri.scheme === 'file')
			this.currentFile = pathOf(uri.toString());
		if (this.scope !== 'file')
			return;
		this.refreshBadge();
		this.emitter.fire();
	}


	// Every file, or only the current one. The current file is the active
	// text editor's, or the last one shown when no text editor has the
	// focus. An editor showing something that is not a file -- a diff,
	// output, settings -- has nothing to list rather than falling back to
	// the whole project.
	private visibleFiles(): File[]
	{
		if (this.scope !== 'file')
			return this.files;
		const editor = window.activeTextEditor;
		const active = !editor ? this.currentFile
			: editor.document.uri.scheme === 'file' ? pathOf(editor.document.uri.toString()) : '';
		return active ? this.files.filter(f => pathOf(f.uri) === active) : [];
	}


	// The count badge on the view header -- the same pill the Explore
	// Violations webview renders in HTML. The project's total, or the
	// current file's count while the view is scoped to it.
	private refreshBadge()
	{
		if (!this.view)
			return;
		const value = this.scope === 'file'
			? this.visibleFiles().reduce((n, f) => n + f.violations.length, 0)
			: this.total;
		this.view.badge = value ? { value, tooltip: `${value} violations` } : undefined;
	}


	// CodeCheck when the licence has it, then Analysis (Rob 2026-10-29).
	// Nothing at all when there is nothing to list, so the view's welcome
	// text says so.
	private sections(): GroupItem[]
	{
		const counts = { analysis: 0, codecheck: 0 };
		for (const file of this.visibleFiles())
			for (const violation of file.violations)
				counts[sectionOf(violation)]++;
		if (counts.analysis + counts.codecheck === 0)
			return [];

		// A section cut short says so itself; the whole file's rows come
		// either way, so a file-scoped view is never cut
		const totalOf = (section: Section) =>
			this.scope === 'all' ? this.sectionTotals[section] ?? 0 : 0;
		const sections: GroupItem[] = [];
		if (this.codecheckLicensed)
			sections.push(new SectionItem('codecheck', counts.codecheck, totalOf('codecheck')));
		sections.push(new SectionItem('analysis', counts.analysis, totalOf('analysis')));
		return sections;
	}


	// One flat pass over the pushed payload, bucketed by the current
	// grouping. Rebuilt on demand: regrouping is a client-side toggle and
	// must not wait on the server.
	private groups(section: Section): GroupItem[]
	{
		const buckets = new Map<string, Row[]>();
		for (const file of this.visibleFiles()) {
			for (const violation of file.violations) {
				if (sectionOf(violation) !== section)
					continue;
				const key = this.keyOf(file, violation);
				let bucket = buckets.get(key);
				if (bucket === undefined) {
					bucket = [];
					buckets.set(key, bucket);
				}
				bucket.push({ file, violation });
			}
		}

		const entries: { name: string, rows: Row[], tooltip?: string }[] = [];
		buckets.forEach((rows, key) => {
			// Grouped by file the key is the whole path: the basename is the
			// name and the path rides in the tooltip.
			entries.push({
				name: this.groupBy === 'file' ? basename(key) : key,
				rows,
				tooltip: this.groupBy === 'file' ? key : undefined,
			});
		});
		// File, check and entity names read best alphabetically. Severity
		// names do not: alphabetical puts Informational second, above Low
		// and Medium. The levels do not overlap, so any row in a group
		// ranks the whole group, worst first.
		entries.sort((a, b) => this.groupBy === 'severity'
			? b.rows[0].violation.severity - a.rows[0].violation.severity
			: a.name.localeCompare(b.name));
		const groups = entries.map(e => {
			const group = new GroupItem(e.name, e.rows, this.groupBy);
			if (e.tooltip) {
				// File grouping: the tooltip is the whole path, which the
				// Exclude from CodeCheck context action also needs.
				group.tooltip = e.tooltip;
				group.filePath = e.tooltip;
				group.contextValue = 'understandViolationFileGroup';
			}
			return group;
		});
		return groups;
	}


	private keyOf(file: File, violation: Violation): string
	{
		switch (this.groupBy) {
			case 'check':
				return violation.id;
			case 'severity':
				return severityName(violation.severity);
			case 'entity':
				return violation.entity || '(no entity)';
			default:
				return file.path;
		}
	}
}


export function handleUnderstandViolationsListed(params: Params)
{
	variables.violationsListProvider.update(params);
}


export function setCodeCheckLicensed(licensed: boolean)
{
	setContext(contexts.codecheckLicensed, licensed);
	// The start-up path that calls this goes on to register the licence
	// handlers, so it must not depend on the Violations view existing yet
	variables.violationsListProvider?.setCodeCheckLicensed(licensed);
}


// The view-title command: one picker instead of four toggle buttons.
export async function violationsGroupBy()
{
	// label is the display text; value is the stable key
	const picked = await window.showQuickPick(
		[
			{ label: 'File', value: 'file' as GroupBy },
			{ label: 'Check', value: 'check' as GroupBy },
			{ label: 'Severity', value: 'severity' as GroupBy },
			{ label: 'Entity', value: 'entity' as GroupBy },
		],
		{ placeHolder: 'Group violations by' });
	if (picked)
		variables.violationsListProvider.setGroupBy(picked.value);
}


export function violationsShowAllFiles()
{
	variables.violationsListProvider.setScope('all');
}


export function violationsShowCurrentFile()
{
	variables.violationsListProvider.setScope('file');
}


// Severity levels as CodeCheck defines them (codecheck/CheckInfo.h).
function severityName(severity: number): string
{
	if (severity >= 100)
		return 'Urgent';
	if (severity >= 75)
		return 'High';
	if (severity >= 50)
		return 'Medium';
	if (severity >= 25)
		return 'Low';
	if (severity >= 0)
		return 'Informational';
	return 'No severity';
}


type Row = { file: File, violation: Violation };


function sectionOf(violation: Violation): Section
{
	return isCheckId(violation.id) ? 'codecheck' : 'analysis';
}


/**
 * A group's rows in the Problems panel's order: worst severity first, then
 * down the file, then across the line. Sorted on a copy, so the payload the
 * provider holds is left as it arrived.
 */
function orderedRows(rows: Row[]): Row[]
{
	return [...rows].sort((a, b) => {
		const severity = b.violation.severity - a.violation.severity;
		if (severity !== 0)
			return severity;
		const line = a.violation.range.start.line - b.violation.range.start.line;
		if (line !== 0)
			return line;
		return a.violation.range.start.character - b.violation.range.start.character;
	});
}


export class GroupItem extends TreeItem
{
	rows: Row[];
	groupBy: GroupBy;
	filePath?: string;

	constructor(name: string, rows: Row[], groupBy: GroupBy = 'file')
	{
		// The count sits in the description (the muted default): native
		// tree rows offer no way to render the webview's blue pills or to
		// color the digits alone, so plain beats approximations (Rob,
		// 2026-08-28).
		super(name, rows.length ? TreeItemCollapsibleState.Collapsed
		                        : TreeItemCollapsibleState.None);
		this.contextValue = 'understandViolationGroup';
		if (rows.length)
			this.description = `${rows.length}`;
		this.rows = rows;
		this.groupBy = groupBy;
	}
}


// A section heading: open from the start, with its count. An empty section
// stays listed, so the reader sees that it found nothing.
export class SectionItem extends GroupItem
{
	section: Section;

	/** @param total the section's total in the project, more than `count`
	 * when the list was cut short */
	constructor(section: Section, count: number, total = 0)
	{
		super(section === 'analysis' ? 'Analysis' : 'CodeCheck', []);
		this.section = section;
		this.id = `understandViolationSection.${section}`;
		this.contextValue = 'understandViolationSection';
		this.collapsibleState = count
			? TreeItemCollapsibleState.Expanded
			: TreeItemCollapsibleState.None;

		const what = section === 'analysis'
			? 'Errors and warnings from analyzing the project'
			: "Violations from the project's background CodeChecks";
		if (total <= count) {
			this.description = `${count}`;
			this.tooltip = what;
			return;
		}
		// The server lists at most 20,000 of a section, so a very large
		// project cannot slow VS Code down; the Problems panel has them all
		this.description = `${count.toLocaleString()} of ${total.toLocaleString()} (truncated)`;
		this.iconPath = new ThemeIcon('warning');
		this.tooltip = new MarkdownString(`${what}.\n\n`
			+ `**Truncated:** this section lists ${count.toLocaleString()} of the project's `
			+ `${total.toLocaleString()}. Every one of them is in the Problems panel.`);
	}
}


export class ViolationItem extends TreeItem
{
	filePath: string;
	// The check that reported it, for the row's Show Check button and menu.
	checkId: string;
	private fileUri: string;
	private violation: Violation;


	constructor(file: File, violation: Violation, groupBy: GroupBy)
	{
		// A violation with other locations opens to show them; one without
		// stays a leaf, so nothing offers an arrow that reveals nothing.
		const noteCount = violation.notes?.length ?? violation.noteCount ?? 0;
		super(violation.message, noteCount
			? TreeItemCollapsibleState.Collapsed
			: TreeItemCollapsibleState.None);

		this.fileUri = file.uri;
		this.violation = violation;
		this.filePath = file.path;
		this.checkId = violation.id;
		// A parse error or warning is listed like a violation but has no check
		// behind it, so its row offers no Show Check.
		this.contextValue = isCheckId(violation.id) ? 'understandViolation' : 'understandViolationParse';

		// The row says what its group cannot: grouped by file the check and
		// entity ride in the description, grouped by check the file does.
		// The place reads the way the Problems panel writes it, down to the
		// column, so a row can be matched to its problem at a glance.
		const line = violation.range.start.line + 1;
		const column = violation.range.start.character + 1;
		const at = `[Ln ${line}, Col ${column}]`;
		const where = groupBy === 'file'
			? `${violation.id}${violation.entity ? ' · ' + violation.entity : ''} ${at}`
			: `${basename(file.path)} ${at}${violation.entity ? ' · ' + violation.entity : ''}`;
		this.description = where;

		// Markdown, so the check id is the link the Problems panel gives it:
		// there it is the codeDescription href, here the same card opened by
		// command. A tree row's description cannot hold a link, only its
		// tooltip can.
		const tooltip = new MarkdownString(undefined, true);
		tooltip.isTrusted = true;
		tooltip.appendMarkdown(isCheckId(violation.id)
			? `[${escapeMarkdown(violation.id)}](command:understand.checks.show?${
				encodeURIComponent(JSON.stringify(violation.id))})`
			: `**${escapeMarkdown(violation.id)}**`);
		tooltip.appendMarkdown(` — ${severityName(violation.severity)}\n\n`);
		tooltip.appendMarkdown(`${escapeMarkdown(file.path)} ${at}`);
		if (violation.entity)
			tooltip.appendMarkdown(`\n\nEntity: ${escapeMarkdown(violation.entity)}`);
		if (noteCount)
			tooltip.appendMarkdown(`\n\n${noteCount} other location`
				+ (noteCount === 1 ? '' : 's'));
		this.tooltip = tooltip;

		this.command = openCommand(file.uri, violation.range);
	}


	// The other locations, from the server the first time the row expands
	async loadNotes(): Promise<Note[]>
	{
		if (this.violation.notes)
			return this.violation.notes;
		const v = this.violation;
		const reply: { notes?: Note[] } | null = await variables.languageClient
			.sendRequest<{ notes?: Note[] }>('understand/violations/notes', {
				uri: this.fileUri,
				id: v.id,
				line: v.range.start.line,
				character: v.range.start.character,
				message: v.message,
			}).catch(() => null);
		v.notes = reply?.notes ?? [];
		return v.notes;
	}
}


// One of a violation's other locations. It reads and behaves like a
// violation row -- click to go there -- but says where a violation reaches
// rather than where it was reported.
export class NoteItem extends TreeItem
{
	constructor(note: Note)
	{
		super(note.message, TreeItemCollapsibleState.None);
		this.contextValue = 'understandViolationNote';
		this.iconPath = new ThemeIcon('arrow-small-right');

		const line = note.range.start.line + 1;
		this.description = `${basename(note.path)}:${line}`;
		this.tooltip = `${note.path}:${line}`;
		this.command = openCommand(note.uri, note.range);
	}
}


type LineRange = { start: { line: number, character: number },
                   end: { line: number, character: number } };


// A row's click. The column is decided when the row is clicked, not when it
// is built: after a check card has been opened the active column is the
// card's, and a plain vscode.open put the file there (Rob 2026-09-21).
function openCommand(uri: string, range: LineRange): Command
{
	return {
		command: 'understand.violations.open',
		title: 'Open',
		arguments: [uri, range],
	};
}


export async function openViolation(uri: string, range: LineRange)
{
	const target = Uri.parse(uri);
	await commands.executeCommand('vscode.open', target, {
		viewColumn: textEditorColumn(target),
		selection: new Range(range.start.line, range.start.character,
		                     range.end.line, range.end.character),
	});
}


function basename(path: string): string
{
	const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
	return i < 0 ? path : path.substring(i + 1);
}


type Params = {
	files: File[],
	total: number,
	// Only the files that changed since the last list
	partial?: boolean,
	// The view is hidden: the count alone
	hidden?: boolean,
	// Each section's total in the project, which the listed rows stop short
	// of when a section is cut
	analysisTotal?: number,
	codecheckTotal?: number,
};


type File = {
	path: string,
	uri: string,
	violations: Violation[],
};


type Violation = {
	id: string,
	message: string,
	range: { start: { line: number, character: number },
	         end: { line: number, character: number } },
	severity: number,
	entity: string,
	// How many other locations the violation has: the same notes the
	// diagnostic carries as relatedInformation, which the server sends when
	// the row is expanded and the row then keeps
	noteCount?: number,
	notes?: Note[],
};


type Note = {
	message: string,
	path: string,
	uri: string,
	range: { start: { line: number, character: number },
	         end: { line: number, character: number } },
};


type Node = SectionItem | GroupItem | ViolationItem | NoteItem;
