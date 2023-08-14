const net     = require('node:net');
const path    = require('node:path');
const process = require('node:process');

const KIND_STDIO  = 0;
const KIND_IPC    = 1;
const KIND_PIPE   = 2;
const KIND_SOCKET = 3;

const KIND = KIND_SOCKET;

const CLIENT_TO_SERVER_NOTIFICATION_METHODS = new Set([
	'$/cancelRequest',
	'$/logTrace',
	'$/progress',
	'$/setTrace',
	'exit',
	'initialized',
	'notebookDocument/didChange',
	'notebookDocument/didClose',
	'notebookDocument/didOpen',
	'notebookDocument/didSave',
	'textDocument/didChange',
	'textDocument/didClose',
	'textDocument/didOpen',
	'textDocument/didSave',
	'textDocument/willSave',
	'window/workDoneProgress/cancel',
	'workspace/didChangeWatchedFiles',
	'workspace/didChangeWorkspaceFolders',
	'workspace/didChangeWorkspaceFolders',
	'workspace/didCreateFiles',
	'workspace/didDeleteFiles',
	'workspace/didRenameFiles',
]);

const SERVER_TO_CLIENT_NOTIFICATION_METHODS = new Set([
	'$/cancelRequest',
	'$/progress',
	'telemetry/event',
	'textDocument/publishDiagnostics',
	'workspace/didChangeConfiguration',
	'workspace/logMessage',
	'workspace/showMessage',
]);

const CLIENT_TO_SERVER_REQUEST_METHODS = new Set([
	'callHierarchy/incomingCalls',
	'callHierarchy/outgoingCalls',
	'codeAction/resolve',
	'codeLens/resolve',
	'completionItem/resolve',
	'documentLink/resolve',
	'initialize',
	'inlayHint/resolve',
	'shutdown',
	'textDocument.implementation',
	'textDocument.references',
	'textDocument/codeAction',
	'textDocument/codeLens',
	'textDocument/colorPresentation',
	'textDocument/completion',
	'textDocument/declaration',
	'textDocument/definition',
	'textDocument/diagnostic',
	'textDocument/documentColor',
	'textDocument/documentHighlight',
	'textDocument/documentLink',
	'textDocument/documentSymbol',
	'textDocument/foldingRange',
	'textDocument/formatting',
	'textDocument/hover',
	'textDocument/inlayHint',
	'textDocument/inlineValue',
	'textDocument/linkedEditingRange',
	'textDocument/moniker',
	'textDocument/onTypeFormatting',
	'textDocument/prepareCallHierarchy',
	'textDocument/prepareRename',
	'textDocument/prepareTypeHierarchy',
	'textDocument/rangeFormatting',
	'textDocument/rename',
	'textDocument/selectionRange',
	'textDocument/semanticTokens/full',
	'textDocument/semanticTokens/full/delta',
	'textDocument/semanticTokens/range',
	'textDocument/signatureHelp',
	'textDocument/typeDefinition',
	'textDocument/willSaveWaitUntil',
	'typeHierarchy/subtypes',
	'typeHierarchy/supertypes',
	'workspace/diagnostic',
	'workspace/executeCommand',
	'workspace/symbol',
	'workspace/willCreateFiles',
	'workspace/willDeleteFiles',
	'workspace/willRenameFiles',
	'workspaceSymbol/resolve',
]);

const SERVER_TO_CLIENT_REQUEST_METHODS = new Set([
	'client/registerCapability',
	'client/unregisterCapability',
	'window/showDocument',
	'window/showMessageRequest',
	'window/workDoneProgress/create',
	'workspace/applyEdit',
	'workspace/codeLens/refresh',
	'workspace/configuration',
	'workspace/diagnostic/refresh',
	'workspace/inlayHint/refresh',
	'workspace/inlineValue/refresh',
	'workspace/semanticTokens/refresh',
	'workspace/workspaceFolders',
]);

function separator()
{
	console.log('--------------------------------------------------------------------------------------------------------------');
}

function header(message)
{
	separator();
	console.log(message);
	separator();
}

function onConnection(conn)
{
	header('Opened');

	// Initialize array for each part
	const body = [];
	const maxBytes = 1 << 15;
	let bytes = 0;
	let contentLength;

	// Initialize client capabilities
	let client;

	function onData(buffer)
	{
		header('Data');

		// Stop if too many bytes
		if (bytes + buffer.length > maxBytes) {
			bytes = 0;
			body.length = 0;
			console.log(`ERROR: TOO MANY ACTUAL BYTES: ${bytes + buffer.length} OUT OF ${maxBytes} MAX`);
			return;
		}

		// If there's a header, copy the string beyond the header
		let string = buffer.toString();
		console.log(string);
		const match = /^Content-Length: ([1-9]\d*)\r\n\r\n/.exec(string);
		if (match) {
			bytes = 0;
			body.length = 0;
			contentLength = parseInt(match[1]);
			// Stop if too many bytes
			if (contentLength > maxBytes) {
				console.log(`ERROR: TOO MANY DECLARED BYTES: ${contentLength} OUT OF ${maxBytes} MAX`);
				return;
			}
			// Copy
			body.push(string.substr(match[0].length));
		}
		// Otherwise, copy the whole string
		else {
			// Copy
			body.push(string);
		}

		bytes += buffer.length;

		// Stop if not the end of request
		if (contentLength === undefined || bytes < contentLength)
			return;

		header('Data End');

		let req;
		try {
			req = JSON.parse(body.join(''));
			console.log(req);
		} catch (error) {
			console.log(body.join(''));
			return;
		}

		// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#abstractMessage
		// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#responseMessage
		const res = {
			jsonrpc: '2.0',
			id: req.id,
		};

		// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#initialize
		if (req.method === 'initialize') {
			client = req.params;

			// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#initializeResult
			res.result = {
				// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#serverCapabilities
				capabilities: {
					// callHierarchyProvider: true,
					// codeActionProvider: true,
					// colorProvider: true,
					// declarationProvider: true,
					definitionProvider: true,
					// documentFormattingProvider: true,
					// documentHighlightProvider: true,
					// documentRangeFormattingProvider: true,
					// documentSymbolProvider: true,
					// foldingRangeProvider: true,
					// hoverProvider: true,
					// implementationProvider: true,
					// inlayHintProvider: true,
					// inlineValueProvider: true,
					// linkedEditingRangeProvider: true,
					// monikerProvider: true,
					// referencesProvider: true,
					// renameProvider: true,
					// selectionRangeProvider: true,
					// typeDefinitionProvider: true,
					// typeHierarchyProvider: true,
					// workspaceSymbolProvider: true,
				},

				serverInfo: {
					name: 'Understand Server',
					version: '6.4',
				},
			};
		}
		// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_definition
		else if (req.method === 'textDocument/definition') {
			res.result = {
				uri: req.params.textDocument.uri,
				range: {
					start: {
						line: 0,
						character: 0,
					},
					end: {
						line: 0,
						character: 0,
					},
				},
			};
		}
		else if (CLIENT_TO_SERVER_NOTIFICATION_METHODS.has(req.method)) {
			return;
		}

		write(res);

		if (req.method === 'initialize' && client.capabilities?.textDocument?.publishDiagnostics)
			publishDiagnostics();
	}

	function publishDiagnostics()
	{
		header('Publish Diagnostics Notification');

		// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#abstractMessage
		// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#notificationMessage
		const notification = {
			jsonrpc: '2.0',
			method: 'textDocument/publishDiagnostics',
			// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#publishDiagnosticsParams
			params: {
				uri: 'file:///c%3A/Users/RobbyBennett/Projects/fastgrep/fastgrep/regexp.c',
				diagnostics: [
					// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#diagnostic
					{
						// Required
						message: "That's a bad Mr. Kitty!!!",
						range: {
							start: {
								line: 0,
								character: 0,
							},
							end: {
								line: 0,
								character: 0,
							},
						},

						// Optional
						source: 'Source Name',
						code: 'Diagnostic Name',
						severity: 1, // 1 error, 2 warning, 3 information, 4 hint
					}
				],
			},
		};

		write(notification);
	}

	function write(obj)
	{
		const objString = JSON.stringify(obj);
		conn.write(`Content-Length: ${objString.length}\r\n\r\n${objString}`);
	}

	function onClose()
	{
		header('Closed');
	}

	function onError(err)
	{
		header(`Error ${err.message}`);
	}

	conn.on('data', onData);
	conn.on('close', onClose);
	conn.on('error', onError);
}

function main()
{
	const server = net.createServer();

	const options = {};
	if (KIND === KIND_IPC) {
		// options.path = path.join('\\\\?\\pipe', process.cwd(), 'myctl');
		options.path = path.join(process.cwd(), 'server.sock');
	}
	else if (KIND === KIND_SOCKET) {
		options.host = '127.0.0.1';
		options.port = 8080;
	}

	server.on('connection', onConnection);
	server.listen(options);
}

main();
