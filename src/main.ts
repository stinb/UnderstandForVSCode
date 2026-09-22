import * as vscode from 'vscode';

import * as ai from './commands/ai';
import * as aiProviderSettings from './commands/aiProviderSettings';
import * as analysis from './commands/analysis';
import * as annotations from './commands/annotations';
import * as exploreInUnderstand from './commands/exploreInUnderstand';
import * as graphs from './commands/graphs';
import * as metrics from './commands/metrics';
import * as references from './commands/references';
import * as referencesView from './commands/referencesView';
import * as settings from './commands/settings';
import * as violations from './commands/violations';
import { onDidChangeConfiguration } from './other/config';
import { UnderstandHoverProvider } from './other/hover';
import { documentSelector, startLsp, stopLsp, } from './other/languageClient';
import { UnderstandUriHandler } from './other/uriHandler';
import { variables } from './other/variables';
import { activateAnnotationDecorations, refreshAnnotationDecorations } from './other/annotationDecorations';
import { AnnotateCodeLensProvider, AnnotationHoverProvider } from './other/annotationEditor';
import { annotateLine } from './commands/annotateLine';
import { openAnnotation, openAnnotationFromBrowser, openFieldFromBrowser } from './commands/openAnnotation';
import { gutterAnnotate, gutterDelete, gutterOpen, openAnnotationHere } from './commands/gutterMenu';
import { editAnnotationFields, retypeAnnotation } from './commands/editAnnotationFields';
import { annotateArchitecture, attachAnnotationMedia, openAnnotationMedia } from './commands/annotationMedia';
import { CheckCodeActionProvider, showCheck } from './commands/showCheck';
import { AiViewProvider } from './viewProviders/ai';
import { AnnotationTreeProvider, AnnotationRowDecorations, annotationsGroupBy, annotationsShowAllFiles, annotationsShowCurrentFile, annotationsShowIncomplete, annotationsShowComplete } from './treeProviders/annotations';
import { ignoreViolationWithDetails } from './commands/ignoreTemplates';
import { ignoreInline, ignoreWithAnnotation } from './commands/ignoreViolation';
import { InfoTreeProvider } from './treeProviders/info';
import { ViolationTreeProvider, openViolation, violationsGroupBy } from './treeProviders/violations';
import { GraphProvider } from './other/graphProvider';
import { GraphTreeProvider } from './treeProviders/graphs';
import { MetricTreeProvider } from './treeProviders/metrics';
import { ReferencesTreeProvider } from './treeProviders/references';
import { watchFiles } from './other/fileSystem';
import { actuallyChangedTextEditorSelection, invalidateFileStatus, onDidChangeTextEditorSelection } from './other/context';
import { fileDecorationProvider } from './other/fileDecorations';


/** Activate the extension */
export async function activate(context: vscode.ExtensionContext)
{
	variables.aiViewProvider = new AiViewProvider();
	variables.annotationsTreeProvider = new AnnotationTreeProvider();
	variables.extensionUri = context.extensionUri;
	variables.graphTreeProvider = new GraphTreeProvider();
	variables.infoTreeProvider = new InfoTreeProvider();
	variables.graphProvider = new GraphProvider();
	variables.metricTreeProvider = new MetricTreeProvider();
	variables.referencesTreeProvider = new ReferencesTreeProvider();
	variables.violationsListProvider = new ViolationTreeProvider();

	watchFiles();

	// Commands visible in the palette are created in package.json

	context.subscriptions.push(
		// Commands: AI
		vscode.commands.registerCommand('understand.ai.editProviderSettings', () => aiProviderSettings.editProviderSettings(context)),
		vscode.commands.registerCommand('understand.ai.copyChat', ai.copyChat),
		vscode.commands.registerCommand('understand.ai.deleteAllMessages', ai.deleteAllMessages),
		vscode.commands.registerCommand('understand.ai.generateAiOverview', ai.generateAiOverview),
		vscode.commands.registerCommand('understand.ai.regenerateAiOverview', ai.generateAiOverview),
		vscode.commands.registerCommand('understand.ai.saveChat', ai.saveChat),
		vscode.commands.registerCommand('understand.ai.stopAiGeneration', ai.stopAiGeneration),

		// Commands: Analysis
		vscode.commands.registerCommand('understand.analysis.analyzeAllFiles', analysis.analyzeAllFiles),
		vscode.commands.registerCommand('understand.analysis.analyzeChangedFiles', analysis.analyzeChangedFiles),

		// Commands: Checks
		// The check behind a violation, as a card in the field editor window:
		// from the Violations row, the lightbulb, and the Problems panel's link.
		vscode.commands.registerCommand('understand.checks.show', showCheck),
		vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, new CheckCodeActionProvider(),
			{ providedCodeActionKinds: CheckCodeActionProvider.kinds }),
		vscode.commands.registerCommand('understand.annotations.groupBy', annotationsGroupBy),
		vscode.commands.registerCommand('understand.annotations.showAllFiles', annotationsShowAllFiles),
		vscode.commands.registerCommand('understand.annotations.showCurrentFile', annotationsShowCurrentFile),
		vscode.commands.registerCommand('understand.annotations.showIncomplete', annotationsShowIncomplete),
		vscode.commands.registerCommand('understand.annotations.showComplete', annotationsShowComplete),
		vscode.commands.registerCommand('understand.annotations.openFromBrowser', openAnnotationFromBrowser),
		vscode.commands.registerCommand('understand.violations.open', openViolation),
		vscode.commands.registerCommand('understand.violations.ignoreInline', ignoreInline),
		vscode.commands.registerCommand('understand.violations.ignoreWithAnnotation', ignoreWithAnnotation),
		vscode.commands.registerCommand('understand.annotations.openFieldFromBrowser', openFieldFromBrowser),
		vscode.commands.registerCommand('understand.ignoreViolationWithDetails', ignoreViolationWithDetails),
		vscode.commands.registerCommand('understand.violations.groupBy', violationsGroupBy),
		vscode.commands.registerCommand('understand.violations.openCodeCheckConfiguration', violations.openCodeCheckConfiguration),
		vscode.commands.registerCommand('understand.violations.excludeFromCodeCheck', violations.excludeFromCodeCheck),
		vscode.commands.registerCommand('understand.violations.excludeFolderFromCodeCheck', violations.excludeFolderFromCodeCheck),
		vscode.commands.registerCommand('understand.violations.editExcludedPaths', violations.editExcludedPaths),
		vscode.commands.registerCommand('understand.analysis.analyzeCurrentFile', analysis.analyzeCurrentFile),
		vscode.commands.registerCommand('understand.analysis.stopAnalyzingFiles', analysis.stopAnalyzingFiles),

		// Commands: Annotations
		vscode.commands.registerCommand('understand.annotations.addAnnotation', annotations.addAnnotation),
		vscode.commands.registerCommand('understand.annotations.deleteAnnotation', annotations.deleteAnnotation),
		vscode.commands.registerCommand('understand.annotations.deleteSelected', annotations.deleteSelectedAnnotations),
		// "Edit Text" and "Edit Fields" are the one editor: the form shows a
		// freeform annotation's note and a templated one's fields.
		vscode.commands.registerCommand('understand.annotations.startEditingAnnotation', editAnnotationFields),

		// Commands: Explore in Understand
		vscode.commands.registerCommand('understand.exploreInUnderstand.currentFile', exploreInUnderstand.currentFile),
		vscode.commands.registerCommand('understand.exploreInUnderstand.newProject', exploreInUnderstand.newProject),

		// Commands: Graphs
		vscode.commands.registerCommand('understand.graphs.options', graphs.options),
		vscode.commands.registerCommand('understand.graphs.save', graphs.save),
		vscode.commands.registerCommand('understand.graphs.view', graphs.view),

		// Commands: Metrics
		vscode.commands.registerCommand('understand.metrics.copyApiName', metrics.copyApiName),
		vscode.commands.registerCommand('understand.metrics.copyFriendlyNameAndValue', metrics.copyFriendlyNameAndValue),
		vscode.commands.registerCommand('understand.metrics.documentation', metrics.documentation),

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
		vscode.commands.registerCommand('understand.referencesView.dismissEntity', referencesView.dismissEntity),
		vscode.commands.registerCommand('understand.referencesView.goToReference', referencesView.goToReference),
		vscode.commands.registerCommand('understand.referencesView.pinEntity', referencesView.pinEntity),

		// Commands: Settings
		vscode.commands.registerCommand('understand.settings.showSettings', settings.showSettings),
		vscode.commands.registerCommand('understand.settings.showSettingsProject', settings.showSettingsProject),
		vscode.commands.registerCommand('understand.settings.showSettingsMetricsView', settings.showSettingsMetricsView),
		vscode.commands.registerCommand('understand.settings.showSettingsReferencesView', settings.showSettingsReferencesView),

		// Commands: Violations
		vscode.commands.registerCommand('understand.violations.fix', violations.fix),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInAllFiles', violations.goToNextViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToNextViolationInCurrentFile', violations.goToNextViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInAllFiles', violations.goToPreviousViolationInAllFiles),
		vscode.commands.registerCommand('understand.violations.goToPreviousViolationInCurrentFile', violations.goToPreviousViolationInCurrentFile),
		vscode.commands.registerCommand('understand.violations.ignore', violations.ignore),
		vscode.commands.registerCommand('understand.violations.toggleVisibilityAndFocus', violations.toggleVisibilityAndFocus),

		// Commands: Violations View
		vscode.commands.registerCommand('understand.violationsView.goToLocation', violations.goToLocation),

		// Hover provider, for detailed descriptions
		vscode.languages.registerHoverProvider(documentSelector, new UnderstandHoverProvider()),

		// Watch for settings changes, which should prompt the user to re-connect
		vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration),

		// Watch for editor focus changing, which should change the 'understandFile' context
		vscode.window.onDidChangeActiveTextEditor(actuallyChangedTextEditorSelection),
		vscode.window.onDidChangeTextEditorSelection(onDidChangeTextEditorSelection),

		// A save can make the file's analysis stale: refresh the status bar
		vscode.workspace.onDidSaveTextDocument(() => {
			invalidateFileStatus();
			actuallyChangedTextEditorSelection();
		}),

		// The file status on the file name itself: explorer, editor tab and
		// Open Editors (ext #6)
		vscode.window.registerFileDecorationProvider(fileDecorationProvider),

		// The violation-descriptions URI every diagnostic links to: the check card
		vscode.window.registerUriHandler(new UnderstandUriHandler()),

		// Create web views
		vscode.window.registerWebviewViewProvider('understandAi', variables.aiViewProvider),
		// Paints a Browser row red while its record has a required field empty.
		vscode.window.registerFileDecorationProvider(new AnnotationRowDecorations()),
		(() => {
			const view = vscode.window.createTreeView('understandViolationsList', { treeDataProvider: variables.violationsListProvider });
			variables.violationsListProvider.attach(view);
			return view;
		})(),
		(() => {
			const view = vscode.window.createTreeView('understandAnnotationBrowser',
				{ treeDataProvider: variables.annotationsTreeProvider, canSelectMany: true });
			variables.annotationsTreeProvider.attach(view);
			return view;
		})(),
		vscode.window.registerTreeDataProvider('understandGraphs', variables.graphTreeProvider),
		vscode.window.registerTreeDataProvider('understandInfo', variables.infoTreeProvider),
		vscode.window.registerTreeDataProvider('understandMetrics', variables.metricTreeProvider),
		vscode.window.registerTreeDataProvider('understandReferences', variables.referencesTreeProvider),
	);

	// The editor's own annotation affordances: an icon in the gutter of a
	// line that has one, a hover that reads it, and a lens on the cursor's
	// line to add one. See annotationDecorations.ts for what VS Code can and
	// cannot do here.
	activateAnnotationDecorations(context);
	variables.annotateCodeLensProvider = new AnnotateCodeLensProvider();
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(
			{ scheme: 'file' }, new AnnotationHoverProvider()),
		vscode.languages.registerCodeLensProvider(
			{ scheme: 'file' }, variables.annotateCodeLensProvider),
		// The lens sits on the cursor's line, so it is re-asked as the cursor
		// moves and as the active editor changes.
		vscode.window.onDidChangeTextEditorSelection(
			() => variables.annotateCodeLensProvider.refresh()),
		// The lens offers to ignore the line's violations, so it follows them.
		vscode.languages.onDidChangeDiagnostics(
			() => variables.annotateCodeLensProvider.refresh()),
		vscode.window.onDidChangeActiveTextEditor(() => {
			variables.annotateCodeLensProvider.refresh();
			variables.annotationsTreeProvider.activeFileChanged();
		}),
		// The annotation switches (understand.annotations.enabled, .gutterIcons)
		// take effect at once: marks redrawn, the lens re-asked.
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('understand.annotations')) {
				refreshAnnotationDecorations();
				variables.annotateCodeLensProvider.refresh();
			}
		}),
		vscode.commands.registerCommand('understand.annotateLine', annotateLine),
		// The gutter's right-click menu: the line comes with the click.
		vscode.commands.registerCommand('understand.gutter.annotate', gutterAnnotate),
		vscode.commands.registerCommand('understand.gutter.open', gutterOpen),
		vscode.commands.registerCommand('understand.gutter.delete', gutterDelete),
		// The CodeLens on an annotated line, and the hover's Open link.
		vscode.commands.registerCommand('understand.annotations.openNextOnLine', openAnnotationHere),
		vscode.commands.registerCommand('understand.annotations.open', openAnnotation),
		vscode.commands.registerCommand('understand.annotations.editFields', editAnnotationFields),
		vscode.commands.registerCommand('understand.annotations.retype', retypeAnnotation),
		vscode.commands.registerCommand('understand.annotations.attachMedia', attachAnnotationMedia),
		vscode.commands.registerCommand('understand.annotations.openMedia', openAnnotationMedia),
		vscode.commands.registerCommand('understand.annotateArchitecture', annotateArchitecture),
	);

	startLsp();
}


/** Deactivate the extension */
export function deactivate()
{
	return stopLsp();
}
