'use strict';


import { Uri } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { ViolationDescriptionProvider } from './textProviders';
import { AiViewProvider } from '../viewProviders/ai';
import { AnnotationsViewProvider } from '../viewProviders/annotations';
import { InfoTreeProvider } from '../viewProviders/info';


/** Global variables used in different files */
export const variables: Variables = {
	// @ts-ignore initialized in `activate`
	aiViewProvider: undefined,
	// @ts-ignore initialized in `activate`
	annotationsViewProvider: undefined,
	// @ts-ignore initialized in `activate`
	extensionUri: undefined,
	// @ts-ignore initialized in `activate`
	infoTreeProvider: undefined,
	// @ts-ignore TODO audit this
	languageClient: undefined,
	// @ts-ignore initialized in `activate`
	violationDescriptionProvider: undefined,
};


interface Variables {
	aiViewProvider: AiViewProvider,
	annotationsViewProvider: AnnotationsViewProvider,
	extensionUri: Uri,
	infoTreeProvider: InfoTreeProvider,
	languageClient: LanguageClient,
	violationDescriptionProvider: ViolationDescriptionProvider,
}
