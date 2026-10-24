/**
 * WAR DADDY HICAPA BUILDS - IPSC ACTION AIR HIT FACTOR CALCULATOR
 * Official Precision Scoring Logic & Interactive App
 */

// State Management
const appState = {
  shooter: '',
  stage: '',
  division: 'Open',
  counts: {
    alpha: 0,
    charlie: 0,
    delta: 0,
    miss: 0,
    noShoot: 0,
    procedural: 0
  },
  time: 0.00,
  audioEnabled: true,
  matchRuns: []
};

// Stopwatch state
let stopwatchTimer = null;
let stopwatchStartTime = 0;
let stopwatchElapsedTime = 0;
let stopwatchRunning = false;

// Audio Synthesizer (Web Audio API with Dynamics Compression & Volume Boost)
let audioCtx = null;
let compressorNode = null;
let masterGainNode = null;

let volumeMode = 'MAX'; // 'MAX' (1.0), 'HIGH' (0.65), 'OFF' (0.0)
let volumeMultiplier = 1.0;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    // Dynamics Compressor pushes perceived RMS loudness and prevents clipping
    compressorNode = audioCtx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-14, audioCtx.currentTime);
    compressorNode.knee.setValueAtTime(4, audioCtx.currentTime);
    compressorNode.ratio.setValueAtTime(12, audioCtx.currentTime);
    compressorNode.attack.setValueAtTime(0.001, audioCtx.currentTime);
    compressorNode.release.setValueAtTime(0.04, audioCtx.currentTime);

    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.setValueAtTime(volumeMultiplier, audioCtx.currentTime);

    compressorNode.connect(masterGainNode);
    masterGainNode.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Authentic High-Volume IPSC Match Shot Timer Buzzer (2850Hz piezo tone)
function playCompetitionBuzzer() {
  if (!appState.audioEnabled || volumeMultiplier <= 0) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const duration = 0.38; // Official IPSC shot timer duration

    // Osc 1: Primary piercing piezo square wave at 2850 Hz
    const osc1 = ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(2850, now);

    // Osc 2: Aggressive harmonics enricher (sawtooth wave at 2850 Hz)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(2850, now);

    // Osc 3: Dual-piezo diaphragm overtone at 3100 Hz
    const osc3 = ctx.createOscillator();
    osc3.type = 'square';
    osc3.frequency.setValueAtTime(3100, now);

    // High-volume Buzzer Gain (0.95 - 1.0)
    const buzzerGain = ctx.createGain();
    buzzerGain.gain.setValueAtTime(0.98 * volumeMultiplier, now);
    buzzerGain.gain.setValueAtTime(0.98 * volumeMultiplier, now + duration - 0.02);
    buzzerGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(buzzerGain);
    osc2.connect(buzzerGain);
    osc3.connect(buzzerGain);
    buzzerGain.connect(compressorNode);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);

    flashBuzzerWidget();
  } catch (e) {
    console.warn('Audio buzzer error:', e);
  }
}

// Shot Timer Stop Signal (Loud double-beep)
function playStopBeep() {
  if (!appState.audioEnabled || volumeMultiplier <= 0) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    [0, 0.11].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(2200, now + offset);
      gain.gain.setValueAtTime(0.85 * volumeMultiplier, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
      osc.connect(gain);
      gain.connect(compressorNode);
      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  } catch (e) {}
}

function flashBuzzerWidget() {
  const widget = document.getElementById('stopwatchWidget');
  if (widget) {
    widget.classList.add('buzzer-active');
    setTimeout(() => widget.classList.remove('buzzer-active'), 350);
  }
}

// Punchy, loud button feedback tone
function playAudioTone(freq = 600, type = 'sine', duration = 0.05, customGain = 0.5) {
  if (!appState.audioEnabled || volumeMultiplier <= 0) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(customGain * volumeMultiplier, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(compressorNode);
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {}
}

// -----------------------------------------------------------------------------
// IPSC ACTION AIR HIT FACTOR FORMULA
// -----------------------------------------------------------------------------
// In IPSC Action Air, all divisions (Open, Standard, Production, Production Optics, Classic)
// are scored as MINOR.
// Alpha = 5 pts, Charlie = 3 pts, Delta = 1 pt
// Miss = -10 pts, No Shoot = -10 pts, Procedural = -10 pts
// Stage Score Points = Math.max(0, Raw Points - Penalties)
// Hit Factor = Time > 0 ? (Score Points / Time) : 0.0000
// -----------------------------------------------------------------------------

function calculateCurrentRun() {
  const { alpha, charlie, delta, miss, noShoot, procedural } = appState.counts;
  const time = parseFloat(appState.time) || 0;

  // Minor scoring points
  const rawPoints = (alpha * 5) + (charlie * 3) + (delta * 1);
  const penalties = (miss * 10) + (noShoot * 10) + (procedural * 10);
  
  // Rule 9.4.1.1 / 9.5.2: Negative stage points are recorded as zero
  const scorePoints = Math.max(0, rawPoints - penalties);

  let hitFactor = 0.0;
  if (time > 0) {
    hitFactor = scorePoints / time;
  }

  return {
    rawPoints,
    penalties,
    scorePoints,
    time,
    hitFactor
  };
}

// Update DOM elements with calculated figures
function updateDisplay() {
  const result = calculateCurrentRun();

  // Hit Factor display (always 4 decimal places)
  const hfElement = document.getElementById('hitFactorValue');
  if (hfElement) {
    hfElement.textContent = result.hitFactor.toFixed(4);
  }

  // Breakdown values
  const rawEl = document.getElementById('rawPointsValue');
  const penEl = document.getElementById('penaltiesValue');
  const scoreEl = document.getElementById('scorePointsValue');

  if (rawEl) rawEl.textContent = result.rawPoints.toString();
  if (penEl) penEl.textContent = result.penalties > 0 ? `-${result.penalties}` : '-0';
  if (scoreEl) scoreEl.textContent = result.scorePoints.toString();

  // Counter input values
  for (const [key, val] of Object.entries(appState.counts)) {
    const inputEl = document.getElementById(`input${capitalize(key)}`);
    if (inputEl && parseInt(inputEl.value, 10) !== val) {
      inputEl.value = val;
    }
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// -----------------------------------------------------------------------------
// Form Controls & Interactive Counters
// -----------------------------------------------------------------------------

function adjustCount(type, delta) {
  if (appState.counts[type] !== undefined) {
    const newVal = Math.max(0, appState.counts[type] + delta);
    appState.counts[type] = newVal;
    
    // Audio tone: punchy and distinct for alphas/positive, lower buzzer for penalties
    if (delta > 0) {
      if (type === 'alpha') playAudioTone(880, 'triangle', 0.06, 0.65);
      else if (type === 'charlie') playAudioTone(660, 'triangle', 0.06, 0.6);
      else if (type === 'delta') playAudioTone(520, 'triangle', 0.06, 0.6);
      else playAudioTone(240, 'square', 0.09, 0.75); // Penalties
    } else {
      playAudioTone(400, 'sine', 0.04, 0.5);
    }

    updateDisplay();
  }
}

function onDirectCountChange(type, value) {
  const parsed = parseInt(value, 10);
  appState.counts[type] = isNaN(parsed) || parsed < 0 ? 0 : parsed;
  updateDisplay();
}

function handleTimeChange(rawVal) {
  // Allow empty or partial decimal typing
  let sanitized = rawVal.replace(/[^0-9.]/g, '');
  
  // Prevent multiple decimal points
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = parts[0] + '.' + parts.slice(1).join('');
  }

  const numeric = parseFloat(sanitized);
  appState.time = isNaN(numeric) ? 0 : numeric;
  updateDisplay();
}

// Reset the score form inputs back to default
function resetForm() {
  appState.counts = {
    alpha: 0,
    charlie: 0,
    delta: 0,
    miss: 0,
    noShoot: 0,
    procedural: 0
  };
  appState.time = 0.00;
  
  const timeInput = document.getElementById('timeInput');
  if (timeInput) timeInput.value = '0.00';

  playAudioTone(440, 'triangle', 0.06);
  updateDisplay();
  showToast('Entry cleared to zero.');
}

// -----------------------------------------------------------------------------
// MATCH LOG & SAVED RUNS
// -----------------------------------------------------------------------------

function saveCurrentRun() {
  const result = calculateCurrentRun();
  const shooterInput = document.getElementById('shooterInput');
  const stageInput = document.getElementById('stageInput');
  const divisionSelect = document.getElementById('divisionSelect');

  const shooter = (shooterInput ? shooterInput.value.trim() : '') || 'Competitor';
  const stage = (stageInput ? stageInput.value.trim() : '') || 'Stage 1';
  const division = divisionSelect ? divisionSelect.value : 'Open';

  if (result.time <= 0) {
    showToast('⚠️ Please enter a valid stage time (> 0.00 sec).');
    if (document.getElementById('timeInput')) {
      document.getElementById('timeInput').focus();
    }
    return;
  }

  const runEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    shooter,
    stage,
    division,
    counts: { ...appState.counts },
    rawPoints: result.rawPoints,
    penalties: result.penalties,
    scorePoints: result.scorePoints,
    time: result.time,
    hitFactor: result.hitFactor
  };

  appState.matchRuns.unshift(runEntry);
  saveToLocalStorage();
  renderMatchLog();

  // Audio success sound
  playAudioTone(523.25, 'triangle', 0.08, 0.7);
  setTimeout(() => playAudioTone(659.25, 'triangle', 0.08, 0.7), 80);
  setTimeout(() => playAudioTone(783.99, 'triangle', 0.16, 0.8), 160);

  showToast(`Run saved! Hit Factor: ${result.hitFactor.toFixed(4)}`);

  // Reset counters & time for next run, while keeping shooter name / advancing stage
  resetCountersOnly();
}

function resetCountersOnly() {
  appState.counts = {
    alpha: 0,
    charlie: 0,
    delta: 0,
    miss: 0,
    noShoot: 0,
    procedural: 0
  };
  appState.time = 0.00;
  const timeInput = document.getElementById('timeInput');
  if (timeInput) timeInput.value = '0.00';
  updateDisplay();
}

// Render the Match Log table
function renderMatchLog() {
  const tbody = document.getElementById('matchTableBody');
  const logBottomBar = document.getElementById('logBottomBar');
  const logSummaryText = document.getElementById('logSummaryText');

  if (!tbody) return;

  if (appState.matchRuns.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row" id="emptyStateRow">
        <td colspan="9">No saved runs yet. Enter a score above to start the match log.</td>
      </tr>
    `;
    if (logBottomBar) logBottomBar.style.display = 'none';
    return;
  }

  if (logBottomBar) logBottomBar.style.display = 'flex';
  if (logSummaryText) logSummaryText.textContent = `Total Runs: ${appState.matchRuns.length}`;

  // Find highest hit factor per stage for Stage % calculation
  const stageHighHFs = {};
  appState.matchRuns.forEach(run => {
    const stageKey = run.stage.toLowerCase().trim();
    if (!stageHighHFs[stageKey] || run.hitFactor > stageHighHFs[stageKey]) {
      stageHighHFs[stageKey] = run.hitFactor;
    }
  });

  tbody.innerHTML = appState.matchRuns.map(run => {
    const stageKey = run.stage.toLowerCase().trim();
    const stageMax = stageHighHFs[stageKey] || 0;
    const stagePercent = stageMax > 0 ? ((run.hitFactor / stageMax) * 100).toFixed(2) : '0.00';
    const isWinner = stageMax > 0 && Math.abs(run.hitFactor - stageMax) < 0.0001;

    const breakdownStr = `A:${run.counts.alpha} C:${run.counts.charlie} D:${run.counts.delta} M:${run.counts.miss} NS:${run.counts.noShoot} P:${run.counts.procedural}`;

    return `
      <tr class="${isWinner ? 'winner-row' : ''}">
        <td class="cell-shooter">${escapeHtml(run.shooter)}</td>
        <td class="cell-stage">${escapeHtml(run.stage)}</td>
        <td><span class="division-badge">${escapeHtml(run.division)}</span></td>
        <td class="cell-breakdown">${breakdownStr}</td>
        <td class="cell-points">${run.scorePoints} <span style="font-size:10px; color:#777;">(${run.rawPoints} - ${run.penalties})</span></td>
        <td class="cell-time">${run.time.toFixed(2)}s</td>
        <td class="cell-hf">${run.hitFactor.toFixed(4)}</td>
        <td>
          <span class="stage-percent-badge ${isWinner ? 'winner' : ''}">
            ${isWinner ? '★ 100.00%' : `${stagePercent}%`}
          </span>
        </td>
        <td class="col-actions">
          <button type="button" class="btn-delete-row" title="Delete run" onclick="deleteRun('${run.id}')">
            ✕
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteRun(id) {
  appState.matchRuns = appState.matchRuns.filter(r => r.id !== id);
  saveToLocalStorage();
  renderMatchLog();
  showToast('Run deleted from match log.');
}

function clearMatchLog() {
  if (appState.matchRuns.length === 0) return;
  if (confirm('Are you sure you want to clear all runs from the match log?')) {
    appState.matchRuns = [];
    saveToLocalStorage();
    renderMatchLog();
    showToast('All saved runs cleared.');
  }
}

// -----------------------------------------------------------------------------
// EXPORT & PRINT FEATURES
// -----------------------------------------------------------------------------

function printMatchLog() {
  if (appState.matchRuns.length === 0) {
    showToast('Add at least one run before printing.');
    return;
  }

  const dateEl = document.getElementById('printDate');
  const countEl = document.getElementById('printRunCount');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (countEl) {
    countEl.textContent = `${appState.matchRuns.length} Competitor Run${appState.matchRuns.length > 1 ? 's' : ''}`;
  }

  window.print();
}

function exportCsv() {
  if (appState.matchRuns.length === 0) {
    showToast('No match runs to export.');
    return;
  }

  const headers = [
    'Time', 'Shooter', 'Stage', 'Division',
    'Alpha', 'Charlie', 'Delta', 'Miss', 'NoShoot', 'Procedural',
    'RawPoints', 'Penalties', 'ScorePoints', 'StageTimeSec', 'HitFactor'
  ];

  const rows = appState.matchRuns.map(r => [
    `"${r.timestamp}"`,
    `"${r.shooter.replace(/"/g, '""')}"`,
    `"${r.stage.replace(/"/g, '""')}"`,
    `"${r.division}"`,
    r.counts.alpha,
    r.counts.charlie,
    r.counts.delta,
    r.counts.miss,
    r.counts.noShoot,
    r.counts.procedural,
    r.rawPoints,
    r.penalties,
    r.scorePoints,
    r.time.toFixed(2),
    r.hitFactor.toFixed(4)
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `WarDaddy_IPSC_MatchLog_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Match Log exported to CSV.');
}

// -----------------------------------------------------------------------------
// RANGE STOPWATCH / TIMER WIDGET
// -----------------------------------------------------------------------------

function toggleStopwatchWidget() {
  const widget = document.getElementById('stopwatchWidget');
  if (widget) {
    widget.classList.toggle('hidden');
    playAudioTone(500, 'sine', 0.03);
  }
}

function formatStopwatchTime(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2);
  const paddedMin = minutes.toString().padStart(2, '0');
  const paddedSec = parseFloat(seconds) < 10 ? '0' + seconds : seconds;
  return `${paddedMin}:${paddedSec}`;
}

function toggleStopwatch() {
  const startBtn = document.getElementById('swStartBtn');
  const display = document.getElementById('stopwatchDisplay');

  if (!stopwatchRunning) {
    // Start
    stopwatchRunning = true;
    stopwatchStartTime = performance.now() - stopwatchElapsedTime;
    startBtn.textContent = 'STOP';
    startBtn.style.backgroundColor = '#b51219';

    // Loud IPSC Competition Start Buzzer Signal!
    playCompetitionBuzzer();

    stopwatchTimer = requestAnimationFrame(updateStopwatch);
  } else {
    // Stop
    stopwatchRunning = false;
    cancelAnimationFrame(stopwatchTimer);
    startBtn.textContent = 'START';
    startBtn.style.backgroundColor = '';

    // Loud stop signal
    playStopBeep();
  }
}

function testBuzzerAudio() {
  playCompetitionBuzzer();
  showToast('📢 LOUD IPSC MATCH BUZZER TRIGGERED');
}

function updateStopwatch() {
  if (!stopwatchRunning) return;
  stopwatchElapsedTime = performance.now() - stopwatchStartTime;
  const display = document.getElementById('stopwatchDisplay');
  if (display) {
    display.textContent = formatStopwatchTime(stopwatchElapsedTime);
  }
  stopwatchTimer = requestAnimationFrame(updateStopwatch);
}

function resetStopwatch() {
  stopwatchRunning = false;
  cancelAnimationFrame(stopwatchTimer);
  stopwatchElapsedTime = 0;
  const startBtn = document.getElementById('swStartBtn');
  const display = document.getElementById('stopwatchDisplay');
  if (startBtn) {
    startBtn.textContent = 'START';
    startBtn.style.backgroundColor = '';
  }
  if (display) {
    display.textContent = '00:00.00';
  }
  playAudioTone(440, 'triangle', 0.05, 0.4);
}

function applyStopwatchTime() {
  const totalSeconds = (stopwatchElapsedTime / 1000).toFixed(2);
  const timeInput = document.getElementById('timeInput');
  if (timeInput) {
    timeInput.value = totalSeconds;
    handleTimeChange(totalSeconds);
    showToast(`Timer applied: ${totalSeconds} sec`);
    playAudioTone(880, 'sine', 0.08, 0.6);
  }
}

// -----------------------------------------------------------------------------
// UTILITIES & PERSISTENCE
// -----------------------------------------------------------------------------

function cycleVolumeMode() {
  if (volumeMode === 'MAX') {
    volumeMode = 'HIGH';
    volumeMultiplier = 0.65;
    appState.audioEnabled = true;
  } else if (volumeMode === 'HIGH') {
    volumeMode = 'OFF';
    volumeMultiplier = 0.0;
    appState.audioEnabled = false;
  } else {
    volumeMode = 'MAX';
    volumeMultiplier = 1.0;
    appState.audioEnabled = true;
  }
  updateVolumeUI();
  if (appState.audioEnabled) {
    playCompetitionBuzzer();
  }
  showToast(`Buzzer Volume: ${volumeMode === 'MAX' ? 'MAX (RANGE MODE)' : volumeMode}`);
}

function updateVolumeUI() {
  const volText = document.getElementById('volumeModeText');
  const soundText = document.getElementById('soundStatusText');
  const soundIcon = document.getElementById('soundIcon');

  if (volText) {
    volText.textContent = volumeMode === 'MAX' ? 'MAX (RANGE)' : (volumeMode === 'HIGH' ? 'HIGH' : 'OFF');
    volText.style.color = volumeMode === 'MAX' ? 'var(--red-primary)' : (volumeMode === 'HIGH' ? '#ffaa00' : '#888');
  }
  if (soundText) soundText.textContent = appState.audioEnabled ? 'ON' : 'OFF';
  if (soundIcon) soundIcon.textContent = appState.audioEnabled ? '🔊' : '🔇';
}

function toggleSound() {
  if (appState.audioEnabled) {
    appState.audioEnabled = false;
    volumeMultiplier = 0.0;
    volumeMode = 'OFF';
  } else {
    appState.audioEnabled = true;
    volumeMultiplier = 1.0;
    volumeMode = 'MAX';
    playCompetitionBuzzer();
  }
  updateVolumeUI();
}

function showToast(message) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2800);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

function saveToLocalStorage() {
  try {
    localStorage.setItem('wardaddy_match_runs', JSON.stringify(appState.matchRuns));
  } catch (e) {
    // LocalStorage quota or access issue
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('wardaddy_match_runs');
    if (raw) {
      appState.matchRuns = JSON.parse(raw);
    }
  } catch (e) {
    appState.matchRuns = [];
  }
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();

  // Attach Time Input Listener
  const timeInput = document.getElementById('timeInput');
  if (timeInput) {
    timeInput.addEventListener('input', (e) => handleTimeChange(e.target.value));
    timeInput.addEventListener('focus', function() {
      if (this.value === '0.00' || this.value === '0') {
        this.select();
      }
    });
  }

  // Attach Stopwatch Toggle Listener
  const swBtn = document.getElementById('stopwatchToggleBtn');
  if (swBtn) {
    swBtn.addEventListener('click', toggleStopwatchWidget);
  }

  // Keyboard navigation shortcuts
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts if active in text input
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

    if (e.key === 'a' || e.key === 'A') adjustCount('alpha', 1);
    if (e.key === 'c' || e.key === 'C') adjustCount('charlie', 1);
    if (e.key === 'd' || e.key === 'D') adjustCount('delta', 1);
    if (e.key === 'm' || e.key === 'M') adjustCount('miss', 1);
    if (e.key === 'n' || e.key === 'N') adjustCount('noShoot', 1);
    if (e.key === 'p' || e.key === 'P') adjustCount('procedural', 1);
    if (e.key === 'Enter') saveCurrentRun();
  });

  // Render initial display
  updateDisplay();
  renderMatchLog();
});
