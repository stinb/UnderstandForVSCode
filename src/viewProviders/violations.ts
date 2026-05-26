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


export class ViolationsViewProvider implements vscode.WebviewViewProvider
{
	private _currentUri: vscode.Uri | undefined;
	private _webview: vscode.Webview | undefined;
	private _webviewView: vscode.WebviewView | undefined;
	private _pendingUri: vscode.Uri | undefined;
	private _pendingDiagnostics: vscode.Diagnostic[] | undefined;
	private uriScript = '';
	private uriStyle = '';

	get currentUri(): vscode.Uri | undefined { return this._currentUri; }


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
		this._webview = webviewView.webview;
		this._webviewView = webviewView;

		if (this._pendingUri !== undefined && this._pendingDiagnostics !== undefined) {
			this.updateFile(this._pendingUri, this._pendingDiagnostics);
			this._pendingUri = undefined;
			this._pendingDiagnostics = undefined;
		}
		else {
			this.draw(undefined, []);
		}
	}


	private handleMessage(message: NavigateMessage)
	{
		if (message.type === 'navigate') {
			const uri = vscode.Uri.parse(message.uri);
			goToLocation(uri, message.line, message.character);
		}
	}


	updateFile(uri: vscode.Uri, diagnostics: vscode.Diagnostic[])
	{
		this._currentUri = uri;
		const understandDiags = diagnostics.filter(d => d.source === 'Understand');

		if (!this._webview || !this._webviewView) {
			this._pendingUri = uri;
			this._pendingDiagnostics = diagnostics;
			return;
		}

		const fileName = uri.fsPath.replace(/.*[\\/]/, '');
		this._webviewView.title = `Explore Violations - ${fileName} (${understandDiags.length})`;
		this.draw(uri, understandDiags);
	}


	clear()
	{
		if (this._currentUri === undefined)
			return;
		this._currentUri = undefined;

		if (!this._webview || !this._webviewView)
			return;
		this._webviewView.title = 'Explore Violations';
		this.draw(undefined, []);
	}


	private draw(uri: vscode.Uri | undefined, diagnostics: vscode.Diagnostic[])
	{
		if (!this._webview)
			return;

		const cspSource = escapeHtml(this._webview.cspSource);
		const parts: string[] = [];

		parts.push('<!DOCTYPE html>');
		parts.push('<html>');
		parts.push('<head>');
		parts.push(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource};">`);
		parts.push(`<link rel="stylesheet" href="${escapeHtml(this.uriStyle)}">`);
		parts.push('</head>');
		parts.push('<body>');

		if (!uri || diagnostics.length === 0) {
			const msg = uri ? 'No violations in this file.' : 'Open a file to see its violations.';
			parts.push(`<p class="empty">${escapeHtml(msg)}</p>`);
		}
		else {
			const fileUriStr = escapeHtml(uri.toString());
			for (const d of diagnostics) {
				const line = d.range.start.line;
				const char = d.range.start.character;
				const fileName = escapeHtml(uri.fsPath.replace(/.*[\\/]/, ''));
				const filePath = escapeHtml(uri.fsPath);

				parts.push('<div class="violation">');
				parts.push('<div class="separator"></div>');
				parts.push(`<div class="header" data-uri="${fileUriStr}" data-line="${line}" data-char="${char}">`);
				parts.push(`<span class="filename" data-fp="${filePath}">${fileName}</span>`);
				parts.push(`<span class="lineno">${line + 1}</span>`);
				parts.push('</div>');
				parts.push(`<div class="message" data-uri="${fileUriStr}" data-line="${line}" data-char="${char}">${escapeHtml(d.message)}</div>`);

				for (const info of d.relatedInformation ?? []) {
					const locUri = escapeHtml(info.location.uri.toString());
					const locLine = info.location.range.start.line;
					const locChar = info.location.range.start.character;
					const locFile = escapeHtml(info.location.uri.fsPath.replace(/.*[\\/]/, ''));
					const locPath = escapeHtml(info.location.uri.fsPath);
					parts.push(`<div class="location" data-uri="${locUri}" data-line="${locLine}" data-char="${locChar}">`);
					parts.push(`<span class="loc-message">${escapeHtml(info.message)}</span>`);
					parts.push(`<span class="loc-info" data-fp="${locPath}">${locFile}  ${locLine + 1}</span>`);
					parts.push('</div>');
				}

				parts.push('</div>');
			}
		}

		parts.push(`<script src="${escapeHtml(this.uriScript)}"></script>`);
		parts.push('</body>');
		parts.push('</html>');

		this._webview.html = parts.join('');
	}
}
