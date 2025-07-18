// Global state management
let currentTab = 0;
let tabCounter = 1;
let soundCounter = 0;
let audioElements = new Map();
let tabData = new Map();
let renamingTabId = null;
let masterVolume = 1.0;

// Initialize first tab
tabData.set(0, {
    name: 'Main Sounds',
    sounds: new Map()
});

// Tab management
function addNewTab() {
    renamingTabId = null;
    document.getElementById('modalTitle').textContent = 'Name Your Tab';
    document.querySelector('.btn.primary').textContent = 'Create';
    document.getElementById('tabNameInput').value = '';
    document.getElementById('tabModal').classList.remove('hidden');
    document.getElementById('tabNameInput').focus();
}

function renameTab(tabId) {
    renamingTabId = tabId;
    const tab = tabData.get(tabId);
    document.getElementById('modalTitle').textContent = 'Rename Tab';
    document.querySelector('.btn.primary').textContent = 'Rename';
    document.getElementById('tabNameInput').value = tab.name;
    document.getElementById('tabModal').classList.remove('hidden');
    document.getElementById('tabNameInput').select();
}

function confirmTabAction() {
    const nameInput = document.getElementById('tabNameInput');
    const name = nameInput.value.trim();
    
    if (renamingTabId !== null) {
        // Renaming existing tab
        if (name) {
            const tab = tabData.get(renamingTabId);
            tab.name = name;
            document.querySelector(`[data-tab="${renamingTabId}"] span`).textContent = name;
        }
    } else {
        // Creating new tab
        const tabName = name || `Tab ${tabCounter + 1}`;
        setTimeout(() => {
            createTab(tabName);
        }, 100);
    }
    
    closeTabModal();
}

function cancelTabAction() {
    closeTabModal();
}

function closeTabModal() {
    const modal = document.getElementById('tabModal');
    const nameInput = document.getElementById('tabNameInput');
    modal.classList.add('hidden');
    nameInput.value = '';
    nameInput.blur();
    renamingTabId = null;
}

function createTab(name) {
    const tabContainer = document.querySelector('.tab-container');
    const addTabBtn = document.querySelector('.add-tab');
    
    const newTab = document.createElement('div');
    newTab.className = 'tab';
    newTab.dataset.tab = tabCounter;
    newTab.innerHTML = `
        <span>${name}</span>
        <button class="tab-close" onclick="removeTab(${tabCounter})">×</button>
    `;
    newTab.onclick = () => switchToTab(tabCounter);
    
    // Add double-click to rename
    const tabSpan = newTab.querySelector('span');
    tabSpan.ondblclick = (e) => {
        e.stopPropagation();
        renameTab(tabCounter);
    };
    tabSpan.style.cursor = 'pointer';
    tabSpan.title = 'Double-click to rename';
    
    tabContainer.insertBefore(newTab, addTabBtn);
    
    // Create panel content
    const mainContent = document.querySelector('.main-content');
    const newPanel = document.createElement('div');
    newPanel.className = 'panel-content hidden';
    newPanel.id = `panel-${tabCounter}`;
    newPanel.innerHTML = `
        <div class="sound-grid" id="grid-${tabCounter}">
            <div class="empty-slot">
                <input type="file" accept=".mp3,.wav" onchange="loadSound(this, ${tabCounter})">
                <div class="empty-text">
                    <strong>Drop or Click</strong>
                    Add MP3/WAV file
                </div>
            </div>
        </div>
    `;
    mainContent.appendChild(newPanel);
    
    // Initialize tab data
    tabData.set(tabCounter, {
        name: name,
        sounds: new Map()
    });
    
    switchToTab(tabCounter);
    tabCounter++;
}

function removeTab(tabId) {
    if (tabData.size <= 1) return; // Don't remove last tab
    
    // Stop all sounds in this tab
    const tab = tabData.get(tabId);
    if (tab) {
        tab.sounds.forEach(sound => {
            if (sound.audio) {
                sound.audio.pause();
                sound.audio.src = '';
            }
        });
    }
    
    // Remove tab data and elements
    tabData.delete(tabId);
    document.querySelector(`[data-tab="${tabId}"]`).remove();
    document.getElementById(`panel-${tabId}`).remove();
    
    // Switch to first available tab if current tab was removed
    if (currentTab === tabId) {
        const firstTab = Array.from(tabData.keys())[0];
        switchToTab(firstTab);
    }
}

function switchToTab(tabId) {
    // Update tab appearance
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Update panel visibility
    document.querySelectorAll('.panel-content').forEach(panel => {
        panel.classList.add('hidden');
    });
    document.getElementById(`panel-${tabId}`).classList.remove('hidden');
    
    currentTab = tabId;
}

// Sound management
function loadSound(input, tabId) {
    const file = input.files[0];
    if (!file) return;
    
    const soundId = `sound-${soundCounter++}`;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    
    // Create sound card
    const soundCard = createSoundCard(soundId, file.name, audio, tabId);
    
    // Replace the empty slot
    const grid = document.getElementById(`grid-${tabId}`);
    const emptySlot = input.parentElement;
    grid.insertBefore(soundCard, emptySlot);
    
    // Create new empty slot
    const newEmptySlot = document.createElement('div');
    newEmptySlot.className = 'empty-slot';
    newEmptySlot.innerHTML = `
        <input type="file" accept=".mp3,.wav" onchange="loadSound(this, ${tabId})">
        <div class="empty-text">
            <strong>Drop or Click</strong>
            Add MP3/WAV file
        </div>
    `;
    grid.appendChild(newEmptySlot);
    
    // Store sound data
    const tab = tabData.get(tabId);
    tab.sounds.set(soundId, {
        name: file.name,
        audio: audio,
        isLooping: false,
        element: soundCard,
        volume: 1.0  // Individual volume (0.0 to 1.0)
    });
    
    audioElements.set(soundId, audio);
    
    // Setup audio event listeners
    setupAudioEvents(audio, soundId, tabId);
}

function createSoundCard(soundId, name, audio, tabId) {
    const card = document.createElement('div');
    card.className = 'sound-card';
    card.dataset.soundId = soundId;
    
    card.innerHTML = `
        <button class="remove-sound" onclick="removeSound('${soundId}', ${tabId})">×</button>
        <div class="sound-header">
            <div class="sound-title" title="${name}">${name}</div>
            <div class="sound-status" id="status-${soundId}"></div>
        </div>
        <div class="sound-controls">
            <button class="sound-btn play" onclick="playSound('${soundId}', ${tabId})">▶ Play</button>
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
    
    return card;
}

function setupAudioEvents(audio, soundId, tabId) {
    const card = document.querySelector(`[data-sound-id="${soundId}"]`);
    const status = document.getElementById(`status-${soundId}`);
    const progress = document.getElementById(`progress-${soundId}`);
    
    // Set initial volume
    updateAudioVolume(soundId);
    
    audio.addEventListener('play', () => {
        card.classList.remove('paused');
        card.classList.add('playing');
        status.classList.remove('paused');
        status.classList.add('playing');
    });
    
    audio.addEventListener('pause', () => {
        card.classList.remove('playing');
        card.classList.add('paused');
        status.classList.remove('playing');
        status.classList.add('paused');
    });
    
    audio.addEventListener('ended', () => {
        card.classList.remove('playing', 'paused');
        status.classList.remove('playing', 'paused');
        progress.style.width = '0%';
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
    }
}

function skipBack(soundId, seconds) {
    const audio = audioElements.get(soundId);
    if (audio) {
        audio.currentTime = Math.max(0, audio.currentTime - seconds);
    }
}

function removeSound(soundId, tabId) {
    const tab = tabData.get(tabId);
    const sound = tab.sounds.get(soundId);
    
    if (sound) {
        // Stop and cleanup audio
        sound.audio.pause();
        sound.audio.src = '';
        
        // Remove from DOM and data structures
        sound.element.remove();
        tab.sounds.delete(soundId);
        audioElements.delete(soundId);
    }
}

// Global controls
function stopAllSounds() {
    audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
}

function clearCurrentPanel() {
    if (confirm('Are you sure you want to clear all sounds from this panel?')) {
        const tab = tabData.get(currentTab);
        
        // Stop and cleanup all sounds
        tab.sounds.forEach(sound => {
            sound.audio.pause();
            sound.audio.src = '';
            sound.element.remove();
        });
        
        // Clear data structures
        tab.sounds.clear();
        
        // Remove all audio elements for this tab
        audioElements.forEach((audio, soundId) => {
            if (tab.sounds.has(soundId)) {
                audioElements.delete(soundId);
            }
        });
        
        // Reset grid with empty slot
        const grid = document.getElementById(`grid-${currentTab}`);
        grid.innerHTML = `
            <div class="empty-slot">
                <input type="file" accept=".mp3,.wav" onchange="loadSound(this, ${currentTab})">
                <div class="empty-text">
                    <strong>Drop or Click</strong>
                    Add MP3/WAV file
                </div>
            </div>
        `;
    }
}

// Volume control functions
function updateMasterVolume(value) {
    masterVolume = value / 100;
    document.getElementById('masterVolumeValue').textContent = value + '%';
    
    // Update all currently loaded audio elements
    audioElements.forEach((audio, soundId) => {
        updateAudioVolume(soundId);
    });
}

function updateSoundVolume(soundId, tabId, value) {
    const tab = tabData.get(tabId);
    const sound = tab.sounds.get(soundId);
    
    if (sound) {
        sound.volume = value / 100;
        document.getElementById(`volumeValue-${soundId}`).textContent = value + '%';
        updateAudioVolume(soundId);
    }
}

function updateAudioVolume(soundId) {
    const audio = audioElements.get(soundId);
    if (audio) {
        // Find the sound data to get individual volume
        let soundVolume = 1.0;
        for (const tab of tabData.values()) {
            if (tab.sounds.has(soundId)) {
                soundVolume = tab.sounds.get(soundId).volume;
                break;
            }
        }
        
        // Set final volume as master * individual
        audio.volume = masterVolume * soundVolume;
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        stopAllSounds();
    }
});

// Modal keyboard handling
document.getElementById('tabNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        confirmTabAction();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelTabAction();
    }
});

// Click outside modal to close
document.getElementById('tabModal').addEventListener('click', (e) => {
    if (e.target.id === 'tabModal') {
        cancelTabAction();
    }
});

// Initialize first tab with rename functionality
document.addEventListener('DOMContentLoaded', () => {
    const firstTabSpan = document.querySelector('[data-tab="0"] span');
    if (firstTabSpan) {
        firstTabSpan.ondblclick = (e) => {
            e.stopPropagation();
            renameTab(0);
        };
        firstTabSpan.style.cursor = 'pointer';
        firstTabSpan.title = 'Double-click to rename';
    }
});

// Prevent default drag behavior
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
