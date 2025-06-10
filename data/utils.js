// utils.js - utilitários com melhorias gerais

export class AppError extends Error {
    constructor(message, code = 'APP_ERROR', originalError = null) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.originalError = originalError;
    }
}

export function debounce(func, delay = 300) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

export const validators = {
    isValidFileName: (name) => /^[\w\-. ]+\.(kml|kmz)$/i.test(name),
    isKMZFile: (name) => name.toLowerCase().endsWith('.kmz'),
    isKMLFile: (name) => name.toLowerCase().endsWith('.kml')
};

export function computeDistance(coord1, coord2) {
    if (!coord1 || !coord2) return 0;
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Em metros
}

export function getFeatureCenter(feature) {
    const geometry = feature.geometry;
    if (!geometry || !geometry.coordinates) return [0, 0];
    const coords = [];
    (function extract(c) {
        if (typeof c[0] === 'number') coords.push(c);
        else c.forEach(extract);
    })(geometry.coordinates);

    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    return [
        lons.reduce((a, b) => a + b, 0) / lons.length,
        lats.reduce((a, b) => a + b, 0) / lats.length
    ];
}

export function generateRandomColor() {
    return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
}

export const formatters = {
    distance: (meters) => {
        if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
        return Math.round(meters) + ' m';
    }
};
