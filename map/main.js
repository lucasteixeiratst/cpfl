import { initMap, resetView, goToCurrentLocation, changeMapStyle, toggleMarkers, toggleNames, toggleLines } from './map.js';
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

// Configurações
export const mapStyles = [
    { name: 'Positron', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
    { name: 'Dark Matter', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
    { name: 'Voyager', url: 'https://demotiles.maplibre.org/style.json' } // Estilo alternativo
];

export const predefinedFiles = [
    { name: 'AGUAS DE LINDOIA.kmz', url: './AGUAS DE LINDOIA.kmz' },
    { name: 'AGUDOS.kmz', url: './AGUDOS.kmz' },
    { name: 'ALTINOPOLIS.kmz', url: './ALTINOPOLIS.kmz' },
];

// Inicialização
if (typeof maplibregl === 'undefined') {
    console.error('MapLibreGL não carregado');
    alert('Erro ao carregar o mapa. Verifique sua conexão com a internet.');
} else {
    const map = initMap();
    const elements = {
        searchInput: document.getElementById('searchInput'),
        kmzMenu: document.getElementById('kmzMenu'),
        lineMenu: document.getElementById('lineMenu'),
        loadedFilesMenu: document.getElementById('loadedFilesMenu'),
        styleMenu: document.getElementById('styleMenu')
    };

    // Eventos
    document.getElementById('btnKMZ').addEventListener('click', () => toggleVisibility(elements.kmzMenu));
    document.getElementById('btnMarkers').addEventListener('click', () => toggleMarkers(map));
    document.getElementById('btnNames').addEventListener('click', () => toggleNames(map));
    document.getElementById('btnLines').addEventListener('click', () => toggleLines(map));
    document.getElementById('btnReset').addEventListener('click', () => resetView(map));
    document.getElementById('btnLocation').addEventListener('click', () => goToCurrentLocation(map));
    document.getElementById('btnSearch').addEventListener('click', () => searchFeatures(map));
    document.getElementById('selectDevice').addEventListener('click', selectFromDevice);
    document.getElementById('hideAll').addEventListener('click', () => hideAllGroups(map));
    document.getElementById('showAll').addEventListener('click', () => showAllGroups(map));
    document.getElementById('btnStyles').addEventListener('click', () => {
        displayStyleList(map);
        toggleVisibility(elements.styleMenu);
    });
    document.getElementById('btnLineGroups').addEventListener('click', () => {
        if (state.selectedGroups.size === 0) {
            alert('Não há grupos de linhas para filtrar.');
        } else {
            toggleVisibility(elements.lineMenu);
        }
    });
    document.getElementById('btnLoadedFiles').addEventListener('click', () => toggleVisibility(elements.loadedFilesMenu));

    // Inicializar lista de arquivos
    displayFileList();

    // Carregar último arquivo selecionado
    map.on('load', () => {
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
}
