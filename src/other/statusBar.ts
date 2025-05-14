'use strict';


import * as vscode from 'vscode';
import * as lc from 'vscode-languageclient/node';

import { contexts, setContext } from './context';
import { variables, } from './variables';


/** Main state of the language server & client */
export enum MainState {
	Connecting,
	Ready,
	NoConnection,
	Progress,
}

/** Database state from the server, with UnableToOpen added */
enum DbState {
	Finding = -3,   // getting settings and finding the project
	NoProject = -2, // a project was not found manually or automatically
	UnableToOpen = -1, // the server failed to open the db
	Empty,          // the db will not be ready (unresolved and empty from a new sample)
	Resolved,       // the db is ready
	Resolving,      // the db is not ready yet
	Unresolved,     // the db will not be ready
	WrongVersion,   // the db will not be ready (not resolved due to an old parse version)
}

/** A project that has a path, database, and database state */
interface Db {
	path: string,
	state: DbState,
}

/**
 * Progress, with the value usually being an object
 * https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#progress
 */
interface ProgressParams {
	token: lc.ProgressToken,
	value: any,
}

interface StatusBarCommand {
	name: string,
	command: string,
};

/**
 * Status bar item that can remember the original text
 */
interface StatusBarItem extends vscode.StatusBarItem {
	originalText?: string,
}


let db = { path: '', state: DbState.Finding };

let mainStatusBarItem: vscode.StatusBarItem;
let progressStatusBarItems = new Map<string, StatusBarItem>();


/**
 * Change the main status bar item
 */
export function changeMainStatus(status: MainState)
{
	if (mainStatusBarItem === undefined)
		createStatusBar();

	switch (status) {
		case MainState.Connecting:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connecting');
			setContext(contexts.project, false);
			break;
		case MainState.Ready:
			switch (db.state) {
				case DbState.Finding:
					mainStatusBarItem.text = '$(loading~spin) Understand';
					mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connected to the Understand language server, finding project');
					setContext(contexts.project, true);
					break;
				case DbState.NoProject:
					mainStatusBarItem.text = '$(error) Understand';
					mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'No database found/opened by the Understand language server');
					setContext(contexts.project, false);
					break;
				case DbState.Resolved:
					mainStatusBarItem.text = '$(search-view-icon) Understand';
					mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connected to the Understand language server and ready');
					setContext(contexts.project, true);
					break;
				case DbState.Resolving:
					mainStatusBarItem.text = '$(loading~spin) Understand';
					mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connected to the Understand language server, resolving database');
					setContext(contexts.project, false);
					break;
				default:
					mainStatusBarItem.text = '$(error) Understand';
					mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, `Database not resolved yet by the Understand language server`);
					setContext(contexts.project, true);
					break;
			}
			break;
		case MainState.NoConnection:
			mainStatusBarItem.text = '$(error) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Failed to connect to the Understand language server');
			setContext(contexts.project, false);
			break;
		case MainState.Progress:
			mainStatusBarItem.text = '$(loading~spin) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connected to the Understand language server, working');
			setContext(contexts.project, true);
			break;
	}
}


function commandToStop(token: string)
{
	switch (token) {
		case 'Understand AI Generation': return 'understand.ai.stopAiGeneration';
		case 'Understand Analysis': return 'understand.analysis.stopAnalyzingFiles';
		default: return '';
	}
}


/** Initialize the main status bar item */
function createStatusBar()
{
	mainStatusBarItem = vscode.window.createStatusBarItem('main', vscode.StatusBarAlignment.Left, 100);
	mainStatusBarItem.name = 'Understand';
	mainStatusBarItem.show();
}


/** Handler: create progress */
export function handleWindowWorkDoneProgressCreate(params: lc.WorkDoneProgressCreateParams)
{
	const token = params.token.toString();

	// Delete the progress item if it already exists for some reason
	{
		const otherItem = progressStatusBarItems.get(token);
		if (otherItem) {
			progressStatusBarItems.delete(token);
			otherItem.dispose();
		}
	}

	// Create the progress item
	const progressStatusBarItem = vscode.window.createStatusBarItem(token, vscode.StatusBarAlignment.Left, 99);
	progressStatusBarItems.set(token, progressStatusBarItem)
}


/** Handler: update progress */
export function handleProgress(params: ProgressParams)
{
	// Stop if there's no progress object
	const progress: lc.WorkDoneProgressBegin | lc.WorkDoneProgressReport | lc.WorkDoneProgressEnd = params.value;
	if (progress === undefined)
		return;

	// Optionally change the progress bar status bar item for the database
	const token = params.token.toString();
	const progressStatusBarItem = progressStatusBarItems.get(token);
	if (progressStatusBarItem) {
		if ('cancellable' in progress) {
			if (progress.cancellable) {
				const markdownString = new vscode.MarkdownString();
				markdownString.isTrusted = true;
				markdownString.appendMarkdown(`[Stop](command:${commandToStop(token)})`);
				progressStatusBarItem.tooltip = markdownString;
			}
			else {
				progressStatusBarItem.tooltip = '';
			}
		}
		if ('title' in progress) {
			progressStatusBarItem.text = statusBarItemTitleAndPercent(progress.title, progress.percentage);
			progressStatusBarItem.originalText = progress.title;
			progressStatusBarItem.show();
		}
		else if ('percentage' in progress) {
			const originalText = progressStatusBarItem.originalText || '';
			progressStatusBarItem.text = statusBarItemTitleAndPercent(originalText, progress.percentage);
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


export function handleUnderstandChangedDatabaseState(params: Db)
{
	db = params;

	if (progressStatusBarItems.size === 0)
		changeMainStatus(MainState.Ready);
	else
		changeMainStatus(MainState.Progress);

	if (params.state === DbState.Resolved)
		variables.violationDescriptionProvider.handleProjectOpened();
}


/** Creatke text of status bar item: status and commands */
function statusBarItemStatusAndCommands(status: MainState, title: string)
{
	// Add status title
	const markdownString = new vscode.MarkdownString(title);

	// Add the database path and state
	markdownString.appendText(`\n\n${databaseToString(db)}`);

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
			name: 'Create new .und project',
			command: 'understand.exploreInUnderstand.newProject',
		},
		{
			name: 'Select .und project',
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
			switch (db.state) {
				case DbState.Finding:
					enabledCommands.add('understand.settings.showSettingsProject');
					break;
				case DbState.NoProject:
					enabledCommands.add('understand.exploreInUnderstand.newProject');
					enabledCommands.add('understand.settings.showSettingsProject');
					break;
				case DbState.Resolved:
					enabledCommands.add('understand.analysis.analyzeAllFiles');
					enabledCommands.add('understand.analysis.analyzeChangedFiles');
					enabledCommands.add('understand.settings.showSettingsProject');
					break;
				default:
					enabledCommands.add('understand.analysis.analyzeAllFiles');
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


/** Create text of status bar item: title and percent */
function statusBarItemTitleAndPercent(title: string, percentage?: number)
{
	if (percentage === undefined)
		return title;
	else
		return `${title} ${percentage}%`;
}


/** Display the database path & state */
function databaseToString(database: Db)
{
	let stateString = '';
	switch (database.state) {
		case DbState.Finding:
			stateString = 'Finding project';
			break;
		case DbState.NoProject:
			stateString = 'No project';
			break;
		case DbState.UnableToOpen:
			stateString = 'Not opened';
			break;
		case DbState.Empty:
			stateString = 'Empty database';
			break;
		case DbState.Resolved:
			stateString = ''; // (Empty to imply success)
			break;
		case DbState.Resolving:
			stateString = 'Resolving';
			break;
		case DbState.Unresolved:
			stateString = 'Not resolved';
			break;
		case DbState.WrongVersion:
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
