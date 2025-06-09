// UTILS.JS - Funções utilitárias
// Última atualização: 2025-06-09 18:17
// Autor: lucasteixeiratst

export class AppError extends Error {
    constructor(message, code, cause) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.cause = cause;
    }
}

export function computeDistance(coord1, coord2) {
    const R = 6371e3; // Raio da Terra em metros
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distância em metros
}

export function getFeatureCenter(feature) {
    if (!feature.geometry) return [0, 0];
    const coords = feature.geometry.coordinates;
    if (feature.geometry.type === 'Point') return coords;
    const lons = [], lats = [];
    function extractCoords(c) { if (typeof c[0] === 'number') { lons.push(c[0]); lats.push(c[1]); } else c.forEach(extractCoords); }
    extractCoords(coords);
    return [lons.reduce((a, b) => a + b, 0) / lons.length, lats.reduce((a, b) => a + b, 0) / lats.length];
}

export const validators = {
    isValidFileName: (name) => /^[a-zA-Z0-9_-]+\.(kml|kmz)$/.test(name),
    isKMZFile: (name) => name.toLowerCase().endsWith('.kmz'),
    isKMLFile: (name) => name.toLowerCase().endsWith('.kml')
};

export function generateRandomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
}

export const formatters = {
    distance: (meters) => {
        if (meters < 1000) return `${meters.toFixed(0)} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    }
};

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

export default { AppError, computeDistance, getFeatureCenter, validators, generateRandomColor, formatters, debounce };
