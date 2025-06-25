// @ts-check
'use strict';


/**
@typedef {import('../../src/viewProviders/message').Card} Card
@typedef {import('../../src/viewProviders/message').Message} Message
@typedef {import('../../src/viewProviders/message').Section} Section
*/


/** @type {{
	getState: () => any,
	postMessage: (message: Message) => void,
	setState: (newState: any) => void,
}} */
// @ts-ignore
const vscode = acquireVsCodeApi();

// @ts-ignore
/** @type import('@types/markdown-it').default */
// @ts-ignore
const md = markdownit();

const domParser = new DOMParser();


/** @param {Section[] | undefined} sections */
function drawAi(sections)
{
	const sectionsUi = document.getElementById('sections');
	if (!sectionsUi)
		return;
	sectionsUi.innerHTML = '';

	if (!sections || !sections.length)
		return;

	// The cards for the section with the blank header, which always has 1 card when it exists
	const blankHeaderCards = !sections[0].name ? sections[0].cards : [];

	for (const section of sections) {
		// Header
		if (section.name) {
			const sectionHeaderUi = document.createElement('h4');
			sectionHeaderUi.className = 'sectionHeader';
			sectionHeaderUi.innerText = section.name;
			sectionsUi.appendChild(sectionHeaderUi);

			const emptyCardIds = [];
			getEmptyCardIds(emptyCardIds, blankHeaderCards);
			getEmptyCardIds(emptyCardIds, section.cards);
			if (emptyCardIds.length > 1) {
				const buttonUi = document.createElement('button');
				buttonUi.className = 'generateMany';
				buttonUi.dataset.uniqueNames = JSON.stringify(emptyCardIds);
				sectionHeaderUi.appendChild(buttonUi);

				const spanUi = document.createElement('span');
				spanUi.className = 'codicon codicon-sparkle';
				buttonUi.appendChild(spanUi);
			}
		}

		// Cards
		for (const card of section.cards) {
			const cardUi = document.createElement('div');
			cardUi.className = 'ai annotation';
			cardUi.dataset.vscodeContext=`{"webviewSection": "annotation", "id": ${JSON.stringify(card.id)}}`;
			cardUi.id = card.id;
			cardUi.tabIndex = 0;
			sectionsUi.appendChild(cardUi);

			const cardHeaderUi = document.createElement('div');
			cardHeaderUi.className = 'cardHeader';
			cardUi.appendChild(cardHeaderUi);

			const anchorUi = document.createElement('a');
			anchorUi.className = 'position';
			anchorUi.dataset.positionCharacter = card.positionCharacter.toString();
			anchorUi.dataset.positionLine = card.positionLine.toString();
			anchorUi.dataset.positionUri = card.positionUri;
			anchorUi.innerText = card.positionTitle;
			anchorUi.tabIndex = 0;
			cardHeaderUi.appendChild(anchorUi);

			const buttonsUi = document.createElement('div');
			buttonsUi.className = 'buttons';
			cardHeaderUi.appendChild(buttonsUi);

			if (card.body.length) {
				const buttonUi = document.createElement('button');
				buttonUi.className = 'chat';
				buttonsUi.appendChild(buttonUi);

				const spanUi = document.createElement('span');
				spanUi.className = 'codicon codicon-comment-discussion';
				buttonUi.appendChild(spanUi);
			}

			const buttonUi = document.createElement('button');
			buttonUi.className = 'regenerate';
			buttonsUi.appendChild(buttonUi);

			const spanUi = document.createElement('span');
			spanUi.className = `codicon ${card.body ? 'codicon-refresh' : 'codicon-sparkle'}`;
			buttonUi.appendChild(spanUi);

			const bodyUi = document.createElement('div');
			bodyUi.className = 'body';
			const body = domParser.parseFromString(md.render(card.body), 'text/html').body;
			for (const child of body.querySelectorAll('link, script'))
				child.remove();
			for (const element of body.childNodes)
				if (!(element instanceof HTMLLinkElement) && !(element instanceof HTMLScriptElement))
					bodyUi.append(element);
			cardUi.appendChild(bodyUi);
		}
	}
}


/**
 * @param {HTMLElement} descendant
 * @returns {string}
 */
function getAnnotationParentId(descendant)
{
	let parent = descendant.parentElement;
	while (parent && !parent.classList.contains('annotation'))
		parent = parent.parentElement;
	if (!parent || !parent.id) {
		vscode.postMessage({method: 'error', 'body': 'Failed to find annoation ID'});
		return '';
	}
	return parent.id;
}


/**
 * @param {string[]} result
 * @param {Card[]} cards
 */
function getEmptyCardIds(result, cards)
{
	for (const card of cards)
		if (card.body.length === 0)
			result.push(card.id);
}


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
	if (!(event.target instanceof HTMLElement))
		return;

	const classes = event.target.classList;

	// Generate many: generate overviews of several entities
	if (classes.contains('generateMany')) {
		if (!event.target.dataset.uniqueNames)
			return;
		const uniqueNames = JSON.parse(event.target.dataset.uniqueNames);
		vscode.postMessage({method: 'generateMany', uniqueNames: uniqueNames});
	}
	// More: view the right click context menu
	else if (classes.contains('more')) {
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
	// Position: go to a location
	else if (classes.contains('position')) {
		const data = event.target.dataset;
		if (!data.positionCharacter || !data.positionLine || !data.positionUri) {
			vscode.postMessage({
				method: 'error',
				body: 'Failed to find the position of the annotation',
			});
			return;
		}
		const character = parseInt(data.positionCharacter);
		const line = parseInt(data.positionLine);
		vscode.postMessage({method: 'open', character: character, line: line, uri: data.positionUri});
	}
	// Regenerate: send a request
	else if (classes.contains('regenerate')) {
		// Get the child icon and change it
		const span = event.target.children[0];
		if (span)
			span.className = 'codicon codicon-loading codicon-modifier-spin';
		// Get the parent annotation and send its ID
		const id = getAnnotationParentId(event.target);
		if (id)
			vscode.postMessage({method: 'regenerate', uniqueName: id});
	}
	// Start chat: begin a chat for an entity
	else if (classes.contains('chat')) {
		const id = getAnnotationParentId(event.target);
		if (id)
			vscode.postMessage({method: 'startChat', uniqueName: id});
	}
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
	if (!isMessage(message))
		return;

	switch (message.method) {
		case 'drawAi':
			drawAi(message.sections);
			break;
		case 'edit': {
			if (!message.id)
				break;
			const annotation = document.getElementById(message.id);
			if (!annotation) {
				vscode.postMessage({
					method: 'error',
					body: 'The entity is not declared in this file. This UI is not supported yet.',
				});
				break;
			}
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
			case 'ArrowDown': {
				let sibling = event.target.nextElementSibling;
				while (sibling && !sibling.classList.contains('annotation'))
					sibling = sibling.nextElementSibling;
				if (sibling instanceof HTMLElement)
					sibling.focus();
				break;
			}
			case 'ArrowUp': {
				let sibling = event.target.previousElementSibling;
				while (sibling && !sibling.classList.contains('annotation'))
					sibling = sibling.previousElementSibling;
				if (sibling instanceof HTMLElement)
					sibling.focus();
				break;
			}
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
