const vscode = require('vscode');

const http = require('node:http');
const path = require('node:path');


//
// Data
//

let dbPath = null;
let dbId = null;
let referenceChecklist = null;


//
// Icons
//

const iconUnchecked = new vscode.ThemeIcon('circle-large-outline');
const iconChecked   = new vscode.ThemeIcon('pass-filled');



//
// Tree Data Provider
//

class ReferenceChecklistProvider {

	#data;

	_onDidChangeTreeData;
	onDidChangeTreeData;

	constructor() {
		this.#data = [];
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

	setData(data) {
		this.#data = [];

		for (const ent of data)
			this.#data.push(new EntTreeItem(ent));

		this.update();
	}
}

class EntTreeItem extends vscode.TreeItem {
	constructor(
		ent,
	) {
		super(ent.name, vscode.TreeItemCollapsibleState.Expanded);
		this.checked = false;
		this.refs = [];
		if (ent.refs)
			for (const ref of ent.refs)
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

	contextValue = 'entity';
}

class RefTreeItem extends vscode.TreeItem {
	constructor(
		ref,
	) {
		super(ref.kind, vscode.TreeItemCollapsibleState.None);
		this.checked = false;
		this.description = `${path.basename(ref.file)} ${ref.line}:${ref.column}`;
		this.kind = ref.kind;
		this.file = ref.file;
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

	contextValue = 'reference';
}



//
// Helper Functions
//

function error(message) {
	vscode.window.showErrorMessage(`Understand: ${message}`)
}

function info(message) {
	vscode.window.showInformationMessage(`Understand: ${message}`)
}

async function request(options) {
	// Send request
	return new Promise((resolve, reject) => {
		http.request(
			options,
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
							error('Unable to parse JSON from server');
							reject(res);
						}
					}
					resolve(res);
				});
			}
		).end();
	});
}

function makeURLPath(path, params) {
	const array = [path];
	let first = true;
	for (const [key, value] of Object.entries(params)) {
		array.push(`${first ? '?' : '&'}${key}=${encodeURIComponent(value)}`);
		if (first)
			first = false;
	}
	return array.join('');
}

function makeRefOfFirstSelection(editor) {
	const document  = editor.document;
	const selection = editor.selection;
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

async function getDbId() {
	// Send request to userver
	const res = await request({
		host: '127.0.0.1',
		port: 8080,
		method: 'POST',
		path: makeURLPath('/databases', {path: dbPath}),
	});

	// Get database id
	if (res.body && res.body.id) {
		info('Connected to DB');
		return res.body.id;
	}
}

async function changeReferenceChecklist(path) {
	if (!dbPath)
		return error('Database not selected');
	if (!dbId)
		return error('Server not available');

	// Send request to userver
	const res = await request({
		host: '127.0.0.1',
		port: 8080,
		method: 'GET',
		path: path,
	});
	if (!res.body)
		return;

	referenceChecklist.setData(res.body);
}

async function automaticallySelectDatabase() {
	// Initiailize the stack of folders to search
	const folderUrisToSearch = [];
	for (const folder of vscode.workspace.workspaceFolders)
		folderUrisToSearch.push(folder.uri);

	// Find all .und folders
	const undPathsObj = {};
	while (folderUrisToSearch.length) {
		// Pop current folder
		const folderUri = folderUrisToSearch.pop();

		// Base case: .und folder found
		if (/\.und$/.test(folderUri.fsPath)) {
			undPathsObj[folderUri.fsPath] = true;
			continue;
		}

		// Push child folders to stack
		const children = await vscode.workspace.fs.readDirectory(folderUri);
		for (const [name, type] of children) {
			// Skip non-folders
			if (type != vscode.FileType.Directory)
				continue;

			const subFolderUri = vscode.Uri.joinPath(folderUri, name);
			folderUrisToSearch.push(subFolderUri);
		}
	}

	// Return first result if only one was found
	const undPathsArr = Object.keys(undPathsObj);
	if (undPathsArr.length == 1)
		return undPathsArr[0];
}

async function manuallySelectDatabase() {
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
// Extension Commands
//

async function connectToDatabase() {
	let possiblePath = await automaticallySelectDatabase();

	if (!possiblePath)
		possiblePath = await manuallySelectDatabase();

	// TODO:
	// Remember database with settings in storage
	dbPath = possiblePath;
	dbId = await getDbId();
}

async function seeReferencesForSelected() {
	// Get editor
	const editor = vscode.window.activeTextEditor;
	if (!editor)
		return error('No editor');

	// Make a reference of first selection
	const ref = makeRefOfFirstSelection(editor);
	if (!ref)
		return error('First selection is only whitespace');

	const path = makeURLPath(`/databases/${dbId}/ents`, ref);
	changeReferenceChecklist(path);
}

async function seeFile(refTreeItem) {
	const doc = await vscode.workspace.openTextDocument(refTreeItem.file);
    vscode.window.showTextDocument(doc);
}

async function toggleChecked(treeItem) {
	treeItem.setChecked();
	referenceChecklist.update();
}



//
// Basic Extension Functions
//

function activate(context) {
	// Register tree data providers
	referenceChecklist = new ReferenceChecklistProvider();
	vscode.window.registerTreeDataProvider('understand', referenceChecklist);

	// Register commands created in package.json
	context.subscriptions.push(
		// General
		vscode.commands.registerCommand('understand.connectToDatabase', connectToDatabase),

		// Reference checklist
		vscode.commands.registerCommand('understand.referenceChecklist.seeReferencesForSelected', seeReferencesForSelected),
		vscode.commands.registerCommand('understand.referenceChecklist.seeFile', seeFile),
		vscode.commands.registerCommand('understand.referenceChecklist.toggleCheckedEntity', toggleChecked),
		vscode.commands.registerCommand('understand.referenceChecklist.toggleCheckedReference', toggleChecked),
	);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
