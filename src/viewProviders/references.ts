import * as vscode from 'vscode';
import {
	EventEmitter,
	MarkdownString,
	ProviderResult,
	TextDocumentShowOptions,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri
} from 'vscode';
import { variables } from '../other/variables';


export class ReferencesTreeProvider implements TreeDataProvider<Key>
{
	private emitter = new EventEmitter<void>();
	onDidChangeTreeData = this.emitter.event;


	getChildren(element?: Key): ProviderResult<TreeItem[]>
	{
		if (element instanceof EntItem) {
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
			return [new EntItem('MAGIC', 'Macro', '@lMAGIC@kc5MAGIC=0234@f./fastgrep/regmagic.h', new MarkdownString('```c\n#define MAGIC 0234\n```\n'))];
	}


	getTreeItem(element: Key): TreeItem
	{
		return element;
	}
}


export function handleUnderstandChangedReferences(params: {})
{
	// TODO
	// variables.infoTreeProvider.update(params);
}


type Key = TreeItem;


class EntItem extends TreeItem
{
	private uniqueName: string;


	constructor(name: string, kind: string, uniqueName: string, hover: MarkdownString)
	{
		super(name, TreeItemCollapsibleState.Expanded);

		this.description = `\u2003${kind}`;
		this.tooltip = hover;
		this.uniqueName = uniqueName;
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
		this.description = `\u2003${filename}\u2003${line}`;

		this.tooltip = new MarkdownString(`${longKind}\u2003${line} ${column}\u2003${uri.fsPath}\n\n\`\`\`c\n${snippet}\n\`\`\``)
	}
}
