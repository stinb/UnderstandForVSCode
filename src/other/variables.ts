import { FileSystemWatcher, Uri } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { AiChatProvider } from './aiChatProvider';
import { AiViewProvider } from '../viewProviders/ai';
import { AnnotationTreeProvider } from '../treeProviders/annotations';
import { InfoTreeProvider } from '../treeProviders/info';
import { ViolationTreeProvider } from '../treeProviders/violations';
import { AnnotateCodeLensProvider } from './annotationEditor';
import { GraphTreeProvider } from '../treeProviders/graphs';
import { MetricTreeProvider } from '../treeProviders/metrics';
import { ReferencesTreeProvider } from '../treeProviders/references';
import { GraphProvider } from '../other/graphProvider';
import { TreemapProvider } from '../other/treemapProvider';


/** Global variables used in different files */
export const variables: Variables = {
	// Whether the licence grants GUI Access, which the graphs that are not an
	// entity's need. True until the server says otherwise: the server refuses
	// those graphs itself, and an older server that never says has no limit.
	guiLicensed: true,
	// Whether the licence grants Export & Share Reports/Metrics, which the
	// treemap needs. True until the server says otherwise, as above.
	exportLicensed: true,
	// Whether the licence grants AI. False until the server says otherwise,
	// so nothing AI-related runs before we know (und-issues#709).
	aiLicensed: false,
	aiChatProvider: new AiChatProvider,
	// @ts-ignore initialized in `activate`
	aiViewProvider: undefined,
	// @ts-ignore initialized in `activate`
	annotateCodeLensProvider: undefined,
	// @ts-ignore initialized in `activate`
	annotationsTreeProvider: undefined,
	// @ts-ignore initialized in `activate`
	extensionUri: undefined,
	// @ts-ignore initialized in `activate`
	fileSystemWatcher: undefined,
	// @ts-ignore initialized in `activate`
	graphProvider: undefined,
	// @ts-ignore initialized in `activate`
	graphTreeProvider: undefined,
	// @ts-ignore initialized in `activate`
	infoTreeProvider: undefined,
	// @ts-ignore TODO audit this
	languageClient: undefined,
	// The server's own account of why it stopped serving, when its licence was
	// lost (understand/licenseLost); empty while the licence holds. Read by
	// the client's close handler so a licence loss is reported once instead of
	// restarting the server until VS Code calls it a crash.
	licenseLost: '',
	// @ts-ignore initialized in `activate`
	metricTreeProvider: undefined,
	// The view to leave alone for now
	preserveView: '',
	// @ts-ignore initialized in `activate`
	referencesTreeProvider: undefined,
	// @ts-ignore initialized in `activate`
	treemapProvider: undefined,
	// @ts-ignore initialized in `activate`
	violationsListProvider: undefined,
};


interface Variables {
	aiChatProvider: AiChatProvider,
	aiLicensed: boolean,
	aiViewProvider: AiViewProvider,
	annotateCodeLensProvider: AnnotateCodeLensProvider,
	annotationsTreeProvider: AnnotationTreeProvider,
	exportLicensed: boolean,
	extensionUri: Uri,
	fileSystemWatcher: FileSystemWatcher,
	graphProvider: GraphProvider,
	graphTreeProvider: GraphTreeProvider,
	guiLicensed: boolean,
	infoTreeProvider: InfoTreeProvider,
	languageClient: LanguageClient,
	licenseLost: string,
	metricTreeProvider: MetricTreeProvider,
	preserveView: string,
	referencesTreeProvider: ReferencesTreeProvider,
	treemapProvider: TreemapProvider,
	violationsListProvider: ViolationTreeProvider,
}
