// @ts-check
// The server's drawing in the view: the theme's colors, clicks, tooltips and edges that glow

import { cssEscape, NODE_KINDS } from './util.js';
import { onClickNode, onMouseEnterNode, onMouseLeaveNode, onClickEdge, urlSupported } from './clicks.js';


/** The edge whose parts glow under the pointer */
/** @type {string | null} */
let hotEdge = null;

/** Which drawing is in the view, counted up by each one installed, for the
 * mini-map to tell a new drawing from the same one cheaply */
export let drawingNumber = 0;


/** @param {string | null} color */
function isBlack(color)
{
	return color === '#000000' || color === '#000' || color === 'black';
}


/** @param {string | null} color */
function isWhite(color)
{
	return color === '#ffffff' || color === '#fff' || color === 'white';
}


/**
 * Qt's dotted pen, as the GUI draws it: round dots whose spacing grows with
 * the line's width, so a root node's wide dotted border still shows dots
 * @param {Element} line
 * @returns {string} its stroke-dasharray
 */
export function qtDots(line)
{
	const width = parseFloat(line.getAttribute('stroke-width') || '1') || 1;
	return `0.01 ${(1.99 * width).toFixed(2)}`;
}


/**
 * Qt's dashed pen, as the GUI draws it: 5 on, 5 off in units of the line's
 * width, with Qt's square ends, which lengthen each dash by a width (6 on, 4
 * off at 1 px); Graph::Svg writes a plain 5 for it
 * @param {Element} line
 */
export function qtDashes(line)
{
	const width = parseFloat(line.getAttribute('stroke-width') || '1') || 1;
	return `${5 * width} ${5 * width}`;
}

/** What Graph::Svg writes for a dashed pen */
export const SVG_DASHED = '[stroke-dasharray="5"]:not([data-dash])';


/**
 * A wide dotted outline's dots where Qt puts them. Qt's dashing moves the
 * dots on along the outline at each side, by (width - 1) / 4 px, measured
 * against the GUI's 1 px and 3 px outlines (0 and 0.5 px a side); the
 * browser carries them round unmoved. So each side is drawn as its own
 * line, its dots started where Qt's fall, and the polygon keeps its fill,
 * clicks and glow.
 * @param {SVGPolygonElement} outline
 */
function dotSides(outline)
{
	const width = parseFloat(outline.getAttribute('stroke-width') || '1') || 1;
	if (width <= 1)
		return;
	const nums = (outline.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
	const pts = [];
	for (let i = 0; i + 1 < nums.length; i += 2)
		pts.push({ x: nums[i], y: nums[i + 1] });
	if (pts.length < 3 || pts.some(p => isNaN(p.x) || isNaN(p.y)))
		return;
	const period = 2 * width;
	const shift = (width - 1) / 4;
	const ns = 'http://www.w3.org/2000/svg';
	let along = 0;
	for (let k = 0; k + 1 < pts.length; k++) {
		const a = pts[k], b = pts[k + 1];
		const side = document.createElementNS(ns, 'line');
		for (const [name, value] of [['x1', a.x], ['y1', a.y], ['x2', b.x], ['y2', b.y]])
			side.setAttribute(name, String(value));
		for (const name of ['stroke', 'stroke-width', 'stroke-opacity', 'data-stroke', 'data-dash'])
			if (outline.hasAttribute(name))
				side.setAttribute(name, outline.getAttribute(name) || '');
		// Dots at along + shift * (k + 1) + n * period, measured from this side's start
		const phase = ((along - shift * (k + 1)) % period + period) % period;
		side.setAttribute('stroke-dashoffset', phase.toFixed(2));
		side.setAttribute('class', 'dotSide');
		outline.after(side);
		along += Math.hypot(b.x - a.x, b.y - a.y);
	}
	outline.setAttribute('stroke', 'none');
	outline.removeAttribute('data-stroke');
}


/**
 * Put the server's SVG in the view, in the theme's colors, with its nodes
 * clickable and its tooltips shown
 * @param {HTMLElement} container
 * @param {string} svg
 */
export function installSvg(container, svg)
{
	container.innerHTML = svg;
	drawingNumber++;
	hotEdge = null;

	for (const node of container.querySelectorAll('ellipse, line, path, polygon, polyline, rect')) {
		// Fix the ability to hover on and click nodes
		const fill = node.getAttribute('fill');
		if (fill === 'none')
			node.setAttribute('fill', '#0000');
		// Fix the nearly invisible black color to work in any color theme
		else if (isBlack(fill))
			node.setAttribute('fill', 'var(--vscode-foreground)');
		// The light theme's white fill, as the legend already shows it: the
		// editor's background, so a dark theme's light text stays readable
		// on it (the UML sequence diagram's fragments). Marked base, so an
		// export puts the paper's white back.
		else if (isWhite(fill))
			node.setAttribute('data-fill', 'base');
		if (isBlack(node.getAttribute('stroke')))
			node.setAttribute('stroke', 'var(--vscode-foreground)');
	}
	for (const outline of container.querySelectorAll('polygon[data-dash="dot"]'))
		dotSides(/** @type {SVGPolygonElement} */ (outline));
	for (const line of container.querySelectorAll('[data-dash="dot"]'))
		/** @type {SVGElement} */ (line).style.strokeDasharray = qtDots(line);
	for (const line of container.querySelectorAll(SVG_DASHED)) {
		/** @type {SVGElement} */ (line).style.strokeDasharray = qtDashes(line);
		/** @type {SVGElement} */ (line).style.strokeLinecap = 'square';
	}

	// Text keeps the color the server gave it, so the comment and code
	// runs it marks can be styled; only the default black becomes the
	// theme's foreground, as for shapes.
	for (const node of container.querySelectorAll('text')) {
		const fill = node.getAttribute('fill');
		if (fill === null || isBlack(fill))
			node.setAttribute('fill', 'var(--vscode-foreground)');
	}
	for (const node of container.querySelectorAll('tspan[fill]'))
		if (isBlack(node.getAttribute('fill')))
			node.removeAttribute('fill');

	// Add the click handlers
	for (const node of /** @type {NodeListOf<SVGElement>} */ (container.querySelectorAll('svg [href]'))) {
		if (urlSupported(node.getAttribute('href') || '')) {
			node.onclick = onClickNode;
			node.onmouseenter = onMouseEnterNode;
			node.onmouseleave = onMouseLeaveNode;
		}
		else {
			node.removeAttribute('href');
		}
	}
	// A node or cluster without a sync target still selects
	for (const node of container.querySelectorAll(`[data-id]:is(${NODE_KINDS}):not([href])`))
		/** @type {HTMLElement} */ (node).onclick = onClickNode;

	// An edge selects, by a band around its line wider than the line, as
	// the GUI's edges take clicks
	for (const path of container.querySelectorAll('path[data-edge]')) {
		const hit = /** @type {SVGElement} */ (path.cloneNode(false));
		hit.classList.add('edgeHit');
		hit.removeAttribute('data-tip');
		path.parentNode?.insertBefore(hit, path);
	}
	for (const edge of container.querySelectorAll('[data-edge]:not(text)'))
		/** @type {HTMLElement} */ (edge).onclick = onClickEdge;

	// The server's tooltips, as the GUI shows them: a node's long name,
	// an edge's ends, what an edge indicator toggles
	for (const element of container.querySelectorAll('[data-tip]')) {
		const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
		title.textContent = element.getAttribute('data-tip');
		element.appendChild(title);
	}

	// A label lies over its node's outline, so it shows the node's tooltip
	/** @type {Map<string, string>} */
	const tips = new Map();
	for (const node of container.querySelectorAll(`[data-id][data-tip]:is(${NODE_KINDS})`))
		tips.set(node.getAttribute('data-id') || '', node.getAttribute('data-tip') || '');
	for (const label of container.querySelectorAll('text[data-owner]:not([data-tip])')) {
		const tip = tips.get(label.getAttribute('data-owner') || '');
		if (!tip)
			continue;
		const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
		title.textContent = tip;
		label.appendChild(title);
	}
}


/**
 * An edge glows under the pointer, all its parts at once, where the GUI's
 * preference says so
 * @param {MouseEvent} e
 */
export function onEdgeHover(e)
{
	const container = document.getElementById('graphContainer');
	if (!container)
		return;
	const over = e.type === 'mouseover' ? e.target : e.relatedTarget;
	const edge = over instanceof Element && container.contains(over) ? over.closest('[data-edge]') : null;
	const index = edge && document.body.classList.contains('hoverEdges') ? edge.getAttribute('data-edge') : null;
	if (index === hotEdge)
		return;
	for (const part of container.querySelectorAll('.hot'))
		part.classList.remove('hot');
	hotEdge = index;
	if (index !== null)
		for (const part of container.querySelectorAll(`[data-edge="${cssEscape(index)}"]:not(.edgeHit)`))
			part.classList.add('hot');
}
