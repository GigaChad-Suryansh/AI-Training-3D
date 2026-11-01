import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore, SupabaseStore } from '../src/hub/store.js';
import { checkDraft, select } from '../src/hub/items.js';
import { exportEnvironment } from '../src/core/portable.js';
import { starterRows } from '../src/core/custom.js';
import { REWARDS } from '../src/core/agent.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const env = name => JSON.parse(JSON.stringify(exportEnvironment({ rows: starterRows(), rewards: REWARDS, name })));

test('drafts are validated', () => {
  assert.ok(checkDraft({ kind: 'environment', title: ' A maze ', description: '', payload: env('a') }).ok);
  assert.match(checkDraft({ kind: 'environment', title: '', payload: env('a') }).error, /title/);
  assert.match(checkDraft({ kind: 'environment', title: 'x'.repeat(61), payload: env('a') }).error, /title/);
  assert.match(checkDraft({ kind: 'nope', title: 'x', payload: {} }).error, /Choose/);
  assert.match(checkDraft({ kind: 'agent', title: 'x', payload: env('a') }).error, /not an AI Training/);
  assert.match(checkDraft({ kind: 'environment', title: 'x', payload: { ...env('a'), pad: 'x'.repeat(61000) } }).error, /too large/);
});
test('local store publishes, likes, searches and removes', async () => {
  const s = new LocalStore(mem());
  const a = await s.publish({ kind: 'environment', title: 'Alpha maze', description: 'easy', payload: env('a') });
  await new Promise(r => setTimeout(r, 5));
  const b = await s.publish({ kind: 'environment', title: 'Beta maze', description: 'hard', payload: env('b') });
  assert.ok(a.ok && b.ok);
  assert.equal((await s.list())[0].title, 'Beta maze');
  assert.equal((await s.toggleLike(a.item.id)).likes, 1);
  assert.equal((await s.list({ sort: 'popular' }))[0].title, 'Alpha maze');
  assert.equal((await s.toggleLike(a.item.id)).likes, 0);
  assert.equal((await s.list({ q: 'hard' })).length, 1);
  assert.equal((await s.list({ kind: 'agent' })).length, 0);
  await s.remove(a.item.id); assert.equal((await s.list()).length, 1);
});
test('local store survives missing storage', async () => {
  const s = new LocalStore({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  assert.ok((await s.publish({ kind: 'environment', title: 'x', payload: env('a') })).ok);
  assert.equal((await s.list()).length, 1);
});
test('supabase store sends the right requests', async () => {
  const calls = [];
  const f = async (url, opt = {}) => { calls.push({ url, opt }); return { ok: true, json: async () => url.includes('/auth/v1/user') ? { id: 'u1', email: 'sam@x.com' } : [{ id: 'i1' }] }; };
  const s = new SupabaseStore({ url: 'https://p.supabase.co/', key: 'anon', fetchImpl: f, storage: mem() });
  assert.deepEqual(await s.publish({ kind: 'environment', title: 'x', payload: env('a') }), { ok: false, error: 'Sign in to publish.' });
  assert.ok(s.adoptRedirect('#access_token=tok&expires_in=3600'));
  const r = await s.publish({ kind: 'environment', title: 'x', payload: env('a') });
  assert.ok(r.ok);
  const post = calls.find(c => c.opt.method === 'POST' && c.url.endsWith('/rest/v1/items'));
  assert.equal(post.opt.headers.Authorization, 'Bearer tok');
  assert.equal(JSON.parse(post.opt.body).author_id, 'u1');
  assert.equal(JSON.parse(post.opt.body).author_name, 'sam');
});
test('select sorts newest first by default', () => {
  const out = select([{ title: 'a', description: '', author_name: '', kind: 'agent', likes: 0, created_at: '2026-01-01' }, { title: 'b', description: '', author_name: '', kind: 'agent', likes: 0, created_at: '2026-02-01' }]);
  assert.equal(out[0].title, 'b');
});
