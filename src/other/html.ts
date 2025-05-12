export function escapeHtml(s: string)
{
	return String(s).replace(/[&<>"'`=\/]/g, fromEntityMap);
}


const entityMap = new Map([
	['&', '&amp;'],
	['<', '&lt;'],
	['>', '&gt;'],
	['"', '&quot;'],
	["'", '&#39;'],
	['/', '&#x2F;'],
	['`', '&#x60;'],
	['=', '&#x3D;'],
]);


function fromEntityMap(s: string)
{
	return entityMap.get(s) || '';
}
