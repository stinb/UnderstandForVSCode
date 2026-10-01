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
	// The configuration card this check was opened from, when it was: the
	// card offers a way back to it.
	from?: string,
};

// A CodeCheck configuration as understand/configurations lists it, for the
// picker in front of the configuration card.
export type ConfigurationSummary = {
	name: string,
	automatic: boolean,
	checkCount: number,
	excludes: string[],
};

// One check as a configuration runs it, as understand/configuration lists it.
export type ConfigurationCheck = {
	id: string,
	name: string,
	hierarchy: string[],
	severity: number,
	defaultSeverity: number,
	options: CheckOption[],
};

// A CodeCheck configuration as understand/configuration describes it: the
// checks it runs with the severity and options it sets. Shown read-only in
// the field editor window as a configuration card, the way a check is.
export type ConfigurationInfo = {
	name: string,
	automatic: boolean,
	excludes: string[],
	checks: ConfigurationCheck[],
};

// Show a configuration card in the field editor window.
export type ConfigurationMessage = {
	method: 'configuration',
	title: string,
	configuration: ConfigurationInfo,
};

// A card's link to a check: the configuration card's check rows.
export type ShowCheckMessage = {
	method: 'showCheck',
	id: string,
	from?: string,
};

// A card's link to a configuration: the check card's "Runs in" titles.
export type ShowConfigurationMessage = {
	method: 'showConfiguration',
	name: string,
};
