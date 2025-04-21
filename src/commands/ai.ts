'use strict';


import { executeAtPosition } from './helpers';


/** Generate an AI overview of the entity */
export function generateAiOverview()
{
	executeAtPosition('understand.server.ai.generateAiOverview');
}


/** Generate an AI overview of the entity */
export function stopAiGeneration()
{
	executeAtPosition('understand.server.ai.stopAiGeneration');
}
