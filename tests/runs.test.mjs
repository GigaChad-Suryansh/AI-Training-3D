import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_RUNS_PER_LEVEL, addRun, describeRewards, fastestRunId, loadRuns, movingAverage, packAttempts,
  presetName, removeRun, runsForLevel, saveRuns, summarize, unpackAttempts
} from '../src/core/runs.js';

const DEFAULTS = { goal: 10, key: 3, pit: -10, bump: -0.5, step: -0.05 };
const attempts = [
  { ok: false, steps: 60, mistakes: 4, fell: false, timeout: true },
  { ok: true, steps: 30, mistakes: 2, fell: false, timeout: false },
  { ok: true, steps: 18, mistakes: 0, fell: false, timeout: false }
];
const make = (id, levelId, masteredAt = null) => ({
  id, levelId, name: id, savedAt: 1, rewards: { ...DEFAULTS }, attempts: packAttempts(attempts), masteredAt
});

/** A stand-in for localStorage. */
function fakeStorage(initial) {
  let data = initial;
  return { getItem: () => data, setItem: (_, v) => { data = v; }, peek: () => data };
}

test('attempts survive packing and unpacking', () => {
  assert.deepEqual(unpackAttempts(packAttempts(attempts)), attempts);
});

test('runs round-trip through storage and bad data is ignored', () => {
  const s = fakeStorage(null);
  const { runs } = addRun([], make('a', 1));
  assert.equal(saveRuns(runs, s), true);
  assert.deepEqual(loadRuns(s).map(r => r.id), ['a']);
  assert.deepEqual(loadRuns(fakeStorage('not json')), []);
  assert.deepEqual(loadRuns(fakeStorage('{"x":1}')), []);
  const mixed = JSON.stringify([{ id: 5 }, ...runs]);
  assert.deepEqual(loadRuns(fakeStorage(mixed)).map(r => r.id), ['a']);
  assert.deepEqual(loadRuns(null), []);
});

test('saving reports failure when storage throws', () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error('full'); } };
  assert.equal(saveRuns([], broken), false);
});

test('runs take the lowest free slot and a level holds at most four', () => {
  let runs = [];
  for (let i = 0; i < MAX_RUNS_PER_LEVEL; i++) runs = addRun(runs, make('r' + i, 2)).runs;
  assert.deepEqual(runsForLevel(runs, 2).map(r => r.slot), [0, 1, 2, 3]);
  assert.equal(addRun(runs, make('extra', 2)).error, 'full');
  assert.equal(addRun(runs, make('other-level', 3)).error, null);
  runs = removeRun(runs, 'r1');
  const again = addRun(runs, make('new', 2));
  assert.equal(again.runs.find(r => r.id === 'new').slot, 1);
});

test('summaries report attempts, best route and total mistakes', () => {
  assert.deepEqual(summarize(make('a', 1, 3)), { attempts: 3, masteredAt: 3, best: 18, mistakes: 6 });
});

test('the fastest run is the one that mastered in the fewest attempts, and ties have no winner', () => {
  const slow = make('slow', 1, 90), quick = make('quick', 1, 40), never = make('never', 1, null);
  assert.equal(fastestRunId([slow, quick, never]), 'quick');
  assert.equal(fastestRunId([never]), null);
  assert.equal(fastestRunId([make('a', 1, 40), make('b', 1, 40)]), null);
});

test('reward descriptions list only what changed', () => {
  assert.equal(describeRewards(DEFAULTS, DEFAULTS), 'Default rewards');
  assert.equal(describeRewards({ ...DEFAULTS, pit: -20, bump: -1.5 }, DEFAULTS), 'Pit −20, Wall −1.5');
  const presets = { Default: DEFAULTS, Cautious: { ...DEFAULTS, pit: -20 } };
  assert.equal(presetName({ ...DEFAULTS, pit: -20 }, presets), 'Cautious');
  assert.equal(presetName({ ...DEFAULTS, pit: -3 }, presets), 'Custom');
});

test('moving average smooths a noisy curve', () => {
  assert.deepEqual(movingAverage([10, 20, 30], 2), [10, 15, 25]);
  assert.equal(movingAverage([], 5).length, 0);
});
