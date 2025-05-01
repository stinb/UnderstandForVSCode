'use strict';


import * as vscode from 'vscode';

import { executeCommand } from './helpers';


interface AnnotationContext
{
	id: string,
}


export function deleteAnnotation(context: AnnotationContext)
{
	vscode.window.showInformationMessage(`deleteAnnotation ${context.id}`); // TODO
	// executeCommand('understand.server.annotations.deleteAnnotation');
}


export function editAnnotation(context: AnnotationContext)
{
	vscode.window.showInformationMessage(`editAnnotation ${context.id}`); // TODO
	// executeCommand('understand.server.annotations.editAnnotation');
}
