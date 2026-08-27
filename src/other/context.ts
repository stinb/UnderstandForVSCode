import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { changeFileStatus, FileStatus } from './statusBar';
import { focusedUniqueName } from './sync';


export const contexts = {
	project: 'understandProject',
	file: 'understandFile',
};


const DELAY_MILLISECONDS = 100;


let preserveView = '';
let selectionTimeout: NodeJS.Timeout | undefined;

// The last file status request by URI: the status only changes when the file,
// the analysis, or the disk changes — not on every cursor move. Caching the
// promise also collapses concurrent requests for the same file into one.
let cachedStatusUri = '';
let cachedStatus: Promise<FileStatus | null> | undefined;


/** Forget the cached file status (the analysis or a file changed) */
export function invalidateFileStatus()
{
	cachedStatusUri = '';
	cachedStatus = undefined;
}


/** When the text cursor moves, notify the server */
export function actuallyChangedTextEditorSelection()
{
	preserveView = variables.preserveView;

	if (!selectionTimeout)
		selectionTimeout = setTimeout(sendSelection, DELAY_MILLISECONDS);
	else
		selectionTimeout.refresh();
}


export function onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent)
{
	// Filter out the "Output" view which spams this event
	if (event.textEditor.document.uri.scheme === 'output')
		return;
	actuallyChangedTextEditorSelection();
}


/** Enable/disable a context, which can enable/disable commands in package.json */
export async function setContext(name: string, enabled: boolean)
{
	setContextImpl(name, enabled);

	// If the project context was set, then set the file context also
	if (name === contexts.project) {
		const editor = vscode.window.activeTextEditor;
		if (enabled && editor)
			await updateFileStatus(editor.document.uri, setContextImpl);
		else {
			setContextImpl(contexts.file, false);
			changeFileStatus(undefined);
		}
	}
}


/** When the editor changes, tell the server */
async function sendSelection()
{
	const editor = vscode.window.activeTextEditor;

	if (!editor || !editor.selections.length || editor.document.uri.scheme !== 'file') {
		setContext(contexts.file, false);
		changeFileStatus(undefined);
		const uniqueName = focusedUniqueName();
		variables.languageClient.sendNotification('understand/sync', { uniqueName });
		return;
	}

	const position = editor.selections[0].active;

	variables.languageClient.sendNotification('understand/sync', {
		uri: editor.document.uri.toString(),
		line: position.line,
		character: position.character,
		preserve: preserveView,
	});

	await updateFileStatus(editor.document.uri, setContext);
}


/** Get the file status from the server: set the file context and status bar */
async function updateFileStatus(uri: vscode.Uri, setFileContext: (name: string, enabled: boolean) => void)
{
	const key = uri.toString();
	if (key !== cachedStatusUri || cachedStatus === undefined) {
		cachedStatusUri = key;
		cachedStatus = variables.languageClient.sendRequest('understand/fileStatus', {
			uri: key,
		});
	}
	const status = await cachedStatus;
	setFileContext(contexts.file, status !== null && status.resolved);
	changeFileStatus(status ?? undefined);
}


/** Actually set the context */
function setContextImpl(name: string, enabled: boolean)
{
	vscode.commands.executeCommand('setContext', name, enabled || undefined);
}
