'use strict';


import * as vscode from 'vscode';

import { variables } from './variables';
import {
	getInitializationOptions,
	restartLsp,
} from './languageClient';


// Get an array from the user config/options
export function getArrayFromConfig(understandProject: string, defaultValue: any[] = []): any[]
{
	const value = getAnyFromConfig(understandProject);
	return Array.isArray(value) ? value : defaultValue;
}


// Get a boolean from the user config/options
export function getBooleanFromConfig(understandProject: string, defaultValue: boolean = false): boolean
{
	const value = getAnyFromConfig(understandProject);
	return (typeof value === 'boolean') ? value : defaultValue;
}


// Get an integer from the user config/options
export function getIntFromConfig(understandProject: string, defaultValue: number = NaN): number
{
	const value = getAnyFromConfig(understandProject);
	return (typeof value === 'number') ? Math.floor(value) : defaultValue;
}


// Get a string from the user config/options
export function getStringFromConfig(understandProject: string, defaultValue: string = ''): string
{
	const value = getAnyFromConfig(understandProject);
	return (typeof value === 'string') ? value : defaultValue;
}


// Handle a setting that changed
export function onDidChangeConfiguration(configurationChangeEvent: vscode.ConfigurationChangeEvent)
{
	// Skip settings that aren't in this extension
	if (!configurationChangeEvent.affectsConfiguration('understand'))
		return;

	// Decide whether to simply send the option to the server
	const settingsToNotifyServer = [
		'understand.analysis',
	];
	let shouldNotifyServer = false;
	for (const setting of settingsToNotifyServer) {
		if (configurationChangeEvent.affectsConfiguration(setting)) {
			shouldNotifyServer = true;
			break;
		}
	}

	// Decide whether to restart both the server and the client
	const settingsToRestart = [
		'understand.files',
		'understand.project',
		'understand.server',
	];
	let shouldRestart = false;
	for (const setting of settingsToRestart) {
		if (configurationChangeEvent.affectsConfiguration(setting)) {
			shouldRestart = true;
			break;
		}
	}

	if (shouldNotifyServer && !shouldRestart)
		variables.languageClient.sendNotification('changeOptions', getInitializationOptions());

	if (shouldRestart)
		restartLsp();
}


// Get a value of any type from the user config/options
function getAnyFromConfig(understandProject: string)
{
	return vscode.workspace.getConfiguration().get(`understand.${understandProject}`);
}
