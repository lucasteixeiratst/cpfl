// ---------------------------------------------------------------------------------------
// APP.JS - Inicialização e integração de toda a aplicação
// Última atualização: 2025-06-08 21:45:00
// Autor: lucasteixeiratst
// ---------------------------------------------------------------------------------------

import { state, updateState, loadStateFromCache, ERROR_MESSAGES } from './config.js';
import mapController, { initMap } from './map.js';
import dataManager, { uploadToSupabase, searchFeatures, fetchFeatures } from './data.js';
import ui, { showLoading, hideLoading, showStatus, displaySearchResults, setupMenuToggles, setupSearchInput, updateLoadedFilesList } from './ui.js';

// Inicialização principal
export async function initializeApp() {
    try {
        showLoading('Inicializando mapa...');
        loadStateFromCache();
        await initMap();

        // Carrega features do banco automaticamente
        showLoading('Carregando dados do banco...');
        await fetchFeatures();
        hideLoading();
        updateLoadedFilesList();

        // Configura Menus e Botões
        setupMenuToggles();
        setupSearchInput(onSearchInput);

        // Botão upload para Supabase
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

        // Botão carregar próximos
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

        // Botão buscar
        const btnSearch = document.getElementById('btnSearch');
        if (btnSearch) {
            btnSearch.onclick = onSearchInput;
        }

        // Botão reset view
        const btnReset = document.getElementById('btnReset');
        if (btnReset) {
            btnReset.onclick = () => {
                mapController.getMap().easeTo({ center: [-47.068847, -22.934973], zoom: 13 });
            };
        }

        // Botão localização
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
