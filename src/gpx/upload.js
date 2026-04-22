import { parseGpx } from './parser.js';
import { state, updateState, subscribe } from '../core/state.js';

const MAX_BYTES = 10 * 1024 * 1024;

function formatDistance(km) {
	if (km < 10) return `${km.toFixed(2)} km`;
	return `${km.toFixed(1)} km`;
}

function formatDuration(sec) {
	if (!sec || !Number.isFinite(sec)) return null;
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

function showError(statusEl, message) {
	if (!statusEl) return;
	statusEl.textContent = message;
	statusEl.classList.remove('hidden', 'text-slate-500');
	statusEl.classList.add('text-red-600');
}

function showInfo(statusEl, message) {
	if (!statusEl) return;
	statusEl.textContent = message;
	statusEl.classList.remove('hidden', 'text-red-600');
	statusEl.classList.add('text-slate-500');
}

function clearStatus(statusEl) {
	if (!statusEl) return;
	statusEl.textContent = '';
	statusEl.classList.add('hidden');
}

async function handleFile(file, { statusEl }) {
	clearStatus(statusEl);

	if (!file) return;
	if (!/\.gpx$/i.test(file.name)) {
		showError(statusEl, 'File must have a .gpx extension.');
		return;
	}
	if (file.size > MAX_BYTES) {
		showError(statusEl, `File too large (max ${MAX_BYTES / 1024 / 1024} MB).`);
		return;
	}

	try {
		const text = await file.text();
		const parsed = parseGpx(text);
		updateState({
			route: {
				points: parsed.points,
				stats: parsed.stats,
				name: parsed.name || file.name.replace(/\.gpx$/i, ''),
			},
		});
		showInfo(statusEl, `Loaded ${parsed.points.length.toLocaleString()} points.`);
	} catch (err) {
		showError(statusEl, err && err.message ? err.message : 'Failed to parse GPX.');
	}
}

function renderSummary(route, summaryEl) {
	if (!summaryEl) return;
	if (!route) {
		summaryEl.classList.add('hidden');
		return;
	}
	const stats = route.stats || {};
	const parts = [];
	if (route.name) parts.push(`<div class="font-semibold text-slate-900 truncate">${escapeHtml(route.name)}</div>`);
	const metaBits = [];
	if (Number.isFinite(stats.distanceKm)) metaBits.push(formatDistance(stats.distanceKm));
	if (Number.isFinite(stats.elevationGainM) && stats.elevationGainM > 0) {
		metaBits.push(`+${Math.round(stats.elevationGainM)} m`);
	}
	const dur = formatDuration(stats.durationSec);
	if (dur) metaBits.push(dur);
	if (metaBits.length) parts.push(`<div class="text-xs text-slate-500">${metaBits.join(' • ')}</div>`);
	summaryEl.innerHTML = parts.join('');
	summaryEl.classList.remove('hidden');
}

function escapeHtml(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function initGpxUpload() {
	const dropzone = document.getElementById('gpx-dropzone');
	const fileInput = document.getElementById('gpx-file-input');
	const statusEl = document.getElementById('gpx-status');
	const summaryEl = document.getElementById('gpx-summary');
	const clearBtn = document.getElementById('gpx-clear-btn');
	const panelEl = document.getElementById('gpx-loaded-panel');

	if (!dropzone || !fileInput) return;

	fileInput.addEventListener('change', (e) => {
		const file = e.target.files && e.target.files[0];
		handleFile(file, { statusEl });
		fileInput.value = '';
	});

	['dragenter', 'dragover'].forEach((evt) => {
		dropzone.addEventListener(evt, (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropzone.classList.add('ring-2', 'ring-accent');
		});
	});
	['dragleave', 'drop'].forEach((evt) => {
		dropzone.addEventListener(evt, (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropzone.classList.remove('ring-2', 'ring-accent');
		});
	});
	dropzone.addEventListener('drop', (e) => {
		const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
		handleFile(file, { statusEl });
	});
	dropzone.addEventListener('click', () => fileInput.click());
	dropzone.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			fileInput.click();
		}
	});

	clearBtn?.addEventListener('click', () => {
		updateState({ route: null });
		clearStatus(statusEl);
	});

	subscribe((s) => {
		renderSummary(s.route, summaryEl);
		if (panelEl) panelEl.classList.toggle('hidden', !s.route);
		if (dropzone) dropzone.classList.toggle('hidden', !!s.route);
	});
}
