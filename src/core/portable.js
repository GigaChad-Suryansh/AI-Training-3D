import { validate, SIZE } from './custom.js';

/**
 * Agent files: a trained robot plus the world and rules it learned in, as plain JSON.
 * Format version 1. Documented in ROADMAP.md for now, and in docs/SPEC.md later.
 */
export const FORMAT = 'ai-training-3d/agent';
export const VERSION = 1;
const MAX_STATES = 400;

const round = v => Math.round(v * 1000) / 1000;

/** Build the file contents from a learner, its level rows and the current rewards and settings. */
export function exportAgent({ learner, rows, rewards, hp, levelName }) {
  const att = learner.attempts, n = att.length, recent = att.slice(-10);
  return {
    format: FORMAT, version: VERSION,
    created: new Date().toISOString(),
    card: {
      name: learner.name, level: levelName, attempts: n,
      mastered: !!learner.mastered, masteredAt: learner.masteredNow || null,
      successRecent: recent.length ? Math.round(100 * recent.filter(a => a.ok).length / recent.length) / 100 : null,
      bestRoute: isFinite(learner.best) ? learner.best : null
    },
    environment: { rows, rewards: { ...rewards } },
    learning: { algorithm: 'q-learning', alpha: hp.alpha, gamma: hp.gamma, q0: hp.q0 },
    q: Array.from(learner.agent.Q, round)
  };
}

/** Check a parsed file. Returns { ok, error, file } and never throws. */
export function parseAgent(obj) {
  const bad = error => ({ ok: false, error });
  if (!obj || typeof obj !== 'object' || obj.format !== FORMAT) return bad('This is not an AI Training 3D agent file.');
  if (obj.version !== VERSION) return bad('This agent file was made by a different version.');
  const rows = obj.environment && obj.environment.rows;
  if (!Array.isArray(rows) || rows.length !== SIZE) return bad('The maze in this file is not valid.');
  const v = validate(rows);
  if (!v.ok) return bad(v.problems[0]);
  const rw = obj.environment.rewards;
  const keys = ['goal', 'key', 'pit', 'bump', 'step'];
  if (!rw || !keys.every(k => Number.isFinite(rw[k]) && Math.abs(rw[k]) <= 100)) return bad('The rewards in this file are not valid.');
  const q = obj.q;
  if (!Array.isArray(q) || q.length === 0 || q.length % 4 !== 0 || q.length / 4 > MAX_STATES || !q.every(x => Number.isFinite(x) && Math.abs(x) < 1000)) return bad('The learned values in this file are not valid.');
  return { ok: true, file: obj, level: v.level };
}
