// @ts-check
// The options panel: the graph's options as controls, sent after a pause, as the GUI's customizer

import { vscode } from './state.js';
import { cssEscape } from './util.js';
import { drawNodeActionButtons } from './selection.js';
import { updateToolbar } from './toolbar.js';


/**
@typedef {import('../types/option').Option} Option
@typedef {import('../types/option').OptionIntegerRange} OptionIntegerRange
@typedef {import('./menus.js').MenuItem} MenuItem
*/


const DELAY_MILLISECONDS = 250;

let delayedOptionId = '';

/** @type {boolean | number | string | string[]} */
let delayedOptionValue = false;

/** @type {number | undefined} */
let timeout = undefined;

/** The integer options the GUI's Increase and Decrease Level buttons step */
/** @type {string[]} */
export let levelOptionIds = [];

/** The options the server last sent, for the Graph submenu */
/** @type {Option[]} */
let currentOptions = [];


/** @param {HTMLInputElement} input */
function clamp(input)
{
	const value = parseFloat(input.value);
	const min = parseInt(input.min);
	const max = parseInt(input.max);
	if (value < min)
		input.value = min.toString();
	else if (value > max)
		input.value = max.toString();
	else
		input.value = Math.round(value).toString();
}


function drawLoader()
{
	const optionsUi = document.getElementById('options');
	if (!optionsUi)
		return;

	if (optionsUi.getElementsByClassName('codicon-loading').length)
		return;

	const icon = document.createElement('span');
	icon.className = 'codicon codicon-loading codicon-modifier-spin';
	optionsUi.appendChild(icon);
}


/** @param {Option[]} options */
export function drawOptions(options)
{
	const panel = document.getElementById('options');
	if (!panel)
		return;
	panel.innerHTML = '';
	currentOptions = options;
	const isQuick = (/** @type {Option} */ o) => !!(/** @type {{quick?: boolean}} */ (o).quick);
	levelOptionIds = options
		.filter(o => o.kind === 'integer' && isQuick(o))
		.map(o => /** @type {{id: string}} */ (o).id);

	// As the GUI's customizer: copies of the quick options on top, then the
	// node actions and every option under Advanced, which starts open
	const quick = document.createElement('div');
	quick.id = 'quickOptions';
	panel.appendChild(quick);
	// The level itself on top, to read and to type, above the GUI's Increase
	// Level and Decrease Level, which step it
	const levels = document.createElement('div');
	levels.id = 'quickLevels';
	quick.appendChild(levels);
	if (levelOptionIds.length)
		for (const [step, icon, text] of /** @type {const} */ ([[1, 'chevron-up', 'Increase Level'], [-1, 'chevron-down', 'Decrease Level']])) {
			const button = document.createElement('button');
			button.className = 'tool quickLevel';
			button.id = step > 0 ? 'quickIncreaseLevel' : 'quickDecreaseLevel';
			button.innerHTML = `<span class='codicon codicon-${icon}'></span><span>${text}</span>`;
			button.onclick = () => stepLevel(step);
			quick.appendChild(button);
		}
	const advancedToggle = document.createElement('button');
	advancedToggle.id = 'advancedToggle';
	advancedToggle.className = 'tool on';
	advancedToggle.innerHTML = "<span class='codicon codicon-settings'></span><span>Advanced</span>";
	panel.appendChild(advancedToggle);
	const optionsUi = document.createElement('div');
	optionsUi.id = 'advancedOptions';
	panel.appendChild(optionsUi);
	advancedToggle.onclick = () => {
		optionsUi.hidden = !optionsUi.hidden;
		advancedToggle.classList.toggle('on', !optionsUi.hidden);
	};
	const actions = document.createElement('div');
	actions.id = 'nodeActionButtons';
	optionsUi.appendChild(actions);
	drawNodeActionButtons();

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

	// Draw each option, under its heading; a quick one is copied on top too,
	// apart from a level, which the toolbar's Increase Level and Decrease
	// Level step, as the GUI's customizer's buttons do
	for (let i = 0; i < options.length; i++) {
		const option = options[i];
		switch (option.kind) {
			case 'horizontalLayoutBegin':
				if (groupsIndexesToSkip.has(i))
					break;
				group = document.createElement('div');
				group.className = 'optionGroup';
				optionsUi.appendChild(group);
				break;
			case 'horizontalLayoutEnd':
				group = optionsUi;
				break;
			case 'separator':
				optionsUi.appendChild(document.createElement('hr'));
				break;
			default:
				drawOption(option, group);
				if (isQuick(option))
					drawOption(option, option.kind === 'integer' ? levels : quick);
		}
	}
	updateToolbar();
}


/**
 * An option's control, in a group of the panel; a change shows in the
 * option's other control and goes to the server
 * @param {Option} option
 * @param {HTMLElement} group
 */
function drawOption(option, group)
{
	switch (option.kind) {
		case 'checkbox': {
			const label = document.createElement('label');
			group.appendChild(label);

			const input = document.createElement('input');
			input.type = 'checkbox';
			input.dataset.id = option.id;
			input.checked = option.value;
			input.onchange = () => changed(option.id, input.checked);
			label.appendChild(input);

			const labelText = document.createElement('span');
			labelText.textContent = modifyText(option.text);
			label.appendChild(labelText);
			break;
		}

		case 'choice':
		case 'horizontalRadio':
		case 'verticalRadio': {
			const select = document.createElement('select');
			select.dataset.id = option.id;
			select.onchange = () => changed(option.id, select.value);
			for (const choice of option.choices) {
				const optionUi = document.createElement('option');
				optionUi.textContent = modifyText(choice);
				select.appendChild(optionUi);
			}
			select.value = option.value;
			group.appendChild(labeledControl(option.text, select));
			break;
		}

		case 'directoryText':
		case 'fileText':
		case 'text': {
			const input = document.createElement('input');
			input.type = 'text';
			input.dataset.id = option.id;
			input.dataset.vscodeContext = '{"preventDefaultContextMenuItems":false}';
			input.value = option.value;
			input.onchange = () => changed(option.id, input.value);
			group.appendChild(labeledControl(option.text, input));
			break;
		}

		case 'horizontalCheckbox':
		case 'verticalCheckbox': {
			const innerGroup = document.createElement('div');
			innerGroup.className = 'optionGroup';
			innerGroup.dataset.id = option.id;
			group.appendChild(innerGroup);

			const labelText = document.createElement('h3');
			labelText.textContent = modifyText(option.text);
			innerGroup.appendChild(labelText);

			const checked = new Set(option.value);
			const choices = () => Array.from(innerGroup.getElementsByTagName('input')).filter(i => i.checked).map(i => i.name);

			for (const choice of option.choices) {
				const label = document.createElement('label');
				innerGroup.appendChild(label);

				const input = document.createElement('input');
				input.type = 'checkbox';
				input.name = choice;
				input.checked = checked.has(choice);
				input.onchange = () => changed(option.id, choices());
				label.appendChild(input);

				const labelText = document.createElement('span');
				labelText.textContent = modifyText(choice);
				label.appendChild(labelText);
			}
			break;
		}

		case 'integer': {
			const input = document.createElement('input');
			input.type = 'number';
			input.dataset.id = option.id;
			input.dataset.vscodeContext = '{"preventDefaultContextMenuItems":false}';
			input.value = option.value.toString();
			input.onchange = () => {
				if (input.value === '')
					return;
				clamp(input);
				changed(option.id, parseInt(input.value));
			};
			const label = labeledControl(option.text, input);
			group.appendChild(label);
			updateNumberRange(label, input, option.minimum, option.maximum);
			break;
		}

		case 'label': {
			const labelText = document.createElement('h3');
			labelText.textContent = option.text;
			group.appendChild(labelText);
			break;
		}
	}
}


/**
 * A control under the option's text, as the panel lays out a choice, a
 * text and a number
 * @param {string} text
 * @param {HTMLElement} control
 */
function labeledControl(text, control)
{
	const label = document.createElement('label');
	const labelText = document.createElement('p');
	labelText.textContent = modifyText(text);
	label.appendChild(labelText);
	label.appendChild(control);
	return label;
}


/**
 * Increase or Decrease Level: step the level options, as the GUI's buttons
 * step their spin boxes
 * @param {number} step
 */
export function stepLevel(step)
{
	for (const id of levelOptionIds) {
		const input = document.querySelector(`#options input[data-id="${cssEscape(id)}"]`);
		if (!(input instanceof HTMLInputElement))
			continue;
		const value = parseInt(input.value) + step;
		const min = input.min === '' ? -Infinity : parseInt(input.min);
		const max = input.max === '' ? Infinity : parseInt(input.max);
		if (value < min || value > max)
			continue;
		input.value = String(value);
		input.dispatchEvent(new Event('change'));
	}
}


/** @param {number} step */
export function canStepLevel(step)
{
	return levelOptionIds.some(id => {
		const input = document.querySelector(`#options input[data-id="${cssEscape(id)}"]`);
		if (!(input instanceof HTMLInputElement))
			return false;
		const value = parseInt(input.value) + step;
		return !(input.min !== '' && value < parseInt(input.min)) && !(input.max !== '' && value > parseInt(input.max));
	});
}


/** @param {string} text */
function modifyText(text)
{
	if (text.endsWith(':'))
		return text.slice(0, text.length - 1);
	return text;
}


/**
 * An option was set in one of its controls, or in the menu
 * @param {string} id
 * @param {boolean | number | string | string[]} value
 */
function changed(id, value)
{
	showValue(id, value);
	sendChangeDelayed(id, value);
}


/**
 * The graph's options as a menu, as the GUI's OptionsMenu: the node menu's
 * Graph submenu and the background's menu. A change goes through the
 * options panel, which redraws.
 * @returns {MenuItem[]}
 */
export function optionsMenuItems()
{
	/** @type {MenuItem[]} */
	const items = [];
	/** Set an option as its control in the panel would */
	const set = (/** @type {string} */ id, /** @type {boolean | number | string | string[]} */ value) => {
		const option = currentOptions.find(o => /** @type {{id?: string}} */ (o).id === id);
		if (option)
			/** @type {{value: unknown}} */ (option).value = value;
		changed(id, value);
	};
	for (const option of currentOptions) {
		switch (option.kind) {
			case 'checkbox':
				items.push({ label: modifyText(option.text), checked: option.value, onClick: () => set(option.id, !option.value) });
				break;
			case 'choice':
			case 'horizontalRadio':
			case 'verticalRadio':
				items.push({
					label: modifyText(option.text),
					children: option.choices.map(choice => ({
						label: modifyText(choice), checked: option.value === choice, onClick: () => set(option.id, choice),
					})),
				});
				break;
			case 'horizontalCheckbox':
			case 'verticalCheckbox':
				items.push({
					label: modifyText(option.text),
					children: option.choices.map(choice => ({
						label: modifyText(choice),
						checked: option.value.includes(choice),
						onClick: () => set(option.id, option.value.includes(choice)
							? option.value.filter(c => c !== choice) : [...option.value, choice]),
					})),
				});
				break;
			case 'integer': {
				if (option.maximum - option.minimum > 30)
					break;
				/** @type {MenuItem[]} */
				const values = [];
				for (let value = option.minimum; value <= option.maximum; value++)
					values.push({ label: String(value), checked: option.value === value, onClick: () => set(option.id, value) });
				if (values.length)
					items.push({ label: modifyText(option.text), children: values });
				break;
			}
			case 'separator':
				if (items.length && !items[items.length - 1].separator)
					items.push({ separator: true });
				break;
		}
	}
	while (items.length && items[items.length - 1].separator)
		items.pop();
	return items;
}


/**
 * Show an option's value in each of its controls: a quick option has one on
 * top and one under Advanced
 * @param {string} id
 * @param {boolean | number | string | string[]} value
 */
function showValue(id, value)
{
	for (const control of document.querySelectorAll(`#options [data-id="${cssEscape(id)}"]`)) {
		if (control instanceof HTMLInputElement && control.type === 'checkbox')
			control.checked = !!value;
		else if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement)
			control.value = String(value);
		else if (Array.isArray(value))
			for (const input of control.querySelectorAll('input'))
				input.checked = value.includes(input.name);
	}
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
	drawLoader();

	if (timeout !== undefined)
		window.clearTimeout(timeout);
	timeout = window.setTimeout(sendChange, DELAY_MILLISECONDS);

	if (delayedOptionId && delayedOptionId !== id)
		sendChange();

	delayedOptionId = id;
	delayedOptionValue = value;
}


/**
 * @param {HTMLLabelElement} label
 * @param {HTMLInputElement} input
 * @param {number} min
 * @param {number} max
 */
function updateNumberRange(label, input, min, max)
{
	if (min > max) {
		const placeholder = 'Disabled';
		label.title = placeholder;
		input.disabled = true;
		input.min = '0';
		input.max = '0';
		input.placeholder = placeholder;
		input.value = '';
		return;
	}

	const placeholder = (min === max) ? `${min}` : `${min} ... ${max}`;
	label.title = placeholder;
	input.min = min.toString();
	input.max = max.toString();
	input.placeholder = placeholder;
	clamp(input);
}


/** @param {OptionIntegerRange[]} optionRanges */
export function updateOptionRanges(optionRanges)
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
