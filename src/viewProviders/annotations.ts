'use strict';


import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { variables } from '../other/variables';
import { deleteAnnotation } from '../commands/annotations';


interface Annotation
{
	author: string,
	body: string,
	id: string,
	lastModified: string,
	position: string,
}


interface Message
{
	method: string,
	id?: string,
	body?: string,
}


interface AnnotationParams
{
	annotations: Annotation[],
}


export class AnnotationsViewProvider implements vscode.WebviewViewProvider
{
	private annotations: Annotation[] = [];
	private editing: boolean = false;
	private uriScript: string;
	private uriStyle: string;
	private uriStyleIcons: string;
	private view: vscode.Webview;


	edit(id: string)
	{
		this.postMessage({method: 'edit', id: id});
	}


	handleMessage(message: Message)
	{
		switch (message.method) {
			case 'delete':
				deleteAnnotation({id: message.id});
				break;
			case 'finishedEditing':
				this.editing = false;
				variables.languageClient.sendRequest('understand/updateAnnotation', {id: message.id, body: message.body});
				if (this.annotations.length)
					this.draw(this.annotations);
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
		this.uriScript = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.js')).toString();
		this.uriStyle = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.css')).toString();
		this.uriStyleIcons = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();
		this.view = webviewView.webview;
		this.draw(this.annotations);
	}


	/** Update HTML now or do it after it's created */
	update(annotations: Annotation[])
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
	private draw(annotations: Annotation[])
	{
		if (this.editing) {
			this.annotations = annotations;
			return;
		}

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
			htmlParts.push(`<div class=annotation id="${escapeHtml(annotation.id)}" tabindex=0 data-vscode-context='{"webviewSection": "annotation", "id": ${JSON.stringify(escapeHtml(annotation.id))}}'><div class='heading'><p><span><b>${escapeHtml(annotation.position)}</b></span><span>${escapeHtml(annotation.author)}</span><span>${escapeHtml(annotation.lastModified)}</span></p><button class='codicon codicon-more'></button></div><code contenteditable data-vscode-context=\'{"preventDefaultContextMenuItems":false,"webviewSection":"annotationBody"}\'>${escapeHtml(annotation.body)}</code></div>`);
		annotations.length = 0;
		htmlParts.push('</div>');

		// Prevent the last code element from stealing focus
		htmlParts.push('<span class="invisible">_</span>');

		htmlParts.push(`<script src="${escapeHtml(this.uriScript)}"></script>`);

		htmlParts.push('</body>');
		htmlParts.push('</html>');
		this.view.html = htmlParts.join('');
	}


	private postMessage(message: Message)
	{
		this.view.postMessage(message);
	}
}


/** Tell the Annotations view to update its HTML */
export function handleUnderstandChangedAnnotations(params: AnnotationParams)
{
	variables.annotationsViewProvider.update(params.annotations);
}
