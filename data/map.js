// ---------------------------------------------------------------------------------------
// MAP.JS - Funções de controle e manipulação do mapa
// Última atualização: 2025-06-08 20:16:21
// Autor: lucasteixeiratst
// ---------------------------------------------------------------------------------------

import { MAP_CONFIG, FEATURE_CONFIG, state, updateState } from './config.js';
import { AppError, computeDistance, getFeatureCenter } from './utils.js';

let map = null;
let loadingQueue = [];
let isProcessingQueue = false;

// Inicialização do Mapa
export async function initMap() {
    return new Promise((resolve, reject) => {
        try {
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
                document.getElementById('loading-overlay').style.display = 'none';
                resolve(map);
            });

            map.on('error', (error) => {
                console.error('Erro na inicialização do mapa:', error);
                reject(new AppError('Falha ao inicializar o mapa', 'MAP_INIT_ERROR', error));
            });

            // Adiciona controles ao mapa
            map.addControl(new maplibregl.NavigationControl(), 'top-right');
            map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

        } catch (error) {
            console.error('Erro crítico na inicialização do mapa:', error);
            reject(new AppError('Erro crítico na inicialização do mapa', 'CRITICAL_MAP_ERROR', error));
        }
    });
}

// Gerenciamento de Camadas
export function addLayerToMap(geojson, fileName) {
    const sourceId = `source-${fileName.replace(/\s+/g, '_')}`;
    
    // Valida se o arquivo já está carregado
    if (state.files.find(file => file.name === fileName)) {
        throw new AppError(`O arquivo "${fileName}" já está carregado.`, 'DUPLICATE_FILE');
    }

    try {
        // Separa features por tipo
        const pointFeatures = {
            type: 'FeatureCollection',
            features: geojson.features.filter(f => f.geometry.type === 'Point')
        };

        const lineFeatures = {
            type: 'FeatureCollection',
            features: geojson.features.filter(f => 
                ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(f.geometry.type)
            )
        };

        // Adiciona marcadores
        if (pointFeatures.features.length > 0) {
            map.addSource(`${sourceId}-markers`, {
                type: 'geojson',
                data: pointFeatures
            });

            // Círculos dos marcadores
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
                layout: {
                    'visibility': state.markersVisible ? 'visible' : 'none'
                }
            });

            // Labels dos marcadores
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

        // Adiciona linhas
        if (lineFeatures.features.length > 0) {
            // Adiciona cores aleatórias para as linhas se não existirem
            lineFeatures.features.forEach(feature => {
                if (!feature.properties.color) {
                    feature.properties.color = generateRandomColor();
                }
            });

            map.addSource(`${sourceId}-lines`, {
                type: 'geojson',
                data: lineFeatures
            });

            map.addLayer({
                id: `lines-${sourceId}`,
                type: 'line',
                source: `${sourceId}-lines`,
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': FEATURE_CONFIG.lines.width
                },
                layout: {
                    'visibility': state.linesVisible ? 'visible' : 'none'
                }
            });
        }

        // Atualiza estado
        state.files.push({
            name: fileName,
            sourceId,
            hasMarkers: pointFeatures.features.length > 0,
            hasLines: lineFeatures.features.length > 0,
            pointFeatures,
            lineFeatures
        });

        return true;
    } catch (error) {
        console.error('Erro ao adicionar camada ao mapa:', error);
        throw new AppError('Falha ao adicionar camada ao mapa', 'LAYER_ADD_ERROR', error);
    }
}

// Controle de Visibilidade
export function toggleLayerVisibility(layerId, visible) {
    if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        return true;
    }
    return false;
}

// Navegação
export function flyToLocation(coordinates, zoom = 16) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new AppError('Coordenadas inválidas', 'INVALID_COORDINATES');
    }

    map.flyTo({
        center: coordinates,
        zoom: zoom,
        essential: true
    });
}

// Gerenciamento de Marcadores
export function addUserLocationMarker(coordinates) {
    if (state.userLocationMarker) {
        state.userLocationMarker.remove();
    }

    state.userLocationMarker = new maplibregl.Marker({
        color: '#0088ff',
        scale: 1.2
    })
    .setLngLat(coordinates)
    .addTo(map);

    return state.userLocationMarker;
}

// Fila de Carregamento
async function processLoadingQueue() {
    if (isProcessingQueue || loadingQueue.length === 0) return;

    isProcessingQueue = true;

    while (loadingQueue.length > 0) {
        const { geojson, fileName, resolve, reject } = loadingQueue.shift();

        try {
            await addLayerToMap(geojson, fileName);
            resolve(true);
        } catch (error) {
            reject(error);
        }

        // Pequeno delay entre carregamentos para não sobrecarregar
        await new Promise(r => setTimeout(r, 100));
    }

    isProcessingQueue = false;
}

// Exporta interface pública
export default {
    initMap,
    addLayerToMap,
    toggleLayerVisibility,
    flyToLocation,
    addUserLocationMarker,
    
    // Getters
    getMap: () => map,
    getLoadingQueueSize: () => loadingQueue.length,
    
    // Queue management
    queueLayer: (geojson, fileName) => {
        return new Promise((resolve, reject) => {
            loadingQueue.push({ geojson, fileName, resolve, reject });
            processLoadingQueue();
        });
    },
    
    clearLoadingQueue: () => {
        loadingQueue = [];
        isProcessingQueue = false;
    }
};