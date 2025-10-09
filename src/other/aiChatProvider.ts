import * as vscode from 'vscode';
import { variables } from './variables';
import { getStringFromConfig } from './config';
import { escapeHtml } from './html';
import {
	AiChatMessageFromSandbox,
	AiChatMessageToSandbox
} from '../types/aiChat';


export class AiChatProvider
{
	/** Unique names to chats */
	private map: Map<string, Chat> = new Map;

	/** Unique name of entity of focused chat */
	private uniqueName = '';


	/** Clear the last card */
	cardClear(uniqueName: string)
	{
		const chat = this.map.get(uniqueName);
		if (chat)
			chat.clearOne();
	}


	/** Error for the last card */
	cardError(uniqueName: string, text: string)
	{
		const chat = this.map.get(uniqueName);
		if (chat)
			chat.error(text);
	}


	/** Text for the last card */
	cardText(uniqueName: string, text: string)
	{
		const chat = this.map.get(uniqueName);
		if (chat)
			chat.text(text);
	}


	/** Text end for the last card */
	cardTextEnd(uniqueName: string)
	{
		const chat = this.map.get(uniqueName);
		if (chat)
			chat.textEnd();
	}


	/** If focused on a chat, copy all of it to the clipboard */
	copyFocusedChat()
	{
		const chat = this.map.get(this.uniqueName);
		if (!chat)
			return;
		chat.copy();
	}


	/** Focus on a document panel, opening it if needed */
	focus(name: string, uniqueName: string)
	{
		const chat = this.map.get(uniqueName);
		if (chat)
			chat.focus();
		else
			this.map.set(uniqueName, new Chat(name, uniqueName));
	}


	/** Get the current chat as a markdown string */
	async saveAsMarkdown(path: string)
	{
		const chat = this.map.get(this.uniqueName);
		if (chat)
			chat.saveAsMarkdown(path);
	}


	/** Remove a chat from memory because it was closed */
	removeChat(uniqueName: string)
	{
		this.map.delete(uniqueName);
	}


	/** Remember the entity */
	setFocusedChat(uniqueName: string)
	{
		this.uniqueName = uniqueName;
	}
}


/** Data and UI for a chat */
class Chat
{
	private panel: vscode.WebviewPanel;
	private suggestions: string[] = [];
	readonly uniqueName: string;


	constructor(name: string, uniqueName: string)
	{
		variables.languageClient.sendRequest('understand/aiChat/create', {
			uniqueName: uniqueName,
		}).then((suggestions) => {
			if (!Array.isArray(suggestions))
				return;
			this.suggestions = suggestions;
			this.drawSuggestions();
		});

		const half = getStringFromConfig('understand.ai.chatSize', 'Half') === 'Half';

		this.panel = vscode.window.createWebviewPanel(
			'understandChat',
			`Chat - ${name}`,
			half ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
			{ retainContextWhenHidden: true }
		);
		this.uniqueName = uniqueName;

		this.panel.onDidChangeViewState(() => {
			if (!this.panel.active)
				return;
			variables.aiChatProvider.setFocusedChat(this.uniqueName);
		});

		this.panel.onDidDispose(() => {
			variables.aiChatProvider.removeChat(this.uniqueName);
			variables.languageClient.sendRequest('understand/aiChat/delete', {uniqueName: this.uniqueName});
		});

		const webview = this.panel.webview;

		const cspSource = escapeHtml(webview.cspSource);
		const uriScriptMarkdown = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'markdown-it.min.js')).toString();
		const uriScript = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'aiChat.js')).toString();
		const uriStyle = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'aiChat.css')).toString();
		const uriStyleIcons = webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();

		webview.options = {
			enableCommandUris: false,
			enableForms: false,
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
			portMapping: [],
		};

		webview.onDidReceiveMessage(this.handleMessage, this);

		webview.html =
`<!DOCTYPE html>
<html>
<head>
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource};">
	<link rel='stylesheet' href='${escapeHtml(uriStyle)}'>
	<link rel='stylesheet' href='${escapeHtml(uriStyleIcons)}'>
</head>

<body>
	<div id="messages"></div>
	<div id="inputs">
		<div id="suggestions"></div>
		<code id="input" contenteditable placeholder="Ask anything about ${escapeHtml(name)}" data-vscode-context="{&quot;preventDefaultContextMenuItems&quot;:false}"></code>
		<button id="send" class="small" title="Send" disabled><span id="sendIcon" class="codicon codicon-send"></span></button>
	</div>

	<script src="${escapeHtml(uriScriptMarkdown)}"></script>
	<script src="${escapeHtml(uriScript)}"></script>
</body>
</html>`;
	}


	/** Clear the last card */
	clearOne()
	{
		this.postMessage({ method: 'clearOne' });
	}


	/** Copy the whole chat as markdown */
	copy()
	{
		this.postMessage({ method: 'copyAll' });
	}


	/** Error for the last card */
	error(text: string)
	{
		this.postMessage({ method: 'error', text });
	}


	/** Focus on the document tab for this chat */
	focus()
	{
		this.panel.reveal();
	}


	handleMessage(message: AiChatMessageFromSandbox)
	{
		switch (message.method) {
			case 'cancel':
				variables.languageClient.sendRequest('understand/aiChat/cancel', {
					uniqueName: this.uniqueName,
				});
				break;
			case 'edit':
				vscode.window
					.showInformationMessage('Do you want to overwrite your prompt', 'Yes', 'No')
					.then(answer => {
						if (answer === 'Yes')
							this.postMessage(message);
					});
				break;
			case 'saveFile':
				vscode.workspace.fs.writeFile(vscode.Uri.file(message.path), new TextEncoder().encode(message.content));
				break;
			case 'send':
				variables.languageClient.sendRequest('understand/aiChat/send', {
					uniqueName: this.uniqueName,
					text: message.text,
				});
				break;
		}
	}


	saveAsMarkdown(path: string)
	{
		this.postMessage({method: 'saveAsMarkdown', path});
	}


	/** Text for the last card */
	text(text: string)
	{
		this.postMessage({ method: 'text', text });
	}


	/** Text end for the last card */
	textEnd()
	{
		this.postMessage({ method: 'textEnd' });
	}


	private drawSuggestions()
	{
		this.postMessage({
			method: 'addSuggestions',
			suggestions: this.suggestions,
		});
	}


	private postMessage(message: AiChatMessageToSandbox)
	{
		this.panel.webview.postMessage(message);
	}
}
