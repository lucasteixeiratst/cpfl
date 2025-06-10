// config.js - Configurações e estado global com melhorias

import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
export const supabase = createClient(
    'https://sua-instancia.supabase.co',
    'chave-publica-ou-secreta'
);

// Estado global da aplicação
export const state = {
    files: [],
    userLocation: null,
    userLocationMarker: null,
    markersVisible: true,
    namesVisible: true,
    linesVisible: true,
    currentStyle: localStorage.getItem('mapStyle') || 'Streets',
    maxConcurrentLoads: 3,
    searchRadius: 20000 // metros
};

// Atualização do estado
export function updateState(newValues) {
    Object.assign(state, newValues);
    if (newValues.currentStyle) {
        localStorage.setItem('mapStyle', newValues.currentStyle);
    }
}

// Carrega estado salvo em cache/localStorage
export function loadStateFromCache() {
    const savedStyle = localStorage.getItem('mapStyle');
    if (savedStyle) {
        state.currentStyle = savedStyle;
    }
}

// Configurações de estilo e visualização do mapa
export const MAP_CONFIG = {
    initialView: {
        center: [-47.068847, -22.934973],
        zoom: 13,
        minZoom: 5,
        maxZoom: 20
    },
    styles: [
        { name: 'Streets', url: 'https://demotiles.maplibre.org/style.json' },
        { name: 'Dark', url: 'https://tiles.stadiamaps.com/styles/alidade_dark.json' },
        { name: 'Light', url: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json' }
    ]
};

export const FEATURE_CONFIG = {
    markers: {
        radius: 6,
        color: '#FF0000',
        strokeWidth: 1,
        strokeColor: '#FFFFFF'
    },
    labels: {
        size: 12,
        offset: [0, 1.2],
        color: '#333333',
        haloColor: '#FFFFFF',
        haloWidth: 1
    },
    lines: {
        width: 3
    }
};

// Configurações de busca
export const SEARCH_CONFIG = {
    searchTypes: {
        LOCAL: 'local',
        REMOTE: 'remote',
        BOTH: 'both'
    },
    maxResults: 50
};

// Mensagens de erro padronizadas
export const ERROR_MESSAGES = {
    INITIALIZATION_FAILED: 'Erro na inicialização da aplicação.',
    UPLOAD_FAILED: 'Falha ao enviar arquivo.',
    SEARCH_FAILED: 'Erro durante a busca.',
    GEOLOCATION_FAILED: 'Falha ao obter localização.',
    GEOLOCATION_UNSUPPORTED: 'Geolocalização não suportada.',
    LOAD_FAILED: 'Erro ao carregar o arquivo.',
    INVALID_FILE: 'Arquivo inválido.'
};
