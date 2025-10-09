import * as fsPromises from 'node:fs/promises';

import * as vscode from 'vscode';

import { escapeHtml } from './html';
import { variables } from './variables';
import { GraphMessageFromSandbox, GraphMessageToSandbox } from '../types/graph';
import { Option, OptionIntegerRange } from '../types/option';
import { pathToSave } from './popup';


export class GraphProvider
{
	private keyToGraph: Map<string, Graph> = new Map;

	private entityName = '';
	private focusedGraph?: Graph = undefined;
	private uniqueName = '';


	setEntity(entityName: string, uniqueName: string)
	{
		this.entityName = entityName;
		this.uniqueName = uniqueName;
	}


	setFocusedGraph(graph?: Graph)
	{
		this.focusedGraph = graph;
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
		variables.languageClient.sendRequest('understand/graphs/remove', {
			graphName: graphName,
			uniqueName: uniqueName,
		});
	}


	save()
	{
		if (!this.focusedGraph)
			return;
		this.focusedGraph.save();
	}

	toggleOptions()
	{
		if (!this.focusedGraph)
			return;
		this.focusedGraph.toggleOptions();
	}


	updateGraph(params: ParamsDrew)
	{
		const graph = this.getGraph(params);
		if (!graph)
			return;
		graph.postMessage({
			method: 'updateGraph',
			svg: params.svg,
		});
	}


	updateOptionRanges(params: ParamsOptionRanges)
	{
		const graph = this.getGraph(params);
		if (!graph)
			return;
		graph.postMessage({
			method: 'updateOptionRanges',
			optionRanges: params.optionRanges,
		});
	}


	updateOptions(params: ParamsOptions)
	{
		const graph = this.getGraph(params);
		if (!graph)
			return;
		graph.postMessage({
			method: 'updateOptions',
			options: params.options,
		});
	}


	private getGraph(params: ParamsDrew | ParamsOptionRanges | ParamsOptions): Graph | undefined
	{
		const result = this.keyToGraph.get(this.toKey(params.graphName, params.uniqueName));
		if (!result)
			vscode.window.showErrorMessage('Failed to find the graph');
		return result;
	}


	private toKey(graphName: string, uniqueName: string)
	{
		return `${graphName} ${uniqueName}`;
	}
}


export function handleUnderstandGraphsDrew(params: ParamsDrew)
{
	variables.graphProvider.updateGraph(params);
}


export function handleUnderstandGraphsOptionRanges(params: ParamsOptionRanges)
{
	variables.graphProvider.updateOptionRanges(params);
}


export function handleUnderstandGraphsOptions(params: ParamsOptions)
{
	variables.graphProvider.updateOptions(params);
}


type ParamsDrew = {
	graphName: string,
	uniqueName: string,
	svg: string,
}

type ParamsOptions = {
	graphName: string,
	uniqueName: string,
	options: Option[],
}

type ParamsOptionRanges = {
	graphName: string,
	uniqueName: string,
	optionRanges: OptionIntegerRange[],
}


class Graph
{
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
				enableFindWidget: true,
				enableForms: false,
				enableScripts: true,
				localResourceRoots: [variables.extensionUri],
				portMapping: [],
				retainContextWhenHidden: true,
			},
		);

		this.panel.onDidChangeViewState((e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
			if (!this.panel.active) {
				variables.graphProvider.setFocusedGraph();
				return;
			}
			variables.graphProvider.setFocusedGraph(this);
			variables.languageClient.sendNotification('understand/graphs/focused', {
				uniqueName: this.uniqueName,
			});
		});

		this.panel.onDidDispose(() => {
			variables.graphProvider.remove(this.graphName, this.uniqueName);
		});

		const webview = this.panel.webview;

		const cspSource = escapeHtml(webview.cspSource);
		const uriScript = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'graph.js')).toString();
		const uriStyle = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'graph.css')).toString();
		const uriStyleIcons = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();

		webview.onDidReceiveMessage(this.handleMessage, this);

		webview.html =
`<!DOCTYPE html>
<html>
<head>
	<meta http-equiv='Content-Security-Policy' content="default-src 'none'; img-src data:; font-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource};">
	<link rel='stylesheet' href='${escapeHtml(uriStyle)}'>
	<link rel='stylesheet' href='${escapeHtml(uriStyleIcons)}'>
</head>

<body data-vscode-context='{"preventDefaultContextMenuItems":true}'>
	<main id='main' tabindex='0'>
		<div id='graphContainer'>
			<span class='codicon codicon-loading codicon-modifier-spin'></span>
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


	handleMessage(message: GraphMessageFromSandbox)
	{
		switch (message.method) {
			case 'changedOption':
				variables.languageClient.sendNotification('understand/graphs/draw', {
					graphName: this.graphName,
					optionId: message.id,
					optionValue: message.value,
					uniqueName: this.uniqueName,
				});
				break;
			case 'saveBase64':
				saveFile(message.path, Buffer.from(message.content, 'base64'));
				break;
			case 'saveString':
				saveFile(message.path, message.content);
				break;
		}
	}


	async save()
	{
		const result = await pathToSave(['svg', 'jpg', 'png']);
		if (!result)
			return;

		const extension = result.extension;
		const path = result.uri.fsPath;

		switch (extension) {
			case 'jpg': case 'png': case 'svg':
				break;
			default:
				return;
		}

		return this.postMessage({method: 'convert', extension, path});
	}


	toggleOptions()
	{
		this.postMessage({ method: 'toggleOptions' });
	}


	postMessage(message: GraphMessageToSandbox)
	{
		this.panel.webview.postMessage(message);
	}
}


async function saveFile(path: string, content: string | Buffer)
{
	try {
		const file = await fsPromises.open(path, 'w');
		// @ts-ignore write accepts string, Buffer, and other types
		await file.write(content);
		await file.close();
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to save graph "${path}": ${error}`);
	}
}
