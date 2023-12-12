'use strict';


import * as vscode from 'vscode';
import * as lc from 'vscode-languageclient/node';

import {
	Database,
	DatabaseState,
	variables,
} from './variables';


// General state of the language server & client
export enum GeneralState {
	Connecting,
	Ready,
	NoConnection,
	Progress,
}


let mainStatusBarItem: vscode.StatusBarItem;
// let progressStatusBarItems: vscode.StatusBarItem[];


// Change the main status bar item
export function changeStatusBar(status: GeneralState, progress: lc.WorkDoneProgressBegin | lc.WorkDoneProgressReport | lc.WorkDoneProgressEnd | undefined = undefined)
{
	if (mainStatusBarItem === undefined)
		createStatusBar();

	switch (status) {
		case GeneralState.Connecting:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connecting to the Understand language server');
			// progressStatusBarItem.hide();
			enableUnderstandProjectContext(false);
			break;
		case GeneralState.Ready:
			let resolvedDatabases = 0;
			if (variables.databases !== undefined)
				for (const database of variables.databases)
					resolvedDatabases += (database.state === DatabaseState.Resolved) ? 1 : 0;
			if (variables.databases.length > 0 && resolvedDatabases === variables.databases.length) {
				mainStatusBarItem.text = '$(search-view-icon) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connected to the Understand language server and ready');
				enableUnderstandProjectContext();
			}
			else if (variables.databases.length === 0) {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'No database found/opened by the Understand language server');
				enableUnderstandProjectContext(false);
			}
			else {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, `Only ${resolvedDatabases} / ${variables.databases.length} databases were resolved by the Understand language server`);
				enableUnderstandProjectContext();
			}
			// progressStatusBarItem.hide();
			break;
		case GeneralState.NoConnection:
			mainStatusBarItem.text = '$(error) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Failed to connect to the Understand language server');
			// progressStatusBarItem.hide();
			enableUnderstandProjectContext(false);
			break;
		case GeneralState.Progress:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			if (progress !== undefined) {
				if ('title' in progress) {
					mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, progress.title);
					// progressStatusBarItem.text = statusBarItemTitleAndPercent(progress.title, progress.percentage);
					// progressStatusBarItemOriginalTitle = progress.title;
				}
				else if ('percentage' in progress) {
					// progressStatusBarItem.text = statusBarItemTitleAndPercent(progressStatusBarItemOriginalTitle, progress.percentage);
				}
			}
			// progressStatusBarItem.show();
			enableUnderstandProjectContext(false);
			break;
	}
}


// Initialize the main status bar item
function createStatusBar()
{
	mainStatusBarItem = vscode.window.createStatusBarItem('main', vscode.StatusBarAlignment.Left, 100);
	mainStatusBarItem.name = 'Understand';
	changeStatusBar(GeneralState.Connecting);
	mainStatusBarItem.show();
}


// Handler: create progress
export function handleWindowWorkDoneProgressCreate(_params: lc.WorkDoneProgressCreateParams)
{

}


// Handler: update progress
export function handleProgress(params: {value: lc.WorkDoneProgressBegin | lc.WorkDoneProgressReport | lc.WorkDoneProgressEnd})
{
	if (params.value?.kind === 'end')
		changeStatusBar(GeneralState.Ready);
	else
		changeStatusBar(GeneralState.Progress, params.value);
}


// Enable the context, which makes commands show up
function enableUnderstandProjectContext(enable = true)
{
	vscode.commands.executeCommand('setContext', 'understandProject', enable || undefined);
}


// Create text of status bar item: status and commands
function statusBarItemStatusAndCommands(status: GeneralState, title: string)
{
	// Add status title
	const markdownString = new vscode.MarkdownString(title);

	// Add each database
	if (variables.databases !== undefined)
		for (const database of variables.databases)
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
		case GeneralState.Connecting:
			break;
		case GeneralState.Ready:
			// See if there any any resolved databases
			let resolvedDatabases = false;
			if (variables.databases !== undefined) {
				for (const database of variables.databases) {
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
		case GeneralState.NoConnection:
			break;
		case GeneralState.Progress:
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
