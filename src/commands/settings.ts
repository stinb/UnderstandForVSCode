'use strict';


import * as vscode from 'vscode';


// Show all settings for the extension in the Settings UI
export function showSettings()
{
	vscode.commands.executeCommand('workbench.action.openSettings', `@ext:scitools.understand`);
}


// Show setting for for the extension in the Settings UI
export function showSettingProjectPaths()
{
	vscode.commands.executeCommand('workbench.action.openSettings', '@id:understand.project.paths');
}
