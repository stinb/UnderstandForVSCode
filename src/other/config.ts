'use strict';


import * as vscode from 'vscode';
import * as lc from 'vscode-languageclient/node';

import * as fs from 'fs';
import { Dirent } from 'fs';
import { readdir } from 'fs/promises';
import { variables } from './variables';
import { restartLsp } from './languageClient';


/** Get an array of zero or more strings from the user config/options */
export function getStringArrayFromConfig(id: string, defaultValue: string[] = []): string[]
{
	const value = getAnyFromConfig(id);

	if (!Array.isArray(value))
		return defaultValue;

	for (let i = 0; i < value.length; i++)
		if (typeof(value[i]) !== 'string')
			return defaultValue;

	return value;
}


/** Get a boolean from the user config/options */
export function getBooleanFromConfig(id: string, defaultValue: boolean = false): boolean
{
	const value = getAnyFromConfig(id);
	return (typeof value === 'boolean') ? value : defaultValue;
}


/** Get an integer from the user config/options */
export function getIntFromConfig(id: string, defaultValue: number = NaN): number
{
	const value = getAnyFromConfig(id);
	return (typeof value === 'number') ? Math.floor(value) : defaultValue;
}


/** Get a string from the user config/options */
export function getStringFromConfig(id: string, defaultValue: string = ''): string
{
	const value = getAnyFromConfig(id);
	return (typeof value === 'string') ? value : defaultValue;
}


export function handleWorkspaceConfiguration(params: lc.ConfigurationParams)
{
	const result = [];
	for (const item of params.items) {
		if (typeof(item.section) !== 'string')
			continue;
		variables.watchedSettings.push(item.section);
		result.push(getAnyFromConfig(item.section));
	}
	return result;
}


/** Handle a setting that changed */
export function onDidChangeConfiguration(event: vscode.ConfigurationChangeEvent)
{
	// Skip settings that aren't in this extension
	if (!event.affectsConfiguration('understand'))
		return;

	// Decide whether to simply send the option to the server
	let shouldNotify = false;
	const params = {
		settings: {
			result: [],
		}
	};
	for (const setting of variables.watchedSettings) {
		params.settings.result.push(getAnyFromConfig(setting));
		if (event.affectsConfiguration(setting))
			shouldNotify = true;
	}

	// Decide whether to simply send the option to the server
	const settingsToRestart = [
		'understand.server',
	];
	let shouldRestart = false;
	for (const setting of settingsToRestart) {
		if (event.affectsConfiguration(setting)) {
			shouldRestart = true;
			break;
		}
	}

	if (shouldNotify && !shouldRestart)
		variables.languageClient.sendNotification('workspace/didChangeConfiguration', params);

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

	// Try to find it in the default location on Mac
	if (process.platform === 'darwin') {
		const path = '/Applications/Understand.app/Contents/MacOS/userver';
		if (fs.existsSync(path))
			return path;
	}

	return '';
}


/** Get a value of any type from the user config/options */
function getAnyFromConfig(id: string)
{
	return vscode.workspace.getConfiguration().get(id);
}
