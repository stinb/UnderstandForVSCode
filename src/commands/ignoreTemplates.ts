import { variables } from '../other/variables';
import { draftForm, openFieldEditor } from '../other/fieldEditor';
import { AnnotationTemplate } from '../types/annotation';


// The template-aware Ignore (sti #4719/#4904): the quick fix's "Ignore ...
// with Details..." action lands here with the violation's coordinates. The
// user picks one of the project's ignore-flagged annotation templates and
// fills its fields in the field editor -- dependent fields offer the options
// their depends-on field's answer allows, exactly like Understand's Ignore
// Violation dialog -- and on Create the server writes the annotation-stored
// ignore. Unlike the comment ignore, the record lives in the project, and
// deleting the annotation brings the violation back.


type IgnoreArg = {
	filePath: string,
	violationsToIgnore: { id: string, line: number },
};


export async function ignoreViolationWithDetails(arg: IgnoreArg)
{
	let templates: AnnotationTemplate[] = [];
	let starting = '';
	try {
		const result: { templates: AnnotationTemplate[], default?: string } =
			await variables.languageClient.sendRequest('understand/ignoreTemplates', {});
		templates = result.templates ?? [];
		starting = result.default ?? '';
	} catch {
		// An older server without the request: fall through to the note.
	}

	// The ignore is written on Create, by the server command the form's
	// anchor names (see saveForm in fieldEditor.ts); its annotation sits on
	// the violation's line, which is what the Metadata is expanded for. The
	// template is picked on the form itself.
	openFieldEditor(await draftForm(`Ignore ${arg.violationsToIgnore.id}`, templates, starting,
		{ kind: 'ignore', ...arg }, { filePath: arg.filePath, line: arg.violationsToIgnore.line }));
}
