const storage = (() => {
    const DB_NAME = 'soundboardDB';
    const STORE_NAME = 'files';
    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore(STORE_NAME);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                console.error('IndexedDB open error', request.error);
                reject(request.error);
            };
        });
        return dbPromise;
    }

    async function put(key, blob) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(blob, key);
            tx.oncomplete = () => resolve(key);
            tx.onerror = () => {
                console.error('IndexedDB put error', tx.error);
                reject(tx.error);
            };
        });
    }

    async function get(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => {
                console.error('IndexedDB get error', req.error);
                reject(req.error);
            };
        });
    }

    async function remove(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => {
                console.error('IndexedDB remove error', tx.error);
                reject(tx.error);
            };
        });
    }

    async function clear() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => {
                console.error('IndexedDB clear error', req.error);
                reject(req.error);
            };
        });
    }

    return { put, get, remove, clear };
})();

// Global state management
let currentTab = 0;
let tabCounter = 1;
let soundCounter = 0;
let audioElements = new Map();
let tabData = new Map();
let renamingTabId = null;
let masterVolume = 1.0;
let draggedCard = null;
let libraryCounter = 0;
let libraryData = new Map();
let temporaryFiles = new Set();
const LOCAL_STORAGE_KEY = 'soundboardState';

function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Initialize first tab
tabData.set(0, {
    name: 'Main Sounds',
    sounds: new Map()
});

// Load temporary file
function loadTemporaryFile(tabId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp3,.wav';
    input.onchange = function() {
        loadSound(this, tabId, true);
    };
    input.click();
}

// Enhanced sound loading with temporary support
async function loadSound(input, tabId, isTemporary = false) {
    const file = input.files[0];
    if (!file) return;

    const soundId = `sound-${soundCounter++}`;
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio(objectUrl);

    if (isTemporary) {
        temporaryFiles.add(objectUrl);
        
        const soundCard = createSoundCard(soundId, file.name, audio, tabId, true);
        
        const grid = document.getElementById(`grid-${tabId}`);
        const emptySlot = input.parentElement ? input.parentElement.parentElement : grid.querySelector('.empty-slot');
        if (emptySlot) emptySlot.replaceWith(soundCard);
        
        const newEmptySlot = createEmptySlot(tabId);
        grid.appendChild(newEmptySlot);

        const tab = tabData.get(tabId);
        tab.sounds.set(soundId, {
            name: file.name,
            audio: audio,
            isLooping: false,
            element: soundCard,
            volume: 1.0,
            isTemporary: true,
            objectUrl: objectUrl
        });

        audioElements.set(soundId, audio);
        setupAudioEvents(audio, soundId, tabId);
        showToast('Temporary sound added (not saved)');
    } else {
        const fileId = `file-${libraryCounter++}`;
        
        try {
            await storage.put(fileId, file);
            
            const soundCard = createSoundCard(soundId, file.name, audio, tabId, false);
            
            const grid = document.getElementById(`grid-${tabId}`);
            const emptySlot = input.parentElement ? input.parentElement.parentElement : grid.querySelector('.empty-slot');
            if (emptySlot) emptySlot.replaceWith(soundCard);
            
            const newEmptySlot = createEmptySlot(tabId);
            grid.appendChild(newEmptySlot);

            const tab = tabData.get(tabId);
            tab.sounds.set(soundId, {
                name: file.name,
                audio: audio,
                isLooping: false,
                element: soundCard,
                volume: 1.0,
                fileKey: fileId,
                isTemporary: false
            });

            libraryData.set(fileId, { name: file.name });
            audioElements.set(soundId, audio);
            setupAudioEvents(audio, soundId, tabId);
            saveState();
            showToast('Sound saved to library');
        } catch (e) {
            console.error('Failed to load sound file', e);
            showToast('Error loading file');
        }
    }
}

function createSoundCard(soundId, name, audio, tabId, isTemporary = false) {
    const card = document.createElement('div');
    card.className = isTemporary ? 'sound-card temporary' : 'sound-card';
    card.dataset.soundId = soundId;
    card.dataset.tabId = tabId;

    const temporaryIndicator = isTemporary ? 
        `<div class="temp-indicator" title="Temporary file - not saved to storage">⚡ Quick Play</div>` : '';

    card.innerHTML = `
        ${temporaryIndicator}
        <button class="remove-sound" onclick="removeSound('${soundId}', ${tabId})">×</button>
        <button class="rename-sound" onclick="startRenameSound('${soundId}', ${tabId})" title="Rename">✎</button>
        <div class="sound-header">
            <div class="sound-title" title="${name}">${name}</div>
            <div class="sound-status" id="status-${soundId}"></div>
        </div>
        <div class="sound-controls">
            <button class="sound-btn play" id="play-${soundId}" onclick="playSound('${soundId}', ${tabId})">▶ Play</button>
            <button class="sound-btn pause" onclick="pauseSound('${soundId}', ${tabId})">⏸ Pause</button>
            <button class="sound-btn stop" onclick="stopSound('${soundId}', ${tabId})">⏹ Stop</button>
            <button class="sound-btn loop-toggle" onclick="toggleLoop('${soundId}', ${tabId})" id="loop-${soundId}">🔁 Loop</button>
        </div>
        <div class="sound-volume">
            <label>Vol</label>
            <input type="range" class="sound-volume-slider" id="volume-${soundId}"
                   min="0" max="100" value="100"
                   oninput="updateSoundVolume('${soundId}', ${tabId}, this.value)">
            <span class="sound-volume-value" id="volumeValue-${soundId}">100%</span>
        </div>
        <div class="time-controls">
            <button class="time-btn" onclick="skipBack('${soundId}', 5)">-5s</button>
            <button class="time-btn" onclick="skipBack('${soundId}', 15)">-15s</button>
            <button class="time-btn" onclick="skipBack('${soundId}', 20)">-20s</button>
        </div>
        <div class="progress-container">
            <div class="progress-bar" id="progress-${soundId}"></div>
        </div>
    `;
    
    const titleEl = card.querySelector('.sound-title');
    titleEl.ondblclick = () => startRenameSound(soundId, tabId);

    return card;
}

function createEmptySlot(tabId) {
    const emptySlot = document.createElement('div');
    emptySlot.className = 'empty-slot';
    emptySlot.innerHTML = `
        <input type="file" accept=".mp3,.wav" onchange="loadSound(this, ${tabId}, false)">
        <div class="empty-text">
            <strong>Drop or Click</strong>
            Add MP3/WAV file
        </div>
        <div class="file-options">
            <button class="save-btn" onclick="document.querySelector('#grid-${tabId} .empty-slot:last-child input[type=file]').click()">💾 Save to Library</button>
            <button class="temp-btn" onclick="loadTemporaryFile(${tabId})">⚡ Quick Play</button>
        </div>
        <div class="url-options">
            <button class="url-btn" onclick="promptLoadFromUrl(${tabId}, false)">🌐 URL (Save)</button>
            <button class="url-btn temp" onclick="promptLoadFromUrl(${tabId}, true)">🌐 URL (Temp)</button>
        </div>
    `;
    return emptySlot;
}

function promptLoadFromUrl(tabId, isTemporary = false) {
    const url = prompt('Enter MP3/WAV URL');
    if (url) {
        loadSoundFromUrl(url.trim(), tabId, isTemporary);
    }
}

async function loadSoundFromUrl(url, tabId, isTemporary = false) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Request failed with status ${res.status}`);
        }
        const blob = await res.blob();
        if (!blob.type.includes('audio')) {
            showToast('URL must point to an audio file');
            return;
        }
        const name = url.split('/').pop().split('?')[0] || 'audio';
        const soundId = `sound-${soundCounter++}`;
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);

        if (isTemporary) {
            temporaryFiles.add(objectUrl);
            
            const soundCard = createSoundCard(soundId, name, audio, tabId, true);
            const grid = document.getElementById(`grid-${tabId}`);
            const emptySlot = grid.querySelector('.empty-slot');
            if (emptySlot) emptySlot.replaceWith(soundCard);
            grid.appendChild(createEmptySlot(tabId));

            const tab = tabData.get(tabId);
            tab.sounds.set(soundId, {
                name,
                audio,
                isLooping: false,
                element: soundCard,
                volume: 1.0,
                isTemporary: true,
                objectUrl: objectUrl
            });

            audioElements.set(soundId, audio);
            setupAudioEvents(audio, soundId, tabId);
            showToast('Temporary sound added from URL');
        } else {
            const fileId = `file-${libraryCounter++}`;
            await storage.put(fileId, blob);
            
            const soundCard = createSoundCard(soundId, name, audio, tabId, false);
            const grid = document.getElementById(`grid-${tabId}`);
            const emptySlot = grid.querySelector('.empty-slot');
            if (emptySlot) emptySlot.replaceWith(soundCard);
            grid.appendChild(createEmptySlot(tabId));

            const tab = tabData.get(tabId);
            tab.sounds.set(soundId, {
                name,
                audio,
                isLooping: false,
                element: soundCard,
                volume: 1.0,
                fileKey: fileId
            });

            libraryData.set(fileId, { name });
            audioElements.set(soundId, audio);
            setupAudioEvents(audio, soundId, tabId);
            saveState();
            showToast('Sound saved from URL');
        }
    } catch (e) {
        console.error('Failed to load audio from URL', e);
        showToast(`Error loading audio: ${e.message}`);
    }
}

function setupAudioEvents(audio, soundId, tabId) {
    const card = document.querySelector(`[data-sound-id="${soundId}"]`);
    const status = document.getElementById(`status-${soundId}`);
    const progress = document.getElementById(`progress-${soundId}`);
    const playBtn = document.getElementById(`play-${soundId}`);

    updateAudioVolume(soundId);
    
    audio.addEventListener('play', () => {
        card.classList.remove('paused');
        card.classList.add('playing');
        status.classList.remove('paused');
        status.classList.add('playing');
        if (playBtn) playBtn.classList.add('active');
    });
    
    audio.addEventListener('pause', () => {
        card.classList.remove('playing');
        card.classList.add('paused');
        status.classList.remove('playing');
        status.classList.add('paused');
        if (playBtn) playBtn.classList.remove('active');
    });
    
    audio.addEventListener('ended', () => {
        card.classList.remove('playing', 'paused');
        status.classList.remove('playing', 'paused');
        progress.style.width = '0%';
        if (playBtn) playBtn.classList.remove('active');
    });
    
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const progressPercent = (audio.currentTime / audio.duration) * 100;
            progress.style.width = progressPercent + '%';
        }
    });
}

// Audio control functions
function playSound(soundId, tabId) {
    const tab = tabData.get(tabId);
    const sound = tab.sounds.get(soundId);
    if (sound && sound.audio) {
        sound.audio.play().catch(e => console.log('Playback failed:', e));
    }
}

function pauseSound(soundId, tabId) {
    const tab = tabData.get(tabId);
    const sound = tab.sounds.get(soundId);
    if (sound && sound.audio) {
        sound.audio.pause();
    }
}

function stopSound(soundId, tabId) {
    const tab = tabData.get(tabId);
    const sound = tab.sounds.get(soundId);
    if (sound && sound.audio) {
        sound.audio.pause();
        sound.audio.currentTime = 0;
    }
}

function toggleLoop(soundId, tabId) {
    const tab = tabData.get(tabId);
    const sound = tab.sounds.get(soundId);
    const loopBtn = document.getElementById(`loop-${soundId}`);

    if (sound) {
        sound.isLooping = !sound.isLooping;
        sound.audio.loop = sound.isLooping;
        loopBtn.classList.toggle('active', sound.isLooping);
        sound.element.classList.toggle('looping', sound.isLooping);
        saveState();
    }
}

function skipBack(soundId, seconds) {
    const audio = audioElements.get(soundId);
    if (audio) {
        audio.currentTime = Math.max(0, audio.currentTime - seconds);
    }
}

function startRenameSound(soundId, tabId) {
    const tab = tabData.get(tabId);
    const sound = tab.sounds.get(soundId);
    if (!sound) return;

    const card = sound.element;
    const titleEl = card.querySelector('.sound-title');
    if (!titleEl || card.querySelector('.sound-title-input')) return;

    const oldName = sound.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.className = 'sound-title-input';

    const finish = (save) => {
        let name = oldName;
        if (save) {
            const val = input.value.trim();
            if (val) name = val;
        }
        const newTitle = document.createElement('div');
        newTitle.className = 'sound-title';
        newTitle.textContent = name;
        newTitle.title = name;
        newTitle.ondblclick = () => startRenameSound(soundId, tabId);
        input.replaceWith(newTitle);
        sound.name = name;
        saveState();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finish(true);
        } else if (e.key === 'Escape') {
            finish(false);
        }
    });
    input.addEventListener('blur', () => finish(true));

    titleEl.replaceWith(input);
    input.focus();
    input.select();
}

function removeSound(soundId, tabId) {
    const tab = tabData.get(tabId);
    const sound = tab.sounds.get(soundId);

    if (sound) {
        sound.audio.pause();
        sound.audio.src = '';
        
        if (sound.isTemporary && sound.objectUrl) {
            URL.revokeObjectURL(sound.objectUrl);
            temporaryFiles.delete(sound.objectUrl);
        }
        
        const fileKey = sound.fileKey;
        sound.element.remove();
        tab.sounds.delete(soundId);
        audioElements.delete(soundId);

        if (fileKey && !isFileReferencedInTabs(fileKey) && !libraryData.has(fileKey)) {
            storage.remove(fileKey);
        }
    }
    saveState();
}

function isFileReferencedInTabs(fileKey) {
    for (const tab of tabData.values()) {
        for (const sound of tab.sounds.values()) {
            if (sound.fileKey === fileKey) {
                return true;
            }
        }
    }
    return false;
}

function stopAllSounds() {
    audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
}

function updateMasterVolume(value) {
    masterVolume = value / 100;
    document.getElementById('masterVolumeValue').textContent = value + '%';
    
    audioElements.forEach((audio, soundId) => {
        updateAudioVolume(soundId);
    });
    saveState();
}

function updateSoundVolume(soundId, tabId, value) {
    const tab = tabData.get(tabId);
    const sound = tab.sounds.get(soundId);

    if (sound) {
        sound.volume = value / 100;
        document.getElementById(`volumeValue-${soundId}`).textContent = value + '%';
        updateAudioVolume(soundId);
        saveState();
    }
}

function updateAudioVolume(soundId) {
    const audio = audioElements.get(soundId);
    if (audio) {
        let soundVolume = 1.0;
        for (const tab of tabData.values()) {
            if (tab.sounds.has(soundId)) {
                soundVolume = tab.sounds.get(soundId).volume;
                break;
            }
        }
        audio.volume = masterVolume * soundVolume;
    }
}

function saveState() {
    const state = {
        masterVolume,
        tabCounter,
        soundCounter,
        libraryCounter,
        currentTab,
        tabs: [],
        library: []
    };

    tabData.forEach((tab, id) => {
        const tabInfo = { id, name: tab.name, sounds: [] };
        tab.sounds.forEach((sound, sid) => {
            if (!sound.isTemporary) {
                tabInfo.sounds.push({
                    id: sid,
                    name: sound.name,
                    fileKey: sound.fileKey,
                    volume: sound.volume,
                    isLooping: sound.isLooping
                });
            }
        });
        state.tabs.push(tabInfo);
    });

    libraryData.forEach((data, id) => {
        state.library.push({ id, name: data.name });
    });

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

// Cleanup temporary files on page unload
window.addEventListener('beforeunload', () => {
    temporaryFiles.forEach(url => {
        URL.revokeObjectURL(url);
    });
});

// Basic tab/library functions (simplified for this demo)
function addNewTab() { showToast('Feature not implemented in demo'); }
function openLibrary() { showToast('Feature not implemented in demo'); }
function exportBoard() { showToast('Feature not implemented in demo'); }
function triggerImport() { showToast('Feature not implemented in demo'); }
function handleImportFile() { showToast('Feature not implemented in demo'); }
function clearCurrentPanel() { 
    if (confirm('Clear all sounds?')) {
        location.reload();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    showToast('Professional Soundboard loaded! Try both Save and Quick Play options.');
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        stopAllSounds();
    }
});
