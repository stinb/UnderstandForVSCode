export type OptionCheckbox = {
	id: string,
	kind: 'checkbox',
	text: string,
	value: boolean,
}

export type OptionChoice = {
	choices: string[],
	id: string,
	kind: 'choice' | 'horizontalRadio' | 'verticalRadio',
	text: string,
	value: string,
}

export type OptionInteger = {
	id: string,
	kind: 'integer',
	text: string,
	value: number,
}

export type OptionLabel = {
	kind: 'label',
	text: string,
}

export type OptionSeparator = {
	kind: 'separator',
}

export type OptionText = {
	id: string,
	kind: 'directoryText' | 'fileText' | 'text',
	text: string,
	value: string,
}

// TODO horizontalCheckbox and verticalCheckbox

export type Option = OptionCheckbox | OptionChoice | OptionInteger | OptionLabel | OptionSeparator | OptionText;
