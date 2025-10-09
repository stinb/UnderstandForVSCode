// @ts-check
'use strict';


/**
@typedef {import('../../src/types/aiChat').AiChatMessageFromSandbox} AiChatMessageFromSandbox
@typedef {import('../../src/types/aiChat').AiChatMessageToSandbox} AiChatMessageToSandbox
*/


/** @type {{
	getState: () => any,
	postMessage: (message: AiChatMessageFromSandbox) => void,
	setState: (newState: any) => void,
}} */
// @ts-ignore
const vscode = acquireVsCodeApi();

// @ts-ignore
/** @type import('@types/markdown-it').default */
// @ts-ignore
const md = markdownit();

/** @type {string[]} */
const messages = [];

const domParser = new DOMParser();

let lastText = '';

let promptEnabled = true;


/**
 * @param {Element} parent
 * @param {string} text
 */
function drawMarkdown(parent, text)
{
	parent.innerHTML = '';
	const body = domParser.parseFromString(md.render(text), 'text/html').body;
	for (const child of body.querySelectorAll('iframe, link, script'))
		child.remove();
	for (const element of body.childNodes) {
		if (element instanceof HTMLIFrameElement
		|| element instanceof HTMLLinkElement
		|| element instanceof HTMLScriptElement)
			continue;
		parent.append(element);
	}
}


/**
 * @param {boolean} user
 * @param {string} text
 */
function drawNewMessage(user, text)
{
	messages.push(text);

	const messagesUi = document.getElementById('messages');
	if (!messagesUi)
		return;

	const messageUi = document.createElement('div');
	messageUi.className = user ? 'message user' : 'message assistant';
	messagesUi.appendChild(messageUi);

	const bodyUi = document.createElement('div');
	bodyUi.className = 'body';
	if (text.length)
		drawMarkdown(bodyUi, text);
	else
		drawProgress(bodyUi);
	messageUi.appendChild(bodyUi);

	const buttonsUi = document.createElement('div');
	buttonsUi.className = 'buttons';
	messageUi.appendChild(buttonsUi);

	const i = (messages.length - 1).toString();

	const copyButton = document.createElement('button');
	copyButton.className = 'codicon codicon-copy small';
	copyButton.title = 'Copy';
	copyButton.onclick = handleClickCopy;
	copyButton.dataset.index = i;
	buttonsUi.appendChild(copyButton);

	// // TODO
	// if (user) {
	// 	const editButton = document.createElement('button');
	// 	editButton.className = 'codicon codicon-edit small';
	// 	editButton.title = 'Edit';
	// 	copyButton.dataset.index = i;
	// 	buttonsUi.appendChild(editButton);
	// }
	// else {
	// 	const regenerateButton = document.createElement('button');
	// 	regenerateButton.className = 'codicon codicon-refresh small';
	// 	regenerateButton.title = 'Regenerate';
	// 	copyButton.dataset.index = i;
	// 	buttonsUi.appendChild(regenerateButton);
	// }
}


/**
 * @param {Element} element
 */
function drawProgress(element)
{
	const iconUi = document.createElement('span');
	iconUi.className = 'codicon codicon-ellipsis';
	element.innerHTML = '';
	element.appendChild(iconUi);
}


/**
 * @param {boolean} enable
 */
function enablePrompting(enable)
{
	promptEnabled = enable;
	for (const element of document.getElementsByClassName('suggestion'))
		if (element instanceof HTMLButtonElement)
			element.disabled = !enable;
	const send = document.getElementById('send');
	if (send)
		send.title = enable ? 'Send' : 'Cancel';
	const icon = document.getElementById('sendIcon');
	if (icon)
		icon.className = enable ? 'codicon codicon-send' : 'codicon codicon-error';
}


function focusOnInput()
{
	const element = document.getElementById('input');
	if (element)
		element.focus();
}


/**
 * @param {MouseEvent} event
 */
function handleClickCopy(event)
{
	if (!(event.target instanceof HTMLElement))
		return;

	// @ts-ignore undefined works
	const i = parseInt(event.target.dataset.index);
	if (isNaN(i))
		return;

	const message = messages[i];
	if (message)
		navigator.clipboard.writeText(message);
}


function handleClickSend()
{
	if (promptEnabled) {
		const input = document.getElementById('input');
		if (!input)
			return;
		sendPrompt(input.innerText);
	}
	else {
		vscode.postMessage({method: 'cancel'});
		enablePrompting(true);
	}
}


/**
 * @param {MouseEvent} event
 */
function handleClickSuggestion(event)
{
	if (!(event.target instanceof HTMLElement))
		return;

	event.target.remove();
	sendPrompt(event.target.innerText);
}


/** @param {KeyboardEvent} event */
function handleKeyDown(event)
{
	// Shift-enter: insert a new line
	if (event.shiftKey)
		return;

	const input = event.target;
	if (!(input instanceof HTMLElement) || event.code !== 'Enter')
		return;

	// Enter: send prompt
	sendPrompt(input.innerText);
	updateSendButton();
}


/** @param {MessageEvent} event */
function handleMessageEvent(event)
{
	const message = event.data;
	if (!isAiChatMessageToSandbox(message))
		return;

	switch (message.method) {
		case 'addMessage': {
			lastText = '';
			drawNewMessage(message.user, message.text);
			break;
		}
		case 'addSuggestions': {
			const suggestionsUi = document.getElementById('suggestions');
			if (!suggestionsUi)
				break;
			for (let i = 0; i < message.suggestions.length; i++) {
				const suggestionUi = document.createElement('button');
				suggestionUi.className = 'suggestion';
				suggestionUi.innerText = message.suggestions[i];
				suggestionUi.onclick = handleClickSuggestion;
				suggestionsUi.appendChild(suggestionUi);
			}
			break;
		}
		case 'clearAll': {
			lastText = '';
			let ui = document.getElementById('messages');
			if (ui)
				ui.innerHTML = '';
			ui = document.getElementById('suggestions');
			if (ui)
				ui.innerHTML = '';
			break;
		}
		case 'clearOne': {
			lastText = '';
			setLastCardText(lastText);
			break;
		}
		case 'copyAll': {
			navigator.clipboard.writeText(toMarkdown());
			break;
		}
		case 'error': {
			lastText = '';
			setLastCardText(message.text);
			enablePrompting(true);
			break;
		}
		case 'saveAsMarkdown': {
			vscode.postMessage({
				method: 'saveFile',
				content: toMarkdown(),
				path: message.path,
			});
			break;
		}
		case 'text': {
			lastText += message.text;
			setLastCardText(lastText);
			break;
		}
		case 'textEnd': {
			enablePrompting(true);
			break;
		}
	}
}


/** @type {(obj: any) => obj is AiChatMessageToSandbox} */
function isAiChatMessageToSandbox(obj)
{
	return obj !== null && !Array.isArray(obj) && typeof(obj) === 'object'
		&& typeof obj.method === 'string';
}


/** @returns {HTMLDivElement | null} */
function getLastCard()
{
	return document.querySelector('div.message:last-child');
}


/** @param {string} text */
function sendPrompt(text)
{
	if (text.length === 0)
		return;

	lastText = '';
	drawNewMessage(true, text);
	drawNewMessage(false, '');
	enablePrompting(false);
	vscode.postMessage({
		method: 'send',
		text,
	});
	const input = document.getElementById('input');
	if (input) {
		input.innerText = '';
		input.focus();
	}
	updateSendButton();
}


/** @param {string} text */
function setLastCardText(text)
{
	if (messages.length)
		messages[messages.length - 1] = text;

	const card = getLastCard();
	if (!card)
		return;
	const body = card.querySelector('div.body');
	if (!body)
		return;
	if (text.length)
		drawMarkdown(body, text);
	else
		drawProgress(body);
}


function toMarkdown()
{
	let result = '';
	for (let i = 0; i < messages.length; i++) {
		result += (i % 2 === 0) ? '\n## Assistant\n\n' : '\n## User\n\n';
		result += messages[i];
		result += '\n\n';
	}
	return result;
}


function updateSendButton()
{
	const input = document.getElementById('input');
	if (!input)
		return;
	if (input.innerHTML === '<br>' || input.innerHTML === '\n\n')
		input.innerHTML = '';

	const send = document.getElementById('send');
	if (!(send instanceof HTMLButtonElement))
		return;

	send.disabled = input.innerText.length === 0;
}


function main()
{
	window.onfocus = focusOnInput;
	window.onmessage = handleMessageEvent;

	const send = document.getElementById('send');
	if (send)
		send.onclick = handleClickSend;

	const input = document.getElementById('input');
	if (input) {
		input.oninput = updateSendButton;
		input.onkeydown = handleKeyDown;
	}

	enablePrompting(true);
	focusOnInput();
}


main();
