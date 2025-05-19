'use strict';


import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { variables } from '../other/variables';
import { deleteAnnotation } from '../commands/annotations';
import { Message } from './message';


interface Annotation
{
	author: string,
	body: string,
	focused: boolean,
	id: string,
	lastModified: string,
	positionTitle: string,
}


interface AnnotationParams
{
	annotations: Annotation[],
	focused: string,
}


export class AnnotationsViewProvider implements vscode.WebviewViewProvider
{
	private annotations: Annotation[] = [];
	private editing = false;
	private uriScriptMarkdown = '';
	private uriScript = '';
	private uriStyle = '';
	private uriStyleIcons = '';
	private view?: vscode.Webview;


	edit(id: string)
	{
		if (!this.view)
			return;

		const message = {method: 'edit', id: id};
		this.view.postMessage(message);
	}


	handleMessage(message: Message)
	{
		switch (message.method) {
			case 'delete':
				deleteAnnotation({id: message.id});
				break;
			case 'error':
				vscode.window.showErrorMessage(message.body);
				break;
			case 'finishedEditing':
				this.editing = false;
				variables.languageClient.sendRequest('understand/updateAnnotation', {id: message.id, body: message.body});
				if (this.annotations.length && this.view)
					this.draw(this.view, this.annotations);
				break;
			case 'startedEditing':
				this.editing = true;
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
		this.uriScriptMarkdown = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'markdown-it.min.js')).toString();
		this.uriScript = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.js')).toString();
		this.uriStyle = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.css')).toString();
		this.uriStyleIcons = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();
		this.view = webviewView.webview;
		this.draw(this.view, this.annotations);
	}


	/** Update HTML now or do it after it's created */
	update(annotations: Annotation[], focused: string)
	{
		if (this.view === undefined) {
			this.annotations = annotations;
		}
		else {
			this.annotations.length = 0;
			this.draw(this.view, annotations, focused);
		}
	}


	/** Now that the view exists, draw the annotations */
	private draw(view: vscode.Webview, annotations: Annotation[], focused: string = '')
	{
		if (this.editing) {
			this.annotations = annotations;
			return;
		}

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
		for (const annotation of annotations)
			htmlParts.push(`<div class=annotation id="${escapeHtml(annotation.id)}" tabindex=0 data-vscode-context='{"webviewSection": "annotation", "id": ${JSON.stringify(escapeHtml(annotation.id))}}'><div class='cardHeader'><p><span><b>${escapeHtml(annotation.positionTitle)}</b></span></p><p><span>${escapeHtml(annotation.author)}</span><span>${escapeHtml(annotation.lastModified)}</span><button class='more codicon codicon-more'></button></p></div><code class='body' contenteditable data-vscode-context=\'{"preventDefaultContextMenuItems":false,"webviewSection":"annotationBody"}\'>${escapeHtml(annotation.body)}</code></div>`);
		annotations.length = 0;
		htmlParts.push('</div>');

		// Prevent the last code element from stealing focus
		htmlParts.push('<span class="invisible">_</span>');

		htmlParts.push(`<script src="${escapeHtml(this.uriScriptMarkdown)}"></script>`);
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


/** Tell the Annotations view to update its HTML */
export function handleUnderstandChangedAnnotations(params: AnnotationParams)
{
	variables.annotationsViewProvider.update(params.annotations, params.focused);
}
