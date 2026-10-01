import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { databasePath } from '../other/statusBar';
import { executeCommand } from './helpers';
import { invalidateFileDecorations } from '../other/fileDecorations';


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
};


async function loadConfig(uri: vscode.Uri): Promise<ConfigFile | null>
{
	try {
		const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
		return { uri, json: JSON.parse(text) };
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


/** A CodeCheck configuration saved by hand takes effect like one the UI
 * wrote: a path excluded there is skipped by later runs and never
 * re-checked, so its already-stored violations have to go now or they
 * linger forever (sti #3508 item 1.6). */
export function onConfigurationSaved(document: vscode.TextDocument)
{
	const path = databasePath();
	if (!path || !document.uri.path.endsWith('.json'))
		return;
	// Compared without case: a Windows path reaches us with the drive
	// letter in either case, which is the trap behind und-issues#724.
	const dir = vscode.Uri.file(path + '/codecheck/configs').path.toLowerCase();
	if (!document.uri.path.toLowerCase().startsWith(dir + '/'))
		return;

	executeCommand('understand.server.violations.pruneExcluded');
	invalidateFileDecorations();
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
	const answer = await executeCommand('understand.server.violations.exclude', [{
		config: config.json.name,
		path: fsPath,
	}]);
	invalidateFileDecorations();
	const name = fsPath.replace(/\\/g, '/').split('/').pop();
	if (answer?.alreadyExcluded) {
		vscode.window.showInformationMessage(
			`"${name}" was already excluded from ${config.json.name} — nothing changed`);
		return;
	}
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
		// The server refuses a prefix that could never match -- a doubled
		// separator, or nothing under it in the project -- and says why;
		// it also says when the entry was already there (sti #3508 7.1, 9).
		let answer;
		try {
			answer = await executeCommand('understand.server.violations.exclude', [{
				config: config.json.name,
				prefix: prefix.trim(),
			}]);
		} catch (error) {
			vscode.window.showWarningMessage(error instanceof Error
				? error.message : `"${prefix.trim()}" could not be excluded`);
			return;
		}
		invalidateFileDecorations();
		vscode.window.showInformationMessage(answer?.alreadyExcluded
			? `"${prefix.trim()}" was already excluded from ${config.json.name} — nothing changed`
			: `Excluded "${prefix.trim()}" from ${config.json.name}`);
		return;
	}

	// The server owns the removal, the way it owns adding: it knows which
	// files the entry was hiding, and queues those for a re-check so the
	// next analysis puts their violations back. Their content has not
	// changed, so nothing else would ever look at them again.
	const prefix = picked.replace('$(trash) ', '');
	const answer = await executeCommand('understand.server.violations.unexclude',
		[{ config: config.json.name, prefix: prefix }]);
	invalidateFileDecorations();

	const freed: string[] = answer?.files ?? [];
	const analyze = 'Analyze Changed Files';
	// Removing an exclusion cannot restore violations by itself: the files
	// are unchanged on disk, so only an analysis re-checks them (sti #3508 1.6).
	const chosen = await vscode.window.showInformationMessage(
		freed.length
			? `"${prefix}" is no longer excluded from ${config.json.name} — ${freed.length} file(s) are queued; the next analysis brings their violations back`
			: `"${prefix}" is no longer excluded from ${config.json.name}`,
		analyze);
	if (chosen === analyze)
		executeCommand('understand.server.analysis.analyzeChangedFiles');
}
