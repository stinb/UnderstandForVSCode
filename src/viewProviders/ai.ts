'use strict';


import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { variables } from '../other/variables';
import { executeCommand } from '../commands/helpers';


type Card =
{
	body: string,
	id: string,
	position: string,
};


type Section =
{
	name: string,
	cards: Card[],
};


type AiParams =
{
	annotationSections: Section[],
};


export class AiViewProvider implements vscode.WebviewViewProvider
{
	private annotationSections: Section[] = [];
	private uriScript = '';
	private uriStyle = '';
	private uriStyleIcons = '';
	private view?: vscode.Webview;


	handleMessage(message: Message)
	{
		switch (message.method) {
			case 'regenerate':
				executeCommand('understand.server.ai.generateAiOverview', [{uniqueName: message.id}]);
				break;
		}
	}


	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken)
	{
		webviewView.webview.onDidReceiveMessage(this.handleMessage, this);
		webviewView.webview.options = {
			enableCommandUris: false,
			enableForms: false,
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
			portMapping: [],
		};
		this.uriScript = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.js')).toString();
		this.uriStyle = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.css')).toString();
		this.uriStyleIcons = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();
		this.view = webviewView.webview;
		this.drawFirst(this.view);
		this.drawUpdate(this.view, this.annotationSections);
	}


	/** Update HTML now or do it after it's created */
	update(annotationSections: Section[])
	{
		if (this.view === undefined) {
			this.annotationSections = annotationSections;
		}
		else {
			this.annotationSections.length = 0;
			this.drawUpdate(this.view, annotationSections);
		}
	}


	/** Now that the view exists, initialize page */
	private drawFirst(view: vscode.Webview)
	{
		const htmlParts = [];
		htmlParts.push('<!DOCTYPE html>');
		htmlParts.push('<html data-vscode-context=\'{"preventDefaultContextMenuItems": true}\'>');

		htmlParts.push('<head>');
		const cspSource = escapeHtml(view.cspSource);
		htmlParts.push(`<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; font-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource};">`);
		htmlParts.push(`<link rel='stylesheet' href='${escapeHtml(this.uriStyle)}'>`);
		htmlParts.push(`<link rel='stylesheet' href='${escapeHtml(this.uriStyleIcons)}'>`);
		htmlParts.push('</head>');

		htmlParts.push('<body>');

		htmlParts.push('<div id="sections">');
		htmlParts.push('</div>');

		// Prevent the last code element from stealing focus
		htmlParts.push('<span class="invisible">_</span>');

		htmlParts.push(`<script src="${escapeHtml(this.uriScript)}"></script>`);

		htmlParts.push('</body>');
		htmlParts.push('</html>');
		view.html = htmlParts.join('');
	}


	private drawUpdate(view: vscode.Webview, annotationSections: Section[])
	{
		this.postMessage(view, {method: 'drawAi', sections: annotationSections});
		annotationSections.length = 0;
	}


	private postMessage(view: vscode.Webview, message: Message)
	{
		view.postMessage(message);
	}
}


/** Tell the AI view to update its HTML */
export function handleUnderstandChangedAi(params: AiParams)
{
	variables.aiViewProvider.update(params.annotationSections);
}
