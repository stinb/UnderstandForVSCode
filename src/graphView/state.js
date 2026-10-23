// @ts-check
// What every part of the graph view shares: the extension's API, the graph's info and the selection


/**
@typedef {import('../types/graph').GraphMessageFromSandbox} GraphMessageFromSandbox
@typedef {import('../types/graph').GraphInfo} GraphInfo
*/


/** @type {{
	getState: () => any,
	postMessage: (message: GraphMessageFromSandbox) => void,
	setState: (newState: any) => void,
}} */
// @ts-ignore
export const vscode = acquireVsCodeApi();

/** @type {GraphInfo | undefined} */
export let info = undefined;


/** @param {GraphInfo} newInfo */
export function setInfo(newInfo)
{
	info = newInfo;
}


/** The selected nodes, by their data-id */
/** @type {Set<string>} */
export const selected = new Set;

/** The selected edges, by their data-edge index; an edge acts as its tail */
/** @type {Set<string>} */
export const selectedEdges = new Set;
