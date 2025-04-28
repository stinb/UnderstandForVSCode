'use strict';


import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { variables } from '../other/variables';


interface Annotation
{
	author: string,
	body: string,
	id: string,
	lastModified: string,
	position: string,
}


interface AnnotationParams
{
	annotations: Annotation[],
}


export class AnnotationsViewProvider implements vscode.WebviewViewProvider
{
	private annotations: Annotation[] = [];
	private script: string;
	private style: string;
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
		this.script = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.js')).toString();
		this.style = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.css')).toString();
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
		// TODO more button icon https://github.com/microsoft/vscode/issues/95199
		const htmlParts = [];
		htmlParts.push('<!DOCTYPE html>');
		htmlParts.push('<html data-vscode-context=\'{"preventDefaultContextMenuItems": true}\'>');
		htmlParts.push('<head>');
		const cspSource = escapeHtml(this.view.cspSource);
		htmlParts.push(`<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src ${cspSource}; style-src ${cspSource};">`);
		htmlParts.push(`<link rel='stylesheet' href='${escapeHtml(this.style)}'>`);
		htmlParts.push('</head>');
		htmlParts.push('<body>');
		for (const annotation of annotations)
			htmlParts.push(`<div class=annotation tabindex=0 data-vscode-context='{"webviewSection": "annotation", "id": ${JSON.stringify(escapeHtml(annotation.id))}}'><div class='heading'><p><span><b>${escapeHtml(annotation.position)}</b></span><span>${escapeHtml(annotation.author)}</span><span>${escapeHtml(annotation.lastModified)}</span></p><button role='Annotation Actions'>...</button></div><p>${escapeHtml(annotation.body)}</p></div>`);
		annotations.length = 0;
		htmlParts.push(`<script src="${escapeHtml(this.script)}"></script>`);
		htmlParts.push('</body>');
		htmlParts.push('</html>');
		this.view.html = htmlParts.join('');
	}
}


/** Tell the Annotations view to update its HTML */
export function handleUnderstandChangedAnnotations(params: AnnotationParams)
{
	variables.annotationsViewProvider.update(params.annotations);
}
