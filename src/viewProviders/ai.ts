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
		this.draw(this.view, this.annotationSections);
	}


	/** Update HTML now or do it after it's created */
	update(annotationSections: Section[])
	{
		if (this.view === undefined) {
			this.annotationSections = annotationSections;
		}
		else {
			this.annotationSections.length = 0;
			this.draw(this.view, annotationSections);
		}
	}


	/** Now that the view exists, draw the annotations */
	private draw(view: vscode.Webview, annotationSections: Section[], focused: string = '')
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

		htmlParts.push('<div>');
		for (const section of annotationSections) {
			htmlParts.push(`<h4>${escapeHtml(section.name)}</h4>`);
			for (const card of section.cards)
				htmlParts.push(`<div class="ai annotation" id="${escapeHtml(card.id)}" tabindex=0 data-vscode-context='{"webviewSection": "annotation", "id": ${JSON.stringify(escapeHtml(card.id))}}'><div class='heading'><p><span><b>${escapeHtml(card.position)}</b></span></p><button class='regenerate codicon ${card.body ? 'codicon-refresh' : 'codicon-run'}'></button></div>${drawBody(card.body)}</div>`);
		}
		annotationSections.length = 0;
		htmlParts.push('</div>');

		// Prevent the last code element from stealing focus
		htmlParts.push('<span class="invisible">_</span>');

		htmlParts.push(`<script src="${escapeHtml(this.uriScript)}"></script>`);

		htmlParts.push('</body>');
		htmlParts.push('</html>');
		view.html = htmlParts.join('');

		if (focused) {
			const message: Message = {method: 'edit', id: focused};
			view.postMessage(message);
		}
	}
}


/** Tell the AI view to update its HTML */
export function handleUnderstandChangedAi(params: AiParams)
{
	variables.aiViewProvider.update(params.annotationSections);
}


function drawBody(body: string)
{
	return body ? `<code>${escapeHtml(body)}</code>` : '';
}
