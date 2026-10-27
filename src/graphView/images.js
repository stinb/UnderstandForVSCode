// @ts-check
// Images of the graph: the SVG in the theme's colors, rasterized at the view's zoom

import { vscode } from './state.js';
import { zoom } from './view.js';
import { qtDots, qtDashes, SVG_DASHED } from './svg.js';


/**
 * The SVG with the theme's colors resolved, for a file or the clipboard
 * @param {{paper?: boolean}} [options] paper: in the light theme's colors,
 * black on white, as the GUI prints (a dark theme's light text fades to
 * nothing on paper)
 */
export function exportableSvg(options = {})
{
	const svgs = document.querySelectorAll('#graphContainer svg');
	if (svgs.length !== 1)
		return undefined;
	/** @ts-ignore @type {SVGSVGElement} */
	const svg = svgs[0].cloneNode(true);

	// The drawing's own size, not the view's zoom of it (sizeSvg)
	for (const side of ['width', 'height']) {
		const drawn = svg.getAttribute(`data-${side}`);
		if (drawn !== null)
			svg.setAttribute(side, drawn);
		svg.removeAttribute(`data-${side}`);
	}

	// Prepare the text to be drawn to the file
	const fill = options.paper ? '#000000' : document.documentElement.style.getPropertyValue('--vscode-foreground');
	for (const text of svg.getElementsByTagName('text'))
		if (text.getAttribute('fill') === 'var(--vscode-foreground)')
			text.setAttribute('fill', fill);
	// Token colors are stylesheet rules, which a file has no access to
	const runs = svg.querySelectorAll('tspan[class]');
	const rules = tokenColors(new Set(Array.from(runs, run => run.getAttribute('class') || '')), !!options.paper);
	for (const run of runs) {
		const style = rules.get(run.getAttribute('class') || '');
		if (style?.fill)
			run.setAttribute('fill', style.fill);
		if (style?.weight)
			run.setAttribute('font-weight', style.weight);
		if (style?.style)
			run.setAttribute('font-style', style.style);
	}
	for (const hit of svg.querySelectorAll('.edgeHit'))
		hit.remove();
	const background = options.paper ? '#ffffff' : document.documentElement.style.getPropertyValue('--vscode-editor-background');
	for (const node of svg.querySelectorAll('[data-fill="base"]'))
		node.setAttribute('fill', background);
	for (const node of svg.querySelectorAll('[data-stroke="base"]'))
		node.setAttribute('stroke', background);
	// Qt's default pen, as the stylesheet draws it; the dots below keep round ends
	for (const node of svg.querySelectorAll('ellipse, line, path, polygon, polyline, rect')) {
		node.setAttribute('stroke-linejoin', 'bevel');
		node.setAttribute('stroke-linecap', 'square');
	}
	for (const node of svg.querySelectorAll('[data-dash="dot"]')) {
		node.setAttribute('stroke-dasharray', qtDots(node));
		node.setAttribute('stroke-linecap', 'round');
		/** @type {SVGElement} */ (node).style.removeProperty('stroke-dasharray');
	}
	for (const node of svg.querySelectorAll(SVG_DASHED)) {
		node.setAttribute('stroke-dasharray', qtDashes(node));
		node.setAttribute('stroke-linecap', 'square');
		/** @type {SVGElement} */ (node).style.removeProperty('stroke-dasharray');
		/** @type {SVGElement} */ (node).style.removeProperty('stroke-linecap');
	}

	// Prepare the theme colors to be drawn to the file
	for (const node of svg.querySelectorAll('ellipse, path, polygon, polyline, rect')) {
		let color = node.getAttribute('fill');
		if (color === 'var(--vscode-foreground)')
			node.setAttribute('fill', fill);
		color = node.getAttribute('stroke');
		if (color === 'var(--vscode-foreground)')
			node.setAttribute('stroke', fill);
		node.classList.remove('selected');
	}
	for (const text of svg.querySelectorAll('.found, .foundCurrent'))
		text.classList.remove('found', 'foundCurrent', 'marked');
	for (const mark of svg.querySelectorAll('rect.findMark'))
		mark.remove();
	return svg;
}


/**
 * The stylesheet's colors, bold and italic for the server's text run
 * classes. For paper the probe sits outside <body>, which the dark themes'
 * rules are scoped to, so the light theme's apply.
 * @param {Set<string>} classes
 * @param {boolean} paper
 */
function tokenColors(classes, paper)
{
	/** @type {Map<string, {fill?: string, weight?: string, style?: string}>} */
	const styles = new Map;
	const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	probe.style.position = 'absolute';
	probe.style.left = '-1000px';
	(paper ? document.documentElement : document.getElementById('graphContainer') || document.body).appendChild(probe);
	for (const cls of classes) {
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
		text.setAttribute('class', cls);
		probe.appendChild(text);
		const computed = getComputedStyle(text);
		const fill = computed.fill;
		styles.set(cls, {
			fill: fill && fill !== 'none' && fill !== 'rgb(0, 0, 0)' ? fill : undefined,
			weight: computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600 ? 'bold' : undefined,
			style: computed.fontStyle === 'italic' ? 'italic' : undefined,
		});
	}
	probe.remove();
	return styles;
}


/**
 * @param {SVGSVGElement} svg
 * @param {'image/jpeg' | 'image/png'} type
 * @returns {Promise<Blob | null>}
 */
async function rasterize(svg, type)
{
	// Create area to draw pixels of SVG
	// At the view's zoom on the view's background, as the GUI's image is,
	// scaled down past its limits: 200 MB of pixels, 32767 on a side
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx)
		return null;
	const width = parseInt(svg.getAttribute('width') || '0');
	const height = parseInt(svg.getAttribute('height') || '0');
	let scale = zoom;
	if (width * height * scale * scale * 4 > 200000000)
		scale = Math.sqrt(200000000 / (width * height * 4));
	if (Math.max(width, height) * scale > 32767)
		scale = 32767 / Math.max(width, height);
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	ctx.fillStyle = document.documentElement.style.getPropertyValue('--vscode-editor-background') || '#ffffff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.scale(scale, scale);

	// Draw the SVG in the canvas
	const xml = new XMLSerializer().serializeToString(svg);
	const svg64 = btoa(unescape(encodeURIComponent(xml)));
	const img64 = 'data:image/svg+xml;base64,' + svg64;
	const img = new Image();
	img.src = img64;
	await img.decode();
	ctx.drawImage(img, 0, 0, width, height);

	// Convert to the image format
	return new Promise(resolve => canvas.toBlob(resolve, type));
}


/**
 * @param {string} path
 * @param {SVGSVGElement} svg
 * @param {'image/jpeg' | 'image/png'} type
 */
export async function saveRaster(path, svg, type)
{
	const blob = await rasterize(svg, type);
	if (!blob)
		return;

	// Convert blob to base 64
	/** @type {string} */
	const content = await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			// @ts-ignore result is a string (https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL)
			resolve(reader.result.split(',')[1]);
		};
		reader.onerror = (error) => reject(error);
		reader.readAsDataURL(blob);
	});

	vscode.postMessage({
		method: 'saveBase64',
		path: path,
		content: content,
	});
}


export async function copyImage()
{
	const svg = exportableSvg();
	if (!svg) {
		vscode.postMessage({ method: 'copied', ok: false, error: 'no graph is drawn' });
		return;
	}
	try {
		const blob = await rasterize(svg, 'image/png');
		if (!blob)
			throw new Error('the image could not be drawn');
		// @ts-ignore ClipboardItem exists in the webview
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
		vscode.postMessage({ method: 'copied', ok: true });
	} catch (error) {
		vscode.postMessage({ method: 'copied', ok: false, error: String(error) });
	}
}
