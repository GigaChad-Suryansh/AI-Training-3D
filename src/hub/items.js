import { parseAgent, parseEnvironment } from '../core/portable.js';

/** What a hub item is, and the rules every item must meet before it is stored or shown. */
export const KINDS = ['environment', 'agent'];
export const LIMITS = { title: 60, description: 400, payload: 60000 };

export function checkPayload(kind, payload) {
  if (kind === 'environment') return parseEnvironment(payload);
  if (kind === 'agent') return parseAgent(payload);
  return { ok: false, error: 'Unknown kind of item.' };
}

/** Validate a draft from the publish form. Returns { ok, error, item }. */
export function checkDraft({ kind, title, description, payload }) {
  const bad = error => ({ ok: false, error });
  if (!KINDS.includes(kind)) return bad('Choose what you are publishing.');
  title = String(title || '').trim(); description = String(description || '').trim();
  if (!title) return bad('Give it a title.');
  if (title.length > LIMITS.title) return bad(`Keep the title under ${LIMITS.title} characters.`);
  if (description.length > LIMITS.description) return bad(`Keep the description under ${LIMITS.description} characters.`);
  if (JSON.stringify(payload || null).length > LIMITS.payload) return bad('That file is too large to publish.');
  const c = checkPayload(kind, payload);
  if (!c.ok) return bad(c.error);
  return { ok: true, item: { kind, title, description, payload } };
}

/** Filter and sort a list of items (used by every store, and testable on its own). */
export function select(items, { kind = 'all', q = '', sort = 'new' } = {}) {
  const needle = q.trim().toLowerCase();
  const out = items.filter(i => (kind === 'all' || i.kind === kind) && (!needle || `${i.title} ${i.description} ${i.author_name}`.toLowerCase().includes(needle)));
  out.sort(sort === 'popular' ? (a, b) => b.likes - a.likes || b.created_at.localeCompare(a.created_at) : (a, b) => b.created_at.localeCompare(a.created_at));
  return out;
}

/** The maze rows inside an item, for drawing a preview. */
export const rowsOfItem = item => item.payload && item.payload.environment && item.payload.environment.rows;
