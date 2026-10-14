// Encouragement and calming copy. Kept separate so the tone is easy to tune.

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const CALM_REMINDERS = [
  'For most people, Bell’s palsy is temporary. Your nerve is healing, even on days you can’t see it.',
  'Healing nerves grow slowly — about a millimeter a day. Slow is still forward.',
  'Stress and tension can make your face feel tighter. A few slow breaths help more than you’d think.',
  'Your face doesn’t define you. The people who love you see you, not the droop.',
  'Recovery isn’t a straight line. Good days and flat days are both part of it.',
  'Be as kind to yourself today as you would be to a friend going through this.',
  'Rest, sleep and patience are part of the treatment. You’re doing the work just by showing up.',
  'Many people notice the first signs of movement within a few weeks. Each check-in helps you catch them.',
  'This is a chapter, not the whole story.',
];

export const EYE_CARE_TIP =
  'If your eye doesn’t close fully, keep it moist with eye drops during the day and protect it at night (gel or an eye patch) as your doctor advises.';

export const calmReminder = () => pick(CALM_REMINDERS);

// Message for a finished check-in. `delta` = change vs previous check-in,
// `fromBaseline` = change vs the very first one. Score units are 0–100.
export function encouragement({ delta, fromBaseline, isFirst }) {
  if (isFirst) {
    return {
      tone: 'start',
      title: 'Your starting point is saved',
      body: 'This first check-in is your baseline. Every future check-in will be compared to it, so even small gains will show up. Starting is the hardest part — well done.',
    };
  }
  if (delta >= 8) {
    return {
      tone: 'big',
      title: 'That’s real progress!',
      body: pick([
        `Up ${delta} points since last time. Your face is waking up — this is exactly what healing looks like.`,
        `A ${delta}-point jump! Your nerve is reconnecting. Take a moment to enjoy this one.`,
      ]),
    };
  }
  if (delta >= 1) {
    return {
      tone: 'small',
      title: 'Moving in the right direction',
      body: pick([
        `Up ${delta} point${delta === 1 ? '' : 's'} since last time. Small steps add up — this is how recovery happens.`,
        `+${delta} since your last check-in. Even a little movement means the nerve is doing its job.`,
        `A ${delta}-point improvement. Tiny gains are still gains, and they’re worth celebrating.`,
      ]),
    };
  }
  if (fromBaseline >= 3) {
    return {
      tone: 'steady',
      title: 'Still ahead of where you started',
      body: `Today held steady, but you’re ${fromBaseline} points better than your first check-in. Plateaus are a normal part of healing — the overall trend is what matters.`,
    };
  }
  return {
    tone: 'gentle',
    title: 'Thank you for checking in',
    body: pick([
      'No change today, and that’s okay. Lighting, tiredness and camera angle all nudge the numbers. Nerves heal on their own schedule — keep going.',
      'Healing often happens quietly before it shows. Your consistency is what lets us spot it the moment it does.',
      'A flat day isn’t a step back. Recovery comes in waves, and you’re still on the path.',
    ]),
  };
}

// One-line nudge comparing a pose to the first check-in.
export function poseImprovementNote(title, now, base) {
  const d = now - base;
  if (d >= 5) return `${title}: up ${d} since you started — wonderful.`;
  if (d >= 1) return `${title}: up ${d} since you started. Every bit counts.`;
  return null;
}
