import * as vscode from 'vscode';

import { showCheck } from '../commands/showCheck';


/** Get the part before the second slash */
export function getCollection(uri: vscode.Uri): string
{
	const match = /^\/([^\/]*)/.exec(uri.path);
	return match ? match[1] : '';
}


/** Get the part after the last slash */
export function getId(uri: vscode.Uri): string
{
	const match = /[^\/]*$/.exec(uri.path);
	return match ? match[0] : '';
}


/**
 * Opens a URI. Every violation the server reports carries
 * vscode://scitools.understand/violation-descriptions/<checkId> as its code
 * link, which VS Code shows in the Problems panel and the diagnostic hover;
 * it opens the check's card.
 */
export class UnderstandUriHandler implements vscode.UriHandler
{
	handleUri(uri: vscode.Uri): vscode.ProviderResult<void>
	{
		switch (getCollection(uri)) {
			case 'violation-descriptions':
				return showCheck(getId(uri));
		}
	}
}
