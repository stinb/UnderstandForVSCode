import { Option } from './option';

export type ChangedOption = {
	method: 'changedOption',
	id: string,
	value: boolean | number | string | string[],
};

export type GraphMessageFromSandbox = ChangedOption;

export type Update = {
	method: 'update',
	options: Option[],
	svg: string,
};

export type GraphMessageToSandbox = Update;
