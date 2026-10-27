// @ts-check
// Context menus: the node, edge and graph menus, as the GUI's

import { vscode, info, selected } from './state.js';
import { goToLocation, graphLabel, idsKey, focusOnGraph } from './util.js';
import { optionsMenuItems } from './options.js';
import { nodeIdOf, showAllHidden, selectNode, selectAll, invertSelection, postAction } from './selection.js';
import { filterMenuItems } from './filters.js';
import { undoStep, canUndo, canRedo } from './view.js';


/**
@typedef {import('../types/graph').SelectionAction} SelectionAction
@typedef {import('../types/graph').GraphTarget} GraphTarget
@typedef {import('../types/graph').FilterSuggestion} FilterSuggestion
@typedef {import('../types/graph').EdgeRef} EdgeRef
@typedef {{label?: string, checked?: boolean, disabled?: boolean, separator?: boolean, color?: string, onClick?: (value?: string) => void, children?: MenuItem[] | (() => MenuItem[])}} MenuItem
*/


/** Where the context menu was asked for and for which nodes, until the
 * server says what the node actions can do there. An answer for other nodes
 * is for an earlier right-click, and is dropped. */
/** @type {{x: number, y: number, ids: string} | undefined} */
let pendingMenu = undefined;

/** Where an edge was right-clicked, until the server lists its references */
/** @type {{x: number, y: number, index: number} | undefined} */
let pendingEdgeMenu = undefined;


export function hideMenu()
{
	const menu = document.getElementById('menu');
	if (!menu)
		return;
	menu.hidden = true;
	menu.innerHTML = '';
	pendingMenu = undefined;
	pendingEdgeMenu = undefined;
}


/**
 * @param {MenuItem[]} items
 * @param {number} x
 * @param {number} y
 * @param {HTMLElement} [parent] a submenu's parent list
 */
export function showMenu(items, x, y, parent)
{
	const menu = document.getElementById('menu');
	if (!menu)
		return;
	/** @type {HTMLElement} */
	let list;
	if (parent) {
		for (const old of parent.querySelectorAll(':scope > .submenu'))
			old.remove();
		list = document.createElement('div');
		list.className = 'submenu';
		parent.appendChild(list);
	}
	else {
		menu.innerHTML = '';
		menu.hidden = false;
		list = menu;
	}
	for (const item of items) {
		if (item.separator) {
			const hr = document.createElement('hr');
			list.appendChild(hr);
			continue;
		}
		const row = document.createElement('div');
		row.className = 'item';
		if (item.disabled)
			row.classList.add('disabled');
		const check = document.createElement('span');
		check.className = 'check codicon' + (item.checked ? ' codicon-check' : '');
		row.appendChild(check);
		if (item.color !== undefined) {
			const swatch = document.createElement('span');
			swatch.className = 'swatch';
			swatch.style.background = item.color;
			row.appendChild(swatch);
		}
		const label = document.createElement('span');
		label.className = 'label';
		label.textContent = item.label || '';
		row.appendChild(label);
		// Only the row under the mouse keeps its submenu open
		const closeOthers = () => {
			for (const other of list.querySelectorAll(':scope > .item > .submenu'))
				if (other.parentElement !== row)
					other.remove();
		};
		row.onmouseenter = closeOthers;
		if (item.children) {
			const chevron = document.createElement('span');
			chevron.className = 'codicon codicon-chevron-right';
			row.appendChild(chevron);
			const open = () => {
				const children = typeof item.children === 'function' ? item.children() : item.children || [];
				showMenu(children, 0, 0, row);
			};
			// The pointer coming back into an open flyaway enters this row too;
			// the flyaway stays, rather than being rebuilt under the pointer
			row.onmouseenter = () => {
				closeOthers();
				if (!row.querySelector(':scope > .submenu'))
					open();
			};
			row.onclick = (e) => { e.stopPropagation(); open(); };
		}
		else if (!item.disabled && item.onClick) {
			const onClick = item.onClick;
			// The graph has the keys again (Ctrl+Z after Hide), unless the item
			// focused something of its own, such as a color picker
			row.onclick = (e) => {
				e.stopPropagation();
				onClick();
				hideMenu();
				if (!document.activeElement || document.activeElement === document.body)
					focusOnGraph();
			};
		}
		list.appendChild(row);
	}
	if (!parent) {
		// Keep the menu on the page
		menu.style.left = '0px';
		menu.style.top = '0px';
		const w = menu.offsetWidth || 200;
		const h = menu.offsetHeight || 200;
		menu.style.left = `${Math.max(0, Math.min(x, window.innerWidth - w - 4))}px`;
		menu.style.top = `${Math.max(0, Math.min(y, window.innerHeight - h - 4))}px`;
	}
	else {
		// Fixed beside its row, so a submenu that scrolls does not clip the
		// submenus it opens; on the left when the right has no room
		const row = parent.getBoundingClientRect();
		list.style.position = 'fixed';
		const w = list.offsetWidth;
		const h = list.offsetHeight;
		const left = row.right + w > window.innerWidth - 4 ? row.left - w : row.right;
		list.style.left = `${Math.max(0, left)}px`;
		list.style.top = `${Math.max(0, Math.min(row.top - 5, window.innerHeight - h - 4))}px`;
	}
}


/**
 * A color item: a swatch list of the GUI's usual colors and a picker
 * @param {string} label
 * @param {string | undefined} current
 * @param {(value: string) => void} onPick
 * @param {boolean} inheritable
 * @returns {MenuItem}
 */
export function colorMenuItem(label, current, onPick, inheritable)
{
	const colors = ['#000000', '#ffffff', '#90c4e4', '#396584', '#cc0000', '#ff6600', '#ffcc00', '#009900',
		'#0066cc', '#9900cc', '#808080', '#c0c0c0'];
	return {
		label,
		children: () => {
			/** @type {MenuItem[]} */
			const items = [];
			if (inheritable)
				items.push({ label: 'inherited', checked: !current, onClick: () => onPick('') });
			for (const color of colors)
				items.push({ label: color, color, checked: (current || '').toLowerCase() === color, onClick: () => onPick(color) });
			items.push({ separator: true });
			items.push({
				label: 'Select Color…',
				onClick: () => {
					const input = document.createElement('input');
					input.type = 'color';
					input.value = current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#ffffff';
					input.style.position = 'fixed';
					input.style.left = '-100px';
					document.body.appendChild(input);
					input.onchange = () => { onPick(input.value); input.remove(); };
					input.onblur = () => input.remove();
					input.click();
				},
			});
			return items;
		},
	};
}


/**
 * The menu for the selected nodes, once the server has said what applies:
 * the node's own entity or architecture first, as the GUI's "Entity: name"
 * submenu, then the node actions, the graphic filters it suggests, and the
 * whole-graph items
 * @param {SelectionAction[]} actions
 * @param {string[]} ids
 * @param {GraphTarget} [target]
 * @param {FilterSuggestion[]} [suggestions]
 */
function nodeMenuItems(actions, ids, target, suggestions)
{
	/** @type {MenuItem[]} */
	const items = [];
	const targetItems = target ? targetMenuItems(target) : [];
	if (target && target.label && targetItems.length) {
		items.push({ label: target.label, children: targetItems });
		items.push({ separator: true });
	}
	else if (targetItems.length) {
		items.push(...targetItems);
		items.push({ separator: true });
	}
	// The graph's options, as the GUI's node menu has them under "Graph"
	const options = optionsMenuItems();
	if (options.length)
		items.push({ label: 'Graph', children: options }, { separator: true });
	for (const action of actions)
		items.push({
			label: action.text,
			checked: action.checked,
			disabled: !action.enabled,
			onClick: () => postAction(action.id, ids),
		});
	if (suggestions && suggestions.length) {
		items.push({ separator: true });
		for (const suggestion of suggestions)
			items.push({ label: suggestion.label + '…', onClick: () => vscode.postMessage({ method: 'filter', action: 'suggest', suggestion }) });
	}
	const graph = graphMenuItems();
	if (items.length && graph.length && !items[items.length - 1].separator)
		items.push({ separator: true });
	items.push(...graph);
	while (items.length && items[items.length - 1].separator)
		items.pop();
	return items;
}


/**
 * What the GUI's node menu offers for the node's entity or architecture
 * @param {GraphTarget} target
 * @returns {MenuItem[]}
 */
function targetMenuItems(target)
{
	/** @type {MenuItem[]} */
	const items = [];
	const go = (/** @type {import('../types/graph').GraphLocation} */ loc) => () => goToLocation(loc.path, loc.line, loc.column);
	if (target.source)
		items.push({ label: 'Go To Source', onClick: go(target.source) });
	if (target.definition)
		items.push({ label: 'Go To Definition', onClick: go(target.definition) });
	const decl = target.declaration;
	const def = target.definition;
	if (decl && !(def && def.path === decl.path && def.line === decl.line))
		items.push({ label: 'Go To Declaration', onClick: go(decl) });
	const uniqueName = target.uniqueName;
	// The favorite flag flips here too, so the menu reads right before the
	// next selection brings the server's answer
	const favoriteItem = (/** @type {string} */ root, /** @type {string} */ text) => ({
		label: target.favorite ? 'Remove from Favorites' : 'Add to Favorites',
		onClick: () => {
			target.favorite = !target.favorite;
			vscode.postMessage({ method: 'target', command: 'favorite', uniqueName: root, text });
		},
	});
	if (uniqueName) {
		const post = (/** @type {import('../types/graph').TargetCommand['command']} */ command,
			/** @type {Partial<import('../types/graph').TargetCommand>} */ extra = {}) =>
			() => vscode.postMessage(Object.assign({ method: /** @type {'target'} */ ('target'), command, uniqueName }, extra));
		items.push({ label: 'View Information', onClick: post('info') });
		items.push({ label: 'AI Overview', onClick: post('ai') });
		items.push({ label: 'Generate AI Overview', onClick: post('generateAi') });
		items.push({ label: 'Find References', onClick: post('references') });
		items.push({ label: 'Show Metrics', onClick: post('metrics') });
		items.push({ label: 'Find in Files', onClick: post('findInFiles', { text: target.name || '' }) });
		items.push({ separator: true });
		items.push(favoriteItem(uniqueName, target.name || ''));
		if (target.definition) {
			items.push({ separator: true });
			items.push({ label: 'Annotate…', onClick: post('annotate', { location: target.definition, text: target.name }) });
			items.push({ label: 'Explore in Understand', onClick: post('explore', { location: target.definition }) });
		}
		items.push({ separator: true });
		items.push({ label: 'Copy Name', onClick: post('copyName', { text: target.name || '' }) });
		items.push({ label: 'Copy Full Name', onClick: post('copyLongName', { text: target.longName || '' }) });
	}
	if (target.arch) {
		const arch = target.arch;
		items.push({ label: 'Annotate Architecture…', onClick: () => vscode.postMessage({
			method: 'target', command: 'annotateArch', uniqueName: `arch:${arch}`, text: arch }) });
		items.push(favoriteItem(`arch:${arch}`, arch));
		items.push({ label: 'Copy Name', onClick: () => vscode.postMessage({
			method: 'target', command: 'copyName', uniqueName: `arch:${arch}`, text: arch }) });
	}
	const root = uniqueName || (target.arch ? `arch:${target.arch}` : '');
	if (root && target.graphs && target.graphs.length) {
		items.push({
			label: 'Graphical Views',
			children: target.graphs.map(graphName => ({
				label: graphLabel(graphName),
				onClick: () => vscode.postMessage({ method: 'target', command: 'graph', uniqueName: root, graphName }),
			})),
		});
	}
	return items;
}


/**
 * An edge's references, as the GUI's edge menu lists them; each goes to its
 * place in the code
 * @param {EdgeRef[]} refs
 * @param {number} more
 * @returns {MenuItem[]}
 */
function edgeMenuItems(refs, more)
{
	/** @type {MenuItem[]} */
	const items = [];
	for (const ref of refs) {
		if ('separator' in ref) {
			items.push({ separator: true });
			continue;
		}
		items.push({
			label: ref.text,
			onClick: () => goToLocation(ref.path, ref.line, ref.column),
		});
	}
	if (more > 0)
		items.push({ label: `… ${more} more`, disabled: true });
	return items;
}


/** The whole-graph items, as the graph window's context menu; a graph
 * without node options has only its graphic filters */
function graphMenuItems()
{
	/** @type {MenuItem[]} */
	const items = [];
	if (!info || !info.nodeActions)
		return filterMenuItems();
	const hiddenCount = (info && info.hidden && info.hidden.length) || 0;
	items.push({
		label: hiddenCount ? `Show All Hidden Nodes (${hiddenCount})` : 'Show All Hidden Nodes',
		disabled: !hiddenCount,
		onClick: showAllHidden,
	});
	if (hiddenCount && info && info.hidden) {
		items.push({
			label: 'Show Hidden Node',
			children: info.hidden.map(h => ({ label: h.name.trim() || h.id, onClick: () => postAction('hide', [h.id], false) })),
		});
	}
	items.push({ label: 'Clear All Highlighted Edges', disabled: !(info && info.highlights), onClick: () => postAction('clearHighlights') });
	items.push({
		label: 'Hide Nodes With No Highlighted Edges',
		checked: !!(info && info.hideUnhighlightedNodes),
		onClick: () => postAction('hideUnhighlightedNodes', undefined, !(info && info.hideUnhighlightedNodes)),
	});
	items.push({
		label: 'Hide Unhighlighted Edges',
		checked: !!(info && info.hideUnhighlightedEdges),
		onClick: () => postAction('hideUnhighlightedEdges', undefined, !(info && info.hideUnhighlightedEdges)),
	});
	items.push({ separator: true });
	items.push({ label: 'Inverse Selected Nodes', onClick: invertSelection });
	items.push({ label: 'Select All Nodes', onClick: selectAll });
	items.push({ separator: true });
	items.push({ label: 'Undo', disabled: !canUndo(), onClick: () => undoStep(-1) });
	items.push({ label: 'Redo', disabled: !canRedo(), onClick: () => undoStep(1) });
	items.push({ label: 'Restore Defaults', onClick: () => postAction('restoreDefaults') });
	const filters = filterMenuItems();
	if (filters.length)
		items.push({ separator: true }, ...filters);
	return items;
}


/**
 * The node menu a right-click asked for, once the server answers for its
 * nodes
 * @param {import('../types/graph').UpdateSelection} message
 */
export function showNodeMenu(message)
{
	if (!pendingMenu || pendingMenu.ids !== idsKey(message.ids))
		return;
	const at = pendingMenu;
	pendingMenu = undefined;
	showMenu(nodeMenuItems(message.actions, message.ids, message.target, message.filterSuggestions), at.x, at.y);
}


/**
 * The edge menu a right-click asked for, once the server lists the edge's
 * references; an edge with none gets the graph's menu, as in the GUI
 * @param {import('../types/graph').UpdateEdgeRefs} message
 */
export function showEdgeMenu(message)
{
	if (!pendingEdgeMenu || pendingEdgeMenu.index !== message.index)
		return;
	const at = pendingEdgeMenu;
	pendingEdgeMenu = undefined;
	if (message.refs.length)
		showMenu(edgeMenuItems(message.refs, message.more), at.x, at.y);
	else if (info && info.nodeActions)
		showMenu(graphMenuItems(), at.x, at.y);
}


/** @param {MouseEvent} e */
export function onContextMenu(e)
{
	if (!(e.target instanceof Element))
		return;
	if (e.target.closest('aside') || e.target.closest('input') || e.target.closest('select'))
		return;
	e.preventDefault();
	pendingMenu = undefined;
	pendingEdgeMenu = undefined;

	// An edge lists the references it stands for, as the GUI's edge menu
	const edge = e.target.closest('[data-edge]');
	if (edge) {
		const index = parseInt(edge.getAttribute('data-edge') || '-1');
		pendingEdgeMenu = { x: e.clientX, y: e.clientY, index };
		vscode.postMessage({ method: 'edgeRefs', index });
		return;
	}

	// Every graph's node has its entity's menu, as in the GUI; the server
	// says which node actions apply, where the graph has them
	const id = nodeIdOf(e.target);
	if (id && !selected.has(id))
		selectNode(id, false);
	if (selected.size) {
		const ids = Array.from(selected);
		pendingMenu = { x: e.clientX, y: e.clientY, ids: idsKey(ids) };
		vscode.postMessage({ method: 'selection', ids });
	}
	else {
		// The background: the graph's options, as the GUI's background menu
		// is its options menu, then the graph's own items
		const options = optionsMenuItems();
		const graph = graphMenuItems();
		showMenu(options.length && graph.length ? [...options, { separator: true }, ...graph] : [...options, ...graph],
			e.clientX, e.clientY);
	}
}
