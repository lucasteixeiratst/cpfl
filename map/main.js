import { initMap, resetView, goToCurrentLocation, toggleMarkers, toggleNames, toggleLines, changeMapStyle } from './map.js';
import { displayFileList, toggleVisibility, selectFromDevice, searchFeatures, updateGroupMenu, hideAllGroups, showAllGroups, displayStyleList, loadKMZFromURL } from './fileProcessor.js';

// Estado global
export const state = {
    markersVisible: true,
    namesVisible: true,
    linesVisible: true,
    userLocation: null,
    files: [],
    selectedGroups: new Map(),
};

export const mapStyles = [
    { name: 'Positron', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
    { name: 'Dark Matter', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
    { name: 'Voyager', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' }
];

export const predefinedFiles = [
    { name: 'AGUAS DE LINDOIA.kmz', url: './AGUAS DE LINDOIA.kmz' },
    { name: 'AGUDOS.kmz', url: './AGUDOS.kmz' },
    { name: 'ALTINOPOLIS.kmz', url: './ALTINOPOLIS.kmz' },
    // Outros arquivos ...
];

document.addEventListener('DOMContentLoaded', () => {
    if (typeof maplibregl === 'undefined') {
        console.error('MapLibreGL não carregado');
        alert('Erro ao carregar o mapa.');
        return;
    }

    console.log('MapLibreGL carregado com sucesso');
    const map = initMap();
    if (!map) {
        console.error('Falha ao criar o mapa');
        return;
    }

    const elements = {
        searchInput: document.getElementById('searchInput'),
        kmzMenu: document.getElementById('kmzMenu'),
        lineMenu: document.getElementById('lineMenu'),
        loadedFilesMenu: document.getElementById('loadedFilesMenu'),
        styleMenu: document.getElementById('styleMenu')
    };

    // Verificar se os elementos existem
    Object.entries(elements).forEach(([key, el]) => {
        if (!el) console.warn(`Elemento '${key}' não encontrado no DOM`);
    });

    // Eventos
    const btnKMZ = document.getElementById('btnKMZ');
    if (btnKMZ) {
        btnKMZ.addEventListener('click', () => toggleVisibility(elements.kmzMenu));
    } else {
        console.error('Botão btnKMZ não encontrado');
    }

    const btnMarkers = document.getElementById('btnMarkers');
    if (btnMarkers) {
        btnMarkers.addEventListener('click', () => toggleMarkers(map));
    } else {
        console.error('Botão btnMarkers não encontrado');
    }

    const btnNames = document.getElementById('btnNames');
    if (btnNames) {
        btnNames.addEventListener('click', () => toggleNames(map));
    } else {
        console.error('Botão btnNames não encontrado');
    }

    const btnLines = document.getElementById('btnLines');
    if (btnLines) {
        btnLines.addEventListener('click', () => toggleLines(map));
    } else {
        console.error('Botão btnLines não encontrado');
    }

    const btnReset = document.getElementById('btnReset');
    if (btnReset) {
        btnReset.addEventListener('click', () => resetView(map));
    } else {
        console.error('Botão btnReset não encontrado');
    }

    const btnLocation = document.getElementById('btnLocation');
    if (btnLocation) {
        btnLocation.addEventListener('click', () => goToCurrentLocation(map));
    } else {
        console.error('Botão btnLocation não encontrado');
    }

    const btnSearch = document.getElementById('btnSearch');
    if (btnSearch) {
        btnSearch.addEventListener('click', () => searchFeatures(map));
    } else {
        console.error('Botão btnSearch não encontrado');
    }

    const selectDevice = document.getElementById('selectDevice');
    if (selectDevice) {
        selectDevice.addEventListener('click', selectFromDevice);
    } else {
        console.error('Elemento selectDevice não encontrado');
    }

    const hideAll = document.getElementById('hideAll');
    if (hideAll) {
        hideAll.addEventListener('click', () => hideAllGroups(map));
    } else {
        console.error('Botão hideAll não encontrado');
    }

    const showAll = document.getElementById('showAll');
    if (showAll) {
        showAll.addEventListener('click', () => showAllGroups(map));
    } else {
        console.error('Botão showAll não encontrado');
    }

    const btnStyles = document.getElementById('btnStyles');
    if (btnStyles) {
        btnStyles.addEventListener('click', () => {
            displayStyleList(map);
            toggleVisibility(elements.styleMenu);
        });
    } else {
        console.error('Botão btnStyles não encontrado');
    }

    const btnLineGroups = document.getElementById('btnLineGroups');
    if (btnLineGroups) {
        btnLineGroups.addEventListener('click', () => {
            if (state.selectedGroups.size === 0) {
                alert('Não há grupos de linhas para filtrar.');
            } else {
                toggleVisibility(elements.lineMenu);
            }
        });
    } else {
        console.error('Botão btnLineGroups não encontrado');
    }

    const btnLoadedFiles = document.getElementById('btnLoadedFiles');
    if (btnLoadedFiles) {
        btnLoadedFiles.addEventListener('click', () => toggleVisibility(elements.loadedFilesMenu));
    } else {
        console.error('Botão btnLoadedFiles não encontrado');
    }

    // Inicializar lista de arquivos
    displayFileList();

    // Carregar último arquivo selecionado
    map.on('load', () => {
        console.log('Mapa carregado');
        const lastFile = localStorage.getItem('lastSelectedFile');
        if (lastFile) {
            const file = predefinedFiles.find(f => f.name === lastFile);
            if (file) loadKMZFromURL(file.url, file.name, map);
        }
    });

    // Exibir/esconder legendas
    const menuButtons = document.querySelectorAll('.menu button');
    menuButtons.forEach(button => {
        button.addEventListener('click', () => {
            const legend = button.querySelector('.button-legend');
            if (legend) {
                legend.style.display = 'block';
                setTimeout(() => legend.style.display = 'none', 5000);
            }
        });
    });

    window.onload = () => {
        setTimeout(() => {
            document.querySelectorAll('.button-legend').forEach(legend => legend.style.display = 'none');
        }, 10000);
    };
});
