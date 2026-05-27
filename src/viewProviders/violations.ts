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
	private _currentUri: vscode.Uri | undefined;
	private _currentDiagnostics: vscode.Diagnostic[] = [];
	private _webview: vscode.Webview | undefined;
	private _webviewView: vscode.WebviewView | undefined;
	private uriScript = '';
	private uriStyle = '';
	private cspSource = '';

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
			this.postUpdate();
		}
	}


	updateFile(uri: vscode.Uri, diagnostics: vscode.Diagnostic[])
	{
		this._currentUri = uri;
		this._currentDiagnostics = diagnostics.filter(d => d.source === 'Understand');

		if (this._webviewView) {
			const fileName = uri.fsPath.replace(/.*[\\/]/, '');
			this._webviewView.title = `Explore Violations - ${fileName} (${this._currentDiagnostics.length})`;
		}

		if (this._webview)
			this.postUpdate();
	}


	clear()
	{
		if (this._currentUri === undefined)
			return;
		this._currentUri = undefined;
		this._currentDiagnostics = [];

		if (this._webviewView)
			this._webviewView.title = 'Explore Violations';

		if (this._webview)
			this.postUpdate();
	}


	private postUpdate()
	{
		if (!this._webview)
			return;

		const uri = this._currentUri;
		const diagnostics = this._currentDiagnostics;

		if (!uri || diagnostics.length === 0) {
			const msg = uri ? 'No violations in this file.' : 'Open a file to see its violations.';
			this._webview.postMessage({ type: 'clear', message: msg });
			return;
		}

		const sorted = [...diagnostics].sort((a, b) => {
			const lineDiff = a.range.start.line - b.range.start.line;
			return lineDiff !== 0 ? lineDiff : a.range.start.character - b.range.start.character;
		});

		const violations = sorted.map(d => ({
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
