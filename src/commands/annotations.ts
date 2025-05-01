'use strict';


import * as vscode from 'vscode';

import { variables } from '../other/variables';


// Created in JSON in the `data-vscode-context` attribute in
// - `AnnotationsViewProvider.draw`
interface AnnotationContext
{
	id: string,
}


export function deleteAnnotation(context: AnnotationContext)
{
	vscode.window.showWarningMessage(
		'Delete annotation', {modal: true}, 'Delete'
	).then(choice => {
		if (choice === 'Delete')
			variables.languageClient.sendRequest('understand/deleteAnnotation', {id: context.id});
	});
}


export function startEditingAnnotation(context: AnnotationContext)
{
	variables.annotationsViewProvider.edit(context.id);
}
