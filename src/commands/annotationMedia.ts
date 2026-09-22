import * as vscode from 'vscode';

import { variables } from '../other/variables';
import { openNewAnnotationForm } from './annotateLine';


/**
 * The two things a client needs beyond the flattened text of an annotation
 * body: getting at the media behind a marker, and putting a file behind a
 * new one. The body stores media as markers that read as "Image: name" to
 * anything that only has the text — which was all VS Code had (ext #26).
 */


/** Open one of an annotation's media items in VS Code. */
export async function openAnnotationMedia(mediaId?: string, name?: string)
{
	if (!mediaId) {
		vscode.window.showErrorMessage('No media to open');
		return;
	}

	let media: { name: string, contents: string };
	try {
		media = await variables.languageClient.sendRequest(
			'understand/annotationMedia', { mediaId });
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : 'Failed to read the media');
		return;
	}

	// Written beside VS Code's own storage rather than into the project: this
	// is a copy to look at, and the project's own file must not be editable
	// by accident.
	const dir = vscode.Uri.joinPath(variables.extensionUri, '.media');
	const target = vscode.Uri.joinPath(dir, media.name || name || mediaId);
	try {
		await vscode.workspace.fs.createDirectory(dir);
		await vscode.workspace.fs.writeFile(
			target, Buffer.from(media.contents, 'base64'));
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : 'Failed to write the media');
		return;
	}

	// Images open in VS Code's viewer; anything else goes to the desktop,
	// which knows what to do with it.
	if (/\.(png|jpe?g|gif|bmp|svg|webp)$/i.test(target.path))
		await vscode.commands.executeCommand('vscode.open', target);
	else
		await vscode.env.openExternal(target);
}


/** Attach a file to an annotation, the way dropping one on a card does. */
export async function attachAnnotationMedia(annotation: { id: string } | undefined)
{
	if (!annotation || !annotation.id) {
		vscode.window.showErrorMessage('Select an annotation to attach a file to');
		return;
	}

	const picked = await vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: 'Attach',
		title: 'Attach a file to this annotation',
	});
	if (!picked || !picked.length)
		return;

	try {
		await variables.languageClient.sendRequest(
			'understand/attachAnnotationMedia',
			{ id: annotation.id, path: picked[0].fsPath });
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : 'Failed to attach the file');
	}
}


/**
 * Annotate an architecture node. Understand annotates architectures as well
 * as code, and the anchor is the node's full path; the picker lists what the
 * project actually has rather than asking anyone to type one.
 */
export async function annotateArchitecture()
{
	let architectures: string[] = [];
	try {
		const result: { architectures: string[] } =
			await variables.languageClient.sendRequest('understand/architectures', {});
		architectures = result.architectures ?? [];
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error
			? error.message : 'Failed to list the architectures');
		return;
	}

	if (!architectures.length) {
		vscode.window.showInformationMessage(
			'This project has no architectures to annotate.');
		return;
	}

	const architecture = await vscode.window.showQuickPick(architectures, {
		placeHolder: 'Annotate which architecture node',
		matchOnDescription: true,
	});
	if (architecture === undefined)
		return;

	await openNewAnnotationForm(
		{ kind: 'architecture', architecture },
		architecture);
}
