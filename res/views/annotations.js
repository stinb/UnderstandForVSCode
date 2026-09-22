// @ts-check
'use strict';


/**
@typedef {import('../../src/types/annotation').Card} Card
@typedef {import('../../src/types/annotation').AnnotationMessageFromSandbox} AnnotationMessageFromSandbox
@typedef {import('../../src/types/annotation').AnnotationMessageToSandbox} AnnotationMessageToSandbox
@typedef {import('../../src/types/annotation').Section} Section
*/


/** @type {{
	getState: () => any,
	postMessage: (message: AnnotationMessageFromSandbox) => void,
	setState: (newState: any) => void,
}} */
// @ts-ignore
const vscode = acquireVsCodeApi();

// @ts-ignore
/** @type import('@types/markdown-it').default */
// @ts-ignore
const md = markdownit();
// For a check's description: plugin-authored text that mixes HTML into its
// markdown. Shipped with Understand, and still stripped of scripts below.
// @ts-ignore
const mdHtml = markdownit({ html: true });

const domParser = new DOMParser;

// The option rules shared with the quick-pick chain (src/other/templateRules.ts),
// bundled to res/views/templateRules.js and loaded before this script.
/** @type {import('../../src/other/templateRules')} */
// @ts-ignore
const templateRules = window.understandTemplateRules;

let aiText = '';

/**
 * Split reasoning-model output into its <think> reasoning and the answer.
 * Qwen3/Granite wrap chain-of-thought in <think>...</think> ahead of the
 * answer; while streaming the closing tag may not have arrived yet.
 * @param {string} text
 * @returns {{ thinking: string, answer: string, open: boolean }}
 */
function splitThinking(text)
{
	const B = '<think>', E = '</think>';
	let thinking = '', answer = '', open = false, i = 0;
	while (i < text.length) {
		const b = text.indexOf(B, i);
		if (b === -1) { answer += text.slice(i); break; }
		answer += text.slice(i, b);
		const e = text.indexOf(E, b + B.length);
		if (e === -1) { thinking += text.slice(b + B.length); open = true; break; }
		thinking += text.slice(b + B.length, e);
		i = e + E.length;
	}
	return { thinking: thinking.trim(), answer: answer.trim(), open };
}

/**
 * Render markdown into parent, dropping unsafe nodes.
 * @param {HTMLElement} parent
 * @param {string} text
 * @param {boolean} [allowHtml] let the text's own HTML through (a check description)
 */
function appendMarkdown(parent, text, allowHtml)
{
	const body = domParser.parseFromString((allowHtml ? mdHtml : md).render(text), 'text/html').body;
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
 * Render an AI card body: the answer as markdown, with any reasoning tucked
 * into a collapsible "Thinking" section (open while the model is still
 * thinking, collapsed once the answer begins).
 * @param {HTMLElement} parent
 * @param {string} text
 */
function renderAiBody(parent, text)
{
	parent.innerHTML = '';
	const { thinking, answer, open } = splitThinking(text);
	if (thinking) {
		const details = document.createElement('details');
		details.className = 'thinking';
		details.open = open;
		const summary = document.createElement('summary');
		summary.textContent = open ? 'Thinking…' : 'Thinking';
		details.append(summary);
		const inner = document.createElement('div');
		inner.className = 'thinkingBody';
		appendMarkdown(inner, thinking);
		details.append(inner);
		parent.append(details);
	}
	appendMarkdown(parent, answer);
}


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

			/** @type {string[]} */
			const emptyCardIds = [];
			getEmptyCardIds(emptyCardIds, blankHeaderCards);
			getEmptyCardIds(emptyCardIds, section.cards);
			if (emptyCardIds.length > 1) {
				const buttonUi = document.createElement('button');
				buttonUi.className = 'generateMany';
				buttonUi.title = 'Generate AI overviews for everything in this section';
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
			cardUi.dataset.body = card.body;
			cardUi.dataset.name = card.positionTitle;
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

			const chatButton = drawButton(buttonsUi, 'chat', 'codicon-comment-discussion', 'Start an AI chat about this');
			const copyButton = drawButton(buttonsUi, 'copy', 'codicon-copy', 'Copy the AI overview');
			drawButton(buttonsUi, 'regenerate', card.body ? 'codicon-refresh' : 'codicon-sparkle',
				card.body ? 'Regenerate the AI overview' : 'Generate an AI overview');

			if (card.body.length === 0) {
				chatButton.classList.add('notDisplayed');
				copyButton.classList.add('notDisplayed');
			}

			const bodyUi = document.createElement('div');
			bodyUi.className = 'body';
			renderAiBody(bodyUi, card.body);
			cardUi.appendChild(bodyUi);
		}
	}
}


/**
 * @param {HTMLDivElement} buttons
 * @param {string} kind
 * @param {string} icon
 * @param {string} title tooltip explaining what the button does
 * @returns {HTMLButtonElement}
 */
function drawButton(buttons, kind, icon, title)
{
	const button = document.createElement('button');
	button.className = kind;
	button.title = title;
	buttons.appendChild(button);

	const span = document.createElement('span');
	span.className = `codicon ${icon}`;
	button.appendChild(span);

	return button;
}


/**
 * @param {HTMLElement} descendant
 * @returns {HTMLElement | null}
 */
function getAnnotationParent(descendant)
{
	let parent = descendant.parentElement;
	while (parent && !parent.classList.contains('annotation'))
		parent = parent.parentElement;
	if (!parent || !parent.id) {
		vscode.postMessage({method: 'error', 'body': 'Failed to find annotation ID'});
		return null;
	}
	return parent;
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
		const parent = getAnnotationParent(event.target);
		if (!parent)
			return;
		for (const button of parent.querySelectorAll('.chat, .copy'))
			button.classList.add('notDisplayed');
		vscode.postMessage({method: 'regenerate', uniqueName: parent.id});
	}
	// Start chat: begin a chat for an entity
	else if (classes.contains('chat')) {
		const parent = getAnnotationParent(event.target);
		if (!parent)
			return;
		vscode.postMessage({
			method: 'startChat',
			name: parent.dataset.name || parent.id,
			uniqueName: parent.id,
		});
	}
	// Copy: copy the plain text
	else if (classes.contains('copy')) {
		const parent = getAnnotationParent(event.target);
		if (!parent)
			return;
		navigator.clipboard.writeText(parent.dataset.body || 'Failed to copy text');
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
	if (!isAnnotationMessageToSandbox(message))
		return;

	switch (message.method) {
		case 'aiClear': {
			aiText = '';
			setCardBody(message.uniqueName, aiText);
			break;
		}
		case 'aiError': {
			setCardBody(message.uniqueName, message.text);
			// The generation is over (it failed): stop the spinner and offer to
			// generate again — only the success path (aiTextEnd) did this before,
			// so a failed generation spun forever
			const annotation = document.getElementById(message.uniqueName);
			if (annotation) {
				const regenerateIcon = annotation.querySelector('.regenerate span');
				if (regenerateIcon)
					regenerateIcon.className = 'codicon codicon-sparkle';
			}
			break;
		}
		case 'aiText': {
			aiText += message.text;
			setCardBody(message.uniqueName, aiText);
			break;
		}
		case 'aiTextEnd': {
			const annotation = document.getElementById(message.uniqueName);
			if (!annotation)
				break;
			annotation.dataset.body = aiText;
			const buttons = annotation.querySelector('.buttons');
			if (!buttons)
				break;
			for (const button of buttons.querySelectorAll('.chat, .copy'))
				button.classList.remove('notDisplayed');
			const regenerateIcon = annotation.querySelector('.regenerate span');
			if (regenerateIcon)
				regenerateIcon.className = 'codicon codicon-refresh';
			break;
		}
		case 'drawAi':
			drawAi(message.sections);
			break;
		case 'reveal': {
			if (!message.id)
				break;
			const annotation = document.getElementById(message.id);
			if (!annotation)
				break;
			// Centred rather than merely scrolled to the edge: the card is
			// what the reader was sent here to see.
			annotation.scrollIntoView({ block: 'center', behavior: 'smooth' });
			// Focus the card, not its body: focusing the body would start an
			// edit, and this is a request to read.
			annotation.focus();
			annotation.classList.add('revealed');
			setTimeout(() => annotation.classList.remove('revealed'), 1600);
			break;
		}
		case 'form':
			showRecord(message);
			break;
		case 'check':
			renderCheckCard(message);
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
				// A draft card has no id yet: nothing to delete.
				if (event.target.id)
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


/** @type {(obj: any) => obj is AnnotationMessageToSandbox} */
function isAnnotationMessageToSandbox(obj)
{
	return obj !== null && !Array.isArray(obj) && typeof(obj) === 'object'
		&& typeof obj.method === 'string';
}


/**
 * @param {string} uniqueName
 * @param {string} text
 */
function setCardBody(uniqueName, text)
{
	let parent = document.getElementById(uniqueName);
	if (!parent)
		return;
	parent = parent.querySelector('.body');
	if (!parent)
		return;
	renderAiBody(parent, text);
}


// ---------------------------------------------------------------------------
// The field editor's card-style form: every template field at once, the way
// Understand's own annotation card shows them, plus the note. 'new' renders a
// draft card that becomes an annotation on Create; 'edit' puts the form inside
// the annotation's own card when the page has one, or on a standalone card --
// which in the field editor window it always is. Dependent fields re-offer
// their options live as the depends-on field changes (templateRules.js).
// ---------------------------------------------------------------------------

const kRetiredSuffix = ' (no longer an option)';
const kNewValue = '__understand_new_value__';





/**
 * One field's row: label, then the control its type calls for. onChange is
 * told the key so dependents can be re-offered.
 * @param {any} field
 * @param {{[key: string]: string | string[]}} values
 * @param {(key: string) => void} onChange
 * @returns {HTMLDivElement}
 */
function buildField(field, values, onChange)
{
	const row = document.createElement('div');
	row.className = 'formField';
	row.dataset.key = field.key;

	const label = document.createElement('label');
	label.textContent = field.label;
	if (field.required) {
		const star = document.createElement('span');
		star.className = 'required';
		star.textContent = ' *';
		label.append(star);
	}
	row.append(label);

	if (field.type === 'label')
		return row;

	const held = templateRules.heldValues(field, values);

	// Multi-select: one checkbox per option; a held value the template no
	// longer offers stays, marked, so it can be seen and un-ticked.
	if ((field.type === 'droplist' || field.type === 'radio') && field.multiSelect) {
		const box = document.createElement('div');
		box.className = 'options';
		const offered = templateRules.offeredOptions(field, values);
		const all = [...held.filter(v => !offered.includes(v)), ...offered];
		for (const option of all) {
			const item = document.createElement('label');
			const check = document.createElement('input');
			check.type = 'checkbox';
			check.value = option;
			check.checked = held.includes(option);
			check.onchange = () => {
				const picked = Array.from(box.querySelectorAll('input[type=checkbox]'))
					.filter(c => c instanceof HTMLInputElement && c.checked)
					.map(c => /** @type {HTMLInputElement} */ (c).value);
				if (picked.length)
					values[field.key] = picked;
				else
					delete values[field.key];
				onChange(field.key);
			};
			item.append(check, document.createTextNode(
				offered.includes(option) ? option : option + kRetiredSuffix));
			box.append(item);
		}
		if (field.allowAdd)
			box.append(newValueInput(field, values, onChange, row));
		row.append(box);
		return row;
	}

	// Single closed set: a select, with (none) when optional and New value...
	// when the template allows additions.
	if (field.type === 'droplist' || field.type === 'radio') {
		const select = document.createElement('select');
		const offered = templateRules.offeredOptions(field, values);
		const current = held[0] || '';
		if (!field.required)
			select.append(new Option('(none)', ''));
		if (current && !offered.includes(current))
			select.append(new Option(current + kRetiredSuffix, current));
		for (const option of offered)
			select.append(new Option(option, option));
		if (field.allowAdd)
			select.append(new Option('New value…', kNewValue));
		select.value = current;
		select.onchange = () => {
			if (select.value === kNewValue) {
				const input = newValueInput(field, values, onChange, row);
				select.replaceWith(input);
				input.focus();
				return;
			}
			if (select.value)
				values[field.key] = select.value;
			else
				delete values[field.key];
			onChange(field.key);
		};
		row.append(select);
		return row;
	}

	if (field.type === 'checkbox') {
		const item = document.createElement('label');
		item.className = 'check';
		const check = document.createElement('input');
		check.type = 'checkbox';
		check.checked = held[0] === 'true';
		check.onchange = () => {
			if (check.checked)
				values[field.key] = 'true';
			else
				delete values[field.key];
			onChange(field.key);
		};
		item.append(check, document.createTextNode('Yes'));
		row.append(item);
		return row;
	}

	// text, multiline, date, number, url: typed. A $macro default is left to
	// the server, which expands it while stamping.
	const literalDefault =
		field.default && !String(field.default).startsWith('$') ? String(field.default) : '';
	const input = field.type === 'multiline'
		? document.createElement('textarea') : document.createElement('input');
	if (input instanceof HTMLInputElement)
		input.type = field.type === 'number' ? 'number' : 'text';
	input.value = held[0] !== undefined ? String(held[0]) : literalDefault;
	if (field.placeholder)
		input.placeholder = field.placeholder;
	else if (field.type === 'date')
		input.placeholder = 'YYYY-MM-DD';
	if (input.value.length)
		values[field.key] = input.value;
	input.oninput = () => {
		if (input.value.length)
			values[field.key] = input.value;
		else
			delete values[field.key];
	};
	row.append(input);
	return row;
}


/**
 * The box a "New value..." choice opens: Enter or leaving it commits the text
 * as the field's value (and as an offered option, so it reads back), Escape
 * abandons it. Either way the row is rebuilt so the control shows the result.
 * @param {any} field
 * @param {{[key: string]: string | string[]}} values
 * @param {(key: string) => void} onChange
 * @param {HTMLDivElement} row
 * @returns {HTMLInputElement}
 */
function newValueInput(field, values, onChange, row)
{
	const input = document.createElement('input');
	input.type = 'text';
	input.placeholder = 'New value';
	let done = false;
	const commit = () => {
		if (done)
			return;
		done = true;
		const text = input.value.trim();
		if (text) {
			field.options = field.options || [];
			if (!field.options.includes(text))
				field.options.push(text);
			if (field.multiSelect)
				values[field.key] = [...heldValues(field, values).filter(v => v !== text), text];
			else
				values[field.key] = text;
		}
		const fresh = buildField(field, values, onChange);
		row.replaceWith(fresh);
		onChange(field.key);
		// A committed value is a change of the field, for whatever listens to
		// the form's controls.
		fresh.dispatchEvent(new Event('change', { bubbles: true }));
	};
	input.onkeydown = (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			commit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			input.value = '';
			commit();
		}
	};
	input.onblur = commit;
	return input;
}


/**
 * Draw the form described by a 'form' message.
 * @param {any} message
 */
// One form or card at a time.
function clearForms()
{
	for (const old of document.querySelectorAll('.form, .annotation.draft, .annotation.readonly, .checkCard'))
		old.remove();
}


// The required fields with nothing in them.
function requiredGaps(template, values)
{
	return (template ? template.fields : []).filter(field => {
		if (!field.required || field.type === 'label')
			return false;
		const held = templateRules.heldValues(field, values || {});
		return !held.length || (held.length === 1 && !held[0]);
	});
}


/**
 * Which face an existing annotation gets. Read-only only when the record is
 * whole: a required field still empty opens the form, whoever asked and
 * however -- a row click, the lens, a Save that left a gap -- so the gap is
 * in front of the reader to fill, never behind a card (Rob 2026-09-17).
 * @param {any} message
 */
function showRecord(message)
{
	if (message.readOnly && !requiredGaps(message.template, message.values).length)
		renderCard(message);
	else
		renderForm(message);
}


// The first line of an existing annotation's card and form: what the record
// is, by template. A new annotation's title already says what it is making.
/**
 * The line under the template name: where the annotation sits, in italics.
 * The file's name is a link to the place, then the line, then the anchor's
 * own name when it says more than the line does -- an entity, an
 * architecture node. An existing annotation carries its location; a draft
 * has its anchor.
 * @param {any} message
 * @returns {HTMLParagraphElement | null}
 */
function locationLine(message)
{
	const where = message.location || locationOfAnchor(message.anchor);
	if (!where)
		return null;
	/** @type {(string | HTMLElement)[]} */
	const parts = [];
	if (where.uri) {
		const file = document.createElement('a');
		file.href = '#';
		file.textContent = decodeURIComponent(where.uri.split(/[\\/]/).pop() || where.uri);
		file.title = 'Show in the editor';
		file.onclick = (event) => {
			event.preventDefault();
			event.stopPropagation();
			vscode.postMessage({ method: 'open', uri: where.uri, line: where.line || 0, character: where.character || 0 });
		};
		parts.push(file);
		if (typeof where.line === 'number')
			parts.push(`line ${where.line + 1}`);
	}
	if (where.title && !/^Line \d+$/.test(where.title))
		parts.push(where.title);
	if (!parts.length)
		return null;
	const p = document.createElement('p');
	p.className = 'formLocation';
	parts.forEach((part, i) => {
		if (i)
			p.append(' · ');
		p.append(part);
	});
	return p;
}


/** A draft's place, from the anchor its Create will use. */
function locationOfAnchor(anchor)
{
	if (!anchor)
		return null;
	if (anchor.kind === 'architecture')
		return { title: anchor.architecture };
	if (anchor.kind === 'ignore')
		return { uri: anchor.filePath, line: anchor.violationsToIgnore.line };
	if (anchor.textDocument) {
		return { uri: anchor.textDocument.uri,
			line: anchor.kind === 'file' || !anchor.position ? undefined : anchor.position.line };
	}
	return null;
}


/**
 * The template's Metadata, read-only always (Rob 2026-09-21): on a draft
 * what Create will stamp, expanded for the anchor the way Understand's draft
 * card shows it and labelled as the metadata to come; on an existing
 * annotation the stamp its body opens with, above the note, which is what
 * the form edits.
 * @param {any} message
 * @returns {HTMLDivElement | null}
 */
function metadataBlock(message)
{
	if (!message.metadata)
		return null;
	const block = document.createElement('div');
	block.className = 'formMetadata';
	const label = document.createElement('label');
	label.textContent = message.mode === 'new' ? 'Metadata (updated and added on Create)' : 'Metadata';
	const text = document.createElement('p');
	text.textContent = message.metadata;
	block.append(label, text);
	return block;
}


function recordTitle(message)
{
	const template = message.template;
	if (message.mode === 'edit' && template)
		return `Template: ${template.name}`;
	return message.title || (template ? template.name : 'Note');
}


/**
 * The field editor's read-only face: the completed card, the way Understand
 * shows one -- the template name, one label/value row per field that holds a
 * value, then the note. Edit, or a click on a row or the note, opens the form
 * on the same message, with the clicked field focused. A field with nothing
 * in it, required or not, is the form's business and is not shown here
 * (Rob 2026-09-17).
 * @param {any} message
 */
function renderCard(message)
{
	clearForms();

	const template = message.template;
	/** @type {{[key: string]: string | string[]}} */
	const values = message.values || {};
	/** @param {string | undefined} focusKey */
	const edit = (focusKey) =>
		renderForm(Object.assign({}, message, { readOnly: false, focusKey }));

	const card = document.createElement('div');
	card.className = 'annotation readonly';
	card.tabIndex = 0;

	const header = document.createElement('div');
	header.className = 'cardHeader';
	const p = document.createElement('p');
	const b = document.createElement('b');
	b.textContent = recordTitle(message);
	p.append(b);
	header.append(p);
	const where = locationLine(message);
	if (where)
		header.append(where);
	card.append(header);

	if (template) {
		const record = document.createElement('div');
		record.className = 'template';
		for (const field of template.fields) {
			if (field.type === 'label')
				continue;
			const held = templateRules.heldValues(field, values).filter(v => v !== '');
			if (!held.length)
				continue;
			const row = document.createElement('p');
			row.className = 'field';
			row.dataset.key = field.key;
			const label = document.createElement('span');
			label.className = 'fieldLabel';
			label.textContent = field.label;
			// The star says required here as it does on the form.
			if (field.required) {
				const star = document.createElement('span');
				star.className = 'required';
				star.textContent = ' *';
				label.append(star);
			}
			const value = document.createElement('span');
			value.textContent = field.type === 'checkbox' ? 'Yes' : held.join(', ');
			row.append(label, ' ', value);
			row.onclick = () => edit(field.key);
			record.append(row);
		}
		if (record.childElementCount)
			card.append(record);
	}

	const stamp = metadataBlock(message);
	if (stamp)
		card.append(stamp);
	const body = document.createElement('div');
	body.className = 'body';
	if (message.body)
		appendMarkdown(body, message.body);
	body.onclick = () => edit('body');
	card.append(body);

	const buttons = document.createElement('div');
	buttons.className = 'formButtons';
	const editButton = document.createElement('button');
	editButton.className = 'edit';
	editButton.textContent = 'Edit';
	editButton.onclick = (event) => {
		event.preventDefault();
		event.stopPropagation();
		edit(undefined);
	};
	buttons.append(editButton);
	card.append(buttons);

	const list = document.body.querySelector('div');
	(list || document.body).prepend(card);
	editButton.focus();
}


// Severity levels as CodeCheck defines them (codecheck/CheckInfo.h).
/** @param {number} severity */
function severityText(severity)
{
	if (severity >= 100) return 'Urgent';
	if (severity >= 75) return 'High';
	if (severity >= 50) return 'Medium';
	if (severity >= 25) return 'Low';
	if (severity >= 0) return 'Informational';
	return 'No severity';
}


/**
 * A label/value row of a read-only card, with no click behind it.
 * @param {string} label
 * @param {string | Node} value
 */
function cardRow(label, value)
{
	const row = document.createElement('p');
	row.className = 'field';
	const labelUi = document.createElement('span');
	labelUi.className = 'fieldLabel';
	labelUi.textContent = label;
	row.append(labelUi, ' ', value);
	return row;
}


/**
 * One option of a check as a configuration has set it. A choice, radio or
 * checkbox group lists every choice and marks the one(s) in use; any other
 * kind shows its value. A value still at the check's default says so.
 * @param {{label: string, kind: string, value: unknown, default: unknown, choices: string[]}} option
 */
function optionRow(option)
{
	const value = document.createElement('span');
	const inUse = Array.isArray(option.value) ? option.value.map(String) : [String(option.value)];
	if (option.choices && option.choices.length) {
		for (const choice of option.choices) {
			const span = document.createElement('span');
			const used = inUse.includes(choice);
			span.className = used ? 'choice used' : 'choice';
			if (used) {
				const tick = document.createElement('span');
				tick.className = 'codicon codicon-check';
				span.append(tick);
			}
			span.append(choice);
			value.append(span);
		}
	} else if (option.kind === 'checkbox') {
		value.textContent = option.value === true || option.value === 'true' ? 'On' : 'Off';
	} else {
		value.textContent = inUse.join(', ');
	}
	if (JSON.stringify(option.value) === JSON.stringify(option.default)) {
		const tag = document.createElement('span');
		tag.className = 'default';
		tag.textContent = '(default)';
		value.append(tag);
	}
	return cardRow(option.label, value);
}


/**
 * A check's card: the read-only face of a CodeCheck check, in the field
 * editor window (Rob 2026-09-17). The name, then what it is -- id, its place
 * in the plugin tree, default severity -- then one block per configuration
 * that runs it with the severity and every option as that configuration has
 * set it, then the description. Nothing here edits anything: the
 * configuration is Understand's.
 * @param {any} message
 */
function renderCheckCard(message)
{
	clearForms();
	const check = message.check;

	const card = document.createElement('div');
	card.className = 'annotation readonly checkCard';
	card.tabIndex = 0;

	const header = document.createElement('div');
	header.className = 'cardHeader';
	const p = document.createElement('p');
	const b = document.createElement('b');
	b.textContent = check.name;
	p.append(b);
	header.append(p);
	card.append(header);

	const about = document.createElement('div');
	about.className = 'template';
	about.append(cardRow('ID', check.id));
	if (check.hierarchy && check.hierarchy.length > 1)
		about.append(cardRow('Standard', check.hierarchy.slice(0, -1).join(' › ')));
	about.append(cardRow('Default severity', severityText(check.defaultSeverity)));
	card.append(about);

	const configs = check.configs || [];
	for (const config of configs) {
		const section = document.createElement('div');
		section.className = 'template checkConfig';
		const title = document.createElement('p');
		title.className = 'templateName';
		title.textContent = `Runs in ${config.name}${config.automatic ? ' (in the background)' : ''}`;
		section.append(title);
		section.append(cardRow('Severity', severityText(config.severity)));
		for (const option of config.options || [])
			section.append(optionRow(option));
		card.append(section);
	}
	if (!configs.length) {
		const none = document.createElement('p');
		none.className = 'field checkConfig';
		none.textContent = 'Not in any CodeCheck configuration';
		card.append(none);
	}

	const body = document.createElement('div');
	body.className = 'body checkDescription';
	if (check.description)
		appendMarkdown(body, check.description, true);
	card.append(body);

	const list = document.body.querySelector('div');
	(list || document.body).prepend(card);
	card.focus();
}


function renderForm(message)
{
	clearForms();

	// No template is a freeform annotation: the form is its note and nothing
	// else, so the one editor serves both kinds.
	const template = message.template;
	const templateFields = template ? template.fields : [];
	/** @type {{[key: string]: string | string[]}} */
	const values = Object.assign({}, message.values || {});
	/** @type {Map<string, HTMLDivElement>} */
	const rows = new Map();
	/** @type {HTMLTextAreaElement | null} */
	let bodyUi = null;

	const formUi = document.createElement('div');
	formUi.className = 'form';

	const save = document.createElement('button');
	save.className = 'save';
	save.textContent = message.mode === 'new' ? 'Create' : 'Save';

	// Rebuild every field that depends on the changed one, then theirs.
	/** @param {string} key */
	const onChange = (key) => {
		for (const field of templateFields) {
			if (field.parentField !== key)
				continue;
			const fresh = buildField(field, values, onChange);
			const old = rows.get(field.key);
			if (old)
				old.replaceWith(fresh);
			rows.set(field.key, fresh);
			onChange(field.key);
		}
		markGaps();
	};

	// The required fields with nothing in them: the one thing the form will
	// not accept, and what it marks red as it stands -- the star says required,
	// the red label says empty -- re-marked on every change, not only once
	// Create has been refused.
	const gaps = () => requiredGaps(template, values);
	const markGaps = () => {
		const empty = new Set(gaps());
		for (const field of templateFields)
			rows.get(field.key)?.classList.toggle('missing', empty.has(field));
	};

	// What Save sends: the values that hold something. Save is offered only
	// while that, or the note, differs from what the annotation holds -- an
	// unchanged form has nothing to save (Rob 2026-09-21). A draft always has
	// something to create.
	/** @param {{[key: string]: string | string[]}} source */
	const filled = (source) => {
		/** @type {{[key: string]: string | string[]}} */
		const out = {};
		for (const [key, value] of Object.entries(source)) {
			if (Array.isArray(value) ? value.length : (value !== undefined && value !== ''))
				out[key] = value;
		}
		return out;
	};
	/** @param {{[key: string]: string | string[]}} fields @param {string | null} body */
	const canonical = (fields, body) =>
		JSON.stringify([Object.keys(fields).sort().map(key => [key, fields[key]]), body]);
	const held = canonical(filled(message.values || {}), message.body === undefined ? null : message.body);
	const changed = () => message.mode === 'new'
		|| canonical(filled(values), bodyUi ? bodyUi.value : null) !== held;
	const updateSave = () => {
		save.disabled = !changed();
		save.title = save.disabled ? 'Nothing has changed' : '';
	};
	// Every control reports through its own handler first, then here -- the
	// one place that decides whether Save is offered.
	formUi.addEventListener('input', updateSave);
	formUi.addEventListener('change', updateSave);

	const title = document.createElement('p');
	title.className = 'formTitle';
	title.textContent = recordTitle(message);
	formUi.append(title);
	const where = locationLine(message);
	if (where)
		formUi.append(where);

	// A draft picks its template here, on the form, the way Understand's card
	// does: the templates offered for the place, then "Note (no template)".
	// A change re-renders the form on the picked template, carrying the
	// values whose fields it also has and the note as typed; the save names
	// the template, so nothing is told the extension (Rob 2026-09-21).
	if (message.mode === 'new' && message.templates && message.templates.length) {
		const row = document.createElement('div');
		row.className = 'formField formTemplate';
		const label = document.createElement('label');
		label.textContent = 'Template';
		const select = document.createElement('select');
		for (const offered of message.templates) {
			const option = document.createElement('option');
			option.value = offered.id;
			option.textContent = offered.name;
			select.append(option);
		}
		const none = document.createElement('option');
		none.value = '';
		none.textContent = 'Note (no template)';
		select.append(none);
		select.value = template ? template.id : '';
		select.onchange = () => {
			const picked = message.templates.find(offered => offered.id === select.value);
			const keys = new Set((picked ? picked.fields : []).map(field => field.key));
			/** @type {{[key: string]: string | string[]}} */
			const carried = {};
			for (const [key, value] of Object.entries(filled(values))) {
				if (keys.has(key))
					carried[key] = value;
			}
			renderForm(Object.assign({}, message, {
				template: picked,
				values: carried,
				body: bodyUi ? bodyUi.value : message.body,
				metadata: picked ? (message.metadataByTemplate || {})[picked.id] : undefined,
			}));
		};
		row.append(label, select);
		formUi.append(row);
	}

	for (const field of templateFields) {
		const row = buildField(field, values, onChange);
		rows.set(field.key, row);
		formUi.append(row);
	}
	markGaps();

	const stamp = metadataBlock(message);
	if (stamp)
		formUi.append(stamp);

	// The note box: a draft always has one, and an edit has one when the
	// caller hands the text over -- which is how a freeform annotation's text
	// is edited here.
	if (message.mode === 'new' || message.body !== undefined) {
		bodyUi = document.createElement('textarea');
		bodyUi.className = 'formBody';
		bodyUi.placeholder = template ? 'Note (optional)' : 'Note';
		bodyUi.value = message.body || '';
		formUi.append(bodyUi);
	}

	const note = document.createElement('p');
	note.className = 'formNote notDisplayed';
	formUi.append(note);

	const buttons = document.createElement('div');
	buttons.className = 'formButtons';
	const cancel = document.createElement('button');
	cancel.className = 'cancel';
	cancel.textContent = 'Cancel';
	buttons.append(save, cancel);
	formUi.append(buttons);
	updateSave();

	// Where the form goes: inside the annotation's own card when it is in
	// this file's view, otherwise on a card of its own at the top.
	let host = message.mode === 'edit' && message.id
		? document.getElementById(message.id) : null;
	if (host) {
		const header = host.querySelector('.cardHeader');
		if (header)
			header.after(formUi);
		else
			host.prepend(formUi);
	} else {
		host = document.createElement('div');
		host.className = 'annotation draft';
		host.tabIndex = 0;
		const header = document.createElement('div');
		header.className = 'cardHeader';
		const p = document.createElement('p');
		const b = document.createElement('b');
		b.textContent = message.mode === 'new' ? 'New annotation'
			: template ? 'Edit fields' : 'Edit text';
		p.append(b);
		header.append(p);
		host.append(header, formUi);
		const list = document.body.querySelector('div');
		if (list)
			list.prepend(host);
		else
			document.body.prepend(host);
	}

	const finish = () => {
		if (host && host.classList.contains('draft'))
			host.remove();
		else
			formUi.remove();
	};

	save.onclick = (event) => {
		event.preventDefault();
		event.stopPropagation();
		// A required field left empty is marked, and the record goes with the
		// gap the way Understand stores one: the Browser shows it red, and the
		// editor keeps the form up until it is filled (Rob 2026-09-17). An
		// ignore is the exception -- the server refuses a gap there, so the
		// form refuses first, by name, rather than lose the draft to an error.
		const missing = gaps().map(field => field.label);
		markGaps();
		if (missing.length && message.anchor && message.anchor.kind === 'ignore') {
			note.textContent = `Required and still empty: ${missing.join(', ')}.`;
			note.classList.remove('notDisplayed');
			return;
		}
		const fields = filled(values);
		vscode.postMessage({
			method: 'formSave',
			mode: message.mode,
			id: message.id,
			templateId: template ? template.id : undefined,
			fields,
			body: bodyUi ? bodyUi.value : undefined,
			anchor: message.anchor,
		});
		// The form stays, disabled, until the extension answers: the card of
		// the annotation made or saved, or this form again when the server
		// refused.
		save.disabled = true;
		save.textContent = message.mode === 'new' ? 'Creating…' : 'Saving…';
	};

	cancel.onclick = (event) => {
		event.preventDefault();
		event.stopPropagation();
		// An existing annotation goes back to its card, unchanged; there is
		// nothing to tell the extension.
		if (message.mode === 'edit' && message.id) {
			showRecord(Object.assign({}, message, { readOnly: true, focusKey: undefined }));
			return;
		}
		vscode.postMessage({ method: 'formCancel' });
		finish();
	};

	formUi.onkeydown = (event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			cancel.click();
		}
	};

	host.scrollIntoView({ block: 'nearest' });
	// The field the reader clicked on the card, else the first.
	const wanted = message.focusKey === 'body' ? bodyUi
		: message.focusKey ? rows.get(message.focusKey)?.querySelector('select, input, textarea')
		: null;
	const first = wanted || formUi.querySelector('select, input, textarea');
	if (first instanceof HTMLElement)
		first.focus();
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

	// A pop-up form window waits for this before posting its form; the
	// Annotations view has nothing to do with it.
	vscode.postMessage({ method: 'ready' });
}


main();

// Attachment buttons: the media behind a body's markers. The extension has
// the bytes; the sandbox only asks for one to be opened.
document.addEventListener('click', (event) => {
	const button = event.target.closest && event.target.closest('.attachment');
	if (!button)
		return;
	event.preventDefault();
	event.stopPropagation();
	vscode.postMessage({
		method: 'openMedia',
		mediaId: button.dataset.mediaId,
		name: button.dataset.mediaName,
	});
});
