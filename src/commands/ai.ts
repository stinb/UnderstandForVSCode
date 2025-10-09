import { variables } from '../other/variables';
import { executeAtPosition, executeCommand } from './helpers';
import { pathToSave } from '../other/popup';


/** From JSON created in `AiViewProvider` */
interface AiAnnotation {
	id: string,
}


export function copyChat()
{
	variables.aiChatProvider.copyFocusedChat();
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
