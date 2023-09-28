'use strict';


const vscode = require('vscode');

const crypto        = require('node:crypto');
const child_process = require('node:child_process');
const net           = require('node:net');
const process       = require('node:process');

const lc = require('vscode-languageclient');


const GENERAL_STATE_CONNECTING    = 0;
const GENERAL_STATE_CONNECTED     = 1;
const GENERAL_STATE_NO_CONNECTION = 2;
const GENERAL_STATE_PROGRESS      = 3;

const DATABASE_STATE_FINDING       = -3; // the server is finding the db
const DATABASE_STATE_NOT_FOUND     = -2; // the server failed to open the db
const DATABASE_STATE_NOT_OPENED    = -1; // the server failed to open the db
const DATABASE_STATE_EMPTY         = 0;  // the db is unresolved and empty (from a new sample)
const DATABASE_STATE_RESOLVED      = 1;  // the db is resolved
const DATABASE_STATE_RESOLVING     = 2;  // the db is in the middle of a resolve operation
const DATABASE_STATE_UNRESOLVED    = 3;  // the db is not resolved
const DATABASE_STATE_WRONG_VERSION = 4;  // the db is not resolved due to an old parse version


let languageClient;

// TODO: add client side support for multiple databases
let databaseState = DATABASE_STATE_FINDING;

let logger;

let mainStatusBarItem;
let progressStatusBarItem;


// Get an option from the user's config, which is user input
function getConfig(key, expectedType)
{
	const value = vscode.workspace.getConfiguration().get(`understand.${key}`);

	if (typeof(value) != expectedType) {
		switch (expectedType) {
			case 'integer':
				return parseInt(value);
			case 'string':
				return value;
			case 'number':
				return parseFloat(value);
			default:
				return value;
		}
	}

	return value;
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


// Debug: info popup
function info(itemToShow)
{
	vscode.window.showInformationMessage(stringify(itemToShow));
}


// Debug: error popup
function error(itemToShow)
{
	vscode.window.showErrorMessage(stringify(itemToShow));
}


// Create new text of status bar item
function titleAndPercent(title, percentage)
{
	if (percentage === undefined || percentage === null)
		return title;
	else
		return `${title} ${percentage}%`;
}

// Change status bar item
function changeStatusBar(status, progress = {})
{
	switch (status) {
		case GENERAL_STATE_CONNECTING:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			mainStatusBarItem.tooltip = 'Connecting to the Understand language server';
			progressStatusBarItem.hide();
			break;
		case GENERAL_STATE_CONNECTED:
			switch (databaseState) {
				case DATABASE_STATE_FINDING:
					mainStatusBarItem.text = '$(sync~spin) Understand';
					mainStatusBarItem.tooltip = 'Finding and resolving database(s)';
					break;
				case DATABASE_STATE_RESOLVED:
					mainStatusBarItem.text = '$(search-view-icon) Understand';
					mainStatusBarItem.tooltip = 'Connected to the Understand language server';
					break;
				default:
					mainStatusBarItem.text = '$(error) Understand';
					mainStatusBarItem.tooltip = 'No resolved database found by the Understand language server';
					break;
			}
			progressStatusBarItem.hide();
			break;
		case GENERAL_STATE_NO_CONNECTION:
			mainStatusBarItem.text = '$(error) Understand';
			mainStatusBarItem.tooltip = 'Failed to connect to the Understand language server';
			progressStatusBarItem.hide();
			break;
		case GENERAL_STATE_PROGRESS:
			mainStatusBarItem.text = '$(sync~spin) Understand';
			if (progress.title) {
				mainStatusBarItem.tooltip = progress.title;
				progressStatusBarItem.text = titleAndPercent(progress.title, progress.percentage);
				progressStatusBarItem._title = progress.title;
			}
			else if (progress.percentage !== undefined && progress.percentage !== null) {
				progressStatusBarItem.text = titleAndPercent(progressStatusBarItem._title, progress.percentage);
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
function handleProgress(params)
{
	if (params.value?.kind === 'end')
		changeStatusBar(GENERAL_STATE_CONNECTED);
	else
		changeStatusBar(GENERAL_STATE_PROGRESS, params.value);
}


// Main function for when the extension is activated
async function activate(context)
{
	// Create status bar items
	mainStatusBarItem = vscode.window.createStatusBarItem('main', vscode.StatusBarAlignment.Left, 100);
	mainStatusBarItem.name = 'Understand';
	progressStatusBarItem = vscode.window.createStatusBarItem('progress', vscode.StatusBarAlignment.Left, 99);
	progressStatusBarItem.name = 'Understand Progress';
	changeStatusBar(GENERAL_STATE_CONNECTING);
	mainStatusBarItem.show();

	// Arguments to start the language server
	const protocol = getConfig('protocol', 'string');
	const command = getConfig('executable.path', 'string');
	const detached = false;
	const args = [];
	const connectionOptions = {};
	const childProcessEnv = process.env; // NOTE: this is important for avoiding a bad analysis
	let host;
	let port;
	switch (protocol) {
		case 'Local Socket':
			connectionOptions.path = getConfig('protocols.localSocket.path', 'string');
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
			connectionOptions.port = getConfig('protocols.tcpSocket.port', 'integer');
			args.push('-tcp');
			args.push(connectionOptions.port.toString());
			break;
		default:
			return error(`Value for understand.protocol is not a supported string: ${protocol}`);
	}

	// NOTE: To understand the LanguageClient class, see the following file
	// node_modules/vscode-languageclient/lib/node/main.d.ts

	// Options to connect to the language server
	const serverOptions = function() {
		return new Promise(function(resolve, reject) {
			// Start to spawn the language server process
			const childProcess = child_process.spawn(command, args, {
				env: childProcessEnv,
				stdio: 'ignore',
				detached: detached,
			});

			// Fail if the language server wasn't found
			childProcess.on('error', function(err) {
				if (err.code === 'ENOENT')
					error(`The command "${command}" wasn't found `);
				reject();
			});

			// Wait until the language server is spawned
			childProcess.on('spawn', function() {
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
						changeStatusBar(GENERAL_STATE_CONNECTED);
					});

					// Stop trying
					if (connectAttempts >= maxConnectAttempts) {
						clearInterval(interval);
						reject();
						changeStatusBar(GENERAL_STATE_NO_CONNECTION);
					}
					connectAttempts += 1;
				}, connectWaitMilliseconds);
			});
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

	// TODO: Improve createFileSystemWatcher to allow for an array of include/exclude globe patterns

	// TODO: If the user changes the option, then change something
		// localSocketName: disconnect and restart
		// tcpSocketPort: disconnect and restart
		// watcherInclude: createFileSystemWatcher

	// File types to watch for to notify the server when they are changed
	const fileEventPattern = getConfig('files.watch', 'string');
	const fileEvents = vscode.workspace.createFileSystemWatcher(fileEventPattern);

	// Options to control the language client
	const clientOptions = {
		documentSelector: documentSelector,
		synchronize: {
			fileEvents: fileEvents,
		},
	};

	// Create the language client
	const clientId = 'understand';
	const clientName = 'Understand';
	languageClient = new lc.LanguageClient(
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

	// See if the database was found, which is useful for the status bar item
	const databases = languageClient._initializeResult.serverInfo.databases;
	if (databases === undefined || databases.length === 0) {
		databaseState = DATABASE_STATE_NOT_FOUND;
	}
	else {
		for (const database of databases) {
			if (database.state !== undefined) {
				databaseState = database.state;
				break;
			}
		}
	}
	changeStatusBar(GENERAL_STATE_CONNECTED);

	// Custom handlers
	languageClient.onRequest('window/workDoneProgress/create', handleWindowWorkDoneProgressCreate);
	languageClient.onNotification('$/progress', handleProgress);
}


// Main function for when the extension is deactivated
function deactivate()
{
	if (languageClient === undefined)
		return undefined;

	return languageClient.stop();
}


module.exports = {
	activate,
	deactivate,
};
