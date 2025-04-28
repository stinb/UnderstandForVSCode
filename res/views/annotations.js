'use strict';


/** @param {PointerEvent} e */
function handleClick(e)
{
	if (!e.target || e.target.tagName !== 'BUTTON')
		return;
	e.preventDefault();
	e.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: e.clientX, clientY: e.clientY }));
	e.stopPropagation();
}


/** @param {KeyboardEvent} e */
function handleKeyDown(e)
{
	// console.log(e);
	if (!e.target || !e.target.classList.contains('annotation'))
		return;

	switch (e.key) {
		case 'ArrowUp':
			if (e.target.previousElementSibling)
				e.target.previousElementSibling.focus();
			break;
		case 'ArrowDown':
			if (e.target.nextElementSibling)
				e.target.nextElementSibling.focus();
			break;
	}
}


document.body.onclick = handleClick;
document.body.onkeydown = handleKeyDown;
