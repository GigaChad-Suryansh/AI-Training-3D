import { checkDraft, select } from './items.js';

/**
 * Two stores with the same interface. LocalStore keeps everything in this browser so the hub
 * works with no setup. SupabaseStore talks to a hosted database and makes the hub public.
 * Every method returns a promise.
 */
const LOCAL_KEY = 'ai-training-3d:hub:v1';

export class LocalStore {
  constructor(storage = globalThis.localStorage) { this.storage = storage; this.mode = 'local'; this.mem = { items: [], liked: [] }; }
  _read() {
    try { const d = JSON.parse(this.storage.getItem(LOCAL_KEY)); if (d && Array.isArray(d.items)) return { items: d.items, liked: d.liked || [] }; } catch (e) { /* no storage */ }
    return this.mem;
  }
  _write(d) { this.mem = d; try { this.storage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch (e) { /* kept in memory */ } }
  async user() { return { id: 'local', name: 'You' }; }
  async signIn() { return { ok: true }; }
  async signOut() { }
  async list(opts) { const d = this._read(); return select(d.items.map(i => ({ ...i, liked: d.liked.includes(i.id) })), opts); }
  async publish(draft) {
    const c = checkDraft(draft); if (!c.ok) return c;
    const d = this._read();
    const item = { ...c.item, id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author_name: 'You', likes: 0, created_at: new Date().toISOString() };
    d.items = [item, ...d.items].slice(0, 200); this._write(d);
    return { ok: true, item };
  }
  async toggleLike(id) {
    const d = this._read(), it = d.items.find(i => i.id === id); if (!it) return { ok: false };
    const had = d.liked.includes(id);
    d.liked = had ? d.liked.filter(x => x !== id) : [...d.liked, id]; it.likes = Math.max(0, it.likes + (had ? -1 : 1));
    this._write(d); return { ok: true, liked: !had, likes: it.likes };
  }
  async remove(id) { const d = this._read(); d.items = d.items.filter(i => i.id !== id); this._write(d); return { ok: true }; }
}

const SESSION_KEY = 'ai-training-3d:hub:session';

export class SupabaseStore {
  constructor({ url, key, fetchImpl = globalThis.fetch.bind(globalThis), storage = globalThis.localStorage }) {
    this.url = url.replace(/\/$/, ''); this.key = key; this.f = fetchImpl; this.storage = storage; this.mode = 'supabase'; this.session = null;
    try { this.session = JSON.parse(storage.getItem(SESSION_KEY)); } catch (e) { /* signed out */ }
  }
  _h(extra = {}) { return { apikey: this.key, Authorization: `Bearer ${this.session ? this.session.token : this.key}`, 'Content-Type': 'application/json', ...extra }; }

  /** Call after the page loads. If the sign-in email link brought us back, keep the session. */
  adoptRedirect(hash) {
    const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const token = p.get('access_token'); if (!token) return false;
    this.session = { token, exp: Date.now() + (+p.get('expires_in') || 3600) * 1000 };
    try { this.storage.setItem(SESSION_KEY, JSON.stringify(this.session)); } catch (e) { /* in memory only */ }
    return true;
  }
  async user() {
    if (!this.session || this.session.exp < Date.now()) { this.session = null; return null; }
    const r = await this.f(`${this.url}/auth/v1/user`, { headers: this._h() });
    if (!r.ok) { this.session = null; return null; }
    const u = await r.json(); return { id: u.id, name: (u.email || 'Member').split('@')[0] };
  }
  async signIn(email, redirectTo) {
    const r = await this.f(`${this.url}/auth/v1/otp`, { method: 'POST', headers: this._h(), body: JSON.stringify({ email, create_user: true, options: { emailRedirectTo: redirectTo } }) });
    return r.ok ? { ok: true } : { ok: false, error: 'Could not send the sign-in email. Check the address and try again.' };
  }
  async signOut() { this.session = null; try { this.storage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } }
  async list(opts = {}) {
    const r = await this.f(`${this.url}/rest/v1/items?select=*&order=created_at.desc&limit=200`, { headers: this._h() });
    if (!r.ok) throw new Error('Could not load the hub.');
    return select(await r.json(), opts);
  }
  async publish(draft) {
    const c = checkDraft(draft); if (!c.ok) return c;
    const u = await this.user(); if (!u) return { ok: false, error: 'Sign in to publish.' };
    const r = await this.f(`${this.url}/rest/v1/items`, { method: 'POST', headers: this._h({ Prefer: 'return=representation' }), body: JSON.stringify({ ...c.item, author_id: u.id, author_name: u.name }) });
    if (!r.ok) return { ok: false, error: 'The hub refused that item. It may be too large, or you may be publishing too fast.' };
    return { ok: true, item: (await r.json())[0] };
  }
  async toggleLike(id) {
    const u = await this.user(); if (!u) return { ok: false, error: 'Sign in to like.' };
    const r = await this.f(`${this.url}/rest/v1/rpc/toggle_like`, { method: 'POST', headers: this._h(), body: JSON.stringify({ item: id }) });
    if (!r.ok) return { ok: false, error: 'Could not like that.' };
    return { ok: true, ...(await r.json()) };
  }
  async remove(id) {
    const r = await this.f(`${this.url}/rest/v1/items?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: this._h() });
    return { ok: r.ok };
  }
}

/** Pick the store from build-time settings. With none set, the hub runs locally. */
export function createStore(env = import.meta.env || {}) {
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
  return url && key ? new SupabaseStore({ url, key }) : new LocalStore();
}
