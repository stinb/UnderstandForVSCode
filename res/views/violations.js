(function () {
	const vscode = acquireVsCodeApi();
	const root = document.getElementById('root');

	// ── Rendering ─────────────────────────────────────────────────────────────

	function make(tag, className) {
		const e = document.createElement(tag);
		if (className) e.className = className;
		return e;
	}

	function makeNav(tag, className, uri, line, char) {
		const e = make(tag, className);
		e.dataset.uri = uri;
		e.dataset.line = line;
		e.dataset.char = char;
		return e;
	}

	function render(data) {
		while (root.firstChild) root.removeChild(root.firstChild);

		if (data.type === 'clear') {
			const p = make('p', 'empty');
			p.textContent = data.message;
			root.appendChild(p);
			return;
		}

		for (const v of data.violations) {
			const wrapper = make('div', 'violation');

			wrapper.appendChild(make('div', 'separator'));

			const header = makeNav('div', 'header', v.uri, v.line, v.char);
			const filename = make('span', 'filename');
			filename.textContent = v.fileName;
			filename.dataset.fp = v.filePath;
			const lineno = make('span', 'lineno');
			lineno.textContent = String(v.line + 1);
			header.appendChild(filename);
			header.appendChild(lineno);
			wrapper.appendChild(header);

			const msg = makeNav('div', 'message', v.uri, v.line, v.char);
			msg.textContent = v.message;
			wrapper.appendChild(msg);

			for (const info of v.related) {
				const loc = makeNav('div', 'location', info.uri, info.line, info.char);
				const locMsg = make('span', 'loc-message');
				locMsg.textContent = info.message;
				const locInfo = make('span', 'loc-info');
				locInfo.textContent = `${info.file}  ${info.line + 1}`;
				locInfo.dataset.fp = info.path;
				loc.appendChild(locMsg);
				loc.appendChild(locInfo);
				wrapper.appendChild(loc);
			}

			root.appendChild(wrapper);
		}
	}

	// ── Messages ──────────────────────────────────────────────────────────────

	window.addEventListener('message', event => {
		render(event.data);
	});

	// ── Navigation ────────────────────────────────────────────────────────────

	document.addEventListener('click', function (event) {
		const target = event.target.closest('[data-uri]');
		if (!target)
			return;
		vscode.postMessage({
			type: 'navigate',
			uri: target.dataset.uri,
			line: parseInt(target.dataset.line, 10),
			character: parseInt(target.dataset.char, 10),
		});
	});

	// ── Filepath tooltip ──────────────────────────────────────────────────────

	const tip = document.createElement('div');
	tip.className = 'filepath-tooltip';
	document.body.appendChild(tip);

	document.addEventListener('mouseover', function (event) {
		const el = event.target.closest('[data-fp]');
		if (!el) {
			tip.style.display = 'none';
			return;
		}
		tip.textContent = el.dataset.fp;

		// Measure the tooltip before committing its position
		tip.style.top = '0';
		tip.style.left = '0';
		tip.style.display = 'block';

		const rect = el.getBoundingClientRect();
		const tipW = tip.offsetWidth;
		const tipH = tip.offsetHeight;
		const gap = 4;

		// Flip above the element if it would overflow the bottom of the viewport
		const top = (rect.bottom + gap + tipH > window.innerHeight)
			? rect.top - tipH - gap
			: rect.bottom + gap;

		// Shift left if it would overflow the right edge of the viewport
		const left = Math.max(0, Math.min(rect.left, window.innerWidth - tipW - gap));

		tip.style.top = top + 'px';
		tip.style.left = left + 'px';
	});

	document.addEventListener('mouseout', function (event) {
		const el = event.target.closest('[data-fp]');
		if (el && !el.contains(event.relatedTarget))
			tip.style.display = 'none';
	});

	// ── Ready ─────────────────────────────────────────────────────────────────

	vscode.postMessage({ type: 'ready' });
}());
