// @ts-check
'use strict';


/**
@typedef {import('../../src/viewProviders/aiChatMessage').AiChatMessage} AiChatMessage
*/


/** @type {{
	getState: () => any,
	postMessage: (message: AiChatMessage) => void,
	setState: (newState: any) => void,
}} */
// @ts-ignore
const vscode = acquireVsCodeApi();

// @ts-ignore
/** @type import('@types/markdown-it').default */
// @ts-ignore
const md = markdownit();

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
function handleClick(event)
{
	if (!(event.target instanceof HTMLButtonElement))
		return;

	if (event.target.id === 'send') {
		if (promptEnabled) {
			const input = document.getElementById('input');
			if (!(input instanceof HTMLInputElement))
				return;
			sendPrompt(input.value);
			input.value = '';
		}
		else {
			vscode.postMessage({method: 'cancel'});
			enablePrompting(true);
		}
	}
	else if (event.target.classList.contains('suggestion')) {
		event.target.remove();
		sendPrompt(event.target.innerText);
	}
}


function handleInput()
{
	const input = document.getElementById('input');
	if (!(input instanceof HTMLInputElement))
		return;

	const send = document.getElementById('send');
	if (!(send instanceof HTMLButtonElement))
		return;

	send.disabled = input.value.length === 0;
}


/** @param {KeyboardEvent} event */
function handleKeyDown(event)
{
	const input = event.target;
	if (!(input instanceof HTMLInputElement) || event.code !== 'Enter')
		return;

	// Shift enter: new line
	if (event.shiftKey) {
		// TODO switch the the same UI as annotations: <code>
		const start = input.selectionStart || 0;
		const end = input.selectionEnd || 0;
		const textBefore = input.value.substring(0, start);
		const textAfter = input.value.substring(end);
		input.value = textBefore + '\n' + textAfter;
		input.selectionStart = input.selectionEnd = start + 1;
	}
	// Enter: send
	else {
		sendPrompt(input.value);
	}
}


/** @param {MessageEvent} event */
function handleMessageEvent(event)
{
	const message = event.data;
	if (!isAiChatMessage(message))
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
		case 'error': {
			lastText = '';
			setLastCardText(message.text);
			enablePrompting(true);
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


/** @type {(obj: any) => obj is AiChatMessage} */
function isAiChatMessage(obj)
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
	if (input)
		input.focus();
}


/** @param {string} text */
function setLastCardText(text)
{
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


function main()
{
	window.onclick = handleClick;
	window.onfocus = focusOnInput;
	window.oninput = handleInput;
	window.onkeydown = handleKeyDown;
	window.onmessage = handleMessageEvent;
	enablePrompting(true);
	focusOnInput();
}


main();
