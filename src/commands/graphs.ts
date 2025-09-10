import { variables } from '../other/variables';


export function view(args: string[])
{
	variables.graphProvider.view(args[0]);
}
