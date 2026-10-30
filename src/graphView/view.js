// @ts-check
// Zoom, the fits, and where the view goes across redraws and saved states

import { vscode, info, selected, selectedEdges } from './state.js';
import { cssEscape } from './util.js';
import { replaceSelection, postAction } from './selection.js';
import { placePanel, panelScale, setPanelScale } from './panels.js';
import { updateUndoButtons } from './toolbar.js';
import { hideMenu } from './menus.js';
import { toggleLegend, holdLegendPlace } from './legend.js';
import { toggleMinimap, updateMinimap } from './minimap.js';


// The GUI's zoom: 1% to 300%, its presets, and steps of 10 points
const ZOOM_MIN = 0.01;

const ZOOM_MAX = 3;

export const ZOOM_PRESETS = [0.1, 0.15, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export let zoom = 1;

/**
 * A zoom step the view's undo takes back, as the GUI's zoom is undoable.
 * The server keeps the graph's own steps; serverDepth is how many it had
 * when the zoom was made, which orders the two.
 * @typedef {{from: number, to: number, source: string, serverDepth: number}} ZoomStep
 */
/** @type {ZoomStep[]} */
const zoomUndo = [];

/** @type {ZoomStep[]} */
export const zoomRedo = [];

/** The GUI's sticky Fit Width and Fit Height: applied again after each redraw */
/** @type {'' | 'width' | 'height'} */
let fitMode = '';


/**
 * Zoom about a point of the view (client coordinates), keeping what is
 * under it in place. The step is undoable: the wheel's steps and the zoom
 * buttons' steps each merge with the one before in the same direction, as
 * the GUI merges them; a chosen value never merges.
 * @param {number} newZoom
 * @param {number} [clientX]
 * @param {number} [clientY]
 * @param {'wheel' | 'action' | 'value' | 'none'} [source]
 */
export function setZoom(newZoom, clientX, clientY, source = 'value')
{
	flushWheel();
	const main = document.getElementById('main');
	const container = document.getElementById('graphContainer');
	if (!main || !container)
		return;

	newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
	const oldZoom = zoom;
	if (newZoom !== oldZoom && source !== 'none') {
		const last = zoomUndo[zoomUndo.length - 1];
		const depth = (info && info.undoCount) || 0;
		const merges = last && last.source === source && source !== 'value' && last.serverDepth === depth
			&& Math.sign(last.to - last.from) === Math.sign(newZoom - oldZoom);
		if (merges)
			last.to = newZoom;
		else
			zoomUndo.push({ from: oldZoom, to: newZoom, source, serverDepth: depth });
		zoomRedo.length = 0;
	}
	zoom = newZoom;
	sizeSvg();

	const rect = main.getBoundingClientRect();
	const ax = clientX === undefined ? rect.left + rect.width / 2 : clientX;
	const ay = clientY === undefined ? rect.top + rect.height / 2 : clientY;
	const mouseX = ax + main.scrollLeft;
	const mouseY = ay + main.scrollTop;
	const scaleChange = zoom / oldZoom;
	main.scrollTo(mouseX * scaleChange - ax, mouseY * scaleChange - ay);

	updateZoomSelect();
	updateUndoButtons();
	updateMinimap();
}


/**
 * Undo or redo, the view's zoom steps and the server's graph steps in the
 * order they were made: a zoom step made after the server's last step
 * comes back first
 * @param {-1 | 1} direction
 */
export function undoStep(direction)
{
	flushWheel();
	hideMenu();
	if (direction < 0) {
		const last = zoomUndo[zoomUndo.length - 1];
		if (last && last.serverDepth === ((info && info.undoCount) || 0)) {
			zoomUndo.pop();
			zoomRedo.push({ ...last, serverDepth: (info && info.redoCount) || 0 });
			setZoom(last.from, undefined, undefined, 'none');
			return;
		}
		postAction('undo');
	}
	else {
		const last = zoomRedo[zoomRedo.length - 1];
		if (last && last.serverDepth === ((info && info.redoCount) || 0)) {
			zoomRedo.pop();
			zoomUndo.push({ ...last, serverDepth: (info && info.undoCount) || 0 });
			setZoom(last.to, undefined, undefined, 'none');
			return;
		}
		postAction('redo');
	}
}


export function canUndo()
{
	return !!(info && info.canUndo) || zoomUndo.length > 0;
}


export function canRedo()
{
	return !!(info && info.canRedo) || zoomRedo.length > 0;
}


/** Scroll so a point of the graph (its own units) is at the view's center */
/** @param {number} x @param {number} y */
function centerOnGraphPoint(x, y)
{
	const main = document.getElementById('main');
	const svg = document.querySelector('#graphContainer svg');
	if (!main || !svg)
		return;
	const box = svg.getBoundingClientRect();
	const area = main.getBoundingClientRect();
	const clientX = box.left + x * zoom;
	const clientY = box.top + y * zoom;
	main.scrollBy(clientX - (area.left + main.clientWidth / 2), clientY - (area.top + main.clientHeight / 2));
}


/** The center of a node's or edge's drawing, in the graph's units */
/** @param {string} selector */
export function graphCenterOf(selector)
{
	const svg = document.querySelector('#graphContainer svg');
	const elements = svg ? Array.from(svg.querySelectorAll(selector)) : [];
	if (!svg || !elements.length)
		return undefined;
	const origin = svg.getBoundingClientRect();
	let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
	for (const element of elements) {
		const box = element.getBoundingClientRect();
		left = Math.min(left, box.left);
		top = Math.min(top, box.top);
		right = Math.max(right, box.right);
		bottom = Math.max(bottom, box.bottom);
	}
	return {
		x: ((left + right) / 2 - origin.left) / zoom,
		y: ((top + bottom) / 2 - origin.top) / zoom,
		width: (right - left) / zoom,
		height: (bottom - top) / zoom,
	};
}


/** The selector of a node's or cluster's shapes */
/** @param {string} id */
export function nodeSelector(id)
{
	return `[data-id="${cssEscape(id)}"]:not(text)`;
}


/** The graph's drawn size at 100%, from the SVG */
export function graphSize()
{
	const svg = document.querySelector('#graphContainer svg');
	if (!svg)
		return { width: 0, height: 0 };
	const width = parseFloat(svg.getAttribute('data-width') || svg.getAttribute('width') || '0');
	const height = parseFloat(svg.getAttribute('data-height') || svg.getAttribute('height') || '0');
	return { width, height };
}


/**
 * Draw the graph at the zoom by its own size, which its viewBox scales to:
 * CSS zoom on the container laid out every element again, a second a step
 * on a whole-project graph, where this takes a tenth of that. The drawn
 * size is kept in data-width and data-height.
 */
export function sizeSvg()
{
	const svg = document.querySelector('#graphContainer svg');
	if (!svg)
		return;
	if (!svg.hasAttribute('data-width')) {
		// A drawing without a size (not the server's) is measured, where it
		// can be, and otherwise left as it is
		let width = parseFloat(svg.getAttribute('width') || '');
		let height = parseFloat(svg.getAttribute('height') || '');
		if ((!(width > 0) || !(height > 0)) && svg instanceof SVGSVGElement && typeof svg.getBBox === 'function') {
			const box = svg.getBBox();
			width = box.x + box.width;
			height = box.y + box.height;
		}
		if (!(width > 0) || !(height > 0))
			return;
		svg.setAttribute('data-width', String(width));
		svg.setAttribute('data-height', String(height));
		if (!svg.getAttribute('viewBox'))
			svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
	}
	const { width, height } = graphSize();
	svg.setAttribute('width', String(width * zoom));
	svg.setAttribute('height', String(height * zoom));
}


/** The zooms that fit the graph's width, height or both into the view */
function fitZooms()
{
	const main = document.getElementById('main');
	const { width, height } = graphSize();
	if (!main || !width || !height)
		return undefined;
	const margin = 2 * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--graphMargin') || '32') || 64;
	const availW = Math.max(1, main.clientWidth - margin);
	const availH = Math.max(1, main.clientHeight - margin);
	return { width: availW / width, height: availH / height, page: Math.min(availW / width, availH / height) };
}


/**
 * @param {'width' | 'height' | 'page'} what
 * @param {'value' | 'none'} [source] an automatic re-fit is not an undo step
 */
export function zoomToFit(what, source = 'value')
{
	const main = document.getElementById('main');
	const fits = fitZooms();
	if (!main || !fits)
		return;
	setZoom(fits[what], undefined, undefined, source);
	main.scrollTo((main.scrollWidth - main.clientWidth) / 2, (main.scrollHeight - main.clientHeight) / 2);
}


/** Fit Width and Fit Height stay on, as the GUI's checkable actions do;
 * choosing the one that is on turns it off */
/** @param {'width' | 'height'} what */
export function toggleFit(what)
{
	if (fitMode === what) {
		fitMode = '';
		updateZoomSelect();
		return;
	}
	fitMode = what;
	zoomToFit(what);
}


export function updateZoomSelect()
{
	const select = document.getElementById('zoomSelect');
	if (!(select instanceof HTMLSelectElement))
		return;
	// The fits read their zoom, and a check on the one that is on, as the
	// GUI's labels do
	const fits = fitZooms();
	for (const [what, label] of /** @type {const} */ ([['width', 'Fit Width'], ['height', 'Fit Height']])) {
		const option = select.querySelector(`option[value="fit-${what}"]`);
		if (option)
			option.textContent = `${fitMode === what ? '✓ ' : ''}${label}${fits ? ` (${Math.round(fits[what] * 100)}%)` : ''}`;
	}
	// A zoom between the presets is the GUI's "Other...(N%)"
	const percent = Math.round(zoom * 100);
	const other = select.querySelector('option[value="other"]');
	const preset = ZOOM_PRESETS.find(p => Math.round(p * 100) === percent);
	if (other)
		other.textContent = preset === undefined ? `Other…(${percent}%)` : 'Other…';
	// The box shows the zoom itself (the GUI's button is an icon; the
	// percentage is only in its menu's Other…), by a hidden item rather than
	// by Other…, which choosing again would not change, so it would not ask
	let current = select.querySelector('option[value="current"]');
	if (!current) {
		current = document.createElement('option');
		current.value = 'current';
		current.hidden = true;
		select.prepend(current);
	}
	current.textContent = `${percent}%`;
	select.value = preset === undefined ? 'current' : `${percent}%`;
}


/** @param {WheelEvent} e */
export function onWheel(e)
{
	const main = document.getElementById('main');
	if (!main)
		return;
	if (e.target instanceof Element && e.target.closest('aside, #menu, #legend, #peek'))
		return;

	// Understand's wheel preference: the wheel zooms and Ctrl+wheel scrolls
	// (its default), or the reverse. A trackpad's pinch arrives as Ctrl+wheel
	// in steps of a fraction, and zooms, as the GUI's pinch does.
	const pinch = e.ctrlKey && !Number.isInteger(e.deltaY);
	const wheelZooms = !(info && info.wheelZoom === false);
	if (!pinch && wheelZooms === e.ctrlKey)
		return;

	e.preventDefault();

	/** @type {'wheel' | 'action'} */
	const source = pinch ? 'action' : 'wheel';
	const from = pendingWheel ? pendingWheel.zoom : zoom;
	const to = pinch ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, from * Math.exp(-e.deltaY / 100)))
		: steppedZoom(from, e.deltaY > 0 ? -1 : 1);
	if (to === undefined)
		return;
	// A turn the other way, or a pinch after the wheel, is its own undo step
	if (pendingWheel && (pendingWheel.source !== source || Math.sign(to - from) !== Math.sign(from - zoom)))
		flushWheel();
	if (!pendingWheel)
		requestAnimationFrame(flushWheel);
	pendingWheel = { zoom: to, source, clientX: e.clientX, clientY: e.clientY };
}


/**
 * The wheel's zoom waiting for the next frame: a wheel or a trackpad sends
 * several events a frame, and each zoom lays the whole drawing out again
 * @type {{zoom: number, source: 'wheel' | 'action', clientX: number, clientY: number} | undefined}
 */
let pendingWheel = undefined;


function flushWheel()
{
	const pending = pendingWheel;
	pendingWheel = undefined;
	if (pending)
		setZoom(pending.zoom, pending.clientX, pending.clientY, pending.source);
}


/**
 * One step of the GUI's zoom: the zoom snapped down to a multiple of 10
 * points, then 10 points in or out, from 1% to 300%; a step past either end
 * does nothing
 * @param {-1 | 1} direction
 * @param {'wheel' | 'action'} source
 * @param {number} [clientX] @param {number} [clientY]
 */
export function stepZoom(direction, source, clientX, clientY)
{
	flushWheel();
	const to = steppedZoom(zoom, direction);
	if (to !== undefined)
		setZoom(to, clientX, clientY, source);
}


/** @param {number} from @param {-1 | 1} direction */
function steppedZoom(from, direction)
{
	const percent = Math.floor(Math.round(from * 100) / 10) * 10 + 10 * direction;
	if (percent < ZOOM_MIN * 100 || percent > ZOOM_MAX * 100)
		return undefined;
	return percent / 100;
}


/** The graph has been drawn once in this tab */
let drawnOnce = false;

/** A loaded saved state's center, for the draw that follows the load */
/** @type {{x: number, y: number} | undefined} */
let pendingCenter = undefined;

/** A node to select once it is drawn: the Control Flow node at the editor's cursor */
/** @type {string | undefined} */
let pendingFocus = undefined;


/** Save Graph State, with the view as the GUI's graph window saves it, under its keys */
export function saveGraphState()
{
	const main = document.getElementById('main');
	const svg = document.querySelector('#graphContainer svg');
	/** @type {import('../types/graph').SavedView} */
	const view = {
		graphdisplay_zoom: Math.round(zoom * 100),
		graphwindow_fitwidth: fitMode === 'width',
		graphwindow_fitheight: fitMode === 'height',
	};
	if (main && svg) {
		const box = svg.getBoundingClientRect();
		const area = main.getBoundingClientRect();
		view.graphdisplay_center_x = Math.round((area.left + main.clientWidth / 2 - box.left) / zoom);
		view.graphdisplay_center_y = Math.round((area.top + main.clientHeight / 2 - box.top) / zoom);
	}
	const minimap = document.getElementById('minimap');
	view.graphwindow_radar = !!minimap && !minimap.hidden;
	if (minimap && !minimap.hidden) {
		view.graphdisplay_overview_x = minimap.offsetLeft;
		view.graphdisplay_overview_y = minimap.offsetTop;
	}
	const legend = document.getElementById('legend');
	if (legend && !legend.hidden) {
		view.graphdisplay_legend_x = legend.offsetLeft;
		view.graphdisplay_legend_y = legend.offsetTop;
		view.graphdisplay_legend_scale = panelScale(legend);
	}
	vscode.postMessage({ method: 'state', action: 'save', view });
}


/**
 * A loaded saved state's view, the GUI's or this page's: zoom, fit, the
 * mini-map and legend and where they were, and the center for the next draw
 * @param {import('../types/graph').SavedView} view
 */
export function applyView(view)
{
	const percent = Number(view.graphdisplay_zoom);
	if (percent > 0 && percent <= 400)
		setZoom(percent / 100, undefined, undefined, 'none');
	fitMode = view.graphwindow_fitwidth ? 'width' : view.graphwindow_fitheight ? 'height' : '';
	const minimap = document.getElementById('minimap');
	if (minimap && view.graphwindow_radar !== undefined && minimap.hidden === !!view.graphwindow_radar)
		toggleMinimap();
	if (minimap && !minimap.hidden && view.graphdisplay_overview_x !== undefined)
		placePanel(minimap, Number(view.graphdisplay_overview_x), Number(view.graphdisplay_overview_y));
	const legend = document.getElementById('legend');
	if (legend && view.graphdisplay_legend_x !== undefined) {
		const x = Number(view.graphdisplay_legend_x);
		const y = Number(view.graphdisplay_legend_y);
		const scale = Number(view.graphdisplay_legend_scale) || 1;
		// A state opened in a new tab: its legend waits for the first drawing
		if (!info || !info.legend || !info.legend.length) {
			setPanelScale(legend, scale);
			holdLegendPlace(x, y);
		}
		else {
			if (legend.hidden)
				toggleLegend(false);
			setPanelScale(legend, scale);
			placePanel(legend, x, y);
		}
	}
	if (view.graphdisplay_center_x !== undefined)
		pendingCenter = { x: Number(view.graphdisplay_center_x), y: Number(view.graphdisplay_center_y) };
	updateZoomSelect();
}


/** Select a node, sync it and center the view on it; one not drawn yet is
 * selected once it is */
/** @param {string} id */
export function focusNode(id)
{
	const center = graphCenterOf(nodeSelector(id));
	if (!center) {
		pendingFocus = id;
		return;
	}
	pendingFocus = undefined;
	replaceSelection([id]);
	vscode.postMessage({ method: 'action', action: 'sync', ids: [id] });
	centerOnGraphPoint(center.x, center.y);
}


/**
 * Where each node and cluster is (the graph's units), and the node the
 * view follows across a redraw, as the GUI's graph widget follows it: the
 * one selected node, else the root
 */
export function captureView()
{
	/** @type {Map<string, {x: number, y: number}>} */
	const positions = new Map;
	const svg = document.querySelector('#graphContainer svg');
	const main = document.getElementById('main');
	if (!svg || !main)
		return { positions, anchor: undefined, offset: { x: 0, y: 0 } };
	const origin = svg.getBoundingClientRect();
	/** @type {Map<string, DOMRect[]>} */
	const boxes = new Map;
	for (const element of svg.querySelectorAll('[data-id]:not(text)')) {
		const id = element.getAttribute('data-id') || '';
		boxes.set(id, [...(boxes.get(id) || []), element.getBoundingClientRect()]);
	}
	for (const [id, rects] of boxes) {
		const left = Math.min(...rects.map(r => r.left)), right = Math.max(...rects.map(r => r.right));
		const top = Math.min(...rects.map(r => r.top)), bottom = Math.max(...rects.map(r => r.bottom));
		positions.set(id, { x: ((left + right) / 2 - origin.left) / zoom, y: ((top + bottom) / 2 - origin.top) / zoom });
	}
	const one = selected.size === 1 && !selectedEdges.size ? Array.from(selected)[0] : undefined;
	const area = main.getBoundingClientRect();
	/** Where a node is in the view, from its center */
	const offsetOf = (/** @type {string} */ id) => {
		const at = /** @type {{x: number, y: number}} */ (positions.get(id));
		return { x: origin.left + at.x * zoom - (area.left + main.clientWidth / 2),
			y: origin.top + at.y * zoom - (area.top + main.clientHeight / 2) };
	};
	const anchor = one && positions.has(one) ? one : undefined;
	const offset = anchor ? offsetOf(anchor) : { x: 0, y: 0 };
	// The node nearest the middle of the view, which a redraw the user did
	// not ask for keeps in place
	let nearest = undefined, nearestOffset = { x: 0, y: 0 }, best = Infinity;
	for (const id of positions.keys()) {
		const o = offsetOf(id);
		const distance = o.x * o.x + o.y * o.y;
		if (distance < best) {
			best = distance;
			nearest = id;
			nearestOffset = o;
		}
	}
	return { positions, anchor, offset, nearest, nearestOffset };
}


/**
 * After a redraw, as the GUI's graph widget: a loaded state's center; else
 * the followed node where it was in the view; else the root centered (in its
 * quarter of the view, when it is small and near an edge of the graph); a
 * sticky fit applied again. Nodes that moved slide to their places and the
 * edges fade in, where Understand's preference animates.
 * @param {ReturnType<typeof captureView>} before
 * @param {boolean} [keepView] a redraw the user did not ask for
 */
export function restoreView(before, keepView = false)
{
	const main = document.getElementById('main');
	const svg = document.querySelector('#graphContainer svg');
	if (!main || !svg)
		return;
	const first = !drawnOnce;
	drawnOnce = true;

	// The GUI's File Dependencies opens fitted, to whichever side needs it
	if (first && info && info.fitInView) {
		const fits = fitZooms();
		if (fits && fits.height <= fits.width && fits.height < 1)
			fitMode = 'height';
		else if (fits && fits.width < fits.height && fits.width < 1)
			fitMode = 'width';
	}

	/** @type {string | undefined} */
	let followed = undefined;
	if (fitMode) {
		zoomToFit(fitMode, 'none');
	}
	else if (pendingCenter) {
		centerOnGraphPoint(pendingCenter.x, pendingCenter.y);
	}
	else if (before.anchor && graphCenterOf(nodeSelector(before.anchor))) {
		followed = before.anchor;
		const at = /** @type {{x: number, y: number}} */ (graphCenterOf(nodeSelector(before.anchor)));
		centerOnGraphPoint(at.x + before.offset.x / zoom, at.y + before.offset.y / zoom);
	}
	// A redraw the user did not ask for (the database changed under the
	// graph) leaves the view where it was
	else if (keepView && before.nearest && graphCenterOf(nodeSelector(before.nearest))) {
		followed = before.nearest;
		const at = /** @type {{x: number, y: number}} */ (graphCenterOf(nodeSelector(before.nearest)));
		centerOnGraphPoint(at.x + before.nearestOffset.x / zoom, at.y + before.nearestOffset.y / zoom);
	}
	else {
		const root = svg.querySelector('[data-root]:not(text)');
		const id = root?.getAttribute('data-id');
		const at = id ? graphCenterOf(nodeSelector(id)) : undefined;
		const { width, height } = graphSize();
		if (id && at) {
			followed = id;
			const visibleW = main.clientWidth / zoom;
			const visibleH = main.clientHeight / zoom;
			let x = at.x, y = at.y;
			if (at.width < width / 2 && at.x < width / 4)
				x += visibleW / 4;
			else if (at.width < width / 2 && at.x > width * 3 / 4)
				x -= visibleW / 4;
			if (at.height < height / 2 && at.y < height / 4)
				y += visibleH / 4;
			else if (at.height < height / 2 && at.y > height * 3 / 4)
				y -= visibleH / 4;
			centerOnGraphPoint(x, y);
		}
		else
			centerOnGraphPoint(width / 2, height / 2);
	}
	pendingCenter = undefined;
	updateZoomSelect();

	if (pendingFocus)
		focusNode(pendingFocus);

	if (!first && info && info.animateTransitions !== false)
		animateRedraw(before.positions, followed);
}


/** Above this many nodes and clusters, a redraw is not animated */
const LARGE_DRAWING = 1000;


/**
 * The GUI's animated transition: each node or cluster drawn before slides
 * from where it was to where it is, relative to the node the view follows,
 * over 700 ms; then the edges fade in over 500 ms
 * @param {Map<string, {x: number, y: number}>} positions
 * @param {string} [followed]
 */
function animateRedraw(positions, followed)
{
	const svg = document.querySelector('#graphContainer svg');
	if (!svg || !positions.size || typeof Element.prototype.animate !== 'function')
		return;
	const followedNow = followed ? graphCenterOf(nodeSelector(followed)) : undefined;
	const followedThen = followed ? positions.get(followed) : undefined;
	const shift = followedNow && followedThen
		? { x: followedThen.x - followedNow.x, y: followedThen.y - followedNow.y } : { x: 0, y: 0 };
	/** @type {Map<string, {shapes: Element[], all: Element[]}>} */
	const nodes = new Map;
	const entry = (/** @type {string} */ id) => {
		let found = nodes.get(id);
		if (!found)
			nodes.set(id, found = { shapes: [], all: [] });
		return found;
	};
	for (const element of svg.querySelectorAll('[data-id], text[data-owner]')) {
		const id = element.getAttribute('data-id');
		const owner = element.localName === 'text' ? element.getAttribute('data-owner') : null;
		if (id !== null) {
			entry(id).all.push(element);
			if (element.localName !== 'text')
				entry(id).shapes.push(element);
		}
		if (owner !== null && owner !== id)
			entry(owner).all.push(element);
	}
	const shown = Array.from(nodes.values()).filter(node => node.shapes.length);
	if (shown.length > LARGE_DRAWING)
		return;
	// Every box is read before the first animation starts, which would make
	// each read after it lay the drawing out again
	const origin = svg.getBoundingClientRect();
	/** @type {{elements: Element[], dx: number, dy: number}[]} */
	const moves = [];
	for (const [id, node] of nodes) {
		const then = positions.get(id);
		if (!then || !node.shapes.length)
			continue;
		let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
		for (const element of node.shapes) {
			const box = element.getBoundingClientRect();
			left = Math.min(left, box.left);
			top = Math.min(top, box.top);
			right = Math.max(right, box.right);
			bottom = Math.max(bottom, box.bottom);
		}
		const dx = then.x - ((left + right) / 2 - origin.left) / zoom - shift.x;
		const dy = then.y - ((top + bottom) / 2 - origin.top) / zoom - shift.y;
		if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)
			continue;
		moves.push({ elements: node.all, dx, dy });
	}
	if (!moves.length)
		return;
	for (const { elements, dx, dy } of moves)
		for (const element of elements)
			element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
				{ duration: 700, easing: 'ease-in-out' });
	for (const element of svg.querySelectorAll('[data-edge], text:not([data-owner])'))
		element.animate([{ opacity: 0 }, { opacity: 0, offset: 0.58 }, { opacity: 1 }], { duration: 1200 });
}
