'use strict';


const vscode = require('vscode');
const net = require('node:net');
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


// Debug: output to log
function log(kItemToLog, kShow=true)
{
	if (logger === undefined)
		logger = vscode.window.createOutputChannel('Understand');

	logger.appendLine(kItemToLog);

	if (kShow)
		logger.show();
}


// Debug: info popup
function info(itemToShow)
{
	vscode.window.showInformationMessage(itemToShow);
}


// Debug: error popup
function error(itemToShow)
{
	vscode.window.showInformationMessage(itemToShow);
}


// Main function for when the extension is activated
function activate()
{
	// TODO: Automatically start userver, perhaps with kServerOptions

	// TODO: Improve createFileSystemWatcher to allow for an array of include/exclude globe patterns

	// TODO: If the user changes the option, then change something
		// tcpPort: disconnect and restart
		// watcherInclude: createFileSystemWatcher

	// Options to start and connect to the language server
	const kServerOptions = () => {
		const host = '127.0.0.1';
		const port = getConfig('tcpPort', 'integer');
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

	// // NOTE: Below is an attempt to start userver automatically, but it doesn't work yet
	// // Configure transport, args, and options for the executable server
	// const kTransport = {};
	// const kArgs = [];
	// const kOptions = {};
	// const kProtocol = getConfig('protocol', 'string');
	// switch (kProtocol) {
	// 	case 'TCP':
	// 		const kTcpPort = getConfig('tcpPort', 'integer');
	// 		if (isNaN(kTcpPort))
	// 			return error(`Value for understand.tcpPort is not a number: ${kTcpPort}`);
	// 		kTransport.kind = lc.TransportKind.socket;
	// 		kTransport.port = kTcpPort;
	// 		kArgs.push(`-tcp true -tcp_port ${kTcpPort}`);
	// 		kOptions.detached = true;
	// 		break;
	// 	default:
	// 		return error(`Value for understand.protocol is not a supported string: ${kProtocol}`);
	// }
	// // Options to start and connect to the language server
	// const kServerOptions = {
	// 	command: 'userver',
	// 	transport: kTransport,
	// 	args: kArgs,
	// 	options: kOptions,
	// };

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
