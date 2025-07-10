export type AddMessageMessage = {
	method: 'addMessage',
	text: string,
	user: boolean,
};

export type AddSuggestionsMessage = {
	method: 'addSuggestions',
	suggestions: string[],
};

export type CancelMessage = {
	method: 'cancel',
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

export type SendMessage = {
	method: 'send',
	text: string,
};

export type TextMessage = {
	method: 'text',
	text: string,
};

export type TextEndMessage = {
	method: 'textEnd',
};

export type AiChatMessage = AddMessageMessage | AddSuggestionsMessage | CancelMessage | ClearAllMessage | ClearOneMessage | ErrorMessage | SendMessage | TextMessage | TextEndMessage;
