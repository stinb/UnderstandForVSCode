// @ts-check
// Clicks on the graph: selecting, visiting, previewing, renaming in place and toggling node options

import { vscode, info, selected, selectedEdges } from './state.js';
import { focusOnGraph, cssEscape, goToLocUrl, nodeElement } from './util.js';
import { nodeIdOf, labelOwnerOf, applySelection, replaceSelection, toggle, selectNode } from './selection.js';
import { suppressNextClick, consumeDragClick } from './drags.js';
import { peekOn, peekNodeId, showPeek, hidePeek } from './peek.js';


// A click selects and syncs, as Understand's does; it opens nothing. With
// Peek on it also shows the peek, after the double-click interval, so a
// double-click gets its own action -- Understand's node-option preference,
// or a plugin node's visit -- instead of the peek opening under the
// pointer. Alt+click and the double-click are what open the place (Rob,
// 2026-10-22). A test sets the window's undClickDelayMs; 0 acts at once.
const kDoubleClickMs = 400;
let pendingClickAction = 0;

/** @param {() => void} action */
function afterDoubleClickInterval(action)
{
	cancelPendingClickAction();
	const delay = /** @type {any} */ (window).undClickDelayMs ?? kDoubleClickMs;
	if (!delay) {
		action();
		return;
	}
	pendingClickAction = window.setTimeout(() => {
		pendingClickAction = 0;
		action();
	}, delay);
}


function cancelPendingClickAction()
{
	window.clearTimeout(pendingClickAction);
	pendingClickAction = 0;
}


/** @param {PointerEvent | MouseEvent} e */
export function onClickNode(e)
{
	if (!(e.target instanceof Element))
		return;

	// Ctrl (Cmd) adds to the selection, as in the GUI, which syncs and
	// previews only a selection of one
	const id = nodeIdOf(e.target);
	const extend = e.ctrlKey || e.metaKey;
	const again = !!id && selected.size === 1 && selected.has(id) && !selectedEdges.size;
	if (id)
		selectNode(id, extend);
	if (extend)
		return;

	const url = URL.parse(e.target.getAttribute('href') || '');

	// Sync at once, as the selection is: the views to an entity, a syncing
	// graph to an architecture node. A place (a control flow node, a
	// sequence diagram's fragment) only selects: showing its line is a
	// jump, and that is Alt+click's and the double-click's.
	if (url?.protocol === 'entity:') {
		vscode.postMessage({
			method: 'clickedEntity',
			id: parseInt(url.searchParams.get('id') || 'NaN'),
		});
	} else if (url?.protocol === 'arch:') {
		vscode.postMessage({
			method: 'clickedArch',
			fullName: decodeURIComponent(url.pathname),
		});
	}

	// The peek follows a click on one node; a click on the node it shows
	// closes it, as the GUI's does
	if (peekOn && id) {
		const at = { x: e.clientX, y: e.clientY };
		afterDoubleClickInterval(() => {
			if (again && peekNodeId === id && !document.getElementById('peek')?.hidden)
				hidePeek();
			else
				showPeek(id, at);
		});
	}
}


/** A click on the graph's background clears the selection */
/** @param {MouseEvent} e */
export function onClickBackground(e)
{
	if (suppressNextClick || !(e.target instanceof Element))
		return;
	if (e.target.closest('[data-id], [data-edge], #minimap, #menu, #legend, #peek'))
		return;
	if (selected.size || selectedEdges.size)
		replaceSelection([]);
}


/** @param {MouseEvent} e */
export function onMouseEnterNode(e)
{
	const container = document.getElementById('graphContainer');
	if (!container || !(e.target instanceof Element))
		return;

	// The server's tooltip, as the GUI shows it, is the element's <title>
	if (e.target.hasAttribute('data-tip'))
		return;

	const url = URL.parse(e.target.getAttribute('href') || '');
	if (!url)
		return;

	switch (url.protocol) {
		case 'entity:': {
			container.title = 'See entity';
			break;
		}
		case 'loc:': {
			const path = decodeURIComponent(url.pathname);
			const match = /[^/\\]+$/.exec(path);
			if (match) {
				const line = url.searchParams.get('line');
				if (line !== null)
					container.title = `Go to ${match[0]} at line ${line}`;
				else
					container.title = `Go to ${match[0]}`;
			}
			else {
				container.title = 'Go to code';
			}
			break;
		}
		case 'arch:': {
			container.title = `Graph ${decodeURIComponent(url.pathname)}`;
			break;
		}
	}
}


/** @param {MouseEvent} e */
export function onMouseLeaveNode(e)
{
	const container = document.getElementById('graphContainer');
	if (!container)
		return;

	container.title = '';
}


/**
 * An edge selects (Ctrl adds it), and one edge alone syncs its tail, as the
 * GUI's selection does
 * @param {MouseEvent} e
 */
export function onClickEdge(e)
{
	const edge = e.target instanceof Element ? e.target.closest('[data-edge]') : null;
	const index = edge?.getAttribute('data-edge');
	if (!edge || index === null || index === undefined)
		return;
	if (e.ctrlKey || e.metaKey) {
		toggle(selectedEdges, index);
		applySelection();
	}
	else
		replaceSelection([], [index]);
	const tail = edge.getAttribute('data-tail');
	if (tail && selectedEdges.size === 1 && !selected.size)
		vscode.postMessage({ method: 'action', action: 'sync', ids: [tail] });
}


/**
 * The GUI's rename in place of an architecture node, in a graph that takes
 * drops: a click on the label of the architecture node that is selected
 * edits its name. Enter, Escape and leaving the field all end the edit and
 * keep the name, as in the GUI; '/' and '\' are not typed.
 * @param {MouseEvent} e
 * @returns {boolean} the click began a rename
 */
function startRename(e)
{
	if (!info || !info.draggableTags || e.detail > 1 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
		return false;
	if (selected.size !== 1)
		return false;
	const id = Array.from(selected)[0];
	const container = document.getElementById('graphContainer');
	const node = container?.querySelector(`[data-id="${cssEscape(id)}"][href^="arch:"]`);
	const url = URL.parse(node?.getAttribute('href') || '');
	if (!node || !url)
		return false;
	const label = Array.from(container?.querySelectorAll(`text[data-owner="${cssEscape(id)}"]`) || []).find(text => {
		const box = text.getBoundingClientRect();
		return e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
	});
	const main = document.getElementById('main');
	if (!label || !main)
		return false;
	e.stopPropagation();
	e.preventDefault();

	const name = decodeURIComponent(url.pathname).replace(/^.*\//, '');
	const box = label.getBoundingClientRect();
	const area = main.getBoundingClientRect();
	const input = document.createElement('input');
	input.id = 'renameArch';
	input.value = name;
	input.style.left = `${box.left - area.left + main.scrollLeft}px`;
	input.style.top = `${box.top - area.top + main.scrollTop}px`;
	input.style.minWidth = `${Math.max(80, box.width)}px`;
	input.dataset.vscodeContext = '{"preventDefaultContextMenuItems":false}';
	main.appendChild(input);
	input.focus();
	input.select();
	let done = false;
	const finish = () => {
		if (done)
			return;
		done = true;
		const value = input.value.trim();
		input.remove();
		focusOnGraph();
		if (value && value !== name)
			vscode.postMessage({ method: 'action', action: 'renameArch', ids: [id], name: value });
	};
	input.onkeydown = (ev) => {
		ev.stopPropagation();
		if (ev.key === '/' || ev.key === '\\')
			ev.preventDefault();
		else if (ev.key === 'Enter' || ev.key === 'Escape') {
			ev.preventDefault();
			finish();
		}
	};
	input.onblur = finish;
	return true;
}


/**
 * Go to a node's place, as the GUI's visit: a location node's own place,
 * the server's answer for the rest (an entity's definition, a reference's
 * place); an edge visits its tail
 * @param {Element} element
 */
function visitElement(element)
{
	const url = URL.parse(element.getAttribute('href') || '');
	if (url && url.protocol === 'loc:') {
		goToLocUrl(url);
		return;
	}
	const id = element.getAttribute('data-id') || element.getAttribute('data-tail');
	if (id)
		vscode.postMessage({ method: 'action', action: 'visit', ids: [id] });
}


/** @param {MouseEvent} e */
export function onClickCapture(e)
{
	if (consumeDragClick()) {
		e.stopPropagation();
		e.preventDefault();
		return;
	}

	// Alt+click visits, as in the GUI
	if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.target instanceof Element) {
		const element = e.target.closest('[data-id], [data-edge]') || labelNode(e.target);
		if (element) {
			e.stopPropagation();
			e.preventDefault();
			visitElement(element);
			return;
		}
	}

	// Clicking an architecture node's label that is already selected edits
	// its name, as in the GUI's Architecture graph
	if (startRename(e))
		return;

	// An entity a label names (a member in a UML class diagram, say) is
	// selected by a click, as in Understand, instead of its node
	const link = e.target instanceof Element ? e.target.closest('[data-link]') : null;
	if (link) {
		e.stopPropagation();
		e.preventDefault();
		const uniqueName = link.getAttribute('data-link') || '';
		// The GUI first selects the node the link is in, without syncing
		const owner = link.closest('text[data-owner]')?.getAttribute('data-owner');
		if (owner && !e.ctrlKey && !e.metaKey && !e.shiftKey && nodeElement(owner))
			replaceSelection([owner]);
		vscode.postMessage({ method: 'clickedLink', uniqueName });
		// The peek, as a click on a node; Alt+click opens the definition
		if (peekOn) {
			const at = { x: e.clientX, y: e.clientY };
			afterDoubleClickInterval(() => showPeek(undefined, at, uniqueName));
		}
		return;
	}

	// A label's text is part of its node, so a click on it is a click on the node
	const node = labelNode(e.target);
	if (node) {
		e.stopPropagation();
		e.preventDefault();
		onClickNode(/** @type {MouseEvent} */ (/** @type {unknown} */ ({
			target: node, ctrlKey: e.ctrlKey, metaKey: e.metaKey, clientX: e.clientX, clientY: e.clientY,
		})));
		return;
	}

	// An edge indicator toggles the node option it names, as in Understand,
	// instead of selecting or visiting the node
	const indicator = e.target instanceof Element ? e.target.closest('[data-opt][data-node]') : null;
	const id = indicator?.getAttribute('data-node');
	if (!indicator || !id)
		return;
	e.stopPropagation();
	e.preventDefault();
	vscode.postMessage({
		method: 'action',
		action: 'toggleOption',
		ids: [id],
		option: parseInt(indicator.getAttribute('data-opt') || 'NaN'),
	});
}


/**
 * A double-click on a node or cluster does what Understand's "On
 * node/cluster doubleclick" preference says: expand or collapse it, or
 * show its edges in or out
 * @param {MouseEvent} e
 */
export function onDoubleClick(e)
{
	cancelPendingClickAction();
	if (!(e.target instanceof Element) || e.target.closest('[data-opt]'))
		return;
	// A graph without node options visits, as the GUI's plugin graphs do
	if (!info || !info.nodeActions) {
		const element = e.target.closest('[data-id], [href^="loc:"]') || labelNode(e.target);
		if (element) {
			e.preventDefault();
			visitElement(element);
		}
		return;
	}
	// A cluster too: double-clicking an expanded one collapses it
	const id = nodeIdOf(e.target);
	if (!id)
		return;
	e.preventDefault();
	vscode.postMessage({ method: 'action', action: 'doubleClick', ids: [id] });
}


/**
 * The outline of the node or cluster whose label text was clicked
 * @param {EventTarget | null} target
 * @returns {Element | null}
 */
function labelNode(target)
{
	const id = target instanceof Element ? labelOwnerOf(target) : undefined;
	return id ? nodeElement(id) : null;
}


/**
 * @param {string} unparsedUrl
 * @returns {boolean}
 */
export function urlSupported(unparsedUrl)
{
	const url = URL.parse(unparsedUrl);
	if (!url)
		return false;

	switch (url.protocol) {
		case 'entity:':
		case 'loc:':
		case 'arch:':
			return true;
		default:
			return false;
	}
}
