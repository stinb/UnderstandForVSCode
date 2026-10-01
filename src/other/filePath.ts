import { Uri } from 'vscode';


// A file's identity for comparing a row against the active editor. VS Code
// hands out a Windows drive letter in either case, so the comparison folds
// case there and is exact everywhere else.
export function pathOf(uri: string | undefined): string
{
	if (!uri)
		return '';
	const path = decodeURIComponent(Uri.parse(uri).fsPath);
	return process.platform === 'win32' ? path.toLowerCase() : path;
}
