import * as vscode from 'vscode';
import {
	EventEmitter,
	MarkdownString,
	ProviderResult,
	TextDocumentShowOptions,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri
} from 'vscode';
import { variables } from '../other/variables';


export class InfoTreeProvider implements TreeDataProvider<Key>
{
	private emitter = new EventEmitter<void>();
	onDidChangeTreeData = this.emitter.event;


	getChildren(element?: Key): ProviderResult<TreeItem[]>
	{
		if (element instanceof ApiGroupItem)
			return [
				new SimpleItem('id', '275'),
				new SimpleItem('kindname', 'Macro'),
				new SimpleItem('kind.longname', 'Macro'),
				new SimpleItem('language', 'C++'),
				new SimpleItem('longname', 'MAGIC'),
				new SimpleItem('name', 'MAGIC'),
				new SimpleItem('parent', 'regmagic.h'),
				new SimpleItem('parsetime', '1747258415'),
				new SimpleItem('simplename', 'MAGIC'),
				new SimpleItem('type', '0234'),
				new SimpleItem('uniquename', '@lMAGIC@kc5MAGIC=0234@f./fastgrep/regmagic.h'),
				new SimpleItem('value', '0234'),
			];

		if (element instanceof EntItem)
			return [
				new ApiGroupItem(),
				new RefGroupItem(),
			];

		if (element instanceof RefItem)
			return [];

		if (element instanceof RefGroupItem) {
			const regexp = Uri.file('C:/SciTools/SampleProjects/All/fastgrep/fastgrep/regexp.c');
			const regmagic = Uri.file('C:/SciTools/SampleProjects/All/fastgrep/fastgrep/regmagic.h');
			const regsub = Uri.file('C:/SciTools/SampleProjects/All/fastgrep/fastgrep/regsub.c');
			return [
				new RefItem('Use', 'C Use', regexp, 209, 7, 'regc(MAGIC);'),
				new RefItem('Use', 'C Use', regexp, 226, 7, 'regc(MAGIC);'),
				new RefItem('Use', 'C Use', regexp, 717, 32, 'if (UCHARAT(prog->program) != MAGIC) {'),
				new RefItem('Define', 'C Define', regmagic, 4, 8, '#define MAGIC 0234'),
				new RefItem('Use', 'C Use', regsub, 50, 32, 'if (UCHARAT(prog->program) != MAGIC) {'),
			];
		}

		if (element === undefined)
			return [new EntItem('MAGIC', new MarkdownString('```c\n#define MAGIC 0234\n```\n'))];
	}


	getTreeItem(element: Key): TreeItem
	{
		return element;
	}
}


export function handleUnderstandChangedInfo(params: {})
{
	// TODO
	// variables.infoTreeProvider.update(params);
}


type Key = TreeItem;


type Position = {
	uri: string,
	line: number,
	character: number,
};


type Field = {
	label: string,
	description?: string,
	tooltip?: string,
	position?: Position,
	iconName?: string,
	children?: [],
};


class ApiGroupItem extends TreeItem
{
	constructor()
	{
		super('API Info', TreeItemCollapsibleState.Expanded);

		this.iconPath = new ThemeIcon('beaker');
	}
}


class EntItem extends TreeItem
{
	constructor(name: string, hover: MarkdownString)
	{
		super(name, TreeItemCollapsibleState.Expanded);

		this.tooltip = hover;
	}
}


class RefGroupItem extends TreeItem
{
	constructor()
	{
		super('References', TreeItemCollapsibleState.Expanded);

		this.iconPath = new ThemeIcon('symbol-reference');
	}
}


class RefItem extends TreeItem
{
	constructor(shortKind: string, longKind: string, uri: Uri, line: number, column: number, snippet: string)
	{
		super(shortKind);

		type OpenArgs = [Uri, TextDocumentShowOptions];

		const openArgs: OpenArgs = [
			uri,
			{ selection: new vscode.Range(line, column, line, column) },
		];

		this.command = {
			title: `Go to ${shortKind}`,
			command: 'vscode.open',
			arguments: openArgs,
		};

		line += 1;
		column += 1;

		// @ts-ignore this matches all input strings
		const filename = /[^/]*$/.exec(uri.toString())[0];
		this.description = `• ${line} • ${filename}`;

		this.tooltip = new MarkdownString(`${longKind} • ${line} • ${column} • ${uri.fsPath}\n\n\`\`\`c\n${snippet}\n\`\`\``)
	}
}


class SimpleItem extends TreeItem
{
	constructor(key: string, value: string)
	{
		super(key);

		this.description = value;

		this.tooltip = new MarkdownString(`\`${key}\`\n\n\`${value}\``)
	}
}
