'use strict';


import * as vscode from 'vscode';
import * as lc from 'vscode-languageclient/node';

import { variables } from './variables';
import {
	getArrayFromConfig,
	getBooleanFromConfig,
	getIntFromConfig,
	getStringFromConfig,
	getUserverPathIfUnix,
} from './config';
import {
	MainState,
	changeMainStatus,
	handleWindowWorkDoneProgressCreate,
	handleProgress,
} from './statusBar';


/**
 * File types that can get the following features if they are implemented:
 * - LSP "Language Features" like go to definition
 * - VSCode "HoverProvider" like a detailed description of a violation
 */
export const documentSelector = [
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
	{ scheme: 'file', language: 'objective-c' },
	{ scheme: 'file', language: 'objective-cpp' },
	{ scheme: 'file', language: 'pascal' },
	{ scheme: 'file', language: 'perl' },
	{ scheme: 'file', language: 'php' },
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


/** Restart language client & language server */
export async function restartLsp()
{
	return stopLsp().then(async function() {
		return startLsp().catch();
	}).catch();
}


/** Start language client & language server */
export async function startLsp()
{
	// Create the language client
	variables.languageClient = new lc.LanguageClient(
		'Understand',
		await getLanguageServerOptions(),
		getLanguageClientOptions(),
	);

	// Start the language client & language server
	changeMainStatus(MainState.Connecting);
	return variables.languageClient.start().then(function() {
		changeMainStatus(MainState.Ready);
		variables.languageClient.onRequest('window/workDoneProgress/create', handleWindowWorkDoneProgressCreate);
		variables.languageClient.onNotification('$/progress', handleProgress);
	}).catch(function() {
		changeMainStatus(MainState.NoConnection);
	});
}


/** Stop language client & language server */
export async function stopLsp()
{
	if (variables.languageClient !== undefined && variables.languageClient.state === lc.State.Running)
		return variables.languageClient.stop();
}


/** Get value of initializationOptions object that the language client will send */
export function getInitializationOptions()
{
	const pathFindingMethodManual = getStringFromConfig('project.pathFindingMethod') === 'Manual';
	const projectPaths = getArrayFromConfig('project.paths');

	// Warn the user if the method is automatic, a path is set, and it's ignored
	if (!pathFindingMethodManual && projectPaths.length > 0)
		vscode.window.showInformationMessage('Project path(s) ignored because setting "project.pathFindingMethod" is not "Manual"');

	return {
		automaticallyAnalyze: getBooleanFromConfig('analysis.automaticallyAnalyze', true),
		projectPaths: pathFindingMethodManual ? projectPaths : [],
	};
}


/** Options for starting the language client */
function getLanguageClientOptions(): lc.LanguageClientOptions
{
	return {
		documentSelector: documentSelector,
		initializationOptions: getInitializationOptions(),
	};
}


/** Options for starting & communicating with the language server */
async function getLanguageServerOptions(): Promise<lc.ServerOptions>
{
	let transport: lc.Transport;
	switch (getStringFromConfig('server.communicationProtocol')) {
		case 'TCP Socket':
			transport = {
				kind: lc.TransportKind.socket,
				port: getIntFromConfig('server.communicationTcpPort', 6789),
			};
			break;
		default:
		case 'Named Pipe':
			transport = lc.TransportKind.pipe;
			break;
	}

	return {
		command: getStringFromConfig('server.executable') || await getUserverPathIfUnix() || 'userver',
		transport: transport,
		options: {
			env: process.env, // Important for avoiding a bad analysis
		},
	};
}
