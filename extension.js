const vscode = require('vscode');

const { spawn } = require('node:child_process');
const fs        = require('node:fs');
const path      = require('node:path');

class DepNodeProvider {

	#workspaceRoot;
	#_onDidChangeTreeData;
	onDidChangeTreeData;

	constructor(workspaceRoot) {
		this._onDidChangeTreeData = new vscode.EventEmitter()
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this.workspaceRoot = workspaceRoot;
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {
		return element;
	}

	getChildren(element) {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}

		if (element) {
			return Promise.resolve(this.#getDepsInPackageJson(path.join(this.workspaceRoot, 'node_modules', element.label, 'package.json')));
		} else {
			const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
			if (this.#pathExists(packageJsonPath)) {
				return Promise.resolve(this.#getDepsInPackageJson(packageJsonPath));
			} else {
				vscode.window.showInformationMessage('Workspace has no package.json');
				return Promise.resolve([]);
			}
		}

	}

	/**
	 * Given the path to package.json, read all its dependencies and devDependencies.
	 */
	#getDepsInPackageJson(packageJsonPath) {
		const workspaceRoot = this.workspaceRoot;
		if (this.#pathExists(packageJsonPath) && workspaceRoot) {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

			const toDep = (moduleName, version) => {
				if (this.#pathExists(path.join(workspaceRoot, 'node_modules', moduleName))) {
					return new Dependency(moduleName, version, vscode.TreeItemCollapsibleState.Collapsed);
				} else {
					return new Dependency(moduleName, version, vscode.TreeItemCollapsibleState.None, {
						command: 'extension.openPackageOnNpm',
						title: '',
						arguments: [moduleName]
					});
				}
			};

			const deps = packageJson.dependencies
				? Object.keys(packageJson.dependencies).map(dep => toDep(dep, packageJson.dependencies[dep]))
				: [];
			const devDeps = packageJson.devDependencies
				? Object.keys(packageJson.devDependencies).map(dep => toDep(dep, packageJson.devDependencies[dep]))
				: [];
			return deps.concat(devDeps);
		} else {
			return [];
		}
	}

	#pathExists(p) {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

class Dependency extends vscode.TreeItem {

	constructor(
		label,
		version,
		collapsibleState,
		command
	) {
		super(label, collapsibleState);

		this.tooltip = `${this.label}-${this.version}`;
		this.description = this.version;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	contextValue = 'dependency';
}





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

async function getReferences(query) {
	// // No references if the database isn't open
	// if (!(await openDatabase()))
	// 	return {};

	return {
		145556: {
			done: false,
			name: 'setup_cpu_local_masks',
			refs: [
				{
					done: false,
					type: 'Definein',
					file: 'C:/Users/Robby/Desktop/linuxKernel/linux-5.3.1/arch/x86/kernel/cpu/common.c',
					line: 81,
					column: 12,
				},
				{
					done: false,
					type: 'Declarein',
					file: 'C:/Users/Robby/Desktop/linuxKernel/linux-5.3.1/arch/x86/include/asm/cpumask.h',
					line: 12,
					column: 12,
				},
			],
		},
	};
}

function seeReferences(ents) {
	for (const id in ents) {
		const ent = ents[id];

		// for (const ref in ent.refs)
	}
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
	seeReferences(await getReferences(''));
}

async function seeReferencesForSelected() {
	seeReferences(await getReferences(''));
}



//
// Basic Extension Functions
//

function activate(context) {
	// openDatabase();

	// Tree view
	const nodeDependenciesProvider = new DepNodeProvider(vscode.workspace.rootPath)
	vscode.window.registerTreeDataProvider('referenceChecklist', nodeDependenciesProvider);

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
