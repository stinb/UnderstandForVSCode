import * as vscode from 'vscode';


/**
 * The column to show a source file in when a tree row asks for it.
 *
 * Deliberately not the active column. The field editor is a webview panel
 * beside the text, and while it has the focus the active column is its own:
 * opening the file there buries the card behind the file (Rob 2026-09-16 for
 * the Annotation Browser, 2026-09-21 for the Violations view after a check
 * card). A webview panel is not a text editor, so the text editor columns
 * are the ones the card is not in. The file's own column wins if it already
 * has one, and the leftmost text editor otherwise.
 */
export function textEditorColumn(uri: vscode.Uri): vscode.ViewColumn
{
	let leftmost = 0;
	for (const editor of vscode.window.visibleTextEditors) {
		if (!editor.viewColumn)
			continue;
		if (editor.document.uri.toString() === uri.toString())
			return editor.viewColumn;
		if (!leftmost || editor.viewColumn < leftmost)
			leftmost = editor.viewColumn;
	}
	return leftmost || vscode.ViewColumn.One;
}
