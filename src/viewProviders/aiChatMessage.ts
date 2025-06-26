export type AddMessageMessage = {
	method: 'addMessage',
	text: string,
	user: boolean,
};

export type AddSuggestionsMessage = {
	method: 'addSuggestions',
	suggestions: string[],
};

export type ClearMessage = {
	method: 'clear',
};

export type FocusMessage = {
	method: 'focus',
};

export type AiChatMessage = AddMessageMessage | AddSuggestionsMessage | ClearMessage | FocusMessage;
