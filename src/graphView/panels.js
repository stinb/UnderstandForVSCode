// @ts-check
// The floating panels (legend, mini-map, peek): moved by hand, their places kept for the tab

import { vscode } from './state.js';
import { trackPointer } from './drags.js';


/** Merge into what VS Code keeps for the tab (its graph, panel places) */
/** @param {{[key: string]: unknown}} patch */
export function updateState(patch)
{
	vscode.setState(Object.assign({}, vscode.getState() || {}, patch));
}


/** Where the panels were moved to, and their sizes, by panel */
/** @returns {{[which: string]: {left: number, top: number, scale?: number}}} */
export function panelPlaces()
{
	return (vscode.getState() || {}).panels || {};
}


/** Keep a panel's place and size for the tab */
/** @param {'legend' | 'minimap' | 'peek'} which @param {HTMLElement} panel */
function keepPanelPlace(which, panel)
{
	const panels = Object.assign({}, panelPlaces());
	panels[which] = { left: parseInt(panel.style.left) || 0, top: parseInt(panel.style.top) || 0, scale: panelScale(panel) };
	updateState({ panels });
}


/**
 * Move a floating panel with the pointer, as the GUI's legend and mini-map
 * are dragged; its place is kept for the tab
 * @param {'legend' | 'minimap' | 'peek'} which
 * @param {PointerEvent} e
 */
export function startPanelMove(which, e)
{
	const panel = document.getElementById(which);
	if (!panel)
		return;
	e.preventDefault();
	e.stopPropagation();
	const rect = panel.getBoundingClientRect();
	const dx = e.clientX - rect.left;
	const dy = e.clientY - rect.top;
	trackPointer(ev => placePanel(panel, ev.clientX - dx, ev.clientY - dy), () => keepPanelPlace(which, panel));
}


/** @param {HTMLElement} panel @param {number} left @param {number} top */
export function placePanel(panel, left, top)
{
	const width = panel.offsetWidth || 100;
	const height = panel.offsetHeight || 40;
	panel.style.left = `${Math.max(0, Math.min(left, window.innerWidth - width))}px`;
	panel.style.top = `${Math.max(0, Math.min(top, window.innerHeight - height))}px`;
	panel.style.right = 'auto';
	panel.style.bottom = 'auto';
}


/** Put the panels where they were moved to, and at the size, when shown */
/** @param {'legend' | 'minimap' | 'peek'} which */
export function restorePanel(which)
{
	const place = panelPlaces()[which];
	const panel = document.getElementById(which);
	if (!place || !panel || panel.hidden)
		return;
	if (place.scale)
		setPanelScale(panel, place.scale);
	placePanel(panel, place.left, place.top);
}


/** How near a panel's border a press resizes it, as the GUI's frame */
const EDGE_PIXELS = 5;

/**
 * The border a point is on, as a resize cursor names it ('n', 'se', …), or ''
 * @param {HTMLElement} panel @param {number} x @param {number} y
 */
export function panelEdge(panel, x, y)
{
	const r = panel.getBoundingClientRect();
	if (x < r.left || x > r.right || y < r.top || y > r.bottom)
		return '';
	const vertical = y - r.top < EDGE_PIXELS ? 'n' : r.bottom - y < EDGE_PIXELS ? 's' : '';
	const horizontal = x - r.left < EDGE_PIXELS ? 'w' : r.right - x < EDGE_PIXELS ? 'e' : '';
	return vertical + horizontal;
}


/** @param {HTMLElement} panel */
export function panelScale(panel)
{
	return Number(panel.dataset.scale) || 1;
}


/**
 * Draw a panel's contents at a scale, as the GUI's legend fits its entries
 * to the frame's size
 * @param {HTMLElement} panel @param {number} scale
 */
export function setPanelScale(panel, scale)
{
	panel.dataset.scale = String(scale);
	const content = /** @type {HTMLElement | null} */ (panel.querySelector(':scope > .panelContent'));
	if (content)
		content.style.zoom = String(scale);
}


/**
 * Resize a panel from the border that was pressed, as the GUI's legend frame
 * is resized: its contents scale to fit, the opposite border stays put, and
 * the size is kept for the tab with its place
 * @param {'legend' | 'minimap' | 'peek'} which
 * @param {PointerEvent} e
 * @param {string} edge
 */
export function startPanelResize(which, e, edge)
{
	const panel = document.getElementById(which);
	if (!panel)
		return;
	e.preventDefault();
	e.stopPropagation();
	const start = panel.getBoundingClientRect();
	const startScale = panelScale(panel);
	trackPointer(ev => {
		const dx = ev.clientX - e.clientX;
		const dy = ev.clientY - e.clientY;
		const width = start.width + (edge.includes('e') ? dx : edge.includes('w') ? -dx : 0);
		const height = start.height + (edge.includes('s') ? dy : edge.includes('n') ? -dy : 0);
		const sideways = /[ew]/.test(edge);
		const upDown = /[ns]/.test(edge);
		const ratio = sideways && upDown ? Math.min(width / start.width, height / start.height)
			: sideways ? width / start.width : height / start.height;
		setPanelScale(panel, Math.max(0.3, Math.min(4, startScale * ratio)));
		const r = panel.getBoundingClientRect();
		placePanel(panel, edge.includes('w') ? start.right - r.width : start.left,
			edge.includes('n') ? start.bottom - r.height : start.top);
	}, () => keepPanelPlace(which, panel));
}
