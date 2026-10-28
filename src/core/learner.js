/**
 * One robot: its own brain, its own position in the maze, and its own record
 * of attempts. Several learners can share a level and a set of rewards and
 * race each other. No DOM, so it is easy to test.
 */
import { Agent, Env, epsilonFor, runEpisode } from './agent.js';
import { EV } from './levels.js';
import { isMastered } from './mastery.js';

export const MAX_ROBOTS = 4;

export class Learner {
  constructor(level, numStates, slot) {
    this.slot = slot;
    this.name = `Robot ${slot + 1}`;
    this.agent = new Agent(numStates);
    this.phase = 'end'; // 'run' while moving, 'end' while pausing between attempts
    this.wait = 0;
    this.resetForLevel(level);
  }

  /** Start a level fresh. The brain is kept, so skills carry over. */
  resetForLevel(level) {
    this.L = level;
    this.env = new Env(level);
    this.attempts = []; this.tries = 0; this.best = Infinity;
    this.mastered = false; this.masteredNow = null; this.victory = 0; this.rewardsEdited = false;
  }

  /** Forget everything it learned, then start the level over. */
  wipe() { this.agent.wipe(); this.resetForLevel(this.L); }

  epsilon() { return this.mastered ? 0 : epsilonFor(this.tries); }

  beginAttempt() { this.env.reset(); this.phase = 'run'; }

  /** One move. Returns the environment's result for drawing and narration. */
  step() {
    const a = this.agent.act(this.env.state(), this.epsilon());
    const r = this.env.step(a);
    this.agent.learn(r.s0, a, r.s2, r.ev);
    return r;
  }

  /** Call when an attempt ends. Returns { stat, justMastered, lostMastery }. */
  finish(r) {
    const stat = {
      ok: r.ev === EV.GOAL, steps: this.env.t, mistakes: this.env.bumps + (this.env.fell ? 1 : 0),
      fell: this.env.fell, timeout: r.timeout
    };
    return this.record(stat);
  }

  /** Records an attempt that was played without drawing, or just finished. */
  record(stat) {
    this.attempts.push(stat); this.tries++;
    if (stat.ok && stat.steps < this.best) this.best = stat.steps;
    let justMastered = false, lostMastery = false;
    if (this.mastered) {
      if (stat.ok) this.victory++; else { this.mastered = false; this.victory = 0; lostMastery = true; }
    } else if (isMastered(this.attempts, this.L.optimal)) {
      this.mastered = true; this.victory = 0; justMastered = true;
      if (!this.masteredNow) this.masteredNow = this.attempts.length;
    }
    return { stat, justMastered, lostMastery };
  }

  /** Play one whole attempt without drawing. */
  playSilently() {
    return this.record(runEpisode(this.env, this.agent, this.epsilon()));
  }

  /** Rewards changed: be curious again and re-earn mastery. */
  rewardsChanged() {
    this.tries = Math.min(this.tries, 25);
    if (this.attempts.length) this.rewardsEdited = true;
    if (this.mastered) { this.mastered = false; this.victory = 0; }
  }
}

/** Lowest free slot, or -1 when the maze is full. */
export function freeSlot(learners) {
  const used = new Set(learners.map(l => l.slot));
  for (let s = 0; s < MAX_ROBOTS; s++) if (!used.has(s)) return s;
  return -1;
}
