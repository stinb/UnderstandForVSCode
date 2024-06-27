'use strict';


import * as vscode from 'vscode';

import { Dirent} from 'fs';
import { readdir } from 'fs/promises';
import { variables } from './variables';
import {
	getInitializationOptions,
	restartLsp,
} from './languageClient';


/** Get an array from the user config/options */
export function getArrayFromConfig(understandProject: string, defaultValue: any[] = []): any[]
{
	const value = getAnyFromConfig(understandProject);
	return Array.isArray(value) ? value : defaultValue;
}


/** Get a boolean from the user config/options */
export function getBooleanFromConfig(understandProject: string, defaultValue: boolean = false): boolean
{
	const value = getAnyFromConfig(understandProject);
	return (typeof value === 'boolean') ? value : defaultValue;
}


/** Get an integer from the user config/options */
export function getIntFromConfig(understandProject: string, defaultValue: number = NaN): number
{
	const value = getAnyFromConfig(understandProject);
	return (typeof value === 'number') ? Math.floor(value) : defaultValue;
}


/** Get a string from the user config/options */
export function getStringFromConfig(understandProject: string, defaultValue: string = ''): string
{
	const value = getAnyFromConfig(understandProject);
	return (typeof value === 'string') ? value : defaultValue;
}


/** Handle a setting that changed */
export function onDidChangeConfiguration(event: vscode.ConfigurationChangeEvent)
{
	// Skip settings that aren't in this extension
	if (!event.affectsConfiguration('understand'))
		return;

	// Decide whether to simply send the option to the server
	const settingsToNotifyServer = [
		'understand.analysis',
	];
	let shouldNotifyServer = false;
	for (const setting of settingsToNotifyServer) {
		if (event.affectsConfiguration(setting)) {
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
		if (event.affectsConfiguration(setting)) {
			shouldRestart = true;
			break;
		}
	}

	if (shouldNotifyServer && !shouldRestart)
		variables.languageClient.sendNotification('changeOptions', getInitializationOptions());

	if (shouldRestart)
		restartLsp();
}


/** Get the executable path of userver if UNIX-like, otherwise an empty string */
export async function getUserverPathIfUnix(): Promise<string>
{
	// Fail if not UNIX-like
	if (process.platform === 'win32')
		return '';

	// Fail if no PATH environment variable
	const pathCompontents = process.env.PATH;
	if (typeof pathCompontents !== 'string')
		return '';

	// Start reading all of the directories of the PATH environment variable
	const promises: Promise<Dirent[]>[] = [];
	for (const path of pathCompontents.split(':'))
		promises.push(readdir(path, {withFileTypes: true}).catch(() => []));

	// Starting at the first part, try to find userver
	for (const dir of await Promise.all(promises))
		for (const file of dir)
			if (file.name === 'userver' && (file.isFile() || file.isSymbolicLink()))
				return `${file.path}/${file.name}`;

	return '';
}


/** Get a value of any type from the user config/options */
function getAnyFromConfig(understandProject: string)
{
	return vscode.workspace.getConfiguration().get(`understand.${understandProject}`);
}
