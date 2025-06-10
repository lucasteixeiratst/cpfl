// map.js - atualizado com melhorias básicas de funcionamento
import { MAP_CONFIG, FEATURE_CONFIG, state, updateState } from './config.js';
import { AppError, computeDistance, getFeatureCenter, generateRandomColor } from './utils.js';

const maplibregl = window.maplibregl; // Garante acesso ao objeto global

let map = null;
let loadingQueue = [];
let isProcessingQueue = false;

export async function initMap() {
    return new Promise((resolve, reject) => {
        try {
            if (typeof maplibregl === 'undefined') {
                reject(new AppError('MapLibre não foi carregado corretamente.', 'MAPLIBRE_MISSING'));
                return;
            }
            const mapElement = document.getElementById('map');
            if (!mapElement) {
                reject(new AppError('Elemento #map não encontrado no DOM', 'MAP_CONTAINER_ERROR'));
                return;
            }

            map = new maplibregl.Map({
                container: 'map',
                style: MAP_CONFIG.styles.find(s => s.name === state.currentStyle)?.url || MAP_CONFIG.styles[0].url,
                center: MAP_CONFIG.initialView.center,
                zoom: MAP_CONFIG.initialView.zoom,
                minZoom: MAP_CONFIG.initialView.minZoom,
                maxZoom: MAP_CONFIG.initialView.maxZoom
            });

            map.on('load', () => {
                console.log('Mapa inicializado com sucesso');
                document.getElementById('loading-overlay')?.style.display = 'none';
                resolve(map);
            });

            map.on('error', (error) => {
                console.error('Erro na inicialização do mapa:', error);
                reject(new AppError('Falha ao inicializar o mapa', 'MAP_INIT_ERROR', error));
            });

            map.addControl(new maplibregl.NavigationControl(), 'top-right');
            map.addControl(new maplibregl.ScaleControl(), 'bottom-right');
            map.addControl(new maplibregl.AttributionControl({ compact: true })); // Boa prática
        } catch (error) {
            console.error('Erro crítico na inicialização do mapa:', error);
            reject(new AppError('Erro crítico na inicialização do mapa', 'CRITICAL_MAP_ERROR', error));
        }
    });
}

export function addLayerToMap(geojson, fileName) {
    const sourceId = `source-${fileName.replace(/\s+/g, '_')}`;

    if (state.files.find(file => file.name === fileName)) {
        throw new AppError(`O arquivo "${fileName}" já está carregado.`, 'DUPLICATE_FILE');
    }

    try {
        const pointFeatures = { type: 'FeatureCollection', features: geojson.features.filter(f => f.geometry.type === 'Point') };
        const lineFeatures = { type: 'FeatureCollection', features: geojson.features.filter(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') };
        const polygonFeatures = { type: 'FeatureCollection', features: geojson.features.filter(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') };

        if (pointFeatures.features.length > 0) {
            map.addSource(`${sourceId}-markers`, { type: 'geojson', data: pointFeatures });
            map.addLayer({
                id: `marker-circles-${sourceId}`,
                type: 'circle',
                source: `${sourceId}-markers`,
                paint: {
                    'circle-radius': FEATURE_CONFIG.markers.radius,
                    'circle-color': FEATURE_CONFIG.markers.color,
                    'circle-stroke-width': FEATURE_CONFIG.markers.strokeWidth,
                    'circle-stroke-color': FEATURE_CONFIG.markers.strokeColor
                },
                layout: { 'visibility': state.markersVisible ? 'visible' : 'none' }
            });
            map.addLayer({
                id: `marker-labels-${sourceId}`,
                type: 'symbol',
                source: `${sourceId}-markers`,
                layout: {
                    'text-field': ['coalesce', ['get', 'name'], ['get', 'Alimentador']],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': FEATURE_CONFIG.labels.size,
                    'text-offset': FEATURE_CONFIG.labels.offset,
                    'visibility': state.namesVisible ? 'visible' : 'none'
                },
                paint: {
                    'text-color': FEATURE_CONFIG.labels.color,
                    'text-halo-color': FEATURE_CONFIG.labels.haloColor,
                    'text-halo-width': FEATURE_CONFIG.labels.haloWidth
                }
            });
        }

        if (lineFeatures.features.length > 0) {
            map.addSource(`${sourceId}-lines`, { type: 'geojson', data: lineFeatures });
            map.addLayer({
                id: `lines-${sourceId}`,
                type: 'line',
                source: `${sourceId}-lines`,
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': FEATURE_CONFIG.lines.width
                },
                layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
            });
            map.addLayer({
                id: `line-labels-${sourceId}`,
                type: 'symbol',
                source: `${sourceId}-lines`,
                layout: {
                    'text-field': ['get', 'Alimentador'],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': 10,
                    'text-offset': [0, 1],
                    'text-allow-overlap': true,
                    'visibility': state.namesVisible ? 'visible' : 'none'
                },
                paint: {
                    'text-color': '#000000',
                    'text-halo-color': '#FFFFFF',
                    'text-halo-width': 1
                }
            });
        }

        if (polygonFeatures.features.length > 0) {
            map.addSource(`${sourceId}-polygons`, { type: 'geojson', data: polygonFeatures });
            map.addLayer({
                id: `polygons-${sourceId}`,
                type: 'fill',
                source: `${sourceId}-polygons`,
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.5
                },
                layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
            });
            map.addLayer({
                id: `polygon-outlines-${sourceId}`,
                type: 'line',
                source: `${sourceId}-polygons`,
                paint: {
                    'line-color': '#000',
                    'line-width': 1
                },
                layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
            });
        }

        state.files.push({
            name: fileName,
            sourceId,
            hasMarkers: pointFeatures.features.length > 0,
            hasLines: lineFeatures.features.length > 0,
            hasPolygons: polygonFeatures.features.length > 0,
            pointFeatures,
            lineFeatures,
            polygonFeatures
        });

        return true;
    } catch (error) {
        console.error('Erro ao adicionar camada ao mapa:', error);
        throw new AppError('Falha ao adicionar camada ao mapa', 'LAYER_ADD_ERROR', error);
    }
}

export function toggleLayerVisibility(layerId, visible) {
    if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        return true;
    }
    return false;
}

export function flyToLocation(coordinates, zoom = 16) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new AppError('Coordenadas inválidas', 'INVALID_COORDINATES');
    }
    map.flyTo({ center: coordinates, zoom, essential: true });
}

export function addUserLocationMarker(coordinates) {
    if (state.userLocationMarker) state.userLocationMarker.remove();
    state.userLocationMarker = new maplibregl.Marker({ color: '#0088ff', scale: 1.2 })
        .setLngLat(coordinates)
        .addTo(map);
    return state.userLocationMarker;
}

async function processLoadingQueue() {
    if (isProcessingQueue || loadingQueue.length === 0) return;
    isProcessingQueue = true;

    while (loadingQueue.length > 0 && loadingQueue.length <= state.maxConcurrentLoads) {
        const { geojson, fileName, resolve, reject } = loadingQueue.shift();
        try {
            await addLayerToMap(geojson, fileName);
            resolve(true);
        } catch (error) {
            reject(error);
        }
        await new Promise(r => setTimeout(r, 100));
    }
    isProcessingQueue = false;
}

export default {
    initMap,
    addLayerToMap,
    toggleLayerVisibility,
    flyToLocation,
    addUserLocationMarker,
    getMap: () => map,
    getLoadingQueueSize: () => loadingQueue.length,
    queueLayer: (geojson, fileName) => new Promise((resolve, reject) => {
        loadingQueue.push({ geojson, fileName, resolve, reject });
        processLoadingQueue();
    }),
    clearLoadingQueue: () => {
        loadingQueue = [];
        isProcessingQueue = false;
    }
};
