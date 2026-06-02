const I18N = (() => {
    const translations = {
        en: {
            "btn_send": "Send",
            "btn_receive": "Receive",
            "btn_back": "← Back",
            "btn_about": "ℹ️ About / Credits",
            "title_send": "Send",
            "title_receive": "Receive",
            "label_choose_file": "Choose a file...",
            "no_file_selected": "No file selected",
            "placeholder_text": "... or paste the text you want to send directly here.",
            "sending_progress": "Sending...",
            "label_speed": "Speed:",
            "label_density": "Density:",
            "density_sound": "Sound (Acoustic)",
            "receiver_mode_visual": "Visual Mode: Scanning QR Codes...",
            "receiver_mode_acoustic": "Acoustic Mode: Listening to Audio...",
            "sound_sending": "Chirping data fragments...",
            "sound_warning": "⚠️ Ensure 'Silent Mode' is OFF and Volume is UP",
            "label_audio_speed": "Audio Speed:",
            "speed_normal": "Normal",
            "speed_fast": "Fast",
            "speed_fastest": "Fastest",
            "speed_ultrasonic": "Ultrasonic",
            "init_camera": "Initializing camera...",
            "receiver_idle": "Please select a mode to start receiving...",
            "about_mit": "This software is provided \"AS IS\" under the MIT License.",
            "about_credits": "Open Source Credits:",
            "about_privacy_title": "Privacy Policy:",
            "about_privacy_text": "This app works entirely offline. Files are processed locally on your device and are never uploaded to any server. The app is hosted on GitHub Pages, which may record basic visitor logs (such as IP addresses) in accordance with GitHub's privacy policy. We do not use any tracking cookies or third-party analytics.",
            
            // Dynamic text from app.js
            "err_compression": "❌ Compression error: ",
            "err_ur_encoding": "❌ UR encoding error: ",
            "err_qrcode": "❌ QRCode error: ",
            "sending_total": "Sending... (Total fragments: ",
            "sending_fraction": "Sending... (",
            "frame_qr": " QR)",
            "frame_audio": " Sound)",
            "frame_camera": "Frame the QR Code...",
            "err_camera": "❌ Camera: ",
            "err_mic": "❌ Microphone: ",
            "err_decode_fail": "❌ Decode failed, restarting...",
            "success_100": "100% complete! Processing...",
            "success_decomp": "✅ Complete! Decompressing...",
            "success_saving": "✅ Saving...",
            "success_file_received": "File received successfully!",
            "err_generic": "❌ Error: ",
            "success_clipboard": "Text copied to clipboard!",
            "status_pct_complete": "% complete",
            "camera_permissions": " — Check permissions.",
            "mic_permissions": " — Check permissions."
        },
        it: {
            "btn_send": "Invia",
            "btn_receive": "Ricevi",
            "btn_back": "← Indietro",
            "btn_about": "ℹ️ About / Credits",
            "title_send": "Invia",
            "title_receive": "Ricevi",
            "label_choose_file": "Scegli un file...",
            "no_file_selected": "Nessun file selezionato",
            "placeholder_text": "... oppure incolla direttamente qui il testo che vuoi inviare.",
            "sending_progress": "Invio in corso...",
            "label_speed": "Velocità:",
            "label_density": "Densità:",
            "density_sound": "Audio (Acustico)",
            "receiver_mode_visual": "Modalità Visiva: Scansione QR Code...",
            "receiver_mode_acoustic": "Modalità Acustica: Ascolto Audio...",
            "sound_sending": "Trasmissione frammenti audio...",
            "sound_warning": "⚠️ Assicurati che 'Modalità Silenzioso' sia OFF e il Volume sia ALTO",
            "label_audio_speed": "Velocità Audio:",
            "speed_normal": "Normale",
            "speed_fast": "Veloce",
            "speed_fastest": "Velocissima",
            "speed_ultrasonic": "Ultrasuoni",
            "init_camera": "Inizializzazione fotocamera...",
            "receiver_idle": "Seleziona una modalità per iniziare a ricevere...",
            "about_mit": "Questo software è fornito \"COSÌ COM'È\" sotto Licenza MIT.",
            "about_credits": "Crediti Open Source:",
            "about_privacy_title": "Informativa Privacy:",
            "about_privacy_text": "Questa app funziona interamente offline. I file vengono elaborati localmente sul tuo dispositivo e non vengono mai caricati su alcun server. L'app è ospitata su GitHub Pages, che potrebbe registrare log di base (come gli indirizzi IP) in base alla propria privacy policy. Non utilizziamo cookie di tracciamento o analytics di terze parti.",
            
            // Dynamic text from app.js
            "err_compression": "❌ Errore compressione: ",
            "err_ur_encoding": "❌ Errore encoding UR: ",
            "err_qrcode": "❌ Errore QRCode: ",
            "sending_total": "Invio in corso... (Frammenti totali: ",
            "sending_fraction": "Invio in corso... (",
            "frame_qr": " QR)",
            "frame_audio": " Audio)",
            "frame_camera": "Inquadra il QR Code...",
            "err_camera": "❌ Camera: ",
            "err_mic": "❌ Microfono: ",
            "err_decode_fail": "❌ Decodifica fallita, riavvio...",
            "success_100": "100% completato! Elaborazione...",
            "success_decomp": "✅ Completato! Decompressione...",
            "success_saving": "✅ Salvataggio in corso...",
            "success_file_received": "File ricevuto con successo!",
            "err_generic": "❌ Errore: ",
            "success_clipboard": "Testo copiato negli appunti!",
            "status_pct_complete": "% completato",
            "camera_permissions": " — Controlla i permessi.",
            "mic_permissions": " — Controlla i permessi."
        },
        es: {
            "btn_send": "Enviar",
            "btn_receive": "Recibir",
            "btn_back": "← Atrás",
            "btn_about": "ℹ️ Acerca de / Créditos",
            "title_send": "Enviar",
            "title_receive": "Recibir",
            "label_choose_file": "Elegir un archivo...",
            "no_file_selected": "Ningún archivo seleccionado",
            "placeholder_text": "... o pega directamente aquí el texto que quieres enviar.",
            "sending_progress": "Enviando...",
            "label_speed": "Velocidad:",
            "label_density": "Densidad:",
            "density_sound": "Sonido (Acústico)",
            "receiver_mode_visual": "Modo Visual: Escaneando códigos QR...",
            "receiver_mode_acoustic": "Modo Acústico: Escuchando Audio...",
            "sound_sending": "Transmitiendo fragmentos de audio...",
            "sound_warning": "⚠️ Asegúrate de que el 'Modo Silencio' esté APAGADO y el Volumen ALTO",
            "label_audio_speed": "Velocidad de Audio:",
            "speed_normal": "Normal",
            "speed_fast": "Rápido",
            "speed_fastest": "Muy Rápido",
            "speed_ultrasonic": "Ultrasónico",
            "init_camera": "Inicializando cámara...",
            "receiver_idle": "Selecciona un modo para comenzar a recibir...",
            "about_mit": "Este software se proporciona \"TAL CUAL\" bajo la Licencia MIT.",
            "about_credits": "Créditos de Código Abierto:",
            "about_privacy_title": "Política de Privacidad:",
            "about_privacy_text": "Esta aplicación funciona completamente sin conexión. Los archivos se procesan localmente en su dispositivo y nunca se suben a ningún servidor. La aplicación está alojada en GitHub Pages, que puede registrar registros básicos (como direcciones IP) de acuerdo con su política de privacidad. No utilizamos cookies de seguimiento ni análisis de terceros.",
            
            // Dynamic text from app.js
            "err_compression": "❌ Error de compresión: ",
            "err_ur_encoding": "❌ Error de codificación UR: ",
            "err_qrcode": "❌ Error de QRCode: ",
            "sending_total": "Enviando... (Fragmentos totales: ",
            "sending_fraction": "Enviando... (",
            "frame_qr": " QR)",
            "frame_audio": " Audio)",
            "frame_camera": "Enfoca el código QR...",
            "err_camera": "❌ Cámara: ",
            "err_mic": "❌ Micrófono: ",
            "err_decode_fail": "❌ Fallo en decodificación, reiniciando...",
            "success_100": "¡100% completado! Procesando...",
            "success_decomp": "✅ ¡Completado! Descomprimiendo...",
            "success_saving": "✅ Guardando...",
            "success_file_received": "¡Archivo recibido con éxito!",
            "err_generic": "❌ Error: ",
            "success_clipboard": "¡Texto copiado al portapapeles!",
            "status_pct_complete": "% completado",
            "camera_permissions": " — Comprueba los permisos.",
            "mic_permissions": " — Comprueba los permisos."
        }
    };

    let currentLang = 'en';

    function init() {
        const saved = localStorage.getItem('airbridge_lang');
        if (saved && translations[saved]) {
            currentLang = saved;
        } else {
            const browserLang = navigator.language.slice(0, 2);
            if (translations[browserLang]) {
                currentLang = browserLang;
            }
        }
        document.documentElement.lang = currentLang;
        applyToDOM();
    }

    function setLanguage(lang) {
        if (translations[lang]) {
            currentLang = lang;
            localStorage.setItem('airbridge_lang', lang);
            document.documentElement.lang = lang;
            applyToDOM();
            
            // Trigger an event so app.js can update dynamic text if needed
            window.dispatchEvent(new Event('languagechanged'));
        }
    }

    function getLanguage() {
        return currentLang;
    }

    function t(key) {
        return translations[currentLang][key] || translations['en'][key] || key;
    }

    function applyToDOM(root = document) {
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = t(key);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.hasAttribute('placeholder')) el.placeholder = text;
                else el.value = text;
            } else {
                el.innerHTML = text;
            }
        });
        
        const langSwitcher = document.getElementById('langSwitcher');
        if (langSwitcher && langSwitcher.value !== currentLang) {
            langSwitcher.value = currentLang;
        }
    }

    return { init, setLanguage, getLanguage, t, applyToDOM };
})();
