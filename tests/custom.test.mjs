import test from 'node:test';
import assert from 'node:assert/strict';
import { starterRows, paint, validate, loadCustom, saveCustom, encodeMaze, decodeMaze, SIZE } from '../src/core/custom.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('the starter maze is playable', () => {
  const v = validate(starterRows());
  assert.ok(v.ok); assert.ok(v.optimal >= 2);
});
test('placing start or beacon moves it instead of duplicating', () => {
  let r = paint(starterRows(), 4, 4, 'S');
  assert.equal(r.join('').split('S').length - 1, 1);
  assert.equal(r[4][4], 'S');
});
test('problems are reported', () => {
  let r = paint(starterRows(), 4, 4, 'D');
  assert.match(validate(r).problems[0], /key/);
  r = paint(starterRows(), 0, 0, 'K'); assert.match(validate(r).problems[0], /door/);
  let blocked = starterRows(); for (let x = 0; x < SIZE; x++) blocked = paint(blocked, x, 7, '#');
  assert.match(validate(blocked).problems[0], /no way/i);
  assert.match(validate(['x']).problems[0], /not valid/);
});
test('a door with a key is solvable and needs the key', () => {
  let r = starterRows();
  r = paint(r, 0, 0, 'K'); r = paint(r, 8, 1, 'D'); r = paint(r, 7, 0, '#'); r = paint(r, 7, 1, '#'); r = paint(r, 7, 2, '#');
  const v = validate(r); assert.ok(v.ok, v.problems.join()); assert.ok(v.level.needsKey);
});
test('storage round trips and falls back safely', () => {
  const s = mem(), r = paint(starterRows(), 1, 1, 'P');
  saveCustom(r, s); assert.deepEqual(loadCustom(s), r);
  assert.deepEqual(loadCustom(mem()), starterRows());
  s.setItem('ai-training-3d:custom-maze:v1', '"junk"'); assert.deepEqual(loadCustom(s), starterRows());
});
test('share codes round trip and reject junk', () => {
  const r = paint(starterRows(), 1, 1, 'P'), code = encodeMaze(r);
  assert.equal(code.length, 81); assert.ok(!code.includes('#'));
  assert.deepEqual(decodeMaze(code), r);
  assert.equal(decodeMaze('hello'), null);
  assert.equal(decodeMaze('x'.repeat(81)), null);
  assert.equal(decodeMaze('W'.repeat(81)), null); // no start or beacon
});
