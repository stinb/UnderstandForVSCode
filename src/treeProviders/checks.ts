import {
	EventEmitter,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
} from 'vscode';
import { variables } from '../other/variables';


export class CheckTreeProvider implements TreeDataProvider<ConfigItem | CheckItem>
{
	private children: ConfigItem[] = [];
	private emitter = new EventEmitter<void>();

	onDidChangeTreeData = this.emitter.event;


	getChildren(element: ConfigItem | CheckItem | undefined): (ConfigItem | CheckItem)[]
	{
		if (element === undefined)
			return this.children;
		if (element instanceof ConfigItem)
			return element.children;
		return [];
	}


	getTreeItem(element: ConfigItem | CheckItem): TreeItem
	{
		return element;
	}


	update(configs: Config[])
	{
		this.children.length = 0;
		for (const config of configs)
			this.children.push(new ConfigItem(config));

		this.emitter.fire();
	}
}


export function handleUnderstandChecksListed(params: Params)
{
	variables.checkTreeProvider.update(params.configs);
}


export class ConfigItem extends TreeItem
{
	children: CheckItem[];

	constructor(config: Config)
	{
		super(config.name, TreeItemCollapsibleState.Expanded);

		this.contextValue = 'understandCheckConfig';
		const checkCount = `${config.checks.length} ${config.checks.length === 1 ? 'check' : 'checks'}`;
		this.description = config.automatic ? ` ${checkCount}, runs in the background` : ` ${checkCount}`;

		this.children = config.checks.map(check => new CheckItem(check));
	}
}


export class CheckItem extends TreeItem
{
	// Not TreeItem.id: the same check may appear in multiple configs, and
	// TreeItem.id must be unique across the whole tree
	checkId: string;

	constructor(check: Check)
	{
		super(check.name);

		this.contextValue = 'understandCheck';
		this.tooltip = `ID: ${check.id} — click for the detailed description`;
		this.command = {
			command: 'understand.checks.showDescription',
			title: 'Show Check Description',
			arguments: [check.id],
		};

		this.checkId = check.id;
	}
}


type Params = {
	configs: Config[],
};


type Config = {
	name: string,
	automatic: boolean,
	checks: Check[],
};


type Check = {
	id: string,
	name: string,
};
