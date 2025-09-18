import { Option, OptionIntegerRange } from './option';


export type ChangedOption = {
	method: 'changedOption',
	id: string,
	value: boolean | number | string | string[],
};

export type GraphMessageFromSandbox = ChangedOption;


export type Update = {
	method: 'update',
	options?: Option[],
	optionRanges?: OptionIntegerRange[],
	svg: string,
};

export type GraphMessageToSandbox = Update;
