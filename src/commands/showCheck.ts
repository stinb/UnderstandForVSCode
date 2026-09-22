import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { openFieldEditor } from '../other/fieldEditor';
import { CheckInfo, isCheckId } from '../types/check';


/**
 * The check behind a violation, shown as a card in the field editor window:
 * name, id, its place in the plugin tree, the description, and for each
 * configuration that runs it the severity and the options as that
 * configuration has set them -- read-only, the way Understand's CodeCheck
 * configuration shows them (Rob 2026-09-17).
 *
 * One command, `understand.checks.show`, behind every way in: the Violations
 * row's inline button and menu item hand over the row, the lightbulb and the
 * check-id links VS Code puts in the Problems panel and the diagnostic hover
 * hand over the id.
 */
export async function showCheck(arg?: string | { checkId?: string })
{
	const id = typeof arg === 'string' ? arg : arg?.checkId;
	if (!id) {
		vscode.window.showErrorMessage('Select a violation to show its check');
		return;
	}
	if (!isCheckId(id)) {
		vscode.window.showInformationMessage('This is a compiler error or warning, not a check violation.');
		return;
	}
	let check: CheckInfo;
	try {
		check = await variables.languageClient.sendRequest('understand/check', { id });
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : `Failed to load the check ${id}`);
		return;
	}
	openFieldEditor({ method: 'check', title: check.name, check });
}


/**
 * The lightbulb on a violation: "Show check <id>", beside the server's own
 * Ignore actions. The diagnostic's code is the check id -- a string, or an
 * object once the diagnostic carries a codeDescription link.
 */
/**
 * The check id an Understand diagnostic carries, or undefined for a
 * diagnostic that is not Understand's or is not a check's (a parse error).
 * The code may be a plain string or VS Code's { value, target } pair.
 */
export function checkIdOf(diagnostic: vscode.Diagnostic): string | undefined
{
	if (diagnostic.source !== 'Understand')
		return undefined;
	const code = diagnostic.code;
	const id = typeof code === 'object' && code ? String(code.value) : code === undefined ? '' : String(code);
	return id && isCheckId(id) ? id : undefined;
}


export class CheckCodeActionProvider implements vscode.CodeActionProvider
{
	static readonly kinds = [vscode.CodeActionKind.QuickFix];

	provideCodeActions(_document: vscode.TextDocument, _range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext): vscode.CodeAction[]
	{
		const actions: vscode.CodeAction[] = [];
		const seen = new Set<string>();
		for (const diagnostic of context.diagnostics) {
			const id = checkIdOf(diagnostic);
			if (!id || seen.has(id))
				continue;
			seen.add(id);
			const action = new vscode.CodeAction(`Show check ${id}`, vscode.CodeActionKind.QuickFix);
			action.command = { command: 'understand.checks.show', title: 'Show Check', arguments: [id] };
			action.diagnostics = [diagnostic];
			actions.push(action);
		}
		return actions;
	}
}
