// ==========================================
// TAURI API & WINDOW INITIALIZATION
// ==========================================

const appWindow = window.__TAURI__.window.getCurrentWindow();
const { LogicalSize } = window.__TAURI__.dpi || window.__TAURI__.window;

const BASE_WIDTH = 256; 
const BASE_HEIGHT = 256;
const appContainer = document.getElementById('app-container');

// Background interface references
const baseInterface = document.getElementById('base-interface');
const bgDay = document.getElementById('bg-day');
const bgNight = document.getElementById('bg-night');
const btnThemeToggle = document.getElementById('btn-theme-toggle');

const resizeObserver = new ResizeObserver((entries) => {
  for (let entry of entries) {
    const scaleX = entry.contentRect.width / BASE_WIDTH;
    const scaleY = entry.contentRect.height / BASE_HEIGHT;
    const finalScale = Math.min(scaleX, scaleY);
    appContainer.style.transform = `scale(${finalScale})`;
  }
});
resizeObserver.observe(document.body);

async function setWindowScale(multiplier) {
  const newWidth = BASE_WIDTH * multiplier;
  const newHeight = BASE_HEIGHT * multiplier;
  await appWindow.setSize(new LogicalSize(newWidth, newHeight));
}

// ==========================================
// GLOBAL STATE & DATA STORAGE
// ==========================================

const defaultSettings = {
  autoStartPomodoro: false,
  autoStartBreaks: false,
  workDuration: 25, 
  breakDuration: 5, 
  alarmVolume: 50, 
  cheetoVolume: 50,
  musicVolume: 25, 
  isDarkMode: false,
  windowScale: 2 
};

const savedData = localStorage.getItem('aridoro_settings');
let settings = savedData ? { ...defaultSettings, ...JSON.parse(savedData) } : { ...defaultSettings };

function saveSettings() {
  localStorage.setItem('aridoro_settings', JSON.stringify(settings));
}

// Timer State
let currentPhase = 'WORK'; 
let timeLeft = settings.workDuration * 60; 
let timerInterval = null; 
let isRunning = false;
let hasStartedSession = false;

// Music Player State
const playlist = [
  { file: '7pm.ogg', title: '7pm' },
  { file: '420.ogg', title: '420' },
  { file: 'after.ogg', title: 'After' },
  { file: 'americano.ogg', title: 'Americano' },
  { file: 'between_the_dunes.ogg', title: 'Between The Dunes' },
  { file: 'birds_song.ogg', title: 'Birds Song' },
  { file: 'brain_empty.ogg', title: 'Brain Empty' },
  { file: 'cappuccino.ogg', title: 'Cappuccino' },
  { file: 'coffee_beans.ogg', title: 'Coffee Beans' },
  { file: 'cold_brew_coffee.ogg', title: 'Cold Brew Coffee' },
  { file: 'dragons.ogg', title: 'Dragons' },
  { file: 'evening_mood.ogg', title: 'Evening Mood' },
  { file: 'flat_white.ogg', title: 'Flat White' },
  { file: 'goodbye.ogg', title: 'Goodbye' },
  { file: 'homework.ogg', title: 'Homework' },
  { file: 'hot_chocolate.ogg', title: 'Hot Chocolate' },
  { file: 'morning_walk.ogg', title: 'Morning Walk' },
  { file: 'pumpkin_cream_cold_brew.ogg', title: 'Pumpkin Cream Brew' },
  { file: 'rainy_day.ogg', title: 'Rainy Day' },
  { file: 'stars_and_chill.ogg', title: 'Stars And Chill' },
  { file: 'summer.ogg', title: 'Summer' },
  { file: 'tapered_out.ogg', title: 'Tapered Out' }
];

let currentTrackIndex = 0;
let isMusicPlaying = false;
let isVolumeSliderOpen = false;
let isDraggingVol = false;

// Audio Engine Initialization
const audioAlarm = new Audio('/assets/alarm.ogg');
const audioCheetoWork = new Audio('/assets/cheeto_work.ogg');
const audioCheetoBreak = new Audio('/assets/cheeto_break.ogg');
const bgMusic = new Audio(`/assets/music/${playlist[currentTrackIndex].file}`);

bgMusic.volume = settings.musicVolume / 100;

// ==========================================
// SYSTEM: SFX AUDIO ENGINES
// ==========================================

const sfxButton = new Audio('/assets/button.ogg');
const sfxTimerStart = new Audio('/assets/button_timerstart.ogg');
const sfxTimerStop = new Audio('/assets/button_timerstop.ogg');
const sfxTimerSkip = new Audio('assets/button_timerskip.ogg')
const sfxLightmode = new Audio('/assets/lightmode.ogg');
const sfxDarkmode = new Audio('/assets/darkmode.ogg');

sfxButton.volume = 1;
sfxTimerStart.volume = 0.3;
sfxTimerStop.volume = 0.3;
sfxTimerSkip.volume = 0.3;
sfxLightmode.volume = 0.3;
sfxDarkmode.volume = 0.3;

// Helper: Reset audio playback to 0 to allow concurrent/rapid SFX triggers
function playSfx(audioObj) {
  audioObj.currentTime = 0; 
  audioObj.play().catch(err => console.warn("SFX blocked:", err));
}

// ==========================================
// DOM REFERENCES (HTML ELEMENTS)
// ==========================================

// Timer Elements
const timeDisplay = document.getElementById('time-display');
const btnTimerPause = document.getElementById('btn-timer-pause');
const btnTimerResume = document.getElementById('btn-timer-resume');
const btnTimerSkip = document.getElementById('btn-timer-skip');
const btnTimerStart = document.getElementById('btn-timer-start');

// Music Elements
const btnVolume = document.getElementById('btn-volume');
const btnMusicPlay = document.getElementById('btn-music-play');
const btnMusicPause = document.getElementById('btn-music-pause');
const btnMusicSkip = document.getElementById('btn-music-skip');
const btnMusicPrev = document.getElementById('btn-music-prev');
const musicDisplay = document.getElementById('music-display');
const volumeControlLayer = document.getElementById('volume-control-layer');
const volTextRight = document.getElementById('vol-text-right');
const volFillMask = document.getElementById('vol-fill-mask');
const volHandle = document.getElementById('vol-handle');
const volSliderBounds = document.getElementById('vol-slider-bounds');
const musicBar = document.getElementById('music-bar');
const volumeBar = document.getElementById('volume-bar');
const musicDisplayContainer = document.getElementById('music-display-container');
const musicTimer = document.getElementById('music-timer');

// Settings Elements
const settingsOverlay = document.getElementById('settings-overlay');
const btnSettings = document.getElementById('btn-settings');
const chkAutoWork = document.getElementById('chk-auto-work');
const chkAutoBreak = document.getElementById('chk-auto-break');
const valWorkLength = document.getElementById('val-work-length');
const valBreakLength = document.getElementById('val-break-length');
const valAlarmVol = document.getElementById('val-alarm-vol');
const valCheetoVol = document.getElementById('val-cheeto-vol');
const valWindowSize = document.getElementById('val-window-size');

// ==========================================
// SYSTEM: POMODORO TIMER
// ==========================================

function updateDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
  const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;
  timeDisplay.innerText = `${formattedMinutes}:${formattedSeconds}`;
}

function updateTimerUI() {
  const isFreshPhase = 
    (currentPhase === 'WORK' && timeLeft === settings.workDuration * 60) ||
    (currentPhase === 'BREAK' && timeLeft === settings.breakDuration * 60);

  // Interface Swap Logic
  if (!hasStartedSession) {
    baseInterface.src = '/assets/app_interface_default.png'; // Only display on initial boot
  } else if (currentPhase === 'WORK') {
    baseInterface.src = '/assets/app_interface_work.png';
  } else if (currentPhase === 'BREAK') {
    baseInterface.src = '/assets/app_interface_break.png';
  }

  // Handle Playback Button Toggles
  if (isRunning) {
    btnTimerPause.classList.remove('hidden');
    btnTimerResume.classList.add('hidden');
    btnTimerStart.classList.add('hidden');
  } else if (isFreshPhase) {
    btnTimerPause.classList.add('hidden');
    btnTimerResume.classList.add('hidden');
    btnTimerStart.classList.remove('hidden');
  } else {
    btnTimerPause.classList.add('hidden');
    btnTimerResume.classList.remove('hidden');
    btnTimerStart.classList.add('hidden');
  }
}

function tick() {
  if (timeLeft > 0) {
    timeLeft--;
    updateDisplay();
  } else {
    switchPhase();
  }
}

function switchPhase() {
  clearInterval(timerInterval);
  isRunning = false;

  const nextPhase = (currentPhase === 'WORK') ? 'BREAK' : 'WORK';

  if (currentPhase === 'WORK') {
    currentPhase = 'BREAK';
    timeLeft = settings.breakDuration * 60; 
  } else {
    currentPhase = 'WORK';
    timeLeft = settings.workDuration * 60; 
  }

  dispatchPhaseAudio(nextPhase);
  updateDisplay();
  updateTimerUI();

  if (currentPhase === 'BREAK' && settings.autoStartBreaks) {
    startTimer();
  } else if (currentPhase === 'WORK' && settings.autoStartPomodoro) {
    startTimer();
  }
}

function startTimer() {
  if (!isRunning) {
    hasStartedSession = true; // Lock the app out of the default state
    isRunning = true;
    timerInterval = setInterval(tick, 1000);
    updateTimerUI();
  }
}

function pauseTimer() {
  if (isRunning) {
    isRunning = false;
    clearInterval(timerInterval);
    updateTimerUI();
  }
}

function skipTimer() {
  switchPhase();
}

// Audio Cue System
function dispatchPhaseAudio(nextPhase) {
  audioAlarm.pause(); audioAlarm.currentTime = 0;
  audioCheetoWork.pause(); audioCheetoWork.currentTime = 0;
  audioCheetoBreak.pause(); audioCheetoBreak.currentTime = 0;

  if (!settings.muteAlarms) {
    audioAlarm.play().catch(err => console.warn("Audio playback blocked:", err));
    audioAlarm.onended = () => playCheetoVoice(nextPhase);
  } else {
    playCheetoVoice(nextPhase);
  }
}

function playCheetoVoice(nextPhase) {
  if (settings.muteCheeto) return;
  if (nextPhase === 'BREAK') {
    audioCheetoBreak.play().catch(err => console.warn("Voiceline blocked:", err));
  } else {
    audioCheetoWork.play().catch(err => console.warn("Voiceline blocked:", err));
  }
}

// ==========================================
// SYSTEM: MUSIC PLAYER & VOLUME
// ==========================================

function updateMusicDisplay() {
  musicDisplay.innerText = playlist[currentTrackIndex].title;

  // Force DOM reflow to restart CSS marquee animation
  musicDisplay.style.animation = 'none'; 
  musicDisplay.offsetHeight;             
  musicDisplay.style.animation = null;   
}

// Format raw seconds into M:SS
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Update the timer continuously based on audio engine playback
bgMusic.addEventListener('timeupdate', () => {
  musicTimer.innerText = `${formatTime(bgMusic.currentTime)}/${formatTime(bgMusic.duration)}`;
});

// Force timer display update on loaded track metadata
bgMusic.addEventListener('loadedmetadata', () => {
  musicTimer.innerText = `0:00/${formatTime(bgMusic.duration)}`;
});

function playMusic() {
  bgMusic.play().catch(e => console.warn("Music blocked:", e));
  isMusicPlaying = true;
  btnMusicPlay.classList.add('hidden');
  btnMusicPause.classList.remove('hidden');
}

function pauseMusic() {
  bgMusic.pause();
  isMusicPlaying = false;
  btnMusicPause.classList.add('hidden');
  btnMusicPlay.classList.remove('hidden');
}

function skipMusic() {
  currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
  bgMusic.src = `/assets/music/${playlist[currentTrackIndex].file}`; 
  updateMusicDisplay();
  if (isMusicPlaying) bgMusic.play().catch(e => console.warn("Music blocked:", e));
}

function prevMusic() {
  currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
  bgMusic.src = `/assets/music/${playlist[currentTrackIndex].file}`;
  updateMusicDisplay();
  if (isMusicPlaying) bgMusic.play().catch(e => console.warn("Music blocked:", e));
}

bgMusic.addEventListener('ended', skipMusic);

// Toggle Slider & Background Visibility
btnVolume.addEventListener('click', () => {
  playSfx(sfxButton);
  isVolumeSliderOpen = !isVolumeSliderOpen;
  
  if (isVolumeSliderOpen) {
    musicDisplayContainer.classList.add('hidden');
    musicTimer.classList.add('hidden'); // Hide Timer
    musicBar.classList.add('hidden');
    
    volumeControlLayer.classList.remove('hidden');
    volumeBar.classList.remove('hidden');
  } else {
    volumeControlLayer.classList.add('hidden');
    volumeBar.classList.add('hidden');
    
    musicDisplayContainer.classList.remove('hidden');
    musicTimer.classList.remove('hidden'); // Show Timer
    musicBar.classList.remove('hidden');
  }
});

// Calculate and apply volume based on slider DOM position
function updateVolumeFromEvent(e) {
  const rect = volSliderBounds.getBoundingClientRect();
  let x = e.clientX - rect.left;
  
  if (x < 0) x = 0;
  if (x > rect.width) x = rect.width;

  const pct = x / rect.width;
  bgMusic.volume = pct;
  
  const pct100 = Math.round(pct * 100);
  volTextRight.innerText = `${pct100}%`;
  volFillMask.style.width = `${pct * 100}%`;
  volHandle.style.left = `${pct * 100}%`;
  settings.musicVolume = pct100;
}

volSliderBounds.addEventListener('mousedown', (e) => {
  isDraggingVol = true;
  updateVolumeFromEvent(e);
});

window.addEventListener('mousemove', (e) => {
  if (isDraggingVol) updateVolumeFromEvent(e);
});

window.addEventListener('mouseup', () => {
  if (isDraggingVol) {
    isDraggingVol = false;
    saveSettings();
  }
});

// ==========================================
// SYSTEM: SETTINGS MENU
// ==========================================

function initializeSettingsUI() {
  chkAutoWork.src = settings.autoStartPomodoro ? '/assets/checkbox_on.png' : '/assets/checkbox_off.png';
  chkAutoBreak.src = settings.autoStartBreaks ? '/assets/checkbox_on.png' : '/assets/checkbox_off.png';
  
  valWorkLength.innerText = `${settings.workDuration}m`;
  valBreakLength.innerText = `${settings.breakDuration}m`;
  
  valAlarmVol.innerText = `${settings.alarmVolume}%`;
  audioAlarm.volume = settings.alarmVolume / 100;
  settings.muteAlarms = (settings.alarmVolume === 0);
  
  valCheetoVol.innerText = `${settings.cheetoVolume}%`;
  audioCheetoWork.volume = settings.cheetoVolume / 100;
  audioCheetoBreak.volume = settings.cheetoVolume / 100;
  settings.muteCheeto = (settings.cheetoVolume === 0);
  
  valWindowSize.innerText = `${settings.windowScale}x`;
  setWindowScale(settings.windowScale);
}

function toggleCheckbox(imgElement, settingKey) {
  playSfx(sfxButton);
  settings[settingKey] = !settings[settingKey]; 
  imgElement.src = settings[settingKey] ? '/assets/checkbox_on.png' : '/assets/checkbox_off.png';
  saveSettings();
}

btnSettings.addEventListener('click', () => {
  playSfx(sfxButton);
  settingsOverlay.classList.toggle('hidden');
});

chkAutoWork.addEventListener('click', () => toggleCheckbox(chkAutoWork, 'autoStartPomodoro'));
chkAutoBreak.addEventListener('click', () => toggleCheckbox(chkAutoBreak, 'autoStartBreaks'));

document.getElementById('btn-work-up').addEventListener('click', () => {
  if (settings.workDuration < 60) {
    settings.workDuration += 5;
    valWorkLength.innerText = `${settings.workDuration}m`;
    if (currentPhase === 'WORK' && !isRunning) { timeLeft = settings.workDuration * 60; updateDisplay(); }
    saveSettings();
  }
});
document.getElementById('btn-work-down').addEventListener('click', () => {
  if (settings.workDuration > 5) {
    settings.workDuration -= 5;
    valWorkLength.innerText = `${settings.workDuration}m`;
    if (currentPhase === 'WORK' && !isRunning) { timeLeft = settings.workDuration * 60; updateDisplay(); }
    saveSettings();
  }
});

document.getElementById('btn-break-up').addEventListener('click', () => {
  if (settings.breakDuration < 10) {
    settings.breakDuration += 1;
    valBreakLength.innerText = `${settings.breakDuration}m`;
    if (currentPhase === 'BREAK' && !isRunning) { timeLeft = settings.breakDuration * 60; updateDisplay(); }
    saveSettings();
  }
});
document.getElementById('btn-break-down').addEventListener('click', () => {
  if (settings.breakDuration > 1) {
    settings.breakDuration -= 1;
    valBreakLength.innerText = `${settings.breakDuration}m`;
    if (currentPhase === 'BREAK' && !isRunning) { timeLeft = settings.breakDuration * 60; updateDisplay(); }
    saveSettings();
  }
});

document.getElementById('btn-alarm-up').addEventListener('click', () => {
  if (settings.alarmVolume < 100) {
    settings.alarmVolume += 5;
    valAlarmVol.innerText = `${settings.alarmVolume}%`;
    audioAlarm.volume = settings.alarmVolume / 100; 
    settings.muteAlarms = (settings.alarmVolume === 0);
    saveSettings();
  }
});
document.getElementById('btn-alarm-down').addEventListener('click', () => {
  if (settings.alarmVolume > 0) {
    settings.alarmVolume -= 5;
    valAlarmVol.innerText = `${settings.alarmVolume}%`;
    audioAlarm.volume = settings.alarmVolume / 100;
    settings.muteAlarms = (settings.alarmVolume === 0);
    saveSettings();
  }
});

document.getElementById('btn-cheeto-up').addEventListener('click', () => {
  if (settings.cheetoVolume < 100) {
    settings.cheetoVolume += 5;
    valCheetoVol.innerText = `${settings.cheetoVolume}%`;
    audioCheetoWork.volume = settings.cheetoVolume / 100;
    audioCheetoBreak.volume = settings.cheetoVolume / 100;
    settings.muteCheeto = (settings.cheetoVolume === 0);
    saveSettings();
  }
});
document.getElementById('btn-cheeto-down').addEventListener('click', () => {
  if (settings.cheetoVolume > 0) {
    settings.cheetoVolume -= 5;
    valCheetoVol.innerText = `${settings.cheetoVolume}%`;
    audioCheetoWork.volume = settings.cheetoVolume / 100;
    audioCheetoBreak.volume = settings.cheetoVolume / 100;
    settings.muteCheeto = (settings.cheetoVolume === 0);
    saveSettings();
  }
});

document.getElementById('btn-size-up').addEventListener('click', () => {
  if (settings.windowScale < 3) {
    settings.windowScale += 1;
    valWindowSize.innerText = `${settings.windowScale}x`;
    setWindowScale(settings.windowScale); 
    saveSettings();
  }
});
document.getElementById('btn-size-down').addEventListener('click', () => {
  if (settings.windowScale > 1) {
    settings.windowScale -= 1;
    valWindowSize.innerText = `${settings.windowScale}x`;
    setWindowScale(settings.windowScale);
    saveSettings();
  }
});

// ==========================================
// SYSTEM: THEME TOGGLE
// ==========================================

function applyTheme() {
  if (settings.isDarkMode) {
    // Fade OUT day image to reveal night image beneath
    bgDay.style.opacity = '0';
    btnThemeToggle.src = '/assets/button_darkmode.png'; 
  } else {
    // Fade IN day image to cover night image
    bgDay.style.opacity = '1';
    btnThemeToggle.src = '/assets/button_lightmode.png';  
  }
}

// Toggle state, apply visuals, and trigger appropriate SFX
btnThemeToggle.addEventListener('click', () => {
  settings.isDarkMode = !settings.isDarkMode;
  applyTheme();

  if (settings.isDarkMode) {
    playSfx(sfxDarkmode);
  } else {
    playSfx(sfxLightmode);
  }
});

// ==========================================
// EVENT BINDINGS (STATIC)
// ==========================================

document.getElementById('minimize-btn').addEventListener('click', () => appWindow.minimize());
document.getElementById('close-btn').addEventListener('click', () => appWindow.close());

// Timer Controls
btnTimerPause.addEventListener('click', () => { playSfx(sfxTimerStop); pauseTimer(); });
btnTimerResume.addEventListener('click', () => { playSfx(sfxTimerStart); startTimer(); });
btnTimerSkip.addEventListener('click', () => { playSfx(sfxTimerSkip); skipTimer(); });
btnTimerStart.addEventListener('click', () => { playSfx(sfxTimerStart); startTimer(); });

// Music Controls
btnMusicPlay.addEventListener('click', () => { playSfx(sfxButton); playMusic(); });
btnMusicPause.addEventListener('click', () => { playSfx(sfxButton); pauseMusic(); });
btnMusicSkip.addEventListener('click', () => { playSfx(sfxButton); skipMusic(); });
btnMusicPrev.addEventListener('click', () => { playSfx(sfxButton); prevMusic(); });

// Bind SFX to all UI arrow buttons
const arrowButtons = document.querySelectorAll('.invisible-arrow-btn');
arrowButtons.forEach(btn => {
  btn.addEventListener('click', () => playSfx(sfxButton));
});

// ==========================================
// BOOT INSTRUCTIONS (RUN ON STARTUP)
// ==========================================

updateDisplay();
initializeSettingsUI();
updateMusicDisplay();
updateTimerUI();
applyTheme();

// Initialize volume slider UI state
const initialVolPct = bgMusic.volume;
volTextRight.innerText = `${settings.musicVolume}%`;
volFillMask.style.width = `${settings.musicVolume}%`;
volHandle.style.left = `${settings.musicVolume}%`;

// ==========================================
// SYSTEM: GIF SYNCHRONIZATION
// ==========================================

// Await full load before synchronizing
window.addEventListener('load', () => {
  // Reassign src to force rendering engine to synchronize GIF frame clocks
  bgNight.src = bgNight.src;
  bgDay.src = bgDay.src;
});