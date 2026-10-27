// @ts-check
// The legend, and its menus that edit the theme's styles

import { vscode, info } from './state.js';
import { toolButton } from './util.js';
import { restorePanel, placePanel, panelEdge, panelScale, setPanelScale } from './panels.js';
import { updateToolbar } from './toolbar.js';
import { showMenu, colorMenuItem } from './menus.js';


/**
@typedef {import('../types/graph').LegendEntry} LegendEntry
@typedef {import('./menus.js').MenuItem} MenuItem
*/


// The legend's choices, as the GUI's legend menus offer them
const GRAPHVIZ_SHAPES = [
	'box3d', 'circle', 'diamond', 'doublecircle', 'doubleoctagon',
	'folder', 'hexagon', 'house', 'invhouse', 'invtrapezium',
	'invtriangle', 'Mcircle', 'Mdiamond', 'Msquare', 'note',
	'octagon', 'oval', 'parallelogram', 'pentagon',
	'box', 'septagon', 'square', 'tab', 'triangle', 'tripleoctagon',
];

const GRAPHVIZ_ARROWS = ['box', 'crow', 'diamond', 'dot', 'inv', 'none', 'normal', 'onormal', 'tee', 'vee'];

const GRAPHVIZ_LINE_STYLES = ['solid', 'dashed', 'dotted'];


/** The legend shows or hides; the user's choice is remembered where the
 * GUI remembers it, a compare graph's apart */
/** @param {boolean} [remember] */
export function toggleLegend(remember = true)
{
	const legend = document.getElementById('legend');
	if (!legend)
		return;
	legend.hidden = !legend.hidden;
	restorePanel('legend');
	updateToolbar();
	if (remember)
		vscode.postMessage({ method: 'action', action: 'setting',
			name: info && info.style.includes('Compare') ? 'compareLegend' : 'legend', setting: !legend.hidden });
}


/** A tab's first legend shows as the GUI last left the legend */
let legendPlaced = false;

/** Where a saved state's view put the legend, when the view came before the
 * first drawing had any legend to show */
/** @type {{x: number, y: number} | undefined} */
let savedLegendPlace = undefined;


/** @param {number} x @param {number} y */
export function holdLegendPlace(x, y)
{
	savedLegendPlace = { x, y };
}


export function placeFirstLegend()
{
	const legend = document.getElementById('legend');
	if (legendPlaced || !legend || !info || !info.legend || !info.legend.length)
		return;
	legendPlaced = true;
	if (savedLegendPlace) {
		// The saved state's legend, not the user's last choice
		if (legend.hidden)
			toggleLegend(false);
		placePanel(legend, savedLegendPlace.x, savedLegendPlace.y);
		savedLegendPlace = undefined;
		return;
	}
	if (legend.hidden === !!info.legendShown)
		toggleLegend(false);
}


/**
 * A small picture of a legend entry
 * @param {LegendEntry} entry
 */
function legendSwatch(entry)
{
	const ns = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(ns, 'svg');
	svg.setAttribute('width', '36');
	svg.setAttribute('height', '18');
	svg.setAttribute('class', 'swatch');
	const color = entry.color || 'var(--vscode-foreground)';
	const attrs = entry.attrs || {};
	let fill = entry.fill || attrs.fillcolor || 'none';
	if (fill === '#ffffff' || fill === 'white')
		fill = 'var(--vscode-editor-background)';
	const dash = (/** @type {Element} */ el, /** @type {string} */ kind) => {
		if (kind === 'dash' || (attrs.style || '').includes('dashed'))
			el.setAttribute('stroke-dasharray', '4 3');
		else if (kind === 'dot' || (attrs.style || '').includes('dotted'))
			el.setAttribute('stroke-dasharray', '1 3');
	};
	const line = (/** @type {boolean} */ arrow, /** @type {string} */ kind) => {
		const l = document.createElementNS(ns, 'line');
		l.setAttribute('x1', '2'); l.setAttribute('y1', '9');
		l.setAttribute('x2', arrow ? '26' : '34'); l.setAttribute('y2', '9');
		l.setAttribute('stroke', color);
		l.setAttribute('stroke-width', attrs.penwidth || '1.5');
		dash(l, kind);
		svg.appendChild(l);
		if (arrow) {
			const head = document.createElementNS(ns, 'polygon');
			head.setAttribute('points', '26,4 34,9 26,14');
			head.setAttribute('fill', (attrs.arrowhead || 'normal').startsWith('o') ? 'none' : color);
			head.setAttribute('stroke', color);
			svg.appendChild(head);
		}
	};
	// A styler's entries all come as 'graphviz'; its edge styles draw as
	// edges, with the arrow head and line style of their attributes
	const shape = entry.shape === 'graphviz' && entry.kind === 'edge'
		? ((attrs.arrowhead || 'normal') === 'none' ? 'line' : 'arrow')
		: entry.shape;
	switch (shape) {
		case 'arrow': line(true, ''); break;
		case 'dashArrow': line(true, 'dash'); break;
		case 'dotArrow': line(true, 'dot'); break;
		case 'line': line(false, ''); break;
		case 'dashLine': line(false, 'dash'); break;
		case 'dotLine': line(false, 'dot'); break;
		case 'gradient': {
			const defs = document.createElementNS(ns, 'defs');
			const grad = document.createElementNS(ns, 'linearGradient');
			grad.id = 'grad' + Math.random().toString(36).slice(2);
			for (const stop of entry.stops || []) {
				const s = document.createElementNS(ns, 'stop');
				s.setAttribute('offset', `${Math.round(stop.value * 100)}%`);
				s.setAttribute('stop-color', stop.color);
				grad.appendChild(s);
			}
			defs.appendChild(grad);
			svg.appendChild(defs);
			const r = document.createElementNS(ns, 'rect');
			r.setAttribute('x', '1'); r.setAttribute('y', '3'); r.setAttribute('width', '34'); r.setAttribute('height', '12');
			r.setAttribute('fill', `url(#${grad.id})`);
			svg.appendChild(r);
			break;
		}
		case 'none':
			break;
		case 'ellipse': {
			const el = document.createElementNS(ns, 'ellipse');
			el.setAttribute('cx', '18'); el.setAttribute('cy', '9'); el.setAttribute('rx', '16'); el.setAttribute('ry', '7');
			el.setAttribute('fill', fill); el.setAttribute('stroke', color);
			dash(el, '');
			svg.appendChild(el);
			break;
		}
		default: {
			const shape = attrs.shape || '';
			if (entry.shape === 'graphviz' && /circle|ellipse|oval|point/.test(shape)) {
				const el = document.createElementNS(ns, 'ellipse');
				el.setAttribute('cx', '18'); el.setAttribute('cy', '9'); el.setAttribute('rx', '16'); el.setAttribute('ry', '7');
				el.setAttribute('fill', fill); el.setAttribute('stroke', color);
				dash(el, '');
				svg.appendChild(el);
			}
			else if (entry.shape === 'graphviz' && /diamond/.test(shape)) {
				const el = document.createElementNS(ns, 'polygon');
				el.setAttribute('points', '18,1 34,9 18,17 2,9');
				el.setAttribute('fill', fill); el.setAttribute('stroke', color);
				dash(el, '');
				svg.appendChild(el);
			}
			else {
				const r = document.createElementNS(ns, 'rect');
				r.setAttribute('x', '2'); r.setAttribute('y', '2'); r.setAttribute('width', '32'); r.setAttribute('height', '14');
				if (entry.shape === 'roundedRect')
					r.setAttribute('rx', '4');
				r.setAttribute('fill', fill); r.setAttribute('stroke', color);
				dash(r, '');
				svg.appendChild(r);
			}
		}
	}
	return svg;
}


export function drawLegend()
{
	const legend = document.getElementById('legend');
	if (!legend)
		return;
	legend.innerHTML = '';
	if (!info || !info.legend || !info.legend.length) {
		legend.hidden = true;
		updateToolbar();
		return;
	}
	const header = document.createElement('div');
	header.className = 'legendHeader';
	const title = document.createElement('h3');
	// Unsaved changes to the theme, as the GUI's legend title shows them
	title.textContent = info.themes && info.themes.modified ? 'Legend*' : 'Legend';
	header.appendChild(title);
	const menuButton = toolButton('menu', 'Legend menu', () => {
		const rect = menuButton.getBoundingClientRect();
		showMenu(legendMenuItems(), rect.left, rect.bottom);
	}, 'legendMenu');
	header.appendChild(menuButton);
	legend.appendChild(header);

	// Themes, when there is a choice
	const themes = info.themes;
	if (themes && themes.list.length > 1) {
		const select = document.createElement('select');
		select.id = 'themeSelect';
		select.title = 'Theme';
		for (const theme of themes.list) {
			const option = document.createElement('option');
			option.value = theme.id;
			option.textContent = theme.name;
			select.appendChild(option);
		}
		select.value = themes.current;
		select.onchange = () => vscode.postMessage({ method: 'legend', action: 'theme', id: select.value, modified: themes.modified });
		legend.appendChild(select);
	}

	// Entries by column, as the GUI lays them out: its columns, or, when the
	// server gives every entry the same one, edges beside nodes
	const columns = new Map();
	const oneColumn = info.legend.every(e => e.col === info.legend[0].col);
	info.legend.forEach((entry, index) => {
		const col = oneColumn ? (entry.kind === 'edge' ? 0 : 1) : entry.col;
		if (!columns.has(col))
			columns.set(col, []);
		columns.get(col).push({ entry, index });
	});
	const table = document.createElement('div');
	table.className = 'legendColumns';
	for (const col of Array.from(columns.keys()).sort((a, b) => a - b)) {
		const column = document.createElement('div');
		column.className = 'legendColumn';
		const rows = columns.get(col).sort((/** @type {any} */ a, /** @type {any} */ b) => a.entry.row - b.entry.row);
		for (const { entry, index } of rows) {
			const row = document.createElement('div');
			row.className = 'legendEntry';
			row.dataset.index = String(index);
			row.title = entry.tooltip || entry.label;
			row.appendChild(legendSwatch(entry));
			const label = document.createElement('span');
			label.textContent = entry.label;
			row.appendChild(label);
			if (entry.editable && themes && themes.editable) {
				row.classList.add('editable');
				row.oncontextmenu = (e) => {
					e.preventDefault();
					e.stopPropagation();
					showMenu(legendEntryMenuItems(entry, index).concat([{ separator: true }], legendMenuItems()), e.clientX, e.clientY);
				};
			}
			column.appendChild(row);
		}
		table.appendChild(column);
	}
	legend.appendChild(table);

	// Everything in one box that scales when the frame is resized
	const content = document.createElement('div');
	content.className = 'panelContent';
	content.append(...Array.from(legend.childNodes));
	legend.appendChild(content);
	setPanelScale(legend, panelScale(legend));
	if (!legend.dataset.resizable) {
		legend.dataset.resizable = 'true';
		// The border under the pointer, for its resize cursor
		legend.addEventListener('pointermove', (e) => {
			legend.dataset.edge = panelEdge(legend, e.clientX, e.clientY);
		});
	}
	updateToolbar();
}


/**
 * The menu of one legend entry: its shape, colors, arrows and line style,
 * as the GUI's legend offers them
 * @param {LegendEntry} entry
 * @param {number} index
 * @returns {MenuItem[]}
 */
function legendEntryMenuItems(entry, index)
{
	const attrs = entry.attrs || {};
	const set = (/** @type {string} */ key) => (/** @type {string} */ value) =>
		vscode.postMessage({ method: 'legend', action: 'set', index, key, value });
	const choice = (/** @type {string} */ label, /** @type {string} */ key, /** @type {string[]} */ values) => ({
		label,
		children: () => [
			{ label: 'inherited', checked: !attrs[key], onClick: () => set(key)('') },
			...values.map(v => ({ label: v, checked: attrs[key] === v, onClick: () => set(key)(v) })),
		],
	});
	/** @type {MenuItem[]} */
	const items = [];
	if (entry.kind === 'edge') {
		items.push(choice('Arrow Head', 'arrowhead', GRAPHVIZ_ARROWS));
		if (attrs.dir === 'both')
			items.push(choice('Arrow Tail', 'arrowtail', GRAPHVIZ_ARROWS));
		items.push(colorMenuItem('Color', attrs.color, set('color'), true));
		items.push(choice('Line Style', 'style', GRAPHVIZ_LINE_STYLES));
	}
	else {
		items.push(choice('Shape', 'shape', GRAPHVIZ_SHAPES));
		items.push(colorMenuItem('Line Color', attrs.color, set('color'), true));
		items.push(colorMenuItem('Fill Color', attrs.fillcolor, set('fillcolor'), true));
	}
	if (entry.user && entry.id) {
		const id = entry.id;
		const styleKind = entry.metric ? 'metric' : entry.kind === 'edge' ? 'edge' : 'node';
		items.push({ separator: true });
		items.push({ label: 'Edit…', onClick: () => vscode.postMessage({ method: 'legend', action: 'styleDialog', styleKind, entry }) });
		items.push({ label: 'Delete Style', onClick: () => vscode.postMessage({ method: 'legend', action: 'removeStyle', id }) });
	}
	return items;
}


/** The legend's own menu: themes, defaults, import and export, what to show */
/** @returns {MenuItem[]} */
function legendMenuItems()
{
	const themes = info && info.themes;
	/** @type {MenuItem[]} */
	const items = [];
	if (!info)
		return items;
	const post = (/** @type {import('../types/graph').LegendAction} */ m) => () => vscode.postMessage(m);
	const currentName = themes ? (themes.list.find(t => t.id === themes.current) || { name: themes.current }).name : '';
	if (themes && themes.editable) {
		/** @type {MenuItem[]} */
		const themeItems = themes.list.map(t => ({
			label: t.name,
			checked: t.id === themes.current,
			onClick: post({ method: 'legend', action: 'theme', id: t.id, modified: themes.modified }),
		}));
		themeItems.push({ separator: true });
		themeItems.push({ label: 'New Theme…', onClick: post({ method: 'legend', action: 'newTheme', value: `Copy of ${currentName}` }) });
		if (themes.isDefault)
			themeItems.push({ label: `Restore Defaults for ${currentName}`, disabled: !themes.canRestoreDefaults, onClick: post({ method: 'legend', action: 'restoreDefaults' }) });
		else {
			themeItems.push({ label: `Rename ${currentName}…`, onClick: post({ method: 'legend', action: 'renameTheme', value: currentName }) });
			themeItems.push({ label: `Remove ${currentName}`, onClick: post({ method: 'legend', action: 'removeTheme' }) });
		}
		themeItems.push({ label: `Export ${currentName}…`, onClick: post({ method: 'legend', action: 'export' }) });
		if (themes.modified)
			themeItems.push({ label: `Save ${currentName}`, onClick: post({ method: 'legend', action: 'save' }) });
		themeItems.push({ label: 'Import Themes…', onClick: post({ method: 'legend', action: 'import' }) });
		items.push({ label: 'Theme', children: themeItems });
		items.push({ label: 'Show Unused Styles', checked: themes.showUnused, onClick: post({ method: 'legend', action: 'showUnused', value: !themes.showUnused }) });
		for (const kind of /** @type {const} */ (['node', 'edge'])) {
			const globals = themes.globalStyles.filter(g => g.kind === kind);
			if (!globals.length)
				continue;
			items.push({
				label: kind === 'node' ? 'Global Node Styles' : 'Global Edge Styles',
				children: globals.map(g => ({
					label: g.name,
					checked: g.enabled,
					onClick: post({ method: 'legend', action: 'toggleGlobal', id: g.id, enabled: !g.enabled }),
				})),
			});
		}
		items.push({ separator: true });
		// A metric color scale needs Export & Share Reports/Metrics
		if (themes.metricScale !== false)
			items.push({ label: 'Add Metric Color Scale…', onClick: post({ method: 'legend', action: 'styleDialog', styleKind: 'metric' }) });
		items.push({ label: 'Add Node Style…', onClick: post({ method: 'legend', action: 'styleDialog', styleKind: 'node' }) });
		items.push({ label: 'Add Edge Style…', onClick: post({ method: 'legend', action: 'styleDialog', styleKind: 'edge' }) });
	}
	// Any legend, as in the GUI, not only one whose styles can be edited
	if (info.legend && info.legend.length) {
		if (items.length)
			items.push({ separator: true });
		items.push({ label: 'Save Legend as Image…', onClick: post({ method: 'legend', action: 'saveImage' }) });
	}
	items.push({ label: 'Hide Legend', onClick: () => toggleLegend() });
	return items;
}
