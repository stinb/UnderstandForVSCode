import * as vscode from 'vscode';
import { variables } from './variables';
import { getStringFromConfig } from './config';
import { escapeHtml } from './html';
import { AiChatMessage } from '../viewProviders/aiChatMessage';


export class AiChatProvider
{
	/** Unique names to chats */
	private map: Map<string, Chat> = new Map;


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


	/** Focus on a document panel, opening it if needed */
	chatFocus(name: string, uniqueName: string)
	{
		const chat = this.map.get(uniqueName);
		if (chat)
			chat.focus();
		else
			this.map.set(uniqueName, new Chat(name, uniqueName));
	}


	/** Remove a chat from memory because it was closed */
	chatRemove(uniqueName: string)
	{
		this.map.delete(uniqueName);
	}
}


/** Data and UI for a chat */
class Chat
{
	private messages: string[] = [];
	private panel: vscode.WebviewPanel;
	private prevColumn: vscode.ViewColumn | undefined = undefined;
	private prevVisible: boolean = true;
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
		);
		this.uniqueName = uniqueName;

		this.panel.onDidChangeViewState(() => {
			if (!this.panel.visible || this.prevVisible && this.prevColumn === this.panel.viewColumn) {
				this.prevColumn = this.panel.viewColumn;
				this.prevVisible = this.panel.visible;
				return;
			}
			this.prevColumn = this.panel.viewColumn;
			this.prevVisible = this.panel.visible;
			this.postMessage({
				method: 'clearAll',
			});
			for (let i = 0; i < this.messages.length; i++)
				this.postMessage({
					method: 'addMessage',
					text: this.messages[i],
					user: i % 2 === 1,
				});
			this.drawSuggestions();
		});

		this.panel.onDidDispose(() => {
			variables.aiChatProvider.chatRemove(this.uniqueName);
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
		<input id="input" placeholder="Prompt..." data-vscode-context="{&quot;preventDefaultContextMenuItems&quot;:false}">
		<button id="send" class="small" title="Send"><span id="sendIcon" class="codicon codicon-send"></span></button>
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


	handleMessage(message: AiChatMessage)
	{
		switch (message.method) {
			case 'cancel':
				variables.languageClient.sendRequest('understand/aiChat/cancel', {
					uniqueName: this.uniqueName,
				});
				break;
			case 'send':
				variables.languageClient.sendRequest('understand/aiChat/send', {
					uniqueName: this.uniqueName,
					text: message.text,
				});
				break;
		}
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


	private postMessage(message: AiChatMessage)
	{
		this.panel.webview.postMessage(message);
	}
}
