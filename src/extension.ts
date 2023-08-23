'use strict';


const vscode = require('vscode');
const net = require('node:net');
const vscodeLanguageClient = require('vscode-languageclient');


let languageClient;
let logger;


function getConfig(key)
{
	return vscode.workspace.getConfiguration().get(`understand.${key}`);
}


// Call this instead of getConfig('tcpPort') because the value could be floating-point
function getTcpPort()
{
	return Math.floor(getConfig('tcpPort'));
}


function log(itemToLog, show=true)
{
	if (logger === undefined)
		logger = vscode.window.createOutputChannel('Understand');

	logger.appendLine(itemToLog);

	if (show)
		logger.show();
}


function activate(_context)
{
	// TODO: Automatically start userver, perhaps with serverOptions

	// TODO: Improve createFileSystemWatcher to allow for an array of include/exclude globe patterns

	// TODO: If the user changes the option, then change something
		// tcpPort: disconnect and restart
		// watcherInclude: createFileSystemWatcher

	// Options to start and connect to the language server
	const serverOptions = () => {
		const host = '127.0.0.1';
		const port = getTcpPort();
		const socket = net.connect({
			host: host,
			port: port,
		});
		const result = {
			writer: socket,
			reader: socket
		};
		return Promise.resolve(result);
	};

	// Options to control the language client
	const clientOptions = {
		synchronize: {
			// Notify the server about file changes to supported files in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher(getConfig('watcherInclude'))
		}
	};

	// Create the language client and start the client
	const clientId = 'UserverVscode';
	const clientName = 'Userver VS Code';
	languageClient = new vscodeLanguageClient.LanguageClient(
		clientId,
		clientName,
		serverOptions,
		clientOptions
	);

	// Start the client and also the server if it isn't running
	languageClient.start();
}


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
