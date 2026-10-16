// Encouragement and calming copy. Kept separate so the tone is easy to tune.

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const CALM_REMINDERS = [
  'For most people, facial palsy gets better with time. Your nerve is healing, even on days you can’t see it.',
  'Some recoveries, like Ramsay Hunt syndrome, take longer. Slow progress is still progress.',
  'Your journey is your own. Try not to compare your timeline with anyone else’s.',
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

// Gentle context for last night's sleep, shown with the check-in result.
export function sleepNote(minutes) {
  if (minutes == null) return null;
  if (minutes < 6 * 60) {
    return 'A short night can make your face feel weaker or tighter, so be extra gentle with today’s numbers. Rest when you can — sleep is when a lot of healing happens.';
  }
  if (minutes < 7 * 60) {
    return 'Decent rest. Your body does much of its repair work while you sleep, so a little extra tonight can only help.';
  }
  return 'Lovely — good sleep gives your healing nerve the best conditions to recover.';
}

// Shown with every result: healing is a journey, and time is on their side.
export const JOURNEY_MESSAGES = [
  'Let the journey play out. Your nerve is healing on its own timeline, and every day brings you closer.',
  'Healing takes time, and you are giving it exactly that. Trust the process — you will get there.',
  'Nerves recover slowly but surely. Patience now is part of how you heal.',
  'You don’t have to rush this. Keep showing up, and let time do its quiet work.',
  'Each check-in is a step on the road back to your smile. The road is long, but it leads home.',
];

export const journeyMessage = () => pick(JOURNEY_MESSAGES);

// Daily positive thoughts for the home screen. One per day (stable all day),
// with the option to see another.
export const POSITIVE_THOUGHTS = [
  'My body knows how to heal, and it is healing right now.',
  'Every small change is a step toward my full smile.',
  'I am patient with myself. Healing has its own timing.',
  'I am more than my reflection. My kindness and laughter are still me.',
  'Today I will notice what is getting better, not just what is not there yet.',
  'Rest is part of my recovery, not a pause from it.',
  'I trust the process. Nerves heal slowly, and mine is on its way.',
  'Each check-in is proof that I am showing up for myself.',
  'I can feel calm, even while I wait.',
  'My smile is coming back, one day at a time.',
  'I celebrate small wins. They add up to big ones.',
  'I am stronger than this moment.',
  'Healing is happening even when I cannot see it.',
  'I give myself the same kindness I would give a friend.',
  'Slow progress is still progress.',
  'I breathe in calm and breathe out worry.',
  'This chapter will pass. My future self is smiling.',
  'I am grateful for every bit of movement that returns.',
  'I let go of rushing and make room for healing.',
  'One gentle day at a time is enough.',
];

const dayOfYear = (d = new Date()) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);

// Same thought all day; `offset` steps to the next one when asked for another.
export function dailyThought(offset = 0) {
  const n = POSITIVE_THOUGHTS.length;
  return POSITIVE_THOUGHTS[(((dayOfYear() + offset) % n) + n) % n];
}
