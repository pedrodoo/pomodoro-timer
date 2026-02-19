// Pomodoro Timer – state and config (updated from settings panel)
let workDurationSec = 25 * 60;   // 25 minutes
let breakDurationSec = 5 * 60;   // 5 minutes

let timeRemaining = workDurationSec;  // seconds
let isRunning = false;
let currentMode = 'work';  // 'work' | 'break'
let tickInterval = null;

// DOM elements
const app = document.getElementById('app');
const modeIndicator = document.getElementById('mode-indicator');
const timeDisplay = document.getElementById('time-display');
const startPauseBtn = document.getElementById('start-pause-btn');
const workDurationInput = document.getElementById('work-duration');
const breakDurationInput = document.getElementById('break-duration');
const applySettingsBtn = document.getElementById('apply-settings');

/** Format seconds as MM:SS */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Refresh all timer-related DOM from state */
function updateDOM() {
  timeDisplay.textContent = formatTime(timeRemaining);
  modeIndicator.textContent = currentMode === 'work' ? 'Focus' : 'Break';
  app.setAttribute('data-mode', currentMode);
  startPauseBtn.textContent = isRunning ? 'Pause' : 'Start';
  startPauseBtn.setAttribute('aria-label', isRunning ? 'Pause timer' : 'Start timer');
}

/** Run one tick: decrement time, switch mode if zero */
function tick() {
  if (timeRemaining <= 0) {
    if (currentMode === 'work') {
      currentMode = 'break';
      timeRemaining = breakDurationSec;
    } else {
      currentMode = 'work';
      timeRemaining = workDurationSec;
    }
    playNotificationSound();
    triggerFlash();
  } else {
    timeRemaining -= 1;
  }
  updateDOM();
}

/** Play a short notification sound when mode switches (timer reached zero) */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1100, now + 0.1);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (_) {
    // Ignore if audio is blocked (e.g. autoplay policy)
  }
}

/** Briefly flash the app background when mode switches (timer reached zero) */
function triggerFlash() {
  app.classList.remove('timer-flash');
  app.offsetHeight; // force reflow so animation can run again
  app.classList.add('timer-flash');
  const onEnd = () => {
    app.classList.remove('timer-flash');
    app.removeEventListener('animationend', onEnd);
  };
  app.addEventListener('animationend', onEnd);
}

/** Start or pause the countdown */
function toggleStartPause() {
  isRunning = !isRunning;
  if (isRunning) {
    tickInterval = setInterval(tick, 1000);
  } else {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  updateDOM();
}

/** Stop timer and reset to work mode with full duration */
function reset() {
  isRunning = false;
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  currentMode = 'work';
  timeRemaining = workDurationSec;
  updateDOM();
}

/** Apply settings from panel: update durations and refresh timer display */
function applySettings() {
  const workMin = Math.max(1, Math.min(60, Number(workDurationInput.value) || 25));
  const breakMin = Math.max(1, Math.min(60, Number(breakDurationInput.value) || 5));
  workDurationSec = workMin * 60;
  breakDurationSec = breakMin * 60;
  // Sync inputs in case we clamped
  workDurationInput.value = workMin;
  breakDurationInput.value = breakMin;
  // Update current phase to new duration
  timeRemaining = currentMode === 'work' ? workDurationSec : breakDurationSec;
  updateDOM();
}

/** Wire up controls and initial render */
function init() {
  startPauseBtn.addEventListener('click', toggleStartPause);
  document.getElementById('reset-btn').addEventListener('click', reset);
  applySettingsBtn.addEventListener('click', applySettings);
  updateDOM();
}

init();
