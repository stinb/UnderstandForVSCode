import {
	EventEmitter,
	TreeDataProvider,
	TreeItem,
} from 'vscode';
import { variables } from '../other/variables';
import { changeEntityStatus } from '../other/statusBar';
import { nameEntityInHeaders } from '../other/entityHeaders';


// The Info view (ext #47): the current entity the way a Python API script
// reads it -- ent.id, ent.kindname, ent.uniquename, and the rest -- pushed
// by understand/info whenever the synced entity changes. References
// deliberately live in the References view, not here. The view's header
// names the entity, so its rows are the attributes alone (Rob, 2026-10-20).
export class InfoTreeProvider implements TreeDataProvider<AttributeItem>
{
	private attributes: Attribute[] = [];
	private emitter = new EventEmitter<void>();

	onDidChangeTreeData = this.emitter.event;


	getChildren(element: AttributeItem | undefined): AttributeItem[]
	{
		return element === undefined ? this.attributes.map(a => new AttributeItem(a)) : [];
	}


	getTreeItem(element: AttributeItem): TreeItem
	{
		return element;
	}


	update(params: Params)
	{
		this.attributes = params.attributes;
		this.emitter.fire();
	}
}


export function handleUnderstandInfo(params: Params)
{
	variables.infoTreeProvider.update(params);
	nameEntityInHeaders(params.entityName);
	changeEntityStatus(params.entityName);
}


class AttributeItem extends TreeItem
{
	constructor(attribute: Attribute)
	{
		// The colon belongs in the label, so a row reads the way the API
		// Info report and the hover already do (ext #47).
		super(`${attribute.name}:`);
		this.contextValue = 'understandInfoAttribute';
		this.description = attribute.value;
		// Long values (uniquename) elide in the row; the tooltip has it all,
		// and the note where the value needs one to be read correctly.
		this.tooltip = `${attribute.name}: ${attribute.value}`
			+ (attribute.note ? `\n\n${attribute.note}` : '');
	}
}


type Params = {
	entityName: string,
	attributes: Attribute[],
};


type Attribute = {
	name: string,
	value: string,
	/** Shown under the value in the tooltip, for a value that needs it */
	note?: string,
};
