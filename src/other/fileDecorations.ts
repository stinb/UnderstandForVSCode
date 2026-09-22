import * as vscode from 'vscode';

import { FileStatus } from './statusBar';
import { getBooleanFromConfig } from './config';
import { variables } from './variables';


/**
 * The file status the status bar shows, on the file name itself — in the
 * explorer, on the editor tab, and in the Open Editors list (ext #6).
 *
 * A decoration is a badge of at most two characters, a colour and a tooltip,
 * so this is not the status bar's wording repeated: the badge carries the
 * state that asks for action, and the tooltip carries the sentence. A file
 * that is in the project and analyzed is left undecorated — that is the
 * ordinary case, and a badge on every row would say nothing. A file outside
 * the project is muted rather than badged: visible at a glance without
 * competing with the files that need something.
 */


/** What each state looks like. Undefined means "say nothing". */
function decorationFor(status: FileStatus): vscode.FileDecoration | undefined
{
	if (!status.inProject) {
		return {
			color: new vscode.ThemeColor('list.deemphasizedForeground'),
			tooltip: 'Not a file of the Understand project',
		};
	}

	switch (status.analysis) {
		case 'analyzed':
			return undefined;
		case 'stale':
			return {
				badge: '!',
				color: new vscode.ThemeColor('list.warningForeground'),
				tooltip: 'Project file, modified since it was last analyzed',
				// so a collapsed folder still shows that something inside it
				// is waiting on an analysis
				propagate: true,
			};
		default:
			return {
				badge: '?',
				color: new vscode.ThemeColor('list.deemphasizedForeground'),
				tooltip: 'Project file that has not been analyzed yet',
				propagate: true,
			};
	}
}


class FileStatusDecorationProvider implements vscode.FileDecorationProvider
{
	private emitter = new vscode.EventEmitter<vscode.Uri[] | undefined>();
	onDidChangeFileDecorations = this.emitter.event;

	// What the server has answered for a uri, null when it answered nothing
	// (no project open). Cleared wholesale by invalidate().
	private cache = new Map<string, FileStatus | null>();
	// Uris asked for but not yet sent, with whoever is waiting on each.
	private queued = new Map<string, ((status: FileStatus | null) => void)[]>();
	private flushing = false;


	/** Forget everything and ask the explorer to come back for it. */
	invalidate()
	{
		this.cache.clear();
		this.emitter.fire(undefined);
	}


	/** What the server says about this file, cached. */
	statusOf(uri: vscode.Uri): Promise<FileStatus | null>
	{
		if (uri.scheme !== 'file')
			return Promise.resolve(null);
		return this.lookup(uri.toString());
	}


	async provideFileDecoration(uri: vscode.Uri)
		: Promise<vscode.FileDecoration | undefined>
	{
		// Only real files have a status; the rest (git:, output:, untitled:)
		// would each cost a round trip to be told nothing.
		if (uri.scheme !== 'file')
			return undefined;
		if (!getBooleanFromConfig('understand.fileDecorations.enabled', true))
			return undefined;

		const status = await this.lookup(uri.toString());
		return status ? decorationFor(status) : undefined;
	}


	/** The status for one uri, from the cache or from the next batch. */
	private lookup(key: string): Promise<FileStatus | null>
	{
		const cached = this.cache.get(key);
		if (cached !== undefined)
			return Promise.resolve(cached);

		return new Promise(resolve => {
			const waiting = this.queued.get(key);
			if (waiting !== undefined) {
				waiting.push(resolve);
				return;
			}
			this.queued.set(key, [resolve]);
			// One batch per turn of the event loop: the explorer asks for
			// every row it is drawing, and one request each would be a round
			// trip per row.
			if (!this.flushing) {
				this.flushing = true;
				setTimeout(() => this.flush(), 0);
			}
		});
	}


	private async flush()
	{
		this.flushing = false;
		const waiting = this.queued;
		this.queued = new Map();
		const keys = Array.from(waiting.keys());

		let statuses: (FileStatus | null)[] = [];
		try {
			const reply: { statuses?: (FileStatus | null)[] } | null =
				await variables.languageClient.sendRequest('understand/fileStatus',
					{ uris: keys });
			statuses = reply?.statuses ?? [];
		} catch {
			// A server that is starting, restarting or gone says nothing; the
			// next invalidation asks again.
		}

		keys.forEach((key, i) => {
			const status = statuses[i] ?? null;
			this.cache.set(key, status);
			for (const resolve of waiting.get(key) ?? [])
				resolve(status);
		});
	}
}


export const fileDecorationProvider = new FileStatusDecorationProvider;


/**
 * The status of one file, from the same cache the decorations use. Whether
 * Understand has the file at all is a fact other surfaces need too -- an
 * action offered on a file with no entity can only fail.
 */
export function fileStatusOf(uri: vscode.Uri): Promise<FileStatus | null>
{
	return fileDecorationProvider.statusOf(uri);
}


/** Drop what the decorations know, so the next draw asks the server again. */
export function invalidateFileDecorations()
{
	fileDecorationProvider.invalidate();
}
