'use strict';


import { executeAtPosition, executeCommand } from './helpers';


/** From JSON created in `AiViewProvider` */
interface AiAnnotation {
	id: string,
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
