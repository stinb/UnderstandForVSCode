// @ts-check
'use strict';


/**
@typedef {import('../../src/types/graph').GraphMessageToSandbox} Message
*/


const MOVEMENT_PIXELS = 25;

const ZOOM_FACTOR = 0.875; // ~0 fast, ~1 slow
const ZOOM_FACTOR_INVERSE = 1 / ZOOM_FACTOR;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;


let keys = {
	w: false,
	a: false,
	s: false,
	d: false,
	ArrowUp: false,
	ArrowLeft: false,
	ArrowDown: false,
	ArrowRight: false,
};

let zoom = 1;


function focusOnGraph()
{
	const element = document.getElementById('main');
	if (!element)
		return;
	element.focus();
}


/** @param {string} text */
function modifyText(text)
{
	if (text.endsWith(':'))
		return text.slice(0, text.length - 1);
	return text;
}


/** @param {KeyboardEvent} e */
function onKeyDown(e)
{
	switch (e.key) {
		case 'w': case 'a': case 's': case 'd':
		case 'ArrowUp': case 'ArrowLeft': case 'ArrowDown': case 'ArrowRight':
			keys[e.key] = true;
	}
}


/** @param {KeyboardEvent} e */
function onKeyUp(e)
{
	switch (e.key) {
		case 'w': case 'a': case 's': case 'd':
		case 'ArrowUp': case 'ArrowLeft': case 'ArrowDown': case 'ArrowRight':
			keys[e.key] = false;
	}
}


/** @param {WheelEvent} e */
function onWheel(e)
{
	const main = document.getElementById('main');
	const container = document.getElementById('graphContainer');
	if (!main || !container)
		return;

	e.preventDefault();

	const mouseX = e.clientX + main.scrollLeft;
	const mouseY = e.clientY + main.scrollTop;

	const oldZoom = zoom;

	if (e.deltaY > 0)
		zoom *= ZOOM_FACTOR;
	else
		zoom *= ZOOM_FACTOR_INVERSE;

	zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));

	container.style.zoom = zoom.toString();

	const scaleChange = zoom / oldZoom;
	const newScrollX = mouseX * scaleChange - e.clientX;
	const newScrollY = mouseY * scaleChange - e.clientY;

	main.scrollTo(newScrollX, newScrollY);
}


/** @param {MessageEvent} e */
function onMessage(e)
{
	const message = /** @type {Message} */ (e.data);

	const loader = document.getElementById('loader');
	if (loader)
		loader.remove();

	const container = document.getElementById('graphContainer');
	if (!container)
		return;
	container.innerHTML = message.svg;

	const optionsUi = document.getElementById('options');
	if (!optionsUi)
		return;
	optionsUi.innerHTML = '';

	/** @type {HTMLElement} */
	let group = optionsUi;

	// Figure out which option groups to skip because there's only 1 group
	// between the separators
	/** @type {Set<number>} */
	const groupsIndexesToSkip = new Set;
	const groupsIndexes = [];
	for (let i = 0; i < message.options.length; i++) {
		switch (message.options[i].kind) {
			case 'horizontalCheckbox':
			case 'horizontalLayoutBegin':
			case 'verticalCheckbox':
				groupsIndexes.push(i);
				break;
			case 'separator':
				if (groupsIndexes.length === 1)
					for (const groupIndex of groupsIndexes)
						groupsIndexesToSkip.add(groupIndex);
				groupsIndexes.length = 0;
				break;
		}
	}
	if (groupsIndexes.length === 1)
		for (const groupIndex of groupsIndexes)
			groupsIndexesToSkip.add(groupIndex);
	groupsIndexes.length = 0;

	// Draw each option
	for (let i = 0; i < message.options.length; i++) {
		const option = message.options[i];
		switch (option.kind) {
			case 'checkbox': {
				const label = document.createElement('label');
				group.appendChild(label);

				const input = document.createElement('input');
				input.type = 'checkbox';
				input.id = option.id;
				input.checked = option.value;
				label.appendChild(input);

				const labelText = document.createElement('span');
				labelText.innerText = modifyText(option.text);
				label.appendChild(labelText);
				break;
			}

			case 'choice':
			case 'horizontalRadio':
			case 'verticalRadio': {
				const label = document.createElement('label');
				group.appendChild(label);

				const labelText = document.createElement('p');
				labelText.innerText = modifyText(option.text);
				label.appendChild(labelText);

				const select = document.createElement('select');
				select.id = option.id;
				select.value = option.value;
				label.appendChild(select);

				for (const choice of option.choices) {
					const optionUi = document.createElement('option');
					optionUi.innerText = modifyText(choice);
					select.appendChild(optionUi);
				}
				break;
			}

			case 'directoryText':
			case 'fileText':
			case 'text': {
				const label = document.createElement('label');
				group.appendChild(label);

				const labelText = document.createElement('p');
				labelText.innerText = modifyText(option.text);
				label.appendChild(labelText);

				const input = document.createElement('input');
				input.type = 'text';
				input.id = option.id;
				input.value = option.value;
				label.appendChild(input);
				break;
			}

			case 'horizontalCheckbox':
			case 'verticalCheckbox': {
				const innerGroup = document.createElement('div');
				innerGroup.className = 'optionGroup';
				innerGroup.id = option.id;
				group.appendChild(innerGroup);

				const labelText = document.createElement('h3');
				labelText.innerText = modifyText(option.text);
				innerGroup.appendChild(labelText);

				const checked = new Set(option.value);

				for (const choice of option.choices) {
					const label = document.createElement('label');
					innerGroup.appendChild(label);

					const input = document.createElement('input');
					input.type = 'checkbox';
					input.name = choice;
					input.checked = checked.has(choice);
					label.appendChild(input);

					const labelText = document.createElement('span');
					labelText.innerText = modifyText(choice);
					label.appendChild(labelText);
				}
				break;
			}

			case 'horizontalLayoutBegin': {
				if (groupsIndexesToSkip.has(i))
					break;
				group = document.createElement('div');
				group.className = 'optionGroup';
				optionsUi.appendChild(group);
				break;
			}

			case 'horizontalLayoutEnd': {
				group = optionsUi;
				break;
			}

			case 'integer': {
				const range = option.minimum === option.maximum ? `${option.minimum}` : `${option.minimum} ... ${option.maximum}`;

				const label = document.createElement('label');
				label.title = range;
				group.appendChild(label);

				const labelText = document.createElement('p');
				labelText.innerText = modifyText(option.text);
				label.appendChild(labelText);

				const input = document.createElement('input');
				input.type = 'number';
				input.id = option.id;
				input.min = option.minimum.toString();
				input.max = option.maximum.toString();
				input.placeholder = range;
				input.value = option.value.toString();
				label.appendChild(input);
				break;
			}

			case 'label': {
				const labelText = document.createElement('h3');
				labelText.innerText = modifyText(option.text);
				group.appendChild(labelText);
				break;
			}

			case 'separator':
				optionsUi.appendChild(document.createElement('hr'));
				break;
		}
	}
}


function smoothScrollLoop()
{
	const element = document.getElementById('main');
	if (!element)
		return;

	let dx = 0;
	let dy = 0;

	if (keys.w || keys.ArrowUp)
		dy -= MOVEMENT_PIXELS;
	if (keys.a || keys.ArrowLeft)
		dx -= MOVEMENT_PIXELS;
	if (keys.s || keys.ArrowDown)
		dy += MOVEMENT_PIXELS;
	if (keys.d || keys.ArrowRight)
		dx += MOVEMENT_PIXELS;

	if (dx !== 0 || dy !== 0)
		element.scrollBy(dx, dy);

	requestAnimationFrame(smoothScrollLoop);
}


function main()
{
	const element = document.getElementById('main');
	if (!element)
		return;

	element.addEventListener('wheel', onWheel, { passive: false });
	element.onkeydown = onKeyDown;
	element.onkeyup = onKeyUp;

	window.onfocus = focusOnGraph;
	window.onmessage = onMessage;

	focusOnGraph();

	requestAnimationFrame(smoothScrollLoop);
}


main();
