// Numbers for the home screen. Pure functions over the check-in list so they are easy to test.

const DAY = 864e5;
const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Consecutive days with a check-in. A streak stays alive until a whole day is
// missed, so checking in yesterday but not yet today still counts.
export function streak(list, now = Date.now()) {
  const days = new Set(list.map((r) => dayStart(r.date)));
  let day = dayStart(now);
  if (!days.has(day)) day -= DAY;
  let n = 0;
  while (days.has(day)) { n++; day -= DAY; }
  return n;
}

export function stats(list, now = Date.now()) {
  const weekStart = dayStart(now) - 6 * DAY;
  const week = list.filter((r) => r.date >= weekStart);
  const slept = week.map((r) => r.sleepMinutes).filter((m) => m != null);
  return {
    streak: streak(list, now),
    checkIns: list.length,
    best: list.length ? Math.max(...list.map((r) => r.overall)) : null,
    sinceStart: list.length > 1 ? list.at(-1).overall - list[0].overall : null,
    avgSleep: slept.length ? Math.round(slept.reduce((a, b) => a + b, 0) / slept.length) : null,
    relaxed: list.filter((r) => r.relaxed).length,
  };
}

// Each movement now vs. the baseline check-in.
export function wins(list) {
  if (list.length < 2) return [];
  const base = list[0].poses;
  const now = list.at(-1).poses;
  return ['smile', 'eyes', 'brows', 'rest'].map((key) => ({
    key, base: base[key].score, now: now[key].score, change: now[key].score - base[key].score,
  }));
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
  const day = Math.max(1, Math.floor((dayStart(now) - new Date(`${onset}T00:00`).getTime()) / DAY) + 1);
  const next = milestones.find((m) => m.day > day) || null;
  return { day, next, daysToNext: next ? next.day - day : 0, milestones, beyond: !next };
}
