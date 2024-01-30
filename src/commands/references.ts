'use strict';


import * as vscode from 'vscode';


export function findAllImplementations()
{
	vscode.commands.executeCommand('references-view.findImplementations');
}

export function findAllReferences()
{
	vscode.commands.executeCommand('references-view.findReferences');
};

export function goToDeclaration()
{
	vscode.commands.executeCommand('editor.action.goToDeclaration');
}

export function goToDefinition()
{
	vscode.commands.executeCommand('editor.action.revealDefinition');
}

export function goToImplementations()
{
	vscode.commands.executeCommand('editor.action.goToImplementation');
}

export function goToReferences()
{
	vscode.commands.executeCommand('editor.action.goToReferences');
}

export function goToTypeDefinition()
{
	vscode.commands.executeCommand('editor.action.goToTypeDefinition');
}

export function peekDeclaration()
{
	vscode.commands.executeCommand('editor.action.peekDeclaration');
}

export function peekDefinition()
{
	vscode.commands.executeCommand('editor.action.peekDefinition');
}

export function peekImplementations()
{
	vscode.commands.executeCommand('editor.action.peekImplementation');
}

export function peekReferences()
{
	vscode.commands.executeCommand('editor.action.referenceSearch.trigger');
}

export function peekTypeDefinition()
{
	vscode.commands.executeCommand('editor.action.peekTypeDefinition');
}

