// @ts-check
// A layout in progress: the overlay with Cancel, and View past Understand's delay-load time

import { info } from './state.js';
import { postAction } from './selection.js';
import { onMessage } from './main.js';
import { focusOnGraph } from './util.js';


// A draw that takes longer than this shows the layout overlay
const DRAWING_OVERLAY_DELAY_MILLISECONDS = 700;

/** @type {number | undefined} */
let drawingTimer = undefined;

/** Past Understand's delay-load time a finished layout waits for View, as
 * the GUI's does, so a graph that took long is drawn only when asked */
let waitForView = false;

/** @type {number | undefined} */
let delayLoadTimer = undefined;

/** The drawing that waits for View */
/** @type {import('../types/graph').UpdateGraph | undefined} */
let waitingDraw = undefined;


/** A draw began: after a moment, the GUI's "Calculating ideal graph layout" with Cancel */
export function onDrawing()
{
	window.clearTimeout(drawingTimer);
	window.clearTimeout(delayLoadTimer);
	waitForView = false;
	waitingDraw = undefined;
	showLayoutDone(false);
	const seconds = delayLoadSeconds();
	if (seconds > 0)
		delayLoadTimer = window.setTimeout(() => {
			waitForView = true;
			const view = document.getElementById('viewDrawing');
			if (view instanceof HTMLButtonElement) {
				view.hidden = false;
				view.disabled = true;
			}
		}, seconds * 1000);
	drawingTimer = window.setTimeout(() => {
		let overlay = document.getElementById('drawingOverlay');
		if (!overlay) {
			overlay = document.createElement('div');
			overlay.id = 'drawingOverlay';
			const spinner = document.createElement('span');
			spinner.id = 'drawingSpinner';
			spinner.className = 'codicon codicon-loading codicon-modifier-spin';
			overlay.appendChild(spinner);
			const text = document.createElement('span');
			text.id = 'drawingText';
			overlay.appendChild(text);
			const view = document.createElement('button');
			view.id = 'viewDrawing';
			view.textContent = 'View';
			view.hidden = true;
			view.onclick = () => {
				const draw = waitingDraw;
				waitForView = false;
				waitingDraw = undefined;
				if (draw)
					onMessage(new MessageEvent('message', { data: draw }));
				// The graph's keys (Ctrl+Z, Delete, Ctrl+A) work again at once
				focusOnGraph();
			};
			overlay.appendChild(view);
			const cancel = document.createElement('button');
			cancel.id = 'cancelDrawing';
			cancel.textContent = 'Cancel';
			cancel.onclick = () => {
				postAction('abort');
				hideDrawing();
			};
			overlay.appendChild(cancel);
			document.body.appendChild(overlay);
		}
		showLayoutDone(!!waitingDraw);
		overlay.hidden = false;
	}, DRAWING_OVERLAY_DELAY_MILLISECONDS);
}


/** Understand's delay-load time: a layout that takes longer waits for View */
function delayLoadSeconds()
{
	return info && info.delayLoadTimeout !== undefined ? info.delayLoadTimeout : 5;
}


/** The overlay says the layout is running, or that it is done and waits for View */
function showLayoutDone(/** @type {boolean} */ done)
{
	const spinner = document.getElementById('drawingSpinner');
	if (spinner)
		spinner.hidden = done;
	const text = document.getElementById('drawingText');
	if (text)
		text.textContent = done
			? `The layout took over ${delayLoadSeconds()} s and is now complete. Click View to show the graph.`
			: 'Calculating ideal graph layout…';
}


/**
 * Past the delay-load time a drawing waits for View
 * @param {import('../types/graph').UpdateGraph} message
 * @returns {boolean} this one does
 */
export function holdForView(message)
{
	if (!waitForView || !message.svg)
		return false;
	waitingDraw = message;
	const view = document.getElementById('viewDrawing');
	if (view instanceof HTMLButtonElement)
		view.disabled = false;
	showLayoutDone(true);
	return true;
}


export function hideDrawing()
{
	window.clearTimeout(drawingTimer);
	window.clearTimeout(delayLoadTimer);
	drawingTimer = undefined;
	waitForView = false;
	waitingDraw = undefined;
	const view = document.getElementById('viewDrawing');
	if (view)
		view.hidden = true;
	const overlay = document.getElementById('drawingOverlay');
	if (overlay)
		overlay.hidden = true;
}
