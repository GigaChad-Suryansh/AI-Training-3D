import './styles/learn.css';
import './styles/gallery.css';
import './styles/hub.css';
import { createStore } from './hub/store.js';
import { checkDraft, rowsOfItem } from './hub/items.js';
import { exportEnvironment } from './core/portable.js';
import { REWARDS } from './core/agent.js';
import { loadCustom } from './core/custom.js';

const $ = s => document.querySelector(s);
const store = createStore();
const state = { kind: 'all', sort: 'new', q: '', user: null };

if (store.adoptRedirect) { if (store.adoptRedirect(location.hash)) history.replaceState(null, '', location.pathname); }

$('#mode').textContent = store.mode === 'local'
  ? 'Local mode: what you publish stays in this browser. Connect a backend (see backend/README.md) to make the hub public.'
  : 'Public hub. Anyone can browse; sign in with your email to publish.';

async function refreshUser() {
  state.user = await store.user();
  const needs = store.mode === 'supabase';
  $('#authBox').hidden = !needs || !!state.user;
  const who = $('#who'); who.hidden = !needs || !state.user;
  if (state.user) { who.textContent = `Signed in as ${state.user.name}. `; const b = document.createElement('button'); b.type = 'button'; b.className = 'link'; b.textContent = 'Sign out'; b.onclick = async () => { await store.signOut(); await refreshUser(); await render(); }; who.appendChild(b); }
}

$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await store.signIn($('#email').value.trim(), location.origin + location.pathname);
  $('#authMsg').textContent = r.ok ? 'Check your email and open the link to finish signing in.' : r.error;
});

function card(item) {
  const li = document.createElement('li'); li.className = 'world';
  const rows = rowsOfItem(item) || [];
  const grid = document.createElement('div'); grid.className = 'mini'; grid.setAttribute('role', 'img'); grid.setAttribute('aria-label', `Map of ${item.title}`);
  rows.join('').split('').forEach(ch => { const c = document.createElement('i'); c.dataset.t = /^[.#PKDSG]$/.test(ch) ? ch : '.'; grid.appendChild(c); });
  const body = document.createElement('div'); body.className = 'wbody';
  const h = document.createElement('h3'); h.textContent = item.title;
  const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = item.kind === 'agent' ? 'Robot' : 'Maze'; h.append(' ', tag);
  const p = document.createElement('p'); p.textContent = item.description || 'No description.';
  const meta = document.createElement('small');
  const c = item.payload && item.payload.card;
  meta.textContent = `By ${item.author_name}` + (item.kind === 'agent' && c ? `, trained for ${c.attempts} attempts${c.mastered ? ', mastered' : ''}` : '');
  const actions = document.createElement('div'); actions.className = 'row-actions';
  const open = document.createElement('button'); open.type = 'button'; open.className = 'btn primary'; open.textContent = item.kind === 'agent' ? 'Watch It Run' : 'Open and Remix';
  open.onclick = () => { try { localStorage.setItem('ai-training-3d:pending-import', JSON.stringify(item.payload)); } catch (e) { /* storage blocked */ } location.href = './index.html'; };
  const like = document.createElement('button'); like.type = 'button'; like.className = 'btn'; like.setAttribute('aria-pressed', item.liked ? 'true' : 'false');
  const paint = () => { like.textContent = `${item.liked ? 'Liked' : 'Like'} · ${item.likes}`; like.setAttribute('aria-pressed', item.liked ? 'true' : 'false'); };
  paint();
  like.onclick = async () => { const r = await store.toggleLike(item.id); if (!r.ok) { $('#authMsg').textContent = r.error || ''; return; } item.liked = r.liked; item.likes = r.likes; paint(); };
  actions.append(open, like);
  if (state.user && (store.mode === 'local' || item.author_id === state.user.id)) {
    const del = document.createElement('button'); del.type = 'button'; del.className = 'btn ghost'; del.textContent = 'Delete';
    del.onclick = async () => { if (confirm('Delete this item?')) { await store.remove(item.id); render(); } };
    actions.appendChild(del);
  }
  body.append(h, p, meta, actions); li.append(grid, body); return li;
}

async function render() {
  const list = $('#items'); list.textContent = '';
  let items = [];
  try { items = await store.list({ kind: state.kind, q: state.q, sort: state.sort }); }
  catch (e) { $('#empty').textContent = 'Could not load the hub. Try again in a moment.'; $('#empty').hidden = false; return; }
  $('#empty').textContent = 'Nothing here yet. Publish the first one above.';
  $('#empty').hidden = items.length > 0;
  items.forEach(i => list.appendChild(card(i)));
}

document.querySelectorAll('#fKind button').forEach(b => b.onclick = () => { state.kind = b.dataset.k; document.querySelectorAll('#fKind button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); render(); });
document.querySelectorAll('#fSort button').forEach(b => b.onclick = () => { state.sort = b.dataset.s; document.querySelectorAll('#fSort button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); render(); });
let t; $('#fQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; render(); }, 200); });

let currentPayload = null; // set by "Use My Maze From the Lab"
$('#pCurrent').onclick = () => {
  currentPayload = exportEnvironment({ rows: loadCustom(), rewards: REWARDS, name: $('#pTitle').value || 'My maze' });
  $('#pKind').value = 'environment'; $('#pFile').required = false;
  $('#pubMsg').textContent = 'Using your saved maze from the lab. Add a title and press Publish.';
};
$('#pFile').addEventListener('change', () => { currentPayload = null; });

$('#pubForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#pubMsg'); let payload = currentPayload;
  if (!payload) {
    const f = $('#pFile').files[0]; if (!f) { msg.textContent = 'Choose a file.'; return; }
    if (f.size > 200000) { msg.textContent = 'That file is too large.'; return; }
    try { payload = JSON.parse(await f.text()); } catch (err) { msg.textContent = 'That file could not be read as JSON.'; return; }
  }
  const draft = { kind: $('#pKind').value, title: $('#pTitle').value, description: $('#pDesc').value, payload };
  const pre = checkDraft(draft); if (!pre.ok) { msg.textContent = pre.error; return; }
  const r = await store.publish(draft);
  if (!r.ok) { msg.textContent = r.error; return; }
  msg.textContent = 'Published.'; e.target.reset(); currentPayload = null; $('#pFile').required = true; render();
});

refreshUser().then(render);
