import * as vscode from 'vscode';


/** Show all settings for the extension in the Settings UI */
export function showSettings()
{
	vscode.commands.executeCommand('workbench.action.openSettings', `@ext:scitools.understand`);
}


/** Show setting for the project in the Settings UI */
export function showSettingsProject()
{
	vscode.commands.executeCommand('workbench.action.openSettings', '@ext:scitools.understand understand.project');
}



/** Show setting for the references view in the Settings UI */
export function showSettingsReferencesView()
{
	vscode.commands.executeCommand('workbench.action.openSettings', '@ext:scitools.understand understand.referencesView');
}
