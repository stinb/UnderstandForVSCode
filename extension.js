const vscode = require('vscode');

const { spawn }    = require('node:child_process');
const { basename } = require('node:path');



let dbPath = null;
let db = null;
let referenceChecklist = null;



//
// Tree Data
//

class ReferenceChecklistProvider {

	#data;
	#_onDidChangeTreeData;
	onDidChangeTreeData;

	constructor(data) {
		this.#data = data;
		this._onDidChangeTreeData = new vscode.EventEmitter()
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	refresh() {
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

		this.refresh();
	}
}

class EntTreeItem extends vscode.TreeItem {
	constructor(
		ent,
	) {
		super(ent.name, vscode.TreeItemCollapsibleState.Expanded);
		this.done = false;
		this.refs = [];
		for (const ref of ent.refs)
			this.refs.push(new RefTreeItem(ref));
	}

	contextValue = 'entity';
}

class RefTreeItem extends vscode.TreeItem {
	constructor(
		ref,
	) {
		super(ref.kind, vscode.TreeItemCollapsibleState.None);
		this.done = false;
		this.description = `${basename(ref.file)} ${ref.line}:${ref.column}`;
		this.kind = ref.kind;
		this.file = ref.file;
		this.line = ref.line;
		this.column = ref.column;
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

async function openDatabase() {
	// Fail if there's no database path
	if (!dbPath) {
		error('Database not selected')
		return false;
	}

	// Succeed if the database is already open
	if (db)
		return true;

	// // Open
	// db = spawn(`undjs ${dbPath}`);

	// // Events
	// db.on('disconnect', err => {
	// 	error(`Disconnected from ${dbPath}`);
	// });
	// db.on('error', err => {
	// 	error(`Error with ${dbPath}`);
	// });
	// db.on('exit', err => {
	// 	error(`Exited from ${dbPath}`);
	// });
	// db.on('message', err => {
	// 	info('Message from db');
	// });
	// db.on('spawn', err => {
	// 	error(`Opened ${dbPath}`);
	// });
}

async function changeReferenceChecklist(query='') {
	// // No references if the database isn't open
	// if (!(await openDatabase()))
	// 	return {};

	referenceChecklist.setData([
		{
			done: false,
			name: 'setup_cpu_local_masks',
			refs: [
				{
					done: false,
					kind: 'Definein',
					file: 'C:/Users/Robby/Desktop/linuxKernel/linux-5.3.1/arch/x86/kernel/cpu/common.c',
					line: 81,
					column: 12,
				},
				{
					done: false,
					kind: 'Declarein',
					file: 'C:/Users/Robby/Desktop/linuxKernel/linux-5.3.1/arch/x86/include/asm/cpumask.h',
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
	const uris = await vscode.window.showOpenDialog({
		canSelectFolders: true,
		defaultUri: vscode.Uri.file(vscode.workspace.rootPath),
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

	// Remember database
	dbPath = uri.fsPath;
	// TODO: Remember with storage

	// Open database
	openDatabase();
}

async function seeReferencesForFile() {
	changeReferenceChecklist('');
}

async function seeReferencesForSelected() {
	changeReferenceChecklist('');
}



//
// Basic Extension Functions
//

function activate(context) {
	// openDatabase();

	// Register tree data providers
	referenceChecklist = new ReferenceChecklistProvider(vscode.workspace.rootPath);
	vscode.window.registerTreeDataProvider('referenceChecklist', referenceChecklist);

	// Register commands created in package.json
	context.subscriptions.push(
		// General
		vscode.commands.registerCommand('understand.selectDatabase', selectDatabase),

		// Reference checklist
		vscode.commands.registerCommand('understand.referenceChecklist.seeReferencesForFile', seeReferencesForFile),
		vscode.commands.registerCommand('understand.referenceChecklist.seeReferencesForSelected', seeReferencesForSelected),
	);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
