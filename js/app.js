// ==========================================
// COSTANTI E CONFIGURAZIONE
// ==========================================
const APP_VERSION = 'v4.0.0';
let CHUNK_SIZE = 450; // Byte per chunk BC-UR
let DEFAULT_FPS = 15;

// ==========================================
// STATO E INIZIALIZZAZIONE GGWAVE (AUDIO)
// ==========================================
let ggwave = null;
let ggwaveInstance = null;
let audioCtx = null;
let ggwaveParams = null;

if (typeof ggwave_factory !== 'undefined') {
    ggwave_factory().then(obj => {
        ggwave = obj;
        console.log('[GGWAVE] WebAssembly caricato con successo!');
    }).catch(err => {
        console.error('[GGWAVE] Impossibile caricare il modulo WASM ggwave:', err);
    });
}

let iosSilentModeBypassAudio = null;

function bypassIOSSilentMode() {
    if (iosSilentModeBypassAudio) return; // already created
    
    // Create a tiny silent audio element to force iOS into media playback mode,
    // which bypasses the physical silent switch for the Web Audio API.
    iosSilentModeBypassAudio = new Audio();
    iosSilentModeBypassAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    iosSilentModeBypassAudio.loop = true;
    iosSilentModeBypassAudio.volume = 0; // Just in case, keep it silent
    iosSilentModeBypassAudio.setAttribute('playsinline', '');
    iosSilentModeBypassAudio.play().catch(e => console.warn('[AUDIO] Bypassing silent switch failed:', e));
}

function initAudio() {
    if (!audioCtx) {
        // Use webkitAudioContext for older iOS Safari
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ggwave && !ggwaveInstance) {
        ggwaveParams = ggwave.getDefaultParameters();
        ggwaveParams.sampleRateInp = audioCtx.sampleRate;
        ggwaveParams.sampleRateOut = audioCtx.sampleRate;
        ggwaveInstance = ggwave.init(ggwaveParams);
        console.log('[GGWAVE] Istanza acustica inizializzata con sampleRate:', audioCtx.sampleRate);
    }
    if (audioCtx) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(e => console.warn('[AUDIO] resume() fallito:', e));
        }
        playSilentWarmup();
        bypassIOSSilentMode();
    }
}

function playSilentWarmup() {
    if (!audioCtx) return;
    try {
        // Use a silent oscillator to reliably unlock iOS Web Audio. 
        // 1-sample buffers are sometimes optimized away by Safari.
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0; // completely silent
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(0);
        osc.stop(audioCtx.currentTime + 0.1); // play for 100ms
    } catch (e) {
        console.warn('[AUDIO] Impossibile avviare buffer di warm-up:', e);
    }
}

// iOS/Safari: AudioContext MUST be resumed from a direct user gesture.
// Register a one-time unlock handler on both click and touchstart so any
// tap anywhere on the page will unlock audio for the entire session.
function unlockAudioContext() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        playSilentWarmup();
        bypassIOSSilentMode();
    }
}
document.addEventListener('click', unlockAudioContext, { capture: true });
document.addEventListener('touchstart', unlockAudioContext, { capture: true, passive: true });
document.addEventListener('touchend', unlockAudioContext, { capture: true, passive: true });

function convertTypedArray(src, type) {
    var buffer = new ArrayBuffer(src.byteLength);
    new src.constructor(buffer).set(src);
    return new type(buffer);
}

if (typeof I18N !== 'undefined') I18N.init();

const langSwitcher = document.getElementById('langSwitcher');
if (langSwitcher) {
    langSwitcher.addEventListener('change', (e) => {
        if (typeof I18N !== 'undefined') I18N.setLanguage(e.target.value);
    });
}

const vEls = document.querySelectorAll('.app-version-display');
vEls.forEach(el => el.textContent = APP_VERSION);

// ==========================================
// STATO SENDER
// ==========================================
let urEncoder = null;
let senderAnimFrame = null;
let lastRenderTime = 0;
let qrcodeInstance = null;
let currentChunkIndex = 1;
let currentCompressedData = null;
let activeSenderMode = 'qr'; // 'qr' o 'sound'
let activeSpeedVal = 4; // 1 = Normale, 2 = Veloce, 3 = Velocissima, 4 = Ultrasuoni (default)

// ==========================================
// STATO RECEIVER
// ==========================================
let urDecoder = null;
let videoStream = null;
let isScanning = false;
let lastProgress = 0;
let lastScanTime = 0;
let canvasElement = document.createElement('canvas');
let ctx = canvasElement.getContext('2d', { willReadFrequently: true });
let consecutiveRejections = 0;

// ==========================================
// WEB WORKER ZBAR
// ==========================================
const zbarWorker = new Worker('js/worker.js');
let isProcessingFrame = false;
let lastScannedData = null;

zbarWorker.onmessage = function (e) {
    if (e.data.type === 'init') {
        console.log('[WORKER] ZBar inizializzato:', e.data.success, e.data.error || '');
    } else if (e.data.type === 'result') {
        isProcessingFrame = false; // Libera semaforo
        if (e.data.error) {
            console.error('[WORKER] Errore di scansione:', e.data.error);
        }
        if (e.data.data) {
            handleScannedCode(e.data.data);
        }
    }
};

zbarWorker.onerror = function (e) {
    console.warn('[WORKER] Errore worker (ZBar non disponibile):', e.message);
};

// ==========================================
// ELEMENTI DOM
// ==========================================
const views = {
    home: document.getElementById('view-home'),
    sender: document.getElementById('view-sender'),
    receiver: document.getElementById('view-receiver')
};

const btnGoSender = document.getElementById('btn-go-sender');
const btnGoReceiver = document.getElementById('btn-go-receiver');
const senderBack = document.getElementById('sender-back');
const receiverBack = document.getElementById('receiver-back');

const btnAbout = document.getElementById('btn-about');
const aboutModal = document.getElementById('about-modal');
const closeAbout = document.getElementById('close-about');

const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const qrWrapper = document.getElementById('qr-canvas-wrapper');
const senderControls = document.getElementById('sender-controls');
const audioSenderControls = document.getElementById('audio-sender-controls');
const audioSpeedSlider = document.getElementById('audio-speed-slider');
const audioSpeedValue = document.getElementById('audio-speed-value');
const chunkInfo = document.getElementById('chunk-info');
const fpsSlider = document.getElementById('fps-slider');
const fpsValue = document.getElementById('fps-value');
const densitySlider = document.getElementById('density-slider');
const densityValue = document.getElementById('density-value');

const videoPreview = document.getElementById('video-preview');
const scanOverlay = document.getElementById('scan-overlay');

const progressBar = document.getElementById('progress-bar');
const receiveStatus = document.getElementById('receive-status');
const receiveStats = document.getElementById('receive-stats');

// ==========================================
// WAKE LOCK
// ==========================================
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); }
        catch (e) { console.warn('[WAKE] Lock non supportato:', e.message); }
    }
}

function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().then(() => { wakeLock = null; }); }
}

// ==========================================
// NAVIGAZIONE
// ==========================================
function showView(name) {
    Object.values(views).forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    views[name].classList.remove('hidden');
    views[name].classList.add('active');
}

btnGoSender.addEventListener('click', () => {
    initAudio();
    showView('sender');
    requestWakeLock();
});

btnGoReceiver.addEventListener('click', () => {
    initAudio();
    showView('receiver');
    requestWakeLock();
    startReceiver('off');
});

senderBack.addEventListener('click', () => {
    stopSender();
    releaseWakeLock();
    showView('home');
});

receiverBack.addEventListener('click', () => {
    stopReceiver();
    releaseWakeLock();
    showView('home');
});

// Modal About
if (btnAbout) {
    btnAbout.addEventListener('click', () => {
        aboutModal.classList.remove('hidden');
    });
}

if (closeAbout) {
    closeAbout.addEventListener('click', () => {
        aboutModal.classList.add('hidden');
    });
}

window.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
        aboutModal.classList.add('hidden');
    }
});

// ==========================================
// SENDER — SELEZIONE FILE E TESTO
// ==========================================
fileInput.addEventListener('change', handleFileSelect);
fileInput.addEventListener('click', () => {
    initAudio();
});
const labelChooseFile = document.querySelector('label[for="file-input"]');
if (labelChooseFile) {
    labelChooseFile.addEventListener('click', () => {
        initAudio();
    });
}

function attachTextInputEvent() {
    const ti = document.getElementById('text-input');
    if (ti) {
        ti.addEventListener('focus', () => {
            initAudio();
        });
        ti.addEventListener('click', () => {
            initAudio();
        });
        ti.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val.length > 0) {
                const ok = prepareSenderChunks(val, 'testo_incollato.txt', true);
                if (ok) {
                    const fw = document.getElementById('file-input-wrapper');
                    if (fw) fw.classList.add('hidden');
                    fileInfo.classList.add('hidden');
                    updateSenderControlsVisibility();
                }
            }
        });
    }
}
attachTextInputEvent();

fpsSlider.addEventListener('input', (e) => {
    DEFAULT_FPS = parseInt(e.target.value);
    fpsValue.textContent = DEFAULT_FPS;
    // Only restart QR loop; never touch audio mode
    if (urEncoder && activeSenderMode === 'qr') startSenderLoop();
});

function updateDensityDisplay(val) {
    densityValue.textContent = val;
}

densitySlider.addEventListener('input', (e) => {
    CHUNK_SIZE = parseInt(e.target.value);
    updateDensityDisplay(CHUNK_SIZE);
});

densitySlider.addEventListener('change', (e) => {
    CHUNK_SIZE = parseInt(e.target.value);
    // Only rebuild QR encoder when actually in QR mode; ignore if in sound mode
    if (activeSenderMode === 'qr' && currentCompressedData) {
        rebuildUrEncoder();
        startSenderLoop();
    }
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    fileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;

    const reader = new FileReader();
    reader.onload = (e) => {
        const ok = prepareSenderChunks(e.target.result, file.name, false);
        if (ok) {
            const fw = document.getElementById('file-input-wrapper');
            if (fw) fw.classList.add('hidden');
            fileInfo.classList.add('hidden');
            updateSenderControlsVisibility();
        }
    };
    reader.readAsDataURL(file);
}

// ==========================================
// SENDER — ENCODING BC-UR
// ==========================================
function prepareSenderChunks(data, fileName, isText = false) {
    const prefix = isText ? 'TEXT:' : 'FILE:';
    const payloadString = `${prefix}${fileName}|${data}`;

    // Step 1: Comprimi con Pako (GZIP)
    let compressedData;
    try {
        compressedData = pako.deflate(payloadString, { level: 9 });
        currentCompressedData = compressedData;
    } catch (e) {
        console.error('[SENDER] pako error:', e);
        fileInfo.textContent = I18N.t('err_compression') + e.message;
        return false;
    }

    // Step 2: Encoding BC-UR con Bytes.toUREncoder()
    try {
        const BcUrBuffer = window.BcUr.Buffer;
        const Bytes = window.BcUr.Bytes;
        const buf = BcUrBuffer.from(Array.from(compressedData));
        const bytesObj = new Bytes(buf);
        const sizeToUse = (activeSenderMode === 'sound') ? 30 : CHUNK_SIZE;
        urEncoder = bytesObj.toUREncoder(sizeToUse);
        console.log('[SENDER] UREncoder OK, frammenti:', urEncoder.fragmentsLength);
    } catch (e) {
        console.error('[SENDER] BC-UR error:', e);
        fileInfo.textContent = I18N.t('err_ur_encoding') + e.message;
        return false;
    }

    // Step 3: Inizializza QRCode
    try {
        qrWrapper.innerHTML = '';
        const size = Math.min(window.innerWidth - 20, 480);

        qrcodeInstance = new QRCode(qrWrapper, {
            text: 'init',
            width: size,
            height: size,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.L
        });

        const qrCanvas = qrWrapper.querySelector('canvas') || qrWrapper.querySelector('img');
        if (qrCanvas) qrCanvas.style.imageRendering = 'pixelated';

    } catch (e) {
        console.error('[SENDER] QRCode error:', e);
        fileInfo.textContent = I18N.t('err_qrcode') + e.message;
        return false;
    }

    currentChunkIndex = 1;
    if (activeSenderMode === 'sound') {
        stopSenderLoop();
        stopSoundTransmission();
        startSoundTransmission();
    } else {
        stopSoundTransmission();
        startSenderLoop();
    }
    return true;
}

function rebuildUrEncoder() {
    try {
        const BcUrBuffer = window.BcUr.Buffer;
        const Bytes = window.BcUr.Bytes;
        const buf = BcUrBuffer.from(Array.from(currentCompressedData));
        const bytesObj = new Bytes(buf);
        urEncoder = bytesObj.toUREncoder(CHUNK_SIZE);
        currentChunkIndex = 1;
        chunkInfo.textContent = I18N.t('sending_total') + urEncoder.fragmentsLength + ')';
        console.log('[SENDER] UREncoder ricalcolato, frammenti:', urEncoder.fragmentsLength);
    } catch (e) {
        console.error('[SENDER] Errore ricalcolo UR:', e);
    }
}

function rebuildUrEncoderForAudio() {
    try {
        const BcUrBuffer = window.BcUr.Buffer;
        const Bytes = window.BcUr.Bytes;
        const buf = BcUrBuffer.from(Array.from(currentCompressedData));
        const bytesObj = new Bytes(buf);
        urEncoder = bytesObj.toUREncoder(30); // 30 byte per l'audio è ottimale
        currentChunkIndex = 1;
        chunkInfo.textContent = I18N.t('sound_sending') + ' (1/' + urEncoder.fragmentsLength + ')';
        console.log('[SENDER] UREncoder ricalcolato per Audio (30 bytes), frammenti:', urEncoder.fragmentsLength);
    } catch (e) {
        console.error('[SENDER] Errore ricalcolo UR per Audio:', e);
    }
}

// ==========================================
// SENDER — RIPRODUZIONE AUDIO GGWAVE
// ==========================================
let activeAudioSource = null;
let soundTxTimeout = null;
let isSoundTransmitting = false;
let txGeneration = 0; // Incremented on every stop to invalidate stale chirp closures

function startSoundTransmission() {
    if (!urEncoder) return;

    // Stop any existing transmission cleanly first
    stopSoundTransmission();

    isSoundTransmitting = true;
    const myGeneration = ++txGeneration; // Capture this generation; stale closures will have an older value
    
    // Gestione visiva mirino/canvas
    const qrWrapper = document.getElementById('qr-canvas-wrapper');
    const soundVis = document.getElementById('sound-visualizer');
    if (qrWrapper) qrWrapper.classList.add('hidden');
    if (soundVis) soundVis.classList.remove('hidden');

    // Ensure AudioContext and ggwaveInstance are ready
    initAudio();
    
    const playNextChirp = () => {
        // Bail out if this closure belongs to a superseded transmission generation
        if (!isSoundTransmitting || txGeneration !== myGeneration || !urEncoder) return;
        
        if (!ggwave || !ggwaveInstance) {
            console.warn('[GGWAVE] WASM non ancora pronto, riprovando tra 300ms...');
            soundTxTimeout = setTimeout(playNextChirp, 300);
            return;
        }
        
        try {
            const payload = urEncoder.nextPart();
            // displayIndex cycles 1..N for the current encoder window
            let displayIndex = ((currentChunkIndex - 1) % urEncoder.fragmentsLength) + 1;
            // chirpCount is the absolute transmission count (always advances, never wraps)
            const chirpCount = currentChunkIndex;
            const infoText = I18N.t('sound_sending') + ' (' + displayIndex + '/' + urEncoder.fragmentsLength + ') #' + chirpCount;
            
            chunkInfo.textContent = infoText;
            const soundStatusText = document.getElementById('sound-status-text');
            if (soundStatusText) {
                soundStatusText.textContent = infoText;
            }
            currentChunkIndex++;
            
            // Genera traccia audio tramite ggwave WASM
            let protocol = ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
            if (activeSpeedVal === 1) {
                protocol = ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_NORMAL;
            } else if (activeSpeedVal === 3) {
                protocol = ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST;
            } else if (activeSpeedVal === 4) {
                protocol = ggwave.ProtocolId.GGWAVE_PROTOCOL_ULTRASOUND_FASTEST;
            }

            const waveform = ggwave.encode(
                ggwaveInstance, 
                payload.toUpperCase(), 
                protocol, 
                100 // volume aumentato al 100% per massimizzare la ricezione su microfoni a bassa sensibilità
            );
            
            const buf = convertTypedArray(waveform, Float32Array);
            const buffer = audioCtx.createBuffer(1, buf.length, audioCtx.sampleRate);
            buffer.getChannelData(0).set(buf);
            
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            activeAudioSource = source;
            
            source.onended = () => {
                if (activeAudioSource === source) activeAudioSource = null;
                // Only schedule next if this generation is still current
                if (isSoundTransmitting && txGeneration === myGeneration) {
                    soundTxTimeout = setTimeout(playNextChirp, 300);
                }
            };
            
            source.start(0);
        } catch (e) {
            console.error('[GGWAVE] Errore di codifica/riproduzione audio:', e);
            if (isSoundTransmitting && txGeneration === myGeneration) {
                soundTxTimeout = setTimeout(playNextChirp, 1000);
            }
        }
    };
    
    playNextChirp();
}

function stopSoundTransmission() {
    isSoundTransmitting = false;
    txGeneration++; // Invalidate all pending chirp closures immediately
    if (soundTxTimeout) {
        clearTimeout(soundTxTimeout);
        soundTxTimeout = null;
    }
    if (activeAudioSource) {
        const src = activeAudioSource;
        activeAudioSource = null; // Nullify before stop so onended guard works
        try { src.stop(); } catch(e) {}
    }
    
    const qrWrapper = document.getElementById('qr-canvas-wrapper');
    const soundVis = document.getElementById('sound-visualizer');
    if (qrWrapper) qrWrapper.classList.remove('hidden');
    if (soundVis) soundVis.classList.add('hidden');
}

function stopSenderLoop() {
    if (senderAnimFrame) cancelAnimationFrame(senderAnimFrame);
    senderAnimFrame = null;
}

// ==========================================
// SENDER — LOOP ANIMAZIONE V-SYNC
// ==========================================
function startSenderLoop() {
    if (senderAnimFrame) cancelAnimationFrame(senderAnimFrame);
    if (!urEncoder) return;
    lastRenderTime = 0; // Reset sempre all'avvio

    const renderChunk = (timestamp) => {
        // Safety guard: stop the loop if we've switched out of QR mode
        if (activeSenderMode !== 'qr') {
            senderAnimFrame = null;
            return;
        }

        if (!lastRenderTime) lastRenderTime = timestamp;
        const elapsed = timestamp - lastRenderTime;

        if (elapsed >= (1000 / DEFAULT_FPS)) {
            try {
                const payload = urEncoder.nextPart();
                
                qrcodeInstance.clear();
                qrcodeInstance.makeCode(payload.toUpperCase());

                const c = qrWrapper.querySelector('canvas') || qrWrapper.querySelector('img');
                if (c) c.style.imageRendering = 'pixelated';

                let displayIndex = ((currentChunkIndex - 1) % urEncoder.fragmentsLength) + 1;
                chunkInfo.textContent = I18N.t('sending_fraction') + displayIndex + '/' + urEncoder.fragmentsLength + ')';
                
                currentChunkIndex++;
                
                // Se inviamo troppi frammenti misti (1.5x), il decoder potrebbe bloccarsi.
                // Resettiamo l'encoder per rimandare i frame puri (più veloci e sicuri da decodificare).
                if (currentChunkIndex > Math.ceil(urEncoder.fragmentsLength * 1.5)) {
                    rebuildUrEncoder();
                }
            } catch (e) {
                console.error('[SENDER] render error:', e);
            }
            lastRenderTime = timestamp;
        }

        senderAnimFrame = requestAnimationFrame(renderChunk);
    };

    senderAnimFrame = requestAnimationFrame(renderChunk);
}

function stopSender() {
    stopSoundTransmission();
    if (senderAnimFrame) cancelAnimationFrame(senderAnimFrame);
    senderAnimFrame = null;
    urEncoder = null;
    lastRenderTime = 0;
    currentCompressedData = null;
    qrWrapper.innerHTML = '<textarea id="text-input" class="text-input" placeholder="' + I18N.t('placeholder_text') + '" data-i18n="placeholder_text"></textarea>';
    attachTextInputEvent();
    updateSenderControlsVisibility();
    fileInfo.textContent = I18N.t('no_file_selected');
    fileInput.value = '';

    const fw = document.getElementById('file-input-wrapper');
    if (fw) fw.classList.remove('hidden');
    fileInfo.classList.remove('hidden');
}

// ==========================================
// RECEIVER — AVVIO FOTOCAMERA
// ==========================================
// ==========================================
// RECEIVER — AVVIO E GESTIONE MODALITÀ (FOTOCAMERA E AUDIO)
// ==========================================
let activeReceiverMode = 'off'; // 'off', 'visual', 'acoustic'

async function startReceiver(mode = 'off') {
    // Prima arresta e rilascia le risorse attive
    stopReceiver();
    
    activeReceiverMode = mode;
    updateReceiverPillUI();

    if (activeReceiverMode === 'off') {
        receiveStatus.textContent = I18N.t('receiver_idle');
        receiveStatus.style.color = '';
        progressBar.style.width = '0%';
        receiveStats.textContent = '0%';
        return;
    }

    lastScannedData = null;
    isScanning = true;
    lastProgress = 0;
    receiveStats.textContent = '';

    // Inizializza decoder BC-UR
    try {
        urDecoder = new window.BcUr.URRegistryDecoder();
    } catch (e) {
        console.error('[RECEIVER] URRegistryDecoder error:', e);
        urDecoder = null;
    }

    updateProgressUI();
    receiveStatus.style.color = '';

    if (activeReceiverMode === 'visual') {
        receiveStatus.textContent = I18N.t('init_camera');
        
        // Ottieni stream camera con fallback multipli (iOS compatibility)
        try {
            videoStream = await tryGetCamera();

            videoPreview.srcObject = videoStream;
            videoPreview.setAttribute('playsinline', true);
            videoPreview.setAttribute('webkit-playsinline', true);

            try { await videoPreview.play(); }
            catch (e) { console.warn('[CAM] play() warning:', e.message); }

            // Tenta di bloccare l'esposizione
            tryLockExposure(videoStream);

            requestAnimationFrame(scanLoop);
            receiveStatus.textContent = I18N.t('receiver_mode_visual');

        } catch (err) {
            console.error('[RECEIVER] Camera error:', err);
            receiveStatus.textContent = I18N.t('err_camera') + (err.name || err.message || err) + I18N.t('camera_permissions');
            receiveStatus.style.color = '#ffaa00';
            isScanning = false;
        }
    } else if (activeReceiverMode === 'acoustic') {
        receiveStatus.textContent = I18N.t('receiver_mode_acoustic');
        
        // Mostra visualizzatore acustico statico
        const viewfinder = document.querySelector('.viewfinder-container');
        if (viewfinder) {
            const vis = document.createElement('div');
            vis.className = 'receiver-acoustic-visualizer';
            vis.innerHTML = `
                <div class="pulse-orb" id="receiver-pulse-orb"></div>
                <svg class="static-audio-wave" viewBox="0 0 100 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="10" y1="20" x2="10" y2="20" />
                    <line x1="18" y1="15" x2="18" y2="25" />
                    <line x1="26" y1="10" x2="26" y2="30" />
                    <line x1="34" y1="5" x2="34" y2="35" />
                    <line x1="42" y1="12" x2="42" y2="28" />
                    <line x1="50" y1="2" x2="50" y2="38" />
                    <line x1="58" y1="8" x2="58" y2="32" />
                    <line x1="66" y1="15" x2="66" y2="25" />
                    <line x1="74" y1="5" x2="74" y2="35" />
                    <line x1="82" y1="12" x2="82" y2="28" />
                    <line x1="90" y1="20" x2="90" y2="20" />
                </svg>
                <p class="sound-status-text" data-i18n="receiver_mode_acoustic">Acoustic Mode: Listening to Audio...</p>
            `;
            viewfinder.appendChild(vis);
        }

        // Avvia l'ascolto microfono
        startAudioListening();
    }
}

// Fallback a 3 livelli per massima compatibilità (iOS, Android, Desktop)
async function tryGetCamera() {
    try {
        return await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                frameRate: { ideal: 15, max: 20 }
            }
        });
    } catch (e1) {
        console.warn('[CAM] Tentativo 1 fallito:', e1.message);
    }

    try {
        return await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
        });
    } catch (e2) {
        console.warn('[CAM] Tentativo 2 fallito:', e2.message);
    }

    return await navigator.mediaDevices.getUserMedia({ video: true });
}

// Blocca auto-esposizione
async function tryLockExposure(stream) {
    try {
        const track = stream.getVideoTracks()[0];
        if (!track || !track.getCapabilities) return;
        const caps = track.getCapabilities();
        if (caps.exposureMode && caps.exposureMode.includes('manual')) {
            await track.applyConstraints({ advanced: [{ exposureMode: 'manual' }] });
            console.log('[CAM] Esposizione manuale bloccata');
        }
    } catch (e) {
        console.warn('[CAM] Exposure lock non supportato:', e.message);
    }
}

function stopReceiver() {
    isScanning = false;
    stopAudioListening();
    
    if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
        videoStream = null;
    }
    videoPreview.pause();
    videoPreview.srcObject = null;
    isProcessingFrame = false;

    // Ripulisci visualizzatore acustico se presente
    const viewfinder = document.querySelector('.viewfinder-container');
    if (viewfinder) {
        const vis = viewfinder.querySelector('.receiver-acoustic-visualizer');
        if (vis) vis.remove();
    }
}

// ==========================================
// RECEIVER — ASCOLTO AUDIO GGWAVE
// ==========================================
let microphoneStream = null;
let audioRecorderNode = null;
let isAudioListening = false;

function startAudioListening(retryCount = 0) {
    isAudioListening = true;
    initAudio();

    if (!ggwave || !ggwaveInstance) {
        // WASM may still be loading async — retry up to 20 times (2 seconds total)
        if (retryCount < 20) {
            console.warn('[GGWAVE] WASM non ancora pronto per il microfono, riprovando... (' + (retryCount + 1) + '/20)');
            setTimeout(() => {
                if (isAudioListening) startAudioListening(retryCount + 1);
            }, 100);
        } else {
            console.error('[GGWAVE] WASM non caricato dopo 2 secondi, impossibile avviare la ricezione audio.');
        }
        return;
    }
    
    let constraints = {
        audio: {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false
        }
    };
    
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        microphoneStream = stream;
        if (!isAudioListening) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        
        const mediaStreamSource = audioCtx.createMediaStreamSource(stream);
        
        var bufferSize = 1024;
        var numberOfInputChannels = 1;
        var numberOfOutputChannels = 1;
        
        if (audioCtx.createScriptProcessor) {
            audioRecorderNode = audioCtx.createScriptProcessor(
                bufferSize,
                numberOfInputChannels,
                numberOfOutputChannels
            );
        } else {
            audioRecorderNode = audioCtx.createJavaScriptNode(
                bufferSize,
                numberOfInputChannels,
                numberOfOutputChannels
            );
        }
        
        audioRecorderNode.onaudioprocess = function (e) {
            if (!isAudioListening || !ggwaveInstance) return;

            var source = e.inputBuffer;
            var samples = new Float32Array(source.getChannelData(0));

            // --- Feed samples to ggwave decoder ---
            var res = ggwave.decode(
                ggwaveInstance,
                convertTypedArray(samples, Int8Array)
            );

            // iOS Safari: write silence to output buffer so AudioContext stays alive
            try {
                var outBuf = e.outputBuffer.getChannelData(0);
                if (outBuf) for (var i = 0; i < outBuf.length; i++) outBuf[i] = 0;
            } catch (outErr) { /* safe to ignore */ }

            if (res && res.length > 0) {
                res = new TextDecoder('utf-8').decode(res).replace(/\0/g, '').trim();
                console.log('[GGWAVE] Ricevuto pacchetto audio:', res);
                if (activeReceiverMode === 'acoustic') {
                    var orb = document.getElementById('receiver-pulse-orb');
                    if (orb) {
                        orb.classList.add('listening');
                        clearTimeout(orb._silenceTimer);
                        orb._silenceTimer = setTimeout(function() {
                            orb.classList.remove('listening');
                        }, 800);
                    }
                    handleScannedCode(res);
                }
            }
        };
        
        mediaStreamSource.connect(audioRecorderNode);
        audioRecorderNode.connect(audioCtx.destination);
        console.log('[GGWAVE] Decodifica da microfono attiva!');
    }).catch(function (err) {
        console.warn('[GGWAVE] Accesso al microfono negato o non supportato:', err.message);
        const acousticStatusText = document.querySelector('.receiver-acoustic-visualizer .sound-status-text');
        if (acousticStatusText) {
            acousticStatusText.textContent = I18N.t('err_mic') + (err.name || err.message || err) + I18N.t('mic_permissions');
            acousticStatusText.style.color = '#ffaa00';
        }
    });
}



function stopAudioListening() {
    isAudioListening = false;
    if (audioRecorderNode) {
        try { audioRecorderNode.disconnect(); } catch(e) {}
        audioRecorderNode = null;
    }
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(t => t.stop());
        microphoneStream = null;
    }
    // Reset orb to grey idle state
    const orb = document.getElementById('receiver-pulse-orb');
    if (orb) {
        orb.classList.remove('listening', 'pulse-active');
        clearTimeout(orb._silenceTimer);
        clearTimeout(orb.pulseTimeout);
    }
}

// ==========================================
// SCAN LOOP CON ROI + SEMAFORO
// ==========================================
function scanLoop(timestamp) {
    if (!isScanning || activeReceiverMode !== 'visual') return;

    if (videoPreview.readyState === videoPreview.HAVE_ENOUGH_DATA && !isProcessingFrame) {
        // Limita il processamento a 30 FPS (~33ms) per risparmio energetico e sincronia col sender
        if (timestamp - lastScanTime >= 33) {
            lastScanTime = timestamp;
            
            // ROI Cropping: quadrato centrale max 400x400 (risparmio CPU 75%+)
            const vw = videoPreview.videoWidth;
            const vh = videoPreview.videoHeight;
            const cropSize = Math.min(vw, vh, 400);
            const sx = (vw - cropSize) / 2;
            const sy = (vh - cropSize) / 2;

            // Evita riallocazioni continue del canvas
            if (canvasElement.width !== cropSize) {
                canvasElement.width = cropSize;
                canvasElement.height = cropSize;
                ctx.imageSmoothingEnabled = false;
            }
            
            ctx.drawImage(videoPreview, sx, sy, cropSize, cropSize, 0, 0, cropSize, cropSize);

            const imageData = ctx.getImageData(0, 0, cropSize, cropSize);

            // Semaforo: invia al worker solo se il precedente ha terminato
            // Passiamo il buffer RGBA raw direttamente al worker per spostare il calcolo pesante fuori dal Main Thread
            isProcessingFrame = true;
            zbarWorker.postMessage({
                type: 'decode',
                rgbaBuffer: imageData.data.buffer,
                width: cropSize,
                height: cropSize
            }, [imageData.data.buffer]);
        }
    }

    requestAnimationFrame(scanLoop);
}

// ==========================================
// GESTIONE QR SCANSIONATO
// ==========================================
function handleScannedCode(dataStr) {
    dataStr = dataStr.replace(/\0/g, '').trim();
    const isUR = dataStr.startsWith('UR:') || dataStr.startsWith('ur:');

    // Aggiorna il feedback acustico se stiamo ricevendo un pacchetto valido
    if (activeReceiverMode === 'acoustic' && isUR) {
        const orb = document.getElementById('receiver-pulse-orb');
        if (orb) {
            orb.classList.add('pulse-active');
            clearTimeout(orb.pulseTimeout);
            orb.pulseTimeout = setTimeout(() => {
                orb.classList.remove('pulse-active');
            }, 400);
        }
    }

    // Filtro duplicati: scarta subito i frame identici (risparmio CPU)
    if (dataStr === lastScannedData) return;
    lastScannedData = dataStr;

    // Accetta solo payload UR standard
    if (!isUR) return;

    if (!urDecoder) {
        // Reinizializza se perso
        try { urDecoder = new window.BcUr.URRegistryDecoder(); }
        catch (e) { return; }
    }

    let accepted = false;
    try {
        accepted = urDecoder.receivePart(dataStr);
    } catch (e) {
        // Fallirà per frammenti di un'altra sequenza (es. cambio densità)
        accepted = false;
    }

    // Heuristic: se rifiuta >5 frammenti univoci di fila, il sender ha probabilmente cambiato densità o file
    if (!accepted) {
        consecutiveRejections++;
        if (consecutiveRejections > 5) {
            console.warn('[RECEIVER] 5 frame rifiutati consecutivi, auto-reset decoder (possibile cambio densità).');
            try {
                urDecoder = new window.BcUr.URRegistryDecoder();
                accepted = urDecoder.receivePart(dataStr);
            } catch (e2) {}
            consecutiveRejections = 0;
        }
    } else {
        consecutiveRejections = 0;
    }

    triggerScanFeedback(accepted);
    updateProgressUI();

    if (urDecoder && urDecoder.isComplete()) {
        if (urDecoder.isSuccess()) {
            isScanning = false;
            // Forza 100% UI prima di concludere
            progressBar.style.width = '100%';
            receiveStats.textContent = I18N.t('success_100');
            
            // Ritardo per permettere all'utente di vedere il completamento
            setTimeout(() => {
                finishReceiving();
            }, 600);
        } else {
            receiveStatus.textContent = I18N.t('err_decode_fail');
            urDecoder = new window.BcUr.URRegistryDecoder();
            lastScannedData = null;
        }
    }
}

// ==========================================
// UI FEEDBACK
// ==========================================
function triggerScanFeedback(isSuccess) {
    if (!scanOverlay) return;

    // Rimuovi classi per forzare reflow e rimetterle
    scanOverlay.classList.remove('scan-pulse-green', 'scan-pulse-gray');
    void scanOverlay.offsetWidth;

    if (isSuccess) {
        scanOverlay.classList.add('scan-pulse-green');
    } else {
        scanOverlay.classList.add('scan-pulse-gray');
    }

    // Rimuovi le classi dopo 300ms per permettere un lampeggio netto al prossimo
    clearTimeout(scanOverlay.pulseTimeout);
    scanOverlay.pulseTimeout = setTimeout(() => {
        scanOverlay.classList.remove('scan-pulse-green', 'scan-pulse-gray');
    }, 300);
}

function updateProgressUI() {
    if (!urDecoder) {
        progressBar.style.width = '0%';
        receiveStats.textContent = '';
        return;
    }

    let current = 0;
    let total = 0;
    let progress = 0;

    try {
        if (urDecoder.expectedPartCount && urDecoder.expectedPartCount() > 0) {
            total = urDecoder.expectedPartCount();
            
            const fd = urDecoder.fountainDecoder;
            if (fd) {
                const receivedPartIndexes = fd.receivedPartIndexes || [];
                current = receivedPartIndexes.length;

                // Calcolo del progresso pesato (Weighted Mixed Frame progression come in SeedSigner)
                const mixedParts = fd.mixedParts || [];
                const mixedIndexScoring = {};

                for (const partObj of mixedParts) {
                    const indexes = partObj.key; // Array di indici
                    if (!indexes || indexes.length === 0) continue;
                    const score = 1.0 / indexes.length;
                    for (const index of indexes) {
                        if (mixedIndexScoring[index] === undefined) {
                            mixedIndexScoring[index] = 0.0;
                        }
                        mixedIndexScoring[index] += score;
                    }
                }

                let mixedScore = 0.0;
                for (const index in mixedIndexScoring) {
                    mixedScore += Math.min(mixedIndexScoring[index], 0.75);
                }

                progress = (current + mixedScore) / total;
                progress = Math.min(0.99, progress); // Limita al 99% finché non è completo al 100%
            } else {
                current = urDecoder.receivedPartIndexes ? urDecoder.receivedPartIndexes().length : 0;
                progress = current / total;
            }
        }
    } catch (e) {
        console.error("Error reading decoder progress:", e);
    }

    if (urDecoder.isComplete && urDecoder.isComplete()) {
        progress = 1.0;
        current = total;
    }

    const pct = Math.min(100, Math.floor(progress * 100));
    progressBar.style.width = pct + '%';

    let partsInfo = '';
    if (total > 0) {
        const suffix = (activeReceiverMode === 'acoustic') ? I18N.t('frame_audio') : I18N.t('frame_qr');
        partsInfo = ` (${current}/${total}${suffix}`;
    }

    let progressText = '';
    if (pct > 0) {
        progressText = pct + I18N.t('status_pct_complete') + partsInfo;
        receiveStats.textContent = progressText;
    }

    // Aggiorna anche il testo nel visualizzatore acustico se presente
    const acousticStatusText = document.querySelector('.receiver-acoustic-visualizer .sound-status-text');
    if (acousticStatusText) {
        if (progressText) {
            acousticStatusText.textContent = progressText;
        } else {
            acousticStatusText.textContent = I18N.t('receiver_mode_acoustic');
        }
    }
}

// ==========================================
// RICEZIONE COMPLETATA
// ==========================================
function finishReceiving() {
    isScanning = false;
    stopAudioListening();
    receiveStatus.textContent = I18N.t('success_decomp');

    try {
        const bytesResult = urDecoder.resultRegistryType();
        const buffer = bytesResult.getData();

        if (!buffer || buffer.length === 0) throw new Error('Buffer vuoto');

        const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const decompressed = pako.inflate(uint8, { to: 'string' });

        receiveStatus.textContent = I18N.t('success_saving');
        
        let isText = false;
        let fileName = `qr_file_${Date.now()}.bin`;
        let fileData = decompressed;

        if (decompressed.startsWith('FILE:') || decompressed.startsWith('TEXT:')) {
            const sepIndex = decompressed.indexOf('|');
            if (sepIndex !== -1) {
                const header = decompressed.substring(0, sepIndex);
                fileName = header.split(':')[1] || fileName;
                fileData = decompressed.substring(sepIndex + 1);
                isText = decompressed.startsWith('TEXT:');
            }
        } else if (decompressed.startsWith('data:')) {
            // Retrocompatibilità
            fileData = decompressed;
            isText = false;
        } else {
            // Retrocompatibilità testo
            fileData = decompressed;
            isText = true;
        }

        if (isText) {
            downloadText(fileData, fileName);
        } else {
            downloadBase64File(fileData, fileName);
        }
        receiveStats.textContent = I18N.t('success_file_received');

    } catch (e) {
        console.error('[RECEIVER] Decompressione error:', e);
        receiveStatus.textContent = I18N.t('err_generic') + e.message;
    }
}

// ==========================================
// DOWNLOAD FILE
// ==========================================
async function downloadText(textData, fileName) {
    if (navigator.canShare) {
        try {
            await navigator.share({
                title: fileName,
                text: textData
            });
            return;
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Share error:', err);
        }
    }
    // Fallback copia
    try {
        await navigator.clipboard.writeText(textData);
        alert(I18N.t('success_clipboard'));
    } catch(e) {
        // Fallback scarica come file
        const blob = new Blob([textData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}

async function downloadBase64File(base64Data, originalFileName) {
    const arr = base64Data.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);

    const blob = new Blob([u8arr], { type: mime });
    
    let ext = mime.split('/')[1] || 'bin';
    if (ext === 'plain') ext = 'txt';
    if (ext === 'jpeg') ext = 'jpg';

    let fileName = originalFileName;
    if (!fileName.includes('.')) {
        fileName = `${originalFileName}.${ext}`;
    }

    const file = new File([blob], fileName, { type: mime });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: fileName
            });
            return;
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Share error:', err);
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// ==========================================
// SELETTORI MODALITÀ (SENDER & RECEIVER PILL TOGGLES)
// ==========================================
const btnSenderQr = document.getElementById('btn-sender-qr');
const btnSenderSound = document.getElementById('btn-sender-sound');
const btnReceiverCamera = document.getElementById('btn-receiver-camera');
const btnReceiverMic = document.getElementById('btn-receiver-mic');

function updateSenderControlsVisibility() {
    if (!currentCompressedData) {
        if (senderControls) senderControls.classList.add('hidden');
        if (audioSenderControls) audioSenderControls.classList.add('hidden');
        return;
    }
    if (activeSenderMode === 'sound') {
        if (senderControls) senderControls.classList.add('hidden');
        if (audioSenderControls) audioSenderControls.classList.remove('hidden');
    } else {
        if (senderControls) senderControls.classList.remove('hidden');
        if (audioSenderControls) audioSenderControls.classList.add('hidden');
    }
}

function updateSenderPillUI() {
    if (!btnSenderQr || !btnSenderSound) return;
    
    btnSenderQr.classList.remove('active', 'cam-active');
    btnSenderSound.classList.remove('active', 'mic-active');
    
    if (activeSenderMode === 'sound') {
        btnSenderSound.classList.add('active', 'mic-active');
    } else {
        btnSenderQr.classList.add('active', 'cam-active');
    }
    updateSenderControlsVisibility();
}

function updateReceiverPillUI() {
    if (!btnReceiverCamera || !btnReceiverMic) return;
    btnReceiverCamera.classList.remove('active', 'cam-active');
    btnReceiverMic.classList.remove('active', 'mic-active');
    
    if (activeReceiverMode === 'visual') {
        btnReceiverCamera.classList.add('active', 'cam-active');
    } else if (activeReceiverMode === 'acoustic') {
        btnReceiverMic.classList.add('active', 'mic-active');
    }
}

if (btnSenderQr && btnSenderSound) {
    btnSenderQr.addEventListener('click', () => {
        if (activeSenderMode !== 'qr') {
            activeSenderMode = 'qr';
            stopSoundTransmission(); // Stops audio + hides visualizer + invalidates generation
            stopSenderLoop();

            if (currentCompressedData) {
                rebuildUrEncoder();
                startSenderLoop();
            }
            updateSenderPillUI();
        }
    });

    btnSenderSound.addEventListener('click', () => {
        if (activeSenderMode !== 'sound') {
            activeSenderMode = 'sound';
            stopSenderLoop(); // Stop QR animation frame first

            // Eagerly init AudioContext here (requires user gesture)
            initAudio();

            if (currentCompressedData) {
                rebuildUrEncoderForAudio();
                startSoundTransmission();
            }
            updateSenderPillUI();
        }
    });
}

if (audioSpeedSlider && audioSpeedValue) {
    const updateAudioSpeedLabel = () => {
        const val = parseInt(audioSpeedSlider.value);
        activeSpeedVal = val;
        let dictKey = 'speed_fast';
        if (val === 1) dictKey = 'speed_normal';
        else if (val === 3) dictKey = 'speed_fastest';
        else if (val === 4) dictKey = 'speed_ultrasonic';
        audioSpeedValue.textContent = I18N.t(dictKey);
        audioSpeedValue.setAttribute('data-i18n', dictKey);
    };

    audioSpeedSlider.addEventListener('input', updateAudioSpeedLabel);
    audioSpeedSlider.addEventListener('change', () => {
        updateAudioSpeedLabel();
        // Hot-restart: speed change takes effect on next chirp cycle
        // stopSoundTransmission then startSoundTransmission handles generation increment
        if (activeSenderMode === 'sound' && currentCompressedData) {
            rebuildUrEncoderForAudio();
            startSoundTransmission(); // internally calls stopSoundTransmission first
        }
    });
    
    // Listen for language changes to update translation in real time
    window.addEventListener('languagechanged', updateAudioSpeedLabel);
}

if (btnReceiverCamera && btnReceiverMic) {
    btnReceiverCamera.addEventListener('click', () => {
        if (activeReceiverMode === 'visual') {
            startReceiver('off');
        } else {
            startReceiver('visual');
        }
    });

    btnReceiverMic.addEventListener('click', () => {
        // initAudio() MUST be called here, inside a user gesture, so iOS Safari
        // allows AudioContext to be created and/or resumed immediately.
        initAudio();
        if (activeReceiverMode === 'acoustic') {
            startReceiver('off');
        } else {
            startReceiver('acoustic');
        }
    });
}