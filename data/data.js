export async function fetchFeatures() {
    try {
        const { data, error } = await supabase
            .from('features')
            .select('*');

        if (error) throw new AppError('Erro ao buscar features', 'FETCH_ERROR', error);

        // Group features by arquivo_nome
        const filesData = {};
        data.forEach(f => {
            if (!filesData[f.arquivo_nome]) {
                filesData[f.arquivo_nome] = {
                    name: f.arquivo_nome,
                    features: []
                };
            }
            const feature = {
                type: 'Feature',
                geometry: {
                    type: f.geometry_type,
                    coordinates: JSON.parse(f.coords)
                },
                properties: {
                    name: f.name,
                    Alimentador: f.alimentador,
                    color: generateRandomColor() // For lines and polygons
                }
            };
            filesData[f.arquivo_nome].features.push(feature);
        });

        // Load each file's features into the map
        for (const fileName in filesData) {
            const fileGeojson = {
                type: 'FeatureCollection',
                features: filesData[fileName].features
            };
            await mapController.queueLayer(fileGeojson, fileName);
            // Update state.files if not already present
            if (!state.files.find(f => f.name === fileName)) {
                state.files.push({
                    name: fileName,
                    sourceId: `source-${fileName.replace(/\s+/g, '_')}`,
                    hasMarkers: filesData[fileName].features.some(f => f.geometry.type === 'Point'),
                    hasLines: filesData[fileName].features.some(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'),
                    hasPolygons: filesData[fileName].features.some(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'),
                    pointFeatures: { features: filesData[fileName].features.filter(f => f.geometry.type === 'Point') },
                    lineFeatures: { features: filesData[fileName].features.filter(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') },
                    polygonFeatures: { features: filesData[fileName].features.filter(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') }
                });
            }
        }

        return { success: true, data: data };
    } catch (error) {
        throw new AppError('Falha ao carregar features do banco', 'FETCH_FEATURES_ERROR', error);
    }
}
