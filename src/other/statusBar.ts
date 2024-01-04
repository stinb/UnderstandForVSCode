'use strict';


import * as vscode from 'vscode';
import * as lc from 'vscode-languageclient/node';

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
			enableUnderstandProjectContext(false);
			break;
		case MainState.Ready:
			// Count the databases
			const databases: Database[] | undefined = variables.languageClient.initializeResult?.databases;
			let resolvedDatabases = 0;
			if (databases !== undefined)
				for (const database of databases)
					resolvedDatabases += (database.state === DatabaseState.Resolved) ? 1 : 0;
			// Show status
			if (databases.length > 0 && resolvedDatabases === databases.length) {
				mainStatusBarItem.text = '$(search-view-icon) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connected to the Understand language server and ready');
				enableUnderstandProjectContext();
			}
			else if (databases.length === 0) {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'No database found/opened by the Understand language server');
				enableUnderstandProjectContext(false);
			}
			else {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, `Only ${resolvedDatabases} / ${databases.length} databases were resolved by the Understand language server`);
				enableUnderstandProjectContext();
			}
			break;
		case MainState.NoConnection:
			mainStatusBarItem.text = '$(error) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Failed to connect to the Understand language server');
			enableUnderstandProjectContext(false);
			break;
		case MainState.Progress:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			mainStatusBarItem.tooltip = 'Analyzing';
			enableUnderstandProjectContext(false);
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


// Handler: create progress
export function handleWindowWorkDoneProgressCreate(params: lc.WorkDoneProgressCreateParams)
{
	// Delete it if it already exists for some reason
	const token = params.token.toString();
	if (progressStatusBarItems.has(token)) {
		progressStatusBarItems.delete(token);
		progressStatusBarItems.get(token).dispose();
	}

	// Create it
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


// Enable the context, which makes commands show up
function enableUnderstandProjectContext(enable = true)
{
	vscode.commands.executeCommand('setContext', 'understandProject', enable || undefined);
}


// Create text of status bar item: status and commands
function statusBarItemStatusAndCommands(status: MainState, title: string)
{
	// Add status title
	const markdownString = new vscode.MarkdownString(title);

	// Add each database
	const databases: Database[] | undefined = variables.languageClient.initializeResult?.databases;
	if (databases !== undefined)
		for (const database of databases)
			markdownString.appendText(`\n\n${databaseToString(database)}`);

	interface StatusBarCommand {
		name: string,
		command: string,
		enabled: boolean,
	};

	// Add commands
	const commands: StatusBarCommand[] = [
		{
			name: 'Select .und project(s)',
			command: 'understand.settings.showSettingProjectPaths',
			enabled: true,
		},
		{
			name: 'Analyze all files',
			command: 'understand.analysis.analyzeAllFiles',
			enabled: false,
		},
		{
			name: 'Analyze changed files',
			command: 'understand.analysis.analyzeChangedFiles',
			enabled: false,
		},
		{
			name: 'Explore current file in Understand',
			command: 'understand.exploreInUnderstand.currentFile',
			enabled: false,
		},
	];

	// Enable commands
	const commandsToEnable = [];
	switch (status) {
		case MainState.Connecting:
			break;
		case MainState.Ready:
			// See if there any any resolved databases
			let resolvedDatabases = false;
			if (databases !== undefined) {
				for (const database of databases) {
					if (database.state === DatabaseState.Resolved) {
						resolvedDatabases = true;
						break;
					}
				}
			}

			if (resolvedDatabases) {
				commandsToEnable.push('understand.analysis.analyzeAllFiles');
				commandsToEnable.push('understand.analysis.analyzeChangedFiles');
				commandsToEnable.push('understand.exploreInUnderstand.currentFile');
			}

			break;
		case MainState.NoConnection:
			break;
		case MainState.Progress:
			break;
	}
	if (commandsToEnable.length)
		for (const command of commands)
			if (commandsToEnable.includes(command.command))
				command.enabled = true;

	// Display commands
	markdownString.isTrusted = true;
	for (const command of commands) {
		if (command.enabled)
			markdownString.appendMarkdown(`\n\n[${command.name}](command:${command.command})`);
		else
			markdownString.appendMarkdown(`\n\n${command.name}`);
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
			stateString = 'Wrong version';
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