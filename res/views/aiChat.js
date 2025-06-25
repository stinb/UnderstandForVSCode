// @ts-check
'use strict';


/**
@typedef {import('../../src/viewProviders/aiChatMessage').AiChatMessage} AiChatMessage
*/


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
