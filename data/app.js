const state = {
    markersVisible: true,
    namesVisible: true,
    linesVisible: true,
    userLocation: null,
    files: [],
    selectedGroups: new Map(),
};

// Paleta de 40 cores distintas e recomendadas para visualização de dados
const paletaRecomendada = [
  '#d73027', '#f46d43', '#fdae61', '#fee090',
  '#ffffbf', '#e0f3f8', '#abd9e9', '#74add1',
  '#4575b4', '#313695', '#40004b', '#762a83',
  '#9970ab', '#c2a5cf', '#e7d4e8', '#f7f7f7',
  '#d9f0d3', '#a6dba0', '#5aae61', '#1b7837',
  '#00441b', '#8c510a', '#bf812d', '#dfc27d',
  '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1',
  '#35978f', '#01665e', '#003c30', '#fde0ef',
  '#f1b6da', '#de77ae', '#c51b7d', '#8e0152',
  '#b2182b', '#d6604d', '#fddbc7', '#d1e5f0'
];
const coresAtribuidasAosGrupos = new Map();

const mapStyles = [
    { name: 'Positron', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
    { name: 'Dark Matter', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
    { name: 'Voyager', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' }
];

const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center: [-47.068847, -22.934973],
    zoom: 11
});

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const kmzMenu = document.getElementById('kmzMenu');
const kmzList = document.getElementById('kmzList');
const lineMenu = document.getElementById('lineMenu');
const lineGroupsList = document.getElementById('lineGroupsList');
const loadedFilesMenu = document.getElementById('loadedFilesMenu');
const loadedFilesList = document.getElementById('loadedFilesList');
const styleMenu = document.getElementById('styleMenu');
const loadingSpinner = document.getElementById('loading-spinner');

let predefinedFiles = [];

// ===================================================================
// LÓGICA DO WEB WORKER (NOVA E CORRIGIDA)
// ===================================================================

const parserWorker = new Worker('parser.worker.js');

parserWorker.onmessage = (event) => {
    const { success, kmlString, fileName, error } = event.data;
    if (success) {
        const dom = new DOMParser().parseFromString(kmlString, 'text/xml');
        const geojson = toGeoJSON.kml(dom);
        
        loadingSpinner.style.display = 'none';
        addDataToMap(geojson, fileName);
        updateRecentFiles(fileName);
        localStorage.setItem('lastSelectedFile', fileName);
    } else {
        loadingSpinner.style.display = 'none';
        console.error(`Erro no worker ao processar ${fileName}:`, error);
        alert(`Falha ao descompactar o arquivo ${fileName}.`);
    }
};

async function processFile(fileDataSource, fileName) {
    loadingSpinner.style.display = 'block';

    try {
        if (fileName.endsWith('.kmz')) {
            if (typeof fileDataSource === 'string') {
                const response = await fetch(fileDataSource);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                parserWorker.postMessage({ arrayBuffer: arrayBuffer, fileName: fileName });
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    parserWorker.postMessage({ arrayBuffer: reader.result, fileName: fileName });
                };
                reader.readAsArrayBuffer(fileDataSource);
            }
        } else if (fileName.endsWith('.kml')) {
            let kmlString;
            if (typeof fileDataSource === 'string') {
                const response = await fetch(fileDataSource);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                kmlString = await response.text();
            } else {
                kmlString = await fileDataSource.text();
            }
            const dom = new DOMParser().parseFromString(kmlString, 'text/xml');
            const geojson = toGeoJSON.kml(dom);
            
            loadingSpinner.style.display = 'none';
            addDataToMap(geojson, fileName);
            updateRecentFiles(fileName);
            localStorage.setItem('lastSelectedFile', fileName);
        } else {
             throw new Error("Formato de arquivo não suportado.");
        }
    } catch (error) {
        loadingSpinner.style.display = 'none';
        console.error("Erro ao processar arquivo:", error);
        alert("Não foi possível carregar o arquivo.");
    }
}

function loadKMZFromURL(url, fileName) {
    processFile(url, fileName);
}

function handleFile(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file, file.name);
    }
}

// ===================================================================
// LÓGICA DE INICIALIZAÇÃO E FUNÇÕES DE COR
// ===================================================================

function obterCorParaGrupo(nomeDoGrupo) {
  if (coresAtribuidasAosGrupos.has(nomeDoGrupo)) {
    return coresAtribuidasAosGrupos.get(nomeDoGrupo);
  }
  
  // Lógica de ciclo: pega a próxima cor da paleta, voltando ao início se necessário.
  // Isso garante que as primeiras 40 grupos terão cores únicas.
  const indice = coresAtribuidasAosGrupos.size % paletaRecomendada.length;
  const novaCor = paletaRecomendada[indice];
  
  coresAtribuidasAosGrupos.set(nomeDoGrupo, novaCor);
  return novaCor;
}


async function initializeApp() {
    try {
        const response = await fetch('./predefinedFiles.json');
        if (!response.ok) throw new Error("Não foi possível encontrar a lista de mapas.");
        predefinedFiles = await response.json();
        displayFileList();

        const lastFile = localStorage.getItem('lastSelectedFile');
        const fileToLoad = predefinedFiles.find(f => f.name === lastFile);
        if (fileToLoad) {
            loadKMZFromURL(fileToLoad.url, fileToLoad.name);
        }
    } catch (error) {
        console.error("Erro ao inicializar a aplicação:", error);
        alert(error.message);
    }
}

map.on('load', initializeApp);

// ===================================================================
// FUNÇÕES DE UI, FILTROS E LÓGICA GERAL
// ===================================================================

function updateRecentFiles(fileName) {
    let recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    recentFiles = recentFiles.filter(f => f !== fileName);
    recentFiles.unshift(fileName);
    recentFiles = recentFiles.slice(0, 5);
    localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
}

function displayFileList() {
    kmzList.innerHTML = '';
    const recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    const recentFileSet = new Set(recentFiles);
    const recent = predefinedFiles.filter(file => recentFileSet.has(file.name));
    const others = predefinedFiles.filter(file => !recentFileSet.has(file.name));
    const sortedRecent = recent.sort((a, b) => recentFiles.indexOf(a.name) - recentFiles.indexOf(b.name));
    const sortedOthers = others.sort((a, b) => a.name.localeCompare(b.name));
    const sortedFiles = [...sortedRecent, ...sortedOthers];
    sortedFiles.forEach((file) => {
        const li = document.createElement('li');
        li.textContent = file.name;
        li.addEventListener('click', () => {
            loadKMZFromURL(file.url, file.name);
            displayFileList();
            kmzMenu.style.display = 'none';
        });
        kmzList.appendChild(li);
    });
}

map.on('click', () => {
    kmzMenu.style.display = 'none';
    lineMenu.style.display = 'none';
    loadedFilesMenu.style.display = 'none';
    styleMenu.style.display = 'none';
    searchResults.innerHTML = '';
});

document.getElementById('btnKMZ').addEventListener('click', () => toggleVisibility(kmzMenu));
document.getElementById('btnMarkers').addEventListener('click', toggleMarkers);
document.getElementById('btnNames').addEventListener('click', toggleNames);
document.getElementById('btnLines').addEventListener('click', toggleLines);
document.getElementById('btnReset').addEventListener('click', resetView);
document.getElementById('btnLocation').addEventListener('click', goToCurrentLocation);
document.getElementById('btnLineGroups').addEventListener('click', () => {
    if (state.files.length === 0 || !state.files.some(f => f.hasLines)) {
        alert('Não há grupos de linhas para filtrar. Carregue um arquivo com linhas primeiro.');
    } else {
        toggleVisibility(lineMenu);
    }
});
document.getElementById('btnLoadedFiles').addEventListener('click', () => toggleVisibility(loadedFilesMenu));
document.getElementById('btnSearch').addEventListener('click', searchFeatures);
document.getElementById('selectDevice').addEventListener('click', selectFromDevice);
document.getElementById('hideAll').addEventListener('click', hideAllGroups);
document.getElementById('showAll').addEventListener('click', showAllGroups);
document.getElementById('btnStyles').addEventListener('click', () => {
    displayStyleList();
    toggleVisibility(styleMenu);
});

function toggleVisibility(element) {
    [kmzMenu, lineMenu, loadedFilesMenu, styleMenu].forEach(menu => {
        if (menu !== element) {
            menu.style.display = 'none';
        }
    });
    element.style.display = (element.style.display === 'block') ? 'none' : 'block';
}

function selectFromDevice() {
    kmzMenu.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kml,.kmz';
    input.onchange = handleFile;
    input.click();
}

function createMarkerCircleLayer(sourceId) {
    return {
        id: `marker-circles-${sourceId}`,
        type: 'circle',
        source: sourceId + '-markers',
        paint: {
            'circle-radius': 6,
            'circle-color': '#FF5722',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF'
        },
        layout: { 'visibility': state.markersVisible ? 'visible' : 'none' }
    };
}

function createMarkerLabelLayer(sourceId) {
    return {
        id: `marker-labels-${sourceId}`,
        type: 'symbol',
        source: sourceId + '-markers',
        layout: {
            'text-field': ['coalesce', ['get', 'name'], ['get', 'Alimentador']],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-offset': [0, 1.5],
            'visibility': state.namesVisible ? 'visible' : 'none'
        },
        paint: {
            'text-color': '#000000',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 1
        }
    };
}

function createLineLayer(sourceId) {
    return {
        id: `lines-${sourceId}`,
        type: 'line',
        source: sourceId + '-lines',
        paint: {
            'line-color': ['coalesce', ['get', 'stroke'], ['get', 'color'], ['get', 'corDaPaleta'], '#3388ff'],
            'line-width': 4,
            'line-opacity': ['coalesce', ['get', 'stroke-opacity'], 1.0]
        },
        layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
    };
}

function addDataToMap(geojson, fileName) {
    const sanitizedFileName = fileName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const sourceId = `source-${sanitizedFileName}`;

    if (state.files.find(file => file.name === fileName)) {
        alert(`O arquivo "${fileName}" já está carregado.`);
        return;
    }

    const pointFeaturesArray = [];
    const lineFeaturesArray = [];

    function extractGeometries(feature) {
        if (!feature.geometry) return [];
        const geometries = [];
        if (feature.geometry.type === 'GeometryCollection') {
            feature.geometry.geometries.forEach(geom => {
                geometries.push({ ...feature, geometry: geom });
            });
        } else {
            geometries.push(feature);
        }
        return geometries;
    }

    geojson.features.forEach(feature => {
        const features = extractGeometries(feature);
        features.forEach(f => {
            if (f.geometry.type === 'Point') {
                pointFeaturesArray.push(f);
            } else if (['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(f.geometry.type)) {
                f.properties = f.properties || {};
                
                const nomeDoGrupo = f.properties.Alimentador || f.properties.name || 'grupo_sem_nome';
                f.properties.corDaPaleta = obterCorParaGrupo(nomeDoGrupo);
                
                lineFeaturesArray.push(f);
            }
        });
    });

    const pointFeatures = { type: 'FeatureCollection', features: pointFeaturesArray };
    const lineFeatures = { type: 'FeatureCollection', features: lineFeaturesArray };

    let groupingProperty = null;
    const exampleLine = lineFeatures.features.find(f => f.properties && (f.properties.Alimentador || f.properties.name));
    if (exampleLine) {
        groupingProperty = exampleLine.properties.Alimentador ? 'Alimentador' : 'name';
    }

    const groupsSet = new Set();
    if (lineFeatures.features.length > 0 && groupingProperty) {
        lineFeatures.features.forEach(f => {
            if (f.properties && f.properties[groupingProperty]) {
                groupsSet.add(f.properties[groupingProperty]);
            }
        });
    }

    if (groupingProperty && groupsSet.size > 0) {
        state.selectedGroups.set(sourceId, new Set(groupsSet));
    }

    state.files.push({
        name: fileName,
        sourceId: sourceId,
        hasMarkers: pointFeatures.features.length > 0,
        hasLines: lineFeatures.features.length > 0,
        groupingProperty: groupingProperty,
        pointFeatures: pointFeatures,
        lineFeatures: lineFeatures
    });

    if (pointFeatures.features.length > 0) {
        map.addSource(sourceId + '-markers', { type: 'geojson', data: pointFeatures });
        map.addLayer(createMarkerCircleLayer(sourceId));
        map.addLayer(createMarkerLabelLayer(sourceId));
    }

    if (lineFeatures.features.length > 0) {
        map.addSource(sourceId + '-lines', { type: 'geojson', data: lineFeatures });
        map.addLayer(createLineLayer(sourceId));
    }

    updateGroupMenu();
    updateLoadedFilesList(fileName);
}

function updateGroupMenu() {
    lineGroupsList.innerHTML = '';
    state.files.forEach(file => {
        if (!file.hasLines || !file.groupingProperty) return;

        const groups = new Set();
        file.lineFeatures.features.forEach(f => {
            const props = f.properties;
            if (props && props[file.groupingProperty]) {
                const groupName = props[file.groupingProperty];
                groups.add(groupName);
            }
        });

        if (groups.size === 0) return;

        const fileHeader = document.createElement('div');
        fileHeader.style.fontWeight = 'bold';
        fileHeader.style.marginTop = '10px';
        fileHeader.textContent = `Arquivo: "${file.name}"`;
        lineGroupsList.appendChild(fileHeader);

        const sortedGroups = Array.from(groups).sort((a, b) => a.localeCompare(b));
        sortedGroups.forEach(grp => {
            const li = document.createElement('li');
            const lbl = document.createElement('label');
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = grp;
            chk.checked = state.selectedGroups.get(file.sourceId)?.has(grp) ?? true;

            chk.onchange = () => {
                const selectedGroupsSet = state.selectedGroups.get(file.sourceId);
                if (selectedGroupsSet) {
                    if (chk.checked) {
                        selectedGroupsSet.add(grp);
                    } else {
                        selectedGroupsSet.delete(grp);
                    }
                }
                applyGroupFilter();
            };

            lbl.appendChild(chk);
            lbl.appendChild(document.createTextNode(' ' + grp));

            const color = obterCorParaGrupo(grp);
            lbl.style.color = color;
            lbl.style.fontWeight = 'bold';

            li.appendChild(lbl);
            lineGroupsList.appendChild(li);
        });
    });
}

function updateLoadedFilesList(fileName) {
    const li = document.createElement('li');
    li.textContent = fileName;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => {
        removeFileFromMap(fileName);
        li.remove();
    });
    li.appendChild(removeBtn);
    loadedFilesList.appendChild(li);
}

function removeFileFromMap(fileName) {
    const fileIndex = state.files.findIndex(file => file.name === fileName);
    if (fileIndex === -1) return;

    const file = state.files[fileIndex];
    const sourceId = file.sourceId;

    if (file.hasMarkers) {
        if (map.getLayer(`marker-circles-${sourceId}`)) map.removeLayer(`marker-circles-${sourceId}`);
        if (map.getLayer(`marker-labels-${sourceId}`)) map.removeLayer(`marker-labels-${sourceId}`);
        if (map.getSource(sourceId + '-markers')) map.removeSource(sourceId + '-markers');
    }

    if (file.hasLines) {
        if (map.getLayer(`lines-${sourceId}`)) map.removeLayer(`lines-${sourceId}`);
        if (map.getSource(sourceId + '-lines')) map.removeSource(sourceId + '-lines');
    }

    if (state.selectedGroups.has(sourceId)) {
        state.selectedGroups.delete(sourceId);
    }
    
    // Limpa a cor associada aos grupos do arquivo removido
    const groupsInFile = new Set();
    file.lineFeatures.features.forEach(f => {
        const groupName = f.properties[file.groupingProperty];
        if(groupName) groupsInFile.add(groupName);
    });
    groupsInFile.forEach(groupName => coresAtribuidasAosGrupos.delete(groupName));


    state.files.splice(fileIndex, 1);
    updateGroupMenu();
}

function applyGroupFilter() {
    state.files.forEach(file => {
        if (!file.hasLines || !file.groupingProperty) return;

        const sourceId = file.sourceId;
        const lineLayerId = `lines-${sourceId}`;
        const groupingProperty = file.groupingProperty;
        const selectedGroups = state.selectedGroups.get(sourceId);

        if (map.getLayer(lineLayerId)) {
            if (!selectedGroups || selectedGroups.size === 0) {
                map.setFilter(lineLayerId, ["==", ["get", groupingProperty], "___no_match___"]);
            } else if (selectedGroups.size === getTotalGroupsForFile(file)) {
                map.setFilter(lineLayerId, null);
            } else {
                const filterExpression = [
                    'match',
                    ['get', groupingProperty],
                    Array.from(selectedGroups),
                    true,
                    false
                ];
                map.setFilter(lineLayerId, filterExpression);
            }
        }
    });
}

function getTotalGroupsForFile(file) {
    if (!file || !file.hasLines || !file.lineFeatures) return 0;
    const allGroups = new Set();
    file.lineFeatures.features.forEach(feature => {
        if (feature.properties && feature.properties[file.groupingProperty]) {
            allGroups.add(feature.properties[file.groupingProperty]);
        }
    });
    return allGroups.size;
}

function hideAllGroups() {
    state.selectedGroups.forEach((groups) => {
        groups.clear();
    });
    document.querySelectorAll('#lineGroupsList input[type=checkbox]').forEach(chk => chk.checked = false);
    applyGroupFilter();
}

function showAllGroups() {
    state.files.forEach(file => {
        if (file.hasLines && file.groupingProperty) {
            const allGroups = new Set();
            file.lineFeatures.features.forEach(feature => {
                if (feature.properties && feature.properties[file.groupingProperty]) {
                    allGroups.add(feature.properties[file.groupingProperty]);
                }
            });
            state.selectedGroups.set(file.sourceId, allGroups);
        }
    });
    document.querySelectorAll('#lineGroupsList input[type=checkbox]').forEach(chk => chk.checked = true);
    applyGroupFilter();
}

function toggleMarkers() {
    state.markersVisible = !state.markersVisible;
    const visibility = state.markersVisible ? 'visible' : 'none';
    state.files.forEach(file => {
        if (file.hasMarkers && map.getLayer(`marker-circles-${file.sourceId}`)) {
            map.setLayoutProperty(`marker-circles-${file.sourceId}`, 'visibility', visibility);
        }
    });
}

function toggleNames() {
    state.namesVisible = !state.namesVisible;
    const visibility = state.namesVisible ? 'visible' : 'none';
    state.files.forEach(file => {
        if (file.hasMarkers && map.getLayer(`marker-labels-${file.sourceId}`)) {
            map.setLayoutProperty(`marker-labels-${file.sourceId}`, 'visibility', visibility);
        }
    });
}

function toggleLines() {
    state.linesVisible = !state.linesVisible;
    const visibility = state.linesVisible ? 'visible' : 'none';
    state.files.forEach(file => {
        if (file.hasLines && map.getLayer(`lines-${file.sourceId}`)) {
            map.setLayoutProperty(`lines-${file.sourceId}`, 'visibility', visibility);
        }
    });
}

function resetView() {
    map.easeTo({ center: [-47.068847, -22.934973], zoom: 11 });
}

let userLocationMarker;
function goToCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const userCoords = [position.coords.longitude, position.coords.latitude];
            state.userLocation = userCoords;
            map.flyTo({ center: userCoords, zoom: 16 });
            if (userLocationMarker) userLocationMarker.remove();
            userLocationMarker = new maplibregl.Marker({ color: 'blue' })
                .setLngLat(userCoords)
                .addTo(map);
        }, () => {
            alert('Não foi possível obter sua localização.');
        });
    } else {
        alert('Geolocalização não é suportada pelo seu navegador.');
    }
}

function getFeatureCenter(feature) {
    if (!feature || !feature.geometry) return [0, 0];
    if (feature.geometry.type === 'Point') {
        return feature.geometry.coordinates;
    }
    const coordinates = [];
    function extractCoords(coords) {
        if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            coordinates.push(coords);
        } else if (Array.isArray(coords)) {
            coords.forEach(c => extractCoords(c));
        }
    }
    extractCoords(feature.geometry.coordinates);
    if (coordinates.length === 0) return [0, 0];
    const lons = coordinates.map(coord => coord[0]);
    const lats = coordinates.map(coord => coord[1]);
    const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length;
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    return [avgLon, avgLat];
}

function computeDistance(coord1, coord2) {
    const toRad = (value) => value * Math.PI / 180;
    const lat1 = coord1[1], lon1 = coord1[0], lat2 = coord2[1], lon2 = coord2[0];
    const R = 6371e3; // Radius of Earth in meters
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function searchFeatures() {
    const term = searchInput.value.toLowerCase();
    searchResults.innerHTML = '';

    if (!term) {
        searchResults.innerHTML = '<ul style="padding: 10px; text-align: center;">Digite um termo.</ul>';
        return;
    }

    let matches = [];
    state.files.forEach(file => {
        const searchInFeatures = (features) => {
            features.forEach(feature => {
                const props = feature.properties;
                if (props && (
                    (props.name && props.name.toLowerCase().includes(term)) ||
                    (props.Alimentador && props.Alimentador.toLowerCase().includes(term))
                )) {
                    const existingMatch = matches.find(m => (m.properties.name || m.properties.Alimentador) === (props.name || props.Alimentador));
                    if (!existingMatch) {
                        matches.push(feature);
                    }
                }
            });
        };
        if (file.hasMarkers) searchInFeatures(file.pointFeatures.features);
        if (file.hasLines) searchInFeatures(file.lineFeatures.features);
    });

    if (matches.length === 0) {
        searchResults.innerHTML = '<ul style="padding: 10px; text-align: center;">Nenhum resultado.</ul>';
    } else {
        let referencePoint = state.userLocation || map.getCenter().toArray();
        matches.forEach(feature => {
            const center = getFeatureCenter(feature);
            feature.properties.distance = computeDistance(referencePoint, center);
        });
        matches.sort((a, b) => a.properties.distance - b.properties.distance);
        const topResults = matches.slice(0, 10);
        displaySearchResults(topResults);
    }
}

function displaySearchResults(results) {
    searchResults.innerHTML = '';
    const ul = document.createElement('ul');

    results.forEach(result => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        const displayName = result.properties.name || result.properties.Alimentador || 'Sem nome';
        nameSpan.textContent = `${displayName} (${(result.properties.distance / 1000).toFixed(2)} km)`;

        const buttonContainer = document.createElement('div');

        const viewButton = document.createElement('button');
        viewButton.textContent = 'Visualizar';
        viewButton.onclick = () => {
            const center = getFeatureCenter(result);
            map.flyTo({ center: center, zoom: 16 });
            searchResults.innerHTML = '';
        };

        const googleMapsButton = document.createElement('button');
        googleMapsButton.textContent = 'Google Maps';
        googleMapsButton.onclick = () => {
            const center = getFeatureCenter(result);
            const url = `https://www.google.com/maps?q=${center[1]},${center[0]}`;
            window.open(url, '_blank');
        };

        li.appendChild(nameSpan);
        buttonContainer.appendChild(viewButton);
        buttonContainer.appendChild(googleMapsButton);
        li.appendChild(buttonContainer);
        ul.appendChild(li);
    });

    searchResults.appendChild(ul);
}

function changeMapStyle(newStyleUrl) {
    map.once('style.load', () => {
        state.files.forEach(file => {
            if (file.hasMarkers) {
                map.addSource(file.sourceId + '-markers', { type: 'geojson', data: file.pointFeatures });
                map.addLayer(createMarkerCircleLayer(file.sourceId));
                map.addLayer(createMarkerLabelLayer(file.sourceId));
            }
            if (file.hasLines) {
                map.addSource(file.sourceId + '-lines', { type: 'geojson', data: file.lineFeatures });
                map.addLayer(createLineLayer(file.sourceId));
            }
        });
        applyGroupFilter();
    });
    map.setStyle(newStyleUrl);
}

function displayStyleList() {
    const styleList = document.getElementById('styleList');
    styleList.innerHTML = '';
    mapStyles.forEach(style => {
        const li = document.createElement('li');
        li.textContent = style.name;
        li.addEventListener('click', () => {
            changeMapStyle(style.url);
            styleMenu.style.display = 'none';
        });
        styleList.appendChild(li);
    });
}

const menuButtons = document.querySelectorAll('.menu button');
menuButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    button.addEventListener('mouseenter', () => {
        const legend = button.querySelector('.button-legend');
        if (legend) legend.style.display = 'block';
    });

    button.addEventListener('mouseleave', () => {
        const legend = button.querySelector('.button-legend');
        if (legend) legend.style.display = 'none';
    });
});
