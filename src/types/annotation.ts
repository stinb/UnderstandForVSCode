export type FieldValues = { [key: string]: string | string[] };

// A template as the server describes it: the fields the field editor renders
// and the rules (templateRules.ts) their options follow.
export type TemplateField = {
	key: string,
	label: string,
	type: string,
	required: boolean,
	multiSelect: boolean,
	allowAdd: boolean,
	options?: string[],
	parentField?: string,
	optionsByParent?: { [parentValue: string]: string[] },
	default?: string,
	placeholder?: string,
};

export type AnnotationTemplate = {
	id: string,
	name: string,
	fields: TemplateField[],
};

export type Card = {
	author: string,
	body: string,
	id: string,
	lastModified: string,
	positionCharacter: number,
	positionLine: number,
	positionTitle: string,
	positionUri: string,
	// The template dimension (ext #26): present on structured annotations,
	// with the entered values already rendered for display by the server.
	templateId?: string,
	templateName?: string,
	fields?: { label: string, value: string }[],
	// The values as stored, keyed by field key -- what an editor hands back.
	fieldValues?: FieldValues,
	// The template's Metadata stamp the body opens with, and the note under
	// it, apart: the stamp is read-only, the note is what an edit sends back.
	metadata?: string,
	note?: string,
};

// Where a new annotation goes, in the shape of the request that creates it:
// understand/addAnnotation for a place in a file ('auto' lets the server
// choose the entity under the position, else the line, else the file) or an
// architecture node; the server's ignoreAnnotation command for a violation.
export type FormAnchor =
	| {
		kind: 'auto' | 'line' | 'file' | 'entity',
		textDocument: { uri: string },
		position?: { line: number, character: number },
	}
	| { kind: 'architecture', architecture: string }
	| {
		kind: 'ignore',
		filePath: string,
		violationsToIgnore: { id: string, line: number },
	};

// Open the field editor on an annotation. 'new' renders a draft form that
// becomes an annotation on Create; 'edit' is an existing one, and Save
// updates it.
//
// An existing annotation has two faces, like Understand's card: readOnly is
// the completed card -- title, the fields that hold a value, the note -- and
// the form is a click away; the form saves back into the card. The switch is
// the webview's own; the extension re-posts the message read-only once a
// Save has been taken, or as the form again when the server refused it.
// focusKey names the field a click on the card asked for.
//
// No template is a freeform annotation, and the form is then its note alone.
// An edit shows the note box only when body is handed over.
export type FormMessage = {
	method: 'form',
	mode: 'new' | 'edit',
	id?: string,
	title: string,
	template?: AnnotationTemplate,
	values: FieldValues,
	body?: string,
	readOnly?: boolean,
	focusKey?: string,
	anchor?: FormAnchor,
	// The template's Metadata, read-only under the fields: on a draft what
	// Create will stamp, on an existing annotation the stamp its body opens
	// with. The body is then the note alone.
	metadata?: string,
	// An existing annotation's place, for the line under the template name.
	location?: FormLocation,
	// A draft only: the templates offered for the place, for the Template
	// droplist at the top of the form (template is the one selected), and
	// the Metadata each would stamp, by template id.
	templates?: AnnotationTemplate[],
	metadataByTemplate?: { [templateId: string]: string },
};

// Where an annotation sits: the file and position it is anchored to, and the
// anchor's own name -- an entity, "Line N", an architecture node.
export type FormLocation = {
	uri?: string,
	line?: number,
	character?: number,
	title?: string,
};

export type FormSaveMessage = {
	method: 'formSave',
	mode: 'new' | 'edit',
	id?: string,
	// Absent for a freeform annotation.
	templateId?: string,
	fields: FieldValues,
	body?: string,
	anchor?: FormAnchor,
};

export type FormCancelMessage = {
	method: 'formCancel',
};

// The sandbox's script has loaded and is listening: the field editor window
// posts its form only once this arrives.
export type ReadyMessage = {
	method: 'ready',
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

export type OpenMediaMessage = {
	method: 'openMedia',
	mediaId: string,
	name: string,
};

export type DeleteMessage = {
	method: 'delete',
	id: string,
};

export type DrawAiMessage = {
	method: 'drawAi',
	sections: Section[],
};

export type RevealMessage = {
	method: 'reveal',
	id: string,
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

export type AnnotationMessageFromSandbox = DeleteMessage | ErrorMessage | FinishedEditingMessage | FormCancelMessage | FormSaveMessage | GenerateManyMessage | OpenMediaMessage | OpenMessage | ReadyMessage | RegenerateMessage | StartChatMessage | StartedEditingMessage;
export type AnnotationMessageToSandbox = AiClearMessage | AiErrorMessage | AiTextMessage | AiTextEndMessage | DrawAiMessage | EditMessage | FormMessage | RevealMessage;
