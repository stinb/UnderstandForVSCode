import {
	commands,
	EventEmitter,
	MarkdownString,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri
} from 'vscode';
import { variables } from '../other/variables';


export class ReferencesTreeProvider implements TreeDataProvider<Key>
{
	private emitter = new EventEmitter<void>();
	private children: EntItem[] = [];

	onDidChangeTreeData = this.emitter.event;


	getChildren(element?: Key): Key[] | Thenable<Key[]>
	{
		// One entity, the cursor's, has no row of its own: the view's header
		// already names it, and the pin is in the title bar (Rob 2026-10-29).
		// Rows come back once something is pinned, to tell the entities apart.
		if (element === undefined)
			return this.cursorOnly() ? this.children[0].getChildren() : this.children;
		if (element instanceof EntItem)
			return element.getChildren();
		if (element instanceof FileItem)
			return element.getChildren();
		return [];
	}


	getTreeItem(element: Key): TreeItem
	{
		return element;
	}


	update(params: Params)
	{
		// Remove all items and update the pinned items
		if (params.pinned) {
			this.children.length = 0;
			for (const data of params.pinned)
				this.children.push(new EntItem(data));
		}
		// Remove the unpinned item if it's there
		else {
			const length = this.children.length;
			if (length && !(this.children[length - 1].pinned))
				this.children.pop();
		}

		// Add the unpinned item if it's there
		if (params.cursor)
			this.children.push(new EntItem(params.cursor));

		commands.executeCommand('setContext', kCursorOnlyContext, this.cursorOnly());
		this.emitter.fire();
	}


	private cursorOnly(): boolean
	{
		return this.children.length === 1 && !this.children[0].pinned;
	}
}


// The view shows the cursor's entity alone, without its row, so the title
// bar carries its Pin button
const kCursorOnlyContext = 'understand.referencesCursorOnly';


export function handleUnderstandChangedReferences(params: Params)
{
	variables.referencesTreeProvider.update(params);
}


export class EntItem extends TreeItem
{
	readonly pinned: boolean;
	readonly uniqueName: string;

	private files: FileItem[] = [];
	private references: RefItem[] = [];


	constructor(data: EntData)
	{
		super(data.name, TreeItemCollapsibleState.Expanded);

		this.description = `\u2003${data.shortKind}`;
		this.contextValue = data.pinned ? 'understandPinnedEntity' : 'understandUnpinnedEntity';
		this.pinned = data.pinned;
		this.tooltip = `${data.longKind}\u2003${data.longName}`;
		this.uniqueName = data.uniqueName;

		if ('files' in data)
			for (const child of data.files)
				this.files.push(new FileItem(child, data.uniqueName));
		else
			for (const child of data.references)
				this.references.push(new RefItem(child));
	}


	getChildren(): FileItem[] | RefItem[]
	{
		return this.files.length !== 0 ? this.files : this.references;
	}
}


class FileItem extends TreeItem
{
	private files: FileItem[] = [];
	private references: RefItem[] = [];
	// A heavily used entity's file comes with its count alone, and its
	// references are asked for when it is expanded
	private pending?: { uniqueName: string, file: string };


	constructor(data: FileData, uniqueName: string)
	{
		const lazy = 'count' in data;
		super(data.name, lazy ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.Expanded);

		this.contextValue = 'understandFile';
		this.tooltip = new MarkdownString(data.path);

		if ('count' in data) {
			this.description = `${data.count}`;
			this.pending = { uniqueName, file: data.file };
		}
		else if ('files' in data)
			for (const child of data.files)
				this.files.push(new FileItem(child, uniqueName));
		else
			for (const child of data.references)
				this.references.push(new RefItem(child));
	}


	async getChildren(): Promise<FileItem[] | RefItem[]>
	{
		if (this.pending) {
			const reply: { references?: RefData[] } | null = await variables.languageClient
				.sendRequest<{ references?: RefData[] }>('understand/references/file', this.pending)
				.catch(() => null);
			this.references = (reply?.references ?? []).map(data => new RefItem(data));
			this.pending = undefined;
		}
		return this.files.length !== 0 ? this.files : this.references;
	}
}


class RefItem extends TreeItem
{
	constructor(data: RefData)
	{
		super(data.shortKind);

		const uri = Uri.parse(data.uri);

		this.command = {
			title: 'Go to Reference',
			command: 'understand.referencesView.goToReference',
			arguments: [uri, data.line, data.character],
		};
		this.contextValue = 'understandReference';

		const prettyLine = data.line + 1;
		const prettyCharacter = data.character + 1;

		if (data.relativeName)
			this.description = `\u2003${data.relativeName}\u2003${prettyLine}`;
		else
			this.description = `\u2003${prettyLine}`;

		this.tooltip = new MarkdownString(`${data.longKind}\u2003${prettyLine} : ${prettyCharacter}\u2003${uri.fsPath}`);
	}
}


type Key = EntItem | FileItem | RefItem;

type EntData = {
	name: string,
	longName: string,
	shortKind: string,
	longKind: string,
	uniqueName: string,
	pinned: boolean,
	files: FileData[],
} | {
	name: string,
	longName: string,
	shortKind: string,
	longKind: string,
	uniqueName: string,
	pinned: boolean,
	references: RefData[],
};

type FileData = {
	name: string,
	path: string,
	files: FileData[],
} | {
	name: string,
	path: string,
	references: RefData[],
} | {
	name: string,
	path: string,
	// The server's key for the file, to ask for its references by
	file: string,
	count: number,
};

type RefData = {
	shortKind: string,
	longKind: string,
	relativeName?: string,
	uri: string,
	line: number,
	character: number,
};

type Params = {
	cursor?: EntData,
	pinned?: EntData[],
};
