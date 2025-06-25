// @ts-check
'use strict';


/**
@typedef {import('../../src/viewProviders/message').Message} Message
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
	if (!isMessage(message))
		return;

	switch (message.method) {
		case 'focus':
			focusOnInput();
			break;
	}
}


/** @type {(obj: any) => obj is Message} */
function isMessage(obj)
{
	return obj !== null && !Array.isArray(obj) && typeof(obj) === 'object'
		&& typeof obj.method === 'string';
}


function main()
{
	window.onmessage = handleMessageEvent;
}


main();
