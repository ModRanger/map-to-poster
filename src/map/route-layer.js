import L from 'leaflet';
import { getMapInstance, getArtisticMapInstance } from './map-init.js';

const ROUTE_SOURCE_ID = 'route-src';
const ROUTE_LAYER_ID = 'route-line';

let leafletLine = null;
let mlListenerAttached = false;
let currentRoute = null;
let currentStyle = { color: '#ef4444', weight: 4, opacity: 1 };

function pointsToLatLngs(points) {
	return points.map((p) => [p.lat, p.lon]);
}

function pointsToGeoJson(points) {
	return {
		type: 'Feature',
		properties: {},
		geometry: {
			type: 'LineString',
			coordinates: points.map((p) => [p.lon, p.lat]),
		},
	};
}

function applyLeafletRoute() {
	const map = getMapInstance();
	if (!map) return;

	if (leafletLine) {
		map.removeLayer(leafletLine);
		leafletLine = null;
	}

	if (!currentRoute || !currentRoute.points || currentRoute.points.length < 2) return;

	leafletLine = L.polyline(pointsToLatLngs(currentRoute.points), {
		color: currentStyle.color,
		weight: currentStyle.weight,
		opacity: currentStyle.opacity,
		lineJoin: 'round',
		lineCap: 'round',
		interactive: false,
	}).addTo(map);
}

function applyMapLibreRoute() {
	const mlMap = getArtisticMapInstance();
	if (!mlMap) return;
	if (!mlMap.isStyleLoaded()) return;

	if (mlMap.getLayer(ROUTE_LAYER_ID)) mlMap.removeLayer(ROUTE_LAYER_ID);
	if (mlMap.getSource(ROUTE_SOURCE_ID)) mlMap.removeSource(ROUTE_SOURCE_ID);
	if (!currentRoute || !currentRoute.points || currentRoute.points.length < 2) return;

	mlMap.addSource(ROUTE_SOURCE_ID, {
		type: 'geojson',
		data: pointsToGeoJson(currentRoute.points),
	});
	mlMap.addLayer({
		id: ROUTE_LAYER_ID,
		type: 'line',
		source: ROUTE_SOURCE_ID,
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: {
			'line-color': currentStyle.color,
			'line-width': currentStyle.weight,
			'line-opacity': currentStyle.opacity,
		},
	});
}

function ensureMapLibreListener() {
	const mlMap = getArtisticMapInstance();
	if (!mlMap || mlListenerAttached) return;
	mlListenerAttached = true;
	mlMap.on('styledata', () => {
		if (!currentRoute) return;
		if (!mlMap.getSource(ROUTE_SOURCE_ID)) {
			try { applyMapLibreRoute(); } catch (_) { }
		}
	});
}

export function updateRoute(route, style) {
	currentRoute = route || null;
	currentStyle = {
		color: (style && style.color) || '#ef4444',
		weight: (style && style.weight) || 4,
		opacity: (style && typeof style.opacity === 'number') ? style.opacity : 1,
	};

	applyLeafletRoute();

	ensureMapLibreListener();
	const mlMap = getArtisticMapInstance();
	if (mlMap && mlMap.isStyleLoaded()) {
		try { applyMapLibreRoute(); } catch (_) { }
	}
}

export function fitToRoute(route, padding = 40) {
	if (!route || !route.stats || !route.stats.bounds) return;
	const { minLat, maxLat, minLon, maxLon } = route.stats.bounds;

	const map = getMapInstance();
	const mlMap = getArtisticMapInstance();

	if (map) {
		map.fitBounds(
			[[minLat, minLon], [maxLat, maxLon]],
			{ padding: [padding, padding], animate: false },
		);
	}
	if (mlMap) {
		mlMap.fitBounds(
			[[minLon, minLat], [maxLon, maxLat]],
			{ padding, animate: false, duration: 0 },
		);
	}
}
