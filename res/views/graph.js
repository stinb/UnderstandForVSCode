// @ts-check
'use strict';


/**
@typedef {import('../../src/types/graph').GraphMessageToSandbox} Message
*/


const MARGIN_PIXELS = 50;

const MOVEMENT_PIXELS = 25;

const ZOOM_FACTOR = 0.875; // ~0 fast, ~1 slow
const ZOOM_FACTOR_INVERSE = 1 / ZOOM_FACTOR;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;


let keys = {
	w: false,
	a: false,
	s: false,
	d: false,
	ArrowUp: false,
	ArrowLeft: false,
	ArrowDown: false,
	ArrowRight: false,
};

let zoom = 1;


/** @param {KeyboardEvent} e */
function onKeyDown(e)
{
	switch (e.key) {
		case 'w': case 'a': case 's': case 'd':
		case 'ArrowUp': case 'ArrowLeft': case 'ArrowDown': case 'ArrowRight':
			keys[e.key] = true;
	}
}


/** @param {KeyboardEvent} e */
function onKeyUp(e)
{
	switch (e.key) {
		case 'w': case 'a': case 's': case 'd':
		case 'ArrowUp': case 'ArrowLeft': case 'ArrowDown': case 'ArrowRight':
			keys[e.key] = false;
	}
}


/** @param {WheelEvent} e */
function onWheel(e)
{
	e.preventDefault();

	const mouseX = e.clientX + window.scrollX;
	const mouseY = e.clientY + window.scrollY;

	const oldZoom = zoom;

	if (e.deltaY > 0)
		zoom *= ZOOM_FACTOR;
	else
		zoom *= ZOOM_FACTOR_INVERSE;

	zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));

	document.body.style.zoom = zoom.toString();

	const scaleChange = zoom / oldZoom;
	const newScrollX = mouseX * scaleChange - e.clientX;
	const newScrollY = mouseY * scaleChange - e.clientY;

	window.scrollTo(newScrollX, newScrollY);
}


/** @param {MessageEvent} e */
function onMessage(e)
{
	const message = /** @type {Message} */ (e.data);

	const loader = document.getElementById('loader');
	if (loader)
		loader.remove();

	let graph = document.getElementById('graph');
	if (!graph) {
		graph = document.createElement('svg');
		document.body.prepend(graph);
	}
	graph.outerHTML = message.svg;
}


function smoothScrollLoop()
{
	let dx = 0;
	let dy = 0;

	if (keys.w || keys.ArrowUp)
		dy -= MOVEMENT_PIXELS;
	if (keys.a || keys.ArrowLeft)
		dx -= MOVEMENT_PIXELS;
	if (keys.s || keys.ArrowDown)
		dy += MOVEMENT_PIXELS;
	if (keys.d || keys.ArrowRight)
		dx += MOVEMENT_PIXELS;

	if (dx !== 0 || dy !== 0)
		window.scrollBy(dx, dy);

	requestAnimationFrame(smoothScrollLoop);
}


document.addEventListener('wheel', onWheel, {passive: false});
document.onkeydown = onKeyDown;
document.onkeyup = onKeyUp;
window.onmessage = onMessage;

requestAnimationFrame(smoothScrollLoop);
