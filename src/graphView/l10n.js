// @ts-check
// The extension's translated strings for this page, read from <body data-l10n>

const l10nTable = (() => { try { return JSON.parse(document.body.dataset.l10n || '{}'); } catch { return {}; } })();

/** @param {string} text @param {...any} args */
export function t(text, ...args) {
	const s = l10nTable[text] || text;
	return s.replace(/\{(\d+)\}/g, (_, i) => String(args[i] ?? ''));
}
