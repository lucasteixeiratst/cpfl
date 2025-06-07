import { state, predefinedFiles, mapStyles } from './main.js';
import { addDataToMap, changeMapStyle } from './map.js';

// Exibir/esconder elementos
export function toggleVisibility(element) {
    element.style.display = element.style.display === 'block' ? 'none' : 'block';
}

// Atualizar lista de arquivos recentes
function updateRecentFiles(fileName) {
    let recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    recentFiles = recentFiles.filter(f => f !== fileName);
    recentFiles.unshift(fileName);
    recentFiles = recentFiles.slice(0, 5);
    localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
}

// Exibir lista de arquivos
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
            loadKMZFromURL(file.url, file.name);
            localStorage.setItem('lastSelectedFile', file.name);
            updateRecentFiles(file.name);
            displayFileList();
            document.getElementById('kmzMenu').style.display = 'none';
        });
        kmzList.appendChild(li);
    });
}

// Selecionar arquivo do dispositivo
export function selectFromDevice() {
    document.getElementById('kmzMenu').style.display = 'none';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kml,.kmz';
    input.onchange = handleFile;
    input.click();
}

// Carregar KMZ de URL
async function loadKMZFromURL(url, fileName, map) {
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

// Manipular arquivo selecionado
function handleFile(event, map) {
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

// Parsear KMZ
async function parseKMZ(data) {
    const zip = await JSZip.loadAsync(data);
    const kmlFile = zip.file(/\.kml$/i)[0];
    if (!kmlFile) throw new Error('Arquivo KML não encontrado dentro do KMZ.');
    const kmlContent = await kmlFile.async('string');
    return toGeoJSON.kml(new DOMParser().parseFromString(kmlContent, 'text/xml'));
}

// Atualizar menu de grupos
export function updateGroupMenu(map) {
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

// Atualizar lista de arquivos carregados
export function updateLoadedFilesList(fileName, map) {
    const loadedFilesList = document.getElementById('loadedFilesList');
    const li = document.createElement('li');
    li.textContent = fileName;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => {
        removeFileFromMap(fileName, map);
        li.remove();
    });
    li.appendChild(removeBtn);
    loadedFilesList.appendChild(li);
}

// Remover arquivo do mapa
function removeFileFromMap(fileName, map) {
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

// Aplicar filtro de grupos
export function applyGroupFilter(map) {
    state.files.forEach(file => {
        if (!file.hasLines || !file.groupingProperty) return;
        const sourceId = file.sourceId;
        const lineLayerId = `lines-${sourceId}`;
        const groupingProperty = file.groupingProperty;
        const selectedGroups = state.selectedGroups.get(sourceId);

        if (!selectedGroups || selectedGroups.size === 0) {
            map.setFilter(lineLayerId, ["==", ["get", groupingProperty], "___no_match___"]);
        } else if (selectedGroups.size === getTotalGroups(sourceId, groupingProperty)) {
            map.setFilter(lineLayerId, null);
        } else {
            map.setFilter(lineLayerId, ["in", ['get', groupingProperty], ...Array.from(selectedGroups)]);
        }
    });
}

function getTotalGroups(sourceId, map) {
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

// Ocultar todos os grupos
export function hideAllGroups(map) {
    state.selectedGroups.forEach((groups, sourceId) => {
        state.selectedGroups.set(sourceId, new Set());
    });
    const checkboxes = document.querySelectorAll('#lineGroupsList input[type=checkbox]');
    checkboxes.forEach(chk => chk.checked = false);
    applyGroupFilter(map);
}

// Exibir todos os grupos
export function showAllGroups(map) {
    state.files.forEach(file => {
        if (file.hasLines && file.groupingProperty && state.selectedGroups.has(file.sourceId)) {
            const sourceId = file.sourceId;
            const groupingProperty = file.groupingProperty;
            const lineSource = map.getSource(`${file.sourceId}-lines`);
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

// Buscar características
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
        return;
    }

    let referencePoint = state.userLocation || map.getCenter().toArray();
    matches.forEach(feature => {
        const center = getFeatureCenter(feature);
        feature.properties.distance = computeDistance(referencePoint);
        center, feature;
    });
    matches.sort((a, b) => a.properties.distance - b.properties.distance);
    const topResults = matches.slice(0, 5);
    displaySearchResults(topResults);
}

// Exibir resultados da busca
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

// Obter centro da feature
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
        const avgLat = latlats.reduce((a, b) => a + b, 0) / lats.length;
        center = [avgLon, avgLat];
    }
    return center;
}

// Calcular distância
function computeDistance(coord1, coord2) {
    const toRad = (value => value * Math.PI / 180);
    const lat1 = coord1[1], lon1 = coord1[0], lat2 = coord2[1], lon2 = coord2[0];
    const R = 6371e3;
    const φ1 = toRad(lat1), lat2;
    const φ2 = toRad(lat2), coord2[1];
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Exibir lista de estilos
export function displayStyleList(map) {
    const styleList = document.getElement.getElementById('styleList');
    styleList.innerHTML = '';
    mapStyles.forEach(style => {
        const li = styleList.createElement('li');
        li.textContent = style.name;
        li.addEventListener('click', () => {
            changeMapStyle(style.url, style);
            document.styleMenu.getElementById('styleMenu').style.display = 'none';
        });
        styleList.appendChild(li);
    });
}