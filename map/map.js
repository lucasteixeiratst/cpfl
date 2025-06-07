import { state, mapStyles } from './main.js';
import { applyGroupFilter } from './fileProcessor.js';

let userLocationMarker;

export function initMap() {
    return new maplibregl.Map({
        container: 'map',
        style: mapStyles[2].url, // Voyager
        center: [-47.068847, -22.934973],
        zoom: 11,
        attributionControl: false
    }).addControl(new maplibregl.NavigationControl(), 'top-right');
}

export function resetView(map) {
    map.easeTo({ center: [-47.068847, -22.934973], zoom: 13 });
}

export function goToCurrentLocation(map) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const userCoords = [position.coords.longitude, position.coords.latitude];
            state.userLocation = userCoords;
            map.flyTo({ center: userCoords, zoom: 16 });
            if (userLocationMarker) userLocationMarker.remove();
            userLocationMarker = new maplibregl.Marker({ color: 'blue' })
                .setLngLat(userCoords)
                .addTo(map);
        }, () => {
            alert('Não foi possível obter sua localização.');
        });
    } else {
        alert('Geolocalização não é suportada pelo seu navegador.');
    }
}

export function toggleMarkers(map) {
    state.markersVisible = !state.markersVisible;
    const visibility = state.markersVisible ? 'visible' : 'none';
    state.files.forEach(file => {
        if (file.hasMarkers) {
            const markerLayerId = `marker-circles-${file.sourceId}`;
            const labelLayerId = `marker-labels-${file.sourceId}`;
            if (map.getLayer(markerLayerId)) map.setLayoutProperty(markerLayerId, 'visibility', visibility);
            if (map.getLayer(labelLayerId)) map.setLayoutProperty(labelLayerId, 'visibility', visibility);
        }
    });
}

export function toggleNames(map) {
    state.namesVisible = !state.namesVisible;
    const visibility = state.namesVisible ? 'visible' : 'none';
    state.files.forEach(file => {
        if (file.hasMarkers) {
            const labelLayerId = `marker-labels-${file.sourceId}`;
            if (map.getLayer(labelLayerId)) map.setLayoutProperty(labelLayerId, 'visibility', visibility);
        }
    });
}

export function toggleLines(map) {
    state.linesVisible = !state.linesVisible;
    const visibility = state.linesVisible ? 'visible' : 'none';
    state.files.forEach(file => {
        if (file.hasLines) {
            const lineLayerId = `lines-${file.sourceId}`;
            if (map.getLayer(lineLayerId)) map.setLayoutProperty(lineLayerId, 'visibility', visibility);
        }
    });
}

export function changeMapStyle(map, newStyleUrl) {
    map.setStyle(newStyleUrl);
    map.once('styledata', () => {
        state.files.forEach(file => {
            if (file.hasMarkers) {
                map.addSource(file.sourceId + '-markers', { type: 'geojson', data: file.pointFeatures });
                map.addLayer({
                    id: `marker-circles-${file.sourceId}`,
                    type: 'circle',
                    source: file.sourceId + '-markers',
                    paint: {
                        'circle-radius': 6,
                        'circle-color': '#FF5722',
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#FFFFFF'
                    },
                    layout: { 'visibility': state.markersVisible ? 'visible' : 'none' }
                });
                map.addLayer({
                    id: `marker-labels-${file.sourceId}`,
                    type: 'symbol',
                    source: file.sourceId + '-markers',
                    layout: {
                        'text-field': ['coalesce', ['get', 'name'], ['get', 'Alimentador']],
                        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                        'text-size': 12,
                        'text-offset': [0, 1.5],
                        'visibility': state.namesVisible ? 'visible' : 'none'
                    },
                    paint: {
                        'text-color': '#000000',
                        'text-halo-color': '#FFFFFF',
                        'text-halo-width': 1
                    }
                });
            }
            if (file.hasLines) {
                map.addSource(file.sourceId + '-lines', { type: 'geojson', data: file.lineFeatures });
                map.addLayer({
                    id: `lines-${file.sourceId}`,
                    type: 'line',
                    source: file.sourceId + '-lines',
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': 4
                    },
                    layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
                });
            }
        });
        applyGroupFilter(map);
    });
}
