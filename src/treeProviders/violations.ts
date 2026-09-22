import {
	Command,
	commands,
	EventEmitter,
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
import { textEditorColumn } from '../other/textEditorColumn';
import { isCheckId } from '../types/check';


// The Violations view (sti #4719): every violation in the project, grouped
// by file by default and re-groupable by check, severity, or entity from
// the same pushed payload. Rows carry what the Problems panel cannot: the
// check's own severity and the entity the violation is on.
export type GroupBy = 'file' | 'check' | 'severity' | 'entity';


export class ViolationTreeProvider implements TreeDataProvider<Node>
{
	private files: File[] = [];
	private total = 0;
	private truncated = false;
	private groupBy: GroupBy = 'file';
	private emitter = new EventEmitter<void>();
	private view: TreeView<Node> | undefined;

	onDidChangeTreeData = this.emitter.event;


	// The created TreeView, for the count badge on the view header --
	// the same pill the Explore Violations webview renders in HTML.
	attach(view: TreeView<Node>)
	{
		this.view = view;
	}


	getChildren(element: Node | undefined): Node[]
	{
		if (element === undefined)
			return this.groups();
		if (element instanceof GroupItem)
			// Rows materialize when the group expands: at the 20k cap,
			// building every row up front on each update or regroup was
			// most of the work for groups nobody opens.
			return element.rows.map(
				row => new ViolationItem(row.file, row.violation, element.groupBy));
		// A violation's other locations, expanded on demand the same way.
		if (element instanceof ViolationItem)
			return element.notes.map(note => new NoteItem(note));
		return [];
	}


	getTreeItem(element: Node): TreeItem
	{
		return element;
	}


	update(params: Params)
	{
		this.files = params.files;
		this.total = params.total;
		this.truncated = params.truncated;
		if (this.view)
			this.view.badge = this.total
				? { value: this.total, tooltip: `${this.total} violations` }
				: undefined;
		this.emitter.fire();
	}


	setGroupBy(groupBy: GroupBy)
	{
		this.groupBy = groupBy;
		this.emitter.fire();
	}


	// One flat pass over the pushed payload, bucketed by the current
	// grouping. Rebuilt on demand: regrouping is a client-side toggle and
	// must not wait on the server.
	private groups(): GroupItem[]
	{
		const buckets = new Map<string, Row[]>();
		for (const file of this.files) {
			for (const violation of file.violations) {
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
		entries.sort((a, b) => a.name.localeCompare(b.name));
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

		if (this.truncated) {
			const notice = new GroupItem(
				`Showing a subset — ${this.total} violations in the project`, []);
			notice.collapsibleState = TreeItemCollapsibleState.None;
			notice.iconPath = new ThemeIcon('info');
			groups.unshift(notice);
		}
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


function severityIcon(severity: number): ThemeIcon
{
	if (severity >= 75)
		return new ThemeIcon('error');
	if (severity >= 25)
		return new ThemeIcon('warning');
	return new ThemeIcon('info');
}


type Row = { file: File, violation: Violation };


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


export class ViolationItem extends TreeItem
{
	filePath: string;
	notes: Note[];
	// The check that reported it, for the row's Show Check button and menu.
	checkId: string;

	constructor(file: File, violation: Violation, groupBy: GroupBy)
	{
		// A violation with other locations opens to show them; one without
		// stays a leaf, so nothing offers an arrow that reveals nothing.
		const notes = violation.notes ?? [];
		super(violation.message, notes.length
			? TreeItemCollapsibleState.Collapsed
			: TreeItemCollapsibleState.None);

		this.notes = notes;
		this.filePath = file.path;
		this.checkId = violation.id;
		// A parse error or warning is listed like a violation but has no check
		// behind it, so its row offers no Show Check.
		this.contextValue = isCheckId(violation.id) ? 'understandViolation' : 'understandViolationParse';
		this.iconPath = severityIcon(violation.severity);

		// The row says what its group cannot: grouped by file the check and
		// entity ride in the description, grouped by check the file does.
		const line = violation.range.start.line + 1;
		const where = groupBy === 'file'
			? `${violation.id}${violation.entity ? ' · ' + violation.entity : ''} · ${line}`
			: `${basename(file.path)}:${line}${violation.entity ? ' · ' + violation.entity : ''}`;
		this.description = where;
		this.tooltip = `${violation.id} — ${severityName(violation.severity)}\n`
			+ `${file.path}:${line}`
			+ (violation.entity ? `\nEntity: ${violation.entity}` : '')
			+ (notes.length ? `\n${notes.length} other location`
				+ (notes.length === 1 ? '' : 's') : '');

		this.command = openCommand(file.uri, violation.range);
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
	truncated: boolean,
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
	// The violation's other locations, the same notes the diagnostic
	// carries as relatedInformation.
	notes?: Note[],
};


type Note = {
	message: string,
	path: string,
	uri: string,
	range: { start: { line: number, character: number },
	         end: { line: number, character: number } },
};


type Node = GroupItem | ViolationItem | NoteItem;
