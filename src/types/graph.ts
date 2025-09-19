import { Option, OptionIntegerRange } from './option';


export type ChangedOption = {
	method: 'changedOption',
	id: string,
	value: boolean | number | string | string[],
};

export type Save = {
	method: 'save',
	content: string,
	path: string,
};

export type GraphMessageFromSandbox = ChangedOption | Save;


export type Convert = {
	method: 'convert',
	extension: 'jpg' | 'png' | 'svg',
	path: string,
};

export type ToggleOptions = {
	method: 'toggleOptions',
};

export type Update = {
	method: 'update',
	options?: Option[],
	optionRanges?: OptionIntegerRange[],
	svg: string,
};

export type GraphMessageToSandbox = Convert | ToggleOptions | Update;
