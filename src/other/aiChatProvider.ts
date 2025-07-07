import * as vscode from 'vscode';
import { variables } from './variables';
import { getStringFromConfig } from './config';


export class AiChatProvider
{
	// Unique names to panels
	private map: Map<string, Chat> = new Map;


	// Focus on a document panel, opening it if needed
	focus(name: string, uniqueName: string)
	{
		const chat = this.map.get(uniqueName);
		if (chat)
			chat.focus();
		else
			this.map.set(uniqueName, new Chat(name, uniqueName));
	}


	// Remove a chat from memory because it was closed
	remove(uniqueName: string)
	{
		this.map.delete(uniqueName);
	}
}


class Chat
{
	readonly uniqueName: string;

	private panel: vscode.WebviewPanel;


	constructor(name: string, uniqueName: string)
	{
		const half = getStringFromConfig('understand.ai.chatSize', 'Half') === 'Half';

		this.panel = vscode.window.createWebviewPanel(
			'understandChat',
			`Chat - ${name}`,
			half ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
		);

		this.panel.onDidDispose(() => {
			variables.aiChatProvider.remove(this.uniqueName);
		});

		// TODO
		this.panel.webview.html = '<head><style>:root { --outline: 1px; --spacing: 1rem; --transition: 0.125s;}@font-face { font-family: "codicon"; src: url("https://file%2B.vscode-resource.vscode-cdn.net/c%3A/SciTools/UnderstandForVSCode/res/codicon.ttf") format("ttf"); font-display: block;}body { padding: 0; height: 100vh; display: flex; flex-direction: column;}::selection { color: unset; background: var(--vscode-selection-background);}#messages { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: var(--spacing); padding: var(--spacing); padding-bottom: var(--outline); min-height: 10rem;}.message, input { padding: var(--spacing); line-height: 1.5em;}.message { width: fit-content;}.message.assistant { background: var(--vscode-input-background);}.message.user, .suggestion, input { background: var(--vscode-menu-background);}.message.user { align-self: end;}.message > :first-child { margin-top: 0;}.message > :last-child { margin-bottom: 0;}input:focus, button:focus-visible { outline: var(--outline) solid var(--vscode-focusBorder);}:disabled { opacity: 75%;}#inputs { display: flex; flex-direction: column; padding: var(--spacing); position: relative;}button, input { font-family: unset; font-size: unset; transition: color var(--transition), opacity var(--transition);}button { border: none; color: var(--vscode-menu-foreground); user-select: none;}button * { pointer-events: none; user-select: none;}button:not(:disabled) { cursor: pointer;}#suggestions { margin-right: calc(var(--spacing)* -1);}.suggestion { border-radius: var(--spacing); padding: calc(var(--spacing)* 0.5) var(--spacing); margin-right: var(--spacing); margin-bottom: var(--spacing); text-align: left;}.suggestion:hover:not(:disabled), .suggestion:active:not(:disabled) { color: var(--vscode-textLink-foreground);}input { color: unset; border: none; padding-top: calc(var(--spacing) / 2); padding-bottom: calc(var(--spacing) / 2); padding-right: calc(var(--spacing) * 3.25);}button.small { align-items: center; background: none; border-radius: 5px; display: flex; height: 1.25rem; justify-content: center; padding: 0; width: 1.25rem;}button.small:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground);}#send { position: absolute; bottom: calc(var(--spacing) * 1.5); right: calc(var(--spacing) * 2);}</style></head><body><div id="messages"><div class="message assistant"><p><strong>Main Purpose</strong></p><p>The <code>seq_put_decimal_ll</code> function is used to write a decimal number to a sequence file. It takes three parameters: the sequence file pointer, a delimiter character (if provided), and the decimal number to be written.</p><p><strong>Key Operations</strong></p><ol><li>The function checks if there is enough space in the sequence file buffer to write two bytes of data.</li><li>If a delimiter character is provided, it writes the delimiter followed by the first digit of the decimal number.</li><li>It then writes the rest of the decimal number as a string.</li><li>Finally, it appends a negative sign if the decimal number is negative and returns.</li></ol><p><strong>Overall Functionality</strong></p><p>The <code>seq_put_decimal_ll</code> function converts a decimal number to a sequence file buffer and writes it to the file. The function handles negative numbers by appending a negative sign before writing the rest of the number as a string. It also checks for overflow conditions when writing the string representation of the decimal number.</p></div><div class="message user"><p>Describe the parameters</p></div><div class="message assistant"><p>The <code>seq_put_decimal_ll</code> function takes three parameters:</p><ol><li><strong><code>struct seq_file *m</code>:</strong> This is a pointer to a struct representing the file where the numbers are being written.</li><li><strong><code>const char *delimiter</code>:</strong> This is a string containing the delimiter used in writing decimal numbers (e.g., "." for morning/afternoon format).</li><li><strong><code>long long num</code>:</strong> This is the number that will be written to the file, either positive or negative.</li></ol></div></div><div id="inputs"><div id="suggestions"><button class="suggestion">What does seq_put_decimal_ll call?</button><button class="suggestion">Which functions call seq_put_decimal_ll?</button><button class="suggestion">What are the risks associated with seq_put_decimal_ll?</button><button class="suggestion">How do I use seq_put_decimal_ll?</button><button class="suggestion">How do I maintain seq_put_decimal_ll?</button></div><input id="input" placeholder="Prompt..." data-vscode-context="{&quot;preventDefaultContextMenuItems&quot;:false}"><button id="send" class="small"><span class="codicon codicon-send"></span></button></div></body>';

		this.uniqueName = uniqueName;
	}


	focus()
	{
		this.panel.reveal();
	}
}
