import * as vscode from 'vscode';
import { FileChangeType, FileEvent } from 'vscode-languageclient';

import { variables } from './variables';


const DELAY_MILLISECONDS = 250;


let timeout: NodeJS.Timeout | undefined;

const fileSystemChanges: FileEvent[] = [];


/** Handle saving an existing file by telling the language server */
export async function onDidChange(uri: vscode.Uri)
{
	refreshTimeout();
	fileSystemChanges.push({
		uri: uri.toString(),
		type: FileChangeType.Changed,
	});
}


/** Handle creating a new file/folder by telling the language server */
export async function onDidCreate(uri: vscode.Uri)
{
	refreshTimeout();
	fileSystemChanges.push({
		uri: uri.toString(),
		type: FileChangeType.Created,
	});
}


/** Handle deleting a file/folder by telling the language server */
export async function onDidDelete(uri: vscode.Uri)
{
	refreshTimeout();
	fileSystemChanges.push({
		uri: uri.toString(),
		type: FileChangeType.Deleted,
	});
}


/** Send all of the accumulated filesystem changes */
function sendChanges()
{
	// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#workspace_didChangeWatchedFiles
	variables.languageClient.sendNotification('workspace/didChangeWatchedFiles', {
		changes: structuredClone(fileSystemChanges),
	});
	fileSystemChanges.length = 0;
}


/** Start or restart the timer to send filesystem changes */
function refreshTimeout()
{
	if (!timeout)
		timeout = setTimeout(sendChanges, DELAY_MILLISECONDS);
	else
		timeout.refresh();
}
