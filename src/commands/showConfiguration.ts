import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { openFieldEditor } from '../other/fieldEditor';
import { ConfigurationInfo, ConfigurationSummary } from '../types/check';


/**
 * A CodeCheck configuration, shown as a card in the field editor window:
 * whether it runs in the background, the paths it skips, and the checks it
 * runs with the severity and options it sets for each -- read-only, the
 * configuration being Understand's (Rob 2026-10-01). A check row opens that
 * check's card; the check card's "Runs in" title comes back here.
 *
 * One command, `understand.checks.showConfiguration`, behind every way in.
 * Given a name it shows that configuration. Given none -- the Violations
 * view's title menu, the palette -- it asks the server for the project's
 * configurations and offers them in a picker, skipping the picker when
 * there is only one.
 */
export async function showConfiguration(arg?: string)
{
	const name = typeof arg === 'string' && arg ? arg : await pickConfiguration();
	if (!name)
		return;
	let configuration: ConfigurationInfo;
	try {
		configuration = await variables.languageClient.sendRequest('understand/configuration', { name });
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : `Failed to load the CodeCheck configuration ${name}`);
		return;
	}
	openFieldEditor({ method: 'configuration', title: configuration.name, configuration });
}


async function pickConfiguration(): Promise<string | undefined>
{
	let listed: { configurations: ConfigurationSummary[] };
	try {
		listed = await variables.languageClient.sendRequest('understand/configurations', {});
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : 'Failed to list the CodeCheck configurations');
		return undefined;
	}
	const configurations = listed.configurations ?? [];
	if (!configurations.length) {
		vscode.window.showInformationMessage('The project has no CodeCheck configurations.');
		return undefined;
	}
	if (configurations.length === 1)
		return configurations[0].name;
	const picked = await vscode.window.showQuickPick(
		configurations.map(c => ({
			label: c.name,
			description: `${c.checkCount} ${c.checkCount === 1 ? 'check' : 'checks'}`,
			detail: [
				c.automatic ? 'Runs in the background' : 'Runs on demand',
				c.excludes.length ? `Excludes ${c.excludes.join(', ')}` : '',
			].filter(Boolean).join(' · '),
		})),
		{ placeHolder: 'CodeCheck configuration to show', matchOnDescription: true, matchOnDetail: true });
	return picked?.label;
}
