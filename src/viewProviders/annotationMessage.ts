export type Card = {
	author: string,
	body: string,
	id: string,
	lastModified: string,
	positionCharacter: number,
	positionLine: number,
	positionTitle: string,
	positionUri: string,
};

export type Section = {
	name: string,
	cards: Card[],
};

export type AiClearMessage = {
	method: 'aiClear',
	uniqueName: string,
};

export type AiErrorMessage = {
	method: 'aiError',
	uniqueName: string,
	text: string,
};

export type AiTextMessage = {
	method: 'aiText',
	uniqueName: string,
	text: string,
};

export type AiTextEndMessage = {
	method: 'aiTextEnd',
	uniqueName: string,
};

export type DeleteMessage = {
	method: 'delete',
	id: string,
};

export type DrawAiMessage = {
	method: 'drawAi',
	sections: Section[],
};

export type EditMessage = {
	method: 'edit',
	id: string,
};

export type ErrorMessage = {
	method: 'error',
	body: string,
};

export type FinishedEditingMessage = {
	method: 'finishedEditing',
	id: string,
	body: string,
};

export type GenerateManyMessage = {
	method: 'generateMany',
	uniqueNames: string[],
};

export type OpenMessage = {
	method: 'open',
	character: number,
	line: number,
	uri: string,
};

export type RegenerateMessage = {
	method: 'regenerate',
	uniqueName: string,
};

export type StartChatMessage = {
	method: 'startChat',
	name: string,
	uniqueName: string,
};

export type StartedEditingMessage = {
	method: 'startedEditing',
};

export type AnnotationMessage = AiClearMessage | AiErrorMessage | AiTextMessage | AiTextEndMessage | DeleteMessage | DrawAiMessage | EditMessage | ErrorMessage | FinishedEditingMessage | GenerateManyMessage | OpenMessage | RegenerateMessage | StartChatMessage | StartedEditingMessage;
