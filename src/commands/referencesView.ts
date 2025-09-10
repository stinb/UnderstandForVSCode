import * as vscode from 'vscode';

import { getBooleanFromConfig } from '../other/config';
import { variables } from '../other/variables';
import { EntItem } from '../treeProviders/references';


export function dismissEntity(entItem: EntItem)
{
	variables.languageClient.sendNotification('understand/references/dismiss', {uniqueName: entItem.uniqueName});
}


export async function goToReference(uri: vscode.Uri, line: number, column: number)
{
	const preserveFocus = getBooleanFromConfig('understand.referencesView.preserveFocus', true);

	if (preserveFocus)
		variables.preserveView = 'references';

	await vscode.window.showTextDocument(uri, {
		preserveFocus: preserveFocus,
		selection: new vscode.Range(line, column, line, column),
	});

	variables.preserveView = '';
}


export function pinEntity()
{
	variables.languageClient.sendNotification('understand/references/pin');
}
