'use strict';


import * as lc from 'vscode-languageclient/node';


// Database state from the server, with NotOpened added
export enum DatabaseState {
	NotOpened = -1, // the server failed to open the db
	Empty,          // the db will not be ready (unresolved and empty from a new sample)
	Resolved,       // the db is ready
	Resolving,      // the db is not ready yet
	Unresolved,     // the db will not be ready
	WrongVersion,   // the db will not be ready (not resolved due to an old parse version)
}

// A project that has a path, database, and database state
export interface Database {
	path: string,
	state: DatabaseState,
}


// Global variables used in different files
export const variables: Variables = {
	databases: [],
	languageClient: undefined,
};


interface Variables {
	databases: Database[],
	languageClient: lc.LanguageClient,
}
