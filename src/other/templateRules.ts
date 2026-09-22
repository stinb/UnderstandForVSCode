// The rules a template's closed-set fields obey in the field editor's form
// (res/views/annotations.js): which options a field offers given the answers
// so far, and which values it holds. The build bundles this file to
// res/views/templateRules.js for the webview, so the form applies the one
// rule Understand's own card applies.


export type FieldValues = { [key: string]: string | string[] };

export type OptionField = {
	key: string,
	options?: string[],
	parentField?: string,
	optionsByParent?: { [parentValue: string]: string[] },
};


/**
 * The options a field offers for its depends-on field's current value(s):
 * the union of every selected parent value's list, then the base options,
 * each once.
 */
export function offeredOptions(field: OptionField, values: FieldValues): string[]
{
	const offered: string[] = [];
	if (field.parentField && field.optionsByParent) {
		for (const parentValue of heldValues({ key: field.parentField }, values))
			for (const option of field.optionsByParent[parentValue] ?? [])
				if (!offered.includes(option))
					offered.push(option);
	}
	for (const option of field.options ?? [])
		if (!offered.includes(option))
			offered.push(option);
	return offered;
}


/** The value(s) a field currently holds, always as a list. */
export function heldValues(field: { key: string }, values: FieldValues): string[]
{
	const held = values[field.key];
	return Array.isArray(held) ? held : held ? [held] : [];
}
