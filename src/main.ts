'use strict';


import * as vscode from 'vscode';

import * as analysis from './commands/analysis';
import * as exploreInUnderstand from './commands/exploreInUnderstand';
import * as settings from './commands/settings';
import * as violations from './commands/violations';
import { onDidChangeConfiguration } from './other/config';
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

		// Settings
		vscode.commands.registerCommand('understand.settings.showSettings', settings.showSettings),
		vscode.commands.registerCommand('understand.settings.showSettingProjectPaths', settings.showSettingProjectPaths),

		// Violations
		vscode.commands.registerCommand('understand.violations.fix', violations.fix),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInAllFiles', violations.goToNextViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInCurrentFile', violations.goToNextViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInAllFiles', violations.goToPreviousViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInCurrentFile', violations.goToPreviousViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.ignore', violations.ignore),
		vscode.commands.registerCommand('understand.violations.togglePanelVisibilityAndFocus', violations.togglePanelVisibilityAndFocus),
	);

	// Register hover provider, for detailed descriptions
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(documentSelector, new UnderstandHoverProvider()),
	);

	// Watch for settings changes, which should prompt the user to re-connect
	vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration);

	startLsp();
}


// Deactivate the extension
export function deactivate()
{
	stopLsp();
}
