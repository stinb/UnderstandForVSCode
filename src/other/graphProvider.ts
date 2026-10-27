import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import * as vscode from 'vscode';

import { escapeHtml } from './html';
import { variables } from './variables';
import {
	FilterAction, GraphFilters, GraphInfo, GraphKey, GraphMessageFromSandbox, GraphMessageToSandbox,
	LegendAction, LegendEntry, ParamsDrew, ParamsEdgeRefs, ParamsInfo, ParamsOptionRanges, ParamsOptions, ParamsSelection, RelationCandidate,
	SavedGraph, StateAction, StyleKinds, TargetCommand, GraphLocation, PeekSource, SavedView,
} from '../types/graph';
import { pathToSave } from './popup';
import { openNewAnnotationForm } from '../commands/annotateLine';


/** A graph's root as the server names it in uniqueName: an entity's unique
 * name, 'project:' for the project graphs, 'arch:<full name>' for an
 * architecture's */
export const PROJECT_ROOT = 'project:';
export const ARCH_PREFIX = 'arch:';

/** A graph's name as Understand shows it: the names are written for Qt's
 * menus, where "&&" is an ampersand and a lone "&" marks the shortcut key
 * ("Calls && Called By"). The name itself goes back to the server as is. */
export function graphLabel(name: string): string
{
	return name.replace(/&(&?)/g, '$1');
}

/** The browser has loaded a printed graph's page by then */
const PRINT_FILE_LIFETIME_MILLISECONDS = 60000;


/** understand/graphs/<method> as a request; undefined, with the error shown,
 * when the server fails it or the client is not running */
async function request<T>(method: string, params: { [key: string]: unknown }): Promise<T | undefined>
{
	try {
		return await variables.languageClient.sendRequest<T>(`understand/graphs/${method}`, params);
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : `understand/graphs/${method} failed`);
		return undefined;
	}
}


export class GraphProvider
{
	/** The server keeps one graph per key; every tab showing it is listed */
	private keyToGraphs: Map<string, Graph[]> = new Map;

	private entityName = '';
	private focusedGraph?: Graph = undefined;
	private listedUniqueName = '';
	private saved: SavedGraph[] = [];


	focusedUniqueName(): string
	{
		return this.focusedGraph ? this.focusedGraph.getUniqueName() : '';
	}


	/** The entity the Graphs view lists graphs for changed. A graph whose
	 * Sync is on follows it, as the GUI's graph window does, when the new
	 * entity has that graph; the tab the sync came from (source) syncs the
	 * rest and keeps its own root. */
	setEntity(entityName: string, uniqueName: string, graphs: string[], source?: string)
	{
		this.entityName = entityName;
		this.listedUniqueName = uniqueName;

		// A focused architecture graph's root comes back here too; the server
		// lists no graphs for it, and a relationship graph takes no
		// architecture as its second
		if (!uniqueName || uniqueName === PROJECT_ROOT || uniqueName.startsWith(ARCH_PREFIX))
			return;
		for (const graph of this.allGraphs()) {
			if (!graph.syncOn || graph.getUniqueName() === uniqueName || graph.tabId === source)
				continue;
			// A relationship graph keeps its root and takes the entity as
			// its second, as the GUI's sync does
			if (graph.isRelationship()) {
				graph.syncSecond(uniqueName);
				continue;
			}
			if (graphs.includes(graph.getGraphName()))
				this.retarget(graph, graph.getGraphName(), uniqueName, entityName);
		}
	}


	/** An architecture node was selected in a syncing graph: the other
	 * syncing graphs of an architecture or the project follow it */
	setArch(fullName: string, source: string)
	{
		for (const graph of this.allGraphs()) {
			const root = graph.getUniqueName();
			if (graph.syncOn && graph.tabId !== source && (root.startsWith(ARCH_PREFIX) || root === PROJECT_ROOT)
				&& root !== ARCH_PREFIX + fullName)
				this.retarget(graph, graph.getGraphName(), ARCH_PREFIX + fullName, fullName);
		}
	}


	setFocusedGraph(graph?: Graph)
	{
		this.focusedGraph = graph;
	}


	isFocused(graph: Graph): boolean
	{
		return this.focusedGraph === graph;
	}


	/** Open a graph: of the listed entity by default, or of the given root.
	 * A saved name loads that saved state first. */
	async view(graphName: string, uniqueName?: string, label?: string, savedName?: string)
	{
		const root = uniqueName ?? this.listedUniqueName;
		const rootLabel = label ?? (uniqueName === undefined ? this.entityName : labelOf(uniqueName));
		if (!root)
			return;

		// A root architecture's graph spans the whole project; on a large
		// one it builds for minutes, and a cancel only drops the result
		if (!savedName && root.startsWith(ARCH_PREFIX)
			&& variables.graphTreeProvider?.isRootArch(labelOf(root))) {
			const answer = await vscode.window.showWarningMessage(
				`${graphLabel(graphName)} on the architecture '${rootLabel}' covers the whole project and can take minutes to draw.`,
				{ modal: true }, 'Draw');
			if (answer !== 'Draw')
				return;
		}

		// The active tab's Reuse, as each GUI graph window has its own
		if (this.focusedGraph && this.focusedGraph.reuseOn) {
			this.retarget(this.focusedGraph, graphName, root, rootLabel, savedName);
			this.focusedGraph.focus();
			return;
		}

		// The GUI's Control Flow from the editor: the node at the cursor
		const editor = vscode.window.activeTextEditor;
		const focus = graphName === 'Control Flow' && uniqueName === undefined && editor
			? { focusLine: editor.selection.active.line + 1, focusColumn: editor.selection.active.character }
			: undefined;
		const graph = this.getGraphs({ graphName, uniqueName: root })[0];
		if (graph) {
			graph.focus();
			if (savedName)
				graph.loadSaved(savedName);
			else if (focus)
				graph.send('draw', focus);
		}
		else
			this.add(new Graph(graphName, root, rootLabel, savedName, undefined, focus));
	}


	/** Point an open graph at another root or graph name. A tab already
	 * showing that graph stays open, and both show it. */
	retarget(graph: Graph, graphName: string, uniqueName: string, label: string, savedName?: string)
	{
		if (this.toKey(graph) === this.toKey({ graphName, uniqueName })) {
			if (savedName)
				graph.loadSaved(savedName);
			return;
		}
		this.detach(graph);
		graph.retarget(graphName, uniqueName, label, savedName);
		this.add(graph);
	}


	/** A tab closed */
	remove(graph: Graph)
	{
		this.detach(graph);
		if (this.focusedGraph === graph)
			this.focusedGraph = undefined;
	}


	private add(graph: Graph)
	{
		const key = this.toKey(graph);
		this.keyToGraphs.set(key, [...(this.keyToGraphs.get(key) ?? []), graph]);
	}


	/** Take a tab off its key; the server drops the graph with its last tab */
	private detach(graph: Graph)
	{
		const key = this.toKey(graph);
		const rest = (this.keyToGraphs.get(key) ?? []).filter(g => g !== graph);
		if (rest.length) {
			this.keyToGraphs.set(key, rest);
			return;
		}
		this.keyToGraphs.delete(key);
		graph.send('remove');
	}


	private allGraphs(): Graph[]
	{
		return Array.from(this.keyToGraphs.values()).flat();
	}


	save()
	{
		this.focusedGraph?.save();
	}


	toggleOptions()
	{
		this.focusedGraph?.toggleOptions();
	}


	copyImage()
	{
		this.focusedGraph?.postMessage({ method: 'copyImage' });
	}


	/** The graph window's Ctrl+= and Ctrl+-, which VS Code would take for the window's zoom */
	zoom(step: number)
	{
		this.focusedGraph?.postMessage({ method: 'zoomStep', step });
	}


	findStep(step: number)
	{
		this.focusedGraph?.postMessage({ method: 'findStep', step });
	}


	/** The page's undo, which takes its own zoom steps back in turn with the server's */
	undo()
	{
		this.focusedGraph?.postMessage({ method: 'undoStep', step: -1 });
	}


	redo()
	{
		this.focusedGraph?.postMessage({ method: 'undoStep', step: 1 });
	}


	/** The page saves, as its view goes with the state */
	saveState()
	{
		this.focusedGraph?.postMessage({ method: 'saveState' });
	}


	loadState()
	{
		this.focusedGraph?.handleState({ method: 'state', action: 'load' });
	}


	updateGraph(params: ParamsDrew)
	{
		this.getGraphs(params).forEach((graph, i) => {
			if (params.info)
				graph.setInfo(params.info, i === 0);
			graph.postMessage({
				method: 'updateGraph',
				svg: params.svg,
				info: params.info,
				message: params.message,
				keepView: params.keepView,
			});
		});
	}


	updateInfo(params: ParamsInfo)
	{
		this.getGraphs(params).forEach((graph, i) => {
			graph.setInfo(params.info, i === 0);
			graph.postMessage({ method: 'updateInfo', info: params.info });
		});
	}


	/** The project's saved graph states changed */
	updateSaved(saved: SavedGraph[])
	{
		this.saved = saved;
		variables.graphTreeProvider.updateSaved(saved);
		for (const graph of this.allGraphs())
			graph.postMessage({ method: 'updateToolbar', savedNames: this.savedNames(graph.getGraphName(), graph.getUniqueName()) });
	}


	savedNames(graphName: string, uniqueName: string): string[]
	{
		return this.saved
			.filter(s => s.graphName === graphName && s.uniqueName === uniqueName)
			.map(s => s.name);
	}


	/** A draw began on the server, or was cancelled */
	drawing(params: GraphKey, aborted: boolean)
	{
		this.post(params, { method: aborted ? 'aborted' : 'drawing' });
	}


	/** A graph tab VS Code reopens after a reload, with what it kept */
	restore(panel: vscode.WebviewPanel, state: RestoreState | undefined)
	{
		if (!state || !state.graphName || !state.uniqueName) {
			panel.dispose();
			return;
		}
		this.add(new Graph(state.graphName, state.uniqueName, state.label || labelOf(state.uniqueName),
			state.savedName || undefined, panel));
	}


	/** The project is online: draw the restored tabs the server has not */
	whenOnline()
	{
		for (const graph of this.allGraphs())
			graph.redraw();
	}


	/** The tabs showing a graph; none for an answer that arrives after its
	 * tab was retargeted or closed */
	private getGraphs(key: GraphKey): Graph[]
	{
		return this.keyToGraphs.get(this.toKey(key)) ?? [];
	}


	/** The editor group a graph's tab is in */
	columnOf(key: GraphKey): vscode.ViewColumn | undefined
	{
		return this.getGraphs(key)[0]?.viewColumn();
	}


	post(key: GraphKey, message: GraphMessageToSandbox)
	{
		for (const graph of this.getGraphs(key))
			graph.postMessage(message);
	}


	private toKey(key: GraphKey | Graph)
	{
		return key instanceof Graph ? `${key.getGraphName()} ${key.getUniqueName()}` : `${key.graphName} ${key.uniqueName}`;
	}
}


/** What a root is called in a tab title */
export function labelOf(uniqueName: string): string
{
	if (uniqueName === PROJECT_ROOT)
		return 'Project';
	if (uniqueName.startsWith(ARCH_PREFIX))
		return uniqueName.slice(ARCH_PREFIX.length);
	// An entity's unique name starts with its long name ("@lns::f@k_Z…"),
	// whose last part the title shows until the server names the root
	const longName = /^@l([^@]+)/.exec(uniqueName)?.[1];
	return longName ? longName.split('::').pop() || longName : uniqueName;
}


/** What a graph tab keeps to be reopened after a reload */
export type RestoreState = { graphName: string, uniqueName: string, label?: string, savedName?: string };


/** Code opened from a graph goes where the code already is: a group beside
 * the graph that shows a file, or else the graph's own group as a tab in
 * front of it (Rob, 2026-10-14: not a new group split off beside it) */
function codeColumn(graphColumn: vscode.ViewColumn | undefined): vscode.ViewColumn
{
	const other = vscode.window.visibleTextEditors.find(e => e.viewColumn && e.viewColumn !== graphColumn);
	return other?.viewColumn ?? graphColumn ?? vscode.ViewColumn.Active;
}


/** The server's understand/graphs/<method> notifications */
export const graphNotifications: { [method: string]: (params: any) => unknown } = {
	drew: (params: ParamsDrew) => variables.graphProvider.updateGraph(params),
	info: (params: ParamsInfo) => variables.graphProvider.updateInfo(params),
	selection: (params: ParamsSelection) => variables.graphProvider.post(params, { ...params, method: 'updateSelection' }),
	saved: (params: { graphs: SavedGraph[] }) => variables.graphProvider.updateSaved(params.graphs),
	optionRanges: (params: ParamsOptionRanges) => variables.graphProvider.post(params, { ...params, method: 'updateOptionRanges' }),
	options: (params: ParamsOptions) => variables.graphProvider.post(params, { ...params, method: 'updateOptions' }),
	edgeRefs: (params: ParamsEdgeRefs) => variables.graphProvider.post(params, { ...params, method: 'updateEdgeRefs' }),
	drawing: (params: GraphKey) => variables.graphProvider.drawing(params, false),
	aborted: (params: GraphKey) => variables.graphProvider.drawing(params, true),
	apiCommand: showApiCommand,
	// The GUI's visit (Alt+click, a click with Peek off, double-click in a
	// plugin graph), in a normal tab that takes the focus; lines are 1-based
	visit: (params: GraphKey & GraphLocation) => vscode.window.showTextDocument(vscode.Uri.file(params.path), {
		selection: new vscode.Range(Math.max(0, params.line - 1), Math.max(0, params.column - 1),
			Math.max(0, params.line - 1), Math.max(0, params.column - 1)),
		preview: false,
		viewColumn: codeColumn(vscode.window.tabGroups.activeTabGroup.viewColumn),
	}),
	peekSource: (params: GraphKey & PeekSource) => variables.graphProvider.post(params, { method: 'peekSource', source: params }),
	view: (params: GraphKey & { view: SavedView }) => variables.graphProvider.post(params, { method: 'applyView', view: params.view }),
	focus: (params: GraphKey & { id: string }) => variables.graphProvider.post(params, { method: 'focusNode', id: params.id }),
	diff: showDiff,
	// The GUI shows a graph's errors in a message box
	error: (params: GraphKey & { message: string }) => vscode.window.showErrorMessage(params.message, { modal: true }),
	exported: (params: { path: string, error: string, legend?: boolean }) => {
		const what = params.legend ? 'legend' : 'graph';
		if (params.error)
			vscode.window.showErrorMessage(`Failed to save ${what} "${params.path}": ${params.error}`);
		else
			vscode.window.setStatusBarMessage(`${params.legend ? 'Legend' : 'Graph'} saved to ${params.path}`, 3000);
	},
};


/** The two sides of a compare graph's diff, by the uri VS Code's diff editor asks for */
const DIFF_SCHEME = 'understand-graph-diff';
const diffTexts = new Map<string, string>();
const diffChanged = new vscode.EventEmitter<vscode.Uri>();
let diffProvider: vscode.Disposable | undefined;
let lastTabId = 0;

/** The GUI's compare graph diff pane: the entity in the comparison
 * database against the current one, in VS Code's diff editor. One tab per
 * entity, brought back and refreshed when asked again, where code from the
 * graph goes; the graph keeps the focus. */
async function showDiff(params: GraphKey & { left: { label: string, text: string }, right: { label: string, text: string } })
{
	if (!diffProvider)
		diffProvider = vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, {
			onDidChange: diffChanged.event,
			provideTextDocumentContent: uri => diffTexts.get(uri.toString()) ?? '',
		});
	const side = (which: string, s: { label: string, text: string }) => {
		const uri = vscode.Uri.from({ scheme: DIFF_SCHEME, path: `/${which}/${s.label.replace(/[\\/:*?"<>|]/g, '_')}` });
		diffTexts.set(uri.toString(), s.text);
		diffChanged.fire(uri);
		return uri;
	};
	await vscode.commands.executeCommand('vscode.diff', side('left', params.left), side('right', params.right),
		`${params.left.label} ↔ ${params.right.label}`,
		{ preview: true, preserveFocus: true, viewColumn: codeColumn(variables.graphProvider.columnOf(params)) });
}


/**
 * Print Graph: the GUI prints the graph through its print options (fit,
 * actual size or a scale; the page's orientation; page borders and page
 * numbers). A webview cannot print, so the same choices are asked here and
 * the graph opens in the browser with its print dialog, which chooses the
 * printer or a PDF.
 * @param svg the graph as exportableSvg draws it for paper
 */
async function printGraph(svg: string, title: string)
{
	const scale = await vscode.window.showQuickPick([
		{ label: 'Fit to one page', percent: 0 },
		{ label: 'Actual size (over as many pages as it takes)', percent: 100 },
		{ label: 'Scale…', percent: -1 },
	], { title: 'Print Graph: scale' });
	if (!scale)
		return;
	let percent = scale.percent;
	if (percent < 0) {
		const typed = await vscode.window.showInputBox({ title: 'Print Graph: scale', prompt: 'Percent of the graph\'s size',
			value: '100', validateInput: v => Number(v) > 0 && Number(v) <= 1000 ? undefined : 'Enter a percent from 1 to 1000' });
		if (!typed)
			return;
		percent = Number(typed);
	}
	const orientation = await vscode.window.showQuickPick(['Landscape', 'Portrait'], { title: 'Print Graph: page' });
	if (!orientation)
		return;
	const marks = await vscode.window.showQuickPick(['Page border', 'Page numbers'],
		{ title: 'Print Graph: page markers', canPickMany: true });
	if (!marks)
		return;
	const file = path.join(os.tmpdir(), `understand-graph-${Date.now()}.html`);
	const size = percent === 0 ? 'svg{width:100%;height:auto;max-height:100vh}'
		: `svg{width:auto;height:auto;zoom:${percent / 100}}`;
	const border = marks.includes('Page border') ? 'border:0.5pt solid #000;' : '';
	const numbers = marks.includes('Page numbers') ? '@bottom-center{content:counter(page) " / " counter(pages)}' : '';
	const page = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>${escapeHtml(title)}</title>`
		+ `<style>@page{size:${orientation.toLowerCase()};margin:10mm;${border}${numbers}}body{margin:0;background:#fff;print-color-adjust:exact}svg{display:block}${size}</style></head>`
		+ `<body onload='window.print()'>${svg}</body></html>`;
	await fsPromises.writeFile(file, page, 'utf8');
	await vscode.env.openExternal(vscode.Uri.file(file));
	setTimeout(() => fsPromises.rm(file, { force: true }).catch(() => undefined), PRINT_FILE_LIFETIME_MILLISECONDS);
}


/** The Python that draws a graph, as the GUI's Copy API Command shows it:
 * copied, and opened beside the graph to read */
async function showApiCommand(params: { script: string })
{
	await vscode.env.clipboard.writeText(params.script);
	const document = await vscode.workspace.openTextDocument({ language: 'python', content: params.script });
	await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preview: true });
	vscode.window.setStatusBarMessage('API command copied to the clipboard', 3000);
}


/** A graph or treemap tab's page: a new panel, or the one VS Code restored,
 * with res/views/<script>.js and .css loaded around the body given */
export function openGraphWebview(viewType: string, title: string, script: string, body: string, panel?: vscode.WebviewPanel): vscode.WebviewPanel
{
	const options = {
		enableCommandUris: false,
		enableForms: false,
		enableScripts: true,
		localResourceRoots: [variables.extensionUri],
		portMapping: [],
	};
	if (panel) {
		panel.title = title;
		panel.webview.options = options;
	}
	else
		panel = vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Active,
			{ ...options, enableFindWidget: false, retainContextWhenHidden: true });

	const webview = panel.webview;
	const uri = (...parts: string[]) =>
		escapeHtml(webview.asWebviewUri(vscode.Uri.joinPath(variables.extensionUri, 'res', ...parts)).toString());
	const cspSource = escapeHtml(webview.cspSource);
	webview.html =
`<!DOCTYPE html>
<html>
<head>
	<meta http-equiv='Content-Security-Policy' content="default-src 'none'; img-src data:; font-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource};">
	<link rel='stylesheet' href='${uri('views', `${script}.css`)}'>
	<link rel='stylesheet' href='${uri('codicon.css')}'>
</head>

<body data-vscode-context='{"preventDefaultContextMenuItems":true}'>
${body}
	<script src='${uri('views', `${script}.js`)}'></script>
</body>
</html>`;
	return panel;
}


class Graph
{
	private panel: vscode.WebviewPanel;

	private graphName: string;
	private uniqueName: string;
	private label: string;
	private savedName = '';

	/** Follow the current entity, as the GUI window's Sync checkbox does */
	syncOn = false;

	/** Names this tab in a sync it sends, so it does not follow itself */
	readonly tabId = String(++lastTabId);

	/** Open the next graph in this tab, as the GUI window's Reuse checkbox
	 * does; a new tab starts as the setting says */
	reuseOn = vscode.workspace.getConfiguration('understand').get<boolean>('graphs.reuseTab', false);

	/** What the server last said about the graph */
	private info?: GraphInfo;
	private askedRelationship = false;
	/** The server has drawn it at least once */
	drewOnce = false;


	/** A restored tab (after a reload) brings its panel; a new one makes it.
	 * focus: a Control Flow graph opened from the editor selects the node at
	 * the cursor, as the GUI's does. */
	constructor(graphName: string, uniqueName: string, label: string, savedName?: string, panel?: vscode.WebviewPanel,
		focus?: { focusLine: number, focusColumn: number })
	{
		this.graphName = graphName;
		this.uniqueName = uniqueName;
		this.label = label;
		this.savedName = savedName ?? '';

		this.draw({ ...focus });

		// The toolbar, legend, mini-map and menus are filled in by graph.js;
		// the page only lays out where they go.
		this.panel = openGraphWebview('understandGraph', this.title(), 'graph',
`	<div id='toolbar'></div>
	<div id='content'>
		<main id='main' tabindex='0'>
			<div id='graphContainer'>
				<span class='codicon codicon-loading codicon-modifier-spin'></span>
			</div>
			<div id='minimap' hidden></div>
			<div id='legend' hidden></div>
		</main>

		<aside>
			<div id='options'></div>
		</aside>
	</div>
	<div id='menu' hidden></div>
`, panel);

		this.panel.onDidChangeViewState(() => {
			if (this.panel.active)
				variables.graphProvider.setFocusedGraph(this);
			else if (variables.graphProvider.isFocused(this)) {
				variables.graphProvider.setFocusedGraph();
				vscode.commands.executeCommand('setContext', 'understandGraphTextFocus', false);
			}
		});

		this.panel.onDidDispose(() => {
			variables.graphProvider.remove(this);
		});

		this.panel.webview.onDidReceiveMessage(this.handleMessage, this);

		this.postToolbar();
		this.saveState();
	}


	/** The toolbar's toggles, and the saved states of the graph this tab shows */
	private postToolbar()
	{
		this.postMessage({
			method: 'updateToolbar',
			sync: this.syncOn,
			reuse: this.reuseOn,
			savedNames: variables.graphProvider.savedNames(this.graphName, this.uniqueName),
		});
	}


	/** A relationship graph without its second entity asks for one, as the
	 * GUI's "Select a second entity" does when the variant is chosen. Of the
	 * tabs showing one graph, only the first asks. */
	setInfo(info: GraphInfo, mayAsk: boolean)
	{
		this.info = info;
		this.drewOnce = true;
		if (this.panel.title !== this.title())
			this.panel.title = this.title();
		if (mayAsk && info.relationship && !info.relationship.uniqueName && !this.askedRelationship) {
			this.askedRelationship = true;
			this.pickRelationship();
		}
	}


	getGraphName(): string
	{
		return this.graphName;
	}


	/** The editor group the tab is in */
	viewColumn(): vscode.ViewColumn | undefined
	{
		return this.panel.viewColumn;
	}


	getUniqueName(): string
	{
		return this.uniqueName;
	}


	focus()
	{
		this.panel.reveal();
	}


	/** Show another graph in this tab; the provider has told the server
	 * whether the old one is still shown */
	retarget(graphName: string, uniqueName: string, label: string, savedName?: string)
	{
		this.graphName = graphName;
		this.uniqueName = uniqueName;
		this.label = label;
		this.savedName = savedName ?? '';
		this.panel.title = this.title();
		this.info = undefined;
		this.askedRelationship = false;
		this.draw({});
		this.postToolbar();
		this.saveState();
	}


	loadSaved(name: string)
	{
		this.send('state', { action: 'load', name });
	}


	/** understand/graphs/<method>, about the graph this tab shows */
	send(method: string, params: { [key: string]: unknown } = {})
	{
		variables.languageClient.sendNotification(`understand/graphs/${method}`, {
			graphName: this.graphName,
			uniqueName: this.uniqueName,
			...params,
		});
	}

	/** understand/graphs/<method> as a request about the graph this tab shows */
	request<T>(method: string, params: { [key: string]: unknown } = {})
	{
		return request<T>(method, { graphName: this.graphName, uniqueName: this.uniqueName, ...params });
	}


	async handleMessage(message: GraphMessageFromSandbox)
	{
		switch (message.method) {
			case 'changedOption':
				this.draw({ optionId: message.id, optionValue: message.value });
				break;
			case 'variant':
				this.draw({ style: message.style });
				break;
			case 'clickedEntity':
				variables.languageClient.sendNotification('understand/sync', {
					id: message.id,
					source: this.tabId,
				});
				break;
			case 'clickedLocation': {
				// The place opens in a normal tab, which takes the focus
				vscode.window.showTextDocument(vscode.Uri.file(message.path), {
					selection: new vscode.Range(message.line, message.column, message.line, message.column),
					preview: false,
					viewColumn: codeColumn(this.panel.viewColumn),
				});
				break;
			}
			case 'clickedArch':
				// An architecture node is the selection; the other graphs
				// that sync follow it, as the GUI's Sync does
				if (this.syncOn)
					variables.graphProvider.setArch(message.fullName, this.tabId);
				break;
			case 'saveBase64':
				saveFile(message.path, Buffer.from(message.content, 'base64'));
				break;
			case 'action': {
				const { method: _, ...params } = message;
				this.send('action', params.action === 'sync' ? { ...params, source: this.tabId } : params);
				break;
			}
			case 'selection':
				this.send('action', { action: 'selection', ids: message.ids });
				break;
			case 'legend':
				this.handleLegend(message);
				break;
			case 'state':
				this.handleState(message);
				break;
			case 'sync':
				this.syncOn = message.on;
				break;
			case 'reuse':
				this.reuseOn = message.on;
				break;
			case 'copied':
				if (message.ok)
					vscode.window.setStatusBarMessage('Graph image copied', 3000);
				else
					vscode.window.showErrorMessage(`Failed to copy the graph image: ${message.error ?? 'the clipboard refused it'}`);
				break;
			case 'clickedLink':
				// A label's entity link selects that entity, as in the GUI
				variables.languageClient.sendNotification('understand/sync', { uniqueName: message.uniqueName });
				break;
			case 'edgeRefs':
				this.send('action', { action: 'edgeRefs', index: message.index });
				break;
			case 'target':
				this.handleTarget(message);
				break;
			case 'filter':
				this.handleFilter(message);
				break;
			case 'apiCommand':
				this.send('action', { action: 'apiCommand' });
				break;
			case 'relationship':
				this.pickRelationship();
				break;
			case 'print':
				await printGraph(message.svg, this.title());
				break;
			case 'textFocus':
				vscode.commands.executeCommand('setContext', 'understandGraphTextFocus', message.on);
				break;
			case 'notice':
				vscode.window.showInformationMessage(message.text);
				break;
		}
	}


	/** The node menu's commands for the node's own entity or architecture */
	private async handleTarget(message: TargetCommand)
	{
		const at = message.location;
		const textDocument = at ? { uri: vscode.Uri.file(at.path).toString() } : undefined;
		// The server's lines and columns are 1-based
		const position = at ? { line: Math.max(0, at.line - 1), character: Math.max(0, at.column - 1) } : undefined;
		switch (message.command) {
			case 'graph':
				if (message.graphName)
					variables.graphProvider.view(message.graphName, message.uniqueName, labelOf(message.uniqueName));
				return;
			case 'copyName':
			case 'copyLongName':
				await vscode.env.clipboard.writeText(message.text ?? '');
				vscode.window.setStatusBarMessage(`Copied ${message.text ?? ''}`, 3000);
				return;
			case 'annotate':
				// At the entity's definition, where the server picks the entity
				if (textDocument && position)
					await openNewAnnotationForm({ kind: 'auto', textDocument, position }, message.text || 'New annotation');
				return;
			case 'annotateArch':
				if (message.text)
					await openNewAnnotationForm({ kind: 'architecture', architecture: message.text }, message.text);
				return;
			case 'explore':
				if (textDocument && position)
					await variables.languageClient.sendRequest('workspace/executeCommand', {
						command: 'understand.server.exploreInUnderstand.currentFile',
						arguments: [{ textDocument, position }],
					});
				return;
			case 'generateAi':
				variables.languageClient.sendNotification('understand/sync', { uniqueName: message.uniqueName });
				await vscode.commands.executeCommand('understandAi.focus');
				await variables.languageClient.sendRequest('workspace/executeCommand', {
					command: 'understand.server.ai.generateAiOverview',
					arguments: [{ uniqueName: message.uniqueName }],
				});
				return;
			case 'findInFiles':
				// The GUI's Find in Files on the entity's name
				await vscode.commands.executeCommand('workbench.action.findInFiles', {
					query: message.text ?? '',
					triggerSearch: true,
					matchWholeWord: true,
					isCaseSensitive: true,
					isRegex: false,
				});
				return;
		}
		variables.languageClient.sendNotification('understand/sync', { uniqueName: message.uniqueName });
		const view = { info: 'understandInfo', ai: 'understandAi', references: 'understandReferences', metrics: 'understandMetrics' }[message.command];
		await vscode.commands.executeCommand(`${view}.focus`);
	}


	isRelationship(): boolean
	{
		return !!(this.info && this.info.relationship);
	}


	/** Sync on a relationship graph: the entity becomes its second entity,
	 * where it is of the kind the graph relates the root to */
	async syncSecond(uniqueName: string)
	{
		if (!this.info || !this.info.relationship || this.info.relationship.uniqueName === uniqueName)
			return;
		const answer = await this.request<{ accepted: boolean }>('relation', { check: uniqueName });
		if (answer && answer.accepted)
			this.draw({ optionId: 'secondent', optionValue: uniqueName });
	}


	/** Ask for a relationship graph's second entity, among those of the kind
	 * the graph relates the first one to. A large project has hundreds of
	 * thousands, so the server searches for what is typed and sends the
	 * first matches. */
	async pickRelationship()
	{
		type Candidates = { entities: RelationCandidate[], total: number };
		// Open at once and busy: the first question reads the whole project
		const pick = vscode.window.createQuickPick<vscode.QuickPickItem & { uniqueName: string }>();
		pick.title = `Select a second entity for [${graphLabel(this.graphName)} : ${this.label}]`;
		pick.matchOnDescription = true;
		pick.matchOnDetail = true;
		pick.busy = true;
		pick.placeholder = 'Finding the entities this graph can relate to…';
		const show = (answer: Candidates) => {
			// The server has already matched on the long name too
			pick.items = answer.entities.map(e => ({ label: e.name, description: e.kind, detail: e.longName, uniqueName: e.uniqueName, alwaysShow: true }));
			pick.placeholder = answer.total > answer.entities.length
				? `${answer.entities.length} of ${answer.total.toLocaleString()} shown: type to narrow`
				: 'Type to filter';
			pick.busy = false;
		};

		let asked = 0;
		let timer: NodeJS.Timeout | undefined;
		pick.onDidChangeValue(value => {
			clearTimeout(timer);
			pick.busy = true;
			timer = setTimeout(async () => {
				const mine = ++asked;
				const answer = await this.request<Candidates>('relation', { query: value });
				if (answer && mine === asked)
					show(answer);
			}, 150);
		});
		pick.onDidAccept(() => {
			const picked = pick.selectedItems[0];
			pick.hide();
			if (picked)
				this.draw({ optionId: 'secondent', optionValue: picked.uniqueName });
		});
		pick.onDidHide(() => {
			clearTimeout(timer);
			pick.dispose();
		});
		pick.show();

		const mine = ++asked;
		const first = await this.request<Candidates>('relation', { query: '' });
		if (!first) {
			pick.hide();
			return;
		}
		if (!first.total) {
			pick.hide();
			vscode.window.showInformationMessage('No entity can be the second entity of this relationship graph');
			return;
		}
		// Unless something typed meanwhile has already been answered
		if (mine === asked)
			show(first);
	}


	/** Graphic filters, as the GUI's graph menu, node menu and Graphic
	 * Filter dialog change them; the dialog itself is the page's */
	private async handleFilter(message: FilterAction)
	{
		const send = (params: { [key: string]: unknown }) => request<GraphFilters>('filters', params);

		if (message.action === 'enable') {
			await send({ action: 'enable', value: message.value });
			return;
		}
		// The page's Graphic Filter dialog
		if (message.action === 'set') {
			await send({ action: 'set', enabled: !!message.enabled, filters: message.filters ?? [] });
			return;
		}

		if (message.action === 'suggest' && message.suggestion) {
			const filters = await send({ action: 'list' });
			const filter = filters && await editFilter(filters, {
				text: message.suggestion.text, criteria: message.suggestion.criteria, action: 1 });
			if (filter)
				await send({ action: 'add', criteria: filter.criteria, text: filter.text, filterAction: filter.action });
		}
	}


	/** Legend and theme changes; the ones that need a name or a file ask
	 * for it here, since the webview has no dialogs */
	async handleLegend(message: LegendAction)
	{
		const params: { [key: string]: unknown } = { action: message.action };
		for (const key of ['id', 'index', 'key', 'value', 'enabled'] as const)
			if (message[key] !== undefined)
				params[key] = message[key];

		switch (message.action) {
			case 'saveImage': {
				// The GUI's formats, which the server writes from the legend
				const result = await pathToSave(['png', 'jpg', 'svg', { extension: 'vdx', name: 'Visio XML' },
					{ extension: 'vsdx', name: 'Visio' }, { extension: 'dot', name: 'Graphviz DOT' }]);
				if (result)
					this.send('export', { path: result.uri.fsPath, legend: true });
				return;
			}
			case 'styleDialog':
				await this.styleDialog(message.styleKind ?? 'node', message.entry);
				return;
			case 'theme':
				if (message.modified) {
					const choice = await vscode.window.showWarningMessage(
						'The current theme has unsaved changes. Switching themes discards them.',
						{ modal: true }, 'Save and Switch', 'Discard and Switch');
					if (!choice)
						return;
					if (choice === 'Save and Switch')
						this.send('legend', { action: 'save' });
				}
				break;
			case 'newTheme':
			case 'renameTheme': {
				const name = await vscode.window.showInputBox({
					prompt: message.action === 'newTheme' ? 'Name for the new graph theme' : 'New name for the graph theme',
					value: typeof message.value === 'string' ? message.value : '',
				});
				if (!name)
					return;
				params.name = name;
				break;
			}
			case 'removeTheme': {
				const choice = await vscode.window.showWarningMessage(
					'Remove this graph theme?', { modal: true }, 'Remove');
				if (choice !== 'Remove')
					return;
				break;
			}
			case 'export': {
				const uri = await vscode.window.showSaveDialog({ filters: { 'Graph theme': ['json'] }, title: 'Export Graph Theme' });
				if (!uri)
					return;
				params.path = uri.fsPath;
				break;
			}
			case 'import': {
				const uris = await vscode.window.showOpenDialog({ filters: { 'Graph theme': ['json'] }, title: 'Import Graph Themes', canSelectMany: false });
				if (!uris || !uris.length)
					return;
				params.path = uris[0].fsPath;
				break;
			}
		}
		this.send('legend', params);
	}


	/** The GUI's New and Edit Node Style, Edge Style and Metric Color Scale
	 * dialogs: an entity kind, a reference kind, or a metric and its colors */
	private async styleDialog(styleKind: 'node' | 'edge' | 'metric', entry?: LegendEntry)
	{
		const send = (params: { [key: string]: unknown }) => this.send('legend', params);
		const kinds = await this.request<StyleKinds>('styleKinds');
		if (!kinds)
			return;
		const editing = entry && entry.user ? entry : undefined;

		if (styleKind === 'metric') {
			if (!kinds.canMetric) {
				vscode.window.showInformationMessage('This graph has no metrics to color by');
				return;
			}
			const metric = await vscode.window.showQuickPick(
				kinds.metrics.map(m => ({ label: m.name, description: m.id, id: m.id })),
				{ title: editing ? 'Edit Metric Color Scale' : 'Add Metric Color Scale', placeHolder: 'Metric' });
			if (!metric)
				return;
			const name = await vscode.window.showInputBox({ title: 'Name', value: editing?.name || metric.label });
			if (!name)
				return;
			const color = (prompt: string, value: string) => vscode.window.showInputBox({
				title: prompt, value,
				// The server's defaults are color names ("white"), which it reads as the GUI does
				validateInput: v => /^(#[0-9a-f]{6}|[a-z]+)$/i.test(v.trim()) ? undefined : 'A color such as #3366cc or white',
			});
			const minColor = await color('Color for the lowest value', editing?.minColor || kinds.minColor);
			if (!minColor)
				return;
			const maxColor = await color('Color for the highest value', editing?.maxColor || kinds.maxColor);
			if (!maxColor)
				return;
			const range = await vscode.window.showInputBox({
				title: 'Range',
				prompt: 'Leave empty for an automatic range, or give "minimum, maximum"',
				validateInput: v => !v.trim() || /^\s*-?[\d.]+\s*,\s*-?[\d.]+\s*$/.test(v) ? undefined : 'Two numbers, such as 0, 100',
			});
			if (range === undefined)
				return;
			const params: { [key: string]: unknown } = { action: 'metricStyle', name, metric: metric.id, minColor, maxColor };
			if (editing?.id)
				params.id = editing.id;
			if (range.trim()) {
				const [min, max] = range.split(',').map(Number);
				params.minValue = min;
				params.maxValue = max;
			}
			send(params);
			return;
		}

		const edge = styleKind === 'edge';
		if (!(edge ? kinds.canEdge : kinds.canNode)) {
			vscode.window.showInformationMessage(`This graph has no ${edge ? 'edge' : 'node'} styles to add`);
			return;
		}
		const list = edge ? kinds.edge : kinds.node;
		const other = { label: '$(edit) Type a kind string…', kindString: '' };
		const kindPick = await vscode.window.showQuickPick(
			[...list.map(k => ({ label: k.name, description: k.kind, kindString: k.kind })), other],
			{ title: editing ? (edge ? 'Edit Edge Style' : 'Edit Node Style') : (edge ? 'New Edge Style' : 'New Node Style'),
				placeHolder: edge ? 'Reference Kind' : 'Entity Kind' });
		if (!kindPick)
			return;
		let kind = kindPick.kindString;
		if (kindPick === other) {
			kind = await vscode.window.showInputBox({
				title: edge ? 'Reference kind string' : 'Entity kind string', value: editing?.rule ?? '' }) ?? '';
			if (!kind)
				return;
		}
		const name = await vscode.window.showInputBox({
			title: 'Name', value: editing?.label || (kindPick === other ? kind : kindPick.label) });
		if (!name)
			return;
		const params: { [key: string]: unknown } = { action: edge ? 'edgeStyle' : 'nodeStyle', name, kind };
		if (editing?.id)
			params.id = editing.id;
		send(params);
	}


	async handleState(message: StateAction)
	{
		let name = message.name;
		const names = variables.graphProvider.savedNames(this.graphName, this.uniqueName);
		if (!name) {
			if (message.action === 'save') {
				name = await vscode.window.showInputBox({
					prompt: 'Name for this graph state',
					value: this.savedName,
				});
			}
			else if (names.length) {
				name = await vscode.window.showQuickPick(names, {
					title: message.action === 'load' ? 'Load Graph State' : 'Remove Graph State',
				});
			}
			else {
				vscode.window.showInformationMessage('This graph has no saved states');
				return;
			}
		}
		if (!name)
			return;
		if (message.action === 'save' && names.includes(name)) {
			const choice = await vscode.window.showWarningMessage(
				`Replace the saved graph state "${name}"?`, { modal: true }, 'Replace');
			if (choice !== 'Replace')
				return;
		}
		if (message.action === 'save') {
			this.savedName = name;
			this.saveState();
		}
		this.send('state', { action: message.action, name, view: message.view });
	}


	/** Export To File: the images and SVG as the view shows them; Visio, DOT
	 * and PlantUML written by the server, as the GUI writes them */
	async save()
	{
		const names: { [extension: string]: string } = {
			vdx: 'Visio XML', vsdx: 'Visio', dot: 'Graphviz DOT', pu: 'PlantUML' };
		const more = (this.info?.exportFormats ?? []).filter(f => f !== 'svg');
		const result = await pathToSave(['svg', 'jpg', 'png', ...more.map(f => ({ extension: f, name: names[f] ?? f.toUpperCase() }))]);
		if (!result)
			return;

		const extension = result.extension;
		const path = result.uri.fsPath;

		// The images as the view draws them, at its zoom; SVG and the rest
		// written by the server, as the GUI's display writes them
		switch (extension) {
			case 'jpg': case 'png':
				return this.postMessage({method: 'convert', extension, path});
		}
		if (extension === 'svg' || more.includes(extension))
			this.send('export', { path });
	}


	toggleOptions()
	{
		this.postMessage({ method: 'toggleOptions' });
	}


	postMessage(message: GraphMessageToSandbox)
	{
		this.panel.webview.postMessage(message);
	}


	/** The display's own title once the server says it, as the GUI's window
	 * follows it ("Control Flow : process"); till then the graph and root,
	 * the same way. The graph name in the title doubles "&" as a menu does
	 * ("Calls && Called By"), which the GUI's tab bar undoes and a VS Code
	 * tab does not; the root's name after it (operator&&) is left as is. */
	private title(): string
	{
		const title = this.info?.title;
		if (!title)
			return `${graphLabel(this.graphName)} : ${this.label}`;
		return title.startsWith(this.graphName)
			? graphLabel(this.graphName) + title.slice(this.graphName.length)
			: title;
	}


	private draw(extra: { [key: string]: unknown })
	{
		const params = { ...extra };
		if (this.savedName && !('optionId' in extra))
			params.savedName = this.savedName;
		// A tab restored before the server runs draws once the project is
		// online (GraphProvider.whenOnline)
		if (!variables.languageClient || !variables.languageClient.isRunning())
			return;
		this.send('draw', params);
	}


	/** Draw again, for a restored tab the server had not drawn */
	redraw()
	{
		if (!this.drewOnce)
			this.draw({});
	}


	/** What VS Code keeps of the tab to restore it after a reload */
	private saveState()
	{
		this.postMessage({ method: 'restoreState', state: {
			graphName: this.graphName, uniqueName: this.uniqueName, label: this.label, savedName: this.savedName } });
	}
}


/** The GUI's Graphic Filter Editor: the text, what it matches, and what a
 * match does */
async function editFilter(filters: GraphFilters, filter: GraphFilters['filters'][number])
	: Promise<GraphFilters['filters'][number] | undefined>
{
	const text = await vscode.window.showInputBox({ title: 'Graphic Filter Editor', prompt: 'Filter Text', value: filter.text });
	if (!text)
		return;
	const criteria = await vscode.window.showQuickPick(
		filters.criteria.map(c => ({ label: c.name, id: c.id, picked: c.id === filter.criteria })),
		{ title: 'Filter Criteria' });
	if (!criteria)
		return;
	const action = await vscode.window.showQuickPick(
		filters.actions.map(a => ({ label: a.name, id: a.id, picked: a.id === filter.action })),
		{ title: 'Filter Action' });
	if (!action)
		return;
	return { text, criteria: criteria.id, action: action.id };
}


async function saveFile(path: string, content: Buffer)
{
	try {
		await fsPromises.writeFile(path, content);
		vscode.window.setStatusBarMessage(`Graph saved to ${path}`, 3000);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to save graph "${path}": ${error}`);
	}
}
