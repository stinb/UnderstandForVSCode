// @ts-check
// The mini-map: a small copy of the graph with the view on it

import { trackPointer } from './drags.js';
import { startPanelMove, restorePanel, panelPlaces } from './panels.js';
import { zoom, graphSize } from './view.js';
import { updateToolbar } from './toolbar.js';
import { drawingNumber } from './svg.js';


// The GUI's: a 100 px square 10 px in from the graph's top left, the graph
// fitted inside a 4 px margin (MinimapWidget in AnimatedGraphWidget.cpp)
const MINIMAP_SIZE = 100;
const MINIMAP_PADDING = 10;
const MAP_MARGIN = 4;


export function toggleMinimap()
{
	const minimap = document.getElementById('minimap');
	if (!minimap)
		return;
	minimap.hidden = !minimap.hidden;
	if (!panelPlaces().minimap) {
		const toolbar = document.getElementById('toolbar');
		minimap.style.left = `${MINIMAP_PADDING}px`;
		minimap.style.top = `${(toolbar ? toolbar.getBoundingClientRect().bottom : 0) + MINIMAP_PADDING}px`;
	}
	restorePanel('minimap');
	updateMinimap();
	updateToolbar();
}


/**
 * Where the graph sits in the mini-map, as the GUI fits it: scaled by its
 * longer side and centered
 * @param {number} width @param {number} height
 */
function fit(width, height)
{
	const inner = MINIMAP_SIZE - MAP_MARGIN * 2;
	const scale = inner / Math.max(width, height);
	return {
		scale,
		x: MAP_MARGIN + (inner - width * scale) / 2,
		y: MAP_MARGIN + (inner - height * scale) / 2,
	};
}


/** Redraw the mini-map: a scaled copy of the graph with the view's rectangle */
export function updateMinimap()
{
	const minimap = document.getElementById('minimap');
	const main = document.getElementById('main');
	const container = document.getElementById('graphContainer');
	if (!minimap || !main || !container || minimap.hidden)
		return;
	const svg = container.querySelector('svg');
	const { width, height } = graphSize();
	if (!svg || !width || !height) {
		minimap.innerHTML = '';
		return;
	}
	const { scale, x, y } = fit(width, height);
	let copy = minimap.querySelector('svg');
	// The drawing's number, not its text: serializing a whole-project graph
	// on every scroll and zoom took most of a second
	if (!copy || copy.getAttribute('data-for') !== String(drawingNumber)) {
		minimap.innerHTML = '';
		copy = /** @type {SVGSVGElement} */ (svg.cloneNode(true));
		copy.setAttribute('data-for', String(drawingNumber));
		if (!copy.getAttribute('viewBox'))
			copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
		for (const el of copy.querySelectorAll('[href]'))
			el.removeAttribute('href');
		for (const el of copy.querySelectorAll('text'))
			el.remove();
		minimap.appendChild(copy);
		const view = document.createElement('div');
		view.className = 'view';
		minimap.appendChild(view);
	}
	copy.setAttribute('width', String(width * scale));
	copy.setAttribute('height', String(height * scale));
	copy.style.left = `${x}px`;
	copy.style.top = `${y}px`;
	const view = minimap.querySelector('.view');
	if (!(view instanceof HTMLElement))
		return;
	// The view's rectangle is the visible part of the drawn graph, at least
	// 1 px, from where the graph sits in the scrolled area
	const at = graphOrigin(main, svg);
	const left = (main.scrollLeft - at.x) / zoom;
	const top = (main.scrollTop - at.y) / zoom;
	view.style.left = `${x + left * scale}px`;
	view.style.top = `${y + top * scale}px`;
	view.style.width = `${Math.max(1, main.clientWidth / zoom * scale)}px`;
	view.style.height = `${Math.max(1, main.clientHeight / zoom * scale)}px`;
}


/** @param {PointerEvent} e */
export function onMinimapPointerDown(e)
{
	const minimap = document.getElementById('minimap');
	if (!minimap || e.button !== 0)
		return;
	// Ctrl (Cmd) moves the mini-map, as in the GUI
	if (e.ctrlKey || e.metaKey) {
		startPanelMove('minimap', e);
		return;
	}
	e.preventDefault();
	e.stopPropagation();
	scrollToMinimap(e.clientX, e.clientY);
	trackPointer(ev => scrollToMinimap(ev.clientX, ev.clientY), () => {});
}


/** Center the view on a point of the mini-map */
/** @param {number} clientX @param {number} clientY */
function scrollToMinimap(clientX, clientY)
{
	const minimap = document.getElementById('minimap');
	const main = document.getElementById('main');
	const container = document.getElementById('graphContainer');
	if (!minimap || !main || !container)
		return;
	const { width, height } = graphSize();
	if (!width || !height)
		return;
	const rect = minimap.getBoundingClientRect();
	const { scale, x, y } = fit(width, height);
	const gx = (clientX - rect.left - minimap.clientLeft - x) / scale;
	const gy = (clientY - rect.top - minimap.clientTop - y) / scale;
	const svg = container.querySelector('svg');
	if (!svg)
		return;
	const at = graphOrigin(main, svg);
	main.scrollTo(gx * zoom + at.x - main.clientWidth / 2, gy * zoom + at.y - main.clientHeight / 2);
	updateMinimap();
}


/** Where the drawn graph's top left is in the view's scrolled area */
/** @param {HTMLElement} main @param {Element} svg */
function graphOrigin(main, svg)
{
	const box = svg.getBoundingClientRect();
	const area = main.getBoundingClientRect();
	return { x: box.left - area.left + main.scrollLeft, y: box.top - area.top + main.scrollTop };
}
