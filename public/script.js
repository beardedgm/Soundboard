let tabCounter = 0;
const tabs = [];
const tabBar = document.getElementById('tab-bar');
const panels = document.getElementById('panels');
const addTabBtn = document.getElementById('add-tab');

addTabBtn.addEventListener('click', addTab);

// Using the HTML5 Audio API keeps the implementation lightweight and
// avoids the overhead of embedding full player widgets.

function addTab() {
    const id = `tab-${tabCounter++}`;
    const tabButton = document.createElement('button');
    tabButton.className = 'button is-small';
    tabButton.textContent = `Tab ${tabCounter}`;
    tabButton.dataset.target = id;
    tabButton.addEventListener('click', () => activateTab(id));
    tabBar.insertBefore(tabButton, addTabBtn);

    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.id = id;

    const addTrackBtn = document.createElement('button');
    addTrackBtn.className = 'button is-small';
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
    controls.className = 'controls buttons';
    trackDiv.appendChild(controls);

    const playBtn = document.createElement('button');
    playBtn.className = 'button is-small';
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
    loopBtn.className = 'button is-small';
    loopBtn.textContent = 'Loop: Off';
    loopBtn.addEventListener('click', () => {
        audio.loop = !audio.loop;
        loopBtn.classList.toggle('active', audio.loop);
        loopBtn.textContent = audio.loop ? 'Loop: On' : 'Loop: Off';
    });
    controls.appendChild(loopBtn);

    [5, 15, 20].forEach(sec => {
        const btn = document.createElement('button');
        btn.className = 'button is-small';
        btn.textContent = `- ${sec}s`;
        btn.addEventListener('click', () => {
            audio.currentTime = Math.max(audio.currentTime - sec, 0);
        });
        controls.appendChild(btn);
    });

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'button is-small';
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => audio.pause());
    controls.appendChild(pauseBtn);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'button is-small';
    stopBtn.textContent = 'Stop';
    stopBtn.addEventListener('click', () => {
        audio.pause();
        audio.currentTime = 0;
    });
    controls.appendChild(stopBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'button is-small is-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        audio.pause();
        trackDiv.remove();
    });
    controls.appendChild(removeBtn);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.className = 'progress-bar';
    progress.min = 0;
    progress.value = 0;
    progress.step = 0.01;
    progressContainer.appendChild(progress);

    const timeLabel = document.createElement('span');
    timeLabel.className = 'time-label';
    timeLabel.textContent = '0:00 / 0:00';
    progressContainer.appendChild(timeLabel);
    trackDiv.appendChild(progressContainer);

    function updateProgress() {
        progress.max = audio.duration || 0;
        progress.value = audio.currentTime;
        timeLabel.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }

    progress.addEventListener('input', () => {
        audio.currentTime = progress.value;
    });

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);

    audio.addEventListener('play', () => status.textContent = 'playing');
    audio.addEventListener('pause', () => status.textContent = 'paused');
    audio.addEventListener('ended', () => status.textContent = 'stopped');

    panel.appendChild(trackDiv);
}

function formatTime(sec) {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// Initialize with one tab
addTab();
