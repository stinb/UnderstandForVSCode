'use strict';


import * as vscode from 'vscode';
import * as lc from 'vscode-languageclient/node';

import { variables } from './variables';
import {
	getIntFromConfig,
	getStringFromConfig,
	getUserverPathIfUnix,
	handleWorkspaceConfiguration,
} from './config';
import {
	MainState,
	changeMainStatus,
	handleWindowWorkDoneProgressCreate,
	handleProgress,
	handleUnderstandChangedDatabaseState,
} from './statusBar';
import { handleUnderstandChangedAnnotations } from '../viewProviders/annotations';


/**
 * File types that can get the following features if they are implemented:
 * - LSP "Language Features" like go to definition
 * - VSCode "HoverProvider" like a detailed description of a violation
 */
export const documentSelector = [
	{ scheme: 'file' },
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
		variables.languageClient.onNotification('$/progress', handleProgress);
		variables.languageClient.onNotification('understand/changedAnnotations', handleUnderstandChangedAnnotations);
		variables.languageClient.onNotification('understand/changedDatabaseState', handleUnderstandChangedDatabaseState);
		variables.languageClient.onRequest('window/workDoneProgress/create', handleWindowWorkDoneProgressCreate);
		variables.languageClient.onRequest('workspace/configuration', handleWorkspaceConfiguration);
	}).catch(function() {
		changeMainStatus(MainState.NoConnection);
	});
}


/** Stop language client & language server */
export async function stopLsp()
{
	if (variables.languageClient === undefined || variables.languageClient.state !== lc.State.Running)
		return;

	return variables.languageClient.stop();
}


/** Options for starting the language client */
function getLanguageClientOptions(): lc.LanguageClientOptions
{
	return {
		documentSelector: documentSelector,
		initializationOptions: {
			uriScheme: vscode.env.uriScheme, // 'vscode'
			uriAuthority: 'scitools.understand',
		},
	};
}


/** Options for starting & communicating with the language server */
async function getLanguageServerOptions(): Promise<lc.ServerOptions>
{
	let transport: lc.Transport;
	switch (getStringFromConfig('understand.server.communicationProtocol')) {
		case 'TCP Socket':
			transport = {
				kind: lc.TransportKind.socket,
				port: getIntFromConfig('understand.server.communicationTcpPort', 6789),
			};
			break;
		default:
		case 'Named Pipe':
			transport = lc.TransportKind.pipe;
			break;
	}

	return {
		command: getStringFromConfig('understand.server.executable') || await getUserverPathIfUnix() || 'userver',
		transport: transport,
		options: {
			env: process.env, // Important for avoiding a bad analysis
		},
	};
}
