// ==========================================
// WORKER PER ZBAR WASM SCANNER
// ==========================================

importScripts('../libs/zbar/zbar.js');

let scanner = null;

async function initZBar() {
    try {
        // Configura il percorso di zbar.wasm
        zbarWasm.setModuleArgs({
            locateFile: (file) => `../libs/zbar/${file}`
        });
        // Inizializza l'istanza WASM
        await zbarWasm.getInstance();
        
        // Usa lo scanner di default fornito da @undecaf/zbar-wasm
        scanner = await zbarWasm.getDefaultScanner();

        // Configurazioni avanzate usando gli integer noti di ZBar
        // Disabilita tutto
        scanner.setConfig(0, 0, 0); 
        // Abilita solo QRCODE (ZBAR_QRCODE = 64)
        scanner.setConfig(64, 0, 1);
        
        // X e Y Density a 2 (salta pixel per QR grandi)
        // ZBAR_CFG_X_DENSITY = 256, ZBAR_CFG_Y_DENSITY = 257
        scanner.setConfig(64, 256, 2);
        scanner.setConfig(64, 257, 2);

        postMessage({ type: 'init', success: true });
    } catch (e) {
        console.error("Errore inizializzazione ZBar:", e);
        postMessage({ type: 'init', success: false, error: e.message || String(e) });
    }
}

initZBar();

self.addEventListener('message', async (e) => {
    if (!scanner) {
        postMessage({ type: 'result', data: null, error: 'ZBar non ancora inizializzato' });
        return;
    }

    if (e.data.type === 'decode') {
        const { rgbaBuffer, width, height } = e.data;
        try {
            // Conversione RGBA -> Grayscale a 8-bit spostata nel Worker
            const rgba = new Uint8ClampedArray(rgbaBuffer);
            const luminance = new Uint8Array(width * height);
            for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
                // Formula ottimizzata con bitshift
                luminance[j] = (19595 * rgba[i] + 38469 * rgba[i + 1] + 7472 * rgba[i + 2]) >> 16;
            }

            // Mappa di luminanza a 8-bit inviata a ZBar
            const symbols = await zbarWasm.scanGrayBuffer(luminance.buffer, width, height, scanner);

            let payload = null;
            if (symbols && symbols.length > 0) {
                // decode() ritorna il payload decodificato come stringa testuale
                payload = symbols[0].decode();
            }

            postMessage({ type: 'result', data: payload });

        } catch (err) {
            console.error("Errore durante la scansione:", err);
            postMessage({ type: 'result', data: null, error: err.message || String(err) });
        }
    }
});
