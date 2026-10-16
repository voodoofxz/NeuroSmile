import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streak, stats, wins, journey } from '../js/insights.js';

const DAY = 864e5;
const NOW = new Date('2026-10-16T15:00:00').getTime();
const at = (daysAgo) => NOW - daysAgo * DAY;
const rec = (daysAgo, overall, extra = {}) => ({
  date: at(daysAgo), overall,
  poses: { rest: { score: overall + 10 }, smile: { score: overall - 10 }, brows: { score: overall }, eyes: { score: overall + 5 } },
  ...extra,
});

test('streak counts consecutive days and survives until a day is missed', () => {
  assert.equal(streak([rec(2, 50), rec(1, 52), rec(0, 53)], NOW), 3);
  assert.equal(streak([rec(2, 50), rec(1, 52)], NOW), 2); // not checked in yet today
  assert.equal(streak([rec(3, 50), rec(2, 52)], NOW), 0); // missed yesterday
  assert.equal(streak([rec(0, 50), rec(0, 51)], NOW), 1); // two check-ins, one day
});

test('stats summarise the history', () => {
  const s = stats([rec(10, 40, { sleepMinutes: 300 }), rec(3, 50, { sleepMinutes: 420, relaxed: true }), rec(0, 48, { sleepMinutes: 480 })], NOW);
  assert.equal(s.checkIns, 3);
  assert.equal(s.best, 50);
  assert.equal(s.sinceStart, 8);
  assert.equal(s.avgSleep, 450); // only the last 7 days
  assert.equal(s.relaxed, 1);
});

test('wins compare each movement with the baseline', () => {
  const w = wins([rec(5, 40), rec(0, 52)]);
  assert.equal(w.length, 4);
  assert.ok(w.every((x) => x.change === 12));
  assert.deepEqual(wins([rec(0, 50)]), []);
});

test('journey finds the day and next milestone', () => {
  const j = journey('2026-10-01', NOW);
  assert.equal(j.day, 16);
  assert.equal(j.next.day, 21);
  assert.equal(j.daysToNext, 5);
  assert.equal(journey('2026-01-01', NOW).next, null);
});
