// Runs the packaged extension against the userver of an Understand build.
// The Jenkins VSCode job unpacks the .vsix it built and gives this the
// unpacked extension folder and a workspace whose .vscode/settings.json points
// at that build's userver and a project analyzed with that build's und (#55).
//
// node test/smoke/run.js <unpacked extension folder> <workspace folder>

const os = require('os');
const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main()
{
	const [extensionDevelopmentPath, workspace] = process.argv.slice(2).map(p => path.resolve(p));
	await runTests({
		version: 'stable',
		cachePath: path.join(os.homedir(), '.cache', 'vscode-test'),
		extensionDevelopmentPath,
		extensionTestsPath: path.join(__dirname, 'suite.js'),
		launchArgs: [
			workspace,
			'--disable-extensions',
			'--disable-workspace-trust',
			'--skip-welcome',
			'--user-data-dir', path.join(os.tmpdir(), 'understand-smoke-user-data'),
		],
	});
}

main().catch(function(error) {
	console.error(error);
	process.exit(1);
});
