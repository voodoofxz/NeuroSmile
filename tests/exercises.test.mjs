import { test } from 'node:test';
import assert from 'node:assert/strict';
import { improvementGain, recommendedFor, UNLOCK_GAIN, EXERCISES } from '../js/exercises.js';

const rec = (overall, poses = {}) => ({
  overall,
  poses: { rest: { score: 80 }, smile: { score: 60 }, brows: { score: 70 }, eyes: { score: 75 }, ...poses },
});

test('no gain until there is a check-in after the baseline', () => {
  assert.equal(improvementGain([]), 0);
  assert.equal(improvementGain([rec(50)]), 0);
});

test('gain is the best later score minus the baseline', () => {
  assert.equal(improvementGain([rec(50), rec(53), rec(57), rec(54)]), 7);
  assert.ok(improvementGain([rec(50), rec(54)]) < UNLOCK_GAIN);
  assert.ok(improvementGain([rec(50), rec(55)]) >= UNLOCK_GAIN);
});

test('recommends the warm-up plus exercises for the two weakest movements', () => {
  const r = recommendedFor(rec(60, { smile: { score: 40 }, eyes: { score: 45 } }));
  assert.deepEqual(r.weakest, ['smile', 'eyes']);
  assert.equal(r.exercises[0].id, 'massage');
  assert.ok(r.exercises.length <= 5);
  for (const e of r.exercises.slice(1)) assert.ok(e.areas.some((a) => r.weakest.includes(a)));
});

test('every exercise has steps, a dose and a tip', () => {
  for (const e of EXERCISES) assert.ok(e.steps.length && e.dose && e.tip, e.id);
});
