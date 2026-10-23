import * as vscode from 'vscode';

import { openGraphWebview } from './graphProvider';
import { variables } from './variables';
import { TreemapData, TreemapMessageFromSandbox, TreemapMessageToSandbox, TreemapRequest } from '../types/graph';


/** The metrics treemap: the server answers understand/graphs/treemap with
 * the tree of sizes and colors (understand/graphs/treemapped), and the
 * webview lays it out. One panel, reused. */
export class TreemapProvider
{
	private panel?: vscode.WebviewPanel;
	private options: TreemapRequest = {};


	show()
	{
		if (this.panel) {
			this.panel.reveal();
			return;
		}

		const panel = openGraphWebview('understandTreemap', 'Metrics Treemap', 'treemap',
`	<div id='crumbs'></div>
	<div id='content'>
		<main id='main'>
			<span class='codicon codicon-loading codicon-modifier-spin'></span>
		</main>
		<aside id='options'></aside>
	</div>
`);
		this.panel = panel;
		panel.onDidDispose(() => {
			this.panel = undefined;
		});
		panel.webview.onDidReceiveMessage(this.handleMessage, this);

		this.request();
	}


	update(data: TreemapData)
	{
		this.postMessage({ method: 'updateTreemap', data });
	}


	private request()
	{
		variables.languageClient.sendNotification('understand/graphs/treemap', this.options);
	}


	private handleMessage(message: TreemapMessageFromSandbox)
	{
		switch (message.method) {
			case 'changedTreemapOptions':
				this.options = { ...this.options, ...message.options };
				this.request();
				break;
			case 'clickedEntity':
				variables.languageClient.sendNotification('understand/sync', { id: message.id });
				break;
		}
	}


	private postMessage(message: TreemapMessageToSandbox)
	{
		this.panel?.webview.postMessage(message);
	}
}


export function handleUnderstandGraphsTreemapped(params: TreemapData)
{
	variables.treemapProvider.update(params);
}
