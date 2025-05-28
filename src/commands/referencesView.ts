import * as vscode from 'vscode';

import { getBooleanFromConfig } from '../other/config';
import { variables } from '../other/variables';
import { EntItem } from '../viewProviders/references';


export function collapse()
{
	variables.referencesTreeProvider.collapse();
}


export function dismissEntity(entItem: EntItem)
{
	variables.languageClient.sendNotification('understand/references/dismiss', {uniqueName: entItem.uniqueName});
}


export function expand()
{
	variables.referencesTreeProvider.expand();
}


export function goToReference(uri: vscode.Uri, line: number, column: number)
{
	vscode.window.showTextDocument(uri, {
		preserveFocus: getBooleanFromConfig('understand.referencesView.preserveFocus', true),
		selection: new vscode.Range(line, column, line, column),
	});
}


export function pinEntity()
{
	variables.languageClient.sendNotification('understand/references/pin');
}
