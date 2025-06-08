// ---------------------------------------------------------------------------------------
// CONFIG.JS - Configurações globais e estado da aplicação
// Última atualização: 2025-06-08 20:12:21
// Autor: lucasteixeiratst
// ---------------------------------------------------------------------------------------

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Configurações do Supabase
export const SUPABASE_CONFIG = {
    url: "https://apwforodphfoorwhaqdo.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwd2Zvcm9kcGhmb29yd2hhcWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwODQ5ODcsImV4cCI6MjA2NDY2MDk4N30.lmLDwaDpYPs32K5fL-aU8wgMJy5U8za0r91jJCiT9vc"
};

// Inicialização do cliente Supabase
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

// Configurações do Mapa
export const MAP_CONFIG = {
    initialView: {
        center: [-47.068847, -22.934973],
        zoom: 11,
        minZoom: 4,
        maxZoom: 18
    },
    styles: [
        { name: 'Positron', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
        { name: 'Dark Matter', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
        { name: 'Voyager', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' }
    ]
};

// Estado Global da Aplicação
export const state = {
    markersVisible: true,
    namesVisible: true,
    linesVisible: true,
    userLocation: null,
    files: [],
    selectedGroups: new Map(),
    loadingFiles: new Set(),
    userLocationMarker: null,
    initialized: false,
    currentStyle: 'Voyager',
    lastUpdate: '2025-06-08 20:12:21',
    maxConcurrentLoads: 3,
    searchRadius: 20000, // 20km em metros
    cache: {
        lastLocation: null,
        recentFiles: [],
        maxRecentFiles: 5
    }
};

// Configurações de Cache
export const CACHE_CONFIG = {
    keys: {
        lastLocation: 'mapview_last_location',
        recentFiles: 'mapview_recent_files',
        userPreferences: 'mapview_preferences'
    },
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias em milissegundos
};

// Configurações de Features
export const FEATURE_CONFIG = {
    markers: {
        radius: 6,
        color: '#FF5722',
        strokeWidth: 2,
        strokeColor: '#FFFFFF'
    },
    lines: {
        width: 4,
        defaultColor: '#00BCD4'
    },
    labels: {
        size: 12,
        offset: [0, 1.5],
        color: '#000000',
        haloColor: '#FFFFFF',
        haloWidth: 1
    }
};

// Configurações de Busca
export const SEARCH_CONFIG = {
    maxResults: 8,
    minSearchLength: 3,
    debounceTime: 300,
    searchTypes: {
        LOCAL: 'local',
        REMOTE: 'remote',
        BOTH: 'both'
    }
};

// Mensagens de Erro
export const ERROR_MESSAGES = {
    LOAD_FAILED: 'Erro ao carregar o arquivo',
    UPLOAD_FAILED: 'Erro no upload para o Supabase',
    INVALID_FILE: 'Arquivo inválido ou não suportado',
    GEOLOCATION_FAILED: 'Não foi possível obter sua localização',
    GEOLOCATION_UNSUPPORTED: 'Geolocalização não é suportada pelo seu navegador',
    SEARCH_FAILED: 'Erro ao realizar a busca',
    INITIALIZATION_FAILED: 'Erro ao inicializar a aplicação',
    MAX_FILES_REACHED: 'Número máximo de arquivos sendo carregados simultaneamente'
};

// Função para atualizar o estado
export function updateState(newState) {
    Object.assign(state, newState);
    saveStateToCache();
}

// Função para salvar estado no cache
function saveStateToCache() {
    const cacheData = {
        lastLocation: state.userLocation,
        recentFiles: state.cache.recentFiles,
        preferences: {
            markersVisible: state.markersVisible,
            namesVisible: state.namesVisible,
            linesVisible: state.linesVisible,
            currentStyle: state.currentStyle
        }
    };
    
    try {
        localStorage.setItem(CACHE_CONFIG.keys.userPreferences, JSON.stringify(cacheData));
    } catch (error) {
        console.warn('Erro ao salvar estado no cache:', error);
    }
}

// Função para carregar estado do cache
export function loadStateFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_CONFIG.keys.userPreferences);
        if (cached) {
            const data = JSON.parse(cached);
            updateState({
                userLocation: data.lastLocation,
                cache: {
                    ...state.cache,
                    recentFiles: data.recentFiles || []
                },
                ...data.preferences
            });
        }
    } catch (error) {
        console.warn('Erro ao carregar estado do cache:', error);
    }
}

// Exporta interface pública
export default {
    supabase,
    state,
    MAP_CONFIG,
    FEATURE_CONFIG,
    SEARCH_CONFIG,
    ERROR_MESSAGES,
    updateState,
    loadStateFromCache
};