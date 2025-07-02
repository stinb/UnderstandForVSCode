// @ts-check
'use strict';


/**
@typedef {import('../../src/viewProviders/aiChatMessage').AiChatMessage} AiChatMessage
*/


// @ts-ignore
/** @type import('@types/markdown-it').default */
// @ts-ignore
const md = markdownit();

const domParser = new DOMParser();


/**
 * @param {HTMLElement} parent
 * @param {string} text
 */
function drawMarkdown(parent, text)
{
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


function focusOnInput()
{
	const element = document.getElementById('input');
	if (element)
		element.focus();
}


/** @param {MessageEvent} event */
function handleMessageEvent(event)
{
	const message = event.data;
	if (!isAiChatMessage(message))
		return;

	switch (message.method) {
		case 'addMessage': {
			const messagesUi = document.getElementById('messages');
			if (!messagesUi)
				break;
			const messageUi = document.createElement('div');
			messageUi.className = message.user ? 'message user' : 'message assistant';
			drawMarkdown(messageUi, message.text);
			messagesUi.appendChild(messageUi);
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
		case 'clear': {
			let ui = document.getElementById('messages');
			if (ui)
				ui.innerHTML = '';
			ui = document.getElementById('suggestions');
			if (ui)
				ui.innerHTML = '';
			break;
		}
		case 'focus':
			focusOnInput();
			break;
	}
}


/** @type {(obj: any) => obj is AiChatMessage} */
function isAiChatMessage(obj)
{
	return obj !== null && !Array.isArray(obj) && typeof(obj) === 'object'
		&& typeof obj.method === 'string';
}


function main()
{
	window.onfocus = focusOnInput;
	window.onmessage = handleMessageEvent;
}


main();
