// ---------------------------------------------------------------------------------------
// DATA.JS - Gerenciamento de dados e interação com Supabase
// Última atualização: 2025-06-08 20:17:14
// Autor: lucasteixeiratst
// ---------------------------------------------------------------------------------------

import { supabase, state, SEARCH_CONFIG } from './config.js';
import { AppError, computeDistance } from './utils.js';
import mapController from './map.js';

// Cache local para otimização
const cache = {
    features: new Map(),
    files: new Map(),
    lastUpdate: null
};

// Gerenciamento de Upload
export async function uploadToSupabase(file) {
    try {
        // Processa o arquivo
        let geojson = await processFile(file);
        
        // Extrai features
        const features = extractFeatures(geojson);
        
        // Obtém localização atual
        let coords = await getCurrentLocation().catch(() => null);
        
        // Upload do arquivo
        const { error: uploadError } = await supabase.storage
            .from('arquivos')
            .upload(file.name, file, { upsert: true });
            
        if (uploadError && !uploadError.message.includes('The resource already exists')) {
            throw new AppError("Falha no upload", 'UPLOAD_ERROR', uploadError);
        }

        // Obtém URL pública
        const { data: publicUrlData } = supabase.storage
            .from('arquivos')
            .getPublicUrl(file.name);

        // Metadados do arquivo
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

        // Salva metadados
        await supabase.from('arquivos').upsert([meta], { onConflict: ['nome'] });
        
        // Remove features antigas
        await supabase.from('features').delete().eq('arquivo_nome', file.name);
        
        // Insere novas features em lotes
        const BATCH_SIZE = 100;
        for (let i = 0; i < features.data.length; i += BATCH_SIZE) {
            const batch = features.data.slice(i, i + BATCH_SIZE)
                .map(f => ({ ...f, arquivo_nome: file.name }));
            
            const { error: featuresError } = await supabase
                .from('features')
                .insert(batch);
                
            if (featuresError) {
                throw new AppError("Erro ao salvar features", 'FEATURES_ERROR', featuresError);
            }
        }

        // Atualiza cache
        cache.files.set(file.name, {
            meta,
            features: features.data,
            lastUpdate: Date.now()
        });

        return {
            success: true,
            message: "Arquivo e dados enviados com sucesso!",
            data: {
                file: meta,
                featuresCount: features.data.length
            }
        };

    } catch (error) {
        console.error("Erro no upload para Supabase:", error);
        throw new AppError(
            "Falha no processo de upload",
            'UPLOAD_PROCESS_ERROR',
            error
        );
    }
}

// Processamento de Arquivos
async function processFile(file) {
    try {
        if (file.name.endsWith('.kmz')) {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            const kmlFile = zip.file(/\.kml$/i)[0];
            
            if (!kmlFile) {
                throw new AppError('KMZ inválido', 'INVALID_KMZ');
            }
            
            const kmlContent = await kmlFile.async('string');
            return toGeoJSON.kml(new DOMParser().parseFromString(kmlContent, 'text/xml'));
        } else {
            const text = await file.text();
            return toGeoJSON.kml(new DOMParser().parseFromString(text, 'text/xml'));
        }
    } catch (error) {
        throw new AppError('Erro no processamento do arquivo', 'FILE_PROCESSING_ERROR', error);
    }
}

// Extração de Features
function extractFeatures(geojson) {
    const markers = [];
    const lines = [];
    let center = null;

    geojson.features.forEach(feature => {
        if (feature.geometry.type === 'Point') {
            markers.push({
                tipo: 'marker',
                name: feature.properties?.name || '',
                alimentador: feature.properties?.Alimentador || '',
                lat: feature.geometry.coordinates[1],
                lng: feature.geometry.coordinates[0]
            });
            if (!center) center = feature.geometry.coordinates;
        } else if (['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
            lines.push({
                tipo: 'line',
                name: feature.properties?.name || '',
                alimentador: feature.properties?.Alimentador || '',
                coords: JSON.stringify(feature.geometry.coordinates)
            });
            if (!center) {
                center = calculateGeometryCenter(feature.geometry);
            }
        }
    });

    return {
        data: [...markers, ...lines],
        centro: center,
        total: markers.length + lines.length
    };
}

// Busca de Features
export async function searchFeatures(term, options = {}) {
    const {
        searchType = SEARCH_CONFIG.searchTypes.BOTH,
        maxResults = SEARCH_CONFIG.maxResults,
        searchRadius = state.searchRadius
    } = options;

    const results = {
        local: [],
        remote: [],
        total: 0
    };

    try {
        // Busca local
        if (searchType !== SEARCH_CONFIG.searchTypes.REMOTE) {
            results.local = searchLocalFeatures(term);
        }

        // Busca remota
        if (searchType !== SEARCH_CONFIG.searchTypes.LOCAL) {
            const remoteResults = await searchRemoteFeatures(term);
            results.remote = remoteResults;
        }

        // Combina e ordena resultados
        const allResults = [...results.local, ...results.remote]
            .filter(Boolean)
            .map(feature => {
                if (!feature.properties.distance && feature.geometry) {
                    const center = getFeatureCenter(feature);
                    feature.properties.distance = state.userLocation ? 
                        computeDistance(state.userLocation, center) : 0;
                }
                return feature;
            })
            .sort((a, b) => a.properties.distance - b.properties.distance)
            .slice(0, maxResults);

        results.total = allResults.length;
        return allResults;

    } catch (error) {
        throw new AppError('Erro na busca de features', 'SEARCH_ERROR', error);
    }
}

// Funções auxiliares
function searchLocalFeatures(term) {
    const results = [];
    const termLower = term.toLowerCase();

    state.files.forEach(file => {
        if (file.hasMarkers) {
            const markerSource = mapController.getMap().getSource(`${file.sourceId}-markers`);
            if (markerSource?._data?.features) {
                markerSource._data.features.forEach(feature => {
                    if (featureMatchesTerm(feature, termLower)) {
                        results.push(feature);
                    }
                });
            }
        }
        if (file.hasLines) {
            const lineSource = mapController.getMap().getSource(`${file.sourceId}-lines`);
            if (lineSource?._data?.features) {
                lineSource._data.features.forEach(feature => {
                    if (featureMatchesTerm(feature, termLower)) {
                        results.push(feature);
                    }
                });
            }
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

    if (error) throw new AppError('Erro na busca remota', 'REMOTE_SEARCH_ERROR', error);

    return data.map(f => ({
        type: 'Feature',
        geometry: {
            type: f.tipo === 'marker' ? 'Point' : 'LineString',
            coordinates: f.tipo === 'marker' ? 
                [f.lng, f.lat] : 
                JSON.parse(f.coords)
        },
        properties: {
            name: f.name,
            Alimentador: f.alimentador,
            distance: state.userLocation ? 
                computeDistance(state.userLocation, [f.lng, f.lat]) : 0
        }
    }));
}

function featureMatchesTerm(feature, term) {
    return (feature.properties?.name?.toLowerCase().includes(term) ||
            feature.properties?.Alimentador?.toLowerCase().includes(term));
}

function calculateGeometryCenter(geometry) {
    const coords = [];
    function extractCoords(c) {
        if (typeof c[0] === 'number') coords.push(c);
        else c.forEach(extractCoords);
    }
    extractCoords(geometry.coordinates);
    
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    
    return [
        lons.reduce((a, b) => a + b, 0) / lons.length,
        lats.reduce((a, b) => a + b, 0) / lats.length
    ];
}

async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocalização não suportada'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => resolve(position.coords),
            error => reject(error)
        );
    });
}

// Exporta interface pública
export default {
    uploadToSupabase,
    searchFeatures,
    cache
};