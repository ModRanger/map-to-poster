const R_EARTH_KM = 6371;

function haversineKm(a, b) {
	const toRad = (d) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function computeStats(points) {
	let distanceKm = 0;
	let elevationGainM = 0;
	let elevationLossM = 0;
	let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
	let startTime = null, endTime = null;

	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		if (p.lat < minLat) minLat = p.lat;
		if (p.lat > maxLat) maxLat = p.lat;
		if (p.lon < minLon) minLon = p.lon;
		if (p.lon > maxLon) maxLon = p.lon;

		if (i > 0) {
			distanceKm += haversineKm(points[i - 1], p);
			const prevEle = points[i - 1].ele;
			if (typeof prevEle === 'number' && typeof p.ele === 'number') {
				const d = p.ele - prevEle;
				if (d > 0) elevationGainM += d;
				else elevationLossM += -d;
			}
		}

		if (p.time) {
			if (!startTime) startTime = p.time;
			endTime = p.time;
		}
	}

	const durationSec = startTime && endTime ? Math.max(0, (endTime - startTime) / 1000) : null;

	return {
		distanceKm,
		elevationGainM,
		elevationLossM,
		durationSec,
		bounds: points.length ? { minLat, maxLat, minLon, maxLon } : null,
	};
}

export function parseGpx(xmlText) {
	const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
	const parseError = doc.querySelector('parsererror');
	if (parseError) throw new Error('Invalid GPX: XML is malformed.');

	const root = doc.documentElement;
	if (!root || root.nodeName.toLowerCase() !== 'gpx') {
		throw new Error('Invalid GPX: missing <gpx> root element.');
	}

	const trkpts = Array.from(doc.getElementsByTagName('trkpt'));
	const rtepts = Array.from(doc.getElementsByTagName('rtept'));
	const waypts = Array.from(doc.getElementsByTagName('wpt'));
	const nodes = trkpts.length ? trkpts : rtepts.length ? rtepts : waypts;

	if (!nodes.length) throw new Error('No track, route, or waypoints found in GPX.');

	const points = [];
	for (const n of nodes) {
		const lat = parseFloat(n.getAttribute('lat'));
		const lon = parseFloat(n.getAttribute('lon'));
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

		const eleNode = n.getElementsByTagName('ele')[0];
		const timeNode = n.getElementsByTagName('time')[0];
		const ele = eleNode ? parseFloat(eleNode.textContent) : undefined;
		const timeStr = timeNode ? timeNode.textContent.trim() : null;
		const time = timeStr ? new Date(timeStr) : null;

		points.push({
			lat,
			lon,
			ele: Number.isFinite(ele) ? ele : undefined,
			time: time && !isNaN(time.getTime()) ? time : undefined,
		});
	}

	if (points.length < 2) throw new Error('GPX contains fewer than 2 valid points.');

	const nameNode = doc.querySelector('trk > name, rte > name, metadata > name');
	const name = nameNode ? nameNode.textContent.trim() : null;

	return { points, name, stats: computeStats(points) };
}
