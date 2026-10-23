// @ts-check
// The selection, and the customizer's node-action buttons that act on it

import { vscode, info, selected, selectedEdges } from './state.js';
import { cssEscape, toolButton, idsKey, NODE_KINDS, nodeElement } from './util.js';
import { hideMenu } from './menus.js';


/**
@typedef {import('../types/graph').SelectionAction} SelectionAction
*/


/** What the node actions can do to the selection, as the server last said,
 * for the customizer's buttons */
/** @type {{key: string, actions: SelectionAction[]} | undefined} */
let selectionActions = undefined;

/** @type {number | undefined} */
let selectionTimer = undefined;


/** The node or cluster an element is part of; a cluster selects and has a
 * menu as a node does, as in the GUI */
/** @param {Element} element @returns {string | undefined} */
export function nodeIdOf(element)
{
	const node = element.closest(`[data-id]:is(${NODE_KINDS})`);
	if (!(node instanceof Element))
		return labelOwnerOf(element);
	return node.getAttribute('data-id') || undefined;
}


/**
 * The node or cluster whose label holds the element: its text is part of
 * the node, as in the GUI, apart from a link to another entity and an edge
 * indicator, which take their own clicks
 * @param {Element} element
 * @param {string} kinds
 * @returns {string | undefined}
 */
export function labelOwnerOf(element, kinds = NODE_KINDS)
{
	if (element.closest('[data-link], [data-opt]'))
		return undefined;
	const owner = element.closest('text[data-owner]')?.getAttribute('data-owner');
	if (!owner)
		return undefined;
	return nodeElement(owner, kinds) ? owner : undefined;
}


export function applySelection()
{
	const container = document.getElementById('graphContainer');
	if (!container)
		return;
	for (const element of container.querySelectorAll('.selected'))
		element.classList.remove('selected');
	// One pass over the graph, not one query per selected node: Ctrl+A on a
	// whole-project graph selects thousands of nodes
	if (selected.size)
		for (const element of container.querySelectorAll('[data-id]'))
			if (selected.has(element.getAttribute('data-id') || ''))
				element.classList.add('selected');
	if (selectedEdges.size)
		for (const element of container.querySelectorAll('[data-edge]:not(text, .edgeHit)'))
			if (selectedEdges.has(element.getAttribute('data-edge') || ''))
				element.classList.add('selected');
	scheduleSelectionState();
}


/** The nodes the node actions act on: the selected nodes and clusters, and
 * the selected edges' tails, as the GUI's customizer takes them */
export function actionIds()
{
	const ids = new Set(selected);
	const container = document.getElementById('graphContainer');
	for (const index of selectedEdges) {
		const tail = container?.querySelector(`[data-edge="${cssEscape(index)}"][data-tail]`)?.getAttribute('data-tail');
		if (tail)
			ids.add(tail);
	}
	return Array.from(ids);
}


/** The GUI customizer's node-action rows: the action, its icon, its label */
const NODE_ACTION_ROWS = /** @type {const} */ ([
	['Visibility:', [
		['hide', 'eye-closed', 'Hide Selected Node(s)'],
		['showAllHidden', 'eye', 'Show All Hidden Nodes'],
		['showEdgesOut', 'arrow-right', 'Show Edges Going Out'],
		['showEdgesIn', 'arrow-left', 'Show Edges Coming In'],
	]],
	['Clusters:', [
		['expandChildren', 'unfold', 'Show Selected Node Children'],
		['showInterEdges', 'git-compare', 'Show Edges Between Children'],
		['aggregateOut', 'merge', 'Aggregate Child Edges Going Out'],
		['aggregateIn', 'git-merge', 'Aggregate Child Edges Coming In'],
	]],
	['Highlighting', [
		['highlightOut', 'arrow-small-right', 'Highlight Edges Going Out'],
		['highlightIn', 'arrow-small-left', 'Highlight Edges Coming In'],
		['highlightPath', 'debug-step-over', 'Highlight Path to Node'],
		['clearHighlights', 'clear-all', 'Clear All Highlighted Edges'],
		['hideUnhighlightedNodes', 'filter', 'Hide Nodes With No Highlighted Edges'],
		['hideUnhighlightedEdges', 'filter-filled', 'Hide Unhighlighted Edges'],
	]],
]);


/**
 * The GUI customizer's node-action buttons, above the options: shown where
 * the graph has the action, enabled and checked for the selection as the
 * server says (the GUI's toolbar does the same), and clicked to set the
 * action on the selection, on when no selected node has it
 */
export function drawNodeActionButtons()
{
	const panel = document.getElementById('nodeActionButtons');
	if (!panel)
		return;
	panel.innerHTML = '';
	if (!info || !info.nodeActions || !info.nodeActions.length)
		return;
	const ids = actionIds();
	const answer = selectionActions && selectionActions.key === idsKey(ids) ? selectionActions.actions : [];
	for (const [heading, buttons] of NODE_ACTION_ROWS) {
		const row = document.createElement('div');
		row.className = 'nodeActionRow';
		row.title = heading;
		for (const [action, icon, label] of buttons) {
			const button = toolButton(icon, label, () => {
				switch (action) {
					case 'showAllHidden':
						showAllHidden();
						return;
					case 'clearHighlights':
						postAction('clearHighlights');
						return;
					case 'hideUnhighlightedNodes':
					case 'hideUnhighlightedEdges':
						postAction(action, undefined, !(info && info[action]));
						return;
					default:
						postAction(action, actionIds());
				}
			});
			const state = answer.find(a => a.id === action);
			let enabled = true, checked = false;
			switch (action) {
				case 'showAllHidden':
					enabled = !!(info.hidden && info.hidden.length);
					break;
				case 'clearHighlights':
					enabled = !!info.highlights;
					break;
				case 'hideUnhighlightedNodes':
				case 'hideUnhighlightedEdges':
					enabled = !!info.highlights;
					checked = !!info[action];
					break;
				default:
					if (!hasNodeAction(action))
						continue;
					enabled = !!(state && state.enabled);
					checked = !!(state && state.checked);
			}
			button.disabled = !enabled;
			button.classList.toggle('on', checked);
			row.appendChild(button);
		}
		// Headed as the GUI's customizer heads them, like the graph's own labels
		if (row.childElementCount) {
			const title = document.createElement('h3');
			title.textContent = heading;
			panel.appendChild(title);
			panel.appendChild(row);
		}
	}
}


/** Show All Hidden Nodes; nodes hidden for having no highlighted edges stay
 * hidden, which the GUI says */
export function showAllHidden()
{
	postAction('showAllHidden');
	if (info && info.hideUnhighlightedNodes)
		vscode.postMessage({
			method: 'notice',
			text: 'Some Nodes May Still be Hidden: although "hidden" status on all nodes has been cleared, there may be nodes '
				+ 'that remain hidden until the "Hide Nodes With No Highlighted Edges" option is disabled',
		});
}


/**
 * The customizer's buttons follow the server's answer for the selection
 * @param {string[]} ids
 * @param {SelectionAction[]} actions
 */
export function updateSelectionActions(ids, actions)
{
	if (idsKey(ids) !== idsKey(actionIds()))
		return;
	selectionActions = { key: idsKey(ids), actions };
	drawNodeActionButtons();
}


/** Ask the server what the node actions can do to the selection, for the
 * customizer's buttons, once the selection settles */
function scheduleSelectionState()
{
	window.clearTimeout(selectionTimer);
	if (!info || !info.nodeActions)
		return;
	selectionTimer = window.setTimeout(() => {
		const ids = actionIds();
		selectionActions = undefined;
		if (ids.length)
			vscode.postMessage({ method: 'selection', ids });
		drawNodeActionButtons();
	}, 120);
}


/** All node ids in the graph */
function allNodeIds()
{
	const container = document.getElementById('graphContainer');
	/** @type {Set<string>} */
	const ids = new Set;
	if (!container)
		return ids;
	for (const element of container.querySelectorAll('[data-id][data-kind="node"]')) {
		const id = element.getAttribute('data-id');
		if (id)
			ids.add(id);
	}
	return ids;
}


/**
 * Select just these nodes and edges
 * @param {Iterable<string>} ids
 * @param {Iterable<string>} [edges]
 */
export function replaceSelection(ids, edges = [])
{
	selected.clear();
	selectedEdges.clear();
	for (const id of ids)
		selected.add(id);
	for (const index of edges)
		selectedEdges.add(index);
	applySelection();
}


/** @param {Set<string>} set @param {string} value */
export function toggle(set, value)
{
	if (!set.delete(value))
		set.add(value);
}


/** @param {string} id @param {boolean} extend */
export function selectNode(id, extend)
{
	if (!extend)
		return replaceSelection([id]);
	toggle(selected, id);
	applySelection();
}


/** Select All Nodes, which adds every node to the selection */
export function selectAll()
{
	for (const id of allNodeIds())
		selected.add(id);
	applySelection();
}


export function invertSelection()
{
	const all = allNodeIds();
	for (const id of all)
		toggle(selected, id);
	for (const id of Array.from(selected))
		if (!all.has(id))
			selected.delete(id);
	applySelection();
}


/** @param {string} action */
export function hasNodeAction(action)
{
	return !!(info && info.nodeActions && info.nodeActions.some(a => a.id === action));
}


/**
 * @param {string} action
 * @param {string[]} [ids]
 * @param {boolean} [value]
 */
export function postAction(action, ids, value)
{
	/** @type {import('../types/graph').NodeAction} */
	const message = { method: 'action', action };
	if (ids !== undefined)
		message.ids = ids;
	if (value !== undefined)
		message.value = value;
	vscode.postMessage(message);
	hideMenu();
}
