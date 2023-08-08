const vscode = require('vscode');

const http = require('node:http');
const path = require('node:path');



//
// Data
//

let dbId = null;

let statusBar             = null;
let statusPercentInterval = null;

let refChecklist = null;



//
// Icons
//

// TODO: Replace this annoying UI with an actual checkbox

// The feature has been "On Deck" to be scheduled since Oct 2022:
// https://github.com/microsoft/vscode/issues/116141

// Working workaround with web view:
// https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/debug/browser/breakpointsView.ts

const ICON_UNCHECKED = new vscode.ThemeIcon('circle-large-outline');
const ICON_CHECKED   = new vscode.ThemeIcon('pass-filled');



//
// Status Bar
//

const STATUS_NO_PROJECT        = 0;
const STATUS_SEARCHING         = 1;
const STATUS_CONNECTING        = 2;
const STATUS_NO_CONNECTION     = 3;
const STATUS_CONNECTED         = 4;
const STATUS_ANALYZING         = 5;
const STATUS_STOPPING_ANALYSIS = 6;


//
// Tree Data Provider
//

class RefChecklistProvider {

	#data;
	#dataHash;

	_onDidChangeTreeData;
	onDidChangeTreeData;

	constructor() {
		this.#data = [];
		this.#dataHash = {};
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	update() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {
		return element;
	}

	getChildren(element) {
		// Ent
		if (element && element.refs) {
			return Promise.resolve(element.refs);
		}
		// Ref
		else if (element) {
			return Promise.resolve([]);
		}
		// Ent
		else {
			return Promise.resolve(this.#data);
		}
	}

	add(ent, refs) {
		// Skip if already there
		if (ent.id in this.#dataHash)
			return;

		// Add
		this.#data.push(new EntTreeItem(ent, refs));
		this.#dataHash[ent.id] = true;

		this.update();
	}

	remove(entTreeItem) {
		// Remove
		delete this.#data[this.#data.indexOf(entTreeItem)];
		delete this.#dataHash[entTreeItem.id];

		// Clear if full of null
		let allNull = false;
		for (let i = 0; i < this.#data.length; i++) {
			if (this.#data[i] != null) {
				allNull = false;
				break;
			}
			else {
				allNull = true;
			}
		}
		if (allNull)
			this.#data = [];

		refChecklist.update();
	}
}

class EntTreeItem extends vscode.TreeItem
{
	constructor(ent, refs) {
		super(ent.name, vscode.TreeItemCollapsibleState.Expanded);
		this.checked = false;
		this.refs = [];
		this.id = ent.id;
		for (const ref of refs)
			this.refs.push(new RefTreeItem(ref));
		this.updateIcon();
	}

	updateIcon() {
		this.iconPath = this.checked ? ICON_CHECKED : ICON_UNCHECKED;
	}

	setChecked(checked=undefined) {
		this.checked = (checked === undefined) ? !this.checked : checked;

		for (const ref of this.refs)
			ref.setChecked(this.checked);

		this.updateIcon();
	}

	contextValue = 'ent';
}

class RefTreeItem extends vscode.TreeItem {
	constructor(ref) {
		super(ref.kindname, vscode.TreeItemCollapsibleState.None);
		this.checked = false;
		this.description = `${path.basename(ref.filelongname)} ${ref.line}:${ref.column}`;
		this.kindname = ref.kindname;
		this.filelongname = ref.filelongname;
		this.line = ref.line;
		this.column = ref.column;
		this.updateIcon();
	}

	updateIcon() {
		this.iconPath = this.checked ? ICON_CHECKED : ICON_UNCHECKED;
	}

	setChecked(checked=undefined) {
		this.checked = (checked === undefined) ? !this.checked : checked;

		this.updateIcon();
	}

	contextValue = 'ref';
}



//
// Helper Functions
//

function error(message) {
	vscode.window.showErrorMessage(`Understand: ${message}`);
}

function info(message) {
	vscode.window.showInformationMessage(`Understand: ${message}`);
}

function changeStatusBar(status, percent=0) {
	switch (status) {
		case STATUS_NO_PROJECT:
			statusBar.text = '$(search) Understand';
			statusBar.tooltip = 'No Understand Project';
			statusBar.command = 'understand.databaseConnect';
			break;
		case STATUS_SEARCHING:
			statusBar.text = '$(loading~spin) Understand';
			statusBar.tooltip = 'Finding Understand Project';
			statusBar.command = 'understand.databaseConnect';
			break;
		case STATUS_CONNECTING:
			statusBar.text = '$(loading~spin) Understand';
			statusBar.tooltip = 'Connecting to Understand Server';
			statusBar.command = null;
			break;
		case STATUS_NO_CONNECTION:
			statusBar.text = '$(error) Understand';
			statusBar.tooltip = 'Failed to Connect to Understand Server';
			statusBar.command = 'understand.databaseConnect';
			break;
		case STATUS_CONNECTED:
			statusBar.text = '$(refresh) Understand';
			statusBar.tooltip = 'Analyze Changed Files';
			statusBar.command = 'understand.analyzeChangedFiles';
			break;
		case STATUS_ANALYZING:
			statusBar.text = `$(loading~spin) Understand ${percent}%`;
			statusBar.tooltip = 'Stop Analysis';
			statusBar.command = 'understand.analyzeStop';
			break;
		case STATUS_STOPPING_ANALYSIS:
			statusBar.text = `$(loading~spin) Understand ${percent}%`;
			statusBar.tooltip = 'Stopping Analysis';
			statusBar.command = null;
			break;
	}
}

function isASelection(selection) {
	return selection.start.character != selection.end.character || selection.start.line != selection.end.line;
}

function getConfig(key=null) {
	return vscode.workspace.getConfiguration().get(`understand${key ? '.' + key : ''}`);
}

function selectWordIfNoSelection(document, selection) {
	// Skip if there is a selection
	if (isASelection(selection))
		return selection;

	// Make a new selection
	const word = /\w/;
	const text = document.getText();
	const lastIndex = text.length - 1;
	let l = document.offsetAt(selection.start);
	let r = l - 1;
	while (true) {
		let movedEither = false;

		// Move left if there's a word character
		if (l > 0 && word.test(text[l-1])) {
			l--;
			movedEither = true;
		}
		// Move right if there's a word character
		if (r < lastIndex && word.test(text[r+1])) {
			r++;
			movedEither = true;
		}

		if (! movedEither)
			break;
	}

	// Make a new selection
	return new vscode.Selection(document.positionAt(l), document.positionAt(r+1));
}

async function request(options) {
	// Send request
	return new Promise((resolve, reject) => {
		const req = http.request(
			Object.assign(options, getConfig('userver')),
			res => {
				// Get body
				const body = [];
				res.on('data', chunk => {
					body.push(chunk.toString());
				});

				// Parse JSON body and add to reponse
				res.on('end', () => {
					if (res.headers['content-type'] == 'application/json') {
						try {
							res.body = JSON.parse(body.join(''));
						} catch (err) {
							error('Unable to parse JSON from userver', err);
						}
					}
					resolve(res);
				});
			}
		);

		req.on('error', err => {
			changeStatusBar(STATUS_CONNECTED);

			// Error with host
			let match = err.message.match(/getaddrinfo ENOTFOUND (.*)/);
			if (match)
				return error(`Error finding host for userver (host "${match[1]}" not found)`);

			// Error with connecting
			match = err.message.match(/connect ECONNREFUSED (.*)/);
			if (match)
				return changeStatusBar(STATUS_NO_CONNECTION);

			// Other error
			error(`Error communicating with userver (${err.message})`);
		});

		req.end();
	});
}


async function requestOpenDb(pathStr) {
	const res = await request({
		method: 'POST',
		path: makeURLPath('/databases', {path: pathStr}),
	});

	return res.body;
}

async function requestGetDb() {
	const res = await request({
		method: 'GET',
		path: makeURLPath(`/databases/${dbId}`),
	});

	return res.body;
}

async function requestCloseDb() {
	if (!dbId)
		return;

	return request({
		method: 'DELETE',
		path: `/databases/${dbId}`,
	});
}

async function requestAnalyzeAllFiles() {
	return request({
		method: 'POST',
		path: makeURLPath(`/databases/${dbId}/analysis`, {parse: 'all'}),
	});
}

async function requestAnalyzeChangedFiles() {
	return request({
		method: 'POST',
		path: `/databases/${dbId}/analysis`,
	});
}

async function requestAnalyzeStop() {
	return request({
		method: 'DELETE',
		path: `/databases/${dbId}/analysis`,
	});
}

async function requestGetEntByRef(ref) {
	const res = await request({
		method: 'GET',
		path: makeURLPath(`/databases/${dbId}/ent`, ref),
	});

	return res.body;
}

async function requestGetRefsByEnt(ent) {
	const res = await request({
		method: 'GET',
		path: makeURLPath(`/databases/${dbId}/ents/${ent.id}/refs`),
	});

	return res.body;
}

function makeURLPath(pathStr, params = {}) {
	const array = [pathStr];
	let first = true;
	for (const [key, value] of Object.entries(params)) {
		array.push(`${first ? '?' : '&'}${key}=${encodeURIComponent(value)}`);
		if (first)
			first = false;
	}
	return array.join('');
}

function makeRefOfSelection(editor) {
	const document  = editor.document;
	const selection = selectWordIfNoSelection(document, editor.selection);
	const file      = document.fileName;
	const fullText  = document.getText(selection);

	// Get the first non-whitespace text
	const match = /(\S+)/.exec(fullText);
	if (! match)
		return;
	const name = match[0];

	// Calculate the offset from trimming whitespace
	let line = selection.start.line + 1;
	let column = selection.start.character + 1;
	for (let i = 0; i < fullText.length; i++) {
		// Stop at first non-whitespace character
		if (/\S/.test(fullText[i])) {
			break;
		}
		// New line
		else if (/\n/.test(fullText[i])) {
			line += 1;
			column = 1;
		}
		// Normal character
		else {
			column += 1;
		}
	}

	return {
		name:   name,
		file:   file,
		line:   line,
		column: column,
	};
}

async function getDbPathFromSearching(returnOnFirstMatch) {
	// Initialize the stacks of folders for a breadth-first search
	const childrenToCheck = [];
	const parentsToCheck  = [];
	for (const folder of vscode.workspace.workspaceFolders)
		childrenToCheck.push(folder.uri);

	// Find all .und folders
	let undPath;
	while (childrenToCheck.length || parentsToCheck.length) {
		while (childrenToCheck.length) {
			// Pop current folder to children stack
			const folderUri = childrenToCheck.pop();

			// Base case: .und folder found
			if (/\.und$/.test(folderUri.fsPath)) {
				// Stop recursion in this folder
				if (!undPath) {
					undPath = folderUri.fsPath;
					// Stop searching if one is found
					if (returnOnFirstMatch)
						return undPath;
					continue;
				}
				// Stop searching if two are found
				else {
					undPath = null;
					break;
				}
			}

			// Push current folder to parents parentsToCheck
			parentsToCheck.push(folderUri);
		}

		while (parentsToCheck.length) {
			// Pop current folder from parents
			const folderUri = parentsToCheck.pop();

			// Push sub-folders to children stack
			const children = await vscode.workspace.fs.readDirectory(folderUri);
			for (const [name, type] of children) {
				// Skip non-folders
				if (type != vscode.FileType.Directory)
					continue;

				// Skip black-listed folders
				if (name == '.git')
					continue;

				const subFolderUri = vscode.Uri.joinPath(folderUri, name);
				childrenToCheck.push(subFolderUri);
			}
		}
	}

	return undPath;
}

async function getDbPathFromUser() {
	// Get database from user input
	const rootPath = vscode.workspace.rootPath;
	const rootUri = rootPath ? vscode.Uri.file(rootPath) : undefined;
	const uris = await vscode.window.showOpenDialog({
		canSelectFolders: true,
		defaultUri: rootUri,
		openLabel: 'Select',
		title: 'Select .und Folder',
	});

	// Error: not selected
	if (!uris)
		return error('No folder selected');

	// Error: not .und
	const uri = uris[0];
	if (!(/\.und$/.test(uri.fsPath)))
		return error('Selected folder is not .und');

	return uri.fsPath;
}




//
// Extension Commands: General
//

async function databaseConnect(calledByUser=true) {
	changeStatusBar(STATUS_SEARCHING);

	// Get id from config
	let dbConfig = getConfig('db');
	let dbPath = dbConfig.path;

	// Get id from searching
	if (!dbPath && dbConfig.findPathAutomatically)
		dbPath = await getDbPathFromSearching(dbConfig.findFirstPathAutomatically);

	// Get id from user
	if (!dbPath && dbConfig.findPathManually && calledByUser)
		dbPath = await getDbPathFromUser();

	// No id
	if (!dbPath) {
		dbId = null;
		changeStatusBar(STATUS_NO_PROJECT);
		return;
	}

	// Connect to userver and open db
	changeStatusBar(STATUS_CONNECTING);
	const db = await requestOpenDb(dbPath);
	if (!db) {
		dbId = null;
		changeStatusBar(STATUS_NO_PROJECT);
		return error('Database not found by userver');
	}

	// Remember id in memory
	dbId = db.id;
	changeStatusBar(STATUS_CONNECTED);
}

async function databaseDisconnect() {
	changeStatusBar(STATUS_NO_PROJECT);
	return requestCloseDb();
}

async function updatePercent() {
	const db = await requestGetDb();

	// Stop if done
	if (!db || !db.analyzing) {
		clearInterval(statusPercentInterval);
		changeStatusBar(STATUS_CONNECTED);
		return;
	}

	changeStatusBar(STATUS_ANALYZING, db.percent);
}

async function analyzeFiles(all) {
	// Start analysis
	changeStatusBar(STATUS_ANALYZING);
	const fn = all ? requestAnalyzeAllFiles : requestAnalyzeChangedFiles;
	const res = await fn();

	// Error: not found (database not open)
	if (res.statusCode == 404) {
		changeStatusBar(STATUS_NO_PROJECT);
		return error('Database not open');
	}

	// Error: conflict (already being analyzed)
	if (res.statusCode == 409) {
		error('Already being analyzed');
	}

	// Continuously ask for the progress
	const ms = getConfig('analyze.updatePercentWait');
	statusPercentInterval = setInterval(updatePercent, ms);
}

async function analyzeAllFiles() {
	analyzeFiles(true);
}

async function analyzeChangedFiles() {
	analyzeFiles(false);
}

async function analyzeStop() {
	changeStatusBar(STATUS_STOPPING_ANALYSIS);
	const res = await requestAnalyzeStop();

	// Error: not found (database not open or no analysis)
	if (res.statusCode == 404) {
		clearInterval(statusPercentInterval);
		changeStatusBar(STATUS_NO_PROJECT);
		return error('Failed to stop analysis');
	}

	changeStatusBar(STATUS_CONNECTED);
}



//
// Extension Commands: Reference Checklist
//

async function seeRefChecklist() {
	if (!dbId)
		return error('Not connected with userver');

	// Get editor
	const editor = vscode.window.activeTextEditor;
	if (!editor)
		return error('No editor');

	// Make a reference of selection
	const ref = makeRefOfSelection(editor);
	if (!ref)
		return error('Selection is only whitespace');

	// Get entity
	const ent = await requestGetEntByRef(ref);
	if (!ent)
		return error('Entity not found');

	// Get references
	const refs = await requestGetRefsByEnt(ent);
	if (!refs || !refs.length)
		return error('References not found');

	// Set data of checklist
	refChecklist.add(ent, refs);

	// Show in sidebar
	vscode.commands.executeCommand('workbench.view.extension.understand');
}

async function seeRef(refTreeItem) {
	const doc = await vscode.workspace.openTextDocument(refTreeItem.filelongname);

	const line      = refTreeItem.line - 1;
	const column    = refTreeItem.column;
	const selection = new vscode.Selection(line, column, line, column);

	vscode.window.showTextDocument(doc, {selection:	selection});
}

async function removeEnt(entTreeItem) {
	refChecklist.remove(entTreeItem);
}

async function toggleCheckmark(treeItem) {
	treeItem.setChecked();
	refChecklist.update();
}



//
// Extension Initialization
//

function activate(context) {
	// TODO: Give a unique token to userver with vscode.authentication (generated by oauth)
	// https://www.eliostruyf.com/create-authentication-provider-visual-studio-code/

	// Register status bar
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(statusBar);
	changeStatusBar(STATUS_NO_PROJECT);
	statusBar.show();

	// Connect to database without user input
	databaseConnect(false);

	// Register tree data providers
	refChecklist = new RefChecklistProvider();
	vscode.window.registerTreeDataProvider('understand', refChecklist);

	// Register commands created in package.json
	context.subscriptions.push(
		// General

		// Command pallette
		vscode.commands.registerCommand('understand.databaseConnect', databaseConnect),
		vscode.commands.registerCommand('understand.databaseDisconnect', databaseDisconnect),
		vscode.commands.registerCommand('understand.analyzeAllFiles', analyzeAllFiles),
		vscode.commands.registerCommand('understand.analyzeChangedFiles', analyzeChangedFiles),
		vscode.commands.registerCommand('understand.analyzeStop', analyzeStop),
		// Hidden from command pallette
		vscode.commands.registerCommand('understand.hiddenDatabaseConnect', databaseConnect),
		vscode.commands.registerCommand('understand.hiddenDatabaseDisconnect', databaseDisconnect),
		vscode.commands.registerCommand('understand.hiddenAnalyzeAllFiles', analyzeAllFiles),
		vscode.commands.registerCommand('understand.hiddenAnalyzeChangedFiles', analyzeChangedFiles),
		vscode.commands.registerCommand('understand.hiddenAnalyzeStop', analyzeStop),

		// Reference checklist

		// Command pallette
		vscode.commands.registerCommand('understand.refChecklist', seeRefChecklist),
		// Hidden from command pallette
		vscode.commands.registerCommand('understand.refChecklist.hiddenRemoveEnt', removeEnt),
		vscode.commands.registerCommand('understand.refChecklist.hiddenToggleCheckmarkEnt', toggleCheckmark),
		vscode.commands.registerCommand('understand.refChecklist.hiddenSeeRef', seeRef),
		vscode.commands.registerCommand('understand.refChecklist.hiddenToggleCheckmarkRef', toggleCheckmark),
	);
}

function deactivate() {
	return requestCloseDb();
}

module.exports = {
	activate,
	deactivate
}
