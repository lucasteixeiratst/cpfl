// parser.worker.js

// Importa apenas a biblioteca para descompactar (JSZip)
importScripts("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.6.0/jszip.min.js");

self.onmessage = async (event) => {
    const { arrayBuffer, fileName } = event.data;

    try {
        // Descompacta o ArrayBuffer
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Encontra o primeiro arquivo .kml dentro do zip
        const kmlFile = zip.file(/\.kml$/i)[0];
        if (!kmlFile) {
            throw new Error('Arquivo KML não encontrado dentro do KMZ.');
        }
        
        // Extrai o conteúdo KML como uma string de texto
        const kmlString = await kmlFile.async('string');
        
        // Envia a string de volta para a thread principal
        self.postMessage({ 
            success: true, 
            kmlString: kmlString, 
            fileName: fileName 
        });

    } catch (error) {
        // Envia uma mensagem de erro se a descompactação falhar
        self.postMessage({ 
            success: false, 
            error: error.message, 
            fileName: fileName 
        });
    }
};
