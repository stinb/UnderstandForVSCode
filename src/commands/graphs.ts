import { variables } from '../other/variables';


export function options()
{
	variables.graphProvider.toggleOptions();
}


export function save()
{
	variables.graphProvider.save();
}


export function view(name: string)
{
	variables.graphProvider.view(name);
}
