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

	constructor(data) {
		this.#data = data;
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
		if (!this.#data) {
			return Promise.resolve([]);
		}

		// Ent
		if (element && element.refs) {
			return Promise.resolve(element.refs);
		}
		// Ref
		else if (element) {
			return Promise.resolve([]);
		}
		// Ents
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
				const body = []
				res.on('data', chunk => {
					body.push(chunk);
				});

				// Parse JSON body and add to reponse
				res.on('end', () => {
					if (res.headers['content-type'] == 'application/json')
						res.body = JSON.parse(body);
					resolve(res);
				});
			}
		).end();
	});
}

function makeURL(path, params) {
	const array = [path];
	let first = true;
	for (const [key, value] of Object.entries(params)) {
		array.push(`${first ? '?' : '&'}${key}=${encodeURIComponent(value)}`);
		if (first)
			first = false;
	}
	return array.join('');
}

async function getDbId() {
	// Get database path from user
	if (!dbPath) {
		await selectDatabase();

		// Fail if there's no database path from user
		if (!dbPath) {
			error('Database not selected')
			return;
		}
	}

	// Succeed if the database is already known
	if (dbId)
		return dbId;

	// Send request to userver
	const res = await request({
		host: '127.0.0.1',
		port: 8080,
		method: 'POST',
		path: makeURL('/databases', {path: dbPath}),
	});

	// Get database id
	if (res.body && res.body.id)
		dbId = res.body.id;
}

async function changeReferenceChecklist(query='') {
	// No references if the database isn't open
	if (!(await getDbId()))
		return;

	referenceChecklist.setData([
		{
			checked: false,
			name: 'setup_cpu_local_masks',
			refs: [
				{
					checked: false,
					kind: 'Definein',
					file: 'C:/Users/Robby/Projects/linuxKernel/linux-5.3.1/arch/x86/kernel/cpu/common.c',
					line: 81,
					column: 12,
				},
				{
					checked: false,
					kind: 'Declarein',
					file: 'C:/Users/Robby/Projects/linuxKernel/linux-5.3.1/arch/x86/include/asm/cpumask.h',
					line: 12,
					column: 12,
				},
			],
		},
	]);
}



//
// Extension Commands
//

async function selectDatabase() {
	// Get database from user input
	const rootPath = vscode.workspace.rootPath;
	const rootUri = rootPath ? vscode.Uri.file(rootPath) : undefined;
	const uris = await vscode.window.showOpenDialog({
		canSelectFolders: true,
		defaultUri: rootUri,
		openLabel: 'Select',
		title: 'Select .und Folder',
	});
	if (!uris) {
		error('No folder selected');
		return;
	}
	const uri = uris[0];
	if (!(/\.und$/.test(uri.fsPath))) {
		error('Selected folder is not .und');
		return;
	}

	// TODO: Remember with storage
	// Remember database
	dbPath = uri.fsPath;
	dbId = await getDbId();
}

async function seeReferencesForFile() {
	changeReferenceChecklist('');
}

async function seeReferencesForSelected() {
	changeReferenceChecklist('');
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
	// getDbId();

	// Register tree data providers
	referenceChecklist = new ReferenceChecklistProvider(vscode.workspace.rootPath);
	vscode.window.registerTreeDataProvider('understand.referenceChecklist', referenceChecklist);

	// Register commands created in package.json
	context.subscriptions.push(
		// General
		vscode.commands.registerCommand('understand.selectDatabase', selectDatabase),

		// Reference checklist
		vscode.commands.registerCommand('understand.referenceChecklist.seeReferencesForFile', seeReferencesForFile),
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
