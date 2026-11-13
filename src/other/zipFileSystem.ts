import * as vscode from 'vscode';

import { variables } from './variables';
import { isProjectResolved, onDidResolveProject, whenProjectResolved } from './statusBar';


/**
 * The scheme of a file inside a zip, such as a class of the Java standard
 * library in the JDK's src.zip. Understand stores one as zip{member}, which is
 * no file on disk, so the server names it
 * understand-zip:///C:/jdk/lib/src.zip!/java.base/java/lang/Iterable.java
 * and gives its text on request (#5).
 */
export const zipScheme = 'understand-zip';

// How long a read waits for the server to open the project
const READY_TIMEOUT_MILLISECONDS = 5 * 60_000;

// How many fetched texts a ZipFileSystem keeps
const CACHED_TEXTS = 20;


/** The URI of a file whose path the server sends as a plain string */
export function uriOfPath(path: string): vscode.Uri
{
	// The first brace, as the server's Readfile::ParseZipName splits it
	const zip = /^(.*?)\{(.*)\}$/.exec(path);
	if (!zip)
		return vscode.Uri.file(path);
	return vscode.Uri.file(`${zip[1]}!/${zip[2]}`).with({ scheme: zipScheme });
}


/**
 * Read-only files inside a zip, from the server. A file system rather than a
 * content provider, because VS Code restores the tabs of a file system's
 * files when a window reopens, and wakes this extension to read them.
 */
export class ZipFileSystem implements vscode.FileSystemProvider
{
	private changed = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile = this.changed.event;

	// When the project was last resolved. A zip's text can change when the
	// project is analyzed again (a new JDK or library jar), so after every
	// resolve the open zip files are reported changed, and their time moves
	// on: VS Code reloads an open file only when its time or size differs
	// from what it read.
	private resolvedAt = Date.now();

	// The last texts fetched, oldest first. Finding a member in a large zip
	// takes the server about 0.1 s, and VS Code reads a file two or three
	// times as it opens it (its size, then its text, sometimes twice at
	// once), so each open fetches once. A fetch under way is shared; one that
	// fails is dropped, so the next read asks again. All are dropped when the
	// project is resolved again.
	private texts = new Map<string, Promise<Uint8Array>>();

	constructor()
	{
		onDidResolveProject(() => {
			this.resolvedAt = Date.now();
			this.texts.clear();
			const open = vscode.workspace.textDocuments.filter((doc) => doc.uri.scheme === zipScheme);
			if (open.length)
				this.changed.fire(open.map((doc) => ({ type: vscode.FileChangeType.Changed, uri: doc.uri })));
		});
	}

	watch(): vscode.Disposable
	{
		return new vscode.Disposable(() => undefined);
	}

	async stat(uri: vscode.Uri): Promise<vscode.FileStat>
	{
		const text = await this.readFile(uri);
		return { type: vscode.FileType.File, ctime: 0, mtime: this.resolvedAt, size: text.byteLength,
			permissions: vscode.FilePermission.Readonly };
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array>
	{
		if (!isProjectResolved()) {
			let timer: NodeJS.Timeout | undefined;
			const timeout = new Promise<boolean>((resolve) => {
				timer = setTimeout(() => resolve(false), READY_TIMEOUT_MILLISECONDS);
			});
			const resolved = await Promise.race([whenProjectResolved(), timeout]);
			clearTimeout(timer);
			if (!resolved)
				throw vscode.FileSystemError.Unavailable(uri);
		}

		const key = uri.toString();
		let text = this.texts.get(key);
		if (text) {
			// most recently used last
			this.texts.delete(key);
		} else {
			text = this.fetch(uri);
			text.catch(() => {
				if (this.texts.get(key) === text)
					this.texts.delete(key);
			});
		}
		this.texts.set(key, text);
		if (this.texts.size > CACHED_TEXTS)
			this.texts.delete(this.texts.keys().next().value!);
		return text;
	}

	private async fetch(uri: vscode.Uri): Promise<Uint8Array>
	{
		type Result = { text?: string, message?: string } | null;
		const result = await variables.languageClient.sendRequest<Result>(
			'understand/zipContent', { uri: uri.toString() });
		if (result?.text === undefined) {
			const message = result?.message ?? vscode.l10n.t('This file isn\'t in the open Understand project.');
			this.notifyOnce(uri, message);
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		this.notified.delete(uri.toString());
		return new TextEncoder().encode(result.text);
	}

	// A tab never shows a provider's message: VS Code puts its own in the
	// editor, whatever the error. So the reason goes in a notification, once
	// per file, because VS Code reads a file several times as it opens it.
	private notified = new Set<string>();

	private notifyOnce(uri: vscode.Uri, message: string)
	{
		const key = uri.toString();
		if (this.notified.has(key))
			return;
		this.notified.add(key);
		vscode.window.showErrorMessage(message);
	}

	readDirectory(uri: vscode.Uri): never
	{
		throw vscode.FileSystemError.FileNotADirectory(uri);
	}

	createDirectory(uri: vscode.Uri): never
	{
		throw vscode.FileSystemError.NoPermissions(uri);
	}

	writeFile(uri: vscode.Uri): never
	{
		throw vscode.FileSystemError.NoPermissions(uri);
	}

	delete(uri: vscode.Uri): never
	{
		throw vscode.FileSystemError.NoPermissions(uri);
	}

	rename(uri: vscode.Uri): never
	{
		throw vscode.FileSystemError.NoPermissions(uri);
	}
}
