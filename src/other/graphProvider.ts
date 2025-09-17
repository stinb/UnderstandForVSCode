import * as vscode from 'vscode';
import { escapeHtml } from './html';
import { variables } from './variables';
import { GraphMessageToSandbox } from '../types/graph';
import { Option } from '../types/option';


export class GraphProvider {
	private keyToGraph: Map<string, Graph> = new Map;

	private entityName = '';
	private uniqueName = '';


	setEntity(entityName: string, uniqueName: string)
	{
		this.entityName = entityName;
		this.uniqueName = uniqueName;
	}


	view(graphName: string)
	{
		const key = this.toKey(graphName, this.uniqueName);
		const graph = this.keyToGraph.get(key);
		if (graph)
			graph.focus();
		else
			this.keyToGraph.set(key, new Graph(graphName, this.uniqueName, this.entityName));
	}


	remove(graphName: string, uniqueName: string)
	{
		this.keyToGraph.delete(this.toKey(graphName, uniqueName));
	}


	update(graphName: string, uniqueName: string, svg: string, options: Option[])
	{
		const graph = this.keyToGraph.get(this.toKey(graphName, uniqueName));
		if (!graph)
			return;
		graph.update(svg, options);
	}


	private toKey(graphName: string, uniqueName: string)
	{
		return `${graphName} ${uniqueName}`;
	}
}


export function handleUnderstandGraphsDrew(params: Params)
{
	variables.graphProvider.update(params.graphName, params.uniqueName, params.svg, params.options);
}


type Params = {
	graphName: string,
	uniqueName: string,
	svg: string,
	options: Option[],
}


class Graph {
	private panel: vscode.WebviewPanel;

	private graphName: string;
	private uniqueName: string;


	constructor(graphName: string, uniqueName: string, entityName: string)
	{
		this.graphName = graphName;
		this.uniqueName = uniqueName;

		variables.languageClient.sendNotification('understand/graphs/draw', { graphName, uniqueName });

		this.panel = vscode.window.createWebviewPanel(
			'understandGraph',
			`${graphName}: ${entityName}`,
			vscode.ViewColumn.Active,
			{
				enableCommandUris: false,
				enableForms: false,
				enableScripts: true,
				localResourceRoots: [variables.extensionUri],
				portMapping: [],
				retainContextWhenHidden: true,
			},
		);

		this.panel.onDidDispose(() => {
			variables.graphProvider.remove(this.graphName, this.uniqueName);
		});

		const webview = this.panel.webview;

		const cspSource = escapeHtml(webview.cspSource);
		const uriScript = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'graph.js')).toString();
		const uriStyle = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'graph.css')).toString();
		const uriStyleIcons = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();

		webview.html =
			`<!DOCTYPE html>
<html>
<head>
	<meta http-equiv='Content-Security-Policy' content="default-src 'none'; font-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource};">
	<link rel='stylesheet' href='${escapeHtml(uriStyle)}'>
	<link rel='stylesheet' href='${escapeHtml(uriStyleIcons)}'>
</head>

<body>
	<main id='main' tabindex='0'>
		<div id='graphContainer'>
			<p id='loader'>Loading</p>
		</div>
	</main>

	<aside>
		<div id='options'></div>
	</aside>

	<script src='${escapeHtml(uriScript)}'></script>
</body>
</html>`;
	}


	focus()
	{
		this.panel.reveal();
	}


	update(svg: string, options: Option[])
	{
		this.postMessage({
			method: 'update',
			options: options,
			svg: svg,
		});
	}


	private postMessage(message: GraphMessageToSandbox)
	{
		this.panel.webview.postMessage(message);
	}
}
