import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/core/levels.js';
import { DEFAULT_REWARDS, REWARDS, setRandom } from '../src/core/agent.js';
import { Learner, MAX_ROBOTS, freeSlot } from '../src/core/learner.js';

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('four robots race on one level and each learns on its own', () => {
  setRandom(mulberry32(42)); Object.assign(REWARDS, DEFAULT_REWARDS);
  const robots = [0, 1, 2, 3].map(s => new Learner(LEVELS[1], 162, s));
  for (let n = 0; n < 600; n++) robots.forEach(r => { if (!r.mastered) r.playSilently(); });
  robots.forEach(r => assert.ok(r.mastered, `${r.name} never mastered level 2`));
  // Brains are separate objects, so they learned different numbers.
  assert.notDeepEqual(Array.from(robots[0].agent.Q), Array.from(robots[1].agent.Q));
  assert.equal(new Set(robots.map(r => r.name)).size, 4);
});

test('slots are reused and the maze holds four robots', () => {
  const l = [0, 1, 2].map(s => new Learner(LEVELS[0], 162, s));
  assert.equal(freeSlot(l), 3);
  l.splice(1, 1);
  assert.equal(freeSlot(l), 1);
  l.push(new Learner(LEVELS[0], 162, 1), new Learner(LEVELS[0], 162, 3));
  assert.equal(l.length, MAX_ROBOTS);
  assert.equal(freeSlot(l), -1);
});

test('a rookie keeps its own record when the level restarts but keeps its brain', () => {
  setRandom(mulberry32(7));
  const r = new Learner(LEVELS[0], 162, 0);
  for (let n = 0; n < 30; n++) r.playSilently();
  const brain = Array.from(r.agent.Q);
  r.resetForLevel(LEVELS[0]);
  assert.equal(r.attempts.length, 0);
  assert.deepEqual(Array.from(r.agent.Q), brain);
  r.wipe();
  assert.ok(r.agent.Q.every(v => v === 1));
});

test('changing rewards makes a mastered robot learn again', () => {
  setRandom(mulberry32(3)); Object.assign(REWARDS, DEFAULT_REWARDS);
  const r = new Learner(LEVELS[0], 162, 0);
  for (let n = 0; n < 400 && !r.mastered; n++) r.playSilently();
  assert.ok(r.mastered);
  r.rewardsChanged();
  assert.equal(r.mastered, false);
  assert.equal(r.rewardsEdited, true);
  assert.ok(r.tries <= 25);
});
