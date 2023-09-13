'use strict';


const vscode = require('vscode');

const child_process = require('node:child_process');
const net           = require('node:net');
const path          = require('node:path');
const process       = require('node:process');

const lc = require('vscode-languageclient');


let languageClient;
let logger;


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


// Main function for when the extension is activated
function activate()
{
	// Arguments to start the language server
	const protocol = getConfig('protocol', 'string');
	const command = 'userver';
	const detached = false;
	const args = [];
	const connectionOptions = {};
	let host;
	let port;
	switch (protocol) {
		case 'Local':
			const name = getConfig('localSocketName', 'string');
			if (process.platform === 'win32') {
				if (/^\\\\[.?]\\pipe\\/.test(name))
					connectionOptions.path = name;
				else
					connectionOptions.path = path.join('\\\\.\\pipe', name);
			}
			else {
				if (/^\/tmp\//.test(name))
					connectionOptions.path = name;
				else
					connectionOptions.path = path.join('/tmp', name);
			}
			args.push('-local');
			args.push(connectionOptions.path);
			break;
		case 'TCP':
			connectionOptions.host = '127.0.0.1';
			connectionOptions.port = getConfig('tcpSocketPort', 'integer');
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
				env: {},
				stdio: 'ignore',
				detached: detached,
			});

			// Fail if the language server isn't installed
			childProcess.on('error', function(err) {
				if (err.code === 'ENOENT')
					error(`The command ${command} is not installed `);
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
					});

					// Stop trying
					if (connectAttempts >= maxConnectAttempts) {
						error(`Tried to connect to ${command} ${maxConnectAttempts} times, waiting for ${connectWaitMilliseconds} ms each time`);
						clearInterval(interval);
						reject();
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
	const fileEventPattern = getConfig('watcherInclude', 'string');
	const fileEvents = vscode.workspace.createFileSystemWatcher(fileEventPattern);

	// Options to control the language client
	const clientOptions = {
		documentSelector: documentSelector,
		synchronize: {
			fileEvents: fileEvents,
		},
	};

	// Create the language client
	const clientId = 'UserverVscode';
	const clientName = 'Userver VS Code';
	languageClient = new lc.LanguageClient(
		clientId,
		clientName,
		serverOptions,
		clientOptions
	);

	// Start the client and also the server if it isn't running
	languageClient.start();
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
