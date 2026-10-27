// @ts-check
// The keyboard: shortcuts, and scrolling with the arrow and WASD keys

import { selected } from './state.js';
import { selectAll, hasNodeAction, postAction } from './selection.js';
import { hidePeek } from './peek.js';
import { undoStep } from './view.js';
import { runFind, stepFind } from './find.js';
import { hideMenu } from './menus.js';


const MOVEMENT_PIXELS = 25;

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


/** @param {KeyboardEvent} e */
export function onKeyDown(e)
{
	if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)
		return;
	if (e.ctrlKey || e.metaKey) {
		switch (e.key.toLowerCase()) {
			case 'z':
				e.preventDefault();
				undoStep(e.shiftKey ? 1 : -1);
				return;
			case 'y':
				e.preventDefault();
				undoStep(1);
				return;
			case 'f': {
				// The GUI's Find Next: the find box, and the next match once
				// there is text in it
				e.preventDefault();
				// Ctrl+Shift+F is the extension's findPrevious keybinding
				if (e.shiftKey)
					return;
				const find = document.getElementById('find');
				if (find instanceof HTMLInputElement) {
					if (find.value)
						stepFind(1);
					find.focus();
				}
				return;
			}
			case 'a':
				e.preventDefault();
				selectAll();
				return;
		}
		return;
	}
	switch (e.key) {
		case 'w': case 'a': case 's': case 'd':
		case 'ArrowUp': case 'ArrowLeft': case 'ArrowDown': case 'ArrowRight':
			keys[e.key] = true;
			return;
		case 'Escape': {
			// As the GUI's: menus and the peek close, and find is dismissed;
			// the selection stays
			hideMenu();
			hidePeek();
			const find = document.getElementById('find');
			if (find instanceof HTMLInputElement && find.value) {
				find.value = '';
				runFind('');
			}
			return;
		}
		case 'Delete':
			if (selected.size && hasNodeAction('hide'))
				postAction('hide', Array.from(selected), true);
			return;
	}
}


/** @param {KeyboardEvent} e */
export function onKeyUp(e)
{
	switch (e.key) {
		case 'w': case 'a': case 's': case 'd':
		case 'ArrowUp': case 'ArrowLeft': case 'ArrowDown': case 'ArrowRight':
			keys[e.key] = false;
	}
}


export function smoothScrollLoop()
{
	const element = document.getElementById('main');
	if (!element)
		return;

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
		element.scrollBy(dx, dy);

	requestAnimationFrame(smoothScrollLoop);
}
