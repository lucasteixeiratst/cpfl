import { initMap } from './map.js';

if (typeof maplibregl === 'undefined') {
    console.error('MapLibreGL não carregado');
    alert('Erro ao carregar o mapa.');
} else {
    console.log('MapLibreGL carregado com sucesso');
    const map = initMap();
    console.log('Mapa criado:', map);
}
