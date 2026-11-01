import './styles/learn.css';
import './styles/gallery.css';
import { GALLERY } from './core/gallery.js';
import { validate, encodeMaze } from './core/custom.js';

const list = document.getElementById('gallery');
GALLERY.forEach(w => {
  const v = validate(w.rows), li = document.createElement('li'); li.className = 'world';
  const grid = document.createElement('div'); grid.className = 'mini'; grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', `Map of ${w.name}`);
  w.rows.join('').split('').forEach(ch => { const c = document.createElement('i'); c.dataset.t = ch; grid.appendChild(c); });
  const body = document.createElement('div'); body.className = 'wbody';
  const h = document.createElement('h3'); h.textContent = w.name;
  const p = document.createElement('p'); p.textContent = w.note;
  const meta = document.createElement('small');
  meta.textContent = `Shortest route ${v.optimal} steps${v.level.needsKey ? ', needs the key' : ''}${w.rows.join('').includes('P') ? ', has pits' : ''}`;
  const a = document.createElement('a'); a.className = 'btn primary'; a.href = `./index.html#maze=${encodeMaze(w.rows)}`; a.textContent = 'Open in the lab';
  a.setAttribute('aria-label', `Open ${w.name} in the lab`);
  body.append(h, p, meta, a); li.append(grid, body); list.appendChild(li);
});
