export function addLayerToMap(geojson, fileName) {
    const sourceId = `source-${fileName.replace(/\s+/g, '_')}`;
    
    if (state.files.find(file => file.name === fileName)) {
        throw new AppError(`O arquivo "${fileName}" já está carregado.`, 'DUPLICATE_FILE');
    }

    try {
        const pointFeatures = { type: 'FeatureCollection', features: geojson.features.filter(f => f.geometry.type === 'Point') };
        const lineFeatures = { type: 'FeatureCollection', features: geojson.features.filter(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') };
        const polygonFeatures = { type: 'FeatureCollection', features: geojson.features.filter(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') };

        if (pointFeatures.features.length > 0) {
            map.addSource(`${sourceId}-markers`, { type: 'geojson', data: pointFeatures });
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
                layout: { 'visibility': state.markersVisible ? 'visible' : 'none' }
            });
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

        if (lineFeatures.features.length > 0) {
            map.addSource(`${sourceId}-lines`, { type: 'geojson', data: lineFeatures });
            map.addLayer({
                id: `lines-${sourceId}`,
                type: 'line',
                source: `${sourceId}-lines`,
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': FEATURE_CONFIG.lines.width
                },
                layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
            });
        }

        if (polygonFeatures.features.length > 0) {
            map.addSource(`${sourceId}-polygons`, { type: 'geojson', data: polygonFeatures });
            map.addLayer({
                id: `polygons-${sourceId}`,
                type: 'fill',
                source: `${sourceId}-polygons`,
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.5
                },
                layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
            });
            map.addLayer({
                id: `polygon-outlines-${sourceId}`,
                type: 'line',
                source: `${sourceId}-polygons`,
                paint: {
                    'line-color': '#000',
                    'line-width': 1
                },
                layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
            });
        }

        state.files.push({
            name: fileName,
            sourceId,
            hasMarkers: pointFeatures.features.length > 0,
            hasLines: lineFeatures.features.length > 0,
            hasPolygons: polygonFeatures.features.length > 0,
            pointFeatures,
            lineFeatures,
            polygonFeatures
        });

        return true;
    } catch (error) {
        console.error('Erro ao adicionar camada ao mapa:', error);
        throw new AppError('Falha ao adicionar camada ao mapa', 'LAYER_ADD_ERROR', error);
    }
}
