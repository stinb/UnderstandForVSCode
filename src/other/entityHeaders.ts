import { TreeView, WebviewView } from 'vscode';


/** The views that follow the entity: their headers name it, after the view's
 * own title (Rob, 2026-10-20). A view container's title cannot change, so
 * the name goes on each view that shows the entity. */
const views: { description?: string }[] = [];


export function followEntity(view: TreeView<unknown> | WebviewView)
{
	views.push(view);
}


export function nameEntityInHeaders(entityName: string)
{
	for (const view of views)
		view.description = entityName;
}
