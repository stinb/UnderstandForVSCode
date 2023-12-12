'use strict';


import * as vscode from 'vscode';


// Fix violation (run the fix-it hint)
export function fix()
{
	vscode.commands.executeCommand('editor.action.autoFix');
}


// Go to next violation in all files
export function goToNextViolationInAllFiles()
{
	vscode.commands.executeCommand('editor.action.marker.nextInFiles');
}


// Go to next violation in current file
export function goToNextViolationInCurrentFile()
{
	vscode.commands.executeCommand('editor.action.marker.next');
}


// Go to previous violation in all files
export function goToPreviousViolationInAllFiles()
{
	vscode.commands.executeCommand('editor.action.marker.prevInFiles');
}


// Go to previous violation in current file
export function goToPreviousViolationInCurrentFile()
{
	vscode.commands.executeCommand('editor.action.marker.prev');
}


// Toggle whether the Problems panel (Violations) is focused and visible
export function togglePanelVisibilityAndFocus()
{
	vscode.commands.executeCommand('workbench.actions.view.problems');
}
