// ui.js - melhorias de interface e controle de menus
import { MAP_CONFIG, state, updateState } from './config.js';
import mapController from './map.js';
import { debounce, formatters } from './utils.js';

// Exibe sobreposição de carregamento
export function showLoading(msg = 'Carregando...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading';
        overlay.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${msg}</div>`;
        document.body.appendChild(overlay);
    } else {
        const textElement = overlay.querySelector('.loading-text');
        if (textElement) textElement.textContent = msg;
    }
    overlay.style.display = 'flex';
}

export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

export function showStatus(msg, type = 'success', timeout = 3000) {
    let indicator = document.getElementById('status-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'status-indicator';
        indicator.className = 'status-indicator';
        document.body.appendChild(indicator);
    }
    indicator.textContent = msg;
    indicator.className = `status-indicator ${type}`;
    indicator.style.display = 'block';
    setTimeout(() => {
        indicator.style.display = 'none';
    }, timeout);
}

export function displayStyleList() {
    const styleMenu = document.getElementById('styleMenu');
    const styleList = document.getElementById('styleList');
    if (!styleMenu || !styleList) return;

    styleList.innerHTML = '';
    MAP_CONFIG.styles.forEach(style => {
        const li = document.createElement('li');
        li.textContent = style.name;
        li.onclick = () => {
            updateState({ currentStyle: style.name });
            mapController.getMap().setStyle(style.url);
            styleMenu.style.display = 'none';
            showStatus(`Estilo alterado para ${style.name}`, 'success');
        };
        styleList.appendChild(li);
    });
}

export function displaySearchResults(results) {
    const searchResultsDiv = document.getElementById('searchResults');
    if (!searchResultsDiv) return;

    searchResultsDiv.innerHTML = '';
    if (!results || results.length === 0) {
        searchResultsDiv.innerHTML = '<div style="padding:12px;">Nenhum resultado encontrado.</div>';
        searchResultsDiv.style.display = 'block';
        return;
    }

    const ul = document.createElement('ul');
    results.forEach(result => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        const displayName = result.properties?.name || result.properties?.Alimentador || 'Sem nome';
        nameSpan.textContent = `${displayName} ${result.properties?.distance !== undefined ? '(' + formatters.distance(result.properties.distance) + ')' : ''}`;
        li.appendChild(nameSpan);

        const viewButton = document.createElement('button');
        viewButton.textContent = 'Visualizar';
        viewButton.onclick = () => {
            const center = result.geometry && result.geometry.coordinates
                ? (result.geometry.type === 'Point'
                    ? result.geometry.coordinates
                    : (Array.isArray(result.geometry.coordinates[0])
                        ? result.geometry.coordinates[0]
                        : result.geometry.coordinates))
                : null;
            if (center) {
                mapController.flyToLocation(center);
            }
            searchResultsDiv.style.display = 'none';
        };
        li.appendChild(viewButton);

        const googleButton = document.createElement('button');
        googleButton.textContent = 'Google Maps';
        googleButton.onclick = () => {
            const center = result.geometry && result.geometry.coordinates
                ? (result.geometry.type === 'Point'
                    ? result.geometry.coordinates
                    : (Array.isArray(result.geometry.coordinates[0])
                        ? result.geometry.coordinates[0]
                        : result.geometry.coordinates))
                : null;
            if (center) {
                window.open(`https://www.google.com/maps?q=${center[1]},${center[0]}`, '_blank');
            }
        };
        li.appendChild(googleButton);

        ul.appendChild(li);
    });
    searchResultsDiv.appendChild(ul);
    searchResultsDiv.style.display = 'block';
}

export function toggleVisibility(element) {
    if (!element) return;
    element.style.display = (element.style.display === 'block') ? 'none' : 'block';
}

export function setupMenuToggles() {
    document.getElementById('btnLoadedFiles')?.addEventListener('click', () => toggleVisibility(document.getElementById('loadedFilesMenu')));
    document.getElementById('btnLineGroups')?.addEventListener('click', () => toggleVisibility(document.getElementById('lineMenu')));
    document.getElementById('btnStyles')?.addEventListener('click', () => {
        displayStyleList();
        toggleVisibility(document.getElementById('styleMenu'));
    });
    document.getElementById('btnKMZ')?.addEventListener('click', () => toggleVisibility(document.getElementById('kmzMenu')));
}

export function updateRecentFiles(fileName) {
    let recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    recentFiles = [fileName, ...recentFiles.filter(f => f !== fileName)].slice(0, 5);
    localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
}

export function updateLoadedFilesList() {
    const loadedFilesList = document.getElementById('loadedFilesList');
    if (!loadedFilesList) return;

    loadedFilesList.innerHTML = '';
    state.files.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file.name;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remover';
        removeBtn.onclick = () => {
            const idx = state.files.findIndex(f => f.name === file.name);
            if (idx >= 0) state.files.splice(idx, 1);
            li.remove();
        };
        li.appendChild(removeBtn);
        loadedFilesList.appendChild(li);
    });
}

export function updateGroupMenu(groups) {
    const lineGroupsList = document.getElementById('lineGroupsList');
    if (!lineGroupsList) return;

    lineGroupsList.innerHTML = '';
    if (!groups) return;

    groups.forEach(grp => {
        const li = document.createElement('li');
        const lbl = document.createElement('label');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = grp;
        chk.checked = true;
        chk.onchange = () => {
            // lógica de filtro de grupos pode ser implementada aqui
        };
        lbl.appendChild(chk);
        lbl.appendChild(document.createTextNode(' ' + grp));
        li.appendChild(lbl);
        lineGroupsList.appendChild(li);
    });
}

export const setupSearchInput = (searchHandler) => {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    searchInput.oninput = debounce(searchHandler, 350);
};

export default {
    showLoading,
    hideLoading,
    showStatus,
    displayStyleList,
    displaySearchResults,
    toggleVisibility,
    setupMenuToggles,
    updateRecentFiles,
    updateLoadedFilesList,
    updateGroupMenu,
    setupSearchInput
};
