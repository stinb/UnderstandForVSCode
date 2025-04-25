'use strict';


import { FileSystemWatcher } from 'vscode';
import { FileEvent, LanguageClient } from 'vscode-languageclient/node';
import { ViolationDescriptionProvider } from './textProviders';
import { AnnotationsViewProvider } from '../views/annotations';


/** Database state from the server, with UnableToOpen added */
export enum DbState {
	Finding = -3,   // getting settings and finding the project
	NoProject = -2, // a project was not found manually or automatically
	UnableToOpen = -1, // the server failed to open the db
	Empty,          // the db will not be ready (unresolved and empty from a new sample)
	Resolved,       // the db is ready
	Resolving,      // the db is not ready yet
	Unresolved,     // the db will not be ready
	WrongVersion,   // the db will not be ready (not resolved due to an old parse version)
}

/** A project that has a path, database, and database state */
export interface Db {
	path: string,
	state: DbState,
}


/** Global variables used in different files */
export const variables: Variables = {
	annotationsViewProvider: undefined,
	db: { path: '', state: DbState.Finding },
	fileSystemChanges: [],
	fileSystemTimeout: undefined,
	fileSystemWatcher: undefined,
	languageClient: undefined,
	violationDescriptionProvider: undefined,
	watchedSettings: [],
};


interface Variables {
	annotationsViewProvider: AnnotationsViewProvider,
	db: Db,
	fileSystemChanges: FileEvent[],
	fileSystemTimeout: NodeJS.Timeout,
	fileSystemWatcher: FileSystemWatcher,
	languageClient: LanguageClient,
	violationDescriptionProvider: ViolationDescriptionProvider,
	watchedSettings: string[],
}
