import * as vscode from 'vscode';

import { executeAtPosition, executeCommand } from './helpers';


/** Explore current file in Understand */
export function currentFile()
{
	executeAtPosition('understand.server.exploreInUnderstand.currentFile');
}


/** Create a new project in Understand using the only directory or a prompt */
export async function newProject()
{
	// Get the folder or fail
	const uris = await vscode.window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: vscode.l10n.t('Select'),
		title: vscode.l10n.t('Root directory of your source code'),
	});
	if (!uris || uris.length !== 1)
		return;

	// Ask userver to open Understand
	executeCommand('understand.server.exploreInUnderstand.newProject', [uris[0].toString()]);
}
