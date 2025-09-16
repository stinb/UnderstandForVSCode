import { Option } from './option';

export type Update = {
	method: 'update',
	options: Option[],
	svg: string,
};

export type GraphMessageToSandbox = Update;
