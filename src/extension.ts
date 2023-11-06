'use strict';


import * as crypto        from 'node:crypto';
import * as child_process from 'node:child_process';
import * as net           from 'node:net';
import * as process       from 'node:process';

import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	WorkDoneProgressBegin,
	WorkDoneProgressCreateParams,
	WorkDoneProgressEnd,
	WorkDoneProgressReport,
} from 'vscode-languageclient/node';


// General state of the language server & client
enum GeneralState {
	NeedConfig,
	Connecting,
	Resolving,
	Ready,
	NoConnection,
	Progress,
}

// Database state from the server, with NotOpened added
enum DatabaseState {
	NotOpened = -1, // the server failed to open the db
	Empty,          // the db will not be ready (unresolved and empty from a new sample)
	Resolved,       // the db is ready
	Resolving,      // the db is not ready yet
	Unresolved,     // the db will not be ready
	WrongVersion,   // the db will not be ready (not resolved due to an old parse version)
}

// Kind of analysis that the client wants to perform
enum AnalysisKind {
	AllFiles,
	ChangedFiles,
	SpecificFiles,
}

interface Database {
	path: string,
	state: DatabaseState,
}


// File types that can get the following features if they are implemented:
	// LSP "Language Features" like go to definition
	// VSCode "HoverProvider" like a detailed description of a violation
const documentSelector = [
	{ scheme: 'file', language: 'ada' },
	{ scheme: 'file', language: 'assembly' },
	{ scheme: 'file', language: 'bat' },
	{ scheme: 'file', language: 'c' },
	{ scheme: 'file', language: 'cobol' },
	{ scheme: 'file', language: 'cpp' },
	{ scheme: 'file', language: 'csharp' },
	{ scheme: 'file', language: 'css' },
	{ scheme: 'file', language: 'cuda' },
	{ scheme: 'file', language: 'delphi' },
	{ scheme: 'file', language: 'fortran' },
	{ scheme: 'file', language: 'html' },
	{ scheme: 'file', language: 'java' },
	{ scheme: 'file', language: 'javascript' },
	{ scheme: 'file', language: 'javascriptreact' },
	{ scheme: 'file', language: 'jovial' },
	{ scheme: 'file', language: 'objective' },
	{ scheme: 'file', language: 'objective' },
	{ scheme: 'file', language: 'pascal' },
	{ scheme: 'file', language: 'perl' },
	{ scheme: 'file', language: 'php' },
	{ scheme: 'file', language: 'python' },
	{ scheme: 'file', language: 'python' },
	{ scheme: 'file', language: 'tcl' },
	{ scheme: 'file', language: 'text' },
	{ scheme: 'file', language: 'typescript' },
	{ scheme: 'file', language: 'typescriptreact' },
	{ scheme: 'file', language: 'vb' },
	{ scheme: 'file', language: 'verilog' },
	{ scheme: 'file', language: 'vhdl' },
	{ scheme: 'file', language: 'xml' },
];

let languageServerArgs: string[];
let databases: Database[];

let connectionOptions;

let languageServer;
let languageClient;

let mainStatusBarItem: vscode.StatusBarItem;
let progressStatusBarItem: vscode.StatusBarItem;
let progressStatusBarItemOriginalTitle: string;


// Get an option from the user's config, which is user input
function getArrayFromConfig(key: string, defaultValue: any[] = []): any[]
{
	const value = helperGetAnyFromConfig(key);
	return Array.isArray(value) ? value : defaultValue;
}
function getBooleanFromConfig(key: string, defaultValue: boolean = false): boolean
{
	const value = helperGetAnyFromConfig(key);
	return (typeof value === 'boolean') ? value : defaultValue;
}
function getIntFromConfig(key: string, defaultValue: number = NaN): number
{
	const value = helperGetAnyFromConfig(key);
	return (typeof value === 'number') ? Math.floor(value) : defaultValue;
}
function getStringFromConfig(key: string, defaultValue: string = ''): string
{
	const value = helperGetAnyFromConfig(key);
	return (typeof value === 'string') ? value : defaultValue;
}
function helperGetAnyFromConfig(key: string)
{
	return vscode.workspace.getConfiguration().get(`understand.${key}`);
}


// Show info popup to user
function popupInfo(message: string)
{
	vscode.window.showInformationMessage(message);
}


// Show error popup to user
function popupError(message: string)
{
	vscode.window.showErrorMessage(message);
}


// Create text of status bar item: title and percent
function statusBarItemTitleAndPercent(title: string, percentage: number | undefined)
{
	if (percentage === undefined)
		return title;
	else
		return `${title} ${percentage}%`;
}


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


// Create text of status bar item: status and commands
function statusBarItemStatusAndCommands(status: GeneralState, title: string)
{
	// Add status title
	const markdownString = new vscode.MarkdownString(title);

	// Add each database
	if (databases !== undefined)
		for (const database of databases)
			markdownString.appendText(`\n\n${databaseToString(database)}`);

	interface StatusBarCommand {
		name: string,
		command: string,
	};

	// TODO add more commands

	// Select commands to display
	const commands: StatusBarCommand[] = [];
	commands.push({ name: 'Select .und project(s)', command: 'understand.settings.showSettingProjectPaths', });
	switch (status) {
		case GeneralState.NeedConfig:
			// ...
			break;
		case GeneralState.Connecting:
			// ...
			break;
		case GeneralState.Resolving:
			// ...
			break;
		case GeneralState.Ready:
			// ...
			break;
		case GeneralState.NoConnection:
			// ...
			break;
		case GeneralState.Progress:
			// ...
			break;
	}

	// Display commands
	markdownString.isTrusted = true;
	for (const commandObj of commands)
		markdownString.appendMarkdown(`\n\n[${commandObj.name}](command:${commandObj.command})`);

	return markdownString;
}


// Change status bar item
function changeStatusBar(status: GeneralState, progress: WorkDoneProgressBegin | WorkDoneProgressReport | WorkDoneProgressEnd | undefined = undefined)
{
	switch (status) {
		case GeneralState.NeedConfig:
			mainStatusBarItem.text = '$(gear) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Manual configuration needed');
			progressStatusBarItem.hide();
			break;
		case GeneralState.Connecting:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connecting to the Understand language server');
			progressStatusBarItem.hide();
			break;
		case GeneralState.Resolving:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'The Understand language server is finding and resolving the database(s)');
			progressStatusBarItem.hide();
			break;
		case GeneralState.Ready:
			let resolvedDatabases = 0;
			if (databases !== undefined)
				for (const database of databases)
					resolvedDatabases += (database.state === DatabaseState.Resolved) ? 1 : 0;
			if (databases.length > 0 && resolvedDatabases === databases.length) {
				mainStatusBarItem.text = '$(search-view-icon) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connected to the Understand language server and ready');
			}
			else if (databases.length === 0) {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'No database found by the Understand language server');
			}
			else {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, `Only ${resolvedDatabases} / ${databases.length} databases were resolved by the Understand language server`);
			}
			progressStatusBarItem.hide();
			break;
		case GeneralState.NoConnection:
			mainStatusBarItem.text = '$(error) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Failed to connect to the Understand language server');
			progressStatusBarItem.hide();
			break;
		case GeneralState.Progress:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			if (progress !== undefined) {
				if ('title' in progress) {
					mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, progress.title);
					progressStatusBarItem.text = statusBarItemTitleAndPercent(progress.title, progress.percentage);
					progressStatusBarItemOriginalTitle = progress.title;
				}
				else if ('percentage' in progress) {
					progressStatusBarItem.text = statusBarItemTitleAndPercent(progressStatusBarItemOriginalTitle, progress.percentage);
				}
			}
			progressStatusBarItem.show();
			break;
	}
}


// Handler: create progress
function handleWindowWorkDoneProgressCreate(_params: WorkDoneProgressCreateParams)
{
	// Ignore since the actual value of the progress is received later with $/progress
}


// Handler: update progress
function handleProgress(params: {value: WorkDoneProgressBegin | WorkDoneProgressReport | WorkDoneProgressEnd})
{
	if (params.value?.kind === 'end')
		changeStatusBar(GeneralState.Ready);
	else
		changeStatusBar(GeneralState.Progress, params.value);
}


// Show a specific setting in the Settings UI
function showSetting(setting: string)
{
	vscode.commands.executeCommand('workbench.action.openSettings', `@id:understand.${setting}`);
}


// Command: Analyze all files in all open projects
function analyzeAllFiles()
{
	const params = {
		analysisKind: AnalysisKind.AllFiles,
	};
	languageClient.sendNotification('analyzeFiles', params);
}


// Command: Analyze changed files in all open projects
function analyzeChangedFiles()
{
	const params = {
		analysisKind: AnalysisKind.ChangedFiles,
	};
	languageClient.sendNotification('analyzeFiles', params);
}


// Command: Explore current file in Understand
function exploreInUnderstandCurrentFile()
{
	// Stop if not in an editor
	const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
	if (editor === undefined)
		return popupInfo('Unable to explore in Understand: no current file');

	// Ask the server to open Understand
	// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#hoverParams
	const params = {
		textDocument: editor.document.uri.toString(),
		position: {
			line: editor.selection.start.line + 1,
			character: editor.selection.start.character,
		},
	};
	languageClient.sendNotification('openFileInUnderstand', params);
}


// Command: Show setting for for the extension in the Settings UI
function showSettingProjectPaths()
{
	showSetting('project.paths');
}


// Command: Show all settings for the extension in the Settings UI
function showSettings()
{
	vscode.commands.executeCommand('workbench.action.openSettings', `@ext:scitools.understand`);
}


// Command: Go to next violation in all files
function goToNextViolationInAllFiles()
{
	vscode.commands.executeCommand('editor.action.marker.nextInFiles');
}


// Command: Go to next violation in current file
function goToNextViolationInCurrentFile()
{
	vscode.commands.executeCommand('editor.action.marker.next');
}


// Command: Go to previous violation in all files
function goToPreviousViolationInAllFiles()
{
	vscode.commands.executeCommand('editor.action.marker.prevInFiles');
}


// Command: Go to previous violation in current file
function goToPreviousViolationInCurrentFile()
{
	vscode.commands.executeCommand('editor.action.marker.prev');
}


// Command: Toggle whether the Problems panel (Violations) is focused and visible
function togglePanelVisibilityAndFocus()
{
	vscode.commands.executeCommand('workbench.actions.view.problems');
}


// Stop the language client and possibly the language server too
async function stop(stopLanguageServer=false)
{
	if (languageServer !== undefined && stopLanguageServer) {
		languageServer.kill();
		languageServer = undefined;
	}

	if (languageClient !== undefined && languageClient.needsStop()) {
		try {
			await languageClient.stop();
		} catch (_) {

		}
		languageClient = undefined;
	}
}


// Handle a setting that changed
async function onDidChangeConfiguration(configurationChangeEvent: vscode.ConfigurationChangeEvent)
{
	// Skip settings that aren't in this extension
	if (!configurationChangeEvent.affectsConfiguration('understand'))
		return;

	// Decide whether to stop both the server and the client
	const settingsToStopServerAndClient = [
		'understand.executable',
		'understand.protocol',
		'understand.protocols',
	];
	let stopServerAndClient = false;
	for (const setting of settingsToStopServerAndClient) {
		if (configurationChangeEvent.affectsConfiguration(setting)) {
			stopServerAndClient = true;
			break;
		}
	}

	// Decide whether to stop only the client
	const settingsToStopClientOnly = [
		'understand.files',
		'understand.project',
	];
	let stopClientOnly = false;
	if (!stopServerAndClient) {
		for (const setting of settingsToStopClientOnly) {
			if (configurationChangeEvent.affectsConfiguration(setting)) {
				stopClientOnly = true;
				break;
			}
		}
	}

	if (!stopServerAndClient && !stopClientOnly)
		return;

	await stop(stopServerAndClient);
	return startLanguageServer(stopServerAndClient);
}


// Activation: try to connect to the language server
async function startLanguageServer(newConnectionOptions=true)
{
	// Custom options for initializing
	const initializationOptions = {
		automaticallyAnalyze: getBooleanFromConfig('analysis.automaticallyAnalyze', true),
	};
	const projectPaths = getArrayFromConfig('project.paths');
	// If the user wants to override the .und project path
	if (getStringFromConfig('project.pathFindingMethod') === 'Manual') {
		if (projectPaths.length === 0)
			return;
		else
			initializationOptions['projectPaths'] = projectPaths;
	}
	// Warn the user if any path is set and ignored
	else if (projectPaths.length > 0) {
		popupInfo('Project path(s) ignored because setting "project.pathFindingMethod" is not "Manual"');
	}

	changeStatusBar(GeneralState.Connecting);

	// Arguments to start the language server
	const protocol = getStringFromConfig('protocol', 'Local Socket');
	const command = getStringFromConfig('executable.path', 'userver');
	const detached = false;
	const childProcessEnv = process.env; // NOTE: this is important for avoiding a bad analysis
	if (newConnectionOptions) {
		languageServerArgs = [];
		connectionOptions = {};
		switch (protocol) {
			case 'Local Socket':
				connectionOptions.path = getStringFromConfig('protocols.localSocket.path');
				if (connectionOptions.path.length === 0) {
					if (process.platform === 'win32')
						connectionOptions.path = '\\\\.\\pipe\\userver-{uuid}';
					else
						connectionOptions.path = '/tmp/userver-{uuid}';
				}
				connectionOptions.path = connectionOptions.path.replaceAll('{uuid}', crypto.randomUUID());
				languageServerArgs.push('-local');
				languageServerArgs.push(connectionOptions.path);
				break;
			case 'TCP Socket':
				connectionOptions.host = '127.0.0.1';
				connectionOptions.port = getIntFromConfig('protocols.tcpSocket.port', 6789);
				languageServerArgs.push('-tcp');
				languageServerArgs.push(connectionOptions.port.toString());
				break;
			default:
				return popupError(`Value for understand.protocol is not a supported string: ${protocol}`);
		}
	}

	// Options to connect to the language server
	const serverOptions: ServerOptions = function() {
		return new Promise(function(resolve, reject) {
			const connectToServer = function() {
				// Wait a bit for the language server to create the socket
				let connected = false;
				let connectAttempts = 0;
				const maxConnectAttempts = 5;
				const connectWaitMilliseconds = 50;
				const interval = setInterval(function() {
					// Start to connect to the language server
					const socket = net.connect(connectionOptions);

					// Wait until the socket is connected
					socket.on('connect', function() {
						// Destroy a duplicate socket and stop
						if (connected) {
							socket.destroy();
							return;
						}
						connected = true;

						// Successfully connected
						const streamInfo = {
							writer: socket,
							reader: socket,
							detached: detached,
						};
						clearInterval(interval);
						resolve(streamInfo);
						changeStatusBar(GeneralState.Resolving);
					});

					// Stop trying
					if (connectAttempts >= maxConnectAttempts) {
						clearInterval(interval);
						reject();
						changeStatusBar(GeneralState.NoConnection);
					}
					connectAttempts += 1;
				}, connectWaitMilliseconds);
			};

			// Connect to the process if it already exists
			if (languageServer !== undefined) {
				return connectToServer();
			}
			// Spawn the process and connect to it
			else {
				// Start to spawn the language server process
				languageServer = child_process.spawn(command, languageServerArgs, {
					env: childProcessEnv,
					stdio: 'ignore',
					detached: detached,
				});

				// Fail if the language server wasn't found
				languageServer.on('error', function(err: {code: string}) {
					if (err.code === 'ENOENT')
						popupError(`The command "${command}" wasn't found `);
					reject();
				});

				// Wait until the language server is spawned
				languageServer.on('spawn', connectToServer);
			}
		});
	};

	// File types to watch for to notify the server when they are changed
	const fileEventPattern = getStringFromConfig('files.watch');
	const fileEvents = vscode.workspace.createFileSystemWatcher(fileEventPattern);

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector: documentSelector,
		initializationOptions: initializationOptions,
		synchronize: {
			fileEvents: fileEvents,
		},
	};

	// Create the language client
	const clientId = 'understand';
	const clientName = 'Understand - Trace';
	languageClient = new LanguageClient(
		clientId,
		clientName,
		serverOptions,
		clientOptions
	);

	// Start the client and also the server if it isn't running
	try {
		await languageClient.start();
	} catch (_) {
		return;
	}

	// Remember the databases and update the status bar
	databases = languageClient._initializeResult.databases;
	changeStatusBar(GeneralState.Ready);

	// Custom handlers
	languageClient.onRequest('window/workDoneProgress/create', handleWindowWorkDoneProgressCreate);
	languageClient.onNotification('$/progress', handleProgress);
}


// Helper: Clamp a number to be non-negative (0 ... infinity)
function clampToNonNegative(n: number)
{
	return (n >= 0) ? n : 0;
}


// Helper: Given a range, change the translate the start character and end character
function translateRangeChars(range: vscode.Range, translateStart: number, translateEnd: number)
{
	const newStartChar = clampToNonNegative(range.start.character + translateStart);
	const newEndChar   = clampToNonNegative(range.end.character + translateEnd);
	return new vscode.Range(range.start.line, newStartChar, range.end.line, newEndChar);
}


// Show more information when the user hovers the mouse
class HoverProvider implements vscode.HoverProvider {
	async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover>
	{
		// Stop if the user disabled detailed descriptions
		if (!getBooleanFromConfig('violations.hover.detailedDescription', true))
			return new vscode.Hover([]);

		const markdownStrings: vscode.MarkdownString[] = [];
		const usedIds = new Set();

		// Each violation in the hovered file
		for (const violation of vscode.languages.getDiagnostics(document.uri)) {
			// Skip if there's no detailed description URI
			if (typeof violation.code !== 'object')
				continue;

			// Skip if the violation isn't at the line of the hover
			if (violation.range.start.line != position.line)
				continue;

			// Get token length
			const maxScanAhead = 64;
			const text = document.getText(translateRangeChars(violation.range, 0, maxScanAhead));
			const tokenEndMatch = /^\w+/.exec(text);
			const tokenLength = tokenEndMatch ? tokenEndMatch[0].length : 1;

			// Skip if the violation isn't at the hover
			const modifiedViolationRange = translateRangeChars(violation.range, -1, tokenLength);
			if (!modifiedViolationRange.contains(position))
				continue;

			// Skip if already added this detailed description to this position
			if (usedIds.has(violation.code.value))
				continue;
			usedIds.add(violation.code.value);

			// Read and display content of detailed description
			try {
				const content = await vscode.workspace.fs.readFile(violation.code.target);
				const markdownString = new vscode.MarkdownString(content.toString());
				markdownString.supportHtml = true;
				markdownStrings.push(markdownString);
			} catch (error) {
				const errorString = `Failed to preview [${violation.code.target.fsPath}](${violation.code.target})`;
				markdownStrings.push(new vscode.MarkdownString(errorString));
			}
		}

		return new vscode.Hover(markdownStrings);
	}
}


// Main function for when the extension is activated
function activate(context: vscode.ExtensionContext)
{
	// Register commands (commands visible in the palette are created in package.json)
	context.subscriptions.push(
		// Analysis
		vscode.commands.registerCommand('understand.analysis.analyzeAllFiles', analyzeAllFiles),
		vscode.commands.registerCommand('understand.analysis.analyzeChangedFiles', analyzeChangedFiles),

		// Explore in Understand
		vscode.commands.registerCommand('understand.exploreInUnderstand.currentFile', exploreInUnderstandCurrentFile),

		// Settings
		vscode.commands.registerCommand('understand.settings.showSettings', showSettings),
		vscode.commands.registerCommand('understand.settings.showSettingProjectPaths', showSettingProjectPaths),

		// Violations
		vscode.commands.registerCommand('understand.violations.goToNextViolationInAllFiles', goToNextViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInCurrentFile', goToNextViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInAllFiles', goToPreviousViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInCurrentFile', goToPreviousViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.togglePanelVisibilityAndFocus', togglePanelVisibilityAndFocus),
	);

	// Register hover provider, for detailed descriptions
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(documentSelector, new HoverProvider()),
	);

	// Create status bar items
	mainStatusBarItem = vscode.window.createStatusBarItem('main', vscode.StatusBarAlignment.Left, 100);
	mainStatusBarItem.name = 'Understand';
	progressStatusBarItem = vscode.window.createStatusBarItem('progress', vscode.StatusBarAlignment.Left, 99);
	progressStatusBarItem.name = 'Understand Progress';
	changeStatusBar(GeneralState.NeedConfig);
	mainStatusBarItem.show();

	// Watch for settings changes, which should prompt the user to re-connect
	vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration);

	return startLanguageServer();
}


// Main function for when the extension is deactivated
function deactivate()
{
	if (languageClient === undefined)
		return undefined;

	return stop(true);
}


module.exports = {
	activate,
	deactivate,
};
