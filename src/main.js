import './styles/main.css';
import { EV, LEVELS } from './core/levels.js';
import { REWARDS, DEFAULT_REWARDS } from './core/agent.js';
import { recentSuccess } from './core/mastery.js';
import { Learner, MAX_ROBOTS, freeSlot } from './core/learner.js';
import { MAX_RUNS_PER_LEVEL, addRun, describeRewards, fastestRunId, loadRuns, packAttempts, presetName, removeRun, runsForLevel, saveRuns, summarize, unpackAttempts } from './core/runs.js';
import { createStage } from './view/stage.js';
import { initAppearance } from './ui/theme.js';
import { drawChart, drawRace } from './ui/chart.js';
import { initTokenDrag } from './ui/dragdrop.js';

const $ = (s, r) => (r || document).querySelector(s);
const NUM_STATES = Math.max(...LEVELS.map(l => l.W * l.H)) * 2;

/** Shared state. Each robot keeps its own brain and record inside its Learner. */
const S = { li: 0, L: null, paused: false, speed: 1, auto: true, heat: true, masteredAt: LEVELS.map(() => null), runs: loadRuns(), hidden: new Set() };
const robots = []; // { learner, h }  h is the 3D handle
let selected = null;

const stage = createStage($('#stageHost'));
if (!stage) $('#noWebgl').hidden = false;
const noopHandle = new Proxy({}, { get: () => () => {} });
const view = stage || new Proxy({}, { get: (_, k) => (k === 'addBot' ? () => noopHandle : () => {}) }); // keeps the app running without WebGL

const fmt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + String(Math.abs(Math.round(v * 100) / 100));
const sel = () => selected.learner;

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

/* ---------- stats for the selected robot ---------- */
function phaseOf(ln) {
  if (ln.mastered) return ['mastered', 'Mastered'];
  if (ln.attempts.length < 4 || recentSuccess(ln.attempts) < 0.4) return ['explore', 'Exploring'];
  return ['improve', 'Improving'];
}
function renderStats() {
  const ln = sel(), n = ln.attempts.length, r = recentSuccess(ln.attempts), last = ln.attempts[n - 1];
  $('#stAttempts').textContent = n;
  $('#stSuccess').textContent = Math.round(r * 100) + '%';
  $('#barFill').style.width = r * 100 + '%';
  $('#stBest').textContent = isFinite(ln.best) ? ln.best : '–';
  $('#stOpt').textContent = S.L.optimal;
  $('#stMist').textContent = last ? last.mistakes : '–';
  $('#saveRun').disabled = n < 5;
  const [key, label] = phaseOf(ln);
  $('#status').dataset.phase = key;
  $('#phaseText').textContent = robots.length > 1 ? `${ln.name}, ${label}` : label;
}
function renderLive() {
  const ln = sel(), env = ln.env, m = env.bumps + (env.fell ? 1 : 0);
  $('#liveText').textContent = `Attempt ${ln.attempts.length + 1}, step ${env.t} of ${S.L.maxSteps}, ${m} ${m === 1 ? 'mistake' : 'mistakes'}`;
}
function updateHeat() {
  const ln = sel(), L = S.L, arr = new Float32Array(L.W * L.H);
  if (S.heat) {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, Math.min(1, (ln.agent.maxQ(i * 2 + ln.env.k) - 1) / 9));
    arr[L.goal.y * L.W + L.goal.x] = 1;
  }
  view.setHeat(arr);
  view.setFocusKey(!!ln.env.k);
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

const TRASH = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.8h4v1.7M5.5 5.5l.7 10.2h7.6l.7-10.2M8.4 9v4.2M11.6 9v4.2"/></svg>';

/* ---------- robots: list, tray, selection ---------- */
function renderBots() {
  const list = $('#botList'); list.textContent = '';
  robots.forEach(r => {
    const ln = r.learner, n = ln.attempts.length, li = document.createElement('li'); li.className = 'bot';
    li.innerHTML = '<button type="button" class="bot-select"><span class="badge"></span><span class="bot-info"><b></b><small></small></span></button><button type="button" class="icon-btn del"></button>';
    const pick = $('.bot-select', li);
    $('.badge', li).className = 'badge b' + ln.slot; $('.badge', li).textContent = ln.slot + 1;
    $('b', li).textContent = ln.name;
    $('small', li).textContent = ln.mastered ? `Mastered in ${ln.masteredNow} attempts, best route ${ln.best}`
      : n ? `${n} attempts, ${Math.round(recentSuccess(ln.attempts) * 100)}% success lately` : 'Just arrived, no experience yet';
    pick.setAttribute('aria-pressed', r === selected ? 'true' : 'false');
    pick.setAttribute('aria-label', `${ln.name}${r === selected ? ', selected' : ''}`);
    pick.addEventListener('click', () => select(r));
    const del = $('.del', li);
    del.innerHTML = TRASH; del.setAttribute('aria-label', `Remove ${ln.name}`); del.title = 'Remove robot';
    del.hidden = robots.length < 2;
    del.addEventListener('click', () => removeRobot(r));
    list.appendChild(li);
  });
  $('#addBot').disabled = robots.length >= MAX_ROBOTS;
  $('#botCount').textContent = `${robots.length} of ${MAX_ROBOTS}`;
  $('#token').setAttribute('aria-disabled', robots.length >= MAX_ROBOTS ? 'true' : 'false');
}

function select(r) {
  selected = r;
  robots.forEach(x => x.h.setFocused(x === r));
  renderBots(); renderStats(); renderLive(); updateHeat(); renderRuns(); redraw();
}

function addRobot(drop) {
  const slot = freeSlot(robots.map(r => r.learner));
  if (slot < 0) return null;
  const r = { learner: new Learner(S.L, NUM_STATES, slot), h: view.addBot(slot) };
  robots.push(r); robots.sort((a, b) => a.learner.slot - b.learner.slot);
  if (!selected) selected = r;
  r.h.setFocused(r === selected);
  startEpisode(r, drop);
  renderBots(); renderStats(); renderRuns(); redraw();
  return r;
}

function removeRobot(r) {
  if (robots.length < 2) return;
  const wasSelected = r === selected, name = r.learner.name;
  r.h.remove(); robots.splice(robots.indexOf(r), 1);
  if (wasSelected) select(robots[0]); else { robots.forEach(x => x.h.setFocused(x === selected)); renderBots(); renderRuns(); redraw(); }
  caption(`${name} left the maze.`, 'think');
}

function userAddRobot() {
  const r = addRobot(true);
  if (r) caption(`${r.learner.name} dropped in at the start. It has no experience yet, so watch how fast it catches up.`, 'think');
}

initTokenDrag({
  token: $('#token'), host: $('#stageHost'), scene: $('#scene'),
  makeGhost: () => {
    const g = document.createElement('div'); g.className = 'ghost';
    g.innerHTML = $('#token').innerHTML; g.style.color = `var(--bot${freeSlot(robots.map(r => r.learner))})`;
    return g;
  },
  canAdd: () => robots.length < MAX_ROBOTS,
  onAdd: userAddRobot,
  onRefuse: () => caption(`The maze already has ${MAX_ROBOTS} robots. Remove one to add another.`, 'bad'),
  onMiss: () => caption('Drop the robot onto the maze to add it.', 'think')
});
$('#addBot').addEventListener('click', userAddRobot);

/* ---------- episode flow ---------- */
function loadLevel(i) {
  S.li = i; S.L = LEVELS[i];
  hideBanner(); view.loadLevel(S.L);
  $('#briefText').textContent = `${S.L.name}. ${S.L.brief}`;
  $('.rw[data-k="key"]').classList.toggle('off', !S.L.key);
  renderLevels();
  if (!robots.length) addRobot(false);
  else {
    robots.forEach(r => { r.learner.resetForLevel(S.L); startEpisode(r); });
    renderBots(); renderStats(); renderRuns(); redraw();
  }
}
function resetBrain() { robots.forEach(r => r.learner.wipe()); S.masteredAt = LEVELS.map(() => null); loadLevel(S.li); }

function startEpisode(r, drop) {
  const L = S.L, ln = r.learner;
  ln.beginAttempt();
  r.h.trailClear(); r.h.trailAdd(L.start.x, L.start.y); r.h.place(L.start.x, L.start.y);
  if (drop) r.h.dropIn(); else r.h.spawn();
  ln.wait = (drop ? 0.9 : 0.5) / Math.sqrt(S.speed) + ln.slot * 0.05;
  if (r !== selected) return;
  const n = ln.attempts.length + 1;
  if (ln.mastered) caption('Victory lap. It follows the best route it knows.', 'think');
  else if (n === 1) caption('Attempt 1. It has no map yet, so every move is a guess.', 'think');
  else caption(`Attempt ${n}. Using what it learned so far.`, 'think');
  renderLive(); updateHeat(); renderStats();
}

function rankingText() {
  return robots.filter(x => x.learner.masteredNow).sort((a, b) => a.learner.masteredNow - b.learner.masteredNow)
    .map(x => `${x.learner.name} in ${x.learner.masteredNow}`).join(', ');
}

/** Everything that happens after any robot finishes an attempt. */
function afterAttempt(r, out) {
  const ln = r.learner;
  if (out.lostMastery) hideBanner();
  if (out.justMastered) {
    const all = robots.every(x => x.learner.mastered), last = S.li === LEVELS.length - 1, multi = robots.length > 1;
    if (multi && !all) caption(`${ln.name} mastered the level in ${ln.masteredNow} attempts. The others are still learning.`, 'think');
    if (all) {
      S.masteredAt[S.li] = sel().masteredNow; renderLevels();
      const detail = multi ? `${rankingText()} attempts.` : `Solved reliably after ${sel().masteredNow} attempts.`;
      if (last) showBanner('All Four Levels Mastered', `${multi ? detail : `The last skill took ${sel().masteredNow} attempts.`} Change the rewards and watch them adapt.`, [{ label: 'Start Over', fn: resetBrain }]);
      else showBanner(`Level ${S.L.id} Mastered`, `${detail}${S.auto ? ' Moving on after a couple of victory laps.' : ''}`, [{ label: 'Next Level', fn: () => loadLevel(S.li + 1) }]);
    }
  }
  renderBots(); if (r === selected) renderStats(); redraw();
  if (r === selected) $('#srStatus').textContent = `Attempt ${ln.attempts.length} ${out.stat.ok ? `reached the beacon in ${out.stat.steps} steps` : 'did not reach the beacon'}.`;
}

function doStep(r) {
  const ln = r.learner, env = ln.env, isSel = r === selected;
  const res = ln.step(), a = res.a;
  const dur = Math.max(0.035, 0.24 / S.speed);
  const kind = res.ev === EV.BUMP ? 'bump' : res.ev === EV.PIT ? 'fall' : res.ev === EV.GOAL ? 'goal' : 'step';
  r.h.move(res.px, res.py, a, res.x, res.y, kind, kind === 'fall' ? 0.45 : kind === 'goal' ? 0.3 : dur);
  ln.wait = kind === 'fall' ? 0.4 : dur;
  r.h.trailAdd(res.x, res.y);
  const who = robots.length > 1 ? `${ln.name}: ` : '';
  if (res.ev === EV.BUMP) { r.h.setMood('bad'); view.ripple(res.px, res.py, 'warn', 1.6); if (isSel) caption(`${who}Bumped into a wall or a locked door (${fmt(REWARDS.bump)}). It will try another way.`, 'bad'); }
  else if (res.ev === EV.KEY) { r.h.setMood('key'); view.burst(res.x, res.y, 'amber'); view.ripple(res.x, res.y, 'amber', 2.6); if (isSel) caption(`${who}Picked up the key (${fmt(REWARDS.key)}). The door is open for it now.`, 'key'); }
  else if (res.ev === EV.PIT) { r.h.setMood('bad'); view.burst(res.x, res.y, 'warn'); view.ripple(res.x, res.y, 'warn', 2.4); if (isSel) caption(`${who}Fell into a pit (${fmt(REWARDS.pit)}). It now rates that tile as dangerous.`, 'bad'); }
  else if (res.ev === EV.GOAL) { r.h.setMood('happy'); view.burst(res.x, res.y, 'accent'); view.ripple(res.x, res.y, 'accent', 4.2); if (isSel) caption(`${who}Reached the beacon (${fmt(REWARDS.goal)}) in ${env.t} steps. Shortest possible is ${S.L.optimal}.`, 'think'); }
  else if (res.timeout && isSel) caption(`${who}Out of time. It will use what it saw and try again.`, 'bad');
  if (isSel) { renderLive(); updateHeat(); }
  if (res.done || res.timeout) {
    const out = ln.finish(res);
    ln.phase = 'end';
    ln.wait = (res.ev === EV.GOAL ? 1.5 : res.ev === EV.PIT ? 1.0 : 0.8) / Math.pow(S.speed, 0.6);
    afterAttempt(r, out);
  }
}

/** Returns true when it switched levels, so the loop stops using stale robots. */
function afterPause(r) {
  if (S.auto && robots.every(x => x.learner.mastered) && sel().victory >= 2 && S.li < LEVELS.length - 1) { loadLevel(S.li + 1); return true; }
  startEpisode(r);
  return false;
}

let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (S.paused) return;
  for (const r of robots.slice()) {
    const ln = r.learner; ln.wait -= dt;
    for (let g = 0; ln.wait <= 0 && g < 6; g++) {
      if (ln.phase === 'run') doStep(r); else if (afterPause(r)) return;
    }
  }
}

function skip(n) {
  const keep = S.paused; S.paused = true;
  robots.forEach(r => {
    for (let i = 0; i < n; i++) {
      const out = r.learner.playSilently();
      afterAttempt(r, out);
      if (out.justMastered) break;
    }
  });
  S.paused = keep;
  robots.forEach(r => startEpisode(r));
  caption('Skipped ahead. Their maps have filled in, so watch how they move now.', 'think');
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
  if (t === 'INPUT' || t === 'BUTTON' || t === 'TEXTAREA' || t === 'SUMMARY' || (e.target && e.target.id === 'token')) return;
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
  robots.forEach(r => r.learner.rewardsChanged()); // curiosity returns so they can re-test old habits
  hideBanner(); renderStats(); renderBots();
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

/* ---------- chart and saved runs ---------- */
const EYE = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z"/><circle cx="10" cy="10" r="2.4"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 2.5l15 15M8.2 4.7C8.8 4.6 9.4 4.5 10 4.5c5 0 8.2 5.5 8.2 5.5s-.8 1.4-2.2 2.8M5.3 6.3C3.1 7.8 1.8 10 1.8 10s3.2 5.5 8.2 5.5c1.3 0 2.5-.4 3.5-.9"/></svg>';

const levelRuns = () => runsForLevel(S.runs, S.L.id);
const visibleOverlays = () => levelRuns().filter(r => !S.hidden.has(r.id)).map(r => ({ slot: r.slot, name: r.name, attempts: unpackAttempts(r.attempts), masteredAt: r.masteredAt }));

function redraw() {
  const multi = robots.length > 1, note = $('#chartNote'), svg = $('#chart');
  $('#runsHint').hidden = !multi;
  if (multi) {
    drawRace(svg, S.L, robots.map(r => ({ slot: r.learner.slot, name: r.learner.name, attempts: r.learner.attempts, masteredAt: r.learner.masteredNow })), sel().slot);
    note.hidden = false;
    note.textContent = 'Each robot has its own color and line style. Curves show a 5-attempt average, and a dot marks the attempt where a robot mastered the level.';
  } else {
    const overlays = visibleOverlays();
    drawChart(svg, S.L, { attempts: sel().attempts, masteredAt: sel().masteredNow }, overlays);
    note.hidden = overlays.length === 0;
    note.textContent = 'The teal line is this run. Curves show a 5-attempt average, and a dot marks the attempt where a run mastered the level.';
  }
  document.querySelectorAll('.legend .raw-only').forEach(el => { el.hidden = multi || visibleOverlays().length > 0; });
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
  const ln = sel();
  const base = ln.rewardsEdited ? 'Mixed rewards' : presetName(REWARDS, PRESETS);
  const same = levelRuns().filter(r => r.name === base || r.name.startsWith(base + ' ')).length;
  const run = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)),
    levelId: S.L.id, name: same ? `${base} ${same + 1}` : base, savedAt: Date.now(),
    rewards: { ...REWARDS }, attempts: packAttempts(ln.attempts.slice(0, 300)), masteredAt: ln.masteredNow && ln.masteredNow <= 300 ? ln.masteredNow : null
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
window.__lab = { S, robots, skip, loadLevel, addRobot }; // handy in the console and in screenshots
