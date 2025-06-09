// APP.JS - Inicialização e integração de toda a aplicação
// Última atualização: 2025-06-09 18:17
// Autor: lucasteixeiratst

import { state, updateState, loadStateFromCache, ERROR_MESSAGES } from './config.js';
import mapController, { initMap } from './map.js';
import dataManager, { uploadToSupabase, searchFeatures, fetchFeatures } from './data.js';
import ui, { showLoading, hideLoading, showStatus, displaySearchResults, setupMenuToggles, setupSearchInput, updateLoadedFilesList } from './ui.js';

// Inicialização principal
export async function initializeApp() {
    try {
        showLoading('Inicializando mapa...');
        loadStateFromCache();

        const mapInstance = await initMap();
        if (!mapInstance) throw new Error('Falha ao inicializar o mapa');

        showLoading('Carregando dados do banco...');
        try {
            await fetchFeatures();
        } catch (error) {
            showStatus('Falha ao carregar dados do banco, verifique a conexão.', 'warning');
            console.error('Erro ao carregar features:', error);
        }
        hideLoading();
        updateLoadedFilesList();

        setupMenuToggles();
        setupSearchInput(onSearchInput);

        const btnUploadSupabase = document.getElementById('btnUploadSupabase');
        if (btnUploadSupabase) {
            btnUploadSupabase.onclick = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.kml,.kmz';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    try {
                        showLoading('Enviando arquivo para Supabase...');
                        const result = await uploadToSupabase(file);
                        showStatus(result.message, 'success');
                        updateLoadedFilesList();
                        hideLoading();
                    } catch (error) {
                        hideLoading();
                        showStatus(error.message || ERROR_MESSAGES.UPLOAD_FAILED, 'error');
                    }
                };
                input.click();
            };
        }

        const btnCarregarProximos = document.getElementById('btnCarregarProximos');
        if (btnCarregarProximos) {
            btnCarregarProximos.onclick = async () => {
                showLoading('Buscando arquivos próximos...');
                setTimeout(() => {
                    hideLoading();
                    showStatus('Função de carregar arquivos próximos ainda não implementada.', 'warning');
                }, 1000);
            };
        }

        const btnSearch = document.getElementById('btnSearch');
        if (btnSearch) {
            btnSearch.onclick = onSearchInput;
        }

        const btnReset = document.getElementById('btnReset');
        if (btnReset) {
            btnReset.onclick = () => {
                mapController.getMap().easeTo({ center: [-47.068847, -22.934973], zoom: 13 });
            };
        }

        const btnLocation = document.getElementById('btnLocation');
        if (btnLocation) {
            btnLocation.onclick = () => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((position) => {
                        const userCoords = [position.coords.longitude, position.coords.latitude];
                        updateState({ userLocation: userCoords });
                        mapController.flyToLocation(userCoords);
                        mapController.addUserLocationMarker(userCoords);
                    }, () => {
                        showStatus(ERROR_MESSAGES.GEOLOCATION_FAILED, 'error');
                    });
                } else {
                    showStatus(ERROR_MESSAGES.GEOLOCATION_UNSUPPORTED, 'error');
                }
            };
        }

        hideLoading();
        showStatus('Mapa pronto!', 'success', 1200);

    } catch (error) {
        hideLoading();
        showStatus(error.message || ERROR_MESSAGES.INITIALIZATION_FAILED, 'error');
        console.error('Erro na inicialização da aplicação:', error);
    }
}

// Handler da barra de busca
async function onSearchInput() {
    const input = document.getElementById('searchInput');
    if (!input || input.value.trim().length < 2) {
        displaySearchResults([]);
        return;
    }
    showLoading('Buscando...');
    try {
        const results = await searchFeatures(input.value.trim());
        displaySearchResults(results);
    } catch (error) {
        showStatus(error.message || ERROR_MESSAGES.SEARCH_FAILED, 'error');
        displaySearchResults([]);
    } finally {
        hideLoading();
    }
}

export default { initializeApp };
