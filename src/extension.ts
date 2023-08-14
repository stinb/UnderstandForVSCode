const vscode = require('vscode');

const net = require('node:net');

const vscodeClientLanguage = require('vscode-languageclient');


let client;


// enum TransportKind {
// 	stdio,
// 	ipc,
// 	pipe,
// 	socket
// }


function activate(_context)
{
	const serverOptions = () => {
		const socket = net.connect({
			host: '127.0.0.1',
			port: 8080,
		});
		const result = {
			writer: socket,
			reader: socket
		};
		return Promise.resolve(result);
	};

	// Options to control the language client
	const clientOptions = {
		// Register the server for plain text documents
		// documentSelector: [{ scheme: 'file', language: 'plaintext' }],
		documentSelector: [
			{ scheme: 'file', language: 'c' },
			{ scheme: 'file', language: 'cpp' },
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new vscodeClientLanguage.LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}


function deactivate()
{
	if (!client) {
		return undefined;
	}
	return client.stop();
}


module.exports = {
	activate,
	deactivate,
};
