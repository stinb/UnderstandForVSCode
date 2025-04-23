'use strict';


import * as vscode from 'vscode';

import { variables } from './variables';


export const URI_SCHEME_VIOLATION_DESCRIPTION = 'understand-violation-description';


/** Get a violation description */
export class ViolationDescriptionProvider implements vscode.TextDocumentContentProvider
{
	provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string>
	{
		return getViolationDescription(uri.path, token);
	}
}


/** Get a violation description */
export async function getViolationDescription(id: string, token?: vscode.CancellationToken): Promise<string>
{
	return variables.languageClient.sendRequest('understand/violationDescription', {id: id}, token)
		.then(result => (typeof(result) === 'string' && result.length) ? result : 'ERROR: no description found')
		.catch(error => `ERROR: ${error}`);
}
