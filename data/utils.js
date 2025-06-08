// ---------------------------------------------------------------------------------------
// UTILS.JS - Funções utilitárias
// Última atualização: 2025-06-08 20:14:41
// Autor: lucasteixeiratst
// ---------------------------------------------------------------------------------------

import { ERROR_MESSAGES, CACHE_CONFIG } from './config.js';

// Cálculo de distância entre coordenadas (Haversine)
export function computeDistance(coord1, coord2) {
    const toRad = (value) => value * Math.PI / 180;
    const lat1 = coord1[1], lon1 = coord1[0], lat2 = coord2[1], lon2 = coord2[0];
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distância em metros
}

// Encontra o centro de uma feature
export function getFeatureCenter(feature) {
    if (!feature || !feature.geometry) {
        console.warn('Feature inválida');
        return null;
    }

    try {
        if (feature.geometry.type === 'Point') {
            return feature.geometry.coordinates;
        }

        const coordinates = [];
        function extractCoords(coords) {
            if (typeof coords[0] === 'number') {
                coordinates.push(coords);
            } else {
                coords.forEach(c => extractCoords(c));
            }
        }

        extractCoords(feature.geometry.coordinates);

        if (coordinates.length === 0) {
            console.warn('Nenhuma coordenada encontrada na feature');
            return null;
        }

        const lons = coordinates.map(coord => coord[0]);
        const lats = coordinates.map(coord => coord[1]);
        
        return [
            lons.reduce((a, b) => a + b, 0) / lons.length,
            lats.reduce((a, b) => a + b, 0) / lats.length
        ];
    } catch (error) {
        console.error('Erro ao calcular centro da feature:', error);
        return null;
    }
}

// Formatação de texto
export function formatFileName(name) {
    return name.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
}

// Geração de cores aleatórias
export function generateRandomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
}

// Debounce para otimização de performance
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Gerenciamento de cache
export const cacheManager = {
    set: (key, value, expirationInMs = CACHE_CONFIG.maxAge) => {
        try {
            const item = {
                value,
                timestamp: new Date().getTime(),
                expiration: expirationInMs
            };
            localStorage.setItem(key, JSON.stringify(item));
            return true;
        } catch (error) {
            console.warn('Erro ao salvar no cache:', error);
            return false;
        }
    },

    get: (key) => {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;

            const parsedItem = JSON.parse(item);
            const now = new Date().getTime();

            if (now - parsedItem.timestamp > parsedItem.expiration) {
                localStorage.removeItem(key);
                return null;
            }

            return parsedItem.value;
        } catch (error) {
            console.warn('Erro ao ler do cache:', error);
            return null;
        }
    },

    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Erro ao remover do cache:', error);
            return false;
        }
    },

    clear: () => {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.warn('Erro ao limpar cache:', error);
            return false;
        }
    }
};

// Tratamento de erros
export class AppError extends Error {
    constructor(message, type = 'ERROR', details = null) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }

    static handle(error, fallbackMessage = ERROR_MESSAGES.LOAD_FAILED) {
        console.error('Error:', error);
        
        if (error instanceof AppError) {
            return error.message;
        }
        
        return fallbackMessage;
    }
}

// Validadores
export const validators = {
    isValidCoordinate: (coord) => {
        return Array.isArray(coord) && 
               coord.length === 2 && 
               typeof coord[0] === 'number' && 
               typeof coord[1] === 'number' &&
               coord[0] >= -180 && coord[0] <= 180 &&
               coord[1] >= -90 && coord[1] <= 90;
    },

    isValidFileName: (name) => {
        return typeof name === 'string' && 
               name.length > 0 && 
               /^[\w\-\s.]+$/.test(name);
    },

    isValidUrl: (url) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    isKMZFile: (fileName) => {
        return fileName.toLowerCase().endsWith('.kmz');
    },

    isKMLFile: (fileName) => {
        return fileName.toLowerCase().endsWith('.kml');
    }
};

// Formatadores
export const formatters = {
    distance: (meters) => {
        if (meters < 1000) {
            return `${Math.round(meters)}m`;
        }
        return `${(meters/1000).toFixed(2)}km`;
    },

    dateTime: (date) => {
        return new Date(date).toLocaleString();
    },

    fileSize: (bytes) => {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)}${units[unitIndex]}`;
    }
};

// Exporta todas as utilidades
export default {
    computeDistance,
    getFeatureCenter,
    formatFileName,
    generateRandomColor,
    debounce,
    cacheManager,
    AppError,
    validators,
    formatters
};