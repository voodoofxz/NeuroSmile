// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, frameFeatures, averageFrames, scoreCheckIn } from '../js/analysis.js';

// Synthetic face in normalized image coords (un-mirrored: person's right = small x).
// Each side can be given its own mouth/brow/eye movement.
function face({ smile = [0, 0], brow = [0, 0], eye = [1, 1], droop = 0, tilt = 0 } = {}) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i, x, y) => (lm[i] = { x, y });
  const s = [{ dx: -1, k: 0 }, { dx: 1, k: 1 }]; // person's right, person's left
  const [eyeR, eyeL] = [{ c: [33, 133], u: 159, l: 145, b: [70, 63, 105, 66, 107] }, { c: [362, 263], u: 386, l: 374, b: [336, 296, 334, 293, 300] }];
  for (const { dx, k } of s) {
    const e = k === 0 ? eyeR : eyeL;
    const cx = 0.5 + dx * 0.1;
    set(e.c[0], cx - 0.03, 0.4);
    set(e.c[1], cx + 0.03, 0.4);
    set(e.u, cx, 0.4 - 0.012 * eye[k]);
    set(e.l, cx, 0.4 + 0.012 * eye[k]);
    for (const i of e.b) set(i, cx, 0.36 - brow[k]);
    const corner = k === 0 ? 61 : 291;
    set(corner, 0.5 + dx * (0.07 + smile[k]), 0.6 - smile[k] * 0.5 + (k === 1 ? droop : 0));
  }
  set(1, 0.5, 0.5);
  set(234, 0.35, 0.5);
  set(454, 0.65, 0.5);
  if (tilt) {
    const a = tilt;
    for (const p of lm) {
      const x = p.x - 0.5, y = p.y - 0.5;
      p.x = 0.5 + x * Math.cos(a) - y * Math.sin(a);
      p.y = 0.5 + x * Math.sin(a) + y * Math.cos(a);
    }
  }
  return lm;
}

const cap = (opts) => {
  const lm = face(opts);
  const f = frameFeatures(normalize(lm, 1000, 1000).pts);
  return averageFrames([{ features: f, blend: {} }]);
};

const checkIn = (o = {}) => scoreCheckIn({
  rest: cap({ droop: o.droop ?? 0 }),
  smile: cap({ smile: o.smile ?? [0.03, 0.03], droop: o.droop ?? 0 }),
  brows: cap({ brow: o.brow ?? [0.02, 0.02] }),
  eyes: cap({ eye: o.eye ?? [0, 0] }),
});

test('symmetric face scores ~100', () => {
  const r = checkIn();
  assert.ok(r.overall >= 98, `got ${r.overall}`);
});

test('weak left side lowers the score and is identified', () => {
  const r = checkIn({ smile: [0.03, 0.01], brow: [0.02, 0.004], eye: [0, 0.6], droop: 0.01 });
  assert.ok(r.overall < 60, `got ${r.overall}`);
  assert.equal(r.weakerSide, 'left');
  assert.equal(r.poses.smile.weaker, 'left');
  assert.ok(Math.abs(r.poses.smile.movementRatio - 1 / 3) < 0.05);
});

test('recovery shows as a higher score', () => {
  const before = checkIn({ smile: [0.03, 0.01], brow: [0.02, 0.005], eye: [0, 0.6] });
  const after = checkIn({ smile: [0.03, 0.02], brow: [0.02, 0.012], eye: [0, 0.3] });
  assert.ok(after.overall > before.overall + 10, `${before.overall} -> ${after.overall}`);
});

test('head tilt does not change features', () => {
  const a = frameFeatures(normalize(face({ smile: [0.03, 0.01] }), 1000, 1000).pts);
  const b = frameFeatures(normalize(face({ smile: [0.03, 0.01], tilt: 0.2 }), 1000, 1000).pts);
  assert.ok(Math.abs(a.left.mouthY - b.left.mouthY) < 1e-9);
  assert.ok(Math.abs(a.right.eyeOpen - b.right.eyeOpen) < 1e-9);
});

test('no movement on either side is "not measured", not scored from noise', () => {
  const r = checkIn({ smile: [0.001, 0.0002], brow: [0.0005, 0], eye: [1, 1] });
  assert.equal(r.poses.smile.score, null);
  assert.equal(r.poses.brows.score, null);
  assert.equal(r.poses.eyes.score, null);
  assert.ok(r.poses.rest.score >= 95);
  assert.equal(r.overall, r.poses.rest.score); // only the measured expression counts
});

test('one weak side is still measured because the other side moves', () => {
  const r = checkIn({ smile: [0.05, 0] });
  assert.ok(r.poses.smile.score != null && r.poses.smile.score < 30);
  assert.equal(r.poses.smile.weaker, 'left');
});

test('score change only compares movements measured in both check-ins', async () => {
  const { scoreChange } = await import('../js/analysis.js');
  const full = (rest, smile, brows, eyes) => ({ poses: { rest: { score: rest }, smile: { score: smile }, brows: { score: brows }, eyes: { score: eyes } } });
  const a = full(80, 40, 50, 60);
  const b = full(85, 50, 55, 70);
  const overall = (r) => Math.round(0.2 * r.poses.rest.score + 0.35 * r.poses.smile.score + 0.2 * r.poses.brows.score + 0.25 * r.poses.eyes.score);
  assert.equal(scoreChange(a, b), overall(b) - overall(a)); // fully measured = plain difference
  const restOnly = full(93, null, null, null);
  assert.equal(scoreChange(restOnly, b), 85 - 93); // only the relaxed face is comparable
});
