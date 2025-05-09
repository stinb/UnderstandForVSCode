'use strict';


import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { variables } from '../other/variables';


interface AiAnnotation
{
	body: string,
	id: string,
	position: string,
}


interface AiParams
{
	annotations: AiAnnotation[],
	focused: string,
}


interface Message
{
	method: string,
	id?: string,
	body?: string,
}


export class AiViewProvider implements vscode.WebviewViewProvider
{
	private annotations: AiAnnotation[] = [];
	private uriScript: string;
	private uriStyle: string;
	private uriStyleIcons: string;
	private view: vscode.Webview;


	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken)
	{
		webviewView.webview.options = {
			enableCommandUris: false,
			enableForms: false,
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
			portMapping: [],
		};
		this.uriScript = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'ai.js')).toString();
		this.uriStyle = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.css')).toString();
		this.uriStyleIcons = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();
		this.view = webviewView.webview;
		this.draw(this.annotations);
	}


	/** Update HTML now or do it after it's created */
	update(annotations: AiAnnotation[])
	{
		if (this.view === undefined) {
			this.annotations = annotations;
		}
		else {
			this.annotations.length = 0;
			this.draw(annotations);
		}
	}


	/** Now that the view exists, draw the annotations */
	private draw(annotations: AiAnnotation[], focused: string = '')
	{
		const htmlParts = [];
		htmlParts.push('<!DOCTYPE html>');
		htmlParts.push('<html data-vscode-context=\'{"preventDefaultContextMenuItems": true}\'>');

		htmlParts.push('<head>');
		const cspSource = escapeHtml(this.view.cspSource);
		htmlParts.push(`<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; font-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource};">`);
		htmlParts.push(`<link rel='stylesheet' href='${escapeHtml(this.uriStyle)}'>`);
		htmlParts.push(`<link rel='stylesheet' href='${escapeHtml(this.uriStyleIcons)}'>`);
		htmlParts.push('</head>');

		htmlParts.push('<body>');

		htmlParts.push('<div>');
		for (const annotation of annotations)
			htmlParts.push(`<div class="ai annotation" id="${escapeHtml(annotation.id)}" tabindex=0 data-vscode-context='{"webviewSection": "annotation", "id": ${JSON.stringify(escapeHtml(annotation.id))}}'><div class='heading'><p><span><b>${escapeHtml(annotation.position)}</b></span></p><button class='codicon codicon-sync'></button></div><code>${escapeHtml(annotation.body)}</code></div>`);
		annotations.length = 0;
		htmlParts.push('</div>');

		// Prevent the last code element from stealing focus
		htmlParts.push('<span class="invisible">_</span>');

		htmlParts.push(`<script src="${escapeHtml(this.uriScript)}"></script>`);

		htmlParts.push('</body>');
		htmlParts.push('</html>');
		this.view.html = htmlParts.join('');

		if (focused)
			this.postMessage({method: 'edit', id: focused});
	}


	private postMessage(message: Message)
	{
		this.view.postMessage(message);
	}
}


/** Tell the AI view to update its HTML */
export function handleUnderstandChangedAi(params: AiParams)
{
	variables.aiViewProvider.update(params.annotations);
}
