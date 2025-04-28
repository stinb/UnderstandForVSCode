'use strict';


import * as vscode from 'vscode';

import { executeCommand } from './helpers';


interface AnnotationContext
{
	id: string,
}


export function deleteAnnotation(context: AnnotationContext)
{
	vscode.window.showInformationMessage(`deleteAnnotation ${context.id}`);
	// executeCommand('understand.server.analysis.analyzeAllFiles');
}


export function editAnnotation(context: AnnotationContext)
{
	vscode.window.showInformationMessage(`editAnnotation ${context.id}`);
	// executeCommand('understand.server.analysis.analyzeAllFiles');
}
