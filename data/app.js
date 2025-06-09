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

        // [Restante do código para configuração de menus e botões]
    } catch (error) {
        hideLoading();
        showStatus(error.message || ERROR_MESSAGES.INITIALIZATION_FAILED, 'error');
        console.error('Erro na inicialização da aplicação:', error);
    }
}
