// ---------------------------------------------------------------------------------------
// DATA.JS - Gerenciamento de dados e interação com Supabase
// Última atualização: 2025-06-08 17:38:00
// Autor: lucasteixeiratst
// ---------------------------------------------------------------------------------------

import { supabase, state, SEARCH_CONFIG } from './config.js';
import { AppError, computeDistance, getFeatureCenter, validators } from './utils.js';
import mapController from './map.js';

const cache = {
    features: new Map(),
    files: new Map(),
    lastUpdate: null
};

export async function uploadToSupabase(file) {
    if (!validators.isValidFileName(file.name) || (!validators.isKMZFile(file.name) && !validators.isKMLFile(file.name))) {
        throw new AppError(ERROR_MESSAGES.INVALID_FILE, 'INVALID_FILE_TYPE');
    }

    try {
        let geojson = await processFile(file);
        const features = extractFeatures(geojson);
        let coords = await getCurrentLocation().catch(() => null);

        const { error: uploadError } = await supabase.storage
            .from('arquivos')
            .upload(file.name, file, { upsert: true });

        if (uploadError && !uploadError.message.includes('The resource already exists')) {
            throw new AppError(ERROR_MESSAGES.UPLOAD_FAILED, 'UPLOAD_ERROR', uploadError);
        }

        const { data: publicUrlData } = supabase.storage
            .from('arquivos')
            .getPublicUrl(file.name);

        const meta = {
            nome: file.name,
            url: publicUrlData.publicUrl,
            lat: coords ? coords.latitude : (features.centro ? features.centro[1] : null),
            lng: coords ? coords.longitude : (features.centro ? features.centro[0] : null),
            criado_em: new Date().toISOString(),
            criado_por: 'lucasteixeiratst',
            tamanho: file.size,
            tipo: file.name.split('.').pop().toLowerCase()
        };

        await supabase.from('arquivos').upsert([meta], { onConflict: ['nome'] });
        await supabase.from('features').delete().eq('arquivo_nome', file.name);

        const BATCH_SIZE = 100;
        for (let i = 0; i < features.data.length; i += BATCH_SIZE) {
            const batch = features.data.slice(i, i + BATCH_SIZE).map(f => ({ ...f, arquivo_nome: file.name }));
            await supabase.from('features').insert(batch);
        }

        cache.files.set(file.name, { meta, features: features.data, lastUpdate: Date.now() });

        await mapController.queueLayer(geojson, file.name);
        updateRecentFiles(file.name);

        return { success: true, message: "Arquivo e dados enviados com sucesso!", data: { file: meta, featuresCount: features.data.length } };
    } catch (error) {
        throw new AppError(ERROR_MESSAGES.UPLOAD_FAILED, 'UPLOAD_PROCESS_ERROR', error);
    }
}

async function processFile(file) {
    try {
        if (file.name.endsWith('.kmz')) {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            const kmlFile = zip.file(/\.kml$/i)[0];
            if (!kmlFile) throw new AppError(ERROR_MESSAGES.INVALID_FILE, 'INVALID_KMZ');
            const kmlContent = await kmlFile.async('string');
            return toGeoJSON.kml(new DOMParser().parseFromString(kmlContent, 'text/xml'));
        } else {
            const text = await file.text();
            return toGeoJSON.kml(new DOMParser().parseFromString(text, 'text/xml'));
        }
    } catch (error) {
        throw new AppError(ERROR_MESSAGES.LOAD_FAILED, 'FILE_PROCESSING_ERROR', error);
    }
}

function extractFeatures(geojson) {
    const markers = [];
    const lines = [];
    let center = null;

    geojson.features.forEach(feature => {
        if (feature.geometry.type === 'Point') {
            markers.push({ tipo: 'marker', name: feature.properties?.name || '', alimentador: feature.properties?.Alimentador || '', lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] });
            if (!center) center = feature.geometry.coordinates;
        } else if (['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
            lines.push({ tipo: 'line', name: feature.properties?.name || '', alimentador: feature.properties?.Alimentador || '', coords: JSON.stringify(feature.geometry.coordinates) });
            if (!center) center = calculateGeometryCenter(feature.geometry);
        }
    });

    return { data: [...markers, ...lines], centro: center, total: markers.length + lines.length };
}

export async function searchFeatures(term, options = {}) {
    const { searchType = SEARCH_CONFIG.searchTypes.BOTH, maxResults = SEARCH_CONFIG.maxResults, searchRadius = state.searchRadius } = options;
    const results = { local: [], remote: [], total: 0 };

    try {
        if (searchType !== SEARCH_CONFIG.searchTypes.REMOTE) results.local = searchLocalFeatures(term);
        if (searchType !== SEARCH_CONFIG.searchTypes.LOCAL) results.remote = await searchRemoteFeatures(term);

        const allResults = [...results.local, ...results.remote]
            .filter(Boolean)
            .map(feature => {
                if (!feature.properties.distance && feature.geometry) {
                    const center = getFeatureCenter(feature);
                    feature.properties.distance = state.userLocation ? computeDistance(state.userLocation, center) : 0;
                }
                return feature;
            })
            .sort((a, b) => a.properties.distance - b.properties.distance)
            .slice(0, maxResults);

        results.total = allResults.length;
        return allResults;
    } catch (error) {
        throw new AppError(ERROR_MESSAGES.SEARCH_FAILED, 'SEARCH_ERROR', error);
    }
}

function searchLocalFeatures(term) {
    const results = [];
    const termLower = term.toLowerCase();

    state.files.forEach(file => {
        if (file.hasMarkers) {
            const markerSource = mapController.getMap().getSource(`${file.sourceId}-markers`);
            if (markerSource?._data?.features) markerSource._data.features.forEach(feature => featureMatchesTerm(feature, termLower) && results.push(feature));
        }
        if (file.hasLines) {
            const lineSource = mapController.getMap().getSource(`${file.sourceId}-lines`);
            if (lineSource?._data?.features) lineSource._data.features.forEach(feature => featureMatchesTerm(feature, termLower) && results.push(feature));
        }
    });

    return results;
}

async function searchRemoteFeatures(term) {
    const { data, error } = await supabase
        .from('features')
        .select('*')
        .or(`name.ilike.%${term}%,alimentador.ilike.%${term}%`)
        .limit(SEARCH_CONFIG.maxResults);

    if (error) throw new AppError(ERROR_MESSAGES.SEARCH_FAILED, 'REMOTE_SEARCH_ERROR', error);

    return data.map(f => ({
        type: 'Feature',
        geometry: { type: f.tipo === 'marker' ? 'Point' : 'LineString', coordinates: f.tipo === 'marker' ? [f.lng, f.lat] : JSON.parse(f.coords) },
        properties: { name: f.name, Alimentador: f.alimentador, distance: state.userLocation ? computeDistance(state.userLocation, [f.lng, f.lat]) : 0 }
    }));
}

function featureMatchesTerm(feature, term) {
    return (feature.properties?.name?.toLowerCase().includes(term) || feature.properties?.Alimentador?.toLowerCase().includes(term));
}

function calculateGeometryCenter(geometry) {
    const coords = [];
    function extractCoords(c) { if (typeof c[0] === 'number') coords.push(c); else c.forEach(extractCoords); }
    extractCoords(geometry.coordinates);
    const lons = coords.map(c => c[0]), lats = coords.map(c => c[1]);
    return [lons.reduce((a, b) => a + b, 0) / lons.length, lats.reduce((a, b) => a + b, 0) / lats.length];
}

async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) reject(new Error(ERROR_MESSAGES.GEOLOCATION_UNSUPPORTED));
        navigator.geolocation.getCurrentPosition(resolve, reject);
    });
}

export function updateRecentFiles(fileName) {
    let recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    recentFiles = recentFiles.filter(f => f !== fileName).unshift(fileName).slice(0, 5);
    localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
}

export default { uploadToSupabase, searchFeatures, cache };
