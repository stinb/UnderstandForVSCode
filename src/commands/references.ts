'use strict';


import * as vscode from 'vscode';


/** Shortcut for existing command 'Find All Implementations' */
export function findAllImplementations()
{
	vscode.commands.executeCommand('references-view.findImplementations');
}

/** Shortcut for existing command 'Find All References' */
export function findAllReferences()
{
	vscode.commands.executeCommand('references-view.findReferences');
};

/** Shortcut for existing command 'Go to Declaration' */
export function goToDeclaration()
{
	vscode.commands.executeCommand('editor.action.goToDeclaration');
}

/** Shortcut for existing command 'Go to Definition' */
export function goToDefinition()
{
	vscode.commands.executeCommand('editor.action.revealDefinition');
}

/** Shortcut for existing command 'Go to Implementations' */
export function goToImplementations()
{
	vscode.commands.executeCommand('editor.action.goToImplementation');
}

/** Shortcut for existing command 'Go to References' */
export function goToReferences()
{
	vscode.commands.executeCommand('editor.action.goToReferences');
}

/** Shortcut for existing command 'Go to TypeDefinition' */
export function goToTypeDefinition()
{
	vscode.commands.executeCommand('editor.action.goToTypeDefinition');
}

/** Shortcut for existing command 'Peek Declaration' */
export function peekDeclaration()
{
	vscode.commands.executeCommand('editor.action.peekDeclaration');
}

/** Shortcut for existing command 'Peek Definition' */
export function peekDefinition()
{
	vscode.commands.executeCommand('editor.action.peekDefinition');
}

/** Shortcut for existing command 'Peek Implementations' */
export function peekImplementations()
{
	vscode.commands.executeCommand('editor.action.peekImplementation');
}

/** Shortcut for existing command 'Peek References' */
export function peekReferences()
{
	vscode.commands.executeCommand('editor.action.referenceSearch.trigger');
}

/** Shortcut for existing command 'Peek Type Definition' */
export function peekTypeDefinition()
{
	vscode.commands.executeCommand('editor.action.peekTypeDefinition');
}

