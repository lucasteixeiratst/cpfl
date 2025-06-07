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

    sortedFiles.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file.name;
        li.tabIndex = 0; // Acessibilidade para teclado
        li.addEventListener('click', () => {
            loadKMZFromURL(file.url, file.name, map);
            localStorage.setItem('lastSelectedFile', file.name);
            updateRecentFiles(file.name);
            displayFileList();
            toggleVisibility(document.getElementById('kmzMenu'));
        });
        li.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                li.click();
            }
        });
        kmzList.appendChild(li);
    });
}

// Selecionar arquivo do dispositivo
export function selectFromDevice() {
    toggleVisibility(document.getElementById('kmzMenu'));
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kml,.kmz';
    input.onchange = e => handleFile(e, map);
    input.click();
}

// Carregar KMZ de URL
export async function loadKMZFromURL(url, fileName, map) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType.includes('application/vnd.google-earth.kmz')) {
            const arrayBuffer = await response.arrayBuffer();
            data = await parseKMZ(arrayBuffer);
        } else if (contentType.includes('application/vnd.google-earth.kml+xml')) {
            const text = await response.text();
            data = toGeoJSON.kml(new DOMParser().parseFromString(text, 'text/xml'));
        } else {
            throw new Error('Formato de arquivo não suportado.');
        }
        addDataToMap(data, fileName, map);
        updateRecentFiles(fileName);
        updateLoadedFilesList(fileName, map);
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
            updateLoadedFilesList(file.name, map);
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
    const kmlFile = Object.keys(zip.files).find(name => name.match(/\.kml$/i));
    if (!kmlFile) throw new Error('Arquivo KML não encontrado dentro do KMZ.');
    const kmlContent = await zip.file(kmlFile).async('string');
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
            fileHeader.textContent = `Arquivo: ${file.name}`;
            lineGroupsList.appendChild(fileHeader);

            const sortedGroups = Array.from(groups).sort((a, b) => a.localeCompare(b));
            sortedGroups.forEach(group => {
                const li = document.createElement('li');
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = group;
                checkbox.checked = true;
                checkbox.addEventListener('change', () => {
                    const selectedGroups = state.selectedGroups.get(file.sourceId);
                    if (checkbox.checked) {
                        selectedGroups.add(group);
                    } else {
                        selectedGroups.delete(group);
                    }
                    applyGroupFilter(map);
                });
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${group}`));
                li.appendChild(label);
                lineGroupsList.appendChild(li);
            });
        }
    });
}

// Atualizar lista de arquivos carregados
export function updateLoadedFilesList(fileName, map) {
    const loadedFilesList = document.getElementById('loadedFilesList');
    const existingItem = Array.from(loadedFilesList.children).find(li => li.textContent.includes(fileName));
    if (existingItem) return;

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

    state.selectedGroups.delete(sourceId);
    state.files.splice(fileIndex, 1);
    updateGroupMenu(map);
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
            map.setFilter(lineLayerId, ['==', ['get', groupingProperty], '']);
        } else {
            const allGroups = new Set(
                file.lineFeatures.features
                    .filter(f => f.properties && f.properties[groupingProperty])
                    .map(f => f.properties[groupingProperty])
            );
            if (selectedGroups.size === allGroups.size) {
                map.setFilter(lineLayerId, null);
            } else {
                map.setFilter(lineLayerId, ['in', ['get', groupingProperty], ...Array.from(selectedGroups)]);
            }
        }
    });
}

// Ocultar todos os grupos
export function hideAllGroups(map) {
    state.selectedGroups.forEach((groups, sourceId) => {
        groups.clear();
    });
    document.querySelectorAll('#lineGroupsList input[type=checkbox]').forEach(chk => {
        chk.checked = false;
    });
    applyGroupFilter(map);
}

// Exibir todos os grupos
export function showAllGroups(map) {
    state.files.forEach(file => {
        if (file.hasLines && file.groupingProperty) {
            const sourceId = file.sourceId;
            const allGroups = new Set(
                file.lineFeatures.features
                    .filter(f => f.properties && f.properties[groupingProperty])
                    .map(f => f.properties[groupingProperty])
            );
            state.selectedGroups.set(sourceId, new Set(allGroups));
        }
    });
    document.querySelectorAll('#lineGroupsList input[type=checkbox]').forEach(chk => {
        chk.checked = true;
    });
    applyGroupFilter(map);
    updateGroupMenu(map);
}

// Buscar características
export function searchFeatures(map) {
    const term = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!term) {
        alert('Digite um termo para buscar.');
        document.getElementById('searchResults').innerHTML = '';
        return;
    }

    const matches = [];
    state.files.forEach(file => {
        if (file.hasMarkers) {
            file.pointFeatures.features.forEach(feature => {
                if (
                    feature.properties &&
                    ((feature.properties.name && feature.properties.name.toLowerCase().includes(term)) ||
                     (feature.properties.Alimentador && feature.properties.Alimentador.toLowerCase().includes(term)))
                ) {
                    matches.push({ feature, file });
                }
            });
        }
        if (file.hasLines) {
            file.lineFeatures.features.forEach(feature => {
                if (
                    feature.properties &&
                    ((feature.properties.name && feature.properties.name.toLowerCase().includes(term)) ||
                     (feature.properties.Alimentador && feature.properties.Alimentador.toLowerCase().includes(term)))
                ) {
                    matches.push({ feature, file });
                }
            });
        }
    });

    const searchResultsDiv = document.getElementById('searchResults');
    if (matches.length === 0) {
        alert('Nenhum resultado encontrado.');
        searchResultsDiv.innerHTML = '';
        return;
    }

    const referencePoint = state.userLocation || map.getCenter().toArray();
    matches.forEach(match => {
        const center = getFeatureCenter(match.feature);
        match.distance = computeDistance(referencePoint, center);
    });

    matches.sort((a, b) => a.distance - b.distance);
    displaySearchResults(matches.slice(0, 5), map);
}

// Exibir resultados da busca
function displaySearchResults(results, map) {
    const searchResultsDiv = document.getElementById('searchResults');
    searchResultsDiv.innerHTML = '';
    const ul = document.createElement('ul');

    results.forEach(({ feature, file, distance }) => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        const displayName = feature.properties.name || feature.properties.Alimentador || 'Sem nome';
        nameSpan.textContent = `${displayName} (${(distance / 1000).toFixed(2)} km)`;

        const viewButton = document.createElement('button');
        viewButton.textContent = 'Visualizar';
        viewButton.addEventListener('click', () => {
            const center = getFeatureCenter(feature);
            map.flyTo({ center, zoom: 16, duration: 1000 });
            searchResultsDiv.innerHTML = '';
        });

        const googleMapsButton = document.createElement('button');
        googleMapsButton.textContent = 'Google Maps';
        googleMapsButton.addEventListener('click', () => {
            const center = getFeatureCenter(feature);
            window.open(`https://www.google.com/maps?q=${center[1]},${center[0]}`, '_blank');
        });

        li.appendChild(nameSpan);
        li.appendChild(viewButton);
        li.appendChild(googleMapsButton);
        ul.appendChild(li);
    });

    searchResultsDiv.appendChild(ul);
}

// Obter centro da feature
function getFeatureCenter(feature) {
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
    const lons = coordinates.map(coord => coord[0]);
    const lats = coordinates.map(coord => coord[1]);
    const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length;
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    return [avgLon, avgLat];
}

// Calcular distância
function computeDistance(coord1, coord2) {
    const toRad = value => value * Math.PI / 180;
    const lat1 = coord1[1], lon1 = coord1[0], lat2 = coord2[1], lon2 = coord2[0];
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Exibir lista de estilos
export function displayStyleList(map) {
    const styleList = document.getElementById('styleList');
    styleList.innerHTML = '';
    mapStyles.forEach(style => {
        const li = document.createElement('li');
        li.textContent = style.name;
        li.tabIndex = 0;
        li.addEventListener('click', () => {
            changeMapStyle(style.url, map);
            toggleVisibility(document.getElementById('styleMenu'));
        });
        li.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                li.click();
            }
        });
        styleList.appendChild(li);
    });
}
