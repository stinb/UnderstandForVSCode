import * as vscode from 'vscode';

import { variables } from './variables';


// The views whose content costs the server to build -- a heavily used
// entity's references run to megabytes, a large project's violations to tens
// of megabytes, and the metrics are worked out on a thread. The server skips
// them while they are hidden and brings them up to date when they show
// (Rob 2026-10-28).
const watched = new Map<string, vscode.TreeView<unknown>>();


export function watchVisibility(name: string, view: vscode.TreeView<unknown>)
{
	watched.set(name, view);
	view.onDidChangeVisibility(event => send(name, event.visible));
}


/** Tell a server that just started which of the views are showing */
export function reportVisibility()
{
	watched.forEach((view, name) => send(name, view.visible));
}


function send(view: string, visible: boolean)
{
	const client = variables.languageClient;
	if (client?.isRunning())
		client.sendNotification('understand/views/visibility', { view, visible });
}
