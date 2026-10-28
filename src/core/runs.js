/**
 * Saved runs: a finished (or in-progress) training run kept so it can be
 * compared with others on the same level. Pure data, no DOM. Storage is
 * injected so tests can use a fake one.
 */
export const MAX_RUNS_PER_LEVEL = 4;
const KEY = 'ai-training-3d:runs:v1';

/** Attempts are stored as small arrays to keep localStorage use low. */
export const packAttempts = list => list.map(a => [a.ok ? 1 : 0, a.steps, a.mistakes, a.fell ? 1 : 0, a.timeout ? 1 : 0]);
export const unpackAttempts = packed => packed.map(([ok, steps, mistakes, fell, timeout]) => ({ ok: !!ok, steps, mistakes, fell: !!fell, timeout: !!timeout }));

function defaultStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (e) { return null; }
}

function valid(r) {
  return r && typeof r.id === 'string' && Number.isInteger(r.levelId) && Number.isInteger(r.slot) && r.slot >= 0 && r.slot < MAX_RUNS_PER_LEVEL
    && typeof r.name === 'string' && r.rewards && typeof r.rewards === 'object'
    && Array.isArray(r.attempts) && r.attempts.every(a => Array.isArray(a) && a.length === 5 && a.every(Number.isFinite));
}

/** Reads saved runs. Anything malformed is dropped instead of crashing the app. */
export function loadRuns(storage = defaultStorage()) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(valid) : [];
  } catch (e) { return []; }
}

/** Returns true when the write worked. Storage can be full or blocked. */
export function saveRuns(runs, storage = defaultStorage()) {
  if (!storage) return false;
  try { storage.setItem(KEY, JSON.stringify(runs)); return true; } catch (e) { return false; }
}

export const runsForLevel = (runs, levelId) => runs.filter(r => r.levelId === levelId).sort((a, b) => a.slot - b.slot);

/** Adds a run in the lowest free slot for its level. Fails when the level already has four. */
export function addRun(runs, run) {
  const taken = new Set(runsForLevel(runs, run.levelId).map(r => r.slot));
  let slot = 0;
  while (taken.has(slot)) slot++;
  if (slot >= MAX_RUNS_PER_LEVEL) return { runs, error: 'full' };
  return { runs: [...runs, { ...run, slot }], error: null };
}

export const removeRun = (runs, id) => runs.filter(r => r.id !== id);

/** Headline numbers for one run. */
export function summarize(run) {
  const a = unpackAttempts(run.attempts);
  const wins = a.filter(x => x.ok);
  return {
    attempts: a.length,
    masteredAt: run.masteredAt || null,
    best: wins.length ? Math.min(...wins.map(x => x.steps)) : null,
    mistakes: a.reduce((s, x) => s + x.mistakes, 0)
  };
}

/** Id of the run that mastered the level in the fewest attempts, or null if none did or there is a tie for first. */
export function fastestRunId(runs) {
  const done = runs.filter(r => r.masteredAt).sort((a, b) => a.masteredAt - b.masteredAt);
  if (!done.length) return null;
  if (done.length > 1 && done[0].masteredAt === done[1].masteredAt) return null;
  return done[0].id;
}

/** Name of the preset whose values equal these rewards, or 'Custom'. */
export function presetName(rewards, presets) {
  const keys = Object.keys(rewards);
  for (const [name, p] of Object.entries(presets)) {
    if (keys.every(k => Math.abs(rewards[k] - p[k]) < 1e-9)) return name;
  }
  return 'Custom';
}

/** Lists only the rewards that differ from the defaults, e.g. "Pit -20, Wall -1.5". */
export function describeRewards(rewards, defaults) {
  const labels = { goal: 'Beacon', key: 'Key', pit: 'Pit', bump: 'Wall', step: 'Step' };
  const fmt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + String(Math.abs(Math.round(v * 100) / 100));
  const diff = Object.keys(labels).filter(k => Math.abs(rewards[k] - defaults[k]) > 1e-9).map(k => `${labels[k]} ${fmt(rewards[k])}`);
  return diff.length ? diff.join(', ') : 'Default rewards';
}

/** Moving average, used so noisy per-attempt curves can be compared. */
export function movingAverage(values, window = 5) {
  return values.map((_, i) => {
    const from = Math.max(0, i - window + 1), slice = values.slice(from, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}
