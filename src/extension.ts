'use strict';


import crypto        from 'node:crypto';
import child_process from 'node:child_process';
import net           from 'node:net';
import process       from 'node:process';

import vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	WorkDoneProgressBegin,
	WorkDoneProgressReport,
	WorkDoneProgressEnd
} from 'vscode-languageclient/node';


// Enum for general state of the language server & client
const GENERAL_STATE_NEED_CONFIG   = 0;
const GENERAL_STATE_CONNECTING    = 1;
const GENERAL_STATE_RESOLVING     = 2;
const GENERAL_STATE_READY         = 3;
const GENERAL_STATE_NO_CONNECTION = 4;
const GENERAL_STATE_PROGRESS      = 5;

// Enum for database state
const DATABASE_STATE_NOT_OPENED    = -1; // the server failed to open the db
const DATABASE_STATE_EMPTY         = 0;  // the db is unresolved and empty (from a new sample)
const DATABASE_STATE_RESOLVED      = 1;  // the db is resolved
const DATABASE_STATE_RESOLVING     = 2;  // the db is in the middle of a resolve operation
const DATABASE_STATE_UNRESOLVED    = 3;  // the db is not resolved
const DATABASE_STATE_WRONG_VERSION = 4;  // the db is not resolved due to an old parse version

let args;
let connectionOptions;

let languageServer;
let languageClient;

let databases;

let logger;

let mainStatusBarItem;
let progressStatusBarItem;


// Get an option from the user's config, which is user input
function getArrayFromConfig(key: string, defaultValue: any[] = []): any[]
{
	const value = helperGetAnyFromConfig(key);
	return Array.isArray(value) ? value : defaultValue;
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


// Debug: stringify item for log or popup
function stringify(item)
{
	switch (typeof(item)) {
		case 'undefined':
			return 'undefined';
		case 'object':
			return JSON.stringify(item);
		case 'string':
			return item;
		case 'number':
		case 'boolean':
		default:
			return item.toString();
	}
}


// Debug: output to log
function log(itemToLog)
{
	if (logger === undefined)
		logger = vscode.window.createOutputChannel('Understand');

	logger.appendLine(stringify(itemToLog));
	logger.show();
}


// Show info popup to user
function popupInfo(message)
{
	vscode.window.showInformationMessage(stringify(message));
}


// Show error popup to user
function popupError(message)
{
	vscode.window.showErrorMessage(stringify(message));
}


// Create text of status bar item: title and percent
function statusBarItemTitleAndPercent(title, percentage)
{
	if (percentage === undefined || percentage === null)
		return title;
	else
		return `${title} ${percentage}%`;
}


function databaseToString(database)
{
	let stateString;
	switch (database.state) {
		case DATABASE_STATE_NOT_OPENED:
			stateString = 'Not opened';
			break;
		case DATABASE_STATE_EMPTY:
			stateString = 'Empty';
			break;
		case DATABASE_STATE_RESOLVED:
			// (Empty to imply success)
			break;
		case DATABASE_STATE_RESOLVING:
			stateString = 'Resolving';
			break;
		case DATABASE_STATE_UNRESOLVED:
			stateString = 'Resolving';
			break;
		case DATABASE_STATE_WRONG_VERSION:
			stateString = 'Wrong version';
			break;
		default:
			stateString = 'Unknown state';
			break;
	}

	if (stateString === undefined)
		return database.path;
	else
		return `${database.path} (${stateString})`;
}


// Create text of status bar item: status and commands
function statusBarItemStatusAndCommands(status, title)
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
		case GENERAL_STATE_NEED_CONFIG:
			// ...
			break;
		case GENERAL_STATE_CONNECTING:
			// ...
			break;
		case GENERAL_STATE_RESOLVING:
			// ...
			break;
		case GENERAL_STATE_READY:
			// ...
			break;
		case GENERAL_STATE_NO_CONNECTION:
			// ...
			break;
		case GENERAL_STATE_PROGRESS:
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
function changeStatusBar(status, progress: WorkDoneProgressBegin | WorkDoneProgressReport | WorkDoneProgressEnd | undefined = undefined)
{
	switch (status) {
		case GENERAL_STATE_NEED_CONFIG:
			mainStatusBarItem.text = '$(gear) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Manual configuration needed');
			progressStatusBarItem.hide();
			break;
		case GENERAL_STATE_CONNECTING:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connecting to the Understand language server');
			progressStatusBarItem.hide();
			break;
		case GENERAL_STATE_RESOLVING:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'The Understand language server is finding and resolving the database(s)');
			progressStatusBarItem.hide();
			break;
		case GENERAL_STATE_READY:
			let resolvedDatabases = 0;
			const totalDatabases = databases?.length || 0;
			if (databases !== undefined)
				for (const database of databases)
					resolvedDatabases += (database.state === DATABASE_STATE_RESOLVED) ? 1 : 0;
			if (totalDatabases > 0 && resolvedDatabases === totalDatabases) {
				mainStatusBarItem.text = '$(search-view-icon) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Connected to the Understand language server and ready');
			}
			else if (totalDatabases === 0) {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'No database found by the Understand language server');
			}
			else {
				mainStatusBarItem.text = '$(error) Understand';
				mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, `Only ${resolvedDatabases} / ${totalDatabases} databases were resolved by the Understand language server`);
			}
			progressStatusBarItem.hide();
			break;
		case GENERAL_STATE_NO_CONNECTION:
			mainStatusBarItem.text = '$(error) Understand';
			mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, 'Failed to connect to the Understand language server');
			progressStatusBarItem.hide();
			break;
		case GENERAL_STATE_PROGRESS:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			if (progress !== undefined) {
				if ('title' in progress) {
					mainStatusBarItem.tooltip = statusBarItemStatusAndCommands(status, progress.title);
					progressStatusBarItem.text = statusBarItemTitleAndPercent(progress.title, progress.percentage);
					progressStatusBarItem._title = progress.title;
				}
				else if ('percentage' in progress) {
					progressStatusBarItem.text = statusBarItemTitleAndPercent(progressStatusBarItem._title, progress.percentage);
				}
			}
			progressStatusBarItem.show();
			break;
	}
}


// Handler: create progress
function handleWindowWorkDoneProgressCreate(params)
{
	// Ignore since the actual value of the progress is received later with $/progress
}


// Handler: update progress
function handleProgress(params: {value: WorkDoneProgressBegin | WorkDoneProgressReport | WorkDoneProgressEnd})
{
	if (params.value?.kind === 'end')
		changeStatusBar(GENERAL_STATE_READY);
	else
		changeStatusBar(GENERAL_STATE_PROGRESS, params.value);
}


// Get a .und database from user input
async function getUndPathFromUser() {
	// Get database from user input
	const rootPath = vscode.workspace.rootPath;
	const rootUri = rootPath ? vscode.Uri.file(rootPath) : undefined;
	const uris = await vscode.window.showOpenDialog({
		canSelectFolders: true,
		defaultUri: rootUri,
		openLabel: 'Select',
		title: 'Select .und Folder',
	});

	// Error: not selected
	if (!uris)
		return popupError('No folder selected');

	// Error: not .und
	const uri = uris[0];
	if (!(/\.und$/.test(uri.fsPath)))
		return popupError('Selected folder is not .und');

	return uri.fsPath;
}


// Show a specific setting in the Settings UI
function showSetting(setting)
{
	vscode.commands.executeCommand('workbench.action.openSettings', `@id:understand.${setting}`);
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
function toggleVisibilityAndFocus()
{
	vscode.commands.executeCommand('workbench.actions.view.problems');
}


// Stop the language client and possibly the language server too
async function stop(stopLanguageServer=false)
{
	if (languageServer !== undefined && stopLanguageServer) {
		await languageServer.kill();
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
async function onDidChangeConfiguration(configurationChangeEvent)
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
	const initializationOptions = {};
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
	changeStatusBar(GENERAL_STATE_CONNECTING);

	// Arguments to start the language server
	const protocol = getStringFromConfig('protocol', 'Local Socket');
	const command = getStringFromConfig('executable.path', 'userver');
	const detached = false;
	const childProcessEnv = process.env; // NOTE: this is important for avoiding a bad analysis
	if (newConnectionOptions) {
		args = [];
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
				args.push('-local');
				args.push(connectionOptions.path);
				break;
			case 'TCP Socket':
				connectionOptions.host = '127.0.0.1';
				connectionOptions.port = getIntFromConfig('protocols.tcpSocket.port', 6789);
				args.push('-tcp');
				args.push(connectionOptions.port.toString());
				break;
			default:
				return popupError(`Value for understand.protocol is not a supported string: ${protocol}`);
		}
	}

	// NOTE: To understand the LanguageClient class, see the following file
	// node_modules/vscode-languageclient/lib/node/main.d.ts

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
						changeStatusBar(GENERAL_STATE_RESOLVING);
					});

					// Stop trying
					if (connectAttempts >= maxConnectAttempts) {
						clearInterval(interval);
						reject();
						changeStatusBar(GENERAL_STATE_NO_CONNECTION);
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
				languageServer = child_process.spawn(command, args, {
					env: childProcessEnv,
					stdio: 'ignore',
					detached: detached,
				});

				// Fail if the language server wasn't found
				languageServer.on('error', function(err) {
					if (err.code === 'ENOENT')
						popupError(`The command "${command}" wasn't found `);
					reject();
				});

				// Wait until the language server is spawned
				languageServer.on('spawn', connectToServer);
			}
		});
	};

	// File types that will get Language Features like "Go to Definition"
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
	const clientName = 'Understand';
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

	// Remember the databases and the status bar (array of objects {path, status})
	databases = languageClient._initializeResult.databases;
	changeStatusBar(GENERAL_STATE_READY);

	// Custom handlers
	languageClient.onRequest('window/workDoneProgress/create', handleWindowWorkDoneProgressCreate);
	languageClient.onNotification('$/progress', handleProgress);
}


// Main function for when the extension is activated
function activate(context: vscode.ExtensionContext)
{
	// Set up commands that were created in package.json
	context.subscriptions.push(
		// Settings
		vscode.commands.registerCommand('understand.settings.showSettings', showSettings),
		vscode.commands.registerCommand('understand.settings.showSettingProjectPaths', showSettingProjectPaths),

		// Violations
		vscode.commands.registerCommand('understand.violations.goToNextViolationInAllFiles', goToNextViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInCurrentFile', goToNextViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInAllFiles', goToPreviousViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInCurrentFile', goToPreviousViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.toggleVisibilityAndFocus', toggleVisibilityAndFocus),
	);

	// Create status bar items
	mainStatusBarItem = vscode.window.createStatusBarItem('main', vscode.StatusBarAlignment.Left, 100);
	mainStatusBarItem.name = 'Understand';
	progressStatusBarItem = vscode.window.createStatusBarItem('progress', vscode.StatusBarAlignment.Left, 99);
	progressStatusBarItem.name = 'Understand Progress';
	changeStatusBar(GENERAL_STATE_NEED_CONFIG);
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
