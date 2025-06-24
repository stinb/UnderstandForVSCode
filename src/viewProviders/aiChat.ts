import * as vscode from 'vscode';
import { variables } from '../other/variables';
import { escapeHtml } from '../other/html';


export class AiChatViewProvider implements vscode.WebviewViewProvider
{
	private uriStyle = '';
	private uriStyleIcons = '';
	private view?: vscode.WebviewView;


	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken)
	{
		webviewView.webview.options = {
			enableCommandUris: false,
			enableForms: false,
			enableScripts: true,
			localResourceRoots: [variables.extensionUri],
			portMapping: [],
		};
		this.uriStyle = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'views', 'aiChat.css')).toString();
		this.uriStyleIcons = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', 'codicon.css')).toString();
		this.view = webviewView;
		this.drawFirst(this.view.webview);
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

		htmlParts.push('<div id="messages">');
		htmlParts.push('<div class="message assistant" tabindex=0>**Main Purpose**\n\nThe `seq_put_decimal_ll` function is used to write a decimal number to a sequence file. It takes three parameters: the sequence file pointer, a delimiter character (if provided), and the decimal number to be written.\n\n**Key Operations**\n\n1. The function checks if there is enough space in the sequence file buffer to write two bytes of data.\n2. If a delimiter character is provided, it writes the delimiter followed by the first digit of the decimal number.\n3. It then writes the rest of the decimal number as a string.\n4. Finally, it appends a negative sign if the decimal number is negative and returns.\n\n**Overall Functionality**\n\nThe `seq_put_decimal_ll` function converts a decimal number to a sequence file buffer and writes it to the file. The function handles negative numbers by appending a negative sign before writing the rest of the number as a string. It also checks for overflow conditions when writing the string representation of the decimal number.</div>');
		htmlParts.push('<div class="message user" tabindex=0>Describe the parameters</div>');
		htmlParts.push('<div class="message assistant" tabindex=0>The `seq_put_decimal_ll` function takes three parameters:\n\n1. **`struct seq_file *m`:** This is a pointer to a struct representing the file where the numbers are being written.\n2. **`const char *delimiter`:** This is a string containing the delimiter used in writing decimal numbers (e.g., "." for morning/afternoon format).\n3. **`long long num`:** This is the number that will be written to the file, either positive or negative.\n</div>');
		htmlParts.push('</div>');

		htmlParts.push('<div id="inputs">');
		htmlParts.push('<div id="suggestions">');
		htmlParts.push('<button class="suggestion">What does seq_put_decimal_ll call?</button>');
		htmlParts.push('<button class="suggestion">Which functions call seq_put_decimal_ll?</button>');
		htmlParts.push('<button class="suggestion">What are the risks associated with seq_put_decimal_ll?</button>');
		htmlParts.push('<button class="suggestion">How do I use seq_put_decimal_ll?</button>');
		htmlParts.push('<button class="suggestion">How do I maintain seq_put_decimal_ll?</button>');
		htmlParts.push('</div>');
		htmlParts.push('<input placeholder="Prompt...">');
		htmlParts.push('<button id="send" class="small"><span class="codicon codicon-send"></span></button>');
		htmlParts.push('</div>');

		htmlParts.push('</body>');
		htmlParts.push('</html>');
		view.html = htmlParts.join('');
	}
}
