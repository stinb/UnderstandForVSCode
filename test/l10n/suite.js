// Runs inside VS Code, started with --locale and the matching language pack.
// Checks that the extension's strings come out translated, that the manifest
// strings (view names, command titles) are localized, and that userver was
// started with the matching --locale switch.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
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

function userverCommandLines()
{
	if (process.platform !== 'win32')
		return execFileSync('ps', ['-eo', 'args'], { encoding: 'utf-8' }).split('\n').filter(l => /userver/.test(l));
	const out = execFileSync('powershell', ['-NoProfile', '-Command',
		"Get-CimInstance Win32_Process -Filter \"Name like 'userver%'\" | ForEach-Object { $_.CommandLine }"], { encoding: 'utf-8' });
	return out.split(/\r?\n/).filter(l => l.trim());
}

exports.run = async function()
{
	const locale = process.env.UNDERSTAND_L10N_LOCALE || 'ja';
	// What the extension's own files say, which VS Code must now hand back:
	// bundle strings for the TypeScript, nls strings for the manifest
	const extensionPath = vscode.extensions.getExtension('scitools.understand').extensionPath;
	const bundle = JSON.parse(fs.readFileSync(path.join(extensionPath, 'l10n', `bundle.l10n.${locale}.json`), 'utf-8'));
	const nls = JSON.parse(fs.readFileSync(path.join(extensionPath, `package.nls.${locale}.json`), 'utf-8'));
	const expected = { 'AI Overview': bundle['AI Overview'], 'Analyze all files': bundle['Analyze all files'] };
	const expectedTitle = nls['command.understand.analysis.analyzeAllFiles.title'];
	for (const [key, value] of Object.entries(expected))
		assert.ok(value, `the ${locale} bundle translates '${key}'`);
	assert.ok(expectedTitle, `the ${locale} nls file translates the Analyze All Files title`);

	assert.strictEqual(vscode.env.language, locale, `VS Code should run in ${locale}, but vscode.env.language is ${vscode.env.language}`);

	// The TypeScript side: l10n bundles
	for (const [english, translated] of Object.entries(expected))
		assert.strictEqual(vscode.l10n.t(english), translated, `l10n.t('${english}')`);

	// The manifest side: package.nls.<locale>.json applied to the views and commands
	const extension = vscode.extensions.getExtension('scitools.understand');
	assert.ok(extension, 'the extension is loaded');
	const views = Object.values(extension.packageJSON.contributes.views).flat();
	const aiView = views.find(v => v.id === 'understandAi');
	assert.ok(aiView, 'the AI Overview view is contributed');
	assert.ok(!aiView.name.startsWith('%'), `the view name is resolved, not a key: ${aiView.name}`);
	console.log(`AI Overview view name in ${locale}: ${aiView.name}`);
	// A localized manifest string comes as { value, original }
	const analyzeAll = extension.packageJSON.contributes.commands.find(c => c.command === 'understand.analysis.analyzeAllFiles');
	const title = analyzeAll && (typeof analyzeAll.title === 'string' ? analyzeAll.title : analyzeAll.title.value);
	console.log(`Analyze All Files command title in ${locale}: ${title}`);
	assert.strictEqual(title, expectedTitle, 'the command title comes from package.nls.<locale>.json');

	// The server side: the extension hands VS Code's language to userver
	const lines = await waitFor('userver to start', 120, async function() {
		const found = userverCommandLines().filter(l => /--pipe|--socket/.test(l));
		return found.length ? found : undefined;
	});
	const qtLocale = locale.replace(/-(\w+)$/, (_, r) => '_' + r.toUpperCase());
	assert.ok(lines.some(l => l.includes(`--locale=${qtLocale}`)), `userver should get --locale=${qtLocale}, but runs as: ${lines.join(' | ')}`);

	console.log(`l10n test passed in ${locale}: bundles, manifest and userver's --locale`);
};
