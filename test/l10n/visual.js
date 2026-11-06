// Runs inside VS Code, started like suite.js. Opens the pages that carry their
// own localized scripts (the Understand sidebar, a graph, the metrics treemap,
// the AI provider settings) and screenshots the window after each, so the
// webviews are seen working with the language in use. Windows only (the
// screenshot helper); the pictures land in test/l10n/shots/.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function screenshot(name)
{
	const out = path.join(__dirname, 'shots', `${process.env.UNDERSTAND_L10N_LOCALE || 'ja'}-${name}.png`);
	fs.mkdirSync(path.dirname(out), { recursive: true });
	const folder = path.basename(vscode.workspace.workspaceFolders[0].uri.fsPath);
	try {
		const script = path.join(__dirname, 'shot_window.ps1');
		console.log(execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
			'-ProcessName', 'Code', '-TitlePart', folder, '-Out', out], { encoding: 'utf-8' }).trim());
	} catch (error) {
		console.log(`screenshot ${name} failed: ${error.message}`);
	}
}

exports.run = async function()
{
	const folder = vscode.workspace.workspaceFolders[0].uri;
	const util = vscode.Uri.joinPath(folder, 'util.cpp');
	const editor = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(util));
	await vscode.commands.executeCommand('workbench.view.extension.understand');
	// The cursor on add(), so every view in the sidebar has something to show
	editor.selection = new vscode.Selection(2, 5, 2, 5);
	await sleep(15000);
	screenshot('sidebar');

	// The unique name of add in this project (the test workspace is a copy of the demo project)
	const addUnique = '@ladd@k_Z3addii@f./util.cpp';
	await vscode.commands.executeCommand('understand.graphs.view', 'Calls', addUnique, 'add');
	await sleep(12000);
	screenshot('graph');

	await vscode.commands.executeCommand('understand.graphs.treemap');
	await sleep(10000);
	screenshot('treemap');

	await vscode.commands.executeCommand('understand.ai.editProviderSettings');
	await sleep(6000);
	screenshot('provider-settings');
	console.log('visual pass done');
};
