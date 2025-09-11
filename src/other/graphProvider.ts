import * as vscode from 'vscode';
import { escapeHtml } from './html';
import { variables } from './variables';
import { GraphMessageToSandbox } from '../types/graph';


export class GraphProvider
{
	private keyToGraph: Map<string, Graph> = new Map;

	uniqueName = '';


	setEntity(uniqueName: string)
	{
		this.uniqueName = uniqueName;
	}


	view(graphName: string)
	{
		const key = this.toKey(graphName, this.uniqueName);
		const graph = this.keyToGraph.get(key);
		if (graph)
			graph.focus();
		else
			this.keyToGraph.set(key, new Graph(graphName, this.uniqueName));
	}


	update(graphName: string, uniqueName: string, svg: string)
	{
		const graph = this.keyToGraph.get(this.toKey(graphName, uniqueName));
		if (!graph)
			return;
		graph.update(svg);
	}


	private toKey(graphName: string, uniqueName: string)
	{
		return `${graphName} ${uniqueName}`;
	}
}


export function handleUnderstandGraphsDrew(params: Params)
{
	variables.graphProvider.update(params.graphName, params.uniqueName, params.svg);
}


type Params = {
	graphName: string,
	uniqueName: string,
	svg: string,
}


class Graph
{
	private panel: vscode.WebviewPanel;


	constructor(graphName: string, uniqueName: string)
	{
		variables.languageClient.sendNotification('understand/graphs/draw', {graphName, uniqueName});

		this.panel = vscode.window.createWebviewPanel(
			'understandGraph',
			`Graph - ${graphName}`,
			vscode.ViewColumn.Active,
		);

		const webview = this.panel.webview;

		const cspSource = escapeHtml(webview.cspSource);
		const uriScript = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'graph.js')).toString();
		const uriStyle = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'graph.css')).toString();

		webview.options = {
			enableCommandUris: false,
			enableForms: false,
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
			portMapping: [],
		};

		webview.html =
`<!DOCTYPE html>
<html>
<head>
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource};">
	<link rel='stylesheet' href='${escapeHtml(uriStyle)}'>
</head>

<body>
	<p id='loader'>Loading</p>

	<script src="${escapeHtml(uriScript)}"></script>
</body>
</html>`;
	}


	focus()
	{
		this.panel.reveal();
	}


	update(svg: string)
	{
		this.postMessage({
			method: 'update',
			svg: svg,
		});
	}


	private postMessage(message: GraphMessageToSandbox)
	{
		this.panel.webview.postMessage(message);
	}
}
