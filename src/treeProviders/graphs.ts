import {
	EventEmitter,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
} from 'vscode';
import { variables } from '../other/variables';
import { ARCH_PREFIX, PROJECT_ROOT, graphLabel } from '../other/graphProvider';
import { contexts, setContext } from '../other/context';
import { SavedGraph } from '../types/graph';


type Arch = {
	name: string,
	fullName: string,
	hasChildren: boolean,
};

type ArchListed = {
	fullName: string,
	graphs: string[],
	children: Arch[],
};

type Item = GraphItem | SeparatorItem | SectionItem | ArchItem | SavedItem | TreemapItem;

/** The graphs a licence without GUI Access leaves an entity */
const BASIC_GRAPHS = ['Calls', 'Control Flow'];


/** The Graphs view: the current entity's graphs, then the project's, the
 * architectures' (by architecture, as the GUI's "By ..." menus), the saved
 * graph states and the metrics treemap. */
export class GraphTreeProvider implements TreeDataProvider<Item>
{
	private entityGraphs: GraphItem[] = [];
	private projectGraphs: string[] = [];
	private archs: Arch[] = [];
	private saved: SavedGraph[] = [];
	private online = false;
	private emitter = new EventEmitter<void>();

	onDidChangeTreeData = this.emitter.event;


	async getChildren(element: Item | undefined): Promise<Item[]>
	{
		if (element === undefined) {
			const items: Item[] = [...this.entityGraphs];
			if (!this.online)
				return items;
			// A line between the entity's graphs and the sections below them
			// (Rob, 2026-10-22)
			if (items.length)
				items.push(new SeparatorItem());
			// An entity's graphs are always there; the project's, the
			// architectures' and the treemap need GUI Access, and the treemap
			// Export & Share Reports/Metrics as well
			const gui = variables.guiLicensed;
			const saved = this.visible(this.saved);
			if (gui) {
				items.push(new SectionItem('Project Graphs', 'project', this.projectGraphs.length ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None));
				items.push(new SectionItem('Architectures', 'archs', this.archs.length ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None));
			}
			items.push(new SectionItem('Saved Graphs', 'saved', saved.length ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None));
			if (gui && variables.exportLicensed)
				items.push(new TreemapItem());
			return items;
		}
		if (element instanceof SectionItem) {
			switch (element.section) {
				case 'project':
					return this.projectGraphs.map(name => new GraphItem(name, PROJECT_ROOT, 'Project'));
				case 'archs':
					return this.archs.map(arch => new ArchItem(arch));
				case 'saved':
					return this.visible(this.saved).map(saved => new SavedItem(saved));
			}
		}
		if (element instanceof ArchItem) {
			const listed = await this.listArch(element.arch.fullName);
			const items: Item[] = listed.graphs.map(name => new GraphItem(name, ARCH_PREFIX + element.arch.fullName, element.arch.fullName));
			for (const child of listed.children)
				items.push(new ArchItem(child));
			return items;
		}
		return [];
	}


	getTreeItem(element: Item): TreeItem
	{
		return element;
	}


	update(params: Params)
	{
		this.entityGraphs = params.graphs.map(name => new GraphItem(name));
		this.projectGraphs = params.project ?? [];
		this.archs = params.archs ?? [];
		this.online = params.project !== undefined;
		this.emitter.fire();
	}


	updateSaved(saved: SavedGraph[])
	{
		this.saved = saved;
		this.emitter.fire();
	}


	refresh()
	{
		this.emitter.fire();
	}


	/** A root architecture's graphs span the whole project */
	isRootArch(fullName: string)
	{
		return this.archs.some(arch => arch.fullName === fullName);
	}


	/** Saved graphs, less the project's, the architectures' and
	 * every graph but an entity's call tree and control flow without GUI
	 * Access, as the server lists them */
	private visible<T extends { uniqueName: string, graphName: string }>(graphs: T[]): T[]
	{
		if (variables.guiLicensed)
			return graphs;
		return graphs.filter(g => g.uniqueName !== PROJECT_ROOT && !g.uniqueName.startsWith(ARCH_PREFIX)
			&& BASIC_GRAPHS.includes(g.graphName));
	}


	/** An architecture's graphs and children come from the server when the
	 * item is expanded */
	private async listArch(fullName: string): Promise<ArchListed>
	{
		try {
			return await variables.languageClient.sendRequest<ArchListed>('understand/graphs/listArch', { fullName });
		} catch {
			return { fullName, graphs: [], children: [] };
		}
	}
}


/** What the server says the licence grants of GUI Access */
export function setGuiLicensed(on: boolean)
{
	variables.guiLicensed = on;
	setContext(contexts.guiLicensed, on);
	// The start-up path that calls this goes on to register the licence
	// handlers, so it must not depend on the Graphs view existing yet
	variables.graphTreeProvider?.refresh();
}


/** What the server says the licence grants of Export & Share Reports/Metrics,
 * which the treemap needs as well as GUI Access */
export function setExportLicensed(on: boolean)
{
	variables.exportLicensed = on;
	setContext(contexts.exportLicensed, on);
	variables.graphTreeProvider?.refresh();
}


export function handleUnderstandGraphsListed(params: Params)
{
	variables.graphProvider.setEntity(params.entityName, params.uniqueName, params.graphs, params.source);
	variables.graphTreeProvider.update(params);
	// The project is online (the list carries the project's graphs then)
	if (params.project !== undefined)
		variables.graphProvider.whenOnline();
}


class GraphItem extends TreeItem
{
	constructor(name: string, uniqueName?: string, label?: string)
	{
		super(graphLabel(name));
		this.contextValue = 'understandGraph';
		this.command = {
			title: 'Go to Graph',
			command: 'understand.graphs.view',
			arguments: uniqueName === undefined ? [name] : [name, uniqueName, label],
		};
	}
}


/** A tree has no separator of its own: a row with no label and a dimmed
 *  rule for its description reads as one. A row cannot size itself to the
 *  view, and a rule wider than it ends in "…", so it is kept short. */
class SeparatorItem extends TreeItem
{
	constructor()
	{
		super('');
		this.description = '─'.repeat(12);
		this.contextValue = 'understandGraphSeparator';
	}
}


class SectionItem extends TreeItem
{
	constructor(label: string, public section: 'project' | 'archs' | 'saved', state: TreeItemCollapsibleState)
	{
		super(label, state);
		this.contextValue = 'understandGraphSection';
		if (state === TreeItemCollapsibleState.None)
			this.description = 'none';
	}
}


class ArchItem extends TreeItem
{
	constructor(public arch: Arch)
	{
		super(arch.name, TreeItemCollapsibleState.Collapsed);
		this.contextValue = 'understandGraphArch';
		this.iconPath = new ThemeIcon('symbol-structure');
		this.tooltip = arch.fullName;
	}
}


class SavedItem extends TreeItem
{
	constructor(public saved: SavedGraph)
	{
		super(saved.name);
		this.contextValue = 'understandGraphSaved';
		this.description = `${graphLabel(saved.graphName)}: ${saved.rootName}`;
		this.iconPath = new ThemeIcon('save');
		this.command = {
			title: 'Load Saved Graph',
			command: 'understand.graphs.view',
			arguments: [saved.graphName, saved.uniqueName, saved.rootName, saved.name],
		};
	}
}


class TreemapItem extends TreeItem
{
	constructor()
	{
		super('Metrics Treemap');
		this.contextValue = 'understandGraphTreemap';
		this.iconPath = new ThemeIcon('layout');
		this.command = {
			title: 'Metrics Treemap',
			command: 'understand.graphs.treemap',
		};
	}
}


type Params = {
	entityName: string,
	graphs: string[],
	uniqueName: string,
	project?: string[],
	archs?: Arch[],
	/** The graph tab whose sync this list answers */
	source?: string,
};
