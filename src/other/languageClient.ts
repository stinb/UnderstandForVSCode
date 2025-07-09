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
import { onDidChangeActiveTextEditor, onDidChangeTextEditorSelection } from './context';
import { handleUnderstandChangedReferences } from '../viewProviders/references';
import { Section } from '../viewProviders/annotationMessage';


type AiClearParams = {
	chat: boolean,
	uniqueName: string,
};

type AiErrorParams = {
	chat: boolean,
	uniqueName: string,
	text: string,
};

type AiSectionParams = {
	annotationSections: Section[],
};

type AiTextParams = {
	chat: boolean,
	uniqueName: string,
	text: string,
};

type AiTextEndParams = {
	chat: boolean,
	uniqueName: string,
};


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
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			onDidChangeActiveTextEditor(editor);
			onDidChangeTextEditorSelection({textEditor: editor, selections: [], kind: undefined});
		}
		variables.languageClient.onNotification('$/progress', handleProgress);
		variables.languageClient.onNotification('understand/ai/clear', handleUnderstandAiClear);
		variables.languageClient.onNotification('understand/ai/error', handleUnderstandAiError);
		variables.languageClient.onNotification('understand/ai/text', handleUnderstandAiText);
		variables.languageClient.onNotification('understand/ai/textEnd', handleUnderstandAiTextEnd);
		variables.languageClient.onNotification('understand/changedAi', handleUnderstandChangedAi);
		variables.languageClient.onNotification('understand/changedAnnotations', handleUnderstandChangedAnnotations);
		variables.languageClient.onNotification('understand/changedDatabaseState', handleUnderstandChangedDatabaseState);
		variables.languageClient.onNotification('understand/changedReferences', handleUnderstandChangedReferences);
		variables.languageClient.onRequest('window/workDoneProgress/create', handleWindowWorkDoneProgressCreate);
		variables.languageClient.onRequest('workspace/configuration', handleWorkspaceConfiguration);
	}).catch(function(error) {
		if (typeof error === 'string')
			vscode.window.showErrorMessage(error);
		else if (error instanceof Error)
			vscode.window.showErrorMessage(error.message);
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


/** Tell the AI view to clear a card */
function handleUnderstandAiClear(params: AiClearParams)
{
	if (params.chat)
		variables.aiChatProvider.cardClear(params.uniqueName);
	else
		variables.aiViewProvider.cardClear(params.uniqueName);
}


/** Tell the AI view to clear a card and display the error */
function handleUnderstandAiError(params: AiErrorParams)
{
	if (params.chat)
		variables.aiChatProvider.cardError(params.uniqueName, params.text);
	else
		variables.aiViewProvider.cardError(params.uniqueName, params.text);
}


/** Tell the AI view to append text to a card */
function handleUnderstandAiText(params: AiTextParams)
{
	if (params.chat)
		variables.aiChatProvider.cardText(params.uniqueName, params.text);
	else
		variables.aiViewProvider.cardText(params.uniqueName, params.text);
}


/** Tell the AI view to show that a card has finished */
function handleUnderstandAiTextEnd(params: AiTextEndParams)
{
	if (params.chat)
		variables.aiChatProvider.cardTextEnd(params.uniqueName);
	else
		variables.aiViewProvider.cardTextEnd(params.uniqueName);
}


/** Tell the AI view to update its HTML */
function handleUnderstandChangedAi(params: AiSectionParams)
{
	variables.aiViewProvider.update(params.annotationSections);
}
