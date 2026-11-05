// Runs inside VS Code. The workspace holds main.c:
//   int add(int a, int b) { return a + b; }
//   int main(void) { return add(1, 2); }

const assert = require('assert');
const path = require('path');
const vscode = require('vscode');

async function waitFor(what, seconds, attempt)
{
	const end = Date.now() + seconds * 1000;
	for (;;) {
		const result = await attempt();
		if (result)
			return result;
		if (Date.now() > end)
			throw new Error(`Timed out after ${seconds} seconds waiting for ${what}`);
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
}

exports.run = async function()
{
	const main = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'main.c');
	await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(main));
	const callOfAdd = new vscode.Position(1, 25);

	// The first answer also proves the extension started userver and it opened
	// the project, so give it the time a cold start takes.
	const definitions = await waitFor('Go to Definition', 180, async function() {
		const found = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', main, callOfAdd);
		return found && found.length ? found : undefined;
	});
	const definition = definitions[0];
	const uri = definition.targetUri || definition.uri;
	const range = definition.targetSelectionRange || definition.targetRange || definition.range;
	assert.strictEqual(path.basename(uri.fsPath), 'main.c', 'Go to Definition on add() should stay in main.c');
	assert.strictEqual(range.start.line, 0, 'Go to Definition on add() should land on line 1');

	const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', main, callOfAdd);
	const hoverText = hovers.flatMap(hover => hover.contents)
		.map(content => typeof content === 'string' ? content : content.value)
		.join('\n');
	assert.ok(hoverText.includes('add'), `The hover on add() should name it, but it reads: ${hoverText}`);

	console.log('Smoke test passed: Go to Definition and hover answered from userver');
};
