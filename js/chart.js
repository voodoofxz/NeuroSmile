// Single-series line chart of the overall score, drawn as inline SVG.
// Tap/hover shows the nearest point; tapping a point opens that check-in.

const W = 340;
const H = 190;
const PAD = { top: 14, right: 12, bottom: 26, left: 30 };

export function renderChart(el, points, onSelect) {
  const t0 = points[0].date;
  const t1 = points.at(-1).date;
  const lo = Math.max(0, Math.floor((Math.min(...points.map((p) => p.value)) - 10) / 10) * 10);
  const x = (t) => PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (v) => PAD.top + (1 - (v - lo) / (100 - lo)) * (H - PAD.top - PAD.bottom);
  const ticks = [];
  for (let v = lo; v <= 100; v += lo >= 60 ? 10 : 20) ticks.push(v);
  const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');

  el.innerHTML = `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Overall symmetry score over time, from ${points[0].value} to ${points.at(-1).value}">
    ${ticks.map((v) => `
      <line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1" />
      <text x="${PAD.left - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`).join('')}
    <text x="${PAD.left}" y="${H - 6}" font-size="10" fill="var(--muted)">${fmt(t0)}</text>
    <text x="${W - PAD.right}" y="${H - 6}" text-anchor="end" font-size="10" fill="var(--muted)">${fmt(t1)}</text>
    <line class="xhair" y1="${PAD.top}" y2="${H - PAD.bottom}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" visibility="hidden" />
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    ${points.map((p) => `<circle cx="${x(p.date)}" cy="${y(p.value)}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" />`).join('')}
    <rect class="hit" x="${PAD.left}" y="0" width="${W - PAD.left - PAD.right}" height="${H}" fill="transparent" />
  </svg>
  <div class="chart-tip" hidden></div>`;

  const svg = el.querySelector('svg');
  const tip = el.querySelector('.chart-tip');
  const xhair = el.querySelector('.xhair');
  let active = null;

  const nearest = (evt) => {
    const r = svg.getBoundingClientRect();
    const sx = ((evt.clientX - r.left) / r.width) * W;
    return points.reduce((best, p) => (Math.abs(x(p.date) - sx) < Math.abs(x(best.date) - sx) ? p : best));
  };
  const show = (evt) => {
    active = nearest(evt);
    const r = svg.getBoundingClientRect();
    const px = x(active.date);
    xhair.setAttribute('x1', px);
    xhair.setAttribute('x2', px);
    xhair.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.textContent = `${fmt(active.date)} · ${active.value}`;
    tip.style.left = `${(px / W) * r.width}px`;
    tip.style.top = `${(y(active.value) / H) * r.height}px`;
  };
  const hide = () => {
    tip.hidden = true;
    xhair.setAttribute('visibility', 'hidden');
  };
  const hit = el.querySelector('.hit');
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('click', (e) => {
    show(e);
    if (active) onSelect(active.id);
  });
}
