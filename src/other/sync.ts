import { variables } from './variables';


export function focusedUniqueName(): string
{
	let uniqueName = variables.aiChatProvider.focusedUniqueName();
	if (!uniqueName)
		uniqueName = variables.graphProvider.focusedUniqueName();
	return uniqueName;
}
