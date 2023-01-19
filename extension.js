const vscode = require('vscode');

const fs   = require('node:fs');
const http = require('node:http');
const path = require('node:path');



//
// Data
//

let dbId = null;

let statusBar = null;

let refChecklist = null;



//
// Icons
//

const iconUnchecked = new vscode.ThemeIcon('circle-large-outline');
const iconChecked   = new vscode.ThemeIcon('pass-filled');



//
// Statuses
//

const statusNoProject  = 0;
const statusConnecting = 1;
const statusConnected  = 2;


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
		this.iconPath = this.checked ? iconChecked : iconUnchecked;
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
		this.iconPath = this.checked ? iconChecked : iconUnchecked;
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

function error(message, err=null) {
	vscode.window.showErrorMessage(`Understand: ${message}`);
	if (err)
		console.error(err);
}

function info(message) {
	vscode.window.showInformationMessage(`Understand: ${message}`);
}

function changeStatusBar(status) {
	if (status == statusNoProject) {
		statusBar.text = '$(search) Understand Project';
		statusBar.command = 'understand.connectToDatabase';
	}
	else if (status == statusConnecting) {
		statusBar.text = '$(loading~spin) Understand Project';
		statusBar.command = null;
	}
	else if (status == statusConnected) {
		statusBar.text = '$(refresh) Understand Project';
		statusBar.command = 'understand.analyzeDatabase';
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
							reject();
						}
					}
					resolve(res);
				});
			}
		);

		req.on('error', err => {
			error('Error communicating with userver', err);
			reject();
		});

		req.end();
	});
}


async function openDb(pathStr) {
	const res = await request({
		method: 'POST',
		path: makeURLPath('/databases', {path: pathStr}),
	});

	return res.body;
}

async function closeDb() {
	if (!dbId)
		return;

	return request({
		method: 'DELETE',
		path: `/databases/${dbId}`,
	});
}

async function getEntByRef(ref) {
	const res = await request({
		method: 'GET',
		path: makeURLPath(`/databases/${dbId}/ent`, ref),
	});

	return res.body;
}

async function getRefsByEnt(ent) {
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
	// Initiailize the stacks of folders for a breadth-first search
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

async function connectToDatabase(calledByUser=true) {
	changeStatusBar(statusConnecting);

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
		changeStatusBar(statusNoProject);
		return;
	}

	// Connect to userver and open db
	const db = await openDb(dbPath);
	if (!db) {
		dbId = null;
		changeStatusBar(statusNoProject);
		return error('Database not found by userver');
	}

	// Remember id in memory
	dbId = db.id;
	changeStatusBar(statusConnected);
}

async function analyzeDatabase() {
	// TODO
	info('Analyze feature coming soon');
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
	const ent = await getEntByRef(ref);
	if (!ent)
		return error('Entity not found');

	// Get references
	const refs = await getRefsByEnt(ent);
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
	// Register status bar
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(statusBar);
	changeStatusBar(statusNoProject);
	statusBar.show();

	// Connect to database without user input
	connectToDatabase(false);

	// Register tree data providers
	refChecklist = new RefChecklistProvider();
	vscode.window.registerTreeDataProvider('understand', refChecklist);

	// Register commands created in package.json
	context.subscriptions.push(
		// General

		// Command pallette
		vscode.commands.registerCommand('understand.connectToDatabase', connectToDatabase),
		vscode.commands.registerCommand('understand.analyzeDatabase', analyzeDatabase),
		// Hidden
		vscode.commands.registerCommand('understand.hiddenConnectToDatabase', connectToDatabase),
		vscode.commands.registerCommand('understand.hiddenAnalyzeDatabase', analyzeDatabase),

		// Reference checklist

		// Command pallette
		vscode.commands.registerCommand('understand.refChecklist', seeRefChecklist),
		// Hidden
		vscode.commands.registerCommand('understand.refChecklist.hiddenRemoveEnt', removeEnt),
		vscode.commands.registerCommand('understand.refChecklist.hiddenToggleCheckmarkEnt', toggleCheckmark),
		vscode.commands.registerCommand('understand.refChecklist.hiddenSeeRef', seeRef),
		vscode.commands.registerCommand('understand.refChecklist.hiddenToggleCheckmarkRef', toggleCheckmark),
	);
}

function deactivate() {
	return closeDb();
}

module.exports = {
	activate,
	deactivate
}
