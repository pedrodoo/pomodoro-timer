// Pomodoro Timer – state and config
const WORK_DURATION_SEC = 25 * 60;   // 25 minutes
const BREAK_DURATION_SEC = 5 * 60;   // 5 minutes

let timeRemaining = WORK_DURATION_SEC;  // seconds
let isRunning = false;
let currentMode = 'work';  // 'work' | 'break'
let tickInterval = null;

// DOM elements
const app = document.getElementById('app');
const modeIndicator = document.getElementById('mode-indicator');
const timeDisplay = document.getElementById('time-display');
const startPauseBtn = document.getElementById('start-pause-btn');

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
      timeRemaining = BREAK_DURATION_SEC;
    } else {
      currentMode = 'work';
      timeRemaining = WORK_DURATION_SEC;
    }
  } else {
    timeRemaining -= 1;
  }
  updateDOM();
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
  timeRemaining = WORK_DURATION_SEC;
  updateDOM();
}

/** Wire up controls and initial render */
function init() {
  startPauseBtn.addEventListener('click', toggleStartPause);
  document.getElementById('reset-btn').addEventListener('click', reset);
  updateDOM();
}

init();
