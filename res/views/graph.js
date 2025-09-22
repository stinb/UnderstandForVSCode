// @ts-check
'use strict';


/**
@typedef {import('../../src/types/graph').GraphMessageToSandbox} GraphMessageToSandbox
@typedef {import('../../src/types/graph').GraphMessageFromSandbox} GraphMessageFromSandbox
@typedef {import('../../src/types/option').Option} Option
@typedef {import('../../src/types/option').OptionIntegerRange} OptionIntegerRange
*/


/** @type {{
	getState: () => any,
	postMessage: (message: GraphMessageFromSandbox) => void,
	setState: (newState: any) => void,
}} */
// @ts-ignore
const vscode = acquireVsCodeApi();


const DELAY_MILLISECONDS = 250;

const MOVEMENT_PIXELS = 25;

const ZOOM_FACTOR = 0.875; // ~0 fast, ~1 slow
const ZOOM_FACTOR_INVERSE = 1 / ZOOM_FACTOR;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;


let delayedOptionId = '';
/** @type {boolean | number | string | string[]} */
let delayedOptionValue = false;

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

/** @type {number | undefined} */
let timeout = undefined;

let zoom = 1;


/** @param {Option[]} options */
function drawOptions(options)
{
	const optionsUi = document.getElementById('options');
	if (!optionsUi)
		return;
	optionsUi.innerHTML = '';

	/** @type {HTMLElement} */
	let group = optionsUi;

	// Figure out which option groups to draw without the box
	// because there's only 1 option group between the separators
	/** @type {Set<number>} */
	const groupsIndexesToSkip = new Set;
	const groupsIndexes = [];
	for (let i = 0; i < options.length; i++) {
		switch (options[i].kind) {
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
	for (let i = 0; i < options.length; i++) {
		const option = options[i];
		switch (option.kind) {
			case 'checkbox': {
				const label = document.createElement('label');
				group.appendChild(label);

				const input = document.createElement('input');
				input.type = 'checkbox';
				input.dataset.id = option.id;
				input.checked = option.value;
				input.onchange = onChangeBoolean;
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
				select.dataset.id = option.id;
				select.onchange = onChangeString;
				label.appendChild(select);

				for (const choice of option.choices) {
					const optionUi = document.createElement('option');
					optionUi.innerText = modifyText(choice);
					select.appendChild(optionUi);
				}

				select.value = option.value;
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
				input.dataset.id = option.id;
				input.dataset.vscodeContext = '{"preventDefaultContextMenuItems":false}';
				input.value = option.value;
				input.onchange = onChangeString;
				label.appendChild(input);
				break;
			}

			case 'horizontalCheckbox':
			case 'verticalCheckbox': {
				const innerGroup = document.createElement('div');
				innerGroup.className = 'optionGroup';
				innerGroup.dataset.id = option.id;
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
					input.onchange = onChangeStringList;
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

				const label = document.createElement('label');
				group.appendChild(label);

				const labelText = document.createElement('p');
				labelText.innerText = modifyText(option.text);
				label.appendChild(labelText);

				const input = document.createElement('input');
				input.onchange = onChangeInteger;
				input.type = 'number';
				input.dataset.id = option.id;
				input.dataset.vscodeContext = '{"preventDefaultContextMenuItems":false}';
				input.value = option.value.toString();
				label.appendChild(input);

				updateNumberRange(label, input, option.minimum, option.maximum);
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


/** @param {Event} e */
function onChangeBoolean(e)
{
	if (!e.target || !(e.target instanceof HTMLInputElement))
		return;
	if (!e.target.dataset.id)
		return;
	sendChangeDelayed(e.target.dataset.id, e.target.checked);
}


/** @param {Event} e */
function onChangeString(e)
{
	if (!e.target || !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement))
		return;
	if (!e.target.dataset.id)
		return;
	sendChangeDelayed(e.target.dataset.id, e.target.value);
}


/** @param {Event} e */
function onChangeInteger(e)
{
	if (!e.target || !(e.target instanceof HTMLInputElement))
		return;
	if (!e.target.dataset.id)
		return;
	sendChangeDelayed(e.target.dataset.id, parseInt(e.target.value));
}


/** @param {Event} e */
function onChangeStringList(e)
{
	if (!e.target || !(e.target instanceof HTMLInputElement))
		return;
	if (!e.target.parentElement || !e.target.parentElement.parentElement)
		return;
	const optionGroup = e.target.parentElement.parentElement;
	if (!optionGroup.dataset.id)
		return;
	/** @type {string[]} */
	const choices = [];
	for (const input of optionGroup.getElementsByTagName('input'))
		if (input.checked)
			choices.push(input.name);
	sendChangeDelayed(optionGroup.dataset.id, choices);
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
	const message = /** @type {GraphMessageToSandbox} */ (e.data);

	switch (message.method) {
		case 'convert': {
			// Copy SVG
			const svgs = document.getElementsByTagName('svg');
			if (svgs.length !== 1)
				return;
			/** @ts-ignore @type {SVGSVGElement} */
			const svg = svgs[0].cloneNode(true);

			// Set the text color
			const fill = document.documentElement.style.getPropertyValue('--vscode-foreground');
			for (const text of svg.getElementsByTagName('text'))
				text.setAttribute('fill', fill);

			// Save it
			switch (message.extension) {
				case 'jpg':
					saveRaster(message.path, svg, 'image/jpeg');
					return;
				case 'png':
					saveRaster(message.path, svg, 'image/png');
					return;
				case 'svg': {
					vscode.postMessage({
						method: 'saveString',
						path: message.path,
						content: svg.outerHTML,
					});
					return;
				}
			}
		}
		case 'toggleOptions': {
			const style = document.documentElement.style;
			if (document.documentElement.style.getPropertyValue('--asideWidth') === '0rem')
				style.setProperty('--asideWidth', '20rem');
			else
				style.setProperty('--asideWidth', '0rem');
			return;
		}
		case 'updateGraph': {
			const loader = document.getElementById('loader');
			if (loader)
				loader.remove();

			const container = document.getElementById('graphContainer');
			if (!container)
				return;
			container.innerHTML = message.svg;
			return;
		}
		case 'updateOptionRanges': {
			updateOptionRanges(message.optionRanges);
			return;
		}
		case 'updateOptions': {
			drawOptions(message.options);
			return;
		}
	}
}


/**
 * @param {string} path
 * @param {SVGSVGElement} svg
 * @param {'image/jpeg' | 'image/png'} type
 */
async function saveRaster(path, svg, type)
{
	// Create area to draw pixels of SVG
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx)
		return;
	canvas.width = parseInt(svg.getAttribute('width') || '0');
	canvas.height = parseInt(svg.getAttribute('height') || '0');

	// Background color
	if (type === 'image/jpeg') {
		const background = document.documentElement.style.getPropertyValue('--vscode-editor-background');
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	// Draw the SVG in the canvas
	const xml = new XMLSerializer().serializeToString(svg);
	const svg64 = btoa(xml);
	const img64 = 'data:image/svg+xml;base64,' + svg64;
	const img = new Image();
	img.src = img64;
	await img.decode();
	ctx.drawImage(img, 0, 0);

	// Convert to the image format
	/** @type {Blob | null} */
	const blob = await new Promise(resolve => canvas.toBlob(resolve, type));
	if (!blob)
		return;

	// Convert blob to base 64
	/** @type {string} */
	const content = await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			// @ts-ignore result is a string (https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL)
			resolve(reader.result.split(',')[1]);
		};
		reader.onerror = (error) => reject(error);
		reader.readAsDataURL(blob);
	});

	vscode.postMessage({
		method: 'saveBase64',
		path: path,
		content: content,
	});
}


function sendChange()
{
	vscode.postMessage({
		method: 'changedOption',
		id: delayedOptionId,
		value: delayedOptionValue,
	});
	delayedOptionId = '';
	timeout = undefined;
}


/**
 * @param {string} id
 * @param {boolean | number | string | string[]} value
 */
function sendChangeDelayed(id, value)
{
	if (timeout !== undefined)
		window.clearTimeout(timeout);
	timeout = window.setTimeout(sendChange, DELAY_MILLISECONDS);

	if (delayedOptionId && delayedOptionId !== id)
		sendChange();

	delayedOptionId = id;
	delayedOptionValue = value;
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


/**
 * @param {HTMLLabelElement} label
 * @param {HTMLInputElement} input
 * @param {number} min
 * @param {number} max
 */
function updateNumberRange(label, input, min, max)
{
	const rangeString = (min === max) ? `${min}` : `${min} ... ${max}`;
	label.title = rangeString;
	input.min = min.toString();
	input.max = max.toString();
	input.placeholder = rangeString;
}


/** @param {OptionIntegerRange[]} optionRanges */
function updateOptionRanges(optionRanges)
{
	/** @type {Map<string, OptionIntegerRange>} */
	const ranges = new Map;
	for (const range of optionRanges)
		ranges.set(range.id, range);

	for (const input of document.querySelectorAll('input[type="number"]')) {
		if (!(input instanceof HTMLInputElement) || !input.dataset.id)
			continue;
		const label = input.parentElement;
		if (!(label instanceof HTMLLabelElement))
			continue;
		const range = ranges.get(input.dataset.id);
		if (!range)
			continue;
		updateNumberRange(label, input, range.minimum, range.maximum);
	}
}


function main()
{
	const mainElement = document.getElementById('main');
	if (!mainElement)
		return;

	mainElement.addEventListener('wheel', onWheel, { passive: false });
	mainElement.onkeydown = onKeyDown;
	mainElement.onkeyup = onKeyUp;

	window.onfocus = focusOnGraph;
	window.onmessage = onMessage;

	focusOnGraph();

	requestAnimationFrame(smoothScrollLoop);
}


main();
