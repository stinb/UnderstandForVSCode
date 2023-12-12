'use strict';


import { variables } from '../other/variables';


enum AnalysisKind {
	AllFiles,
	ChangedFiles,
	SpecificFiles,
}


// Analyze all files in all open projects
export function analyzeAllFiles()
{
	variables.languageClient.sendNotification('analyzeFiles', {
		analysisKind: AnalysisKind.AllFiles,
	});
}


// Analyze changed files in all open projects
export function analyzeChangedFiles()
{
	variables.languageClient.sendNotification('analyzeFiles', {
		analysisKind: AnalysisKind.ChangedFiles,
	});
}
