// @ts-check
// The graph view's page: the extension's messages, and the page's listeners

import { vscode, info, setInfo, selected, selectedEdges } from './state.js';
import { focusOnGraph } from './util.js';
import { drawOptions, updateOptionRanges } from './options.js';
import { applySelection, drawNodeActionButtons, updateSelectionActions } from './selection.js';
import { onClickBackground, onClickCapture, onDoubleClick } from './clicks.js';
import { onPointerDown, onDragStart } from './drags.js';
import { onKeyDown, onKeyUp, smoothScrollLoop } from './keys.js';
import { updateState } from './panels.js';
import { onDrawing, holdForView, hideDrawing } from './drawing.js';
import { installSvg, onEdgeHover } from './svg.js';
import { peekOn, setPeekOn, showPeekSource } from './peek.js';
import {
	zoomRedo, undoStep, onWheel, stepZoom, saveGraphState, applyView, focusNode, captureView,
	restoreView, sizeSvg,
} from './view.js';
import { buildToolbar, updateToolbar, updateSavedSelect, toggleOptions, setToolbarState } from './toolbar.js';
import { runFind, stepFind } from './find.js';
import { hideMenu, showNodeMenu, showEdgeMenu, onContextMenu } from './menus.js';
import { placeFirstLegend, drawLegend } from './legend.js';
import { updateMinimap, onMinimapPointerDown } from './minimap.js';
import { exportableSvg, saveRaster, copyImage } from './images.js';


/**
@typedef {import('../types/graph').GraphMessageToSandbox} GraphMessageToSandbox
@typedef {import('../types/graph').GraphInfo} GraphInfo
*/


/** @param {GraphInfo} newInfo */
function applyInfo(newInfo)
{
	// A new step on the server, not a redo, ends what there was to redo, as
	// one undo stack does in the GUI
	const old = info;
	if (old && (newInfo.undoCount || 0) > (old.undoCount || 0) && (newInfo.redoCount || 0) >= (old.redoCount || 0))
		zoomRedo.length = 0;
	setInfo(newInfo);
	if (peekOn === undefined && newInfo.peek !== undefined)
		setPeekOn(newInfo.peek);
	document.body.classList.toggle('hoverEdges', !!newInfo.highlightEdgesOnHover);
	updateToolbar();
	updateSavedSelect();
	drawLegend();
	drawNodeActionButtons();
	placeFirstLegend();
}


/**
 * A new drawing from the server, or the message that it could not be drawn
 * @param {import('../types/graph').UpdateGraph} message
 */
function applyGraph(message)
{
	if (holdForView(message))
		return;
	hideDrawing();
	for (const loader of document.querySelectorAll('#graphContainer .codicon-loading, #options .codicon-loading'))
		loader.remove();

	const container = document.getElementById('graphContainer');
	if (!container)
		return;
	const before = captureView();
	installSvg(container, message.svg);
	sizeSvg();
	if (!message.svg && message.message) {
		const text = document.createElement('p');
		text.className = 'graphMessage';
		text.textContent = message.message;
		container.append(text);
	}

	// Nodes and edges the redraw dropped leave the selection
	const ids = new Set(Array.from(container.querySelectorAll('[data-id]'), e => e.getAttribute('data-id') || ''));
	for (const id of Array.from(selected))
		if (!ids.has(id))
			selected.delete(id);
	selectedEdges.clear();
	applySelection();

	if (message.info)
		applyInfo(message.info);
	if (message.svg)
		restoreView(before, !!message.keepView);
	const find = document.getElementById('find');
	if (find instanceof HTMLInputElement && find.value)
		runFind(find.value, false);
	updateMinimap();
}


/** The extension's messages, by method */
/** @type {{[M in GraphMessageToSandbox['method']]: (message: Extract<GraphMessageToSandbox, {method: M}>) => unknown}} */
const handlers = {
	// Export To File's images, drawn by the page at its zoom
	convert: (message) => {
		const svg = exportableSvg();
		if (svg)
			saveRaster(message.path, svg, message.extension === 'jpg' ? 'image/jpeg' : 'image/png');
	},
	copyImage: () => copyImage(),
	toggleOptions: () => toggleOptions(),
	updateGraph: applyGraph,
	updateInfo: (message) => applyInfo(message.info),
	updateSelection: (message) => {
		updateSelectionActions(message.ids, message.actions);
		showNodeMenu(message);
	},
	updateEdgeRefs: showEdgeMenu,
	updateToolbar: setToolbarState,
	drawing: () => onDrawing(),
	aborted: () => hideDrawing(),
	restoreState: (message) => updateState({ graph: message.state }),
	zoomStep: (message) => stepZoom(message.step > 0 ? 1 : -1, 'action'),
	undoStep: (message) => undoStep(message.step < 0 ? -1 : 1),
	saveState: () => saveGraphState(),
	applyView: (message) => applyView(message.view),
	focusNode: (message) => focusNode(message.id),
	peekSource: (message) => showPeekSource(message.source),
	findStep: (message) => stepFind(message.step),
	updateOptionRanges: (message) => updateOptionRanges(message.optionRanges),
	updateOptions: (message) => drawOptions(message.options),
};


/** @param {MessageEvent} e */
export function onMessage(e)
{
	const message = /** @type {GraphMessageToSandbox} */ (e.data);
	const handler = /** @type {(message: GraphMessageToSandbox) => unknown} */ (handlers[message.method]);
	if (handler)
		handler(message);
}


function main()
{
	const mainElement = document.getElementById('main');
	if (!mainElement)
		return;

	mainElement.addEventListener('wheel', onWheel, { passive: false });
	mainElement.addEventListener('pointerdown', onPointerDown);
	mainElement.addEventListener('click', onClickCapture, true);
	mainElement.addEventListener('click', onClickBackground);
	mainElement.addEventListener('dblclick', onDoubleClick);
	mainElement.addEventListener('contextmenu', onContextMenu);
	mainElement.addEventListener('scroll', updateMinimap);
	mainElement.onkeydown = onKeyDown;
	mainElement.onkeyup = onKeyUp;

	const minimap = document.getElementById('minimap');
	if (minimap)
		minimap.addEventListener('pointerdown', onMinimapPointerDown);
	const container = document.getElementById('graphContainer');
	if (container) {
		container.addEventListener('mouseover', onEdgeHover);
		container.addEventListener('mouseout', onEdgeHover);
		container.addEventListener('dragstart', onDragStart);
		container.addEventListener('dragend', () => { container.draggable = false; });
	}

	document.addEventListener('click', (e) => {
		if (!(e.target instanceof Element) || !e.target.closest('#menu'))
			hideMenu();
	}, true);
	window.addEventListener('resize', updateMinimap);

	// Ctrl+C copies the graph's image, except in a text box
	const isText = (/** @type {EventTarget | null} */ target) =>
		target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
	document.addEventListener('focusin', (e) => vscode.postMessage({ method: 'textFocus', on: isText(e.target) }));
	document.addEventListener('focusout', (e) => {
		if (isText(e.target) && !isText(e.relatedTarget))
			vscode.postMessage({ method: 'textFocus', on: false });
	});

	buildToolbar();

	// The tab coming back gives the graph the keys, unless the click that
	// brought it back went to a field (Find, a select): taking the focus from
	// it there broke that click and a double-click's word selection
	window.onfocus = () => setTimeout(() => {
		if (!document.activeElement || document.activeElement === document.body)
			focusOnGraph();
	});
	window.onmessage = onMessage;

	focusOnGraph();

	requestAnimationFrame(smoothScrollLoop);
}


main();
