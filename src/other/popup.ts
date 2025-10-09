import * as vscode from 'vscode';


type FileKind = string | {
	extension: string,
	name: string,
};


type PathResult = {
	extension: string,
	uri: vscode.Uri,
};


/** Use a dialog to get a path for saving a file */
export async function pathToSave(kinds: FileKind[]): Promise<PathResult | undefined>
{
	const filters: { [name: string]: string[] } = {};
	let title = '';

	for (let i = 0; i < kinds.length; i++) {
		const kind = kinds[i];
		let extension: string;
		let name: string;
		if (typeof kind === 'string') {
			extension = kind;
			name = kind.toUpperCase();
		}
		else {
			extension = kind.extension;
			name = kind.name;
		}
		if (i === 0) {
			if (kinds.length > 1)
				name += ' (default)';
		}
		else {
			title += ', ';
		}
		filters[name] = [extension];
		title += name;
	}

	const uri = await vscode.window.showSaveDialog({ filters, title });
	if (!uri)
		return;

	const path = uri.fsPath;
	const extensionMatch = /\.([^.]*)$/.exec(path);
	if (!extensionMatch)
		return;
	const extension = extensionMatch[1];

	return {
		extension,
		uri,
	};
}
