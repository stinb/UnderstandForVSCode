'use strict';


import * as vscode from 'vscode';

import { getBooleanFromConfig } from './config';
import { getViolationDescription } from './textProviders';
import { getId } from './uriHandler';


/** Show more information when the user hovers the mouse */
export class UnderstandHoverProvider implements vscode.HoverProvider {
	async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover>
	{
		// Stop if the user disabled detailed descriptions
		if (!getBooleanFromConfig('understand.violations.hover.detailedDescription', true))
			return new vscode.Hover([]);

		const markdownStrings: vscode.MarkdownString[] = [];
		const usedIds = new Set();

		// Each violation in the hovered file
		for (const violation of vscode.languages.getDiagnostics(document.uri)) {
			// Skip if there's no detailed description URI
			if (typeof violation.code !== 'object')
				continue;

			// Skip if the violation isn't at the line of the hover
			if (violation.range.start.line != position.line)
				continue;

			// Get token length
			const maxScanAhead = 64;
			const text = document.getText(translateRangeChars(violation.range, 0, maxScanAhead));
			const tokenEndMatch = /^\w+/.exec(text);
			const tokenLength = tokenEndMatch ? tokenEndMatch[0].length : 1;

			// Skip if the violation isn't at the hover
			const modifiedViolationRange = translateRangeChars(violation.range, -1, tokenLength);
			if (!modifiedViolationRange.contains(position))
				continue;

			// Skip if already added this detailed description to this position
			if (usedIds.has(violation.code.value))
				continue;
			usedIds.add(violation.code.value);

			// Read and display content of detailed description
			const id = getId(violation.code.target);
			const string = await getViolationDescription(id, token);
			if (string.length === 0) {
				const errorString = `Failed to preview ${id}`;
				markdownStrings.push(new vscode.MarkdownString(errorString));
				continue;
			}
			const markdownString = new vscode.MarkdownString(string);
			markdownString.supportHtml = true;
			markdownStrings.push(markdownString);
		}

		return new vscode.Hover(markdownStrings);
	}
}


/** Given a range, change the translate the start character and end character */
function translateRangeChars(range: vscode.Range, translateStart: number, translateEnd: number)
{
	const newStartChar = clampToNonNegative(range.start.character + translateStart);
	const newEndChar   = clampToNonNegative(range.end.character + translateEnd);
	return new vscode.Range(range.start.line, newStartChar, range.end.line, newEndChar);
}


/** Clamp a number to be non-negative (0 ... infinity) */
function clampToNonNegative(n: number)
{
	return (n >= 0) ? n : 0;
}
