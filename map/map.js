export function initMap() {
    console.log('Inicializando mapa...');
    const map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'raster-tiles': {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                },
            },
            layers: [{
                id: 'simple-tiles',
                type: 'raster',
                source: 'raster-tiles',
                minzoom: 0,
                maxzoom: 22,
            }],
        },
        center: [-47.068847, -22.934973],
        zoom: 11,
        attributionControl: false
    });
    map.on('style.load', () => console.log('Estilo do mapa carregado.'));
    map.on('error', (e) => console.error('Erro no mapa:', e));
    return map.addControl(new maplibregl.NavigationControl(), 'top-right');
}
