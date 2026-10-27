// @ts-check
// The toolbar, its sections as the GUI's, and its toggles

import { vscode, info } from './state.js';
import { focusOnGraph, graphLabel, toolButton, separator } from './util.js';
import { levelOptionIds, stepLevel, canStepLevel, optionsMenuItems } from './options.js';
import { actionIds, showAllHidden, postAction } from './selection.js';
import { peekOn, setPeekOn } from './peek.js';
import {
	ZOOM_PRESETS, zoom, setZoom, undoStep, canUndo, canRedo, zoomToFit, toggleFit, updateZoomSelect, stepZoom,
	saveGraphState,
} from './view.js';
import { findMatches, appendFindTools } from './find.js';
import { showMenu } from './menus.js';
import { toggleLegend } from './legend.js';
import { toggleMinimap, updateMinimap } from './minimap.js';
import { exportableSvg, copyImage } from './images.js';


// The saved-state list's Remove… entry; no saved state is named so
const REMOVE_SAVED = '\u0000remove';

/** What the extension keeps of the tab: Sync and Reuse, as the GUI window's
 * checkboxes; whether the graph is one of the GUI's Favorites; its saved states */
/** @type {{sync: boolean, reuse: boolean, favorite: boolean, savedNames: string[]}} */
const toolbarState = { sync: false, reuse: false, favorite: false, savedNames: [] };


export function buildToolbar()
{
	const toolbar = document.getElementById('toolbar');
	if (!toolbar)
		return;
	toolbar.innerHTML = '';

	// Variant, as the GUI's styles menu
	const variant = document.createElement('select');
	variant.id = 'variant';
	variant.title = 'Variant';
	variant.hidden = true;
	variant.onchange = () => vscode.postMessage({ method: 'variant', style: variant.value });
	toolbar.appendChild(variant);

	toolbar.appendChild(toolButton('discard', 'Undo', () => undoStep(-1), 'undo'));
	toolbar.appendChild(toolButton('redo', 'Redo', () => undoStep(1), 'redo'));
	toolbar.appendChild(toolButton('refresh', 'Restore Defaults', () => postAction('restoreDefaults'), 'restoreDefaults'));
	toolbar.appendChild(toolButton('chevron-up', 'Increase Level', () => stepLevel(1), 'increaseLevel'));
	toolbar.appendChild(toolButton('chevron-down', 'Decrease Level', () => stepLevel(-1), 'decreaseLevel'));
	toolbar.appendChild(toolButton('link', 'Select a Second Entity…', () => vscode.postMessage({ method: 'relationship' }), 'relationship'));
	toolbar.appendChild(separator());

	// Zoom: presets and fits, as the GUI's zoom menu
	const zoomSelect = document.createElement('select');
	zoomSelect.id = 'zoomSelect';
	zoomSelect.title = 'Zoom';
	for (const preset of ZOOM_PRESETS) {
		const option = document.createElement('option');
		option.value = option.textContent = `${Math.round(preset * 100)}%`;
		zoomSelect.appendChild(option);
	}
	for (const [value, label] of [['width', 'Fit Width'], ['height', 'Fit Height'], ['page', 'Fit Page'], ['other', 'Other…']]) {
		const option = document.createElement('option');
		option.value = value === 'other' ? 'other' : `fit-${value}`;
		option.textContent = label;
		zoomSelect.appendChild(option);
	}
	zoomSelect.value = '100%';
	zoomSelect.onchange = () => {
		const value = zoomSelect.value;
		if (value === 'other') {
			askZoom(zoomSelect);
			return;
		}
		else if (value === 'fit-width' || value === 'fit-height')
			toggleFit(value === 'fit-width' ? 'width' : 'height');
		else if (value === 'fit-page')
			zoomToFit('page');
		else
			setZoom(parseInt(value) / 100);
		updateZoomSelect();
		focusOnGraph();
	};
	toolbar.appendChild(zoomSelect);
	toolbar.appendChild(toolButton('zoom-in', 'Zoom In (Ctrl+=)', () => stepZoom(1, 'action'), 'zoomIn'));
	toolbar.appendChild(toolButton('zoom-out', 'Zoom Out (Ctrl+-)', () => stepZoom(-1, 'action'), 'zoomOut'));
	toolbar.appendChild(separator());

	appendFindTools(toolbar);
	toolbar.appendChild(separator());

	// Nodes
	toolbar.appendChild(toolButton('eye', 'Show All Hidden Nodes', showAllHidden, 'showAllHidden'));
	toolbar.appendChild(toolButton('clear-all', 'Clear All Highlighted Edges', () => postAction('clearHighlights'), 'clearHighlights'));
	toolbar.appendChild(separator());

	// State
	toolbar.appendChild(toolButton('save-as', 'Save Graph State', saveGraphState, 'saveState'));
	const saved = document.createElement('select');
	saved.id = 'savedSelect';
	saved.title = 'Load Graph State';
	saved.onchange = () => {
		const remove = saved.value === REMOVE_SAVED;
		if (remove)
			vscode.postMessage({ method: 'state', action: 'remove' });
		else if (saved.value)
			vscode.postMessage({ method: 'state', action: 'load', name: saved.value });
		saved.value = '';
		// Remove… asks which in a picker, which taking the focus back would close
		if (!remove)
			focusOnGraph();
	};
	toolbar.appendChild(saved);
	toolbar.appendChild(toolButton('copy', 'Copy Image To Clipboard', copyImage, 'copyImage'));
	toolbar.appendChild(toolButton('file-pdf', 'Print… (opens the graph in your browser to print or save as PDF)', () => {
		const svg = exportableSvg({ paper: true });
		if (svg)
			vscode.postMessage({ method: 'print', svg: svg.outerHTML });
	}, 'print'));
	toolbar.appendChild(toolButton('terminal', 'Copy API Command (the Python that draws this graph)',
		() => vscode.postMessage({ method: 'apiCommand' }), 'apiCommand'));
	// A Compare variant's diff pane: the selected node's entity, or the root's
	toolbar.appendChild(toolButton('diff', 'Show Differences (the selected entity, or the graph\'s, against the comparison database)', () => {
		const ids = actionIds();
		vscode.postMessage({ method: 'action', action: 'diff', ids: ids.length === 1 ? ids : [] });
	}, 'diff'));
	toolbar.appendChild(toolButton('star-empty', 'Add to Favorites', () => {
		flip('favorite');
		vscode.postMessage({ method: 'favorite' });
	}, 'favorite'));
	toolbar.appendChild(separator());

	// View
	toolbar.appendChild(toolButton('preview', 'Show Mini-Map', toggleMinimap, 'toggleMinimap'));
	toolbar.appendChild(toolButton('list-unordered', 'Show Legend', () => toggleLegend(), 'toggleLegend'));
	toolbar.appendChild(toolButton('open-preview', 'Peek: show a clicked node\'s source and its Information or AI overview', () => {
		setPeekOn(!peekOn);
		updateToolbar();
	}, 'togglePeek'));
	toolbar.appendChild(toolButton('window', 'Reuse: open the next graph in this tab',
		() => vscode.postMessage({ method: 'reuse', on: flip('reuse') }), 'toggleReuse'));
	toolbar.appendChild(toolButton('sync', 'Sync to the current selection',
		() => vscode.postMessage({ method: 'sync', on: flip('sync') }), 'toggleSync'));
	toolbar.appendChild(toolButton('settings', 'Options', toggleOptions, 'toggleOptions'));

	// The GUI's toolbar sections, which its Toolbar Sections menu hides; a
	// separator goes with the section before it
	/** @type {{[id: string]: string}} */
	const sections = {
		variant: 'style',
		undo: 'edit', redo: 'edit', restoreDefaults: 'edit', increaseLevel: 'edit', decreaseLevel: 'edit',
		relationship: 'edit', showAllHidden: 'edit', clearHighlights: 'edit',
		zoomSelect: 'nav', zoomIn: 'nav', zoomOut: 'nav', find: 'nav', findCase: 'nav', findWords: 'nav', findCount: 'nav', findPrev: 'nav',
		findNext: 'nav', findSelectAll: 'nav', toggleMinimap: 'nav', toggleLegend: 'nav', togglePeek: 'nav',
		saveState: 'archive', savedSelect: 'archive',
		copyImage: 'file', print: 'file', apiCommand: 'file', diff: 'file',
		favorite: 'favorites',
		toggleReuse: 'reuse',
		toggleSync: 'sync',
	};
	let section = '';
	for (const child of Array.from(toolbar.children)) {
		section = sections[child.id] || (child.classList.contains('separator') ? section : '');
		if (section)
			/** @type {HTMLElement} */ (child).dataset.section = section;
	}
	toolbar.oncontextmenu = (e) => {
		if (e.target instanceof Element && e.target.closest('input'))
			return;
		e.preventDefault();
		showMenu([
			...optionsMenuItems(),
			{ separator: true },
			{ label: 'Toolbar Sections', children: toolbarSectionItems },
		], e.clientX, e.clientY);
	};

	updateSavedSelect();
	updateToolbar();
}


/** The GUI's toolbar sections by their bit in its ClusterGraphSettings/toolbars */
const TOOLBAR_SECTIONS = /** @type {const} */ ([
	['style', 0x001, 'Variant'],
	['file', 0x002, 'File'],
	['archive', 0x004, 'Archive'],
	['edit', 0x008, 'Edit'],
	['nav', 0x010, 'Navigation'],
	['favorites', 0x020, 'Favorites'],
	['reuse', 0x040, 'Reuse'],
	['sync', 0x080, 'Sync'],
]);

// Style, File, Edit, Navigation, Sync and the GUI's released windows
const DEFAULT_TOOLBARS = 0x19B;


/**
 * The GUI's Other… zoom, typed in place of the zoom list: Enter (or leaving
 * the field) applies it, Escape cancels. It is asked here rather than in
 * VS Code's input box, which the webview takes the focus back from as the
 * list closes.
 * @param {HTMLSelectElement} zoomSelect
 */
function askZoom(zoomSelect)
{
	const input = document.createElement('input');
	input.type = 'number';
	input.id = 'zoomInput';
	input.dataset.vscodeContext = '{"preventDefaultContextMenuItems":false}';
	input.min = '1';
	input.max = '300';
	input.value = String(Math.round(zoom * 100));
	input.title = 'Zoom percentage (1 to 300): Enter applies, Escape cancels';
	zoomSelect.hidden = true;
	zoomSelect.after(input);
	let done = false;
	const finish = (/** @type {boolean} */ apply) => {
		if (done)
			return;
		done = true;
		const percent = Number(input.value);
		input.remove();
		zoomSelect.hidden = false;
		if (apply && percent >= 1 && percent <= 300)
			setZoom(percent / 100);
		updateZoomSelect();
		focusOnGraph();
	};
	input.onkeydown = (e) => {
		if (e.key === 'Enter' || e.key === 'Escape') {
			e.preventDefault();
			finish(e.key === 'Enter');
		}
	};
	input.onblur = () => finish(true);
	input.focus();
	input.select();
}


/** The Toolbar Sections menu: each section on or off, kept where the GUI keeps it */
function toolbarSectionItems()
{
	const mask = info && info.toolbars !== undefined ? info.toolbars : DEFAULT_TOOLBARS;
	return TOOLBAR_SECTIONS.map(([, bit, label]) => ({
		label,
		checked: !!(mask & bit),
		onClick: () => {
			const next = mask ^ bit;
			if (info)
				info.toolbars = next;
			vscode.postMessage({ method: 'action', action: 'setting', name: 'toolbars', setting: next });
			updateToolbar();
		},
	}));
}


/** Enable and show the toolbar's parts as the graph's info allows */
export function updateToolbar()
{
	const show = (/** @type {string} */ id, /** @type {boolean} */ visible) => {
		const el = document.getElementById(id);
		if (el)
			el.hidden = !visible;
	};
	const enable = (/** @type {string} */ id, /** @type {boolean} */ enabled) => {
		const el = document.getElementById(id);
		if (el instanceof HTMLButtonElement || el instanceof HTMLSelectElement)
			el.disabled = !enabled;
	};
	const interactive = !!(info && info.nodeActions);
	updateUndoButtons();
	show('restoreDefaults', interactive);
	show('showAllHidden', interactive);
	enable('showAllHidden', !!(info && info.hidden && info.hidden.length));
	const showAll = document.getElementById('showAllHidden');
	if (showAll)
		showAll.title = info && info.hidden && info.hidden.length
			? `Show All Hidden Nodes (${info.hidden.length})` : 'Show All Hidden Nodes';
	show('clearHighlights', interactive);
	enable('clearHighlights', !!(info && info.highlights));
	show('saveState', interactive);
	show('savedSelect', interactive);
	show('toggleLegend', !!(info && info.legend && info.legend.length));
	show('increaseLevel', levelOptionIds.length > 0);
	show('decreaseLevel', levelOptionIds.length > 0);
	enable('increaseLevel', canStepLevel(1));
	enable('decreaseLevel', canStepLevel(-1));
	enable('quickIncreaseLevel', canStepLevel(1));
	enable('quickDecreaseLevel', canStepLevel(-1));
	show('relationship', !!(info && info.relationship));
	const relationship = document.getElementById('relationship');
	if (relationship && info && info.relationship)
		relationship.title = info.relationship.name
			? `Second Entity: ${info.relationship.name} (change…)` : 'Select a Second Entity…';
	enable('findSelectAll', findMatches.some(m => m.hasAttribute('data-owner')));
	const favorite = setOn('favorite', toolbarState.favorite);
	if (favorite) {
		favorite.title = toolbarState.favorite ? 'Remove from Favorites' : 'Add to Favorites';
		const icon = favorite.querySelector('.codicon');
		if (icon)
			icon.className = `codicon codicon-${toolbarState.favorite ? 'star-full' : 'star-empty'}`;
	}
	setOn('togglePeek', !!peekOn);

	const variant = document.getElementById('variant');
	if (variant instanceof HTMLSelectElement) {
		const styles = (info && info.styles) || [];
		variant.hidden = styles.length <= 1;
		variant.innerHTML = '';
		for (const style of styles) {
			const option = document.createElement('option');
			option.value = style;
			option.textContent = graphLabel(style);
			variant.appendChild(option);
		}
		if (info && info.style)
			variant.value = info.style;
	}

	show('diff', !!(info && info.compare));
	const mask = info && info.toolbars !== undefined ? info.toolbars : DEFAULT_TOOLBARS;
	for (const [name, bit] of TOOLBAR_SECTIONS)
		for (const element of document.querySelectorAll(`#toolbar [data-section="${name}"]`))
			element.classList.toggle('sectionHidden', !(mask & bit));

	setOn('toggleSync', toolbarState.sync);
	setOn('toggleReuse', toolbarState.reuse);
	const legend = document.getElementById('legend');
	if (legend)
		setOn('toggleLegend', !legend.hidden);
	const minimap = document.getElementById('minimap');
	if (minimap)
		setOn('toggleMinimap', !minimap.hidden);
	setOn('toggleOptions', optionsOpen());
}


/** Show a toggle button on or off; the button, where the toolbar has it */
/** @param {string} id @param {boolean} on */
function setOn(id, on)
{
	const button = document.getElementById(id);
	if (button)
		button.classList.toggle('on', on);
	return button;
}


/**
 * Flip one of the extension's toggles and show it; the new state, to tell
 * the extension
 * @param {'sync' | 'reuse' | 'favorite'} key
 */
function flip(key)
{
	toolbarState[key] = !toolbarState[key];
	updateToolbar();
	return toolbarState[key];
}


export function updateSavedSelect()
{
	const select = document.getElementById('savedSelect');
	if (!(select instanceof HTMLSelectElement))
		return;
	select.innerHTML = '';
	const { savedNames } = toolbarState;
	const placeholder = document.createElement('option');
	placeholder.value = '';
	placeholder.textContent = savedNames.length ? 'Load saved state…' : 'No saved states';
	select.appendChild(placeholder);
	for (const name of savedNames) {
		const option = document.createElement('option');
		option.value = option.textContent = name;
		select.appendChild(option);
	}
	// The GUI's load dialog removes too
	if (savedNames.length) {
		const remove = document.createElement('option');
		remove.value = REMOVE_SAVED;
		remove.textContent = 'Remove…';
		select.appendChild(remove);
	}
	select.disabled = !savedNames.length;
	select.value = '';
	if (info && info.savedName)
		select.title = `Load Graph State (current: ${info.savedName})`;
}


/** Undo and Redo, which a zoom step changes too, without the rest of the
 * toolbar: a zoom step is too frequent to rebuild it all */
export function updateUndoButtons()
{
	for (const [id, on] of /** @type {const} */ ([['undo', canUndo()], ['redo', canRedo()]])) {
		const button = document.getElementById(id);
		if (button instanceof HTMLButtonElement)
			button.disabled = !on;
	}
}


/** The options panel is open unless its width is set to none */
function optionsOpen()
{
	return document.documentElement.style.getPropertyValue('--asideWidth') !== '0rem';
}


export function toggleOptions()
{
	const open = !optionsOpen();
	document.documentElement.style.setProperty('--asideWidth', open ? '20rem' : '0rem');
	setOn('toggleOptions', open);
	updateMinimap();
}


/**
 * What the extension says the toolbar's toggles and saved states are; a key
 * it leaves out is unchanged
 * @param {{sync?: boolean, reuse?: boolean, favorite?: boolean, savedNames?: string[]}} state
 */
export function setToolbarState(state)
{
	for (const key of /** @type {const} */ (['sync', 'reuse', 'favorite', 'savedNames']))
		if (state[key] !== undefined)
			// @ts-ignore each key's value is its own type
			toolbarState[key] = state[key];
	if (state.savedNames)
		updateSavedSelect();
	updateToolbar();
}
