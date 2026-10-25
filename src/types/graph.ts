import { Option, OptionIntegerRange } from './option';


// ---- what the server says about an open graph (understand/graphs/drew and
// understand/graphs/info carry it as `info`) ----

export type LegendEntry = {
	shape: 'rectangle' | 'roundedRect' | 'ellipse' | 'arrow' | 'dashArrow' | 'line' | 'dashLine' | 'none' | 'gradient' | 'graphviz' | 'dotArrow' | 'dotLine',
	label: string,
	color: string,
	fill: string,
	row: number,
	col: number,
	tooltip: string,
	editable: boolean,
	stops?: { color: string, value: number }[],
	attrs?: { [key: string]: string },
	id?: string,
	user?: boolean,
	kind?: 'node' | 'edge',
	/** a user style: the entity or reference kind it matches */
	rule?: string,
	/** a user metric color scale */
	metric?: string,
	minColor?: string,
	maxColor?: string,
	name?: string,
};

/** The project's graphic filters, as the GUI's Graphic Filter dialog lists them */
export type GraphFilters = {
	enabled: boolean,
	filters: { text: string, criteria: number, action: number }[],
	criteria: { id: number, name: string }[],
	actions: { id: number, name: string }[],
};

/** A location in a file, with the line 1-based as the server gives it */
export type GraphLocation = { path: string, line: number, column: number };

/** What the GUI's node menu offers for a node's own target */
export type GraphTarget = {
	label?: string,
	uniqueName?: string,
	id?: number,
	name?: string,
	longName?: string,
	arch?: string,
	graphs?: string[],
	source?: GraphLocation,
	definition?: GraphLocation,
	declaration?: GraphLocation,
	/** The entity or architecture is in the project's favorites */
	favorite?: boolean,
};

export type FilterSuggestion = { criteria: number, text: string, label: string };

export type EdgeRef = GraphLocation & { text: string } | { separator: true };

export type GraphThemes = {
	list: { id: string, name: string }[],
	current: string,
	editable: boolean,
	isDefault: boolean,
	canRestoreDefaults: boolean,
	modified: boolean,
	showUnused: boolean,
	globalStyles: { id: string, name: string, enabled: boolean, kind: 'node' | 'edge' }[],
};

export type GraphInfo = {
	style: string,
	styles?: string[],
	savedName: string,
	canUndo: boolean,
	canRedo: boolean,
	legend?: LegendEntry[],
	themes?: GraphThemes,
	nodeActions?: { id: string, text: string }[],
	hidden?: { id: string, name: string }[],
	hideUnhighlightedNodes?: boolean,
	hideUnhighlightedEdges?: boolean,
	highlights?: boolean,
	/** the GUI's preferences: glow an edge under the pointer; show the peek;
	 * the wheel zooms (Ctrl+wheel scrolls), or the reverse */
	highlightEdgesOnHover?: boolean,
	peek?: boolean,
	wheelZoom?: boolean,
	/** what Export To File offers beyond png and jpg */
	exportFormats?: string[],
	/** a relationship graph's second entity, and the kind it must be */
	relationship?: { kind: string, uniqueName: string, name: string },
	filters?: GraphFilters,
	/** the GUI's preferences: animate a redraw; the toolbar's sections (its
	 * bitmask) */
	animateTransitions?: boolean,
	toolbars?: number,
	/** nodes can be moved by hand; the graph opens fitted to the view */
	moveableNodes?: boolean,
	fitInView?: boolean,
	/** the server's undo and redo depths, which the view's zoom steps interleave with */
	undoCount?: number,
	redoCount?: number,
	/** a Compare variant of an entity's graph, which has a diff of the entity */
	compare?: boolean,
	/** the GUI's preferences: after this many seconds a layout waits for View
	 * before it is shown (0 never); the legend shows */
	delayLoadTimeout?: number,
	legendShown?: boolean,
	/** the display's title, as the GUI's window shows it */
	title?: string,
};

/** The peek's source pane: lines of a file from firstLine, start to end marked (1-based),
 * when the node has a place; and its entity's information, when it has one */
export type PeekSource = { path?: string, firstLine: number, lines: string[], start: number, end: number,
	entityName?: string, attributes?: { name: string, value: string }[] };

/** The view a saved graph state keeps, under the GUI's keys */
export type SavedView = {
	graphdisplay_zoom?: number,
	graphdisplay_center_x?: number,
	graphdisplay_center_y?: number,
	graphwindow_radar?: boolean,
	graphdisplay_overview_x?: number,
	graphdisplay_overview_y?: number,
	graphwindow_fitwidth?: boolean,
	graphwindow_fitheight?: boolean,
	graphdisplay_legend_x?: number,
	graphdisplay_legend_y?: number,
	/** The page's: the legend's contents scaled to its resized frame */
	graphdisplay_legend_scale?: number,
};

export type SelectionAction = {
	id: string,
	text: string,
	enabled: boolean,
	checked: boolean,
};


// ---- server -> extension ----

/** Which open graph a notification is about */
export type GraphKey = {
	graphName: string,
	uniqueName: string,
};

export type ParamsDrew = GraphKey & {
	svg: string,
	info?: GraphInfo,
	// Why there is no svg, when the graph can't be drawn
	message?: string,
	// A drawing the client did not ask for (the database changed under the
	// graph): the view stays where it was
	keepView?: boolean,
};

export type ParamsInfo = GraphKey & {
	info: GraphInfo,
};

export type ParamsSelection = GraphKey & {
	ids: string[],
	actions: SelectionAction[],
	target?: GraphTarget,
	filterSuggestions?: FilterSuggestion[],
};

export type ParamsOptions = GraphKey & {
	options: Option[],
};

export type ParamsOptionRanges = GraphKey & {
	optionRanges: OptionIntegerRange[],
};

export type ParamsEdgeRefs = GraphKey & {
	index: number,
	refs: EdgeRef[],
	more: number,
};

export type StyleKinds = {
	node: { name: string, kind: string }[],
	edge: { name: string, kind: string }[],
	metrics: { name: string, id: string }[],
	canMetric: boolean,
	canNode: boolean,
	canEdge: boolean,
	minColor: string,
	maxColor: string,
};

export type RelationCandidate = { name: string, longName: string, uniqueName: string, kind: string };

/** The architectures an entity can be added to, and those that hold it */

export type SavedGraph = {
	name: string,
	graphName: string,
	rootName: string,
	uniqueName: string,
};

/** A graph in the GUI's Favorites, which VS Code shares */
export type FavoriteGraph = {
	list: string,
	/** The favorites list also holds entities and architectures */
	kind?: 'graph' | 'entity' | 'arch',
	graphName: string,
	uniqueName: string,
	rootName: string,
};


// ---- webview -> extension ----

export type ChangedOption = {
	method: 'changedOption',
	id: string,
	value: boolean | number | string | string[],
};

export type ClickedEntity = {
	method: 'clickedEntity',
	id: number,
};

export type ClickedLocation = {
	method: 'clickedLocation',
	path: string,
	line: number,
	column: number,
};

export type ClickedArch = {
	method: 'clickedArch',
	fullName: string,
};

export type SaveBase64 = {
	method: 'saveBase64',
	content: string,
	path: string,
};

/** A node action, or a whole-graph one, as understand/graphs/action takes it */
export type NodeAction = {
	method: 'action',
	action: string,
	ids?: string[],
	value?: boolean,
	/** toggleOption: the node option an edge indicator toggles */
	option?: number,
	/** setting: which setting */
	name?: string,
	/** setting: its value */
	setting?: unknown,
	/** moveNodes: how far the selected nodes moved */
	dx?: number,
	dy?: number,
	/** visit, peekSource: a label's entity link, by unique name, in place of ids */
	entity?: string,
};

/** A legend or theme change, as understand/graphs/legend takes it; the
 * extension fills in what needs a dialog (a name, a path) */
export type LegendAction = {
	method: 'legend',
	action: 'set' | 'theme' | 'newTheme' | 'renameTheme' | 'removeTheme' | 'restoreDefaults' | 'save' | 'export' | 'import' | 'toggleGlobal' | 'removeStyle' | 'showUnused'
		/** the GUI's Add and Edit style dialogs: the extension asks and sends nodeStyle, edgeStyle or metricStyle */
		| 'styleDialog'
		/** the GUI's Save legend as image: the extension asks for the file */
		| 'saveImage',
	/** styleDialog: which kind of style, and the user style being edited */
	styleKind?: 'node' | 'edge' | 'metric',
	entry?: LegendEntry,
	id?: string,
	index?: number,
	key?: string,
	value?: string | boolean,
	enabled?: boolean,
	/** 'theme': the current theme has unsaved edits the switch would drop */
	modified?: boolean,
};

/** Save, load or remove this graph's saved state; the extension asks for
 * the name when none is given */
export type StateAction = {
	method: 'state',
	action: 'save' | 'load' | 'remove',
	name?: string,
	/** save: the view kept with the state */
	view?: SavedView,
};

export type ChangedVariant = {
	method: 'variant',
	style: string,
};

export type ChangedSync = {
	method: 'sync',
	on: boolean,
};

/** The webview wants to know what the node actions would do to these nodes */
export type Selection = {
	method: 'selection',
	ids: string[],
};

export type Copied = {
	method: 'copied',
	ok: boolean,
	error?: string,
};

/** An entity a label names, which a click selects, as in the GUI */
export type ClickedLink = { method: 'clickedLink', uniqueName: string };

/** An edge was right-clicked: the extension asks the server for its references */
export type EdgeMenu = { method: 'edgeRefs', index: number };

/** The node menu's target commands */
export type TargetCommand = {
	method: 'target',
	command: 'info' | 'ai' | 'references' | 'metrics' | 'graph' | 'copyName' | 'copyLongName'
		| 'annotate' | 'annotateArch' | 'explore' | 'generateAi' | 'findInFiles' | 'favorite',
	uniqueName: string,
	graphName?: string,
	/** copy*: the text; annotate: the form's title; annotateArch: the
	 * architecture; findInFiles: the name to search for */
	text?: string,
	/** annotate, explore: the entity's definition */
	location?: GraphLocation,
};

/** Graphic filters: the graph menu's toggle, the Graphic Filter dialog's OK, the node menu's suggestions */
export type FilterAction = {
	method: 'filter',
	action: 'enable' | 'suggest' | 'set',
	value?: boolean,
	suggestion?: FilterSuggestion,
	/** set: the Graphic Filter dialog's OK */
	enabled?: boolean,
	filters?: GraphFilters['filters'],
};

/** The toolbar's star: the extension asks which Favorites group, or what to do with one already in some */
export type Favorite = { method: 'favorite' };
export type ApiCommand = { method: 'apiCommand' };
export type AskRelationship = { method: 'relationship' };
/** Print Graph: a webview cannot print, so the extension opens the graph in the browser to */
export type Print = { method: 'print', svg: string };

/** A text box in the page has the focus, where Ctrl+C copies text, not the graph's image */
export type TextFocus = { method: 'textFocus', on: boolean };
/** A message the GUI shows in a message box */
export type Notice = { method: 'notice', text: string };
/** The tab's Reuse toggle: the next graph opens in this tab */
export type ChangedReuse = { method: 'reuse', on: boolean };

export type GraphMessageFromSandbox = ChangedOption | ClickedEntity | ClickedLocation | ClickedArch | SaveBase64 | NodeAction | LegendAction | StateAction | ChangedVariant | ChangedSync | Selection | Copied
	| ClickedLink | EdgeMenu | TargetCommand | FilterAction | Favorite | ApiCommand | AskRelationship | Print | TextFocus
	| Notice | ChangedReuse;


// ---- extension -> webview ----

/** Export To File's images, which the page draws at its zoom; the server writes the other formats */
export type Convert = {
	method: 'convert',
	extension: 'jpg' | 'png',
	path: string,
};

export type CopyImage = {
	method: 'copyImage',
};

export type ToggleOptions = {
	method: 'toggleOptions',
};

export type UpdateGraph = {
	method: 'updateGraph',
	svg: string,
	info?: GraphInfo,
	message?: string,
	keepView?: boolean,
};

export type UpdateInfo = {
	method: 'updateInfo',
	info: GraphInfo,
};

export type UpdateOptionRanges = {
	method: 'updateOptionRanges',
	optionRanges: OptionIntegerRange[],
};

export type UpdateOptions = {
	method: 'updateOptions',
	options: Option[],
};

export type UpdateSelection = {
	method: 'updateSelection',
	ids: string[],
	actions: SelectionAction[],
	target?: GraphTarget,
	filterSuggestions?: FilterSuggestion[],
};

export type UpdateEdgeRefs = {
	method: 'updateEdgeRefs',
	index: number,
	refs: EdgeRef[],
	more: number,
};

/** The toolbar's toggles and this graph's saved states, as the extension
 * keeps them; a key left out is unchanged */
export type UpdateToolbar = {
	method: 'updateToolbar',
	sync?: boolean,
	reuse?: boolean,
	favorite?: boolean,
	savedNames?: string[],
};
/** A draw began on the server, or was cancelled */
export type Drawing = { method: 'drawing' } | { method: 'aborted' };
/** What VS Code keeps of the tab, to reopen it after a reload */
export type RestoreStateMessage = { method: 'restoreState', state: { graphName: string, uniqueName: string, label: string, savedName: string } };
/** The graph window's shortcuts, which VS Code's keybindings bring */
export type ZoomStep = { method: 'zoomStep', step: number };
export type FindStep = { method: 'findStep', step: number };
export type PeekSourceMessage = { method: 'peekSource', source: PeekSource };
/** A loaded saved state's view */
export type ApplyView = { method: 'applyView', view: SavedView };
/** Select and center a node: a Control Flow graph's node at the editor's cursor */
export type FocusNode = { method: 'focusNode', id: string };
/** Save Graph State from the command, which the page answers with its view */
export type SaveStateRequest = { method: 'saveState' };
/** Undo or redo from the commands */
export type UndoStep = { method: 'undoStep', step: number };

export type GraphMessageToSandbox = Convert | CopyImage | ToggleOptions | UpdateGraph | UpdateInfo | UpdateOptionRanges | UpdateOptions | UpdateSelection | UpdateToolbar
	| UpdateEdgeRefs | Drawing | RestoreStateMessage | ZoomStep | FindStep
	| PeekSourceMessage | ApplyView | FocusNode | SaveStateRequest | UndoStep;


// ---- treemap ----

export type TreemapNode = {
	name: string,
	size?: number,
	color?: number,
	id?: number,
	uniqueName?: string,
	longName?: string,
	arch?: string,
	children?: TreemapNode[],
};

export type TreemapData = {
	tree: TreemapNode,
	sizeMetric: string,
	colorMetric: string,
	metrics: string[],
	entityKind: string,
	entityKinds: string[],
	group: string,
	groups: string[],
	minColor: string,
	maxColor: string,
	logScale: boolean,
};

export type TreemapRequest = {
	sizeMetric?: string,
	colorMetric?: string,
	entityKind?: string,
	group?: string,
};

export type TreemapMessageToSandbox = { method: 'updateTreemap', data: TreemapData };
export type TreemapMessageFromSandbox =
	| { method: 'changedTreemapOptions', options: TreemapRequest }
	| ClickedEntity;
