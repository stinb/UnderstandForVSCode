'use strict';


const vscode = acquireVsCodeApi();


/** @param {FocusEvent} event */
function handleBlur(event)
{
	vscode.postMessage('edit'); // TODO
}


/** @param {PointerEvent} event */
function handleClick(event)
{
	if (!(event.target instanceof HTMLButtonElement))
		return;

	event.preventDefault();
	const rect = event.target.getBoundingClientRect();
	const mouseEventInit = {
		bubbles: true,
		clientX: rect.x,
		clientY: rect.y + rect.height,
	};
	event.target.dispatchEvent(new MouseEvent('contextmenu', mouseEventInit));
	event.stopPropagation();
}


/** @param {KeyboardEvent} event */
function handleKeyDown(event)
{
	if (event.target instanceof HTMLBodyElement) {
		switch (event.code) {
			case 'ArrowDown': {
				const annotation = document.querySelector('.annotation');
				if (annotation)
					annotation.focus();
				break;
			}
			case 'ArrowUp': {
				const annotation = document.querySelector('.annotation:last-child');
				if (annotation)
					annotation.focus();
				break;
			}
		}
	}
	else if ((event.target instanceof HTMLDivElement) && event.target.classList.contains('annotation')) {
		switch (event.code) {
			case 'ArrowDown':
				if (event.target.nextElementSibling)
					event.target.nextElementSibling.focus();
				break;
			case 'ArrowUp':
				if (event.target.previousElementSibling)
					event.target.previousElementSibling.focus();
				break;
			case 'Delete':
				vscode.postMessage('delete'); // TODO
				break;
		}
	}
}


document.body.onclick = handleClick;
document.body.onkeydown = handleKeyDown;

for (const code of document.getElementsByTagName('code'))
	code.onblur = handleBlur;
