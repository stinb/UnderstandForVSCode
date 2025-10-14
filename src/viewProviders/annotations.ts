import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { variables } from '../other/variables';
import { deleteAnnotation } from '../commands/annotations';
import {
	AnnotationMessageFromSandbox,
	AnnotationMessageToSandbox,
	Card
} from '../types/annotation';


interface AnnotationParams
{
	annotations: Card[],
	focused: string,
}


export class AnnotationsViewProvider implements vscode.WebviewViewProvider
{
	private annotations: Card[] = [];
	private editing = false;
	private uriScriptMarkdown = '';
	private uriScript = '';
	private uriStyle = '';
	private uriStyleIcons = '';
	private view?: vscode.Webview;
	private viewView?: vscode.WebviewView;


	edit(id: string)
	{
		if (!this.view)
			return;

		const message = {method: 'edit', id: id};
		this.view.postMessage(message);
	}


	handleMessage(message: AnnotationMessageFromSandbox)
	{
		switch (message.method) {
			case 'delete':
				deleteAnnotation({id: message.id});
				break;
			case 'error':
				vscode.window.showErrorMessage(message.body);
				break;
			case 'finishedEditing': {
				this.editing = false;
				for (const annotations of this.annotations) {
					if (annotations.id !== message.id)
						continue;
					annotations.body = message.body;
					const date = new Date;
					annotations.lastModified = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${(date.getDate()).toString().padStart(2, '0')}`;
					break;
				}
				variables.languageClient.sendRequest('understand/updateAnnotation', {id: message.id, body: message.body});
				break;
			}
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
		webviewView.onDidChangeVisibility(this.handleChangeVisibility, this);
		this.uriScriptMarkdown = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'markdown-it.min.js')).toString();
		this.uriScript = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.js')).toString();
		this.uriStyle = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.css')).toString();
		this.uriStyleIcons = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();
		this.view = webviewView.webview;
		this.viewView = webviewView;
		this.draw(this.view);
	}


	/** Update HTML now or do it after it's created */
	update(annotations: Card[], focused: string)
	{
		this.annotations = annotations;
		if (this.view !== undefined)
			this.draw(this.view, focused);
	}


	/** Now that the view exists, draw the annotations */
	private draw(view: vscode.Webview, focused: string = '')
	{
		if (this.editing)
			return;

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
		for (const annotation of this.annotations)
			htmlParts.push(`<div class=annotation id="${escapeHtml(annotation.id)}" tabindex=0 data-vscode-context='{"webviewSection": "annotation", "id": ${JSON.stringify(escapeHtml(annotation.id))}}'><div class='cardHeader'><p><span><b>${escapeHtml(annotation.positionTitle)}</b></span></p><p><span>${escapeHtml(annotation.author)}</span><span>${escapeHtml(annotation.lastModified)}</span><button class='more codicon codicon-more'></button></p></div><code class='body' contenteditable data-vscode-context=\'{"preventDefaultContextMenuItems":false,"webviewSection":"annotationBody"}\'>${escapeHtml(annotation.body)}</code></div>`);
		htmlParts.push('</div>');

		// Prevent the last code element from stealing focus
		htmlParts.push('<span class="invisible">_</span>');

		htmlParts.push(`<script src="${escapeHtml(this.uriScriptMarkdown)}"></script>`);
		htmlParts.push(`<script src="${escapeHtml(this.uriScript)}"></script>`);

		htmlParts.push('</body>');
		htmlParts.push('</html>');
		view.html = htmlParts.join('');

		if (focused) {
			const message: AnnotationMessageToSandbox = {method: 'edit', id: focused};
			view.postMessage(message);
		}
	}


	private handleChangeVisibility()
	{
		if (this.view && this.viewView && this.viewView.visible)
			this.draw(this.view);
	}
}


/** Tell the Annotations view to update its HTML */
export function handleUnderstandChangedAnnotations(params: AnnotationParams)
{
	variables.annotationsViewProvider.update(params.annotations, params.focused);
}
