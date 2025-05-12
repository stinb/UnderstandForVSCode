type DeleteMessage = {
	method: 'delete',
	id: string,
};

type EditMessage = {
	method: 'edit',
	id: string,
};

type ErrorMessage = {
	method: 'error',
	body: string,
};

type FinishedEditingMessage = {
	method: 'finishedEditing',
	id: string,
	body: string,
};

type RegenerateMessage = {
	method: 'regenerate',
	id: string,
};

type StartedEditingMessage = {
	method: 'startedEditing',
};

type Message = DeleteMessage | EditMessage | ErrorMessage | FinishedEditingMessage | RegenerateMessage | StartedEditingMessage;
