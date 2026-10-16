// Gentle facial exercises and stretches, offered once improvement shows up.
// General guidance only: slow, small, symmetric movements; never forceful.

// Points above the baseline score before exercises are suggested. Day-to-day
// noise is a few points, so this is a real, if early, improvement.
export const UNLOCK_GAIN = 5;

// `areas` match the check-in poses so we can recommend for the weakest ones.
export const EXERCISES = [
  {
    id: 'massage',
    icon: '🤲',
    title: 'Warm-up face massage',
    areas: ['rest', 'smile', 'brows', 'eyes'],
    dose: '1–2 minutes',
    steps: [
      'Wash your hands and sit comfortably in front of a mirror.',
      'With your fingertips, make small, slow circles across your forehead, cheeks, jaw and around your mouth.',
      'Use light pressure and work outward toward your ears, spending a little extra time on the weaker side.',
    ],
    tip: 'Massage helps loosen tight muscles and gets you relaxed before moving.',
  },
  {
    id: 'cheek-stretch',
    icon: '🌤️',
    title: 'Cheek lift stretch',
    areas: ['rest', 'smile'],
    dose: 'Hold 15–20 seconds · 3 times',
    steps: [
      'Place your fingertips flat on the cheek of your weaker side, just beside your nose.',
      'Gently slide the cheek up and out toward your ear until you feel a mild stretch.',
      'Hold, breathe slowly, then release.',
    ],
    tip: 'It should feel like a gentle stretch, never pain.',
  },
  {
    id: 'brow-lift',
    icon: '🤨',
    title: 'Gentle eyebrow lift',
    areas: ['brows'],
    dose: 'Hold 5 seconds · 5–10 times',
    steps: [
      'Look into a mirror and slowly raise both eyebrows, as if mildly surprised.',
      'If the weaker brow lags, rest a fingertip just above it and guide it up a little.',
      'Hold, then lower slowly and relax completely.',
    ],
    tip: 'Keep the strong side small so both brows rise to the same height.',
  },
  {
    id: 'eye-close',
    icon: '😌',
    title: 'Soft eye closure',
    areas: ['eyes'],
    dose: 'Hold 5 seconds · 5–10 times',
    steps: [
      'Slowly close both eyes as if falling asleep — don’t squeeze.',
      'Hold gently, then open slowly.',
      'Keep your mouth and cheeks still while you do this.',
    ],
    tip: 'If your mouth pulls up when you close your eyes, stop and mention it to your doctor or facial therapist.',
  },
  {
    id: 'nose-wrinkle',
    icon: '👃',
    title: 'Nose wrinkle',
    areas: ['smile', 'rest'],
    dose: 'Hold 3 seconds · 5 times',
    steps: [
      'Gently wrinkle your nose, as if noticing a mild smell.',
      'Aim for an even, small movement on both sides.',
      'Release slowly and relax.',
    ],
    tip: 'Small and controlled beats big and strong.',
  },
  {
    id: 'small-smile',
    icon: '🙂',
    title: 'Slow closed-lip smile',
    areas: ['smile'],
    dose: 'Hold 5 seconds · 5–10 times',
    steps: [
      'With lips together, slowly widen into a small smile.',
      'Watch the mirror: let the stronger side move only as far as the weaker side can.',
      'If needed, use a fingertip at the weaker mouth corner to guide it up and out. Hold, then relax.',
    ],
    tip: 'Matching the two sides retrains a balanced smile — strength comes later.',
  },
  {
    id: 'pucker',
    icon: '😗',
    title: 'Pucker and “ee”',
    areas: ['smile'],
    dose: '5–10 slow rounds',
    steps: [
      'Gently pucker your lips forward as if to whistle. Hold for 3 seconds.',
      'Slowly change to a soft “ee” shape. Hold for 3 seconds.',
      'Move slowly between the two, keeping both sides even.',
    ],
    tip: 'Go slowly — the control is what helps the nerve and muscle reconnect.',
  },
  {
    id: 'lip-stretch',
    icon: '👄',
    title: 'Upper lip stretch',
    areas: ['smile', 'rest'],
    dose: 'Hold 10 seconds · 3 times',
    steps: [
      'Gently draw your upper lip down over your top teeth.',
      'Feel a light stretch above the lip and hold.',
      'Release and relax your whole mouth.',
    ],
    tip: 'Helpful if your cheek or lip feels tight on the weaker side.',
  },
  {
    id: 'jaw-release',
    icon: '😮‍💨',
    title: 'Jaw release',
    areas: ['rest'],
    dose: '5 slow repetitions',
    steps: [
      'Let your jaw drop slightly with lips relaxed.',
      'Slowly open a little wider, then close gently without clenching.',
      'Finish with a slow breath out and a soft, relaxed face.',
    ],
    tip: 'A relaxed jaw makes every other movement easier.',
  },
];

export const SAFETY = [
  'Check with your doctor or a facial physiotherapist before starting, especially if your recovery has been slow.',
  'Little and often: about 5–10 minutes, once or twice a day, works better than long sessions.',
  'Move slowly and gently. Small, even movements are the goal — never force or strain.',
  'Stop if anything hurts.',
  'If you notice linked movements — like your eye closing when you smile — stop those exercises and ask a facial therapist for guidance.',
];

// Unlock once any later check-in beats the baseline by UNLOCK_GAIN points.
export function improvementGain(list) {
  if (list.length < 2) return 0;
  const base = list[0].overall;
  return Math.max(...list.slice(1).map((r) => r.overall)) - base;
}

// Exercises for the two weakest movements in the latest check-in, plus the warm-up.
export function recommendedFor(latest) {
  const weakest = ['smile', 'brows', 'eyes', 'rest']
    .sort((a, b) => latest.poses[a].score - latest.poses[b].score)
    .slice(0, 2);
  const picked = EXERCISES.filter((e) => e.id === 'massage' || e.areas.some((a) => weakest.includes(a)));
  return { weakest, exercises: picked.slice(0, 5) };
}
