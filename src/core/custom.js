import { buildLevel, solve } from './levels.js';

/**
 * The "Your Maze" level. A maze is nine strings of nine characters, using the same legend
 * as the built-in levels: S start, G beacon, # wall, P pit, K key, D door, . floor.
 */
export const SIZE = 9;
export const CUSTOM_ID = 5;
export const STORE_KEY = 'ai-training-3d:custom-maze:v1';
export const TOOLS = ['.', '#', 'P', 'K', 'D', 'S', 'G'];
const UNIQUE = new Set(['S', 'G', 'K', 'D']);

export function starterRows() {
  const rows = Array.from({ length: SIZE }, () => '.'.repeat(SIZE).split(''));
  rows[SIZE - 1][0] = 'S'; rows[0][SIZE - 1] = 'G';
  [[2, 2], [2, 3], [2, 4], [2, 5], [5, 3], [5, 4], [5, 5], [5, 6]].forEach(([y, x]) => { rows[y][x] = '#'; });
  return rows.map(r => r.join(''));
}

/** Paint one cell. Start, beacon, key and door exist at most once, so placing one moves it. */
export function paint(rows, x, y, tool) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || !TOOLS.includes(tool)) return rows;
  const out = rows.map(r => r.split(''));
  const old = out[y][x];
  if (old === tool) return rows;
  if (UNIQUE.has(tool)) out.forEach(r => r.forEach((c, i) => { if (c === tool) r[i] = '.'; }));
  out[y][x] = tool;
  return out.map(r => r.join(''));
}

export function isValidShape(rows) {
  return Array.isArray(rows) && rows.length === SIZE && rows.every(r => typeof r === 'string' && r.length === SIZE && /^[.#PKDSG]+$/.test(r));
}

/**
 * Check a maze and, when it can be played, build the level.
 * Returns { ok, problems: [string], level, optimal }.
 */
export function validate(rows) {
  const problems = [];
  if (!isValidShape(rows)) return { ok: false, problems: ['The maze layout is not valid.'], level: null };
  const all = rows.join('');
  const has = ch => all.includes(ch);
  if (!has('S')) problems.push('Place a start tile.');
  if (!has('G')) problems.push('Place the beacon.');
  if (has('D') && !has('K')) problems.push('A door needs a key.');
  if (has('K') && !has('D')) problems.push('A key needs a door to open.');
  if (problems.length) return { ok: false, problems, level: null };
  const level = buildLevel({ id: CUSTOM_ID, name: 'Your Maze', skill: 'Anything you build', brief: 'Your own design. Edit the tiles below, then watch the robots learn it.', rows });
  if (!isFinite(level.optimal)) return { ok: false, problems: ['There is no way to reach the beacon. Open a path.'], level: null };
  if (level.optimal < 2) return { ok: false, problems: ['Place the beacon away from the start.'], level: null };
  return { ok: true, problems: [], level, optimal: level.optimal };
}

export function loadCustom(storage = globalThis.localStorage) {
  try {
    const rows = JSON.parse(storage.getItem(STORE_KEY));
    if (isValidShape(rows) && validate(rows).ok) return rows;
  } catch (e) { /* no storage or bad data */ }
  return starterRows();
}

export function saveCustom(rows, storage = globalThis.localStorage) {
  try { storage.setItem(STORE_KEY, JSON.stringify(rows)); return true; } catch (e) { return false; }
}

export { solve };
