'use strict';


import * as vscode from 'vscode';

import { variables } from '../other/variables';


interface Annotation
{
	author: string,
	body: string,
	lastModified: string,
}


interface AnnotationParams
{
	annotations: Annotation[],
}


export class AnnotationsViewProvider implements vscode.WebviewViewProvider
{
	private annotations: Annotation[] = [];
	private view: vscode.Webview;


	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken)
	{
		this.view = webviewView.webview;
		this.draw(this.annotations);
		this.annotations.length = 0;
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
		const htmlParts = ['<ul>'];
		for (const annotation of annotations)
			htmlParts.push(`<li><p>${annotation.author}</p><p>${annotation.lastModified}</p><p>${annotation.body}</p></li>`);
		htmlParts.push('</ul>');
		this.view.html = htmlParts.join('');
	}
}


/** Tell the Annotations view to update its HTML */
export function handleUnderstandChangedAnnotations(params: AnnotationParams)
{
	variables.annotationsViewProvider.update(params.annotations);
}
