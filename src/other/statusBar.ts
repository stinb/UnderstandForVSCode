'use strict';


import * as vscode from 'vscode';
import * as lc from 'vscode-languageclient/node';

import {
	contexts,
	setContext,
} from './context';
import {
	Database,
	DatabaseState,
	variables,
} from './variables';


// Main state of the language server & client
export enum MainState {
	Connecting,
	Ready,
	NoConnection,
	Progress,
}

// Progress with the value usually being an object
// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#progress
interface ProgressParams {
	token: lc.ProgressToken,
	value: any,
}

// Status bar item that can remember the original text
interface StatusBarItem extends vscode.StatusBarItem {
	originalText?: string,
}


let mainStatusBarItem: vscode.StatusBarItem;
let progressStatusBarItems = new Map<string, StatusBarItem>();


// Change the main status bar item
export function changeMainStatus(status: MainState)
{
	if (mainStatusBarItem === undefined)
		createStatusBar();

	switch (status) {
		case MainState.Connecting:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connecting to the Understand language server');
			setContext(contexts.project, false);
			setContext(contexts.analyzing, false);
			break;
		case MainState.Ready:
			// Count the resolved databases
			const databases: Database[] = getDatabases();
			let resolvedDatabases = 0;
			for (const database of databases)
				resolvedDatabases += (database.state === DatabaseState.Resolved) ? 1 : 0;
			// Show status
			if (databases.length > 0 && resolvedDatabases === databases.length) {
				mainStatusBarItem.text = '$(search-view-icon) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connected to the Understand language server and ready');
				setContext(contexts.project, true);
				setContext(contexts.analyzing, false);
			}
			else if (databases.length === 0) {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'No database found/opened by the Understand language server');
				setContext(contexts.project, false);
				setContext(contexts.analyzing, false);
			}
			else {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, `Only ${resolvedDatabases} / ${databases.length} databases were resolved by the Understand language server`);
				setContext(contexts.project, true);
				setContext(contexts.analyzing, false);
			}
			break;
		case MainState.NoConnection:
			mainStatusBarItem.text = '$(error) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Failed to connect to the Understand language server');
			setContext(contexts.project, false);
			setContext(contexts.analyzing, false);
			break;
		case MainState.Progress:
			mainStatusBarItem.text = '$(loading~spin) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Analyzing');
			setContext(contexts.project, true);
			setContext(contexts.analyzing, true);
			break;
	}
}


// Initialize the main status bar item
function createStatusBar()
{
	mainStatusBarItem = vscode.window.createStatusBarItem('main', vscode.StatusBarAlignment.Left, 100);
	mainStatusBarItem.name = 'Understand';
	mainStatusBarItem.show();
}


// Get the databases, which were sent by the language server 'initialize' method response
function getDatabases(): Database[]
{
	return variables.languageClient.initializeResult?.databases || [];
}


// Handler: create progress
export function handleWindowWorkDoneProgressCreate(params: lc.WorkDoneProgressCreateParams)
{
	// Delete the progress item if it already exists for some reason
	const token = params.token.toString();
	if (progressStatusBarItems.has(token)) {
		progressStatusBarItems.delete(token);
		progressStatusBarItems.get(token).dispose();
	}

	// Mark the database as resolved
	for (const database of getDatabases()) {
		if (database.path === token) {
			database.state = DatabaseState.Resolved;
			break;
		}
	}

	// Create the progress item
	const progressStatusBarItem = vscode.window.createStatusBarItem(token, vscode.StatusBarAlignment.Left, 99);
	progressStatusBarItems.set(token, progressStatusBarItem);
}


// Handler: update progress
export function handleProgress(params: ProgressParams)
{
	// Stop if there's no progress object
	const progress: lc.WorkDoneProgressBegin | lc.WorkDoneProgressReport | lc.WorkDoneProgressEnd = params.value;
	if (progress === undefined)
		return;

	// Optionally change the progress bar status bar item for the database
	const token = params.token.toString();
	if (progressStatusBarItems.has(token)) {
		const progressStatusBarItem = progressStatusBarItems.get(token);
		if ('title' in progress) {
			progressStatusBarItem.text = statusBarItemTitleAndPercent(progress.title, progress.percentage);
			progressStatusBarItem.originalText = progress.title;
			progressStatusBarItem.show();
		}
		else if ('percentage' in progress) {
			progressStatusBarItem.text = statusBarItemTitleAndPercent(progressStatusBarItem.originalText, progress.percentage);
		}
		else if (progress.kind === 'end') {
			progressStatusBarItems.delete(token);
			progressStatusBarItem.dispose();
		}
	}

	// Change the main status bar item
	if (progressStatusBarItems.size === 0)
		changeMainStatus(MainState.Ready);
	else
		changeMainStatus(MainState.Progress);
}


// Create text of status bar item: status and commands
function statusBarItemStatusAndCommands(status: MainState, title: string)
{
	// Add status title
	const markdownString = new vscode.MarkdownString(title);

	// Add each database
	const databases: Database[] = getDatabases();
	for (const database of databases)
		markdownString.appendText(`\n\n${databaseToString(database)}`);

	interface StatusBarCommand {
		name: string,
		command: string,
	};

	// Define commands
	const commands: StatusBarCommand[] = [
		{
			name: 'Analyze all files',
			command: 'understand.analysis.analyzeAllFiles',
		},
		{
			name: 'Analyze changed files',
			command: 'understand.analysis.analyzeChangedFiles',
		},
		{
			name: 'Stop analyzing files',
			command: 'understand.analysis.stopAnalyzingFiles',
		},
		{
			name: 'Select .und project(s)',
			command: 'understand.settings.showSettingsProject',
		},
		{
			name: 'Show settings',
			command: 'understand.settings.showSettings',
		},
	];

	// Enable commands
	const enabledCommands: Set<string> = new Set();
	switch (status) {
		case MainState.Connecting:
			break;
		case MainState.Ready:
			// See if there are any resolved databases
			let resolvedDatabases = false;
			for (const database of databases)
				if (database.state === DatabaseState.Resolved) {
					resolvedDatabases = true;
					break;
				}

			if (resolvedDatabases) {
				enabledCommands.add('understand.analysis.analyzeAllFiles');
				enabledCommands.add('understand.analysis.analyzeChangedFiles');
				enabledCommands.add('understand.settings.showSettingsProject');
			}

			break;
		case MainState.NoConnection:
			enabledCommands.add('understand.settings.showSettings');
			break;
		case MainState.Progress:
			enabledCommands.add('understand.analysis.stopAnalyzingFiles');
			break;
	}

	// Display commands
	markdownString.isTrusted = true;
	for (const command of commands) {
		if (enabledCommands.has(command.command))
			markdownString.appendMarkdown(`\n\n[${command.name}](command:${command.command})`);
	}

	return markdownString;
}


// Create text of status bar item: title and percent
function statusBarItemTitleAndPercent(title: string, percentage: number | undefined)
{
	if (percentage === undefined)
		return title;
	else
		return `${title} ${percentage}%`;
}


// Display the database path & state
function databaseToString(database: Database)
{
	let stateString = '';
	switch (database.state) {
		case DatabaseState.NotOpened:
			stateString = 'Not opened';
			break;
		case DatabaseState.Empty:
			stateString = 'Empty';
			break;
		case DatabaseState.Resolved:
			stateString = ''; // (Empty to imply success)
			break;
		case DatabaseState.Resolving:
			stateString = 'Resolving';
			break;
		case DatabaseState.Unresolved:
			stateString = 'Resolving';
			break;
		case DatabaseState.WrongVersion:
			stateString = 'Wrong database version';
			break;
		default:
			stateString = 'Unknown state';
			break;
	}

	if (stateString.length === 0)
		return database.path;
	else
		return `${database.path} (${stateString})`;
}
