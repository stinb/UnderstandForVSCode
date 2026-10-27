// @ts-check
// Graphic filters: their menu items and the Graphic Filter dialog

import { vscode, info } from './state.js';
import { focusOnGraph } from './util.js';
import { hideMenu } from './menus.js';


/**
@typedef {import('./menus.js').MenuItem} MenuItem
@typedef {{text: string, criteria: number, action: number}} Filter
@typedef {{id: number, name: string}} Choice
*/


/** A dialog button, VS Code's primary or secondary */
/** @param {string} label @param {() => void} onClick @param {boolean} [primary] */
function dialogButton(label, onClick, primary = false)
{
	const button = document.createElement('button');
	button.type = 'button';
	button.className = primary ? 'dialogButton primary' : 'dialogButton';
	button.textContent = label;
	button.onclick = onClick;
	return button;
}


/** @param {Choice[]} choices @param {number} id */
function choiceName(choices, id)
{
	return choices.find(c => c.id === id)?.name ?? String(id);
}


function closeFilterDialog()
{
	for (const id of ['filterEditor', 'filterDialog', 'filterBackdrop'])
		document.getElementById(id)?.remove();
	focusOnGraph();
}


/**
 * The GUI's Graphic Filter Editor: one filter's text, criteria and action
 * @param {Filter} filter
 * @param {Choice[]} criteria
 * @param {Choice[]} actions
 * @param {(filter: Filter) => void} onOk
 */
function showFilterEditor(filter, criteria, actions, onOk)
{
	document.getElementById('filterEditor')?.remove();
	const editor = document.createElement('div');
	editor.id = 'filterEditor';
	editor.className = 'dialog';
	editor.setAttribute('role', 'dialog');
	editor.setAttribute('aria-modal', 'true');
	editor.setAttribute('aria-label', 'Graphic Filter Editor');
	const title = document.createElement('h3');
	title.textContent = 'Graphic Filter Editor';
	editor.appendChild(title);

	const form = document.createElement('div');
	form.className = 'filterForm';
	const text = document.createElement('input');
	text.type = 'text';
	text.value = filter.text;
	text.dataset.vscodeContext = '{"preventDefaultContextMenuItems":false}';
	/** @param {Choice[]} choices @param {number} value */
	const select = (choices, value) => {
		const element = document.createElement('select');
		for (const choice of choices)
			element.appendChild(Object.assign(document.createElement('option'), { value: String(choice.id), textContent: choice.name }));
		element.value = String(value);
		return element;
	};
	const criteriaSelect = select(criteria, filter.criteria);
	const actionSelect = select(actions, filter.action);
	for (const [label, control] of /** @type {[string, HTMLElement][]} */ ([
		['Filter Text:', text], ['Filter Criteria:', criteriaSelect], ['Filter Action:', actionSelect]])) {
		const name = document.createElement('span');
		name.textContent = label;
		form.append(name, control);
		control.setAttribute('aria-label', label.slice(0, -1));
	}
	editor.appendChild(form);

	const ok = dialogButton('OK', () => {
		if (!text.value.trim())
			return;
		onOk({ text: text.value.trim(), criteria: parseInt(criteriaSelect.value), action: parseInt(actionSelect.value) });
		editor.remove();
	}, true);
	const updateOk = () => { ok.disabled = !text.value.trim(); };
	text.oninput = updateOk;
	updateOk();
	const buttons = document.createElement('div');
	buttons.className = 'dialogButtons';
	buttons.append(ok, dialogButton('Cancel', () => editor.remove()));
	editor.appendChild(buttons);

	// The editor's own keys; the dialog under it keeps its own
	editor.onkeydown = (e) => {
		e.stopPropagation();
		if (e.key === 'Escape')
			editor.remove();
		else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement))
			ok.click();
	};
	document.body.appendChild(editor);
	text.focus();
	text.select();
}


/**
 * The GUI's Graphic Filter dialog: Enable Project Filters, the project's
 * filters in a table with New, Edit, Remove and Remove All beside it, and OK
 * sets them all, as the dialog's OK does
 */
function showFilterDialog()
{
	hideMenu();
	const filters = info && info.filters;
	if (!filters)
		return;
	closeFilterDialog();

	/** @type {Filter[]} */
	const list = filters.filters.map(f => ({ text: f.text, criteria: f.criteria, action: f.action }));
	let current = -1;

	const backdrop = document.createElement('div');
	backdrop.id = 'filterBackdrop';
	document.body.appendChild(backdrop);

	const dialog = document.createElement('div');
	dialog.id = 'filterDialog';
	dialog.className = 'dialog';
	dialog.setAttribute('role', 'dialog');
	dialog.setAttribute('aria-modal', 'true');
	dialog.setAttribute('aria-label', 'Graphic Filters');
	const title = document.createElement('h3');
	title.textContent = 'Graphic Filters';
	dialog.appendChild(title);

	const enabled = document.createElement('label');
	enabled.className = 'filterEnable';
	const enableBox = document.createElement('input');
	enableBox.type = 'checkbox';
	enableBox.checked = filters.enabled;
	enabled.append(enableBox, 'Enable Project Filters');
	dialog.appendChild(enabled);

	const group = document.createElement('fieldset');
	group.className = 'filterGroup';
	group.appendChild(Object.assign(document.createElement('legend'), { textContent: 'Project Filters' }));
	const tableBox = document.createElement('div');
	tableBox.className = 'filterTableBox';
	const table = document.createElement('table');
	const head = document.createElement('thead');
	const headRow = document.createElement('tr');
	for (const name of ['Filter Name', 'Criteria', 'Action'])
		headRow.appendChild(Object.assign(document.createElement('th'), { textContent: name }));
	head.appendChild(headRow);
	const body = document.createElement('tbody');
	table.append(head, body);
	tableBox.appendChild(table);

	const side = document.createElement('div');
	side.className = 'filterSide';
	const edit = () => {
		if (current < 0)
			return;
		showFilterEditor(list[current], filters.criteria, filters.actions, (changed) => {
			list[current] = changed;
			render();
		});
	};
	const editButton = dialogButton('Edit', edit);
	const removeButton = dialogButton('Remove', () => {
		if (current < 0)
			return;
		list.splice(current, 1);
		current = Math.min(current, list.length - 1);
		render();
	});
	const removeAllButton = dialogButton('Remove All', () => {
		list.length = 0;
		current = -1;
		render();
	});
	const spacer = document.createElement('div');
	spacer.className = 'filterSpacer';
	side.append(dialogButton('New', () => {
		showFilterEditor({ text: '', criteria: filters.criteria[0]?.id ?? 1, action: filters.actions[0]?.id ?? 1 },
			filters.criteria, filters.actions, (added) => {
				list.push(added);
				current = list.length - 1;
				render();
			});
	}), editButton, removeButton, spacer, removeAllButton);

	const content = document.createElement('div');
	content.className = 'filterGroupBody';
	content.append(tableBox, side);
	group.appendChild(content);
	dialog.appendChild(group);

	function render()
	{
		body.innerHTML = '';
		list.forEach((filter, index) => {
			const row = document.createElement('tr');
			row.className = 'filterRow' + (index === current ? ' selected' : '');
			row.setAttribute('aria-selected', String(index === current));
			for (const value of [filter.text, choiceName(filters.criteria, filter.criteria), choiceName(filters.actions, filter.action)])
				row.appendChild(Object.assign(document.createElement('td'), { textContent: value }));
			row.onclick = () => {
				current = index;
				render();
			};
			row.ondblclick = () => {
				current = index;
				render();
				edit();
			};
			body.appendChild(row);
		});
		editButton.disabled = current < 0;
		removeButton.disabled = current < 0;
		removeAllButton.disabled = !list.length;
	}
	render();

	const buttons = document.createElement('div');
	buttons.className = 'dialogButtons';
	buttons.append(dialogButton('OK', () => {
		vscode.postMessage({ method: 'filter', action: 'set', enabled: enableBox.checked, filters: list });
		closeFilterDialog();
	}, true), dialogButton('Cancel', closeFilterDialog));
	dialog.appendChild(buttons);

	dialog.onkeydown = (e) => {
		e.stopPropagation();
		if (e.key === 'Escape')
			closeFilterDialog();
		else if (e.key === 'Delete' && current >= 0)
			removeButton.click();
	};
	document.body.appendChild(dialog);
	enableBox.focus();
}


/** The graphic filters, where the graph uses them, as the GUI's graph menu has them */
/** @returns {MenuItem[]} */
export function filterMenuItems()
{
	if (!info || !info.filters)
		return [];
	const enabled = info.filters.enabled;
	return [
		{
			label: enabled ? 'Disable Graphic Filters' : 'Enable Graphic Filters',
			onClick: () => vscode.postMessage({ method: 'filter', action: 'enable', value: !enabled }),
		},
		{ label: 'Edit Graphic Filters…', onClick: showFilterDialog },
	];
}
