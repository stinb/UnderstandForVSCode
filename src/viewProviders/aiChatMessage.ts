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

export type AiChatMessage = AddMessageMessage | AddSuggestionsMessage | ClearAllMessage;
