'use strict';


import * as vscode from 'vscode';

import { variables } from './variables';


export const URI_SCHEME_VIOLATION_DESCRIPTION = 'understand-violation-description';


/** Get a violation description */
export class ViolationDescriptionProvider implements vscode.TextDocumentContentProvider
{
	onDidChange: vscode.Event<vscode.Uri>;

	private emitter: vscode.EventEmitter<vscode.Uri>;
	private notFoundArray: string[];
	private notFoundSet: Set<string>;

	constructor()
	{
		this.emitter = new vscode.EventEmitter();
		this.notFoundArray = [];
		this.notFoundSet = new Set();
		this.onDidChange = this.emitter.event;
	}

	/** Tell listeners to get the description again */
	handleProjectOpened()
	{
		for (const id of this.notFoundArray) {
			this.emitter.fire(vscode.Uri.from({
				scheme: URI_SCHEME_VIOLATION_DESCRIPTION,
				path: id,
			}));
		}
		this.notFoundArray.length = 0;
		this.notFoundSet.clear();
	}

	provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string>
	{
		return getViolationDescription(uri.path, token).then(result => {
			if (!result.length) {
				const id = uri.path;
				if (!this.notFoundSet.has(id)) {
					this.notFoundSet.add(id);
					this.notFoundArray.push(id);
				}
				return `Failed to preview ${id}`;
			}
			return result;
		});
	}
}


/** Get a violation description */
export async function getViolationDescription(id: string, token?: vscode.CancellationToken): Promise<string>
{
	return variables.languageClient.sendRequest('understand/violationDescription', {id: id}, token)
		.then(result => (typeof(result) === 'string') ? result : '')
		.catch(() => '');
}
