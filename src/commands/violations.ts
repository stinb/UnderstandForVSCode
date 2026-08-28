import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { databasePath } from '../other/statusBar';
import { executeCommand } from './helpers';


/** Go to a location in a file (from the violations view) */
export async function goToLocation(uri: vscode.Uri, line: number, character: number)
{
	variables.preserveView = 'violations';
	await vscode.window.showTextDocument(uri, {
		selection: new vscode.Range(line, character, line, character),
	});
	variables.preserveView = '';
}


/** Fix violation (run the fix-it hint) */
export function fix()
{
	// The argument schema was found in the vscode repo:
	// src/vs/editor/contrib/codeAction/browser/codeActionCommands.ts
	vscode.commands.executeCommand('editor.action.codeAction', {
		kind: 'quickfix.fix',
	});
}


/** Go to next violation in all files */
export function goToNextViolationInAllFiles()
{
	vscode.commands.executeCommand('editor.action.marker.nextInFiles');
}


/** Go to next violation in current file */
export function goToNextViolationInCurrentFile()
{
	vscode.commands.executeCommand('editor.action.marker.next');
}


/** Go to previous violation in all files */
export function goToPreviousViolationInAllFiles()
{
	vscode.commands.executeCommand('editor.action.marker.prevInFiles');
}


/** Go to previous violation in current file */
export function goToPreviousViolationInCurrentFile()
{
	vscode.commands.executeCommand('editor.action.marker.prev');
}


/** Ignore violation (add a comment) */
export function ignore()
{
	// Due to a vscode bug, we can't easily find 'quickfix.ignore' when 'quickfix.ignore' is available but 'quickfix.fix' isn't available.
	// For a workaround, we find the 'quickfix.ignore' action by finding the preferred action.
	vscode.commands.executeCommand('editor.action.codeAction', {
		kind: 'quickfix',
		apply: 'first',
		preferred: true,
	});
}


/** Toggle whether the Problems panel (Violations) is focused and visible */
export function toggleVisibilityAndFocus()
{
	vscode.commands.executeCommand('workbench.actions.view.problems');
}


/** The project's codecheck/configs *.json files, or null with a message
 * shown when there is no project or no configurations yet */
async function listConfigFiles(): Promise<vscode.Uri[] | null>
{
	const path = databasePath();
	if (!path) {
		vscode.window.showWarningMessage('No Understand project is open');
		return null;
	}
	const dir = vscode.Uri.file(path + '/codecheck/configs');
	let entries: [string, vscode.FileType][];
	try {
		entries = await vscode.workspace.fs.readDirectory(dir);
	} catch {
		entries = [];
	}
	const files = entries
		.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
		.map(([name]) => vscode.Uri.joinPath(dir, name));
	if (files.length === 0) {
		vscode.window.showInformationMessage(
			'The project has no CodeCheck configurations yet — create one in Understand (Checks → Select Checks)');
		return null;
	}
	return files;
}


type ConfigFile = {
	uri: vscode.Uri,
	json: { name?: string, excludes?: string[] },
	indent: string,
};


async function loadConfig(uri: vscode.Uri): Promise<ConfigFile | null>
{
	try {
		const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
		// Keep the file's own indentation so the edit diffs cleanly
		const indent = /\n(\s+)"/.exec(text)?.[1] ?? '    ';
		return { uri, json: JSON.parse(text), indent };
	} catch {
		vscode.window.showErrorMessage(`Could not read ${uri.fsPath}`);
		return null;
	}
}


/** Pick one configuration (skipping the pick when there is only one),
 * preferring its display name over the file name */
async function pickConfig(): Promise<ConfigFile | null>
{
	const files = await listConfigFiles();
	if (!files)
		return null;
	const configs: ConfigFile[] = [];
	for (const uri of files) {
		const config = await loadConfig(uri);
		if (config)
			configs.push(config);
	}
	if (configs.length === 0)
		return null;
	if (configs.length === 1)
		return configs[0];
	const picked = await vscode.window.showQuickPick(
		configs.map(c => c.json.name || c.uri.path.split('/').pop() || ''),
		{ placeHolder: 'CodeCheck configuration' });
	if (picked === undefined)
		return null;
	return configs.find(c => (c.json.name || c.uri.path.split('/').pop()) === picked) ?? null;
}


async function saveConfig(config: ConfigFile)
{
	const text = JSON.stringify(config.json, null, config.indent) + '\n';
	await vscode.workspace.fs.writeFile(config.uri, new TextEncoder().encode(text));
	// Excluded files are skipped by later runs and never re-checked, so
	// their already-stored violations must be dropped here or they would
	// linger forever.
	executeCommand('understand.server.violations.pruneExcluded');
}


/** Open a CodeCheck configuration JSON in the editor -- the power-user way
 * to edit "excludes" and the rest (sti #3508). A schema contribution gives
 * completions and hover docs; a saved change takes effect on the next
 * analysis because the engine re-reads configurations from disk. */
export async function openCodeCheckConfiguration()
{
	const files = await listConfigFiles();
	if (!files)
		return;
	const picked = files.length === 1 ? files[0] : await (async () => {
		const name = await vscode.window.showQuickPick(
			files.map(f => f.path.split('/').pop() || ''),
			{ placeHolder: 'CodeCheck configuration to open' });
		return files.find(f => f.path.endsWith('/' + name));
	})();
	if (picked)
		vscode.window.showTextDocument(picked);
}


/** Explorer context menu: exclude the clicked file or folder from
 * CodeCheck -- adds its project-relative prefix to the configuration's
 * excludes without the user touching JSON (sti #3508). */
function clickedPath(resource?: vscode.Uri | { filePath?: string }): string | undefined
{
	// From the Explorer the argument is a Uri; from the Violations views it
	// is the clicked tree item or webview context carrying its file path.
	return resource instanceof vscode.Uri ? resource.fsPath
		: resource?.filePath;
}


async function excludePath(fsPath: string)
{
	if (!databasePath()) {
		vscode.window.showWarningMessage('No Understand project is open');
		return;
	}

	// The server computes the stored prefix: excludes are prefix matches
	// against each entity's relativename, whose exact shape (root folder
	// component, native separators) only the database knows.
	const config = await pickConfig();
	if (!config)
		return;
	executeCommand('understand.server.violations.exclude', [{
		config: config.json.name,
		path: fsPath,
	}]);
	const name = fsPath.replace(/\\/g, '/').split('/').pop();
	vscode.window.showInformationMessage(
		`Excluded "${name}" from ${config.json.name} — its stored violations are removed, and new runs skip it`);
}


export async function excludeFromCodeCheck(resource?: vscode.Uri | { filePath?: string })
{
	const fsPath = clickedPath(resource);
	if (!fsPath) {
		vscode.window.showWarningMessage('Right-click a file or folder in the Explorer, or a file in the Violations views, to exclude it');
		return;
	}
	await excludePath(fsPath);
}


/** Exclude the clicked file's containing FOLDER -- the whole subtree stops
 * being checked, the usual shape for third-party code (sti #3508). */
export async function excludeFolderFromCodeCheck(resource?: vscode.Uri | { filePath?: string })
{
	const fsPath = clickedPath(resource);
	if (!fsPath) {
		vscode.window.showWarningMessage('Right-click a file in one of the Violations views to exclude its folder');
		return;
	}

	// The candidates: every folder between the file and the project root,
	// shown before anything happens -- the menu entry itself cannot name
	// the folder (menu labels are static).
	const dbPath = databasePath().split('\\').join('/');
	const projectParent = dbPath.substring(0,
		dbPath.lastIndexOf('/', dbPath.lastIndexOf('/') - 1));
	const folders: string[] = [];
	let folder = fsPath.split('\\').join('/');
	folder = folder.substring(0, folder.lastIndexOf('/'));
	while (folder.length > projectParent.length && folder.includes('/')) {
		folders.push(folder);
		folder = folder.substring(0, folder.lastIndexOf('/'));
	}
	if (folders.length === 0) {
		vscode.window.showWarningMessage('The file has no folder inside the project to exclude');
		return;
	}

	const picked = await vscode.window.showQuickPick(
		folders.map(f => ({
			label: (f.split('/').pop() ?? f) + '/',
			description: f,
			folder: f,
		})),
		{ placeHolder: 'Folder to exclude from CodeCheck (nearest first)' });
	if (picked)
		await excludePath(picked.folder);
}


/** Palette command: list, add, and remove excluded path prefixes without
 * opening the JSON (sti #3508). */
export async function editExcludedPaths()
{
	const config = await pickConfig();
	if (!config)
		return;
	const excludes = config.json.excludes ?? [];

	const addLabel = '$(add) Add a path prefix...';
	const items = excludes.map(prefix => `$(trash) ${prefix}`).concat(addLabel);
	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: excludes.length
			? `Excluded paths in ${config.json.name} — pick one to remove, or add`
			: `${config.json.name} excludes nothing yet — add a path prefix`,
	});
	if (picked === undefined)
		return;

	if (picked === addLabel) {
		const prefix = await vscode.window.showInputBox({
			prompt: 'Path prefix to exclude, matched against each file\'s project-relative path (as Understand stores it)',
			placeHolder: 'workspace\\src\\lib\\',
		});
		if (!prefix)
			return;
		executeCommand('understand.server.violations.exclude', [{
			config: config.json.name,
			prefix: prefix.trim(),
		}]);
		vscode.window.showInformationMessage(
			`Excluded "${prefix.trim()}" from ${config.json.name}`);
		return;
	}

	const prefix = picked.replace('$(trash) ', '');
	config.json.excludes = excludes.filter(entry => entry !== prefix);
	await saveConfig(config);
	// The path's violations only come back when its files are re-analyzed
	// -- a plain save never touches unchanged files, so offer the run.
	const analyze = 'Analyze All Files';
	const answer = await vscode.window.showInformationMessage(
		`"${prefix}" is no longer excluded from ${config.json.name} — analyze to check it again`,
		analyze);
	if (answer === analyze)
		executeCommand('understand.server.analysis.analyzeAllFiles');
}
