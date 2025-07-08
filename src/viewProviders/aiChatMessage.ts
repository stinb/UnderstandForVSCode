export type AddMessageMessage = {
	method: 'addMessage',
	text: string,
	user: boolean,
};

export type AddSuggestionsMessage = {
	method: 'addSuggestions',
	suggestions: string[],
};

export type ClearAllMessage = {
	method: 'clearAll',
};

export type ClearOneMessage = {
	method: 'clearOne',
};

export type ErrorMessage = {
	method: 'error',
	text: string,
};

export type TextMessage = {
	method: 'text',
	text: string,
};

export type TextEndMessage = {
	method: 'textEnd',
};

export type AiChatMessage = AddMessageMessage | AddSuggestionsMessage | ClearAllMessage | ClearOneMessage | ErrorMessage | TextMessage | TextEndMessage;
