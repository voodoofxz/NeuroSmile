// Facial symmetry analysis from MediaPipe Face Landmarker output.
// Everything here is pure math so it can run (and be tested) without a camera.

// MediaPipe face-mesh landmark indices. Pairs are resolved to the person's own
// right/left at runtime by x-position, so we never depend on mesh handedness.
const EYE_A = { corners: [33, 133], upper: 159, lower: 145 };
const EYE_B = { corners: [362, 263], upper: 386, lower: 374 };
const MOUTH_CORNERS = [61, 291];
const BROW_A = [70, 63, 105, 66, 107];
const BROW_B = [336, 296, 334, 293, 300];
const NOSE_TIP = 1;
const CHEEKS = [234, 454];

export const POSES = [
  {
    key: 'rest',
    title: 'Relaxed face',
    instruction: 'Let your face rest. Look straight at the camera, lips gently closed.',
    weight: 0.2,
  },
  {
    key: 'smile',
    title: 'Big smile',
    instruction: 'Smile as wide as you comfortably can, showing your teeth. No straining.',
    weight: 0.35,
  },
  {
    key: 'brows',
    title: 'Raise eyebrows',
    instruction: 'Lift both eyebrows up, like you are surprised.',
    weight: 0.2,
  },
  {
    key: 'eyes',
    title: 'Close eyes gently',
    instruction: 'After you tap Capture you’ll hear 3 beeps. Close both eyes gently on the last one, and open them at the double beep.',
    weight: 0.25,
  },
];

const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Rotate/scale landmarks into a face frame: eye-centers on the x-axis, midpoint at
// the origin, inter-eye distance = 1. Removes head tilt, distance and resolution.
export function normalize(landmarks, width, height) {
  const px = landmarks.map((p) => ({ x: p.x * width, y: p.y * height }));
  const center = (ids) => ({ x: avg(ids.map((i) => px[i].x)), y: avg(ids.map((i) => px[i].y)) });
  let e1 = center(EYE_A.corners);
  let e2 = center(EYE_B.corners);
  if (e1.x > e2.x) [e1, e2] = [e2, e1];
  const mid = { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 };
  const angle = Math.atan2(e2.y - e1.y, e2.x - e1.x);
  const scale = dist(e1, e2);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const pts = px.map((p) => {
    const dx = p.x - mid.x;
    const dy = p.y - mid.y;
    return { x: (dx * cos - dy * sin) / scale, y: (dx * sin + dy * cos) / scale };
  });
  return { pts, eyeDistancePx: scale, rollDeg: (angle * 180) / Math.PI };
}

// In the un-mirrored camera image the person's RIGHT side has the smaller x.
function bySide(a, b, xOf) {
  return xOf(a) < xOf(b) ? { right: a, left: b } : { right: b, left: a };
}

// Geometric features for a single frame (all in inter-eye-distance units).
export function frameFeatures(pts) {
  const eyes = bySide(EYE_A, EYE_B, (e) => pts[e.corners[0]].x);
  const brows = bySide(BROW_A, BROW_B, (b) => pts[b[2]].x);
  const mouth = bySide(MOUTH_CORNERS[0], MOUTH_CORNERS[1], (i) => pts[i].x);
  const side = (s) => ({
    eyeOpen: dist(pts[eyes[s].upper], pts[eyes[s].lower]),
    browY: avg(brows[s].map((i) => pts[i].y)),
    mouthX: pts[mouth[s]].x,
    mouthY: pts[mouth[s]].y,
  });
  const cheeks = bySide(CHEEKS[0], CHEEKS[1], (i) => pts[i].x);
  const nose = pts[NOSE_TIP];
  // ~1.0 when facing the camera; drifts away when the head is turned.
  const yaw = dist(nose, pts[cheeks.right]) / Math.max(1e-6, dist(nose, pts[cheeks.left]));
  return { right: side('right'), left: side('left'), yaw };
}

// Average per-frame features (and blendshape scores) captured while holding a pose.
export function averageFrames(frames) {
  const sides = ['right', 'left'];
  const keys = ['eyeOpen', 'browY', 'mouthX', 'mouthY'];
  const out = { right: {}, left: {}, yaw: avg(frames.map((f) => f.features.yaw)), blend: {} };
  for (const s of sides) for (const k of keys) out[s][k] = avg(frames.map((f) => f.features[s][k]));
  const names = new Set(frames.flatMap((f) => Object.keys(f.blend || {})));
  for (const n of names) out.blend[n] = avg(frames.map((f) => f.blend?.[n] ?? 0));
  return out;
}

// weaker ÷ stronger movement, 0..1. Both sides barely moving reads as symmetric.
function ratio(a, b) {
  const hi = Math.max(a, b);
  if (hi < 1e-6) return 1;
  return clamp(Math.min(a, b) / hi, 0, 1);
}

function weakerSide(right, left) {
  return right < left ? 'right' : 'left';
}

// MediaPipe blendshape left/right naming follows the image, not the person, on some
// builds - we only ever use the min/max ratio, so handedness does not matter.
function blendRatio(blend, base) {
  const a = blend[`${base}Left`] ?? 0;
  const b = blend[`${base}Right`] ?? 0;
  if (Math.max(a, b) < 0.05) return null;
  return ratio(a, b);
}

const mix = (geo, blend) => (blend == null ? geo : 0.7 * geo + 0.3 * blend);

// Below these, neither side really moved, so any left/right "ratio" is just
// camera noise. A genuinely weak side still passes because the stronger side moves.
const MIN_MOVEMENT = { smile: 0.04, brows: 0.02, eyes: 0.3 };

// Per-side movement for an expression, measured from the relaxed capture.
export function poseMovement(key, rest, cap) {
  const side = {
    smile: (s) => Math.hypot(cap[s].mouthX - rest[s].mouthX, cap[s].mouthY - rest[s].mouthY),
    brows: (s) => Math.max(0, rest[s].browY - cap[s].browY), // y grows downward
    eyes: (s) => clamp((rest[s].eyeOpen - cap[s].eyeOpen) / Math.max(1e-6, rest[s].eyeOpen), 0, 1),
  }[key];
  const right = side('right');
  const left = side('left');
  return { right, left, enough: Math.max(right, left) >= MIN_MOVEMENT[key] };
}

// Score a full check-in. `caps` = { rest, smile, brows, eyes } averaged captures.
// An expression with too little movement to measure gets score: null and is left
// out of the overall score instead of being scored from noise.
export function scoreCheckIn(caps) {
  const { rest, smile, brows, eyes } = caps;
  const poses = {};

  // Rest: mouth corner height difference and eye-opening balance.
  const droop = Math.abs(rest.right.mouthY - rest.left.mouthY);
  const restEye = ratio(rest.right.eyeOpen, rest.left.eyeOpen);
  poses.rest = {
    score: 100 * (0.6 * clamp(1 - droop / 0.15, 0, 1) + 0.4 * restEye),
    movementRatio: null,
    weaker: rest.right.mouthY > rest.left.mouthY ? 'right' : 'left',
    detail: { mouthCornerDifference: droop, eyeOpeningRatio: restEye },
  };

  // Smile: how far each mouth corner travels. Brows: how far each brow lifts.
  // Eyes: fraction of the rest opening that closes.
  const moving = [
    ['smile', smile, 'mouthSmile'],
    ['brows', brows, 'browOuterUp'],
    ['eyes', eyes, 'eyeBlink'],
  ];
  for (const [key, cap, blendKey] of moving) {
    const m = poseMovement(key, rest, cap);
    const geo = ratio(m.right, m.left);
    poses[key] = m.enough
      ? { score: 100 * mix(geo, blendRatio(cap.blend, blendKey)), movementRatio: geo, weaker: weakerSide(m.right, m.left) }
      : { score: null, movementRatio: null, weaker: null, lowEffort: true };
    if (key === 'eyes') poses[key].closure = { right: m.right, left: m.left };
  }

  // Overall = weighted average of the measured expressions.
  let total = 0;
  let weight = 0;
  const votes = { right: 0, left: 0 };
  for (const p of POSES) {
    const pose = poses[p.key];
    if (pose.score == null) continue;
    pose.score = Math.round(pose.score);
    total += pose.score * p.weight;
    weight += p.weight;
    votes[pose.weaker] += p.weight * (100 - pose.score);
  }
  return {
    overall: Math.round(total / weight),
    poses,
    weakerSide: votes.right >= votes.left ? 'right' : 'left',
  };
}

// Live framing guidance for the camera screen.
export function framingHint(norm, features, videoWidth) {
  if (!norm) return { ok: false, text: 'Looking for your face…' };
  const size = norm.eyeDistancePx / videoWidth;
  if (size < 0.12) return { ok: false, text: 'Move a little closer' };
  if (size > 0.4) return { ok: false, text: 'Move back a little' };
  if (features.yaw < 0.8 || features.yaw > 1.25) return { ok: false, text: 'Turn to face the camera straight on' };
  if (Math.abs(norm.rollDeg) > 12) return { ok: false, text: 'Hold your head level' };
  return { ok: true, text: 'Great — hold steady' };
}

// Score change between two check-ins, counting only the expressions measured in
// both, so a check-in with an unmeasured movement isn't compared unfairly.
// Equals to.overall - from.overall whenever both were fully measured.
export function scoreChange(from, to) {
  let a = 0;
  let b = 0;
  let w = 0;
  for (const p of POSES) {
    const x = from?.poses?.[p.key]?.score;
    const y = to?.poses?.[p.key]?.score;
    if (x == null || y == null) continue;
    a += x * p.weight;
    b += y * p.weight;
    w += p.weight;
  }
  return w ? Math.round(b / w) - Math.round(a / w) : 0;
}
