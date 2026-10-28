import { SIZE, paint, validate, starterRows, encodeMaze } from '../core/custom.js';

const NAMES = { '.': 'floor', '#': 'wall', P: 'pit', K: 'key', D: 'door', S: 'start', G: 'beacon' };
const LABELS = { '.': 'Floor', '#': 'Wall', P: 'Pit', K: 'Key', D: 'Door', S: 'Start', G: 'Beacon' };
const GLYPH = { '.': '', '#': '', P: '', K: 'K', D: 'D', S: 'S', G: '' };

/** Paint-on-a-grid maze editor. Works with mouse, touch, pen and keyboard (Tab to a tile, Enter or Space paints). */
export function initEditor({ rows, onApply, onShare }) {
  const tools = document.getElementById('tools'), grid = document.getElementById('editGrid');
  const status = document.getElementById('editStatus'), apply = document.getElementById('editApply');
  let cur = rows, tool = '#', applied = rows.join(''), painting = false, last = '';

  Object.keys(NAMES).forEach(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.tool = t; b.setAttribute('role', 'radio'); b.className = 'tool';
    b.innerHTML = `<i class="sw c${t === '.' ? 'f' : t === '#' ? 'w' : t}"></i><span>${LABELS[t]}</span>`;
    b.addEventListener('click', () => { tool = t; paintTools(); });
    tools.appendChild(b);
  });
  const paintTools = () => tools.querySelectorAll('.tool').forEach(b => b.setAttribute('aria-checked', b.dataset.tool === tool ? 'true' : 'false'));

  const cells = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'cell'; c.dataset.x = x; c.dataset.y = y;
    grid.appendChild(c); cells.push(c);
  }

  function render() {
    cur.forEach((row, y) => [...row].forEach((ch, x) => {
      const c = cells[y * SIZE + x];
      c.dataset.t = ch; c.textContent = GLYPH[ch];
      c.setAttribute('aria-label', `Row ${y + 1}, column ${x + 1}, ${NAMES[ch]}`);
    }));
    const v = validate(cur), dirty = cur.join('') !== applied;
    apply.disabled = !v.ok;
    status.dataset.ok = v.ok ? '1' : '0';
    status.textContent = v.ok
      ? `Shortest route is ${v.optimal} steps.${dirty ? ' Train on this maze to apply your changes.' : ''}`
      : v.problems[0];
  }

  const at = e => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el && el.classList.contains('cell') && grid.contains(el) ? el : null;
  };
  const stroke = el => {
    if (!el) return;
    const key = el.dataset.x + ',' + el.dataset.y;
    if (key === last) return; last = key;
    cur = paint(cur, +el.dataset.x, +el.dataset.y, tool); render();
  };
  grid.addEventListener('pointerdown', e => {
    const el = at(e); if (!el) return;
    painting = true; last = ''; stroke(el);
    try { grid.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
    e.preventDefault();
  });
  grid.addEventListener('pointermove', e => { if (painting) stroke(at(e)); });
  const stop = () => { painting = false; last = ''; };
  grid.addEventListener('pointerup', stop); grid.addEventListener('pointercancel', stop);
  grid.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); last = ''; stroke(e.target.closest('.cell'));
  });

  apply.addEventListener('click', () => { if (!validate(cur).ok) return; applied = cur.join(''); render(); onApply(cur); });
  document.getElementById('editReset').addEventListener('click', () => { cur = starterRows(); render(); });

  document.getElementById('editShare').addEventListener('click', () => { if (validate(cur).ok) onShare(encodeMaze(cur)); });

  paintTools(); render();
  return { setRows(next) { cur = next; applied = next.join(''); render(); } };
}
