import test from 'node:test';
import assert from 'node:assert/strict';
import { exportAgent, parseAgent, exportEnvironment, parseEnvironment } from '../src/core/portable.js';
import { starterRows, validate } from '../src/core/custom.js';
import { Learner } from '../src/core/learner.js';
import { REWARDS, HP } from '../src/core/agent.js';

function trained() {
  const level = validate(starterRows()).level, ln = new Learner(level, 162, 0);
  for (let i = 0; i < 80; i++) ln.playSilently();
  return { ln, level };
}

test('an exported agent can be read back and keeps what it learned', () => {
  const { ln } = trained();
  const file = JSON.parse(JSON.stringify(exportAgent({ learner: ln, rows: starterRows(), rewards: REWARDS, hp: HP, levelName: 'Your Maze' })));
  const p = parseAgent(file);
  assert.ok(p.ok, p.error);
  assert.equal(file.q.length, 162 * 4);
  assert.equal(file.card.attempts, 80);
  assert.ok(Math.abs(file.q[7] - ln.agent.Q[7]) < 0.001);
});
test('bad files are refused with a message', () => {
  const { ln } = trained();
  const good = exportAgent({ learner: ln, rows: starterRows(), rewards: REWARDS, hp: HP, levelName: 'x' });
  assert.match(parseAgent(null).error, /not an AI Training/);
  assert.match(parseAgent({ ...good, version: 9 }).error, /different version/);
  assert.match(parseAgent({ ...good, q: [1, 2, 3] }).error, /learned values/);
  assert.match(parseAgent({ ...good, q: good.q.map(() => NaN) }).error, /learned values/);
  assert.match(parseAgent({ ...good, environment: { ...good.environment, rewards: { goal: 1 } } }).error, /rewards/);
  assert.match(parseAgent({ ...good, environment: { ...good.environment, rows: ['x'] } }).error, /maze/);
});
test('environment files round trip and refuse agent files', () => {
  const env = JSON.parse(JSON.stringify(exportEnvironment({ rows: starterRows(), rewards: REWARDS, name: 'x' })));
  assert.ok(parseEnvironment(env).ok);
  assert.match(parseEnvironment({ ...env, environment: { ...env.environment, rows: starterRows().map(r => r.replace(/[SG]/g, '.')) } }).error, /start/i);
  const { ln } = trained();
  assert.match(parseEnvironment(exportAgent({ learner: ln, rows: starterRows(), rewards: REWARDS, hp: HP, levelName: 'x' })).error, /not an AI Training/);
});
