'use strict';


import * as vscode from 'vscode';

import { URI_SCHEME_VIOLATION_DESCRIPTION } from './textProviders';


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


/** Opens a URI */
export class UnderstandUriHandler implements vscode.UriHandler
{
	handleUri(uri: vscode.Uri): vscode.ProviderResult<void>
	{
		switch (getCollection(uri)) {
			case 'violation-descriptions':
				violationDescription(getId(uri));
				break;
		}
	}
}


async function violationDescription(id: string)
{
	// Show markdown
	const editor = await vscode.window.showTextDocument(vscode.Uri.from({
		scheme: URI_SCHEME_VIOLATION_DESCRIPTION,
		path: id,
	}));
	await vscode.languages.setTextDocumentLanguage(editor.document, 'markdown');

	// Show markdown preview instead
	try {
		await vscode.commands.executeCommand('markdown.showPreview');
	} catch (error) {
		return;
	}
	await vscode.window.showTextDocument(editor.document);
	vscode.commands.executeCommand('workbench.action.closeActiveEditor');
}
