const vscode = require('vscode');
const { spawn } = require('node:child_process');
let dbPath = null;
let db = null;



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

	// const ls = spawn('ls');
	// console.log(ls);
	// ls.stdout.on('data', (data) => {
	// 	console.log(`stdout: ${data}`);
	// });

	// Open
	db = spawn(`undjs ${dbPath}`);

	// Events
	db.on('disconnect', err => {
		error(`Disconnected from ${dbPath}`);
	});
	db.on('error', err => {
		error(`Error with ${dbPath}`);
	});
	db.on('exit', err => {
		error(`Exited from ${dbPath}`);
	});
	db.on('message', err => {
		info('Message from db');
	});
	db.on('spawn', err => {
		error(`Opened ${dbPath}`);
	});
}

async function getReferences(query) {
	// No references if the database isn't open
	if (!openDatabase())
		return [];


}

function seeReferences(entities) {

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

function seeReferencesForFile() {
	seeReferences(getReferences(''));
}

function seeReferencesForSelected() {
	seeReferences(getReferences(''));
}



//
// Basic Extension Functions
//

function activate(context) {
	// openDatabase();

	// Register commands created in package.json
	context.subscriptions.push(
		vscode.commands.registerCommand('understand.selectDatabase', selectDatabase),
		vscode.commands.registerCommand('understand.seeReferencesForFile', seeReferencesForFile),
		vscode.commands.registerCommand('understand.seeReferencesForSelected', seeReferencesForSelected),
	);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
