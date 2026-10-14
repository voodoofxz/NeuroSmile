import { POSES, normalize, frameFeatures, averageFrames, scoreCheckIn, framingHint } from './analysis.js';
import * as db from './storage.js';
import { calmReminder, encouragement, poseImprovementNote, EYE_CARE_TIP } from './messages.js';
import { renderChart } from './chart.js';

const MP_VERSION = '0.10.14';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const FRAMES_PER_POSE = 20;
const PHOTO_WIDTH = 480;

const $ = (id) => document.getElementById(id);
const sideName = (s) => (s === 'left' ? 'your left' : 'your right');
const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

let objectUrls = [];
function blobUrl(blob) {
  if (!blob) return '';
  const u = URL.createObjectURL(blob);
  objectUrls.push(u);
  return u;
}
function releaseUrls() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls = [];
}

function toast(text, ms = 2600) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), ms);
}

// ---------------------------------------------------------------- routing

const VIEWS = ['home', 'checkin', 'result', 'history', 'detail', 'breathe', 'settings', 'about'];

function go(view) {
  location.hash = view === 'home' ? '' : view;
}

async function route() {
  const [view = 'home', arg] = location.hash.replace(/^#/, '').split('/');
  const name = VIEWS.includes(view) ? view : 'home';
  if (name !== 'checkin') stopCamera();
  if (name !== 'breathe') stopBreathing();
  releaseUrls();
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== name;
  window.scrollTo(0, 0);
  const render = { home: renderHome, checkin: startCheckIn, result: renderResult, history: renderHistory,
    detail: () => renderDetail(Number(arg)), breathe: renderBreathe, settings: renderSettings, about: renderAbout };
  await render[name]?.();
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-go]');
  if (target) go(target.dataset.go);
});
window.addEventListener('hashchange', route);

// ---------------------------------------------------------------- home

async function renderHome() {
  $('calm-text').textContent = calmReminder();
  const [list, onset] = await Promise.all([db.listCheckIns(), db.getSetting('onset')]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const counter = $('day-counter');
  if (onset) {
    const days = Math.max(1, Math.floor((Date.now() - new Date(onset + 'T00:00').getTime()) / 864e5) + 1);
    counter.textContent = `${greeting} 🌿 Day ${days} of your recovery`;
  } else {
    counter.textContent = `${greeting} 🌿 Every check-in is a step forward`;
  }

  const last = list.at(-1);
  $('last-card').hidden = !last;
  if (!last) return;
  $('last-score').textContent = last.overall;
  const base = list[0];
  const d = $('last-delta');
  if (list.length > 1) {
    const fromBase = last.overall - base.overall;
    d.textContent = `${signed(fromBase)} since you started`;
    d.className = `delta ${fromBase > 0 ? 'up' : 'down'}`;
  } else {
    d.textContent = 'Your baseline';
    d.className = 'delta';
  }
  const today = new Date().toDateString() === new Date(last.date).toDateString();
  $('last-meta').textContent = today
    ? `Checked in today at ${fmtTime(last.date)}. See you tomorrow!`
    : `Last check-in ${fmtDate(last.date)}. Ready when you are.`;
}

// ---------------------------------------------------------------- face landmarker

let landmarkerPromise;
function getLandmarker() {
  landmarkerPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import(`${MP_BASE}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
    try {
      return await FaceLandmarker.createFromOptions(fileset, opts('GPU'));
    } catch {
      return await FaceLandmarker.createFromOptions(fileset, opts('CPU'));
    }
  })();
  landmarkerPromise.catch(() => (landmarkerPromise = null));
  return landmarkerPromise;
}

// ---------------------------------------------------------------- check-in

const session = {
  stream: null,
  raf: 0,
  poseIndex: 0,
  caps: {},
  photos: {},
  collecting: null, // array while capturing frames
  latest: null, // last frame result
  busy: false,
};

function stopCamera() {
  cancelAnimationFrame(session.raf);
  session.raf = 0;
  session.stream?.getTracks().forEach((t) => t.stop());
  session.stream = null;
  session.collecting = null;
  session.busy = false;
}

async function startCheckIn() {
  Object.assign(session, { poseIndex: 0, caps: {}, photos: {}, latest: null, busy: false });
  renderPoseStep();
  const loading = $('cam-loading');
  loading.hidden = false;
  loading.textContent = 'Starting camera…';
  $('capture-btn').disabled = true;

  try {
    session.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } },
      audio: false,
    });
  } catch (err) {
    loading.textContent = 'Camera access is needed for check-ins. Please allow the camera in your browser settings and try again.';
    return;
  }
  const video = $('video');
  video.srcObject = session.stream;
  await video.play().catch(() => {});

  loading.textContent = 'Loading face analysis (first time only)…';
  let landmarker;
  try {
    landmarker = await getLandmarker();
  } catch {
    loading.textContent = 'Couldn’t load face analysis. Connect to the internet once so it can download, then try again.';
    return;
  }
  if (!session.stream) return; // user cancelled while loading
  loading.hidden = true;
  loop(landmarker);
}

function loop(landmarker) {
  const video = $('video');
  const overlay = $('overlay');
  const ctx = overlay.getContext('2d');
  let lastTime = -1;

  const tick = () => {
    if (!session.stream) return;
    session.raf = requestAnimationFrame(tick);
    if (video.readyState < 2 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (overlay.width !== w) [overlay.width, overlay.height] = [w, h];

    const res = landmarker.detectForVideo(video, performance.now());
    const lm = res.faceLandmarks?.[0];
    ctx.clearRect(0, 0, w, h);
    if (!lm) {
      session.latest = null;
      updateHint(framingHint(null));
      return;
    }
    const norm = normalize(lm, w, h);
    const features = frameFeatures(norm.pts);
    const blend = Object.fromEntries((res.faceBlendshapes?.[0]?.categories || []).map((c) => [c.categoryName, c.score]));
    session.latest = { features, blend };
    if (session.collecting) session.collecting.push({ features, blend });

    ctx.fillStyle = 'rgba(120, 220, 170, 0.85)';
    for (const i of [33, 133, 159, 145, 362, 263, 386, 374, 61, 291, 105, 334, 1]) {
      ctx.beginPath();
      ctx.arc(lm[i].x * w, lm[i].y * h, Math.max(2, w / 220), 0, Math.PI * 2);
      ctx.fill();
    }
    updateHint(framingHint(norm, features, w));
  };
  tick();
}

function updateHint(h) {
  if (session.busy) return;
  const hint = $('hint');
  hint.textContent = h.text;
  hint.classList.toggle('ok', h.ok);
  document.querySelector('.camera-wrap').classList.toggle('ok', h.ok);
  $('capture-btn').disabled = !session.latest;
}

function renderPoseStep() {
  const pose = POSES[session.poseIndex];
  $('pose-title').textContent = `${session.poseIndex + 1} of ${POSES.length}: ${pose.title}`;
  $('pose-instruction').textContent = pose.instruction;
  $('steps').innerHTML = POSES.map((_, i) =>
    `<li class="${i < session.poseIndex ? 'done' : i === session.poseIndex ? 'current' : ''}"></li>`).join('');
  $('capture-btn').textContent = 'Capture';
}

let audioCtx;
function beep(freq = 660, ms = 140) {
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.15;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* no audio */ }
  navigator.vibrate?.(ms);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function snapshot() {
  const video = $('video');
  const scale = PHOTO_WIDTH / video.videoWidth;
  const c = document.createElement('canvas');
  c.width = PHOTO_WIDTH;
  c.height = Math.round(video.videoHeight * scale);
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0); // save mirrored, the way the user sees themselves
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
}

async function capturePose() {
  if (session.busy) return;
  session.busy = true;
  const pose = POSES[session.poseIndex];
  const btn = $('capture-btn');
  const cd = $('countdown');
  btn.disabled = true;
  $('hint').textContent = pose.key === 'eyes' ? 'Listen for the beeps…' : 'Hold the expression…';

  cd.hidden = false;
  for (let n = 3; n >= 1; n--) {
    cd.textContent = n;
    beep(n === 1 ? 880 : 660);
    await wait(900);
  }
  cd.textContent = '';
  if (pose.key === 'eyes') await wait(500); // give the eyelids time to settle

  session.collecting = [];
  const started = performance.now();
  let photo = null;
  while (session.collecting && session.collecting.length < FRAMES_PER_POSE && performance.now() - started < 4000) {
    if (!photo && session.collecting.length >= FRAMES_PER_POSE / 2) photo = snapshot();
    await wait(30);
  }
  const frames = session.collecting;
  session.collecting = null;
  cd.hidden = true;
  if (!session.stream) return; // cancelled
  if (pose.key === 'eyes') { beep(880, 100); await wait(160); beep(880, 100); }

  if (!frames || frames.length < 6) {
    session.busy = false;
    toast('We lost sight of your face — let’s try that one again.');
    return;
  }
  session.caps[pose.key] = averageFrames(frames);
  session.photos[pose.key] = await (photo ?? snapshot());
  session.busy = false;
  session.poseIndex++;

  if (session.poseIndex < POSES.length) {
    renderPoseStep();
    toast('Got it ✓', 1200);
  } else {
    await finishCheckIn();
  }
}

let lastResult = null;

async function finishCheckIn() {
  stopCamera();
  const previous = await db.listCheckIns();
  const score = scoreCheckIn(session.caps);
  const record = { date: Date.now(), ...score, photos: session.photos, note: '' };
  record.id = await db.addCheckIn(record);
  lastResult = { record, previous };
  go('result');
}

$('capture-btn').addEventListener('click', capturePose);
$('cancel-checkin').addEventListener('click', () => go('home'));

// ---------------------------------------------------------------- result

function poseRows(rec) {
  return POSES.map((p) => {
    const r = rec.poses[p.key];
    let sub;
    if (p.key === 'rest') {
      sub = r.score >= 95 ? 'Your face looks balanced at rest.' : `Resting balance. ${cap(sideName(r.weaker))} side sits a little lower.`;
    } else if (r.movementRatio != null && r.score < 97) {
      sub = `${cap(sideName(r.weaker))} side is moving at about ${Math.round(r.movementRatio * 100)}% of the other side.`;
    } else {
      sub = 'Both sides moving evenly.';
    }
    if (r.lowEffort) sub += ' (Small movement captured — a little bigger next time if comfortable.)';
    return `<div class="pose-row">
      <div class="pose-head"><span>${p.title}</span><span class="val">${r.score}</span></div>
      <div class="bar"><span style="width:${r.score}%"></span></div>
      <p class="pose-sub">${sub}</p></div>`;
  }).join('');
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function compareChips(rec, list) {
  const idx = list.findIndex((r) => r.id === rec.id);
  const prev = idx > 0 ? list[idx - 1] : null;
  const base = list[0] && list[0].id !== rec.id ? list[0] : null;
  const chip = (label, d) => `<span class="chip ${d > 0 ? 'up' : ''}">${signed(d)} ${label}</span>`;
  return [prev && chip('vs. previous', rec.overall - prev.overall), base && chip('since first check-in', rec.overall - base.overall)]
    .filter(Boolean).join('') || '<span class="chip">Baseline check-in</span>';
}

function renderResult() {
  if (!lastResult) return go('home');
  const { record: rec, previous } = lastResult;
  const prev = previous.at(-1);
  const base = previous[0];
  const msg = encouragement({
    isFirst: !prev,
    delta: prev ? rec.overall - prev.overall : 0,
    fromBaseline: base ? rec.overall - base.overall : 0,
  });
  $('encourage-card').className = `card encourage tone-${msg.tone}`;
  $('encourage-title').textContent = msg.title;
  $('encourage-body').textContent = msg.body;
  $('res-score').textContent = rec.overall;
  $('res-compare').innerHTML = compareChips(rec, [...previous, rec]);
  $('res-poses').innerHTML = poseRows(rec);
  $('res-wins').innerHTML = base
    ? POSES.map((p) => poseImprovementNote(p.title, rec.poses[p.key].score, base.poses[p.key].score))
      .filter(Boolean).map((t) => `<li>${t}</li>`).join('')
    : '';
  $('res-note').value = '';
  $('res-calm').textContent = calmReminder();
}

$('res-done').addEventListener('click', async () => {
  if (lastResult) {
    const note = $('res-note').value.trim();
    if (note) await db.updateCheckIn({ ...lastResult.record, note });
    lastResult = null;
  }
  toast('Saved on this phone ✓');
  go('home');
});

// ---------------------------------------------------------------- history

async function renderHistory() {
  const list = await db.listCheckIns();
  $('history-empty').hidden = list.length > 0;
  $('chart-card').hidden = list.length < 2;
  $('compare-card').hidden = list.length < 2;

  if (list.length >= 2) {
    renderChart($('chart'), list.map((r) => ({ id: r.id, date: r.date, value: r.overall })), (id) => go(`detail/${id}`));
    const first = list[0];
    const last = list.at(-1);
    $('cmp-first').src = blobUrl(first.photos?.smile);
    $('cmp-last').src = blobUrl(last.photos?.smile);
    $('cmp-first-cap').textContent = `${fmtDate(first.date)} · ${first.overall}`;
    $('cmp-last-cap').textContent = `${fmtDate(last.date)} · ${last.overall}`;
  }

  $('history-list').innerHTML = list.slice().reverse().map((r, i, arr) => {
    const prev = arr[i + 1];
    const d = prev ? r.overall - prev.overall : null;
    return `<button class="history-item" data-go="detail/${r.id}">
      <img src="${blobUrl(r.photos?.smile)}" alt="" />
      <div class="meta"><div class="date">${fmtDate(r.date)}</div>
        <div class="note">${r.note ? escapeHtml(r.note) : fmtTime(r.date)}</div></div>
      <div class="score">${r.overall}${d == null ? '<small class="muted">baseline</small>'
        : `<small class="delta ${d > 0 ? 'up' : 'down'}">${signed(d)}</small>`}</div>
    </button>`;
  }).join('');
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------------------------------------------------------------- detail

let detailId = null;
async function renderDetail(id) {
  const [rec, list] = await Promise.all([db.getCheckIn(id), db.listCheckIns()]);
  if (!rec) return go('history');
  detailId = id;
  $('detail-title').textContent = `${fmtDate(rec.date)}, ${fmtTime(rec.date)}`;
  $('detail-score').textContent = rec.overall;
  $('detail-compare').innerHTML = compareChips(rec, list);
  $('detail-photos').innerHTML = POSES.map((p) =>
    `<figure><img src="${blobUrl(rec.photos?.[p.key])}" alt="${p.title}" /><figcaption>${p.title} · ${rec.poses[p.key].score}</figcaption></figure>`).join('');
  $('detail-poses').innerHTML = poseRows(rec);
  $('detail-note-card').hidden = !rec.note;
  $('detail-note').textContent = rec.note || '';
}

$('detail-delete').addEventListener('click', async () => {
  if (detailId == null || !confirm('Delete this check-in and its photos? This can’t be undone.')) return;
  await db.deleteCheckIn(detailId);
  toast('Check-in deleted');
  go('history');
});

// ---------------------------------------------------------------- breathe

let breatheTimer = null;
function renderBreathe() {
  $('breathe-calm').textContent = calmReminder();
  $('breathe-text').textContent = 'Tap to begin';
  $('breathe-circle').style.transform = 'scale(0.7)';
}
function stopBreathing() {
  clearTimeout(breatheTimer);
  breatheTimer = null;
}
$('breathe-circle').addEventListener('click', () => {
  if (breatheTimer) {
    stopBreathing();
    renderBreathe();
    return;
  }
  const circle = $('breathe-circle');
  const text = $('breathe-text');
  const phases = [
    ['Breathe in…', 4000, 1],
    ['Hold…', 2000, 1],
    ['Breathe out…', 6000, 0.7],
  ];
  let i = 0;
  const step = () => {
    const [label, ms, scale] = phases[i % phases.length];
    text.textContent = label;
    circle.style.transitionDuration = `${ms}ms`;
    circle.style.transform = `scale(${scale})`;
    i++;
    breatheTimer = setTimeout(step, ms);
  };
  step();
});

// ---------------------------------------------------------------- theme

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function getTheme() {
  try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; }
}

function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.dataset.theme = choice;
  else delete root.dataset.theme;
  // Keep the phone's status bar color in step with the page.
  const dark = choice === 'dark' || (choice === 'auto' && darkQuery.matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0f1716' : '#2f6f6a';
  document.querySelectorAll('[data-theme-choice]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.themeChoice === choice)));
}

$('theme-picker').addEventListener('click', (e) => {
  const choice = e.target.closest('[data-theme-choice]')?.dataset.themeChoice;
  if (!choice) return;
  try { localStorage.setItem('theme', choice); } catch { /* still applies for this visit */ }
  applyTheme(choice);
});
darkQuery.addEventListener('change', () => applyTheme(getTheme()));

// ---------------------------------------------------------------- settings

async function renderSettings() {
  $('onset').value = (await db.getSetting('onset')) || '';
  $('remind-time').value = (await db.getSetting('remindTime')) || '09:00';
}

$('onset').addEventListener('change', async (e) => {
  await db.setSetting('onset', e.target.value || null);
  toast('Saved');
});

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

$('remind-btn').addEventListener('click', async () => {
  const time = $('remind-time').value || '09:00';
  await db.setSetting('remindTime', time);
  const [hh, mm] = time.split(':');
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Smile Again//EN', 'BEGIN:VEVENT',
    `UID:smile-again-daily-${Date.now()}@local`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${ymd}T${hh}${mm}00`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
    'SUMMARY:Smile Again check-in 🌿',
    'DESCRIPTION:A quick 1-minute check-in. Breathe\\, be patient\\, this is temporary.',
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Time for your Smile Again check-in', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  download('smile-again-reminder.ics', new Blob([ics], { type: 'text/calendar' }));
  toast('Open the file to add it to your calendar');
});

const blobToDataUrl = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

$('export-btn').addEventListener('click', async () => {
  const list = await db.listCheckIns();
  const out = [];
  for (const r of list) {
    const photos = {};
    for (const [k, b] of Object.entries(r.photos || {})) if (b) photos[k] = await blobToDataUrl(b);
    out.push({ ...r, date: new Date(r.date).toISOString(), photos });
  }
  const payload = { app: 'smile-again', exported: new Date().toISOString(), onset: await db.getSetting('onset'), checkIns: out };
  download(`smile-again-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
});

$('wipe-btn').addEventListener('click', async () => {
  if (!confirm('Delete ALL check-ins and photos from this phone? This can’t be undone.')) return;
  await db.clearAll();
  toast('All data deleted');
  go('home');
});

function renderAbout() {
  $('eye-tip').textContent = EYE_CARE_TIP;
}

// ---------------------------------------------------------------- boot

applyTheme(getTheme());
db.requestPersistence();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
route();
