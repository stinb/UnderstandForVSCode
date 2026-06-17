import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { variables } from '../other/variables';
import { goToLocation } from '../commands/violations';


interface NavigateMessage {
	type: 'navigate';
	uri: string;
	line: number;
	character: number;
}

interface ReadyMessage {
	type: 'ready';
}


export class ViolationsViewProvider implements vscode.WebviewViewProvider
{
	private _webview: vscode.Webview | undefined;
	private _webviewView: vscode.WebviewView | undefined;
	private _lastSignature = '';
	private uriScript = '';
	private uriStyle = '';
	private cspSource = '';


	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	)
	{
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
		};
		webviewView.webview.onDidReceiveMessage(this.handleMessage, this);
		this.uriScript = webviewView.webview.asWebviewUri(
			vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'violations.js'),
		).toString();
		this.uriStyle = webviewView.webview.asWebviewUri(
			vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'violations.css'),
		).toString();
		this.cspSource = webviewView.webview.cspSource;
		this._webview = webviewView.webview;
		this._webviewView = webviewView;
		this._webview.html = this.shellHtml();
		// JS sends 'ready' when loaded; we respond with current state then
	}


	private handleMessage(message: NavigateMessage | ReadyMessage)
	{
		if (message.type === 'navigate') {
			const uri = vscode.Uri.parse(message.uri);
			goToLocation(uri, message.line, message.character);
		}
		else if (message.type === 'ready') {
			// Fresh webview DOM — force a re-render regardless of the guard
			this._lastSignature = '';
			this.update();
		}
	}


	/**
	 * Show every file's violations across the workspace (not just the active
	 * file). The diagnostics are already published by the language server for
	 * all analyzed files, so we read the whole set here and let the webview
	 * group them by file.
	 */
	update()
	{
		if (!this._webview)
			return;

		// Gather Understand violations from every file, paired with their uri
		const items: { uri: vscode.Uri, diagnostic: vscode.Diagnostic }[] = [];
		for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
			if (uri.scheme !== 'file')
				continue;
			for (const diagnostic of diagnostics)
				if (diagnostic.source === 'Understand')
					items.push({ uri, diagnostic });
		}

		// Sort by file, then by position, so file groups and rows are stable
		items.sort((a, b) => {
			const fileDiff = a.uri.fsPath.localeCompare(b.uri.fsPath);
			if (fileDiff !== 0)
				return fileDiff;
			const lineDiff = a.diagnostic.range.start.line - b.diagnostic.range.start.line;
			return lineDiff !== 0 ? lineDiff : a.diagnostic.range.start.character - b.diagnostic.range.start.character;
		});

		if (this._webviewView)
			this._webviewView.title = 'Explore Violations';

		if (items.length === 0) {
			this._webview.postMessage({ type: 'clear', message: 'No violations found in the project.' });
			return;
		}

		const violations = items.map(({ uri, diagnostic: d }) => ({
			uri: uri.toString(),
			line: d.range.start.line,
			char: d.range.start.character,
			message: d.message,
			fileName: uri.fsPath.replace(/.*[\\/]/, ''),
			filePath: uri.fsPath,
			related: (d.relatedInformation ?? []).map(info => ({
				uri: info.location.uri.toString(),
				line: info.location.range.start.line,
				char: info.location.range.start.character,
				message: info.message,
				file: info.location.uri.fsPath.replace(/.*[\\/]/, ''),
				path: info.location.uri.fsPath,
			})),
		}));

		// Skip re-rendering (which would reset scroll position) when the set of
		// violations is unchanged — diagnostics can re-publish without changing.
		const signature = JSON.stringify(violations);
		if (signature === this._lastSignature)
			return;
		this._lastSignature = signature;

		this._webview.postMessage({ type: 'update', violations });
	}


	private shellHtml(): string
	{
		const csp = escapeHtml(this.cspSource);
		return [
			'<!DOCTYPE html>',
			'<html>',
			'<head>',
			`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${csp}; style-src ${csp};">`,
			`<link rel="stylesheet" href="${escapeHtml(this.uriStyle)}">`,
			'</head>',
			'<body>',
			'<div id="root"></div>',
			`<script src="${escapeHtml(this.uriScript)}"></script>`,
			'</body>',
			'</html>',
		].join('');
	}
}
