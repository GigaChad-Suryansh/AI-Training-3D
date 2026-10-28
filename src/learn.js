import './styles/learn.css';
import { buildLevel } from './core/levels.js';
import { Learner } from './core/learner.js';
import { epsilonFor } from './core/agent.js';

const $ = (s, r) => (r || document).querySelector(s);
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace(/\.?0+$/, '');

/* ---- one learning step ---- */
const ids = ['Old', 'Rew', 'Next', 'Alpha', 'Gamma'];
function calc() {
  const v = {}; ids.forEach(k => { v[k] = +$('#i' + k).value; $('#o' + k).textContent = k === 'Alpha' || k === 'Gamma' ? v[k].toFixed(2) : sgn(v[k]); });
  const target = v.Rew + v.Gamma * v.Next, gap = target - v.Old, nw = v.Old + v.Alpha * gap;
  $('#calcOut').innerHTML = `What I just saw: ${sgn(v.Rew)} reward + ${v.Gamma.toFixed(2)} &times; ${sgn(v.Next)} = <b>${sgn(target)}</b>.<br>`
    + `The gap from what I expected is ${sgn(gap)}. The note moves ${Math.round(v.Alpha * 100)}% of the way.<br>`
    + `New note: <strong>${sgn(nw)}</strong> (was ${sgn(v.Old)}).`;
}
ids.forEach(k => $('#i' + k).addEventListener('input', calc)); calc();

/* ---- the corridor, using the real learner ---- */
const level = buildLevel({ id: 0, name: 'Corridor', skill: '', brief: '', rows: ['S.....G'] });
const learner = new Learner(level, level.W * level.H * 2, 0);
const track = $('#corTrack'), status = $('#corStatus');
const cells = [];
for (let x = 0; x < level.W; x++) {
  const c = document.createElement('div'); c.className = 'cor-cell' + (x === 0 ? ' s' : x === level.W - 1 ? ' g' : '');
  c.innerHTML = '<span class="ar"></span><small class="val"></small>'; track.appendChild(c); cells.push(c);
}
const ARROWS = ['↑', '→', '↓', '←'];
function drawCorridor() {
  const Q = learner.agent.Q;
  cells.forEach((c, x) => {
    const i = x * 2 * 4, q = [Q[i], Q[i + 1], Q[i + 2], Q[i + 3]];
    const mx = Math.max(...q), tie = q.every(v => Math.abs(v - mx) < 1e-6);
    const goal = x === level.W - 1;
    $('.ar', c).textContent = goal ? '★' : tie ? '?' : ARROWS[q.indexOf(mx)];
    $('.val', c).textContent = goal ? 'beacon' : sgn(mx);
    c.style.setProperty('--heat', goal ? 1 : Math.max(0, Math.min(1, (mx - 1) / 9)));
  });
  const n = learner.attempts.length, ok = learner.attempts.filter(a => a.ok).length, last = learner.attempts[n - 1];
  status.textContent = n ? `${n} attempts so far, ${ok} reached the beacon. Last attempt: ${last.ok ? `reached it in ${last.steps} steps (the shortest is ${level.optimal})` : 'ran out of time'}.` : 'No attempts yet. Every tile looks equally promising.';
}
function run(n) { for (let i = 0; i < n; i++) learner.playSilently(); drawCorridor(); }
document.querySelectorAll('.cor-actions [data-n]').forEach(b => b.addEventListener('click', () => run(+b.dataset.n)));
$('#corForget').addEventListener('click', () => { learner.wipe(); drawCorridor(); });
drawCorridor();

/* ---- exploration ---- */
function eps() {
  const n = +$('#iN').value, e = epsilonFor(n); $('#oN').textContent = n;
  $('#epsFill').style.width = e * 500 + '%';
  $('#epsText').textContent = `After ${n} attempts, about ${Math.round(e * 100)} in every 100 moves are random. The other ${100 - Math.round(e * 100)} follow what it has learned.`;
}
$('#iN').addEventListener('input', eps); eps();
