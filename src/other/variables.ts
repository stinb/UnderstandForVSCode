import { FileSystemWatcher, Uri } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { ViolationDescriptionProvider } from './textProviders';
import { AiChatProvider } from './aiChatProvider';
import { AiViewProvider } from '../viewProviders/ai';
import { AnnotationsViewProvider } from '../viewProviders/annotations';
import { GraphTreeProvider } from '../treeProviders/graphs';
import { ReferencesTreeProvider } from '../treeProviders/references';
import { GraphProvider } from '../other/graphProvider';


/** Global variables used in different files */
export const variables: Variables = {
	aiChatProvider: new AiChatProvider,
	// @ts-ignore initialized in `activate`
	aiViewProvider: undefined,
	// @ts-ignore initialized in `activate`
	annotationsViewProvider: undefined,
	// @ts-ignore initialized in `activate`
	extensionUri: undefined,
	// @ts-ignore initialized in `activate`
	fileSystemWatcher: undefined,
	// @ts-ignore initialized in `activate`
	graphProvider: undefined,
	// @ts-ignore initialized in `activate`
	graphTreeProvider: undefined,
	// @ts-ignore TODO audit this
	languageClient: undefined,
	// The view to leave alone for now
	preserveView: '',
	// @ts-ignore initialized in `activate`
	referencesTreeProvider: undefined,
	// @ts-ignore initialized in `activate`
	violationDescriptionProvider: undefined,
};


interface Variables {
	aiChatProvider: AiChatProvider,
	aiViewProvider: AiViewProvider,
	annotationsViewProvider: AnnotationsViewProvider,
	extensionUri: Uri,
	fileSystemWatcher: FileSystemWatcher,
	graphProvider: GraphProvider,
	graphTreeProvider: GraphTreeProvider,
	languageClient: LanguageClient,
	preserveView: string,
	referencesTreeProvider: ReferencesTreeProvider,
	violationDescriptionProvider: ViolationDescriptionProvider,
}
