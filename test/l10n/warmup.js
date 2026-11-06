// A first start after the language pack is installed only records the pack in
// VS Code's language pack cache; the language applies from the next start.
// So the real suite runs second, and this first run does nothing.
exports.run = async function()
{
	const vscode = require('vscode');
	console.log(`warm-up start: vscode.env.language is ${vscode.env.language}`);
};
