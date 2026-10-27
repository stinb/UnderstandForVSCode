// @ts-check
// The peek: a clicked node's source, as the GUI's peek window shows it

import { vscode } from './state.js';
import { toolButton } from './util.js';
import { placePanel, restorePanel, panelPlaces } from './panels.js';


/** Show a clicked entity's source in the graph, as the GUI's peek window
 * does; starts as the GUI's preference */
/** @type {boolean | undefined} */
export let peekOn = undefined;

/** The node the peek shows, which a second click on closes */
/** @type {string | undefined} */
export let peekNodeId = undefined;


/**
 * The GUI's peek window, for a clicked node: its source, the node's own
 * lines marked. It opens below the pointer, or above it where there is no
 * room, unless it was moved.
 * @param {string} [id] the node, for its source
 * @param {{x: number, y: number}} [at] the pointer
 * @param {string} [uniqueName] the entity a label names, whose definition
 * it shows instead
 */
export function showPeek(id, at, uniqueName)
{
	let peek = document.getElementById('peek');
	if (!peek) {
		peek = document.createElement('div');
		peek.id = 'peek';
		const header = document.createElement('div');
		header.className = 'peekHeader';
		const title = document.createElement('h3');
		title.id = 'peekTitle';
		header.appendChild(title);
		header.appendChild(toolButton('close', 'Close', hidePeek, 'peekClose'));
		peek.appendChild(header);
		const source = document.createElement('pre');
		source.id = 'peekSource';
		peek.appendChild(source);
		document.getElementById('main')?.appendChild(peek);
	}
	peekNodeId = id;
	peek.hidden = false;
	const title = document.getElementById('peekTitle');
	if (title)
		title.textContent = 'Loading…';
	const source = document.getElementById('peekSource');
	if (source)
		source.innerHTML = '';
	if (id || uniqueName)
		vscode.postMessage({ method: 'action', action: 'peekSource', ids: id ? [id] : [], entity: uniqueName });

	const moved = panelPlaces().peek;
	if (moved || !at)
		restorePanel('peek');
	else {
		const width = peek.offsetWidth || 600;
		const height = peek.offsetHeight || 200;
		const below = at.y + 50;
		placePanel(peek, at.x - width / 2, below + height <= window.innerHeight ? below : at.y - 50 - height);
	}
}


/** @param {boolean} on */
export function setPeekOn(on)
{
	peekOn = on;
	if (!on)
		hidePeek();
}


export function hidePeek()
{
	const peek = document.getElementById('peek');
	if (peek)
		peek.hidden = true;
	peekNodeId = undefined;
}


/**
 * The peek's source: the lines of the node's source, its own lines marked;
 * titled with the entity's name, else the file's. An entity without a
 * definition (a pure virtual method) says so.
 * @param {{path?: string, firstLine: number, lines: string[], start: number, end: number,
 *   entityName?: string}} source
 */
export function showPeekSource(source)
{
	const pre = document.getElementById('peekSource');
	const title = document.getElementById('peekTitle');
	if (!pre || !title)
		return;
	if (source.entityName)
		title.textContent = source.entityName;
	else if (source.path)
		title.textContent = source.path.replace(/^.*[\\/]/, '');
	else
		title.textContent = 'No source';
	pre.innerHTML = '';
	if (!source.path) {
		const line = document.createElement('div');
		line.className = 'peekLine';
		line.textContent = source.entityName ? 'No definition' : 'No source for this node';
		pre.appendChild(line);
		return;
	}
	source.lines.forEach((text, i) => {
		const number = source.firstLine + i;
		const line = document.createElement('div');
		line.className = 'peekLine';
		if (number >= source.start && number <= source.end)
			line.classList.add('marked');
		const gutter = document.createElement('span');
		gutter.className = 'peekLineNumber';
		gutter.textContent = String(number);
		line.append(gutter, text.replace(/\r$/, ''));
		pre.appendChild(line);
	});
	const marked = pre.querySelector('.marked');
	if (marked && typeof marked.scrollIntoView === 'function')
		marked.scrollIntoView({ block: 'center' });
	// The peek is as tall as its source; one that opened above the pointer
	// has grown downwards, so keep it inside the view
	const peek = document.getElementById('peek');
	if (peek)
		placePanel(peek, peek.offsetLeft, peek.offsetTop);
}
