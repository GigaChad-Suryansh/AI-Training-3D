import test from 'node:test';
import assert from 'node:assert/strict';
import { GALLERY } from '../src/core/gallery.js';
import { validate, encodeMaze, decodeMaze } from '../src/core/custom.js';

test('every gallery world is playable and shareable', () => {
  assert.ok(GALLERY.length >= 7);
  for (const w of GALLERY) {
    const v = validate(w.rows);
    assert.ok(v.ok, `${w.name}: ${v.problems.join()}`);
    assert.deepEqual(decodeMaze(encodeMaze(w.rows)), w.rows, w.name);
  }
});
test('the vault needs its key', () => {
  const w = GALLERY.find(x => x.name === 'The Vault');
  assert.ok(validate(w.rows).level.needsKey);
});
