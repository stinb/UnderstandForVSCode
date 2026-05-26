import * as vscode from 'vscode';

import { variables } from '../other/variables';


/** Go to a location in a file (from the violations view) */
export async function goToLocation(uri: vscode.Uri, line: number, character: number)
{
	variables.preserveView = 'violations';
	await vscode.window.showTextDocument(uri, {
		selection: new vscode.Range(line, character, line, character),
	});
	variables.preserveView = '';
}


/** Fix violation (run the fix-it hint) */
export function fix()
{
	// The argument schema was found in the vscode repo:
	// src/vs/editor/contrib/codeAction/browser/codeActionCommands.ts
	vscode.commands.executeCommand('editor.action.codeAction', {
		kind: 'quickfix.fix',
	});
}


/** Go to next violation in all files */
export function goToNextViolationInAllFiles()
{
	vscode.commands.executeCommand('editor.action.marker.nextInFiles');
}


/** Go to next violation in current file */
export function goToNextViolationInCurrentFile()
{
	vscode.commands.executeCommand('editor.action.marker.next');
}


/** Go to previous violation in all files */
export function goToPreviousViolationInAllFiles()
{
	vscode.commands.executeCommand('editor.action.marker.prevInFiles');
}


/** Go to previous violation in current file */
export function goToPreviousViolationInCurrentFile()
{
	vscode.commands.executeCommand('editor.action.marker.prev');
}


/** Ignore violation (add a comment) */
export function ignore()
{
	// Due to a vscode bug, we can't easily find 'quickfix.ignore' when 'quickfix.ignore' is available but 'quickfix.fix' isn't available.
	// For a workaround, we find the 'quickfix.ignore' action by finding the preferred action.
	vscode.commands.executeCommand('editor.action.codeAction', {
		kind: 'quickfix',
		apply: 'first',
		preferred: true,
	});
}


/** Toggle whether the Problems panel (Violations) is focused and visible */
export function toggleVisibilityAndFocus()
{
	vscode.commands.executeCommand('workbench.actions.view.problems');
}
