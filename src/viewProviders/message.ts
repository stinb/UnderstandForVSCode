type AiCard = {
	body: string,
	id: string,
	position: string,
};

type AiSection = {
	name: string,
	cards: AiCard[],
};


type DeleteMessage = {
	method: 'delete',
	id: string,
};

type DrawAiMessage = {
	method: 'drawAi',
	sections: AiSection[],
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

type Message = DeleteMessage | DrawAiMessage | EditMessage | ErrorMessage | FinishedEditingMessage | RegenerateMessage | StartedEditingMessage;
