import { Option, OptionIntegerRange } from './option';


export type ChangedOption = {
	method: 'changedOption',
	id: string,
	value: boolean | number | string | string[],
};

export type ClickedEntity = {
	method: 'clickedEntity',
	id: number,
};

export type ClickedLocation = {
	method: 'clickedLocation',
	path: string,
	line: number,
	column: number,
};

export type SaveBase64 = {
	method: 'saveBase64',
	content: string,
	path: string,
};

export type SaveString = {
	method: 'saveString',
	content: string,
	path: string,
};

export type GraphMessageFromSandbox = ChangedOption | ClickedEntity | ClickedLocation | SaveBase64 | SaveString;


export type Convert = {
	method: 'convert',
	extension: 'jpg' | 'png' | 'svg',
	path: string,
};

export type ToggleOptions = {
	method: 'toggleOptions',
};

export type UpdateGraph = {
	method: 'updateGraph',
	svg: string,
};

export type UpdateOptionRanges = {
	method: 'updateOptionRanges',
	optionRanges: OptionIntegerRange[],
};

export type UpdateOptions = {
	method: 'updateOptions',
	options: Option[],
};

export type GraphMessageToSandbox = Convert | ToggleOptions | UpdateGraph | UpdateOptionRanges | UpdateOptions;
