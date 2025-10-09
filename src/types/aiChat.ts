export type CancelMessage = {
	method: 'cancel',
};

export type SaveFileMessage = {
	method: 'saveFile',
	content: string,
	path: string,
};

export type SendMessage = {
	method: 'send',
	text: string,
};

export type AiChatMessageFromSandbox = CancelMessage | SaveFileMessage | SendMessage;


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

export type CopyAllMessage = {
	method: 'copyAll',
};

export type ErrorMessage = {
	method: 'error',
	text: string,
};

export type SaveAsMarkdownMessage = {
	method: 'saveAsMarkdown',
	path: string,
};

export type TextMessage = {
	method: 'text',
	text: string,
};

export type TextEndMessage = {
	method: 'textEnd',
};

export type AiChatMessageToSandbox = AddMessageMessage | AddSuggestionsMessage | ClearAllMessage | ClearOneMessage | CopyAllMessage | ErrorMessage | SaveAsMarkdownMessage | TextMessage | TextEndMessage;
