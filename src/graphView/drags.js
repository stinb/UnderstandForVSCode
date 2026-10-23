// @ts-check
// Presses that drag: panning, the rubber band, moving nodes, dragging onto architectures and out of the graph, and auto-scroll

import { vscode, info, selected, selectedEdges } from './state.js';
import { cssEscape, NODE_KINDS } from './util.js';
import { applySelection, replaceSelection, labelOwnerOf } from './selection.js';
import { startPanelMove, startPanelResize, panelEdge } from './panels.js';
import { zoom } from './view.js';


// A press that moves less than this is a click on a node, not a drag
const DRAG_THRESHOLD_PIXELS = 3;

/** Stops the pan a press began, when the node pressed is dragged out instead */
/** @type {(() => void) | undefined} */
let stopPan = undefined;

export let suppressNextClick = false;


/** @param {PointerEvent} e */
export function onPointerDown(e)
{
	const main = document.getElementById('main');
	if (!main || e.button !== 0)
		return;
	if (e.target instanceof Element && !e.target.closest('button, select')) {
		// The legend moves by any part of it and resizes by its border, as
		// the GUI's frame does; the peek moves by its header
		const legend = /** @type {HTMLElement | null} */ (e.target.closest('#legend'));
		if (legend) {
			const edge = panelEdge(legend, e.clientX, e.clientY);
			if (edge)
				startPanelResize('legend', e, edge);
			else
				startPanelMove('legend', e);
			return;
		}
		if (e.target.closest('.peekHeader')) {
			startPanelMove('peek', e);
			return;
		}
	}
	if (e.target instanceof Element && e.target.closest('#minimap, #menu, #legend, #peek'))
		return;

	// Ctrl+drag on the background or in a cluster selects what a band
	// covers, as in the GUI; a press inside a cluster otherwise pans
	if ((e.ctrlKey || e.metaKey) && e.target instanceof Element && !e.target.closest('[data-kind="node"], [data-edge]')
		&& !labelOwnerOf(e.target, '[data-kind="node"]')) {
		startBand(e);
		return;
	}
	// A node's label text moves it too
	const nodeId = e.target instanceof Element
		? e.target.closest('[data-id][data-kind="node"]')?.getAttribute('data-id') || labelOwnerOf(e.target, '[data-kind="node"]')
		: null;

	// In a graph that lets them be (Control Flow, a plugin graph's Basic
	// variant), nodes move by hand, as in the GUI
	if (info && info.moveableNodes && nodeId) {
		startNodeMove(nodeId, e);
		return;
	}

	// In a graph that lets them be, entities and architectures are dragged
	// onto an architecture, as in the GUI's Architecture graph
	if (info && info.draggableTags && nodeId) {
		startNodeDrag(nodeId, e);
		return;
	}

	// Anywhere else a node drags out of the graph, as its name and, for a
	// file, the file, as the GUI's nodes do
	const container = document.getElementById('graphContainer');
	if (container) {
		container.draggable = !!nodeId;
		pressedNode = nodeId || undefined;
	}

	suppressNextClick = false;
	const scrollX = main.scrollLeft, scrollY = main.scrollTop;
	stopPan = trackDrag(e, {
		onStart: () => main.classList.add('grabbing'),
		onMove: (ev, dx, dy) => {
			main.scrollTo(scrollX - dx, scrollY - dy);
			ev.preventDefault();
		},
		onEnd: (ev, moved) => {
			stopPan = undefined;
			main.classList.remove('grabbing');
			// The click that follows a drag would sync to whatever node the
			// pointer was released on
			suppressNextClick = moved;
		},
	});
}


/**
 * Follow a press until it is released or cancelled. The window listens, so
 * a drag that leaves the view still ends. Pointer capture would do the same,
 * but it also redirects the click to the capturing element, and a click on a
 * node has to reach the node.
 * @param {(e: PointerEvent) => void} onMove
 * @param {(e: PointerEvent) => void} onEnd
 */
export function trackPointer(onMove, onEnd)
{
	const stop = () => {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', end);
		window.removeEventListener('pointercancel', end);
	};
	const end = (/** @type {PointerEvent} */ e) => {
		stop();
		onEnd(e);
	};
	window.addEventListener('pointermove', onMove);
	window.addEventListener('pointerup', end);
	window.addEventListener('pointercancel', end);
	return stop;
}


/**
 * Follow a drag from a press: onStart once the pointer has moved past the
 * threshold, onMove from then on, and onEnd when the press is released or
 * cancelled, with whether it moved
 * @param {PointerEvent} e the press
 * @param {{
 *     onStart?: (e: PointerEvent) => void,
 *     onMove?: (e: PointerEvent, dx: number, dy: number) => void,
 *     onEnd?: (e: PointerEvent, moved: boolean) => void,
 * }} handlers
 * @returns {() => void} stops following it
 */
function trackDrag(e, { onStart, onMove, onEnd })
{
	const x = e.clientX, y = e.clientY;
	let moved = false;
	return trackPointer(ev => {
		const dx = ev.clientX - x, dy = ev.clientY - y;
		if (!moved) {
			if (Math.abs(dx) < DRAG_THRESHOLD_PIXELS && Math.abs(dy) < DRAG_THRESHOLD_PIXELS)
				return;
			moved = true;
			onStart?.(ev);
		}
		onMove?.(ev, dx, dy);
	}, ev => onEnd?.(ev, moved));
}


/** True once for the click that ends a drag, which must not select or sync */
export function consumeDragClick()
{
	const suppress = suppressNextClick;
	suppressNextClick = false;
	return suppress;
}


/**
 * The selected nodes, or the one pressed, follow the pointer onto an
 * architecture, where Ctrl copies them instead of moving them
 * @param {string} id
 * @param {PointerEvent} e
 */
function startNodeDrag(id, e)
{
	const ids = selected.has(id) ? Array.from(selected) : [id];
	const targetAt = (/** @type {PointerEvent} */ ev) => {
		const target = archAt(ev.clientX, ev.clientY);
		return target && !ids.includes(target) ? target : undefined;
	};
	const ghost = document.createElement('div');
	ghost.id = 'dragGhost';
	/** @type {string | undefined} */
	let over = undefined;
	trackDrag(e, {
		onStart: () => {
			if (!ids.every(i => selected.has(i)))
				replaceSelection(ids);
			document.body.appendChild(ghost);
		},
		onMove: (ev) => {
			ev.preventDefault();
			autoScroll(ev.clientX, ev.clientY);
			ghost.style.left = `${ev.clientX + 14}px`;
			ghost.style.top = `${ev.clientY + 10}px`;
			const target = targetAt(ev);
			if (target !== over) {
				markDropTarget(target);
				over = target;
			}
			const count = ids.length === 1 ? '1 item' : `${ids.length} items`;
			ghost.textContent = target ? `${ev.ctrlKey ? 'Copy' : 'Move'} ${count} to ${target}` : `${count}: drop on an architecture`;
		},
		onEnd: (ev, moved) => {
			stopAutoScroll();
			if (!moved)
				return;
			suppressNextClick = true;
			const target = ev.type === 'pointerup' ? targetAt(ev) : undefined;
			if (target)
				vscode.postMessage({ method: 'drop', ids, target, copy: ev.ctrlKey });
			ghost.remove();
			markDropTarget(undefined);
		},
	});
}


/** The architecture node under a point */
/** @param {number} x @param {number} y */
function archAt(x, y)
{
	const element = document.elementFromPoint(x, y);
	return element instanceof Element ? element.closest('[data-id][href^="arch:"]')?.getAttribute('data-id') || undefined : undefined;
}


/** Mark the architecture a drag would drop on, or none */
/** @param {string | undefined} id */
function markDropTarget(id)
{
	for (const element of document.querySelectorAll('.dropTarget'))
		element.classList.remove('dropTarget');
	if (id)
		for (const element of document.querySelectorAll(`#graphContainer [data-id="${cssEscape(id)}"]`))
			element.classList.add('dropTarget');
}


/** @type {number | undefined} */
let autoScrollTimer = undefined;

let autoScrollPoint = { x: 0, y: 0 };

/** The node a press began on, which a native drag carries out of the graph */
/** @type {string | undefined} */
let pressedNode = undefined;


/**
 * While something is dragged within 30 px of the view's edge, the view
 * scrolls toward it a twentieth of a page every 125 ms, as the GUI's does
 * @param {number} x @param {number} y client coordinates
 */
function autoScroll(x, y)
{
	autoScrollPoint = { x, y };
	if (autoScrollTimer === undefined)
		autoScrollTimer = window.setInterval(() => {
			const main = document.getElementById('main');
			if (!main) {
				stopAutoScroll();
				return;
			}
			const area = main.getBoundingClientRect();
			const edge = 30;
			const { x, y } = autoScrollPoint;
			const dx = x < area.left + edge ? -1 : x > area.left + main.clientWidth - edge ? 1 : 0;
			const dy = y < area.top + edge ? -1 : y > area.top + main.clientHeight - edge ? 1 : 0;
			if (dx || dy)
				main.scrollBy(dx * main.clientWidth / 20, dy * main.clientHeight / 20);
		}, 125);
}


export function stopAutoScroll()
{
	window.clearInterval(autoScrollTimer);
	autoScrollTimer = undefined;
}


/**
 * The band adds what lies wholly inside it to the selection: nodes,
 * clusters and edges, as the GUI's band selects every selectable item
 * @param {PointerEvent} e
 */
function startBand(e)
{
	e.preventDefault();
	const x = e.clientX, y = e.clientY;
	const element = document.createElement('div');
	element.id = 'rubberBand';
	document.body.appendChild(element);
	trackDrag(e, {
		onMove: (ev) => Object.assign(element.style, {
			left: `${Math.min(ev.clientX, x)}px`,
			top: `${Math.min(ev.clientY, y)}px`,
			width: `${Math.abs(ev.clientX - x)}px`,
			height: `${Math.abs(ev.clientY - y)}px`,
		}),
		onEnd: (ev, moved) => {
			element.remove();
			if (!moved)
				return;
			suppressNextClick = true;
			selectInside(Math.min(x, ev.clientX), Math.min(y, ev.clientY), Math.max(x, ev.clientX), Math.max(y, ev.clientY));
		},
	});
}


/** Add what lies wholly inside a rectangle of the view to the selection */
/** @param {number} left @param {number} top @param {number} right @param {number} bottom */
function selectInside(left, top, right, bottom)
{
	const inside = (/** @type {Element} */ el) => {
		const box = el.getBoundingClientRect();
		return box.left >= left && box.right <= right && box.top >= top && box.bottom <= bottom;
	};
	const container = document.getElementById('graphContainer');
	if (!container)
		return;
	/** @type {Map<string, boolean>} */
	const nodes = new Map;
	for (const el of container.querySelectorAll(`[data-id]:is(${NODE_KINDS}):not(text)`)) {
		const id = el.getAttribute('data-id') || '';
		nodes.set(id, (nodes.get(id) ?? true) && inside(el));
	}
	/** @type {Map<string, boolean>} */
	const edges = new Map;
	for (const el of container.querySelectorAll('[data-edge]:not(text, .edgeHit)')) {
		const index = el.getAttribute('data-edge') || '';
		edges.set(index, (edges.get(index) ?? true) && inside(el));
	}
	/** @type {string | undefined} */
	let first = undefined;
	/** @type {string | undefined} */
	let firstCluster = undefined;
	for (const [id, all] of nodes)
		if (all) {
			selected.add(id);
			if (container.querySelector(`[data-id="${cssEscape(id)}"][data-kind="cluster"]`))
				firstCluster ??= id;
			else
				first ??= id;
		}
	first ??= firstCluster;
	for (const [index, all] of edges)
		if (all) {
			selectedEdges.add(index);
			first ??= container.querySelector(`[data-edge="${cssEscape(index)}"][data-tail]`)?.getAttribute('data-tail') || undefined;
		}
	applySelection();
	// The GUI syncs to the first entity of a band's selection
	if (first)
		vscode.postMessage({ method: 'action', action: 'sync', ids: [first] });
}


/**
 * The selected nodes, or the one pressed, follow the pointer; their edges
 * follow once the server lays the graph out again, as in the GUI
 * @param {string} id
 * @param {PointerEvent} e
 */
function startNodeMove(id, e)
{
	const ids = selected.has(id) ? Array.from(selected) : [id];
	/** @type {SVGElement[]} */
	const elements = [];
	trackDrag(e, {
		onStart: () => {
			if (!ids.every(i => selected.has(i)))
				replaceSelection(ids);
			const container = document.getElementById('graphContainer');
			for (const i of ids)
				for (const el of container?.querySelectorAll(`[data-id="${cssEscape(i)}"], text[data-owner="${cssEscape(i)}"]`) || [])
					elements.push(/** @type {SVGElement} */ (el));
			// A link's hover transition would leave the outline behind its label
			for (const el of elements)
				el.style.transition = 'none';
		},
		onMove: (ev, dx, dy) => {
			ev.preventDefault();
			autoScroll(ev.clientX, ev.clientY);
			for (const el of elements)
				el.style.transform = `translate(${dx / zoom}px, ${dy / zoom}px)`;
		},
		onEnd: (ev, moved) => {
			stopAutoScroll();
			if (!moved)
				return;
			suppressNextClick = true;
			if (ev.type !== 'pointerup') {
				for (const el of elements) {
					el.style.transform = '';
					el.style.transition = '';
				}
				return;
			}
			vscode.postMessage({ method: 'action', action: 'moveNodes', ids,
				dx: (ev.clientX - e.clientX) / zoom, dy: (ev.clientY - e.clientY) / zoom });
		},
	});
}


/**
 * A node dragged out of the graph carries its name (each selected node's,
 * one a line) and, for files, the files, as the GUI's drag carries them
 * @param {DragEvent} e
 */
export function onDragStart(e)
{
	const container = document.getElementById('graphContainer');
	const id = pressedNode;
	if (!container || !id || !e.dataTransfer) {
		e.preventDefault();
		return;
	}
	stopPan?.();
	stopPan = undefined;
	document.getElementById('main')?.classList.remove('grabbing');
	const ids = selected.has(id) ? Array.from(selected) : [id];
	const names = [];
	const files = [];
	for (const nodeId of ids) {
		const element = container.querySelector(`[data-id="${cssEscape(nodeId)}"]:not(text)`);
		names.push((element?.getAttribute('data-tip') || nodeId).split('\n')[0]);
		const file = element?.getAttribute('data-file');
		if (file)
			files.push('file:///' + encodeURI(file.replace(/\\/g, '/').replace(/^\//, '')));
	}
	e.dataTransfer.setData('text/plain', names.join('\n'));
	if (files.length)
		e.dataTransfer.setData('text/uri-list', files.join('\r\n'));
	e.dataTransfer.effectAllowed = 'copy';
}


/**
 * Files from VS Code's Explorer (dragged with Shift, as VS Code drops into
 * a page) dropped on an architecture are added to it, in a graph that takes
 * drops, as the GUI takes them from its other views
 * @param {DragEvent} e
 */
export function onDragOver(e)
{
	if (!info || !info.draggableTags || !e.dataTransfer || !Array.from(e.dataTransfer.types).includes('text/uri-list'))
		return;
	autoScroll(e.clientX, e.clientY);
	const target = archAt(e.clientX, e.clientY);
	markDropTarget(target);
	if (!target)
		return;
	e.preventDefault();
	e.dataTransfer.dropEffect = 'copy';
}


/** @param {DragEvent} e */
export function onDrop(e)
{
	stopAutoScroll();
	markDropTarget(undefined);
	const target = archAt(e.clientX, e.clientY);
	const uris = (e.dataTransfer?.getData('text/uri-list') || '').split(/\r?\n/).filter(u => u && !u.startsWith('#'));
	if (!info || !info.draggableTags || !target || !uris.length)
		return;
	e.preventDefault();
	vscode.postMessage({ method: 'droppedFiles', target, uris });
}
