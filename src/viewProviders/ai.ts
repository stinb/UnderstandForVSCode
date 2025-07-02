'use strict';


import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { variables } from '../other/variables';
import { executeCommand } from '../commands/helpers';
import { AnnotationMessage, Section } from './annotationMessage';


type ClearParams = {
  uniqueName: string,
};

type ErrorParams = {
  uniqueName: string,
  text: string,
};

type SectionParams = {
	annotationSections: Section[],
};

type TextParams = {
  uniqueName: string,
  text: string,
};

type TextEndParams = {
  uniqueName: string,
};


export class AiViewProvider implements vscode.WebviewViewProvider
{
	private annotationSections: Section[] = [];
	private uriScriptMarkdown = '';
	private uriScript = '';
	private uriStyle = '';
	private uriStyleIcons = '';
	private view?: vscode.WebviewView;


	postMessage(message: AnnotationMessage)
	{
		if (this.view)
			this.postMessageImpl(this.view.webview, message);
	}


	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken)
	{
		webviewView.onDidChangeVisibility(this.handleChangeVisibility, this);
		webviewView.webview.onDidReceiveMessage(this.handleMessage, this);
		webviewView.webview.options = {
			enableCommandUris: false,
			enableForms: false,
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
			portMapping: [],
		};
		this.uriScriptMarkdown = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'markdown-it.min.js')).toString();
		this.uriScript = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.js')).toString();
		this.uriStyle = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.css')).toString();
		this.uriStyleIcons = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();
		this.view = webviewView;
		this.drawFirst(this.view.webview);
		this.drawUpdate(this.view.webview, this.annotationSections);
	}


	/** Update HTML now or do it after it's created */
	update(annotationSections: Section[])
	{
		if (this.view === undefined || !this.view.visible) {
			this.annotationSections = annotationSections;
		}
		else {
			this.annotationSections.length = 0;
			this.drawUpdate(this.view.webview, annotationSections);
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

		htmlParts.push(`<script src="${escapeHtml(this.uriScriptMarkdown)}"></script>`);
		htmlParts.push(`<script src="${escapeHtml(this.uriScript)}"></script>`);

		htmlParts.push('</body>');
		htmlParts.push('</html>');
		view.html = htmlParts.join('');
	}


	private drawUpdate(view: vscode.Webview, annotationSections: Section[])
	{
		this.postMessageImpl(view, {method: 'drawAi', sections: annotationSections});
		annotationSections.length = 0;
	}


	private handleChangeVisibility()
	{
		if (this.view && this.view.visible)
			this.drawUpdate(this.view.webview, this.annotationSections);
	}


	private handleMessage(message: AnnotationMessage)
	{
		switch (message.method) {
			case 'generateMany':
				executeCommand('understand.server.ai.generateAiOverview', message.uniqueNames);
				break;
			case 'open': {
				const uri: vscode.Uri = vscode.Uri.parse(message.uri);
				if (uri.scheme !== 'file')
					break;
				const position = new vscode.Position(message.line, message.character);
				const options: vscode.TextDocumentShowOptions = {
					selection: new vscode.Selection(position, position),
				};
				vscode.window.showTextDocument(uri, options);
				break;
			}
			case 'regenerate':
				executeCommand('understand.server.ai.generateAiOverview', [message.uniqueName]);
				break;
			case 'startChat':
				variables.aiChatViewProvider.setEntity(message.uniqueName);
				break;
		}
	}


	private postMessageImpl(view: vscode.Webview, message: AnnotationMessage)
	{
		view.postMessage(message);
	}
}


/** Tell the AI view to clear a card */
export function handleUnderstandAiClear(params: ClearParams)
{
	variables.aiViewProvider.postMessage({
		method: 'aiClear',
		uniqueName: params.uniqueName,
	});
}


/** Tell the AI view to clear a card and display the error */
export function handleUnderstandAiError(params: ErrorParams)
{
	variables.aiViewProvider.postMessage({
		method: 'aiError',
		uniqueName: params.uniqueName,
		text: params.text,
	});
}


/** Tell the AI view to clear a card and display the error */
export function handleUnderstandAiText(params: TextParams)
{
	variables.aiViewProvider.postMessage({
		method: 'aiText',
		uniqueName: params.uniqueName,
		text: params.text,
	});
}


/** Tell the AI view to clear a card and display the error */
export function handleUnderstandAiTextEnd(params: TextEndParams)
{
	variables.aiViewProvider.postMessage({
		method: 'aiTextEnd',
		uniqueName: params.uniqueName,
	});
}


/** Tell the AI view to update its HTML */
export function handleUnderstandChangedAi(params: SectionParams)
{
	variables.aiViewProvider.update(params.annotationSections);
}
