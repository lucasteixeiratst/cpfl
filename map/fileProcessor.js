import { state, predefinedFiles, mapStyles } from './main.js';
import { changeMapStyle } from './map.js';

export function toggleVisibility(element) {
    element.style.display = (element.style.display === 'block') ? 'none' : 'block';
}

export function selectFromDevice() {
    toggleVisibility(document.getElementById('kmzMenu'));
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kml,.kmz';
    input.onchange = handleFile;
    input.click();
}

export async function loadKMZFromURL(url, fileName, map) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const contentType = response.headers.get("content-type");
        let data;
        if (contentType.includes("application/vnd.google-earth.kmz")) {
            const arrayBuffer = await response.arrayBuffer();
            data = await parseKMZ(arrayBuffer);
        } else if (contentType.includes("application/vnd.google-earth.kml+xml")) {
            const text = await response.text();
            data = toGeoJSON.kml(new DOMParser().parseFromString(text, 'text/xml'));
        } else {
            throw new Error('Formato de arquivo não suportado.');
        }
        addDataToMap(data, fileName, map);
    } catch (error) {
        console.error('Erro ao carregar o arquivo KMZ/KML:', error);
        alert('Erro ao carregar o arquivo KMZ/KML.');
    }
}

export function displayFileList() {
    const kmzList = document.getElementById('kmzList');
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
            loadKMZFromURL(file.url, file.name, map);
            localStorage.setItem('lastSelectedFile', file.name);
            updateRecentFiles(file.name);
            displayFileList();
            document.getElementById('kmzMenu').style.display = 'none';
        });
        kmzList.appendChild(li);
    });
}

function updateRecentFiles(fileName) {
    let recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    recentFiles = recentFiles.filter(f => f !== fileName);
    recentFiles.unshift(fileName);
    recentFiles = recentFiles.slice(0, 5);
    localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
}

async function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const data = file.name.endsWith('.kmz')
                ? await parseKMZ(reader.result)
                : toGeoJSON.kml(new DOMParser().parseFromString(reader.result, 'text/xml'));
            addDataToMap(data, file.name, map);
            localStorage.setItem('lastSelectedFile', file.name);
            updateRecentFiles(file.name);
            displayFileList();
        } catch (error) {
            console.error('Erro ao processar o arquivo:', error);
            alert('Erro ao processar o arquivo KML/KMZ.');
        }
    };
    if (file.name.endsWith('.kmz')) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

async function parseKMZ(data) {
    const zip = await JSZip.loadAsync(data);
    const kmlFile = zip.file(/\.kml$/i)[0];
    if (!kmlFile) throw new Error('Arquivo KML não encontrado dentro do KMZ.');
    const kmlContent = await kmlFile.async('string');
    return toGeoJSON.kml(new DOMParser().parseFromString(kmlContent, 'text/xml'));
}

function addDataToMap(geojson, fileName, map) {
    const sanitizedFileName = fileName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const sourceId = `source-${sanitizedFileName}`;
    const markerLayerId = `marker-circles-${sourceId}`;
    const labelLayerId = `marker-labels-${sourceId}`;
    const lineLayerId = `lines-${sourceId}`;

    if (state.files.find(file => file.name === fileName)) {
        alert(`O arquivo "${fileName}" já está carregado.`);
        return;
    }

    const pointFeaturesArray = [];
    const lineFeaturesArray = [];

    function extractGeometries(feature) {
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
                if (!f.properties.color) {
                    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                    f.properties.color = color;
                }
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
        map.addLayer({
            id: markerLayerId,
            type: 'circle',
            source: sourceId + '-markers',
            paint: {
                'circle-radius': 6,
                'circle-color': '#FF5722',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#FFFFFF'
            },
            layout: { 'visibility': state.markersVisible ? 'visible' : 'none' }
        });

        map.addLayer({
            id: labelLayerId,
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
        });
    }

    if (lineFeatures.features.length > 0) {
        map.addSource(sourceId + '-lines', { type: 'geojson', data: lineFeatures });
        map.addLayer({
            id: lineLayerId,
            type: 'line',
            source: sourceId + '-lines',
            paint: {
                'line-color': ['get', 'color'],
                'line-width': 4
            },
            layout: { 'visibility': state.linesVisible ? 'visible' : 'none' }
        });
    }

    updateGroupMenu();
    updateLoadedFilesList(fileName);
}

export function updateGroupMenu() {
    const lineGroupsList = document.getElementById('lineGroupsList');
    lineGroupsList.innerHTML = '';
    state.files.forEach(file => {
        if (file.hasLines && file.groupingProperty && state.selectedGroups.has(file.sourceId)) {
            const groups = state.selectedGroups.get(file.sourceId);
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
                chk.checked = true;
                chk.onchange = () => {
                    if (chk.checked) {
                        state.selectedGroups.get(file.sourceId).add(grp);
                    } else {
                        state.selectedGroups.get(file.sourceId).delete(grp);
                    }
                    applyGroupFilter(map);
                };
                lbl.appendChild(chk);
                lbl.appendChild(document.createTextNode(' ' + grp));
                li.appendChild(lbl);
                lineGroupsList.appendChild(li);
            });
        }
    });
}

export function updateLoadedFilesList(fileName) {
    const li = document.createElement('li');
    li.textContent = fileName;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => {
        removeFileFromMap(fileName, map);
        li.remove();
    });
    li.appendChild(removeBtn);
    document.getElementById('loadedFilesList').appendChild(li);
}

export function removeFileFromMap(fileName, map) {
    const fileIndex = state.files.findIndex(file => file.name === fileName);
    if (fileIndex === -1) return;

    const file = state.files[fileIndex];
    const sourceId = file.sourceId;

    if (file.hasMarkers) {
        const markerLayerId = `marker-circles-${sourceId}`;
        const labelLayerId = `marker-labels-${sourceId}`;
        if (map.getLayer(markerLayerId)) map.removeLayer(markerLayerId);
        if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
        if (map.getSource(sourceId + '-markers')) map.removeSource(sourceId + '-markers');
    }

    if (file.hasLines) {
        const lineLayerId = `lines-${sourceId}`;
        if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
        if (map.getSource(sourceId + '-lines')) map.removeSource(sourceId + '-lines');
    }

    if (file.hasLines && file.groupingProperty && state.selectedGroups.has(sourceId)) {
        state.selectedGroups.delete(sourceId);
        updateGroupMenu();
    }

    state.files.splice(fileIndex, 1);
}

export function applyGroupFilter(map) {
    state.files.forEach(file => {
        if (!file.hasLines || !file.groupingProperty) return;
        const sourceId = file.sourceId;
        const lineLayerId = `lines-${sourceId}`;
        const groupingProperty = file.groupingProperty;
        const selectedGroups = state.selectedGroups.get(sourceId);

        if (!map.getLayer(lineLayerId)) return;

        if (!selectedGroups || selectedGroups.size === 0) {
            map.setFilter(lineLayerId, ["==", ["get", groupingProperty], "___no_match___"]);
        } else if (selectedGroups.size === getTotalGroups(sourceId, groupingProperty)) {
            map.setFilter(lineLayerId, null);
        } else {
            map.setFilter(lineLayerId, ["in", groupingProperty, ...Array.from(selectedGroups)]);
        }
    });
}

function getTotalGroups(sourceId, groupingProperty) {
    const lineSource = map.getSource(`${sourceId}-lines`);
    if (lineSource && lineSource._data.features) {
        const allGroups = new Set();
        lineSource._data.features.forEach(feature => {
            if (feature.properties && feature.properties[groupingProperty]) {
                allGroups.add(feature.properties[groupingProperty]);
            }
        });
        return allGroups.size;
    }
    return 0;
}

export function hideAllGroups(map) {
    state.selectedGroups.forEach((groups, sourceId) => {
        state.selectedGroups.set(sourceId, new Set());
    });
    const checkboxes = document.querySelectorAll('#lineGroupsList input[type=checkbox]');
    checkboxes.forEach(chk => chk.checked = false);
    applyGroupFilter(map);
}

export function showAllGroups(map) {
    state.files.forEach(file => {
        if (file.hasLines && file.groupingProperty && state.selectedGroups.has(file.sourceId)) {
            const sourceId = file.sourceId;
            const groupingProperty = file.groupingProperty;
            const lineSource = map.getSource(`${sourceId}-lines`);
            if (lineSource && lineSource._data.features) {
                const allGroups = new Set();
                lineSource._data.features.forEach(feature => {
                    if (feature.properties && feature.properties[groupingProperty]) {
                        allGroups.add(feature.properties[groupingProperty]);
                    }
                });
                state.selectedGroups.set(sourceId, new Set(allGroups));
            }
        }
    });
    const checkboxes = document.querySelectorAll('#lineGroupsList input[type=checkbox]');
    checkboxes.forEach(chk => chk.checked = true);
    applyGroupFilter(map);
    updateGroupMenu();
}

export function searchFeatures(map) {
    const term = document.getElementById('searchInput').value.toLowerCase();
    if (!term) return alert('Digite um termo para buscar.');

    const matches = [];
    state.files.forEach(file => {
        if (file.hasMarkers) {
            const markerSource = map.getSource(`${file.sourceId}-markers`);
            if (markerSource && markerSource._data.features) {
                markerSource._data.features.forEach(feature => {
                    if (feature.properties && (
                        (feature.properties.name && feature.properties.name.toLowerCase().includes(term)) ||
                        (feature.properties.Alimentador && feature.properties.Alimentador.toLowerCase().includes(term))
                    )) {
                        matches.push(feature);
                    }
                });
            }
        }
        if (file.hasLines) {
            const lineSource = map.getSource(`${file.sourceId}-lines`);
            if (lineSource && lineSource._data.features) {
                lineSource._data.features.forEach(feature => {
                    if (feature.properties && (
                        (feature.properties.name && feature.properties.name.toLowerCase().includes(term)) ||
                        (feature.properties.Alimentador && feature.properties.Alimentador.toLowerCase().includes(term))
                    )) {
                        matches.push(feature);
                    }
                });
            }
        }
    });

    const searchResultsDiv = document.getElementById('searchResults');
    if (matches.length === 0) {
        alert('Nenhum resultado encontrado para a busca.');
        searchResultsDiv.innerHTML = '';
    } else {
        let referencePoint = state.userLocation || map.getCenter().toArray();
        matches.forEach(feature => {
            const center = getFeatureCenter(feature);
            feature.properties.distance = computeDistance(referencePoint, center);
        });
        matches.sort((a, b) => a.properties.distance - b.properties.distance);
        const topResults = matches.slice(0, 5);
        displaySearchResults(topResults, map);
    }
}

function getFeatureCenter(feature) {
    let center;
    if (feature.geometry.type === 'Point') {
        center = feature.geometry.coordinates;
    } else {
        const coordinates = [];
        function extractCoords(coords) {
            if (typeof coords[0] === 'number') {
                coordinates.push(coords);
            } else {
                coords.forEach(c => extractCoords(c));
            }
        }
        extractCoords(feature.geometry.coordinates);
        const lons = coordinates.map(coord => coord[0]);
        const lats = coordinates.map(coord => coord[1]);
        const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length;
        const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
        center = [avgLon, avgLat];
    }
    return center;
}

function computeDistance(coord1, coord2) {
    const toRad = (value) => value * Math.PI / 180;
    const lat1 = coord1[1], lon1 = coord1[0], lat2 = coord2[1], lon2 = coord2[0];
    const R = 6371e3;
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function displaySearchResults(results, map) {
    const searchResultsDiv = document.getElementById('searchResults');
    searchResultsDiv.innerHTML = '';
    const ul = document.createElement('ul');

    results.forEach(result => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        const displayName = result.properties.name || result.properties.Alimentador || 'Sem nome';
        nameSpan.textContent = `${displayName} (${(result.properties.distance / 1000).toFixed(2)} km)`;

        const viewButton = document.createElement('button');
        viewButton.textContent = 'Visualizar';
        viewButton.onclick = () => {
            const center = getFeatureCenter(result);
            map.flyTo({ center: center, zoom: 16 });
            searchResultsDiv.innerHTML = '';
        };

        const googleMapsButton = document.createElement('button');
        googleMapsButton.textContent = 'Google Maps';
        googleMapsButton.onclick = () => {
            const center = getFeatureCenter(result);
            const url = `https://www.google.com/maps?q=${center[1]},${center[0]}`;
            window.open(url, '_blank');
        };

        li.appendChild(nameSpan);
        li.appendChild(viewButton);
        li.appendChild(googleMapsButton);
        ul.appendChild(li);
    });

    searchResultsDiv.appendChild(ul);
}

export function displayStyleList(map) {
    const styleList = document.getElementById('styleList');
    styleList.innerHTML = '';
    mapStyles.forEach(style => {
        const li = document.createElement('li');
        li.textContent = style.name;
        li.addEventListener('click', () => {
            changeMapStyle(map, style.url);
            document.getElementById('styleMenu').style.display = 'none';
        });
        styleList.appendChild(li);
    });
}
