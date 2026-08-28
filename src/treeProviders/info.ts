import {
	EventEmitter,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
} from 'vscode';
import { variables } from '../other/variables';


// The Info view (ext #47): the current entity the way a Python API script
// reads it -- ent.id, ent.kindname, ent.uniquename, and the rest -- pushed
// by understand/info whenever the synced entity changes. References
// deliberately live in the References view, not here.
export class InfoTreeProvider implements TreeDataProvider<EntItem | AttributeItem>
{
	private entityName = '';
	private attributes: Attribute[] = [];
	private emitter = new EventEmitter<void>();

	onDidChangeTreeData = this.emitter.event;


	getChildren(element: EntItem | AttributeItem | undefined): (EntItem | AttributeItem)[]
	{
		if (element === undefined)
			return this.entityName ? [new EntItem(this.entityName)] : [];
		if (element instanceof EntItem)
			return this.attributes.map(a => new AttributeItem(a));
		return [];
	}


	getTreeItem(element: EntItem | AttributeItem): TreeItem
	{
		return element;
	}


	update(params: Params)
	{
		this.entityName = params.entityName;
		this.attributes = params.attributes;
		this.emitter.fire();
	}
}


export function handleUnderstandInfo(params: Params)
{
	variables.infoTreeProvider.update(params);
}


class EntItem extends TreeItem
{
	constructor(name: string)
	{
		super(name, TreeItemCollapsibleState.Expanded);
		this.contextValue = 'understandInfoEntity';
		this.iconPath = new ThemeIcon('symbol-object');
	}
}


class AttributeItem extends TreeItem
{
	constructor(attribute: Attribute)
	{
		super(attribute.name);
		this.contextValue = 'understandInfoAttribute';
		this.description = attribute.value;
		// Long values (uniquename) elide in the row; the tooltip has it all.
		this.tooltip = `${attribute.name}: ${attribute.value}`;
	}
}


type Params = {
	entityName: string,
	attributes: Attribute[],
};


type Attribute = {
	name: string,
	value: string,
};
