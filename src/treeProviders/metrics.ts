import {
	EventEmitter,
	TreeDataProvider,
	TreeItem,
} from 'vscode';
import { variables } from '../other/variables';


export class MetricTreeProvider implements TreeDataProvider<MetricItem>
{
	private children: MetricItem[] = [];
	private emitter = new EventEmitter<void>();

	onDidChangeTreeData = this.emitter.event;


	getChildren(element: MetricItem | undefined): MetricItem[]
	{
		if (element === undefined)
			return this.children;
		return [];
	}


	getTreeItem(element: MetricItem): MetricItem
	{
		return element;
	}


	update(metrics: Metric[])
	{
		this.children.length = 0;
		for (const metric of metrics)
			this.children.push(new MetricItem(metric));

		this.emitter.fire();
	}
}


export function handleUnderstandMetricsListed(params: Params)
{
	variables.metricTreeProvider.update(params.metrics);
}


export class MetricItem extends TreeItem
{
	id: string;
	name: string;
	value: string;

	constructor(metric: Metric)
	{
		super(metric.name);

		this.contextValue = 'understandMetric';
		this.description = `\u2003${metric.value}`;
		this.tooltip = `API Name: ${metric.id}`;

		this.id = metric.id;
		this.name = metric.name;
		this.value = metric.value;
	}
}


type Params = {
	metrics: Metric[],
};


type Metric = {
	id: string,
	name: string,
	value: string,
};
