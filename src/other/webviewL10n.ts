import * as vscode from 'vscode';

import { escapeHtml } from './html';


/** The strings VS Code translated for its display language, handed to a
 * webview page as an attribute of its <body>: the page's scripts ask t()
 * with the English as the key and fall back to the English when the bundle
 * has no entry. The pages' content security policy forbids inline scripts,
 * hence the attribute. */
export function l10nAttribute(): string
{
	return ` data-l10n="${escapeHtml(JSON.stringify(vscode.l10n.bundle ?? {}))}"`;
}
