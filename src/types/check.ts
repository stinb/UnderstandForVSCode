// A CodeCheck check as understand/check describes it: what it is, where it
// sits in the plugin tree, and how each configuration that runs it has set
// its severity and options. Shown read-only in the field editor window as a
// check card, the way an annotation is shown as a card.

export type CheckOption = {
	id: string,
	label: string,
	// checkbox | checkboxes | radio | choice | text | integer | file | directory
	kind: string,
	// The value this configuration uses, and the check's own default.
	value: unknown,
	default: unknown,
	choices: string[],
};

export type CheckConfig = {
	name: string,
	automatic: boolean,
	severity: number,
	options: CheckOption[],
};

export type CheckInfo = {
	id: string,
	name: string,
	longName: string,
	hierarchy: string[],
	defaultSeverity: number,
	// Markdown, with the plugin's own HTML inside it.
	description: string,
	configs: CheckConfig[],
};

// A violation's id is its check's, except a parse error or warning: the
// compiler reports those like violations, and no check is behind them.
export function isCheckId(id: string): boolean
{
	return id !== 'UND_ERROR' && id !== 'UND_WARNING';
}

// Show a check card in the field editor window.
export type CheckMessage = {
	method: 'check',
	title: string,
	check: CheckInfo,
};
