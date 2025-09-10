const ZOOM_FACTOR = 0.75; // ~0 fast, ~1 slow
const ZOOM_FACTOR_INVERSE = 1 / ZOOM_FACTOR;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3;

let zoom = 1;


graph.style.height = window.innerHeight;
graph.style.width = window.innerWidth;

// document.addEventListener('mousewheel', function (e) {
// 	e.preventDefault();

// 	if (e.deltaY > 0)
// 		zoom *= ZOOM_FACTOR;
// 	else
// 		zoom *= ZOOM_FACTOR_INVERSE;

// 	if (zoom > ZOOM_MAX)
// 		zoom = ZOOM_MAX;
// 	else if (zoom < ZOOM_MIN)
// 		zoom = ZOOM_MIN;

// 	graph.style.transform = `scale(${(zoom)})`;
// 	// graph.style.zoom = zoom;
// 	// document.body.style.transform = `scale(${(zoom)})`;
// 	// document.body.style.zoom = zoom;
// }, {passive: false})
