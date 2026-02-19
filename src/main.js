// Pomodoro Timer – state and config (updated from settings panel)
let workDurationSec = 25 * 60;   // 25 minutes
let breakDurationSec = 5 * 60;   // 5 minutes

let timeRemaining = workDurationSec;  // seconds
let isRunning = false;
let currentMode = 'work';  // 'work' | 'break'
let tickInterval = null;
let sessionCount = 1;  // Pomodoro round (incremented when a focus session completes)
/** When the current phase started (ms), for smooth progress ring. */
let phaseStartTime = 0;
let progressRingRAFId = null;

// DOM elements
const app = document.getElementById('app');
const timeDisplay = document.getElementById('time-display');
const startPauseBtn = document.getElementById('start-pause-btn');
const modeFocusBtn = document.getElementById('mode-focus');
const modeBreakBtn = document.getElementById('mode-break');
const workDurationInput = document.getElementById('work-duration');
const breakDurationInput = document.getElementById('break-duration');
const applySettingsBtn = document.getElementById('apply-settings');
const menuBtn = document.getElementById('menu-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsDrawer = document.getElementById('settings-drawer');
const progressRingCircle = document.getElementById('progress-ring-circle');
const progressRingGlow = document.getElementById('progress-ring-glow');
const modeLabel = document.getElementById('mode-label');
const presetLabel = document.getElementById('preset-label');
const sessionCounter = document.getElementById('session-counter');
const runningIndicator = document.getElementById('running-indicator');

/** Format seconds as MM:SS */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PROGRESS_RING_R = 45;

/** Update only the progress ring stroke from a progress value in [0, 1]. */
function updateProgressRingOnly(progress) {
  const circumference = 2 * Math.PI * PROGRESS_RING_R;
  const dasharray = String(circumference);
  const dashoffset = String((1 - Math.min(1, progress)) * circumference);
  if (progressRingCircle) {
    progressRingCircle.style.strokeDasharray = dasharray;
    progressRingCircle.style.strokeDashoffset = dashoffset;
  }
  if (progressRingGlow) {
    progressRingGlow.style.strokeDasharray = dasharray;
    progressRingGlow.style.strokeDashoffset = dashoffset;
  }
}

/** Smooth progress loop: advance the ring every frame (Swiss-watch style), not per second. */
function smoothProgressLoop() {
  if (!isRunning) return;
  const totalSec = currentMode === 'work' ? workDurationSec : breakDurationSec;
  const elapsed = (Date.now() - phaseStartTime) / 1000;
  const progress = totalSec > 0 ? elapsed / totalSec : 1;
  updateProgressRingOnly(progress);
  progressRingRAFId = requestAnimationFrame(smoothProgressLoop);
}

/** Refresh all timer-related DOM from state */
function updateDOM() {
  const totalSec = currentMode === 'work' ? workDurationSec : breakDurationSec;
  const progress = totalSec > 0 ? (totalSec - timeRemaining) / totalSec : 1;

  timeDisplay.textContent = formatTime(timeRemaining);

  // Bounce on tick when running (trigger ~150ms scale animation)
  if (isRunning) {
    timeDisplay.classList.remove('timer-tick');
    void timeDisplay.offsetWidth;
    timeDisplay.classList.add('timer-tick');
    setTimeout(() => timeDisplay.classList.remove('timer-tick'), 200);
  }

  // Color shift: last 2 minutes → gradually tint digits toward warning
  const windDown = timeRemaining <= 120 ? (120 - timeRemaining) / 120 : 0;
  app.style.setProperty('--timer-wind-down', String(windDown));

  app.setAttribute('data-mode', currentMode);
  document.body.setAttribute('data-mode', currentMode);
  app.setAttribute('data-running', isRunning ? 'true' : 'false');
  const gradientUrl = currentMode === 'work' ? 'url(#workRingGradient)' : 'url(#breakRingGradient)';
  if (progressRingCircle) progressRingCircle.setAttribute('stroke', gradientUrl);
  if (progressRingGlow) progressRingGlow.setAttribute('stroke', gradientUrl);
  startPauseBtn.textContent = isRunning ? 'Pause' : 'Start';
  startPauseBtn.setAttribute('aria-label', isRunning ? 'Pause timer' : 'Start timer');

  // Progress ring: when running, smooth loop updates it; when paused, set from discrete time
  if (isRunning) {
    if (!progressRingRAFId) smoothProgressLoop();
  } else {
    if (progressRingRAFId) {
      cancelAnimationFrame(progressRingRAFId);
      progressRingRAFId = null;
    }
    updateProgressRingOnly(progress);
  }

  modeLabel.textContent = currentMode === 'work' ? 'Focus' : 'Break';
  presetLabel.textContent = currentMode === 'work'
    ? `${Math.round(workDurationSec / 60)} min`
    : `${Math.round(breakDurationSec / 60)} min`;
  sessionCounter.textContent = `Round ${sessionCount}`;
  sessionCounter.setAttribute('aria-label', `Pomodoro round ${sessionCount}`);
  runningIndicator.classList.toggle('is-visible', isRunning);

  // Focus/Break toggle: highlight active
  const focusActive = currentMode === 'work';
  modeFocusBtn.classList.toggle('mode-toggle__option--active', focusActive);
  modeFocusBtn.setAttribute('aria-selected', focusActive);
  modeBreakBtn.classList.toggle('mode-toggle__option--active', !focusActive);
  modeBreakBtn.setAttribute('aria-selected', !focusActive);
}

/** Run one tick: decrement time, switch mode if zero */
function tick() {
  if (timeRemaining <= 0) {
    if (currentMode === 'work') {
      sessionCount += 1;
      currentMode = 'break';
      timeRemaining = breakDurationSec;
    } else {
      currentMode = 'work';
      timeRemaining = workDurationSec;
    }
    phaseStartTime = Date.now();
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
    const totalSec = currentMode === 'work' ? workDurationSec : breakDurationSec;
    phaseStartTime = Date.now() - (totalSec - timeRemaining) * 1000;
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
  sessionCount = 1;
  updateDOM();
}

/** Apply settings from panel: update durations then full reset (stop timer, Focus, Round 1, ring at 0) */
function applySettings() {
  const workMin = Math.max(1, Math.min(60, Number(workDurationInput.value) || 25));
  const breakMin = Math.max(1, Math.min(60, Number(breakDurationInput.value) || 5));
  workDurationSec = workMin * 60;
  breakDurationSec = breakMin * 60;
  workDurationInput.value = workMin;
  breakDurationInput.value = breakMin;
  reset();
}

/** Open settings drawer */
function openSettings() {
  menuBtn.setAttribute('aria-expanded', 'true');
  menuBtn.setAttribute('aria-label', 'Close settings');
  settingsOverlay.classList.add('is-open');
  settingsDrawer.classList.add('is-open');
  settingsDrawer.setAttribute('aria-hidden', 'false');
  // Move focus to first focusable control for keyboard/screen reader users
  const firstInput = settingsDrawer.querySelector('#work-duration');
  if (firstInput) firstInput.focus();
}

/** Close settings drawer */
function closeSettings() {
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-label', 'Open settings');
  settingsOverlay.classList.remove('is-open');
  settingsDrawer.classList.remove('is-open');
  settingsDrawer.setAttribute('aria-hidden', 'true');
  menuBtn.focus();
}

/** Switch to Focus mode (work) */
function switchToFocus() {
  if (currentMode === 'break') {
    currentMode = 'work';
    timeRemaining = workDurationSec;
    phaseStartTime = Date.now(); /* reset ring to 0 for new phase */
    updateDOM();
  }
}

/** Switch to Break mode */
function switchToBreak() {
  if (currentMode === 'work') {
    currentMode = 'break';
    timeRemaining = breakDurationSec;
    phaseStartTime = Date.now(); /* reset ring to 0 for new phase */
    updateDOM();
  }
}

/** Keyboard shortcuts: Space = Start/Pause, R = Reset (when not typing in an input) */
function handleKeydown(e) {
  if (settingsDrawer.classList.contains('is-open')) return;
  const target = e.target;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  if (isInput) return;

  if (e.code === 'Space') {
    e.preventDefault();
    toggleStartPause();
  } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    reset();
  }
}

/** Wire up controls and initial render */
function init() {
  startPauseBtn.addEventListener('click', toggleStartPause);
  document.getElementById('reset-btn').addEventListener('click', reset);
  applySettingsBtn.addEventListener('click', () => {
    applySettings();
    closeSettings();
  });
  menuBtn.addEventListener('click', () => {
    if (settingsDrawer.classList.contains('is-open')) closeSettings();
    else openSettings();
  });
  settingsOverlay.addEventListener('click', closeSettings);
  modeFocusBtn.addEventListener('click', switchToFocus);
  modeBreakBtn.addEventListener('click', switchToBreak);
  document.addEventListener('keydown', handleKeydown);
  updateDOM();
}

init();
