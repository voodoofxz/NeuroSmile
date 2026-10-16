// Small celebrations for progress: a confetti burst and a soft chime.
// Both are gentle by design and respect reduced-motion and the sound setting.

const COLORS = ['#0ec1bb', '#55edd3', '#29d2ea', '#1fa6fa', '#0179fb', '#ffd98a', '#c9c0ea', '#ffffff'];

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// `size`: 'small' | 'big'. Falls from the top, drifts and fades out in ~4s.
export function confetti(size = 'small') {
  if (reducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = innerWidth;
  const h = innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const count = size === 'big' ? 170 : 90;
  const pieces = Array.from({ length: count }, (_, i) => {
    // Two bursts from the upper corners plus a gentle shower from the top.
    const fromSide = i % 3;
    const x = fromSide === 0 ? 0 : fromSide === 1 ? w : Math.random() * w;
    const y = fromSide === 2 ? -20 - Math.random() * h * 0.3 : h * 0.25;
    const angle = fromSide === 0 ? -Math.PI / 3 : fromSide === 1 ? (-2 * Math.PI) / 3 : Math.PI / 2;
    const speed = fromSide === 2 ? 1 + Math.random() * 2 : 7 + Math.random() * 7;
    return {
      x, y,
      vx: Math.cos(angle + (Math.random() - 0.5) * 0.9) * speed,
      vy: Math.sin(angle + (Math.random() - 0.5) * 0.9) * speed,
      size: 5 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      wobble: Math.random() * Math.PI * 2,
      round: Math.random() < 0.3,
    };
  });

  const start = performance.now();
  const DURATION = 4200;
  const frame = (now) => {
    const t = now - start;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = t > DURATION - 1000 ? Math.max(0, (DURATION - t) / 1000) : 1;
    for (const p of pieces) {
      p.vy += 0.18; // gravity
      p.vx *= 0.985; // air resistance
      p.vy *= 0.985;
      p.wobble += 0.1;
      p.x += p.vx + Math.sin(p.wobble) * 0.6;
      p.y += p.vy;
      p.rot += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.6 + 0.4 * Math.abs(Math.cos(p.wobble))));
      }
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

let audioCtx;

// A soft, warm rising chime. 'welcome' is a short two-note greeting;
// 'small' a gentle arpeggio; 'big' adds a higher sparkle on top.
export function chime(kind = 'small') {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime + 0.05;
    const notes = {
      welcome: [523.25, 783.99], // C5 G5
      small: [523.25, 659.25, 783.99, 1046.5], // C5 E5 G5 C6
      big: [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], // ... E6 G6
    }[kind] || [523.25, 659.25, 783.99];
    const master = audioCtx.createGain();
    master.gain.value = 0.18;
    master.connect(audioCtx.destination);
    notes.forEach((freq, i) => {
      const t = now + i * 0.13;
      for (const [type, detune, level] of [['sine', 0, 1], ['triangle', 4, 0.25]]) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + 0.03); // soft attack
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); // long, bell-like fade
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + 1.7);
      }
    });
  } catch {
    /* audio unavailable — the confetti still celebrates */
  }
}
