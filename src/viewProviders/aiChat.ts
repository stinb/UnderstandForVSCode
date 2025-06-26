import * as vscode from 'vscode';
import { variables } from '../other/variables';
import { escapeHtml } from '../other/html';
import { AiChatMessage } from './aiChatMessage';


export class AiChatViewProvider implements vscode.WebviewViewProvider
{
	private chats: Map<string, Chat> = new Map;
	private uriScriptMarkdown = '';
	private uriScript = '';
	private uriStyle = '';
	private uriStyleIcons = '';
	private view?: vscode.WebviewView;
	private page: Page = Page.None;


	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken)
	{
		webviewView.onDidChangeVisibility(this.handleChangeVisibility, this);
		webviewView.webview.options = {
			enableCommandUris: false,
			enableForms: false,
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
			portMapping: [],
		};
		this.uriScriptMarkdown = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'markdown-it.min.js')).toString();
		this.uriScript = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'aiChat.js')).toString();
		this.uriStyle = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'aiChat.css')).toString();
		this.uriStyleIcons = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();
		this.view = webviewView;
	}


	/** Start a chat or continue an existing one for the given entity */
	async setEntity(uniqueName: string)
	{
		await vscode.commands.executeCommand('understandAiChat.focus');
		if (!this.view)
			return;

		if (this.page !== Page.Chat) {
			this.page = Page.Chat;
			this.drawEmptyChat(this.view.webview);
		}
		else {
			this.postMessage(this.view.webview, {method: 'clear'});
		}

		const chat = this.chats.get(uniqueName);
		if (chat !== undefined)
			return this.openChat(this.view.webview, chat);

		// TODO send the request instead of using this hard-coded info
		// const newChat: Chat = await variables.languageClient.sendRequest('understand/aiChat/create', {uniqueName});
		const newChat: Chat = {
			entityName: 'seq_put_decimal_ll',
			messages: [
				'**Main Purpose**\n\nThe `seq_put_decimal_ll` function is used to write a decimal number to a sequence file. It takes three parameters: the sequence file pointer, a delimiter character (if provided), and the decimal number to be written.\n\n**Key Operations**\n\n1. The function checks if there is enough space in the sequence file buffer to write two bytes of data.\n2. If a delimiter character is provided, it writes the delimiter followed by the first digit of the decimal number.\n3. It then writes the rest of the decimal number as a string.\n4. Finally, it appends a negative sign if the decimal number is negative and returns.\n\n**Overall Functionality**\n\nThe `seq_put_decimal_ll` function converts a decimal number to a sequence file buffer and writes it to the file. The function handles negative numbers by appending a negative sign before writing the rest of the number as a string. It also checks for overflow conditions when writing the string representation of the decimal number.',
				'Describe the parameters',
				'The `seq_put_decimal_ll` function takes three parameters:\n\n1. **`struct seq_file *m`:** This is a pointer to a struct representing the file where the numbers are being written.\n2. **`const char *delimiter`:** This is a string containing the delimiter used in writing decimal numbers (e.g., "." for morning/afternoon format).\n3. **`long long num`:** This is the number that will be written to the file, either positive or negative.\n',
			],
			suggestions: [
				'What does seq_put_decimal_ll call?',
				'Which functions call seq_put_decimal_ll?',
				'What are the risks associated with seq_put_decimal_ll?',
				'How do I use seq_put_decimal_ll?',
				'How do I maintain seq_put_decimal_ll?',
			],
		};
		this.chats.set(uniqueName, newChat);
		this.openChat(this.view.webview, newChat);
	}


	/** Now that the view exists, draw a single chat */
	private drawEmptyChat(view: vscode.Webview)
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

		htmlParts.push('<div id="messages"></div>');

		htmlParts.push('<div id="inputs">');
		htmlParts.push('<div id="suggestions"></div>');
		htmlParts.push('<input id="input" placeholder="Prompt..." data-vscode-context="{&quot;preventDefaultContextMenuItems&quot;:false}">');
		htmlParts.push('<button id="send" class="small"><span class="codicon codicon-send"></span></button>');
		htmlParts.push('</div>');

		htmlParts.push(`<script src="${escapeHtml(this.uriScriptMarkdown)}"></script>`);
		htmlParts.push(`<script src="${escapeHtml(this.uriScript)}"></script>`);

		htmlParts.push('</body>');
		htmlParts.push('</html>');
		view.html = htmlParts.join('');
	}


	/** Focus on the prompt input field */
	private handleChangeVisibility()
	{
		if (this.view && this.view.visible)
			this.postMessage(this.view.webview, {method: 'focus'});
	}


	/** Draw the messages and suggestions */
	private openChat(view: vscode.Webview, chat: Chat)
	{
		this.postMessage(view, {method: 'addSuggestions', suggestions: chat.suggestions});
		for (let i = 0 ; i < chat.messages.length; i++)
			this.postMessage(view, {method: 'addMessage', text: chat.messages[i], user: i % 2 === 1});
	}


	/** Send a message to the web view */
	private postMessage(view: vscode.Webview, message: AiChatMessage)
	{
		view.postMessage(message);
	}
}


enum Page {
	None,
	Chats,
	Chat,
}


type Chat = {
	entityName: string,
	messages: string[],
	suggestions: string[],
};
