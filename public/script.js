let tabCounter = 0;
const tabs = [];
const tabBar = document.getElementById('tab-bar');
const panels = document.getElementById('panels');
const addTabBtn = document.getElementById('add-tab');

addTabBtn.addEventListener('click', addTab);

function addTab() {
    const id = `tab-${tabCounter++}`;
    const tabButton = document.createElement('button');
    tabButton.textContent = `Tab ${tabCounter}`;
    tabButton.dataset.target = id;
    tabButton.addEventListener('click', () => activateTab(id));
    tabBar.insertBefore(tabButton, addTabBtn);

    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.id = id;

    const addTrackBtn = document.createElement('button');
    addTrackBtn.textContent = '+ Add Track';
    addTrackBtn.addEventListener('click', () => addTrack(panel));
    panel.appendChild(addTrackBtn);

    panels.appendChild(panel);

    activateTab(id);
}

function activateTab(id) {
    document.querySelectorAll('#tab-bar button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const btn = Array.from(tabBar.children).find(b => b.dataset && b.dataset.target === id);
    if (btn) btn.classList.add('active');
    const panel = document.getElementById(id);
    if (panel) panel.classList.add('active');
}

function addTrack(panel) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.addEventListener('change', () => {
        if (input.files.length > 0) {
            createTrack(panel, input.files[0]);
        }
    });
    input.click();
}

function createTrack(panel, file) {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.preload = 'auto';

    const trackDiv = document.createElement('div');
    trackDiv.className = 'track';

    const title = document.createElement('span');
    title.textContent = file.name;
    trackDiv.appendChild(title);

    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = 'stopped';
    trackDiv.appendChild(status);

    const controls = document.createElement('div');
    controls.className = 'controls';
    trackDiv.appendChild(controls);

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    });
    controls.appendChild(playBtn);

    const loopBtn = document.createElement('button');
    loopBtn.textContent = 'Loop';
    loopBtn.addEventListener('click', () => {
        audio.loop = !audio.loop;
        loopBtn.classList.toggle('active', audio.loop);
    });
    controls.appendChild(loopBtn);

    [5, 15, 20].forEach(sec => {
        const btn = document.createElement('button');
        btn.textContent = `- ${sec}s`;
        btn.addEventListener('click', () => {
            audio.currentTime = Math.max(audio.currentTime - sec, 0);
        });
        controls.appendChild(btn);
    });

    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => audio.pause());
    controls.appendChild(pauseBtn);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        audio.pause();
        trackDiv.remove();
    });
    controls.appendChild(removeBtn);

    audio.addEventListener('play', () => status.textContent = 'playing');
    audio.addEventListener('pause', () => status.textContent = 'paused');
    audio.addEventListener('ended', () => status.textContent = 'stopped');

    panel.appendChild(trackDiv);
}

// Initialize with one tab
addTab();
