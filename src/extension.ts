'use strict';


const vscode = require('vscode');

const child_process = require('node:child_process');
const net           = require('node:net');

const lc = require('vscode-languageclient');


let languageClient;
let logger;


// Get an option from the user's config, which is user input
function getConfig(kKey, kExpectedType)
{
	const kValue = vscode.workspace.getConfiguration().get(`understand.${kKey}`);

	if (typeof(kValue) != kExpectedType) {
		switch (kExpectedType) {
			case 'integer':
				return parseInt(kValue);
			case 'string':
				return kValue.toString();
			case 'number':
				return parseFloat(kValue);
			default:
				return kValue;
		}
	}

	return kValue;
}


// Debug: stringify item for log or popup
function stringify(kItem)
{
	switch (typeof(kItem)) {
		case 'undefined':
			return 'undefined';
		case 'object':
			return JSON.stringify(kItem);
		case 'string':
			return kItem;
		case 'number':
		case 'boolean':
		default:
			return kItem.toString(kItem);
	}
}


// Debug: output to log
function log(kItemToLog)
{
	if (logger === undefined)
		logger = vscode.window.createOutputChannel('Understand');

	logger.appendLine(stringify(kItemToLog));
	logger.show();
}


// Debug: info popup
function info(kItemToShow)
{
	vscode.window.showInformationMessage(stringify(kItemToShow));
}


// Debug: error popup
function error(kItemToShow)
{
	vscode.window.showErrorMessage(stringify(kItemToShow));
}


// Main function for when the extension is activated
function activate()
{
	// Arguments to start the language server
	const kProtocol = getConfig('protocol', 'string');
	const kCommand = 'userver';
	const kDetached = false;
	const kArgs = [];
	let host;
	let port;
	switch (kProtocol) {
		case 'TCP':
			host = '127.0.0.1';
			port = getConfig('tcpPort', 'integer');
			kArgs.push('-tcp true');
			kArgs.push(`-tcp_port ${port}`);
			break;
		default:
			return error(`Value for understand.protocol is not a supported string: ${kProtocol}`);
	}

	// NOTE: To understand the LanguageClient class, see the following file
	// node_modules/vscode-languageclient/lib/node/main.d.ts

	// Options to connect to the language server
	const kServerOptions = function() {
		return new Promise(function(resolve, reject) {
			// Start to spawn the language server process
			const kChildProcess = child_process.spawn(kCommand, kArgs, {
				env: {},
				stdio: 'ignore',
				detached: kDetached,
			});

			// Fail if userver isn't installed
			kChildProcess.on('error', function(err) {
				if (err.errno === -4058)
					error('The command userver is not installed or not in your path');
				reject();
			});

			// Wait until the language server is spawned
			kChildProcess.on('spawn', function() {

				// Wait a bit for userver to create the socket
				let connected = false;
				let connectAttempts = 0;
				const kMaxConnectAttempts = 5;
				const kConnectWaitMilliseconds = 50;
				const kInterval = setInterval(function() {
					// Start to connect to the language server
					const kSocket = net.connect({
						host: host,
						port: port,
					});

					// Wait until the socket is connected
					kSocket.on('connect', function() {
						// Destroy a duplicate socket and stop
						if (connected) {
							kSocket.destroy();
							return;
						}
						connected = true;

						// Successfully connected
						const kStreamInfo = {
							writer: kSocket,
							reader: kSocket,
							detached: kDetached,
						};
						clearInterval(kInterval);
						resolve(kStreamInfo);
					});

					// Stop trying
					if (connectAttempts >= kMaxConnectAttempts) {
						error(`Tried to connect to userver ${kMaxConnectAttempts} times, waiting for ${kConnectWaitMilliseconds} ms each time`);
						clearInterval(kInterval);
						reject();
					}
					connectAttempts += 1;
				}, kConnectWaitMilliseconds);
			});
		});
	};

	// File types that will get Language Features like "Go to Definition"
	const kDocumentSelector = [
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
		// tcpPort: disconnect and restart
		// watcherInclude: createFileSystemWatcher

	// File types to watch for to notify the server when they are changed
	const kFileEventPattern = getConfig('watcherInclude', 'string');
	const kFileEvents = vscode.workspace.createFileSystemWatcher(kFileEventPattern);

	// Options to control the language client
	const kClientOptions = {
		documentSelector: kDocumentSelector,
		synchronize: {
			fileEvents: kFileEvents,
		},
	};

	// Create the language client
	const kClientId = 'UserverVscode';
	const kClientName = 'Userver VS Code';
	languageClient = new lc.LanguageClient(
		kClientId,
		kClientName,
		kServerOptions,
		kClientOptions
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
