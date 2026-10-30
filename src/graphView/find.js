// @ts-check
// Find, as the GUI's: a regular expression over the labels, with case and whole words

import { focusOnGraph, toolButton } from './util.js';
import { replaceSelection } from './selection.js';
import { graphCenterOf, nodeSelector, focusNode } from './view.js';


/** @type {Element[]} */
export let findMatches = [];

let findIndex = -1;

/** The GUI's find options: Case Sensitive and Whole Words */
let findCase = false;

let findWords = false;

/** The boxes behind the matched characters, by the label they mark
 * @type {Map<Element, SVGRectElement[]>} */
const findMarks = new Map();

/** Find waits for the typing to pause */
const FIND_DELAY_MS = 200;

let findTimer = 0;


/**
 * The text a label shows: its tooltips (<title>) are not
 * @param {Node} node
 * @returns {string}
 */
function shownText(node)
{
	if (node.nodeType === Node.TEXT_NODE)
		return node.nodeValue || '';
	if (node instanceof Element && node.localName === 'title')
		return '';
	let text = '';
	for (const child of node.childNodes)
		text += shownText(child);
	return text;
}


/**
 * A box behind each match in a label, as an editor marks a find match,
 * rather than the whole label: the boxes, which the caller puts in once every
 * label is measured, as each box put in would make the next measure lay the
 * drawing out again. Where its characters cannot be measured, there are none,
 * and the whole label is marked as before.
 * @param {Element} label
 * @param {RegExp} pattern
 * @returns {SVGRectElement[]}
 */
function matchBoxes(label, pattern)
{
	const text = /** @type {SVGTextContentElement} */ (label);
	if (typeof text.getExtentOfChar !== 'function')
		return [];
	const content = shownText(label).replace(/ /g, ' ');
	const every = new RegExp(pattern.source, pattern.flags + 'g');
	/** @type {SVGRectElement[]} */
	const rects = [];
	try {
		for (const match of content.matchAll(every)) {
			let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
			const start = match.index ?? 0;
			for (let i = start; i < start + match[0].length; ++i) {
				const box = text.getExtentOfChar(i);
				left = Math.min(left, box.x);
				top = Math.min(top, box.y);
				right = Math.max(right, box.x + box.width);
				bottom = Math.max(bottom, box.y + box.height);
			}
			if (!(right > left))
				continue;
			const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			rect.setAttribute('class', 'findMark');
			rect.setAttribute('x', String(left));
			rect.setAttribute('y', String(top));
			rect.setAttribute('width', String(right - left));
			rect.setAttribute('height', String(bottom - top));
			const transform = label.getAttribute('transform');
			if (transform)
				rect.setAttribute('transform', transform);
			rects.push(rect);
		}
	} catch {
		return [];
	}
	return rects;
}


/**
 * Find, as the GUI's: the text is a regular expression (Whole Words wraps it
 * in \b), and each label's text is searched with its lines joined, nodes
 * and clusters before edges. A pattern that matches nothing, or is not a
 * pattern, turns the field red. Typing goes to the first match; a redraw
 * only marks the matches again.
 * @param {string} query
 * @param {boolean} [step] go to the first match
 */
export function runFind(query, step = true)
{
	// What was typed still goes to the first match
	if (findTimer) {
		clearTimeout(findTimer);
		findTimer = 0;
		step = true;
	}
	const container = document.getElementById('graphContainer');
	for (const element of findMatches)
		element.classList.remove('found', 'foundCurrent', 'marked');
	for (const rects of findMarks.values())
		for (const rect of rects)
			rect.remove();
	findMarks.clear();
	findMatches = [];
	findIndex = -1;
	const field = document.getElementById('find');
	field?.classList.remove('failed');
	const text = query.trim();
	if (container && text) {
		/** @type {RegExp | undefined} */
		let pattern;
		try {
			pattern = new RegExp(findWords ? `\\b${text}\\b` : text, findCase ? 'u' : 'iu');
		} catch {
			pattern = undefined;
		}
		const texts = Array.from(container.querySelectorAll('text'));
		const order = (/** @type {Element} */ t) => t.hasAttribute('data-owner') ? 0 : 1;
		texts.sort((a, b) => order(a) - order(b));
		// Code in a label keeps its spaces as no-break ones
		for (const label of texts)
			if (pattern && pattern.test(shownText(label).replace(/\u00a0/g, ' ')))
				findMatches.push(label);
		for (const element of findMatches)
			element.classList.add('found');
		const boxes = findMatches.map(label => pattern ? matchBoxes(label, pattern) : []);
		findMatches.forEach((label, i) => {
			if (!boxes[i].length)
				return;
			for (const rect of boxes[i])
				label.before(rect);
			label.classList.add('marked');
			findMarks.set(label, boxes[i]);
		});
		if (!findMatches.length)
			field?.classList.add('failed');
		else if (step)
			stepFind(1);
	}
	updateFindCount();
}


/**
 * The next or previous match, which is selected (and syncs) and centered,
 * as the GUI applies a match
 * @param {number} direction
 */
export function stepFind(direction)
{
	const field = document.getElementById('find');
	if (findTimer && field instanceof HTMLInputElement)
		runFind(field.value);
	if (!findMatches.length) {
		updateFindCount();
		return;
	}
	if (findIndex >= 0) {
		findMatches[findIndex].classList.remove('foundCurrent');
		for (const rect of findMarks.get(findMatches[findIndex]) ?? [])
			rect.classList.remove('current');
	}
	findIndex = (findIndex + direction + findMatches.length) % findMatches.length;
	const current = findMatches[findIndex];
	current.classList.add('foundCurrent');
	for (const rect of findMarks.get(current) ?? [])
		rect.classList.add('current');
	const owner = current.getAttribute('data-owner');
	if (owner && graphCenterOf(nodeSelector(owner)))
		focusNode(owner);
	else if (typeof current.scrollIntoView === 'function')
		current.scrollIntoView({ block: 'center', inline: 'center' });
	updateFindCount();
}


/**
 * The toolbar's find box, its options and its buttons
 * @param {HTMLElement} toolbar
 */
export function appendFindTools(toolbar)
{
	const find = document.createElement('input');
	find.id = 'find';
	find.type = 'search';
	find.placeholder = 'Find';
	find.title = 'Find text in the graph (Enter: next, Shift+Enter: previous)';
	// The page turns VS Code's Cut/Copy/Paste menu off; a text box has it
	find.dataset.vscodeContext = '{"preventDefaultContextMenuItems":false}';
	find.oninput = () => {
		clearTimeout(findTimer);
		findTimer = window.setTimeout(() => runFind(find.value), FIND_DELAY_MS);
	};
	find.onkeydown = (e) => {
		// The GUI's Find Next (Ctrl+F) works in the box too
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
			e.preventDefault();
			if (!e.shiftKey)
				stepFind(1);
		}
		else if (e.key === 'Enter') {
			e.preventDefault();
			stepFind(e.shiftKey ? -1 : 1);
		}
		else if (e.key === 'Escape') {
			find.value = '';
			runFind('');
			focusOnGraph();
		}
	};
	toolbar.appendChild(find);
	for (const [icon, title, id] of [['case-sensitive', 'Case Sensitive', 'findCase'], ['whole-word', 'Whole Words', 'findWords']]) {
		const button = toolButton(icon, title, () => {
			if (id === 'findCase')
				findCase = !findCase;
			else
				findWords = !findWords;
			button.classList.toggle('on', id === 'findCase' ? findCase : findWords);
			runFind(find.value);
		}, id);
		toolbar.appendChild(button);
	}
	const findCount = document.createElement('span');
	findCount.id = 'findCount';
	toolbar.appendChild(findCount);
	toolbar.appendChild(toolButton('arrow-up', 'Find Previous', () => stepFind(-1), 'findPrev'));
	toolbar.appendChild(toolButton('arrow-down', 'Find Next', () => stepFind(1), 'findNext'));
	toolbar.appendChild(toolButton('list-selection', 'Select All Results', selectFindResults, 'findSelectAll'));
}


/** Select the nodes whose text matched, as the GUI's Select All Results */
function selectFindResults()
{
	replaceSelection(findMatches.flatMap(element => element.getAttribute('data-owner') ?? []));
	focusOnGraph();
}


function updateFindCount()
{
	const selectAll = document.getElementById('findSelectAll');
	if (selectAll instanceof HTMLButtonElement)
		selectAll.disabled = !findMatches.some(m => m.hasAttribute('data-owner'));
	const count = document.getElementById('findCount');
	if (!count)
		return;
	const find = document.getElementById('find');
	const query = find instanceof HTMLInputElement ? find.value.trim() : '';
	if (!query)
		count.textContent = '';
	else if (!findMatches.length)
		count.textContent = 'No results';
	else
		count.textContent = `${findIndex + 1} of ${findMatches.length}`;
}
