import { variables } from '../other/variables';
import { executeAtPosition, executeCommand } from './helpers';


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


/** Generate an AI overview of the entity */
export function stopAiGeneration()
{
	executeAtPosition('understand.server.ai.stopAiGeneration');
}
