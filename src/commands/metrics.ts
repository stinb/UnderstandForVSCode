import * as vscode from 'vscode';
import { MetricItem } from '../treeProviders/metrics';


export function copyApiName(item: MetricItem)
{
	vscode.env.clipboard.writeText(`${item.id}`);
}


export function copyFriendlyNameAndValue(item: MetricItem)
{
	vscode.env.clipboard.writeText(`${item.name}: ${item.value}`);
}


export function documentation()
{
	const url = 'https://support.scitools.com/support/solutions/articles/70000582223-what-metrics-does-understand-have-';
	vscode.env.openExternal(vscode.Uri.parse(url));
}
