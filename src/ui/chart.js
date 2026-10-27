/** Draws "steps per attempt" as a small line chart. Colors come from CSS, so it follows the appearance. */
export function drawChart(svg, level, attempts) {
  const W = 320, H = 124, pl = 28, pr = 8, pt = 8, pb = 20, iw = W - pl - pr, ih = H - pt - pb;
  const win = attempts.slice(-60), first = attempts.length - win.length;
  const ymax = level.maxSteps, nx = Math.max(win.length - 1, 19);
  const X = i => pl + (i / nx) * iw, Y = v => pt + ih - (Math.min(v, ymax) / ymax) * ih;
  let s = '<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent-fill);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--accent-fill);stop-opacity:0"/></linearGradient></defs>';
  [0, 0.5, 1].forEach(f => { const y = pt + ih - f * ih; s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/>`; });
  s += `<text class="ax" x="${pl - 6}" y="${pt + ih + 3}" text-anchor="end">0</text>`;
  s += `<text class="ax" x="${pl - 6}" y="${pt + 3}" text-anchor="end">${ymax}</text>`;
  const oy = Y(level.optimal);
  s += `<line class="opt" x1="${pl}" x2="${W - pr}" y1="${oy}" y2="${oy}"/>`;
  if (win.length > 1) {
    let d = '';
    win.forEach((a, i) => { d += `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(a.steps).toFixed(1)}`; });
    s += `<path d="${d}L${X(win.length - 1).toFixed(1)} ${pt + ih}L${X(0).toFixed(1)} ${pt + ih}Z" fill="url(#ga)"/>`;
    s += `<path class="ln" d="${d}"/>`;
  }
  win.forEach((a, i) => {
    if (a.fell) s += `<circle class="pf" cx="${X(i).toFixed(1)}" cy="${Y(a.steps).toFixed(1)}" r="3"/>`;
    else if (a.timeout) s += `<circle class="pt" cx="${X(i).toFixed(1)}" cy="${Y(a.steps).toFixed(1)}" r="3"/>`;
  });
  if (win.length) { const i = win.length - 1; s += `<circle class="pe" cx="${X(i).toFixed(1)}" cy="${Y(win[i].steps).toFixed(1)}" r="3.6"/>`; }
  s += `<text class="ax" x="${pl}" y="${H - 5}">${first + 1}</text>`;
  s += `<text class="ax" x="${W - pr}" y="${H - 5}" text-anchor="end">attempt ${Math.max(attempts.length, 1)}</text>`;
  svg.innerHTML = s;
  const last = attempts[attempts.length - 1];
  svg.setAttribute('aria-label', attempts.length
    ? `Steps per attempt. Latest attempt took ${last.steps} steps. The shortest route is ${level.optimal}.`
    : 'Steps per attempt. No attempts yet.');
}
