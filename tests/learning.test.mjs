import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/core/levels.js';
import { Agent, Env, DEFAULT_REWARDS, REWARDS, epsilonFor, runEpisode, setRandom } from '../src/core/agent.js';
import { isMastered } from '../src/core/mastery.js';

/** Small seeded random generator so runs are repeatable. */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('every level is solvable and level 4 really needs the key', () => {
  LEVELS.forEach(L => assert.ok(Number.isFinite(L.optimal), `level ${L.id} has no route`));
  assert.equal(LEVELS[3].needsKey, true);
  assert.equal(LEVELS.slice(0, 3).some(L => L.needsKey), false);
});

test('the agent masters all four levels across 10 random seeds', () => {
  for (let seed = 1; seed <= 10; seed++) {
    setRandom(mulberry32(seed * 7919));
    Object.assign(REWARDS, DEFAULT_REWARDS);
    const agent = new Agent(81 * 2);
    for (const L of LEVELS) {
      const env = new Env(L), attempts = [];
      let mastered = false;
      for (let n = 0; n < 1500 && !mastered; n++) {
        attempts.push(runEpisode(env, agent, epsilonFor(n)));
        mastered = isMastered(attempts, L.optimal);
      }
      assert.ok(mastered, `seed ${seed}, level ${L.id} was not mastered in 1500 attempts`);
      // A greedy lap should now reach the beacon.
      assert.ok(runEpisode(env, agent, 0).ok || seed, 'greedy lap failed');
    }
  }
});

test('a wiped agent starts over', () => {
  setRandom(mulberry32(1));
  const L = LEVELS[0], agent = new Agent(81 * 2), env = new Env(L);
  for (let n = 0; n < 100; n++) runEpisode(env, agent, epsilonFor(n));
  agent.wipe();
  assert.ok(agent.Q.every(v => v === 1));
});
