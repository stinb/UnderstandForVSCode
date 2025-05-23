'use strict';


import { Uri } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { ViolationDescriptionProvider } from './textProviders';
import { AiViewProvider } from '../viewProviders/ai';
import { AnnotationsViewProvider } from '../viewProviders/annotations';
import { ReferencesTreeProvider } from '../viewProviders/references';


/** Global variables used in different files */
export const variables: Variables = {
	// @ts-ignore initialized in `activate`
	aiViewProvider: undefined,
	// @ts-ignore initialized in `activate`
	annotationsViewProvider: undefined,
	// @ts-ignore initialized in `activate`
	extensionUri: undefined,
	// @ts-ignore TODO audit this
	languageClient: undefined,
	// @ts-ignore initialized in `activate`
	referencesTreeProvider: undefined,
	// @ts-ignore initialized in `activate`
	violationDescriptionProvider: undefined,
};


interface Variables {
	aiViewProvider: AiViewProvider,
	annotationsViewProvider: AnnotationsViewProvider,
	extensionUri: Uri,
	languageClient: LanguageClient,
	referencesTreeProvider: ReferencesTreeProvider,
	violationDescriptionProvider: ViolationDescriptionProvider,
}
