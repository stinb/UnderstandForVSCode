import * as vscode from 'vscode';

import { getBooleanFromConfig } from '../other/config';
import { variables } from '../other/variables';


export function collapse()
{
	variables.referencesTreeProvider.collapse();
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
