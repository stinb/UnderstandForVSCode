// @ts-check
'use strict';


/** @typedef {{
	method: string,
	id?: string,
	body?: string,
}} Message */


/** @type {{
	getState: () => any,
	postMessage: (message: Message) => void,
	setState: (newState: any) => void,
}} */
// @ts-ignore
const vscode = acquireVsCodeApi();


/** @param {FocusEvent} event */
function handleBlur(event)
{
	if (!(event.target instanceof HTMLElement) || !(event.target.parentElement))
		return;

	vscode.postMessage({
		method: 'finishedEditing',
		id: event.target.parentElement.id,
		body: event.target.innerText,
	});
}


/** @param {MouseEvent} event */
function handleClick(event)
{
	if (!(event.target instanceof HTMLButtonElement))
		return;

	event.preventDefault();
	const rect = event.target.getBoundingClientRect();
	const mouseEventInit = {
		bubbles: true,
		clientX: rect.x,
		clientY: rect.y + rect.height,
	};
	event.target.dispatchEvent(new MouseEvent('contextmenu', mouseEventInit));
	event.stopPropagation();
}


/** @param {FocusEvent} event */
function handleFocus(event)
{
	vscode.postMessage({method: 'startedEditing'});

	// Move the selection to the end to match input and textarea
	const selection = window.getSelection();
	if (!(event.target instanceof HTMLElement) || !selection)
		return;
	const range = document.createRange();
	range.selectNodeContents(event.target);
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
}


/** @param {MessageEvent} event */
function handleMessageEvent(event)
{
	const message = event.data;
	if (!isMessage(event.data))
		return;

	switch (message.method) {
		case 'edit': {
			if (!message.id)
				break;
			const annotation = document.getElementById(message.id);
			if (!annotation)
				break;
			const annotationBody = annotation.querySelector('code');
			if (!annotationBody)
				break;
			annotationBody.focus();
			break;
		}
	}
}


/** @param {KeyboardEvent} event */
function handleKeyDown(event)
{
	if (event.target instanceof HTMLBodyElement) {
		switch (event.code) {
			case 'ArrowDown': {
				const annotation = document.querySelector('.annotation');
				if (annotation instanceof HTMLElement)
					annotation.focus();
				break;
			}
			case 'ArrowUp': {
				const annotation = document.querySelector('.annotation:last-child');
				if (annotation instanceof HTMLElement)
					annotation.focus();
				break;
			}
		}
	}
	else if ((event.target instanceof HTMLDivElement) && event.target.classList.contains('annotation')) {
		switch (event.code) {
			case 'ArrowDown':
				if (event.target.nextElementSibling instanceof HTMLElement)
					event.target.nextElementSibling.focus();
				break;
			case 'ArrowUp':
				if (event.target.previousElementSibling instanceof HTMLElement)
					event.target.previousElementSibling.focus();
				break;
			case 'Delete':
				vscode.postMessage({method: 'delete', id: event.target.id});
				break;
			case 'Enter': {
				event.preventDefault();
				const annotationBody = event.target.querySelector('code');
				if (annotationBody)
					annotationBody.focus();
				break;
			}
		}
	}
	else if ((event.target instanceof HTMLElement) && event.target.tagName === 'CODE') {
		switch (event.code) {
			case 'Escape': {
				event.preventDefault();
				const annotation = event.target.parentElement;
				if (annotation)
					annotation.focus();
				break;
			}
		}
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
	document.body.onclick = handleClick;
	document.body.onkeydown = handleKeyDown;

	window.addEventListener('message', handleMessageEvent);

	for (const code of document.getElementsByTagName('code')) {
		code.onblur = handleBlur;
		code.onfocus = handleFocus;
	}
}


main();
