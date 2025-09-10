import * as vscode from 'vscode';
import { escapeHtml } from './html';
import { variables } from './variables';


// TODO follow AiChatProvider
export class GraphProvider
{
	view(name: string)
	{
		const panel = vscode.window.createWebviewPanel(
			'understandGraph',
			`Graph - ${name}`,
			vscode.ViewColumn.Active,
		);

		const webview = panel.webview;

		const cspSource = escapeHtml(webview.cspSource);
		const uriStyle = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'graph.css')).toString();

		webview.options = {
			enableCommandUris: false,
			enableForms: false,
			enableScripts: false,
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
	<svg viewBox='0 0 800 600' xmlns='http://www.w3.org/2000/svg' id='graph'>
		<circle cx='50' cy='50' r='50' fill='#4481b377' />
		<circle cx='100' cy='400' r='50' fill='#4481b377' />
		<circle cx='400' cy='300' r='150' fill='#4481b377' />
		<circle cx='700' cy='100' r='100' fill='#4481b377' />
		<circle cx='50' cy='550' r='50' fill='#4481b377' />
		<circle cx='750' cy='550' r='50' fill='#4481b377' />
	</svg>
</body>
</html>`;
	}
}
