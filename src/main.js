import './styles/main.css';
import { EV, LEVELS } from './core/levels.js';
import { Agent, Env, REWARDS, DEFAULT_REWARDS, epsilonFor, runEpisode } from './core/agent.js';
import { isMastered, recentSuccess } from './core/mastery.js';
import { MAX_RUNS_PER_LEVEL, addRun, describeRewards, fastestRunId, loadRuns, packAttempts, presetName, removeRun, runsForLevel, saveRuns, summarize, unpackAttempts } from './core/runs.js';
import { createStage } from './view/stage.js';
import { initAppearance } from './ui/theme.js';
import { drawChart } from './ui/chart.js';

const $ = (s, r) => (r || document).querySelector(s);
const agent = new Agent(Math.max(...LEVELS.map(l => l.W * l.H)) * 2);
const S = {
  li: 0, L: null, env: null, attempts: [], tries: 0, paused: false, speed: 1, mastered: false, victory: 0,
  masteredAt: LEVELS.map(() => null), auto: true, heat: true, phase: 'end', wait: 0, best: Infinity,
  masteredNow: null, rewardsEdited: false, runs: loadRuns(), hidden: new Set()
};

const stage = createStage($('#stageHost'));
if (!stage) $('#noWebgl').hidden = false;
const view = stage || new Proxy({}, { get: () => () => {} }); // keeps the app running without WebGL

const fmt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + String(Math.abs(Math.round(v * 100) / 100));

/* ---------- appearance ---------- */
initAppearance($('#appearance'), name => view.setAppearance(name));

/* ---------- keep the scene centered between the floating panels ---------- */
function measureInsets() {
  const wide = window.matchMedia('(min-width: 1001px)').matches;
  const tb = $('#toolbar').getBoundingClientRect(), dock = $('#dock').firstElementChild.getBoundingClientRect();
  const scene = $('#scene').getBoundingClientRect();
  const top = tb.bottom - scene.top + 8;
  const bottom = scene.bottom - $('#dock').getBoundingClientRect().top + 8;
  const right = wide ? window.innerWidth - $('#inspector').getBoundingClientRect().left + 8 : 0;
  view.setInsets({ top, right, bottom: Math.max(bottom, dock.height + 16) });
}
if (typeof ResizeObserver === 'function') new ResizeObserver(measureInsets).observe(document.body);
window.addEventListener('resize', measureInsets);

/* ---------- narration ---------- */
function caption(text, tone) { $('#caption').textContent = text; $('#captionBox').dataset.tone = tone || 'think'; }

/* ---------- levels ---------- */
function renderLevels() {
  const wrap = $('#levels'); wrap.textContent = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-pressed', i === S.li ? 'true' : 'false');
    b.setAttribute('aria-label', `Level ${L.id}, ${L.name}${S.masteredAt[i] ? ', mastered' : ''}`);
    b.innerHTML = '<span class="num"></span><span class="name"></span>';
    $('.num', b).textContent = L.id; $('.name', b).textContent = L.name;
    if (S.masteredAt[i]) b.classList.add('done');
    b.addEventListener('click', () => { if (i !== S.li) loadLevel(i); });
    wrap.appendChild(b);
  });
}

/* ---------- stats ---------- */
function phase() {
  if (S.mastered) return ['mastered', 'Mastered'];
  if (S.attempts.length < 4 || recentSuccess(S.attempts) < 0.4) return ['explore', 'Exploring'];
  return ['improve', 'Improving'];
}
function renderStats() {
  const n = S.attempts.length, r = recentSuccess(S.attempts), last = S.attempts[n - 1];
  $('#stAttempts').textContent = n;
  $('#stSuccess').textContent = Math.round(r * 100) + '%';
  $('#barFill').style.width = r * 100 + '%';
  $('#stBest').textContent = isFinite(S.best) ? S.best : '–';
  $('#stOpt').textContent = S.L.optimal;
  $('#stMist').textContent = last ? last.mistakes : '–';
  $('#saveRun').disabled = n < 5;
  const [key, label] = phase();
  $('#status').dataset.phase = key; $('#phaseText').textContent = label;
}
function renderLive() {
  const m = S.env.bumps + (S.env.fell ? 1 : 0);
  $('#liveText').textContent = `Attempt ${S.attempts.length + 1}, step ${S.env.t} of ${S.L.maxSteps}, ${m} ${m === 1 ? 'mistake' : 'mistakes'}`;
}
function updateHeat() {
  const L = S.L, arr = new Float32Array(L.W * L.H);
  if (S.heat) {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, Math.min(1, (agent.maxQ(i * 2 + S.env.k) - 1) / 9));
    arr[L.goal.y * L.W + L.goal.x] = 1;
  }
  view.setHeat(arr);
}

/* ---------- banner ---------- */
function showBanner(title, text, actions) {
  const b = $('#banner'); b.textContent = '';
  const h = document.createElement('strong'); h.textContent = title;
  const p = document.createElement('span'); p.textContent = text;
  b.append(h, p);
  if (actions && actions.length) {
    const row = document.createElement('div'); row.className = 'actions';
    actions.forEach(a => { const x = document.createElement('button'); x.type = 'button'; x.className = 'btn primary'; x.textContent = a.label; x.addEventListener('click', a.fn); row.appendChild(x); });
    b.appendChild(row);
  }
  b.hidden = false;
}
const hideBanner = () => { $('#banner').hidden = true; };

/* ---------- episode flow ---------- */
function loadLevel(i) {
  S.li = i; S.L = LEVELS[i]; S.env = new Env(S.L);
  S.attempts = []; S.tries = 0; S.mastered = false; S.victory = 0; S.best = Infinity; S.masteredNow = null; S.rewardsEdited = false;
  hideBanner(); view.loadLevel(S.L);
  $('#briefText').textContent = `${S.L.name}. ${S.L.brief}`;
  $('.rw[data-k="key"]').classList.toggle('off', !S.L.key);
  renderLevels(); renderStats(); renderRuns(); redraw();
  startEpisode();
}
function resetBrain() { agent.wipe(); S.masteredAt = LEVELS.map(() => null); loadLevel(S.li); }

function startEpisode() {
  const L = S.L; S.env.reset();
  view.resetItems(); view.trailClear(); view.trailAdd(L.start.x, L.start.y); view.placeBot(L.start.x, L.start.y); view.spawnBot();
  S.phase = 'run'; S.wait = 0.5 / Math.sqrt(S.speed);
  const n = S.attempts.length + 1;
  if (S.mastered) caption(`Victory lap. It follows the best route it knows.`, 'think');
  else if (n === 1) caption('Attempt 1. It has no map yet, so every move is a guess.', 'think');
  else caption(`Attempt ${n}. Using what it learned so far.`, 'think');
  renderLive(); updateHeat(); renderStats();
}

function bookkeep(st) {
  S.attempts.push(st); S.tries++;
  if (st.ok && st.steps < S.best) S.best = st.steps;
  if (S.mastered) {
    if (st.ok) S.victory++; else { S.mastered = false; S.victory = 0; hideBanner(); }
  } else if (isMastered(S.attempts, S.L.optimal)) {
    S.mastered = true; S.victory = 0; S.masteredAt[S.li] = S.attempts.length; if (!S.masteredNow) S.masteredNow = S.attempts.length; renderLevels();
    const n = S.attempts.length;
    if (S.li === LEVELS.length - 1) {
      showBanner('All Four Levels Mastered', `The last skill took ${n} attempts. Change the rewards and watch it adapt.`, [{ label: 'Start Over', fn: resetBrain }]);
    } else {
      showBanner(`Level ${S.L.id} Mastered`, `Solved reliably after ${n} attempts.${S.auto ? ' Moving on after a couple of victory laps.' : ''}`, [{ label: 'Next Level', fn: () => loadLevel(S.li + 1) }]);
    }
  }
  renderStats(); redraw();
  $('#srStatus').textContent = `Attempt ${S.attempts.length} ${st.ok ? `reached the beacon in ${st.steps} steps` : 'did not reach the beacon'}.`;
}
const epsilon = () => (S.mastered ? 0 : epsilonFor(S.tries));

function doStep() {
  const env = S.env, a = agent.act(env.state(), epsilon());
  const r = env.step(a); agent.learn(r.s0, a, r.s2, r.ev);
  const dur = Math.max(0.035, 0.24 / S.speed);
  const kind = r.ev === EV.BUMP ? 'bump' : r.ev === EV.PIT ? 'fall' : r.ev === EV.GOAL ? 'goal' : 'step';
  view.botMove(r.px, r.py, a, r.x, r.y, kind, kind === 'fall' ? 0.45 : kind === 'goal' ? 0.3 : dur);
  S.wait = kind === 'fall' ? 0.4 : dur;
  view.trailAdd(r.x, r.y);
  if (r.ev === EV.BUMP) { view.setMood('bad'); view.ripple(r.px, r.py, 'warn', 1.6); caption(`Bumped into a wall or a locked door (${fmt(REWARDS.bump)}). It will try another way.`, 'bad'); }
  else if (r.ev === EV.KEY) { view.takeKey(); view.setMood('key'); view.burst(r.x, r.y, 'amber'); view.ripple(r.x, r.y, 'amber', 2.6); caption(`Picked up the key (${fmt(REWARDS.key)}). The door is open now.`, 'key'); }
  else if (r.ev === EV.PIT) { view.setMood('bad'); view.burst(r.x, r.y, 'warn'); view.ripple(r.x, r.y, 'warn', 2.4); caption(`Fell into a pit (${fmt(REWARDS.pit)}). It now rates that tile as dangerous.`, 'bad'); }
  else if (r.ev === EV.GOAL) { view.setMood('happy'); view.burst(r.x, r.y, 'accent'); view.ripple(r.x, r.y, 'accent', 4.2); caption(`Reached the beacon (${fmt(REWARDS.goal)}) in ${env.t} steps. Shortest possible is ${S.L.optimal}.`, 'think'); }
  else if (r.timeout) caption('Out of time. It will use what it saw and try again.', 'bad');
  renderLive(); updateHeat();
  if (r.done || r.timeout) {
    bookkeep({ ok: r.ev === EV.GOAL, steps: env.t, mistakes: env.bumps + (env.fell ? 1 : 0), fell: env.fell, timeout: r.timeout });
    S.phase = 'end';
    S.wait = (r.ev === EV.GOAL ? 1.5 : r.ev === EV.PIT ? 1.0 : 0.8) / Math.pow(S.speed, 0.6);
  }
}
function afterPause() {
  if (S.mastered && S.auto && S.victory >= 2 && S.li < LEVELS.length - 1) { loadLevel(S.li + 1); return; }
  startEpisode();
}

let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (S.paused) return;
  S.wait -= dt;
  for (let g = 0; S.wait <= 0 && g < 6; g++) { if (S.phase === 'run') doStep(); else afterPause(); }
}

function skip(n) {
  const keep = S.paused; S.paused = true;
  for (let i = 0; i < n; i++) {
    const was = S.mastered, res = runEpisode(S.env, agent, epsilon());
    bookkeep(res);
    if (!was && S.mastered) break;
  }
  S.paused = keep; startEpisode();
  caption('Skipped ahead. Its map has filled in, so watch how it moves now.', 'think');
}

/* ---------- controls ---------- */
const playBtn = $('#play');
function setPaused(p) { S.paused = p; playBtn.classList.toggle('paused', p); playBtn.setAttribute('aria-label', p ? 'Resume' : 'Pause'); }
playBtn.addEventListener('click', () => setPaused(!S.paused));
document.querySelectorAll('#speed [data-speed]').forEach(b => b.addEventListener('click', () => {
  S.speed = +b.dataset.speed;
  document.querySelectorAll('#speed [data-speed]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
}));
$('#skip').addEventListener('click', () => skip(25));
$('#reset').addEventListener('click', resetBrain);
$('#heatToggle').addEventListener('change', e => { S.heat = e.target.checked; updateHeat(); });
$('#autoToggle').addEventListener('change', e => { S.auto = e.target.checked; });
document.addEventListener('keydown', e => {
  if (e.code !== 'Space') return;
  const t = e.target && e.target.tagName;
  if (t === 'INPUT' || t === 'BUTTON' || t === 'TEXTAREA' || t === 'SUMMARY') return;
  e.preventDefault(); setPaused(!S.paused);
});

/* ---------- rewards ---------- */
const RW = [
  { k: 'goal', label: 'Reach the Beacon', min: 0, max: 20, step: 0.5 },
  { k: 'key', label: 'Pick Up the Key', min: 0, max: 10, step: 0.5 },
  { k: 'pit', label: 'Fall Into a Pit', min: -20, max: 0, step: 0.5 },
  { k: 'bump', label: 'Hit a Wall', min: -3, max: 0, step: 0.1 },
  { k: 'step', label: 'Take a Step', min: -0.5, max: 0, step: 0.01 }
];
const PRESETS = {
  Default: DEFAULT_REWARDS,
  Cautious: { ...DEFAULT_REWARDS, pit: -20, bump: -1.5 },
  Reckless: { ...DEFAULT_REWARDS, pit: -1, bump: 0, step: -0.02 }
};
function rewardsChanged() {
  S.tries = Math.min(S.tries, 25); // curiosity returns so it can re-test old habits
  if (S.attempts.length) S.rewardsEdited = true;
  if (S.mastered) { S.mastered = false; S.victory = 0; hideBanner(); renderStats(); }
}
RW.forEach(r => {
  const row = document.createElement('div'); row.className = 'rw'; row.dataset.k = r.k;
  row.innerHTML = '<label></label><output></output><input type="range">';
  const lab = $('label', row), out = $('output', row), inp = $('input', row);
  inp.id = 'rw-' + r.k; lab.htmlFor = inp.id; lab.textContent = r.label;
  inp.min = r.min; inp.max = r.max; inp.step = r.step; inp.value = REWARDS[r.k];
  r.paint = () => { out.textContent = fmt(+inp.value); inp.style.setProperty('--f', ((inp.value - r.min) / (r.max - r.min)) * 100 + '%'); };
  r.inp = inp; r.paint();
  inp.addEventListener('input', () => { REWARDS[r.k] = +inp.value; r.paint(); rewardsChanged(); });
  $('#rewards').appendChild(row);
});
Object.keys(PRESETS).forEach(name => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = name;
  b.addEventListener('click', () => {
    RW.forEach(r => { REWARDS[r.k] = PRESETS[name][r.k]; r.inp.value = PRESETS[name][r.k]; r.paint(); });
    rewardsChanged(); caption(`Rewards set to ${name}. They apply from the next move.`, 'think');
  });
  $('#presets').appendChild(b);
});


/* ---------- compare runs ---------- */
const EYE = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z"/><circle cx="10" cy="10" r="2.4"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 2.5l15 15M8.2 4.7C8.8 4.6 9.4 4.5 10 4.5c5 0 8.2 5.5 8.2 5.5s-.8 1.4-2.2 2.8M5.3 6.3C3.1 7.8 1.8 10 1.8 10s3.2 5.5 8.2 5.5c1.3 0 2.5-.4 3.5-.9"/></svg>';
const TRASH = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.8h4v1.7M5.5 5.5l.7 10.2h7.6l.7-10.2M8.4 9v4.2M11.6 9v4.2"/></svg>';

const levelRuns = () => runsForLevel(S.runs, S.L.id);
const visibleOverlays = () => levelRuns().filter(r => !S.hidden.has(r.id)).map(r => ({ slot: r.slot, name: r.name, attempts: unpackAttempts(r.attempts), masteredAt: r.masteredAt }));
function redraw() {
  const overlays = visibleOverlays();
  drawChart($('#chart'), S.L, { attempts: S.attempts, masteredAt: S.masteredNow }, overlays);
  $('#chartNote').hidden = overlays.length === 0;
}

function renderRuns() {
  const list = $('#runList'); list.textContent = '';
  const runs = levelRuns(), fastest = fastestRunId(runs);
  if (!runs.length) {
    const li = document.createElement('li'); li.className = 'run empty'; li.textContent = 'No saved runs for this level yet.'; list.appendChild(li);
  }
  runs.forEach(r => {
    const sum = summarize(r), shown = !S.hidden.has(r.id);
    const li = document.createElement('li'); li.className = 'run';
    li.innerHTML = '<svg class="swatch" viewBox="0 0 30 10" aria-hidden="true"><line x1="2" x2="28" y1="5" y2="5"/></svg>'
      + '<div class="info"><div class="title"><span></span></div><small class="a"></small><small class="b"></small></div>'
      + '<button type="button" class="icon-btn eye"></button><button type="button" class="icon-btn del"></button>';
    $('.swatch line', li).setAttribute('class', 'r' + r.slot);
    $('.title span', li).textContent = r.name;
    if (r.id === fastest) { const t = document.createElement('i'); t.className = 'tag'; t.style.fontStyle = 'normal'; t.textContent = 'Fastest'; $('.title', li).appendChild(t); }
    $('.a', li).textContent = sum.masteredAt
      ? `Mastered in ${sum.masteredAt} attempts, best route ${sum.best}`
      : `${sum.attempts} attempts, not mastered${sum.best ? `, best route ${sum.best}` : ''}`;
    $('.b', li).textContent = describeRewards(r.rewards, DEFAULT_REWARDS);
    const eye = $('.eye', li), del = $('.del', li);
    eye.innerHTML = shown ? EYE : EYE_OFF; eye.setAttribute('aria-pressed', shown ? 'true' : 'false');
    eye.setAttribute('aria-label', `${shown ? 'Hide' : 'Show'} ${r.name} on the chart`); eye.title = shown ? 'Hide on chart' : 'Show on chart';
    del.innerHTML = TRASH; del.setAttribute('aria-label', `Delete ${r.name}`); del.title = 'Delete run';
    eye.addEventListener('click', () => { shown ? S.hidden.add(r.id) : S.hidden.delete(r.id); renderRuns(); redraw(); });
    del.addEventListener('click', () => { S.runs = removeRun(S.runs, r.id); S.hidden.delete(r.id); saveRuns(S.runs); renderRuns(); redraw(); });
    list.appendChild(li);
  });
}

$('#saveRun').addEventListener('click', () => {
  const base = S.rewardsEdited ? 'Mixed rewards' : presetName(REWARDS, PRESETS);
  const same = levelRuns().filter(r => r.name === base || r.name.startsWith(base + ' ')).length;
  const run = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)),
    levelId: S.L.id, name: same ? `${base} ${same + 1}` : base, savedAt: Date.now(),
    rewards: { ...REWARDS }, attempts: packAttempts(S.attempts.slice(0, 300)), masteredAt: S.masteredNow && S.masteredNow <= 300 ? S.masteredNow : null
  };
  const res = addRun(S.runs, run);
  if (res.error) { caption(`This level already has ${MAX_RUNS_PER_LEVEL} saved runs. Delete one to save another.`, 'bad'); return; }
  S.runs = res.runs;
  const stored = saveRuns(S.runs);
  caption(stored ? `Saved ${run.name}. Reset the brain or change the rewards, then train again to compare.` : `Saved ${run.name} for this visit only. Browser storage is unavailable.`, 'think');
  renderRuns(); redraw();
});

/* ---------- go ---------- */
loadLevel(0);
measureInsets();
requestAnimationFrame(loop);
window.__lab = { S, agent, skip, loadLevel }; // handy in the console and in screenshots
