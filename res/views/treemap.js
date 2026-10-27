// @ts-check
'use strict';

/**
@typedef {import('../../src/types/graph').TreemapData} TreemapData
@typedef {import('../../src/types/graph').TreemapNode} TreemapNode
@typedef {import('../../src/types/graph').TreemapMessageToSandbox} TreemapMessageToSandbox
@typedef {import('../../src/types/graph').TreemapMessageFromSandbox} TreemapMessageFromSandbox
*/

/** @type {{ postMessage: (message: TreemapMessageFromSandbox) => void }} */
// @ts-ignore
const vscode = acquireVsCodeApi();

const MIN_LABEL_WIDTH = 40;
const MIN_LABEL_HEIGHT = 14;
const GROUP_HEADER = 16;
const PADDING = 2;

/** @type {TreemapData | undefined} */
let data = undefined;

/** The group drilled into, as a path of child indexes from the root */
/** @type {number[]} */
let path = [];

/** The lowest and highest color metric values of the whole tree */
/** @type {{min: number, max: number} | undefined} */
let colorRange = undefined;


/**
 * Squarified treemap layout (Bruls, Huizing, van Wijk). Lays `items` out
 * in the rectangle, returning one rectangle per item in the same order.
 * @param {number[]} sizes
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @returns {{x: number, y: number, w: number, h: number}[]}
 */
function squarify(sizes, rect)
{
	const total = sizes.reduce((a, b) => a + b, 0);
	/** @type {{x: number, y: number, w: number, h: number}[]} */
	const out = sizes.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
	if (total <= 0 || rect.w <= 0 || rect.h <= 0)
		return out;
	const scale = (rect.w * rect.h) / total;
	const order = sizes.map((s, i) => i).sort((a, b) => sizes[b] - sizes[a]);
	let x = rect.x, y = rect.y, w = rect.w, h = rect.h;
	/** @type {number[]} */
	let row = [];
	let rowArea = 0;

	const worst = (areas, side) => {
		if (!areas.length)
			return Infinity;
		const sum = areas.reduce((a, b) => a + b, 0);
		const { min, max } = rangeOf(areas);
		const s2 = sum * sum, side2 = side * side;
		return Math.max((side2 * max) / s2, s2 / (side2 * min));
	};

	const layoutRow = () => {
		const side = Math.min(w, h);
		const length = side > 0 ? rowArea / side : 0;
		let offset = 0;
		for (const i of row) {
			const area = sizes[i] * scale;
			const extent = length > 0 ? area / length : 0;
			if (w >= h) {
				out[i] = { x, y: y + offset, w: length, h: extent };
			} else {
				out[i] = { x: x + offset, y, w: extent, h: length };
			}
			offset += extent;
		}
		if (w >= h) { x += length; w -= length; }
		else { y += length; h -= length; }
		row = [];
		rowArea = 0;
	};

	for (const i of order) {
		const area = sizes[i] * scale;
		if (area <= 0)
			continue;
		const side = Math.min(w, h);
		const current = row.map(j => sizes[j] * scale);
		if (row.length && worst(current, side) < worst([...current, area], side))
			layoutRow();
		row.push(i);
		rowArea += area;
	}
	if (row.length)
		layoutRow();
	return out;
}


/** @param {TreemapNode} node @returns {number} */
function sizeOf(node)
{
	if (node.children)
		return node.children.reduce((a, c) => a + sizeOf(c), 0);
	return Math.max(0, node.size || 0);
}


/** @param {TreemapNode} node @param {number[]} out */
function colorsOf(node, out)
{
	if (node.children)
		for (const c of node.children)
			colorsOf(c, out);
	else if (node.color !== undefined)
		out.push(node.color);
}


/** Math.min and Math.max over an array too long to spread into arguments */
/** @param {number[]} values */
function rangeOf(values)
{
	let min = Infinity, max = -Infinity;
	for (const v of values) {
		if (v < min)
			min = v;
		if (v > max)
			max = v;
	}
	return { min, max };
}


/**
 * @param {string} tag
 * @param {{[name: string]: string | number}} [attrs]
 * @returns {SVGElement}
 */
function svgEl(tag, attrs = {})
{
	const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (const [name, value] of Object.entries(attrs))
		element.setAttribute(name, String(value));
	return element;
}


/** @param {string} hex @returns {[number, number, number]} */
function rgb(hex)
{
	const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!m)
		return [128, 128, 128];
	return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}


/** @param {number} t 0..1 @param {string} min @param {string} max */
function lerpColor(t, min, max)
{
	const a = rgb(min), b = rgb(max);
	const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
	return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}


/** @returns {TreemapNode | undefined} */
function currentRoot()
{
	if (!data)
		return undefined;
	let node = data.tree;
	for (const i of path) {
		if (!node.children || !node.children[i])
			break;
		node = node.children[i];
	}
	return node;
}


function drawCrumbs()
{
	const crumbs = document.getElementById('crumbs');
	if (!crumbs || !data)
		return;
	crumbs.innerHTML = '';
	let node = data.tree;
	const addCrumb = (/** @type {string} */ label, /** @type {number[]} */ to) => {
		const button = document.createElement('button');
		button.className = 'crumb';
		button.textContent = label;
		button.onclick = () => { path = to; render(); };
		crumbs.appendChild(button);
	};
	addCrumb(data.group || 'Project', []);
	for (let d = 0; d < path.length; d++) {
		if (!node.children || !node.children[path[d]])
			break;
		node = node.children[path[d]];
		const sep = document.createElement('span');
		sep.className = 'codicon codicon-chevron-right';
		crumbs.appendChild(sep);
		addCrumb(node.name, path.slice(0, d + 1));
	}
	const title = document.createElement('span');
	title.className = 'metrics';
	title.textContent = `size: ${data.sizeMetric}, color: ${data.colorMetric}`;
	crumbs.appendChild(title);
}


function render()
{
	const main = document.getElementById('main');
	const root = currentRoot();
	if (!main || !data || !root)
		return;
	drawCrumbs();
	main.innerHTML = '';

	const width = main.clientWidth || 800;
	const height = main.clientHeight || 600;
	const svg = svgEl('svg', { width, height });
	main.appendChild(svg);

	const minColor = colorRange ? colorRange.min : 0;
	let maxColor = colorRange ? colorRange.max : 1;
	if (maxColor <= minColor)
		maxColor = minColor + 1;
	const { minColor: lowColor, maxColor: highColor, sizeMetric, colorMetric } = data;

	const sizeValue = (/** @type {number} */ s) => data && data.logScale ? Math.log(1 + s) : s;

	/**
	 * @param {TreemapNode} node
	 * @param {{x: number, y: number, w: number, h: number}} rect
	 * @param {number[]} nodePath
	 */
	const draw = (node, rect, nodePath) => {
		if (!node.children) {
			const t = (Math.max(minColor, Math.min(maxColor, node.color || 0)) - minColor) / (maxColor - minColor);
			const g = svgEl('g', { class: 'leaf' });
			const r = svgEl('rect', {
				x: rect.x + PADDING / 2,
				y: rect.y + PADDING / 2,
				width: Math.max(0, rect.w - PADDING),
				height: Math.max(0, rect.h - PADDING),
				fill: lerpColor(t, lowColor, highColor),
			});
			if (node.id !== undefined)
				r.dataset.id = String(node.id);
			g.appendChild(r);
			const title = svgEl('title');
			title.textContent = `${node.longName || node.name}\n${sizeMetric}: ${node.size}\n${colorMetric}: ${node.color}`;
			g.appendChild(title);
			if (rect.w >= MIN_LABEL_WIDTH && rect.h >= MIN_LABEL_HEIGHT) {
				const clipId = 'clip' + nodePath.join('_');
				const clip = svgEl('clipPath', { id: clipId });
				clip.appendChild(svgEl('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h }));
				g.appendChild(clip);
				const text = svgEl('text', {
					x: rect.x + 4, y: rect.y + 12, fill: t > 0.55 ? '#ffffff' : '#000000', 'clip-path': `url(#${clipId})` });
				text.textContent = node.name;
				g.appendChild(text);
			}
			g.onclick = () => {
				if (node.id !== undefined)
					vscode.postMessage({ method: 'clickedEntity', id: node.id });
			};
			svg.appendChild(g);
			return;
		}
		// A group: a header to drill into, its children squarified below
		const g = svgEl('g', { class: 'group' });
		g.appendChild(svgEl('rect', { x: rect.x, y: rect.y, width: Math.max(0, rect.w), height: Math.max(0, rect.h) }));
		const showHeader = nodePath.length > path.length && rect.h > GROUP_HEADER * 2 && rect.w >= MIN_LABEL_WIDTH;
		if (showHeader) {
			const text = svgEl('text', { x: rect.x + 4, y: rect.y + 12, class: 'groupLabel' });
			text.textContent = node.name;
			g.appendChild(text);
			const title = svgEl('title');
			title.textContent = `${node.arch || node.name}\n${sizeMetric}: ${sizeOf(node)}`;
			g.appendChild(title);
			text.onclick = (e) => { e.stopPropagation(); path = nodePath; render(); };
		}
		svg.appendChild(g);
		const inner = showHeader
			? { x: rect.x + PADDING, y: rect.y + GROUP_HEADER, w: rect.w - 2 * PADDING, h: rect.h - GROUP_HEADER - PADDING }
			: rect;
		const children = node.children.filter(c => sizeOf(c) > 0);
		const rects = squarify(children.map(c => sizeValue(sizeOf(c))), inner);
		children.forEach((child, i) => {
			const index = node.children ? node.children.indexOf(child) : i;
			draw(child, rects[i], [...nodePath, index]);
		});
	};

	draw(root, { x: 0, y: 0, w: width, h: height }, path);
}


function drawOptions()
{
	const aside = document.getElementById('options');
	if (!aside || !data)
		return;
	aside.innerHTML = '';
	const select = (/** @type {string} */ label, /** @type {string[]} */ choices, /** @type {string} */ value, /** @type {(v: string) => void} */ onChange) => {
		const wrap = document.createElement('label');
		const p = document.createElement('p');
		p.textContent = label;
		wrap.appendChild(p);
		const sel = document.createElement('select');
		for (const choice of choices) {
			const o = document.createElement('option');
			o.textContent = choice;
			sel.appendChild(o);
		}
		sel.value = value;
		sel.onchange = () => onChange(sel.value);
		wrap.appendChild(sel);
		aside.appendChild(wrap);
	};
	select('Size Metric', data.metrics, data.sizeMetric, v => vscode.postMessage({ method: 'changedTreemapOptions', options: { sizeMetric: v } }));
	select('Color Metric', data.metrics, data.colorMetric, v => vscode.postMessage({ method: 'changedTreemapOptions', options: { colorMetric: v } }));
	select('Entities', data.entityKinds, data.entityKind, v => vscode.postMessage({ method: 'changedTreemapOptions', options: { entityKind: v } }));
	select('Group By', data.groups, data.group, v => vscode.postMessage({ method: 'changedTreemapOptions', options: { group: v } }));

	const legend = document.createElement('div');
	legend.className = 'scale';
	const bar = document.createElement('div');
	bar.className = 'bar';
	bar.style.background = `linear-gradient(to right, ${data.minColor}, ${data.maxColor})`;
	legend.appendChild(bar);
	const labels = document.createElement('div');
	labels.className = 'labels';
	labels.textContent = colorRange ? `${colorRange.min} … ${colorRange.max}` : '';
	legend.appendChild(labels);
	aside.appendChild(legend);
}


/** @param {MessageEvent} e */
function onMessage(e)
{
	const message = /** @type {TreemapMessageToSandbox} */ (e.data);
	if (message.method !== 'updateTreemap')
		return;
	const sameTree = data && data.group === message.data.group && data.entityKind === message.data.entityKind;
	data = message.data;
	if (!sameTree)
		path = [];
	/** @type {number[]} */
	const colors = [];
	colorsOf(data.tree, colors);
	colorRange = colors.length ? rangeOf(colors) : undefined;
	drawOptions();
	render();
}


window.onmessage = onMessage;
window.onresize = render;
