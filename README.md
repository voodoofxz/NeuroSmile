# NeuroSmile

*A gentle companion for Bell's palsy recovery.*

A private, phone-friendly web app that tracks facial recovery from Bell's palsy.
Each daily check-in uses the phone's front camera and on-device face tracking to
measure how evenly the two sides of the face move, saves photos **only on the phone**,
and shows how much things have improved — with encouragement along the way.

## What it does

- **Required first-run setup** — symptom start date and baseline photos, so every
  later check-in has an accurate starting point to compare against.
- **Relax first** — an optional (recommended) 3-breath exercise before the photos so
  the resting face is relaxed; check-ins that used it are marked in history.
- **Gentle face exercises** — always available, with advice to start once check-ins show
  improvement (5+ points above the baseline, which is celebrated); recommends stretches
  for the two weakest movements, with safety guidance.
- **Celebrations** — confetti and a soft chime whenever a check-in improves (bigger
  for big jumps), a welcome chime for the baseline, and a patience message with every
  result. Sounds can be turned off in Settings; confetti respects reduced motion.
- **Sleep log** — each check-in starts by asking how long you slept last night
  (hours and minutes), shown alongside results and history.
- **Guided 1-minute check-in** with four expressions: relaxed face, big smile,
  raised eyebrows, gently closed eyes (audio beeps guide the eyes-closed step).
- **On-device face analysis** using Google MediaPipe Face Landmarker (478 points +
  expression scores). For each expression it compares how far the left and right
  side move, e.g. *"Your left side is moving at about 64% of the other side."*
- **Symmetry score (0–100)** per expression and overall, compared to the previous
  check-in and to the very first one (the baseline).
- **Local photo history** — every check-in's four photos, notes and scores, a
  progress chart, and a side-by-side *first vs. latest smile* comparison.
- **Encouragement** tuned to the result: celebrates even a 1-point gain, reframes
  flat days, and reminds you the condition is usually temporary.
- **Calm tools** — rotating reassurance messages, a guided breathing exercise,
  eye-care reminder, "Day N of recovery" counter.
- **Daily reminder** via a repeating calendar event (`.ics`) created on the phone.
- **Your data, your control** — export a backup file or delete everything.

## Privacy

- Camera frames are processed in the browser; nothing is uploaded.
- Photos and scores are stored in the app's IndexedDB on the device only.
- No accounts, analytics or servers. The only network fetch is the MediaPipe
  library and model (from jsDelivr / Google's model bucket), cached for offline use.
- Clearing the browser's site data or uninstalling the app deletes the history —
  use **Settings → Export a backup file** to keep a copy.

## Using it on a phone

The app must be served over HTTPS for camera access. The easiest option is GitHub Pages:

1. In the GitHub repo go to **Settings → Pages**.
2. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. Open `https://voodoofxz.github.io/bells-palsy-facemontior/` on the phone.
4. Add it to the home screen (Safari: Share → *Add to Home Screen*; Chrome: ⋮ →
   *Install app*). It then opens full-screen like a normal app and works offline.

## Local development

No build step, no dependencies.

```bash
npm start      # serves on http://localhost:5173 (camera works on localhost)
npm test       # scoring unit tests (node --test)
```

| File | Purpose |
|---|---|
| `js/analysis.js` | Landmark normalization, per-side features, scoring |
| `js/app.js` | Screens, camera loop, check-in flow, history, settings |
| `js/storage.js` | IndexedDB wrapper (check-ins + settings) |
| `js/messages.js` | Encouragement and calming copy |
| `js/chart.js` | Progress chart (inline SVG) |
| `js/celebrate.js` | Confetti and chime effects |
| `js/exercises.js` | Exercise content, unlock rule and recommendations |
| `sw.js` | Offline cache for the app shell and face model |

## How the score is calculated

All landmarks are rotated and scaled so the eyes sit on a horizontal line one
unit apart — this cancels head tilt, distance and camera resolution.

| Expression | Measured | Weight |
|---|---|---|
| Relaxed | Mouth-corner height difference, eye-opening balance | 20% |
| Smile | Distance each mouth corner travels from rest | 35% |
| Eyebrows | How far each brow lifts from rest | 20% |
| Eyes closed | Fraction of each eye's opening that closes | 25% |

Movement scores are *weaker side ÷ stronger side*, blended 70/30 with MediaPipe's
own left/right expression scores. Expect a few points of day-to-day variation from
lighting and angle; the trend over days and weeks is what matters.

## Disclaimer

This is a personal tracking aid, not a medical device, and does not diagnose or
treat any condition. Follow your clinician's advice and seek urgent care for new
symptoms such as limb weakness, trouble speaking or a severe headache.
