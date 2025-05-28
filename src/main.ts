import * as vscode from 'vscode';

import * as ai from './commands/ai';
import * as analysis from './commands/analysis';
import * as annotations from './commands/annotations';
import * as exploreInUnderstand from './commands/exploreInUnderstand';
import * as references from './commands/references';
import * as referencesView from './commands/referencesView';
import * as settings from './commands/settings';
import * as violations from './commands/violations';
import { onDidChangeConfiguration } from './other/config';
import { onDidChangeActiveTextEditor, onDidChangeTextEditorSelection } from './other/context';
import { onDidChange, onDidCreate, onDidDelete } from './other/fileSystem';
import { UnderstandHoverProvider } from './other/hover';
import { documentSelector, startLsp, stopLsp, } from './other/languageClient';
import { UnderstandUriHandler } from './other/uriHandler';
import { variables } from './other/variables';
import { URI_SCHEME_VIOLATION_DESCRIPTION, ViolationDescriptionProvider } from './other/textProviders';
import { AiViewProvider } from './viewProviders/ai';
import { AnnotationsViewProvider } from './viewProviders/annotations';
import { ReferencesTreeProvider } from './viewProviders/references';


let fileSystemWatcher: vscode.FileSystemWatcher | undefined;


/** Activate the extension */
export async function activate(context: vscode.ExtensionContext)
{
	variables.aiViewProvider = new AiViewProvider();
	variables.annotationsViewProvider = new AnnotationsViewProvider();
	variables.extensionUri = context.extensionUri;
	variables.referencesTreeProvider = new ReferencesTreeProvider();
	fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**');
	variables.violationDescriptionProvider = new ViolationDescriptionProvider();

	vscode.window.registerTreeDataProvider('understandReferences', variables.referencesTreeProvider);
	const treeView = vscode.window.createTreeView('understandReferences', {
		canSelectMany: true,
		treeDataProvider: variables.referencesTreeProvider,
		showCollapseAll: true,
	});
	context.subscriptions.push(treeView);

	// Commands visible in the palette are created in package.json

	context.subscriptions.push(
		// Commands: AI
		vscode.commands.registerCommand('understand.ai.generateAiOverview', ai.generateAiOverview),
		vscode.commands.registerCommand('understand.ai.regenerateAiOverview', ai.generateAiOverview),
		vscode.commands.registerCommand('understand.ai.stopAiGeneration', ai.stopAiGeneration),

		// Commands: Analysis
		vscode.commands.registerCommand('understand.analysis.analyzeAllFiles', analysis.analyzeAllFiles),
		vscode.commands.registerCommand('understand.analysis.analyzeChangedFiles', analysis.analyzeChangedFiles),
		vscode.commands.registerCommand('understand.analysis.stopAnalyzingFiles', analysis.stopAnalyzingFiles),

		// Commands: Annotations
		vscode.commands.registerCommand('understand.annotations.addAnnotation', annotations.addAnnotation),
		vscode.commands.registerCommand('understand.annotations.addEntityAnnotation', annotations.addEntityAnnotation),
		vscode.commands.registerCommand('understand.annotations.addFileAnnotation', annotations.addFileAnnotation),
		vscode.commands.registerCommand('understand.annotations.addLineAnnotation', annotations.addLineAnnotation),
		vscode.commands.registerCommand('understand.annotations.deleteAnnotation', annotations.deleteAnnotation),
		vscode.commands.registerCommand('understand.annotations.startEditingAnnotation', annotations.startEditingAnnotation),

		// Commands: Explore in Understand
		vscode.commands.registerCommand('understand.exploreInUnderstand.currentFile', exploreInUnderstand.currentFile),
		vscode.commands.registerCommand('understand.exploreInUnderstand.newProject', exploreInUnderstand.newProject),

		// Commands: References
		vscode.commands.registerCommand('understand.references.findAllImplementations', references.findAllImplementations),
		vscode.commands.registerCommand('understand.references.findAllReferences', references.findAllReferences),
		vscode.commands.registerCommand('understand.references.goToDeclaration', references.goToDeclaration),
		vscode.commands.registerCommand('understand.references.goToDefinition', references.goToDefinition),
		vscode.commands.registerCommand('understand.references.goToImplementations', references.goToImplementations),
		vscode.commands.registerCommand('understand.references.goToReferences', references.goToReferences),
		vscode.commands.registerCommand('understand.references.goToTypeDefinition', references.goToTypeDefinition),
		vscode.commands.registerCommand('understand.references.peekDeclaration', references.peekDeclaration),
		vscode.commands.registerCommand('understand.references.peekDefinition', references.peekDefinition),
		vscode.commands.registerCommand('understand.references.peekImplementations', references.peekImplementations),
		vscode.commands.registerCommand('understand.references.peekReferences', references.peekReferences),
		vscode.commands.registerCommand('understand.references.peekTypeDefinition', references.peekTypeDefinition),

		// Commands: References View
		vscode.commands.registerCommand('understand.referencesView.collapse', referencesView.collapse),
		vscode.commands.registerCommand('understand.referencesView.dismissEntity', referencesView.dismissEntity),
		vscode.commands.registerCommand('understand.referencesView.expand', referencesView.expand),
		vscode.commands.registerCommand('understand.referencesView.goToReference', referencesView.goToReference),
		vscode.commands.registerCommand('understand.referencesView.pinEntity', referencesView.pinEntity),

		// Commands: Settings
		vscode.commands.registerCommand('understand.settings.showSettings', settings.showSettings),
		vscode.commands.registerCommand('understand.settings.showSettingsProject', settings.showSettingsProject),
		vscode.commands.registerCommand('understand.settings.showSettingsReferencesView', settings.showSettingsReferencesView),

		// Commands: Violations
		vscode.commands.registerCommand('understand.violations.fix', violations.fix),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInAllFiles', violations.goToNextViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInCurrentFile', violations.goToNextViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInAllFiles', violations.goToPreviousViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInCurrentFile', violations.goToPreviousViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.ignore', violations.ignore),
		vscode.commands.registerCommand('understand.violations.toggleVisibilityAndFocus', violations.toggleVisibilityAndFocus),

		// Hover provider, for detailed descriptions
		vscode.languages.registerHoverProvider(documentSelector, new UnderstandHoverProvider()),

		// Watch for settings changes, which should prompt the user to re-connect
		vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration),

		vscode.workspace.registerTextDocumentContentProvider(URI_SCHEME_VIOLATION_DESCRIPTION, variables.violationDescriptionProvider),

		// Watch for editor focus changing, which should change the 'understandFile' context
		vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor),
		vscode.window.onDidChangeTextEditorSelection(onDidChangeTextEditorSelection),

		// Handle the violation-descriptions: URI
		vscode.window.registerUriHandler(new UnderstandUriHandler()),

		// Create web views
		vscode.window.registerWebviewViewProvider('understandAi', variables.aiViewProvider),
		vscode.window.registerWebviewViewProvider('understandAnnotations', variables.annotationsViewProvider),
		// vscode.window.registerTreeDataProvider('understandReferences', variables.referencesTreeProvider),

		// Watch for file changes, creations, and deletions
		fileSystemWatcher.onDidChange(onDidChange),
		fileSystemWatcher.onDidCreate(onDidCreate),
		fileSystemWatcher.onDidDelete(onDidDelete),
	);

	startLsp();
}


/** Deactivate the extension */
export function deactivate()
{
	return stopLsp();
}
