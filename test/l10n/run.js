// Runs the extension in a VS Code that really speaks Japanese: a stable VS Code
// downloaded for tests, the Japanese language pack installed into its own
// extensions folder, and --locale=ja. The workspace's .vscode/settings.json
// names the userver and project to use.
//
// node test/l10n/run.js <extension folder> <workspace folder> [locale] [vscode version]
// With UNDERSTAND_L10N_VISUAL=1 it also opens the webviews and screenshots them (visual.js).

const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } = require('@vscode/test-electron');

const PACKS = { ja: 'MS-CEINTL.vscode-language-pack-ja', 'zh-cn': 'MS-CEINTL.vscode-language-pack-zh-hans' };

async function main()
{
	const [extensionDevelopmentPath, workspace] = process.argv.slice(2, 4).map(p => path.resolve(p));
	const locale = process.argv[4] || 'ja';
	// A language pack only applies to the VS Code version it was built for, so
	// this pins a version the Marketplace has the packs for
	const version = process.argv[5] || '1.131.0';
	const cachePath = path.join(os.homedir(), '.cache', 'vscode-test');
	const userDataDir = path.join(os.tmpdir(), `understand-l10n-test-${locale}-user-data`);
	const extensionsDir = path.join(os.tmpdir(), `understand-l10n-test-${locale}-extensions`);

	const vscodeExecutablePath = await downloadAndUnzipVSCode({ version, cachePath });
	const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
	const install = spawnSync(cli, [...cliArgs, '--extensions-dir', extensionsDir, '--user-data-dir', userDataDir,
		'--install-extension', PACKS[locale]], { encoding: 'utf-8', shell: process.platform === 'win32' });
	process.stdout.write(install.stdout || '');
	process.stderr.write(install.stderr || '');
	if (install.status !== 0)
		throw new Error(`Installing ${PACKS[locale]} failed with status ${install.status}`);

	process.env.UNDERSTAND_L10N_LOCALE = locale;
	const launchArgs = [
		workspace,
		`--locale=${locale}`,
		'--disable-workspace-trust',
		'--skip-welcome',
		'--user-data-dir', userDataDir,
		'--extensions-dir', extensionsDir,
	];
	// The first start after the pack's installation only records it in the
	// language pack cache; the language applies from the next start
	// UNDERSTAND_L10N_VISUAL=1 also opens the webviews and screenshots them
	const suites = ['warmup.js', 'suite.js'];
	if (process.env.UNDERSTAND_L10N_VISUAL)
		suites.push('visual.js');
	for (const suite of suites)
		await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath: path.join(__dirname, suite), launchArgs });
}

main().catch(function(error) {
	console.error(error);
	process.exit(1);
});
