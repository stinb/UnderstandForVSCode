// @ts-check
// Small helpers the parts share

import { vscode } from './state.js';


export function focusOnGraph()
{
	const element = document.getElementById('main');
	if (!element)
		return;
	element.focus();
}


/** @param {string} text */
export function cssEscape(text)
{
	return CSS.escape(text);
}


/** What selects and has a menu as a node does: a node or a cluster, as in the GUI */
export const NODE_KINDS = '[data-kind="node"], [data-kind="cluster"]';


/**
 * The outline of the node or cluster with an id, of the kinds given
 * @param {string} id
 * @param {string} [kinds]
 */
export function nodeElement(id, kinds = NODE_KINDS)
{
	const container = document.getElementById('graphContainer');
	return container ? container.querySelector(`[data-id="${cssEscape(id)}"]:is(${kinds})`) : null;
}


/**
 * Show a place in the code. Lines and columns count from 1, as the server
 * gives them.
 * @param {string} path
 * @param {number} line
 * @param {number} column
 */
export function goToLocation(path, line, column)
{
	vscode.postMessage({ method: 'clickedLocation', path, line: Math.max(0, (line || 1) - 1), column: Math.max(0, (column || 1) - 1) });
}


/**
 * A graph's name as Understand shows it: the names are written for Qt's
 * menus, where "&&" is an ampersand and a lone "&" marks the shortcut key
 * @param {string} name
 */
export function graphLabel(name)
{
	return name.replace(/&(&?)/g, '$1');
}


/** The place a loc: URL names @param {URL} url */
export function goToLocUrl(url)
{
	goToLocation(decodeURIComponent(url.pathname), parseInt(url.searchParams.get('line') || ''),
		parseInt(url.searchParams.get('column') || ''));
}


/**
 * @param {string} icon codicon name
 * @param {string} title
 * @param {() => void} onClick
 * @param {string} [id]
 */
export function toolButton(icon, title, onClick, id)
{
	const button = document.createElement('button');
	button.className = 'tool';
	button.title = title;
	button.setAttribute('aria-label', title);
	if (id)
		button.id = id;
	const span = document.createElement('span');
	span.className = `codicon codicon-${icon}`;
	button.appendChild(span);
	button.onclick = (e) => { e.preventDefault(); onClick(); };
	return button;
}


export function separator()
{
	const span = document.createElement('span');
	span.className = 'separator';
	return span;
}


/** The nodes a menu is for, in any order */
/** @param {string[]} ids */
export function idsKey(ids)
{
	return JSON.stringify([...ids].sort());
}
