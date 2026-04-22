import './style.css';
import { subscribe, state, updateState, getSelectedTheme } from './src/core/state.js';
import { initMap, updateMapTheme, invalidateMapSize, waitForTilesLoad, waitForArtisticIdle, updateMarkerVisibility, updateMarkerPosition } from './src/map/map-init.js';
import { setupControls, updatePreviewStyles } from './src/ui/form.js';
import { exportToPNG } from './src/core/export.js';
import { initGpxUpload } from './src/gpx/upload.js';
import { updateRoute, fitToRoute } from './src/map/route-layer.js';

const initialTheme = getSelectedTheme();
initMap('map-preview', [state.lat, state.lon], state.zoom, initialTheme.tileUrl);

const syncUI = setupControls();
initGpxUpload();
initRouteStyleControls();
initFitToRouteButton();

const exportBtn = document.getElementById('export-btn');
const posterContainer = document.getElementById('poster-container');

const mobileToggle = document.getElementById('mobile-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const toggleIcon = mobileToggle?.querySelector('.toggle-icon');

function updateMobileToggleColor(currentState) {
	if (!mobileToggle) return;
	if (currentState.renderMode === 'artistic') {
		mobileToggle.classList.remove('bg-slate-900');
		mobileToggle.classList.add('bg-accent');
	} else {
		mobileToggle.classList.add('bg-slate-900');
		mobileToggle.classList.remove('bg-accent');
	}
}

function toggleSidebar(force) {
	const isOpen = document.body.classList.toggle('sidebar-open', force);
	if (toggleIcon) {
		toggleIcon.innerHTML = isOpen
			? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />'
			: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16m-7 6h7" />';
	}
	if (isOpen) {
		setTimeout(invalidateMapSize, 300);
	}
}

mobileToggle?.addEventListener('click', () => toggleSidebar());
sidebarOverlay?.addEventListener('click', () => toggleSidebar(false));

subscribe((currentState, previousState) => {
	if (previousState && (currentState.lat !== previousState.lat || currentState.lon !== previousState.lon)) {
		if (window.innerWidth < 768) {
			toggleSidebar(false);
		}
	}
});

let _exportCheckInProgress = false;
const originalExportInner = exportBtn ? exportBtn.innerHTML : '';
let exportLoadingMode = null;

let _lastRoute = undefined;
let _lastRouteStyle = undefined;

subscribe((currentState) => {
	if (currentState.renderMode === 'tile') {
		const theme = getSelectedTheme();
		const tileUrl = currentState.showLabels ? theme.tileUrl : theme.tileUrlNoLabels;
		updateMapTheme(tileUrl);
	}

	updatePreviewStyles(currentState);
	updateMobileToggleColor(currentState);

	updateMarkerVisibility(currentState.showMarker);
	updateMarkerPosition(currentState.markerLat, currentState.markerLon);

	if (currentState.route !== _lastRoute || currentState.routeStyle !== _lastRouteStyle) {
		const justLoaded = currentState.route && !_lastRoute;
		_lastRoute = currentState.route;
		_lastRouteStyle = currentState.routeStyle;
		updateRoute(currentState.route, currentState.routeStyle);
		if (justLoaded) fitToRoute(currentState.route);
	}

	syncUI(currentState);
	ensurePreviewReady();
});

function initRouteStyleControls() {
	const colorInput = document.getElementById('route-color-input');
	const weightInput = document.getElementById('route-weight-input');
	if (colorInput) {
		colorInput.value = state.routeStyle?.color || '#ef4444';
		colorInput.addEventListener('input', (e) => {
			updateState({ routeStyle: { ...state.routeStyle, color: e.target.value } });
		});
	}
	if (weightInput) {
		weightInput.value = String(state.routeStyle?.weight || 4);
		weightInput.addEventListener('input', (e) => {
			updateState({ routeStyle: { ...state.routeStyle, weight: Number(e.target.value) } });
		});
	}
}

function initFitToRouteButton() {
	const btn = document.getElementById('gpx-fit-btn');
	btn?.addEventListener('click', () => {
		if (state.route) fitToRoute(state.route);
	});
}

function setExportButtonLoading(loading, mode = 'loading') {
	if (!exportBtn) return;
	if (loading && mode === 'loading' && exportLoadingMode === 'processing') return;

	if (loading) exportLoadingMode = mode; else exportLoadingMode = null;

	exportBtn.disabled = !!loading;
	exportBtn.setAttribute('aria-busy', loading ? 'true' : 'false');
	exportBtn.classList.toggle('opacity-60', !!loading);
	exportBtn.classList.toggle('cursor-not-allowed', !!loading);
	if (loading) {
		exportBtn.innerHTML = `
			<div class="flex items-center justify-center space-x-3">
				<div class="flex items-center space-x-1">
					<div class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style="animation-delay: 0s"></div>
					<div class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
					<div class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
				</div>
				<span>${mode === 'processing' ? 'Processing...' : 'Loading...'}</span>
			</div>
		`;
	} else {
		exportBtn.innerHTML = originalExportInner;
	}
}

async function ensurePreviewReady() {
	if (_exportCheckInProgress) return;
	if (exportLoadingMode === 'processing') return;
	_exportCheckInProgress = true;
	try {
		setExportButtonLoading(true, 'loading');
		if (state.renderMode === 'artistic') {
			await waitForArtisticIdle(3000);
		} else {
			await waitForTilesLoad(5000);
		}
	} finally {
		setExportButtonLoading(false);
		_exportCheckInProgress = false;
	}
}

exportBtn.addEventListener('click', async () => {
	const filename = `MapToPoster-${state.city.replace(/\s+/g, '-')}-${Date.now()}.png`;
	setExportButtonLoading(true, 'processing');
	try {
		await exportToPNG(posterContainer, filename, null);
	} finally {
		setExportButtonLoading(false);
	}
});

ensurePreviewReady();

window.addEventListener('resize', () => {
	updatePreviewStyles(state);
});

setTimeout(invalidateMapSize, 500);
