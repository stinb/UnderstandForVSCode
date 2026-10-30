import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { followEntity } from '../other/entityHeaders';
import { getBooleanFromConfig } from '../other/config';
import { variables } from '../other/variables';
import { executeCommand } from '../commands/helpers';
import {
	AnnotationMessageFromSandbox,
	AnnotationMessageToSandbox,
	Card,
	Section
} from '../types/annotation';


/** The setting behind the view's title-bar toggle */
export const kAutomaticSetting = 'understand.aiView.automaticallyGenerate';

// The title bar offers Generate Automatically or Generate On Click by this key
const kAutomaticContext = 'understand.aiGenerateAutomatically';


export class AiViewProvider implements vscode.WebviewViewProvider
{
	private annotationSections: Section[] = [];
	// The cards asked for on their own, each once: a card whose generation
	// failed or was stopped keeps its sparkle instead of being asked for again
	// on every move
	private autoRequested = new Set<string>();
	private uriScriptMarkdown = '';
	private uriScript = '';
	private uriStyle = '';
	private uriStyleIcons = '';
	private view?: vscode.WebviewView;


	constructor()
	{
		this.setAutomatic(getBooleanFromConfig(kAutomaticSetting));
	}


	cardClear(uniqueName: string)
	{
		const card = this.findCard(uniqueName);
		if (card)
			card.body = '';
		if (this.view)
			this.postMessage(this.view.webview, {
				method: 'aiClear',
				uniqueName: uniqueName,
			});
	}

	cardError(uniqueName: string, text: string)
	{
		const card = this.findCard(uniqueName);
		if (card)
			card.body = text;
		if (this.view)
			this.postMessage(this.view.webview, {
				method: 'aiError',
				uniqueName: uniqueName,
				text: text,
			});
	}

	cardText(uniqueName: string, text: string)
	{
		const card = this.findCard(uniqueName);
		if (card)
			card.body += text;
		if (this.view)
			this.postMessage(this.view.webview, {
				method: 'aiText',
				uniqueName: uniqueName,
				text: text,
			});
	}

	cardTextEnd(uniqueName: string)
	{
		if (this.view)
			this.postMessage(this.view.webview, {
				method: 'aiTextEnd',
				uniqueName: uniqueName,
			});
	}


	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken)
	{
		webviewView.onDidChangeVisibility(this.handleChangeVisibility, this);
		webviewView.webview.onDidReceiveMessage(this.handleMessage, this);
		webviewView.webview.options = {
			enableCommandUris: false,
			enableForms: false,
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
			portMapping: [],
		};
		this.uriScriptMarkdown = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'markdown-it.min.js')).toString();
		this.uriScript = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.js')).toString();
		this.uriStyle = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'annotations.css')).toString();
		this.uriStyleIcons = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();
		this.view = webviewView;
		followEntity(webviewView);
		this.drawFirst(this.view.webview);
	}


	/** Update HTML now or do it after it's created */
	update(annotationSections: Section[])
	{
		this.annotationSections = annotationSections;
		if (this.view)
			this.drawUpdate(this.view.webview);
		this.generateEmptyCards();
	}


	/** Generate an overview for every card the view shows, as Understand's AI
	 * Overview window does, or wait for a click (Rob, 2026-10-29) */
	setAutomatic(on: boolean)
	{
		vscode.commands.executeCommand('setContext', kAutomaticContext, on);
		if (on)
			this.generateEmptyCards();
	}


	/** Understand's window generates only while it is open: so does this, only
	 * while the view is visible */
	private generateEmptyCards()
	{
		if (!this.view?.visible || !getBooleanFromConfig(kAutomaticSetting))
			return;
		const uniqueNames: string[] = [];
		for (const section of this.annotationSections)
			for (const card of section.cards)
				if (card.body.length === 0 && !this.autoRequested.has(card.id)) {
					this.autoRequested.add(card.id);
					uniqueNames.push(card.id);
				}
		// The server skips an entity that is queued or generating already
		if (uniqueNames.length)
			executeCommand('understand.server.ai.generateAiOverview', uniqueNames).then(undefined, () => {});
	}


	/** Now that the view exists, initialize page */
	private drawFirst(view: vscode.Webview)
	{
		const htmlParts = [];
		htmlParts.push('<!DOCTYPE html>');
		htmlParts.push('<html data-vscode-context=\'{"preventDefaultContextMenuItems": true}\'>');

		htmlParts.push('<head>');
		const cspSource = escapeHtml(view.cspSource);
		htmlParts.push(`<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; font-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource};">`);
		htmlParts.push(`<link rel='stylesheet' href='${escapeHtml(this.uriStyle)}'>`);
		htmlParts.push(`<link rel='stylesheet' href='${escapeHtml(this.uriStyleIcons)}'>`);
		htmlParts.push('</head>');

		htmlParts.push('<body>');

		htmlParts.push('<div id="sections">');
		htmlParts.push('</div>');

		// Prevent the last code element from stealing focus
		htmlParts.push('<span class="invisible">_</span>');

		htmlParts.push(`<script src="${escapeHtml(this.uriScriptMarkdown)}"></script>`);
		htmlParts.push(`<script src="${escapeHtml(this.uriScript)}"></script>`);

		htmlParts.push('</body>');
		htmlParts.push('</html>');
		view.html = htmlParts.join('');

		this.drawUpdate(view);
	}


	private drawUpdate(view: vscode.Webview)
	{
		this.postMessage(view, {method: 'drawAi', sections: this.annotationSections});
	}


	private findCard(uniqueName: string): Card | null
	{
		for (const section of this.annotationSections)
			for (const card of section.cards)
				if (card.id === uniqueName)
					return card;
		return null;
	}


	private handleChangeVisibility()
	{
		if (this.view && this.view.visible) {
			this.drawFirst(this.view.webview);
			this.generateEmptyCards();
		}
	}


	private handleMessage(message: AnnotationMessageFromSandbox)
	{
		switch (message.method) {
			case 'generateMany':
				executeCommand('understand.server.ai.generateAiOverview', message.uniqueNames);
				break;
			case 'open': {
				const uri: vscode.Uri = vscode.Uri.parse(message.uri);
				if (uri.scheme !== 'file')
					break;
				const position = new vscode.Position(message.line, message.character);
				const options: vscode.TextDocumentShowOptions = {
					selection: new vscode.Selection(position, position),
				};
				vscode.window.showTextDocument(uri, options);
				break;
			}
			case 'regenerate':
				executeCommand('understand.server.ai.generateAiOverview', [message.uniqueName]);
				break;
			case 'startChat':
				variables.aiChatProvider.focus(message.name, message.uniqueName);
				break;
		}
	}


	private postMessage(view: vscode.Webview, message: AnnotationMessageToSandbox)
	{
		view.postMessage(message);
	}
}
