import {
	EventEmitter,
	TreeDataProvider,
	TreeItem,
} from 'vscode';
import { variables } from '../other/variables';


export class GraphTreeProvider implements TreeDataProvider<GraphItem>
{
	private children: GraphItem[] = [];
	private emitter = new EventEmitter<void>();

	onDidChangeTreeData = this.emitter.event;


	getChildren(element: GraphItem | undefined): GraphItem[]
	{
		if (element === undefined)
			return this.children;
		return [];
	}


	getTreeItem(element: GraphItem): GraphItem
	{
		return element;
	}


	update(graphs: string[])
	{
		this.children.length = 0;
		for (const name of graphs)
			this.children.push(new GraphItem(name));

		this.emitter.fire();
	}
}


export function handleUnderstandGraphsListed(params: Params)
{
	variables.graphProvider.setEntity(params.entityName, params.uniqueName);
	variables.graphTreeProvider.update(params.graphs);
}


class GraphItem extends TreeItem
{
	constructor(name: string)
	{
		super(name);

		this.command = {
			title: 'Go to Reference',
			command: 'understand.graphs.view',
			arguments: [name],
		};
	}
}


type Params = {
	entityName: string,
	graphs: string[],
	uniqueName: string,
};
