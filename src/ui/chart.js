import { movingAverage } from '../core/runs.js';

/**
 * Draws "steps per attempt". Colors and dash patterns come from CSS, so it follows the appearance.
 *
 * current:  { attempts, masteredAt }  the run in progress
 * overlays: [{ slot, name, attempts, masteredAt }]  saved runs to compare against
 *
 * With no overlays it shows the last 60 raw attempts, with markers for falls and time-outs.
 * With overlays it shows every run from attempt 1 as a 5-attempt average, so curves are comparable.
 */
export function drawChart(svg, level, current, overlays = []) {
  const W = 320, H = 150, pl = 28, pr = 8, pt = 8, pb = 20, iw = W - pl - pr, ih = H - pt - pb;
  const compare = overlays.length > 0, attempts = current.attempts;
  const ymax = level.maxSteps;
  const Y = v => pt + ih - (Math.min(v, ymax) / ymax) * ih;

  let win, first = 0, n;
  if (compare) {
    n = Math.min(200, Math.max(20, attempts.length, ...overlays.map(o => o.attempts.length)));
  } else {
    win = attempts.slice(-60); first = attempts.length - win.length;
    n = Math.max(win.length, 20);
  }
  const X = i => pl + (i / (n - 1)) * iw;

  let s = '<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent-fill);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--accent-fill);stop-opacity:0"/></linearGradient></defs>';
  [0, 0.5, 1].forEach(f => { const y = pt + ih - f * ih; s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/>`; });
  s += `<text class="ax" x="${pl - 6}" y="${pt + ih + 3}" text-anchor="end">0</text>`;
  s += `<text class="ax" x="${pl - 6}" y="${pt + 3}" text-anchor="end">${ymax}</text>`;
  const oy = Y(level.optimal);
  s += `<line class="opt" x1="${pl}" x2="${W - pr}" y1="${oy}" y2="${oy}"/>`;

  const path = values => values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
  const marker = (values, masteredAt, cls) => {
    if (!masteredAt || masteredAt > values.length) return '';
    const i = masteredAt - 1;
    return `<circle class="mk ${cls}" cx="${X(i).toFixed(1)}" cy="${Y(values[i]).toFixed(1)}" r="3.6"/>`;
  };

  if (compare) {
    overlays.forEach(o => {
      const v = movingAverage(o.attempts.map(a => a.steps)).slice(0, n);
      if (v.length > 1) s += `<path class="ov r${o.slot}" d="${path(v)}"/>`;
    });
    overlays.forEach(o => { s += marker(movingAverage(o.attempts.map(a => a.steps)).slice(0, n), o.masteredAt, 'r' + o.slot); });
    const v = movingAverage(attempts.map(a => a.steps)).slice(0, n);
    if (v.length > 1) s += `<path class="ln" d="${path(v)}"/>`;
    s += marker(v, current.masteredAt, 'cur');
    if (v.length) s += `<circle class="pe" cx="${X(v.length - 1).toFixed(1)}" cy="${Y(v[v.length - 1]).toFixed(1)}" r="3.6"/>`;
  } else {
    const v = win.map(a => a.steps);
    if (v.length > 1) {
      s += `<path d="${path(v)}L${X(v.length - 1).toFixed(1)} ${pt + ih}L${X(0).toFixed(1)} ${pt + ih}Z" fill="url(#ga)"/>`;
      s += `<path class="ln" d="${path(v)}"/>`;
    }
    win.forEach((a, i) => {
      if (a.fell) s += `<circle class="pf" cx="${X(i).toFixed(1)}" cy="${Y(a.steps).toFixed(1)}" r="3"/>`;
      else if (a.timeout) s += `<circle class="pt" cx="${X(i).toFixed(1)}" cy="${Y(a.steps).toFixed(1)}" r="3"/>`;
    });
    if (v.length) s += `<circle class="pe" cx="${X(v.length - 1).toFixed(1)}" cy="${Y(v[v.length - 1]).toFixed(1)}" r="3.6"/>`;
  }

  s += `<text class="ax" x="${pl}" y="${H - 5}">${first + 1}</text>`;
  const endLabel = compare ? n : Math.max(attempts.length, 1);
  s += `<text class="ax" x="${W - pr}" y="${H - 5}" text-anchor="end">attempt ${endLabel}</text>`;
  svg.innerHTML = s;

  const last = attempts[attempts.length - 1];
  svg.setAttribute('aria-label', !attempts.length
    ? 'Steps per attempt. No attempts yet.'
    : `Steps per attempt. Latest attempt took ${last.steps} steps. The shortest route is ${level.optimal}.${compare ? ` Comparing with ${overlays.length} saved ${overlays.length === 1 ? 'run' : 'runs'}.` : ''}`);
}
