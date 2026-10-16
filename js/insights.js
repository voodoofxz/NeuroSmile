// Numbers for the home screen. Pure functions over the check-in list so they are easy to test.

import { scoreChange } from './analysis.js';

const DAY = 864e5;

// Calendar-day helpers. Days are stepped with setDate, never by adding 24h, so
// counts stay right across daylight-saving changes (when a day is 23 or 25 hours).
export const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (t, n) => { const d = new Date(dayStart(t)); d.setDate(d.getDate() + n); return d.getTime(); };
export const dateKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const utcDay = (key) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };

// Today as YYYY-MM-DD in local time (for date inputs; toISOString would be UTC).
export const todayKey = (now = Date.now()) => dateKey(now);

// Day number of the recovery: the onset day is Day 1.
export const recoveryDay = (onset, now = Date.now()) => Math.max(1, Math.round((utcDay(dateKey(now)) - utcDay(onset)) / DAY) + 1);

// Consecutive days with a check-in. A streak stays alive until a whole day is
// missed, so checking in yesterday but not yet today still counts.
export function streak(list, now = Date.now()) {
  const days = new Set(list.map((r) => dateKey(r.date)));
  let day = dayStart(now);
  if (!days.has(dateKey(day))) day = addDays(day, -1);
  let n = 0;
  while (days.has(dateKey(day))) { n++; day = addDays(day, -1); }
  return n;
}

export function stats(list, now = Date.now()) {
  const weekStart = addDays(now, -6);
  const week = list.filter((r) => r.date >= weekStart);
  const slept = week.map((r) => r.sleepMinutes).filter((m) => m != null);
  return {
    streak: streak(list, now),
    checkIns: list.length,
    best: list.length ? Math.max(...list.map((r) => r.overall)) : null,
    sinceStart: list.length > 1 ? scoreChange(list[0], list.at(-1)) : null,
    avgSleep: slept.length ? Math.round(slept.reduce((a, b) => a + b, 0) / slept.length) : null,
    relaxed: list.filter((r) => r.relaxed).length,
  };
}

// Each movement now vs. the baseline check-in.
export function wins(list) {
  if (list.length < 2) return [];
  const base = list[0].poses;
  const now = list.at(-1).poses;
  return ['smile', 'eyes', 'brows', 'rest']
    .filter((key) => base[key].score != null && now[key].score != null) // skip unmeasured
    .map((key) => ({ key, base: base[key].score, now: now[key].score, change: now[key].score - base[key].score }));
}

// Conditions the app supports. "Not sure" uses the longer, gentler timeline.
export const CONDITIONS = {
  bells: { name: 'Bell’s palsy' },
  rhs: { name: 'Ramsay Hunt syndrome' },
  unsure: { name: 'facial palsy' },
};

// Possible milestones (days since symptoms began). These are encouragement,
// not deadlines: the last one is a possible milestone, never a finish line.
const MILESTONE_SETS = {
  bells: [
    { day: 1, label: 'Day 1', note: 'Your journey begins' },
    { day: 21, label: '3 weeks', note: 'First signs of movement are possible' },
    { day: 90, label: '3 months', note: 'Many people see clear improvement' },
    { day: 180, label: '6 months', note: 'A possible milestone for many, not a finish line' },
  ],
  rhs: [
    { day: 1, label: 'Day 1', note: 'Your journey begins' },
    { day: 30, label: '1 month', note: 'Early signs of movement are possible' },
    { day: 90, label: '3 months', note: 'Many people see movement returning' },
    { day: 180, label: '6 months', note: 'Improvement often continues' },
    { day: 365, label: '1 year', note: 'A possible milestone, and healing can continue beyond it' },
  ],
};

export const milestonesFor = (condition) => MILESTONE_SETS[condition === 'bells' ? 'bells' : 'rhs'];

export function journey(onset, now = Date.now(), condition = 'bells') {
  if (!onset) return null;
  const milestones = milestonesFor(condition);
  const day = recoveryDay(onset, now);
  const next = milestones.find((m) => m.day > day) || null;
  return { day, next, daysToNext: next ? next.day - day : 0, milestones, beyond: !next };
}
