import { movingAverage } from '../core/runs.js';

/**
 * "Steps per attempt" charts. Colors and dash patterns come from CSS, so they follow the appearance.
 *
 * drawChart: one robot. With no overlays it shows the last 60 raw attempts, with markers for falls
 *   and time-outs. With saved-run overlays it shows every run from attempt 1 as a 5-attempt average.
 * drawRace: several robots on one level, each as a 5-attempt average in its own color and line style.
 */
const W = 320, H = 150, PL = 28, PR = 8, PT = 8, PB = 20, IW = W - PL - PR, IH = H - PT - PB;

function scaleFor(level, n) {
  return {
    X: i => PL + (i / (n - 1)) * IW,
    Y: v => PT + IH - (Math.min(v, level.maxSteps) / level.maxSteps) * IH
  };
}

function axes(level, Y, firstLabel, endLabel) {
  let s = '<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent-fill);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--accent-fill);stop-opacity:0"/></linearGradient></defs>';
  [0, 0.5, 1].forEach(f => { const y = PT + IH - f * IH; s += `<line class="gl" x1="${PL}" x2="${W - PR}" y1="${y}" y2="${y}"/>`; });
  s += `<text class="ax" x="${PL - 6}" y="${PT + IH + 3}" text-anchor="end">0</text>`;
  s += `<text class="ax" x="${PL - 6}" y="${PT + 3}" text-anchor="end">${level.maxSteps}</text>`;
  const oy = Y(level.optimal);
  s += `<line class="opt" x1="${PL}" x2="${W - PR}" y1="${oy}" y2="${oy}"/>`;
  return { head: s, foot: `<text class="ax" x="${PL}" y="${H - 5}">${firstLabel}</text><text class="ax" x="${W - PR}" y="${H - 5}" text-anchor="end">attempt ${endLabel}</text>` };
}

const pathOf = (values, X, Y) => values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
const dot = (cls, x, y, r) => `<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`;

/**
 * current:  { attempts, masteredAt }  the run in progress
 * overlays: [{ slot, name, attempts, masteredAt }]  saved runs to compare against
 */
export function drawChart(svg, level, current, overlays = []) {
  const compare = overlays.length > 0, attempts = current.attempts;
  let win = [], first = 0, n;
  if (compare) n = Math.min(200, Math.max(20, attempts.length, ...overlays.map(o => o.attempts.length)));
  else { win = attempts.slice(-60); first = attempts.length - win.length; n = Math.max(win.length, 20); }
  const { X, Y } = scaleFor(level, n);
  const ax = axes(level, Y, first + 1, compare ? n : Math.max(attempts.length, 1));
  let s = ax.head;

  const marker = (values, masteredAt, cls) => (masteredAt && masteredAt <= values.length) ? dot('mk ' + cls, X(masteredAt - 1), Y(values[masteredAt - 1]), 3.6) : '';

  if (compare) {
    const avg = list => movingAverage(list.map(a => a.steps)).slice(0, n);
    overlays.forEach(o => { const v = avg(o.attempts); if (v.length > 1) s += `<path class="ov r${o.slot}" d="${pathOf(v, X, Y)}"/>`; });
    overlays.forEach(o => { s += marker(avg(o.attempts), o.masteredAt, 'r' + o.slot); });
    const v = avg(attempts);
    if (v.length > 1) s += `<path class="ln" d="${pathOf(v, X, Y)}"/>`;
    s += marker(v, current.masteredAt, 'cur');
    if (v.length) s += dot('pe', X(v.length - 1), Y(v[v.length - 1]), 3.6);
  } else {
    const v = win.map(a => a.steps);
    if (v.length > 1) {
      s += `<path d="${pathOf(v, X, Y)}L${X(v.length - 1).toFixed(1)} ${PT + IH}L${X(0).toFixed(1)} ${PT + IH}Z" fill="url(#ga)"/>`;
      s += `<path class="ln" d="${pathOf(v, X, Y)}"/>`;
    }
    win.forEach((a, i) => {
      if (a.fell) s += dot('pf', X(i), Y(a.steps), 3);
      else if (a.timeout) s += dot('pt', X(i), Y(a.steps), 3);
    });
    if (v.length) s += dot('pe', X(v.length - 1), Y(v[v.length - 1]), 3.6);
  }

  svg.innerHTML = s + ax.foot;
  const last = attempts[attempts.length - 1];
  svg.setAttribute('aria-label', !attempts.length
    ? 'Steps per attempt. No attempts yet.'
    : `Steps per attempt. Latest attempt took ${last.steps} steps. The shortest route is ${level.optimal}.${compare ? ` Comparing with ${overlays.length} saved ${overlays.length === 1 ? 'run' : 'runs'}.` : ''}`);
}

/** robots: [{ slot, name, attempts, masteredAt }]; selectedSlot is drawn thicker. */
export function drawRace(svg, level, robots, selectedSlot) {
  const n = Math.min(200, Math.max(20, ...robots.map(r => r.attempts.length)));
  const { X, Y } = scaleFor(level, n);
  const ax = axes(level, Y, 1, n);
  let s = ax.head;
  const series = robots.map(r => ({ r, v: movingAverage(r.attempts.map(a => a.steps)).slice(0, n) }));
  // selected robot last, so its line sits on top
  [...series].sort((a, b) => (a.r.slot === selectedSlot) - (b.r.slot === selectedSlot)).forEach(({ r, v }) => {
    if (v.length > 1) s += `<path class="rb b${r.slot}${r.slot === selectedSlot ? ' sel' : ''}" d="${pathOf(v, X, Y)}"/>`;
  });
  series.forEach(({ r, v }) => {
    if (r.masteredAt && r.masteredAt <= v.length) s += dot(`mk b${r.slot}`, X(r.masteredAt - 1), Y(v[r.masteredAt - 1]), 3.6);
    if (v.length) s += dot(`pe b${r.slot}`, X(v.length - 1), Y(v[v.length - 1]), 3.6);
  });
  svg.innerHTML = s + ax.foot;
  svg.setAttribute('aria-label', `Steps per attempt for ${robots.length} robots. The shortest route is ${level.optimal}. ${robots.map(r => `${r.name}: ${r.attempts.length ? `latest ${r.attempts[r.attempts.length - 1].steps} steps` : 'no attempts yet'}`).join('. ')}.`);
}
