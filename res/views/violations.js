(function () {
	const vscode = acquireVsCodeApi();

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
}());
