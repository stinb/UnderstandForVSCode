export type OptionCheckbox = {
	id: string,
	kind: 'checkbox',
	text: string,
	value: boolean,
}

export type OptionCheckboxGroup = {
	choices: string[],
	id: string,
	kind: 'horizontalCheckbox' | 'verticalCheckbox',
	text: string,
	value: string[],
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
	minimum: number,
	maximum: number,
	text: string,
	value: number,
}

export type OptionLabel = {
	kind: 'label',
	text: string,
}

export type OptionLayoutBegin = {
	kind: 'horizontalLayoutBegin',
}

export type OptionLayoutEnd = {
	kind: 'horizontalLayoutEnd',
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

export type Option = OptionCheckbox | OptionCheckboxGroup | OptionChoice | OptionInteger | OptionLabel | OptionLayoutBegin | OptionLayoutEnd | OptionSeparator | OptionText;
