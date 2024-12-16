'use strict';


import * as vscode from 'vscode';

import * as analysis from './commands/analysis';
import * as exploreInUnderstand from './commands/exploreInUnderstand';
import * as references from './commands/references';
import * as settings from './commands/settings';
import * as violations from './commands/violations';
import { onDidChangeConfiguration } from './other/config';
import { onDidChangeActiveTextEditor } from './other/context';
import { onDidChange, onDidCreate, onDidDelete } from './other/fileSystem';
import { UnderstandHoverProvider } from './other/hover';
import { documentSelector, startLsp, stopLsp, } from './other/languageClient';
import { variables } from './other/variables';


/** Activate the extension */
export async function activate(context: vscode.ExtensionContext)
{
	variables.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**');

	// Commands visible in the palette are created in package.json

	context.subscriptions.push(
		// Commands: Analysis
		vscode.commands.registerCommand('understand.analysis.analyzeAllFiles', analysis.analyzeAllFiles),
		vscode.commands.registerCommand('understand.analysis.analyzeChangedFiles', analysis.analyzeChangedFiles),
		vscode.commands.registerCommand('understand.analysis.stopAnalyzingFiles', analysis.stopAnalyzingFiles),

		// Commands: Explore in Understand
		vscode.commands.registerCommand('understand.exploreInUnderstand.currentFile', exploreInUnderstand.currentFile),
		vscode.commands.registerCommand('understand.exploreInUnderstand.newProject', exploreInUnderstand.newProject),

		// Commands: References
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

		// Commands: Settings
		vscode.commands.registerCommand('understand.settings.showSettings', settings.showSettings),
		vscode.commands.registerCommand('understand.settings.showSettingsProject', settings.showSettingsProject),

		// Commands: Violations
		vscode.commands.registerCommand('understand.violations.fix', violations.fix),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInAllFiles', violations.goToNextViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInCurrentFile', violations.goToNextViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInAllFiles', violations.goToPreviousViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInCurrentFile', violations.goToPreviousViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.ignore', violations.ignore),
		vscode.commands.registerCommand('understand.violations.toggleVisibilityAndFocus', violations.toggleVisibilityAndFocus),

		// Hover provider, for detailed descriptions
		vscode.languages.registerHoverProvider(documentSelector, new UnderstandHoverProvider()),

		// Watch for settings changes, which should prompt the user to re-connect
		vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration),

		// Watch for editor focus changing, which should change the 'understandFile' context
		vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor),

		// Watch for file changes, creations, and deletions
		variables.fileSystemWatcher.onDidChange(onDidChange),
		variables.fileSystemWatcher.onDidCreate(onDidCreate),
		variables.fileSystemWatcher.onDidDelete(onDidDelete),
	);

	startLsp();
}


/** Deactivate the extension */
export function deactivate()
{
	return stopLsp();
}
