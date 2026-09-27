import * as vscode from 'vscode';


/**
 * The two ignores run from the CodeLens, without the light bulb: "Ignore
 * <check>" stores an annotation with a template, "Ignore <check> Inline"
 * writes the UndCC_Line comment. Both are the server's own quick fixes, so
 * the lens asks for the quick fixes at the line and applies the one for this
 * check the way VS Code itself would -- its edit, then its command. The
 * server spells the file path and the violation's line in the argument, and
 * the comment's place on the line is the lexer's to work out; building either
 * on the client mismatched the server's (a lowercase drive letter, 2026-09-21).
 */

const kIgnoreCommands = {
	annotation: { command: 'understand.ignoreViolationWithDetails', key: 'violationsToIgnore' },
	inline: { command: 'understand.server.violations.ignore', key: 'violationsToRemove' },
};

// The ignores already under way. The lens goes as soon as one finishes,
// because the violation it offered is gone, but the round trip is long
// enough to click through several times, and each of those asked for the
// quick fixes while the violation was still there and wrote its own comment
// (ext #26 item 4.6, Kate 2026-09-25).
const inFlight = new Set<string>();

async function ignoreViaQuickFix(uri: vscode.Uri, where: vscode.Range, id: string, kind: keyof typeof kIgnoreCommands)
{
	const wanted = kIgnoreCommands[kind];
	const key = `${uri.toString()}\n${where.start.line}\n${id}\n${kind}`;
	if (inFlight.has(key))
		return;
	inFlight.add(key);
	try {
		await applyIgnore(uri, where, id, wanted);
	} finally {
		inFlight.delete(key);
	}
}


async function applyIgnore(
	uri: vscode.Uri, where: vscode.Range, id: string,
	wanted: { command: string, key: string })
{
	// Asked for as plain quick fixes: VS Code files the server's
	// "quickfix.ignore" under "quickfix" and drops an action whose kind does
	// not match the one requested (the exthost log said so, 2026-09-21).
	const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
		'vscode.executeCodeActionProvider', uri, where, vscode.CodeActionKind.QuickFix.value);
	const action = (actions ?? []).find(a => a.command?.command === wanted.command
		&& (a.command.arguments?.[0] as { [key: string]: { id?: string } } | undefined)?.[wanted.key]?.id === id);
	if (!action) {
		vscode.window.showErrorMessage(`No ignore is offered for ${id} on this line`);
		return;
	}
	if (action.edit) {
		// The comment is the ignore; analysis reads it from disk, so the file
		// is saved rather than left dirty for the next analysis to miss.
		await vscode.workspace.applyEdit(action.edit);
		await vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString())?.save();
	}
	if (action.command)
		await vscode.commands.executeCommand(action.command.command, ...(action.command.arguments ?? []));
}

export function ignoreWithAnnotation(uri: vscode.Uri, where: vscode.Range, id: string)
{
	return ignoreViaQuickFix(uri, where, id, 'annotation');
}

export function ignoreInline(uri: vscode.Uri, where: vscode.Range, id: string)
{
	return ignoreViaQuickFix(uri, where, id, 'inline');
}
