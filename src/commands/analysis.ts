import * as vscode from 'vscode';

import { executeAtPosition, executeCommand } from './helpers';


// Analysis reads the files on disk, so an edit still in an editor -- an
// ignore comment just written, a fix just made -- would be analyzed away
// and its violation come back (Rob 2026-09-21). The way a build task does,
// analysis saves what is open first.
async function saveOpenEditors()
{
	await vscode.workspace.saveAll(false);
}


/** Analyze all files in all open projects */
export async function analyzeAllFiles()
{
	await saveOpenEditors();
	executeCommand('understand.server.analysis.analyzeAllFiles');
}


/** Analyze changed files in all open projects */
export async function analyzeChangedFiles()
{
	await saveOpenEditors();
	executeCommand('understand.server.analysis.analyzeChangedFiles');
}


/** Analyze the currently open file */
export async function analyzeCurrentFile()
{
	await saveOpenEditors();
	executeAtPosition('understand.server.analysis.analyzeCurrentFile');
}


/** Stop analyzing files in all open projects */
export function stopAnalyzingFiles()
{
	executeCommand('understand.server.analysis.stopAnalyzingFiles');
}
