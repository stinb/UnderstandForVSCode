import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { InspectionSummary } from '../types/check';


/**
 * Which CodeCheck results the Violations view shows (Rob 2026-10-03).
 *
 * Understand's eye button syncs a result into the project inspection, and
 * the view follows that by default. This picker lets the view differ: a
 * result Understand syncs can be left out here, one it does not can be
 * taken in, without touching Understand's own set. The choice lives in the
 * workspace setting `understand.violationsView.syncedInspections` as result
 * id to shown; the server reads it like any other setting and builds the
 * view from it. Every row says what Understand's eye is doing, so the two
 * are never confused, and one button goes back to following Understand.
 */
const kSection = 'understand.violationsView';
const kSetting = 'syncedInspections';

type Overrides = Record<string, boolean>;

type Item = vscode.QuickPickItem & { inspection: InspectionSummary };


function syncedInspectionOverrides(): Overrides
{
	return vscode.workspace.getConfiguration(kSection).get<Overrides>(kSetting) ?? {};
}


export async function syncedInspections()
{
	let listed: { inspections: InspectionSummary[] };
	try {
		listed = await variables.languageClient.sendRequest('understand/inspections', {});
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : 'Failed to list the CodeCheck results');
		return;
	}
	const inspections = listed.inspections ?? [];
	if (!inspections.length) {
		vscode.window.showInformationMessage('The project has no CodeCheck results to sync.');
		return;
	}

	const overrides = syncedInspectionOverrides();
	const shownHere = (i: InspectionSummary) => overrides[i.id] ?? i.synced;
	const items: Item[] = inspections.map(i => {
		const eye = i.synced ? 'eye on in Understand' : 'eye off in Understand';
		const here = i.id in overrides
			? (overrides[i.id] ? 'shown here only' : 'hidden here')
			: '';
		// Understand names a result by its date, so the file name, which the
		// setting is keyed by, rides in the description; a result without a
		// name is labelled by the file name and dated instead.
		return {
			label: i.name || i.id,
			description: `${i.violations} ${i.violations === 1 ? 'violation' : 'violations'} · ${i.name ? i.id : new Date(i.start).toLocaleString()}`,
			detail: [i.configuration, eye, here, i.aborted ? 'aborted' : ''].filter(Boolean).join(' · '),
			inspection: i,
		};
	});

	const follow: vscode.QuickInputButton = {
		iconPath: new vscode.ThemeIcon('discard'),
		tooltip: 'Follow Understand: clear every override',
	};
	const pick = vscode.window.createQuickPick<Item>();
	pick.title = 'Synced Inspections';
	pick.placeholder = 'Checked results are shown in the Violations view; each row says what Understand\'s eye does';
	pick.canSelectMany = true;
	pick.matchOnDescription = true;
	pick.matchOnDetail = true;
	pick.buttons = [follow];
	pick.items = items;
	pick.selectedItems = items.filter(item => shownHere(item.inspection));

	// No message afterwards: the view's header says "N overridden" while it
	// differs from Understand and nothing when it follows.
	pick.onDidTriggerButton(() => {
		pick.hide();
		setOverrides({});
	});
	pick.onDidAccept(() => {
		const selected = new Set(pick.selectedItems.map(item => item.inspection.id));
		pick.hide();
		const next: Overrides = {};
		for (const i of inspections) {
			if (selected.has(i.id) !== i.synced)
				next[i.id] = selected.has(i.id);
		}
		setOverrides(next);
	});
	pick.onDidHide(() => pick.dispose());
	pick.show();
}


async function setOverrides(next: Overrides)
{
	const target = vscode.workspace.workspaceFolders?.length
		? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
	await vscode.workspace.getConfiguration(kSection).update(
		kSetting, Object.keys(next).length ? next : undefined, target);
}
