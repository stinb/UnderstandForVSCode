type Cancel = {
	method: 'cancel',
};

type Edit = {
	method: 'edit',
	index: number,
};

type Regenerate = {
	method: 'regenerate',
};

type SaveFile = {
	method: 'saveFile',
	content: string,
	path: string,
};

type Send = {
	method: 'send',
	text: string,
};

export type AiChatMessageFromSandbox = Cancel | Edit | Regenerate | SaveFile | Send;


type AddMessage = {
	method: 'addMessage',
	text: string,
	user: boolean,
};

type AddSuggestions = {
	method: 'addSuggestions',
	suggestions: string[],
};

type CopyAll = {
	method: 'copyAll',
};

type ClearOne = {
	method: 'clearOne',
};

type DeleteAll = {
	method: 'deleteAll',
};

type Error = {
	method: 'error',
	text: string,
};

type SaveAsMarkdown = {
	method: 'saveAsMarkdown',
	path: string,
};

type Text = {
	method: 'text',
	text: string,
};

type TextEnd = {
	method: 'textEnd',
};

export type AiChatMessageToSandbox = AddMessage | AddSuggestions | CopyAll | DeleteAll | ClearOne | Edit | Error | SaveAsMarkdown | Text | TextEnd;
