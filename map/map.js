import { state, mapStyles } from './main.js';
import { applyGroupFilter, updateGroupMenu, updateLoadedFilesList } from './fileProcessor.js';

// Inicializar mapa
export function initMap() {
    return new maplibregl.Map({
        container: 'map',
        style: mapStyles[2].url, // Voyager
        center: [-47.068847, -22.934973],
        zoom: 11,
        attributionControl: false // Desativa atribuição padrão para personalização futura
    }).addControl(new maplibregl.NavigationControl(), 'top-right'); // Adiciona controles de zoom
}

// Adicionar dados ao mapa
export function addDataToMap(geojson, fileName, map) {
    const sanitizedFileName = fileName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const sourceId = `source-${sanitizedFileName}`;
    const markerLayerId = `marker-circles-${sourceId}`;
    const labelLayerId = `marker-labels-${sourceId}`;
    const lineLayerId = `lines-${sourceId}`;

    // Verificar se o arquivo já está carregado
    if (state.files.find(file => file.name === fileName)) {
        alert(`O arquivo "${fileName}" já está carregado.`);
        return;
    }

    // Separar features em pontos e linhas
    const pointFeaturesArray = [];
    const lineFeaturesArray = [];

    function extractGeometries(feature) {
        const geometries = [];
        if (feature.geometry.type === 'GeometryCollection') {
            feature.geometry.geometries.forEach(geom => {
                geometries.push({ ...feature, geometry: geom });
            });
        } else {
            geometries.push(feature);
        }
        return geometries;
    }

    geojson.features.forEach(feature => {
        const features = extractGeometries(feature);
        features.forEach(f => {
            if (f.geometry.type === 'Point') {
                pointFeaturesArray.push(f);
            } else if (['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(f.geometry.type)) {
                f.properties = f.properties || {};
                if (!f.properties.color) {
                    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                    f.properties.color = color;
                }
                lineFeaturesArray.push(f);
            }
        });
    });

    const pointFeatures = { type: 'FeatureCollection', features: pointFeaturesArray };
    const lineFeatures = { type: 'FeatureCollection', features: lineFeaturesArray };

    // Identificar propriedade de agrupamento
    let groupingProperty = null;
    const exampleLine = lineFeatures.features.find(f => f.properties && (f.properties.Alimentador || f.properties.name));
    if (exampleLine) {
        groupingProperty = exampleLine.properties.Alimentador ? 'Alimentador' : 'name';
    }

    const groupsSet = new Set();
    if (lineFeatures.features.length > 0 && groupingProperty) {
        lineFeatures.features.forEach(f => {
            if (f.properties && f.properties[groupingProperty]) {
                groupsSet.add(f.properties[groupingProperty]);
            }
        });
    }

    if (groupingProperty && groupsSet.size > 0) {
        state.selectedGroups.set(sourceId, new Set(groupsSet));
    }

    // Adicionar arquivo ao estado
    state.files.push({
        name: fileName,
        sourceId: sourceId,
        hasMarkers: pointFeatures.features.length > 0,
        hasLines: lineFeatures.features.length > 0,
        groupingProperty: groupingProperty,
        pointFeatures: pointFeatures,
        lineFeatures: lineFeatures
    });

    // Adicionar marcadores
    if (pointFeatures.features.length > 0) {
        map.addSource(sourceId + '-markers', { type: 'geojson', data: pointFeatures });
        map.addLayer({
            id: markerLayerId,
            type: 'circle',
            source: sourceId + '-markers',
            paint: {
                'circle-radius': 6,
                'circle-color': '#FF5722',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#FFFFFF'
            },
            layout: { 'visibility': state.markersVisible ? 'visible' : 'none' }
        });

        map.addLayer({
            id: labelLayerId,
            type: 'symbol',
            source: sourceId + '-markers',
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

    // Adicionar linhas
    if (lineFeatures.features.length > 0) {
        map.addSource(sourceId + '-lines', { type: 'geojson', data: lineFeatures });
        map.addLayer({
            id: lineLayerId,
            type: 'line',
            source: sourceId + '-lines',
            paint: {
                'line-color': ['get', 'color'],
                'line-width': 4
            },
            layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
        });
    }

    // Atualizar interface
    updateGroupMenu(map);
    updateLoadedFilesList(fileName, map);
}

// Resetar visão do mapa
export function resetView(map) {
    map.easeTo({
        center: [-47.068847, -22.934973],
        zoom: 13,
        duration: 1000 // Suavizar transição
    });
}

// Ir para localização atual
let userLocationMarker;
export function goToCurrentLocation(map) {
    if (!navigator.geolocation) {
        alert('Geolocalização não é suportada pelo seu navegador.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userCoords = [position.coords.longitude, position.coords.latitude];
            state.userLocation = userCoords;
            map.flyTo({
                center: userCoords,
                zoom: 16,
                duration: 1000
            });
            if (userLocationMarker) userLocationMarker.remove();
            userLocationMarker = new maplibregl.Marker({ color: '#4285F4' })
                .setLngLat(userCoords)
                .addTo(map);
        },
        () => {
            alert('Não foi possível obter sua localização.');
        },
        { enableHighAccuracy: true }
    );
}

// Trocar estilo do mapa
export function changeMapStyle(newStyleUrl, map) {
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

// Alternar visibilidade de marcadores
export function toggleMarkers(map) {
    state.markersVisible = !state.markersVisible;
    const visibility = state.markersVisible ? 'visible' : 'none';
    state.files.forEach(file => {
        if (file.hasMarkers) {
            const markerLayerId = `marker-circles-${file.sourceId}`;
            const labelLayerId = `marker-labels-${file.sourceId}`;
            if (map.getLayer(markerLayerId)) {
                map.setLayoutProperty(markerLayerId, 'visibility', visibility);
            }
            if (map.getLayer(labelLayerId)) {
                map.setLayoutProperty(labelLayerId, 'visibility', visibility);
            }
        }
    });
}

// Alternar visibilidade de nomes
export function toggleNames(map) {
    state.namesVisible = !state.namesVisible;
    const visibility = state.namesVisible ? 'visible' : 'none';
    state.files.forEach(file => {
        if (file.hasMarkers) {
            const labelLayerId = `marker-labels-${file.sourceId}`;
            if (map.getLayer(labelLayerId)) {
                map.setLayoutProperty(labelLayerId, 'visibility', visibility);
            }
        }
    });
}

// Alternar visibilidade de linhas
export function toggleLines(map) {
    state.linesVisible = !state.linesVisible;
    const visibility = state.linesVisible ? 'visible' : 'none';
    state.files.forEach(file => {
        if (file.hasLines) {
            const lineLayerId = `lines-${file.sourceId}`;
            if (map.getLayer(lineLayerId)) {
                map.setLayoutProperty(lineLayerId, 'visibility', visibility);
            }
        }
    });
}
