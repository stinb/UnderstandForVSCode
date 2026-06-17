(function () {
	const vscode = acquireVsCodeApi();
	const root = document.getElementById('root');

	// Collapse/expand state must survive re-renders (the view rebuilds whenever
	// diagnostics change), otherwise clicks appear to "undo themselves".
	// Files are collapsed by default, so we track the ones the user opened.
	const expandedFiles = new Set();       // file paths the user expanded
	const expandedViolations = new Set();  // violation keys whose steps are open

	function violationKey(uri, line, char) {
		return uri + '#' + line + ':' + char;
	}

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

		// Group violations under one header per file, so the number shown on a
		// file is the count of its violations (not a line number repeated per row).
		const groups = [];
		const byPath = new Map();
		for (const v of data.violations) {
			let group = byPath.get(v.filePath);
			if (!group) {
				group = { fileName: v.fileName, filePath: v.filePath, items: [] };
				byPath.set(v.filePath, group);
				groups.push(group);
			}
			group.items.push(v);
		}

		// Summary header: "<n> FILES" with the total violation count as a badge
		const summary = make('div', 'summary');
		const summaryFiles = make('span', 'summary-files');
		summaryFiles.textContent = `${groups.length} FILE${groups.length === 1 ? '' : 'S'}`;
		const summaryCount = make('span', 'summary-count');
		summaryCount.textContent = String(data.violations.length);
		summaryCount.title = `${data.violations.length} violation${data.violations.length === 1 ? '' : 's'}`;
		summary.appendChild(summaryFiles);
		summary.appendChild(summaryCount);
		root.appendChild(summary);

		for (const group of groups) {
			// The file header is a twistie that collapses all of its violations
			// (collapsed by default; expand state is remembered across renders).
			const fileCollapsed = !expandedFiles.has(group.filePath);
			const header = make('div', 'file-header toggle');
			header.dataset.path = group.filePath;
			if (fileCollapsed) header.classList.add('collapsed');
			header.appendChild(make('span', 'chevron'));
			const filename = make('span', 'filename');
			filename.textContent = group.fileName;
			filename.dataset.fp = group.filePath;
			const fileCount = make('span', 'file-count');
			fileCount.textContent = String(group.items.length);
			fileCount.title = `${group.items.length} violation${group.items.length === 1 ? '' : 's'}`;
			header.appendChild(filename);
			header.appendChild(fileCount);
			root.appendChild(header);

			const fileGroup = make('div', 'file-group');
			if (fileCollapsed) fileGroup.classList.add('collapsed');
			for (const v of group.items) {
				const wrapper = make('div', 'violation');

				const hasSteps = v.related.length > 0;
				const stepsOpen = expandedViolations.has(violationKey(v.uri, v.line, v.char));

				// With steps, the message row is a twistie that expands them
				// (collapsed by default; remembered across renders); the line
				// number still navigates.
				const msg = make('div', 'message');
				msg.dataset.uri = v.uri;
				msg.dataset.line = v.line;
				msg.dataset.char = v.char;
				if (hasSteps) {
					msg.classList.add('toggle');
					if (!stepsOpen) msg.classList.add('collapsed');
					msg.appendChild(make('span', 'chevron'));
				}
				const msgText = make('span', 'message-text');
				msgText.textContent = v.message;
				msg.appendChild(msgText);

				const lineno = make('span', 'lineno');
				lineno.textContent = String(v.line + 1);
				lineno.title = `Line ${v.line + 1}`;
				msg.appendChild(lineno);

				if (hasSteps) {
					const count = make('span', 'step-count');
					count.textContent = String(v.related.length);
					count.title = `${v.related.length} visit location${v.related.length === 1 ? '' : 's'}`;
					msg.appendChild(count);
				}
				wrapper.appendChild(msg);

				if (hasSteps) {
					const locations = make('div', 'locations');
					if (!stepsOpen) locations.classList.add('collapsed');
					for (const info of v.related) {
						const loc = makeNav('div', 'location', info.uri, info.line, info.char);
						const locMsg = make('span', 'loc-message');
						locMsg.textContent = info.message;
						const locInfo = make('span', 'loc-info');
						locInfo.textContent = `${info.file}  ${info.line + 1}`;
						locInfo.dataset.fp = info.path;
						loc.appendChild(locMsg);
						loc.appendChild(locInfo);
						locations.appendChild(loc);
					}
					wrapper.appendChild(locations);
				}

				fileGroup.appendChild(wrapper);
			}
			root.appendChild(fileGroup);
		}
	}

	// ── Messages ──────────────────────────────────────────────────────────────

	window.addEventListener('message', event => {
		render(event.data);
	});

	// ── Navigation ────────────────────────────────────────────────────────────

	function navigate(el) {
		vscode.postMessage({
			type: 'navigate',
			uri: el.dataset.uri,
			line: parseInt(el.dataset.line, 10),
			character: parseInt(el.dataset.char, 10),
		});
	}

	document.addEventListener('click', function (event) {
		// Clicking a file header collapses/expands all of its violations
		const fileHeader = event.target.closest('.file-header');
		if (fileHeader) {
			const nowCollapsed = fileHeader.classList.toggle('collapsed');
			const fileGroup = fileHeader.nextElementSibling;
			if (fileGroup && fileGroup.classList.contains('file-group'))
				fileGroup.classList.toggle('collapsed');
			const path = fileHeader.dataset.path;
			if (path) {
				if (nowCollapsed) expandedFiles.delete(path);
				else expandedFiles.add(path);
			}
			return;
		}

		// Clicking a violation row toggles its steps AND jumps to its line
		const toggle = event.target.closest('.message.toggle');
		if (toggle) {
			const nowCollapsed = toggle.classList.toggle('collapsed');
			const locations = toggle.nextElementSibling;
			if (locations && locations.classList.contains('locations'))
				locations.classList.toggle('collapsed');
			const key = violationKey(toggle.dataset.uri, toggle.dataset.line, toggle.dataset.char);
			if (nowCollapsed) expandedViolations.delete(key);
			else expandedViolations.add(key);
			if (toggle.dataset.uri)
				navigate(toggle);
			return;
		}

		// A step row (or a no-step violation message) just navigates
		const target = event.target.closest('[data-uri]');
		if (target)
			navigate(target);
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
