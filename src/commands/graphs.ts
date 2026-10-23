import * as vscode from 'vscode';
import { variables } from '../other/variables';


export function options()
{
	variables.graphProvider.toggleOptions();
}


export function save()
{
	variables.graphProvider.save();
}


export function copyImage()
{
	variables.graphProvider.copyImage();
}


export function zoomIn()
{
	variables.graphProvider.zoom(1);
}


export function zoomOut()
{
	variables.graphProvider.zoom(-1);
}


export function findPrevious()
{
	variables.graphProvider.findStep(-1);
}


export function undo()
{
	variables.graphProvider.undo();
}


export function redo()
{
	variables.graphProvider.redo();
}


export function saveState()
{
	variables.graphProvider.saveState();
}


export function loadState()
{
	variables.graphProvider.loadState();
}


export function view(name: string, uniqueName?: string, label?: string, savedName?: string)
{
	variables.graphProvider.view(name, uniqueName, label, savedName);
}


/** The Saved Graphs item's context menu */
export async function removeSaved(item?: { saved?: { name: string, graphName: string, uniqueName: string } })
{
	const saved = item?.saved;
	if (!saved)
		return;
	const choice = await vscode.window.showWarningMessage(
		`Remove the saved graph state "${saved.name}"?`, { modal: true }, 'Remove');
	if (choice !== 'Remove')
		return;
	variables.languageClient.sendNotification('understand/graphs/state', {
		action: 'remove',
		graphName: saved.graphName,
		uniqueName: saved.uniqueName,
		name: saved.name,
	});
}


export function treemap()
{
	variables.treemapProvider.show();
}
