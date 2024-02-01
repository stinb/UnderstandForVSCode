'use strict';


import * as vscode from 'vscode';

import * as analysis from './commands/analysis';
import * as exploreInUnderstand from './commands/exploreInUnderstand';
import * as references from './commands/references';
import * as settings from './commands/settings';
import * as violations from './commands/violations';
import { onDidChangeConfiguration } from './other/config';
import { onDidChangeActiveTextEditor } from './other/context';
import { UnderstandHoverProvider } from './other/hover';
import {
	documentSelector,
	startLsp,
	stopLsp,
} from './other/languageClient';


// Activate the extension
export function activate(context: vscode.ExtensionContext)
{
	// Register commands (commands visible in the palette are created in package.json)
	context.subscriptions.push(
		// Analysis
		vscode.commands.registerCommand('understand.analysis.analyzeAllFiles', analysis.analyzeAllFiles),
		vscode.commands.registerCommand('understand.analysis.analyzeChangedFiles', analysis.analyzeChangedFiles),

		// Explore in Understand
		vscode.commands.registerCommand('understand.exploreInUnderstand.currentFile', exploreInUnderstand.currentFile),

		// References
		vscode.commands.registerCommand('understand.references.findAllImplementations', references.findAllImplementations),
		vscode.commands.registerCommand('understand.references.findAllReferences', references.findAllReferences),
		vscode.commands.registerCommand('understand.references.goToDeclaration', references.goToDeclaration),
		vscode.commands.registerCommand('understand.references.goToDefinition', references.goToDefinition),
		vscode.commands.registerCommand('understand.references.goToImplementations', references.goToImplementations),
		vscode.commands.registerCommand('understand.references.goToReferences', references.goToReferences),
		vscode.commands.registerCommand('understand.references.goToTypeDefinition', references.goToTypeDefinition),
		vscode.commands.registerCommand('understand.references.peekDeclaration', references.peekDeclaration),
		vscode.commands.registerCommand('understand.references.peekDefinition', references.peekDefinition),
		vscode.commands.registerCommand('understand.references.peekImplementations', references.peekImplementations),
		vscode.commands.registerCommand('understand.references.peekReferences', references.peekReferences),
		vscode.commands.registerCommand('understand.references.peekTypeDefinition', references.peekTypeDefinition),

		// Settings
		vscode.commands.registerCommand('understand.settings.showSettings', settings.showSettings),
		vscode.commands.registerCommand('understand.settings.showSettingsProject', settings.showSettingsProject),

		// Violations
		vscode.commands.registerCommand('understand.violations.fix', violations.fix),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInAllFiles', violations.goToNextViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInCurrentFile', violations.goToNextViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInAllFiles', violations.goToPreviousViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInCurrentFile', violations.goToPreviousViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.ignore', violations.ignore),
		vscode.commands.registerCommand('understand.violations.toggleVisibilityAndFocus', violations.toggleVisibilityAndFocus),
	);

	// Register hover provider, for detailed descriptions
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(documentSelector, new UnderstandHoverProvider()),
	);

	// Watch for settings changes, which should prompt the user to re-connect
	vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration);

	// Watch for editor focus changing, which should change the 'understandFile' context
	vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor);

	startLsp();
}


// Deactivate the extension
export function deactivate()
{
	stopLsp();
}
