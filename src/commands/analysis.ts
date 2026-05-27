import { executeAtPosition, executeCommand } from './helpers';


/** Analyze all files in all open projects */
export function analyzeAllFiles()
{
	executeCommand('understand.server.analysis.analyzeAllFiles');
}


/** Analyze changed files in all open projects */
export function analyzeChangedFiles()
{
	executeCommand('understand.server.analysis.analyzeChangedFiles');
}


/** Analyze the currently open file */
export function analyzeCurrentFile()
{
	executeAtPosition('understand.server.analysis.analyzeCurrentFile');
}


/** Stop analyzing files in all open projects */
export function stopAnalyzingFiles()
{
	executeCommand('understand.server.analysis.stopAnalyzingFiles');
}
