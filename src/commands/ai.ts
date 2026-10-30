import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { executeAtPosition, executeCommand } from './helpers';
import { pathToSave } from '../other/popup';
import { kAutomaticSetting } from '../viewProviders/ai';


/** From JSON created in `AiViewProvider` */
interface AiAnnotation {
	id: string,
}


export function copyChat()
{
	variables.aiChatProvider.copyFocusedChat();
}


export function deleteAllMessages()
{
	variables.aiChatProvider.deleteAllMessagesOfFocusedChat();
}


/** Generate an AI overview of the entity */
export function generateAiOverview(context?: AiAnnotation)
{
	const command = 'understand.server.ai.generateAiOverview';
	if (context)
		executeCommand(command, [{uniqueName: context.id}]);
	else
		executeAtPosition(command);
}


/** The AI Overview view's title-bar toggle: generate an overview for every
 * card the view shows, as Understand's AI Overview window does */
export function generateAutomatically()
{
	return setAutomaticGeneration(true);
}


/** The toggle's other state: a card waits for its sparkle */
export function generateOnClick()
{
	return setAutomaticGeneration(false);
}


async function setAutomaticGeneration(on: boolean)
{
	await vscode.workspace.getConfiguration().update(kAutomaticSetting, on, vscode.ConfigurationTarget.Global);
	variables.aiViewProvider.setAutomatic(on);
}


/** Save the chat as a file */
export async function saveChat()
{
	const result = await pathToSave([{extension: 'md', name: 'Markdown'}]);
	if (!result)
		return;

	const extension = result.extension;

	switch (extension) {
		case 'md':
			await variables.aiChatProvider.saveAsMarkdown(result.uri.fsPath);
			break;
		default:
			return;
	}
}


/** Generate an AI overview of the entity */
export function stopAiGeneration()
{
	executeAtPosition('understand.server.ai.stopAiGeneration');
}
