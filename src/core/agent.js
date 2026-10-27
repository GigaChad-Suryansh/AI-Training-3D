/**
 * Environment wrapper and a tabular Q-learning agent.
 *
 * The agent keeps one number for every (tile, has-key, move) combination:
 * how much total reward it expects if it makes that move there. After every
 * step it nudges that number toward what it actually experienced. That is
 * the whole algorithm, which is why the learning is easy to watch and test.
 */
import { EV, move } from './levels.js';

/** Points the agent chases. The UI edits these live. */
export const REWARDS = { goal: 10, key: 3, pit: -10, bump: -0.5, step: -0.05 };
export const DEFAULT_REWARDS = { ...REWARDS };

/** alpha: learning rate, gamma: how much future reward matters, q0: optimism before any experience. */
export const HP = { alpha: 0.2, gamma: 0.97, q0: 1.0 };

let rand = Math.random;
/** Swap the random source (tests use a seeded one). */
export function setRandom(fn) { rand = fn; }

/** Chance of trying a random move on attempt n. Starts curious, settles near 3%. */
export function epsilonFor(n) { return Math.max(0.03, 0.2 * Math.pow(0.97, n)); }

export class Env {
  constructor(level) { this.L = level; this.reset(); }

  reset() {
    this.x = this.L.start.x; this.y = this.L.start.y; this.k = 0;
    this.t = 0; this.bumps = 0; this.fell = false;
    return this.state();
  }

  state() { return (this.y * this.L.W + this.x) * 2 + this.k; }

  step(a) {
    const s0 = this.state(), px = this.x, py = this.y;
    const r = move(this.L, this.x, this.y, this.k, a);
    this.x = r.x; this.y = r.y; this.k = r.k; this.t++;
    if (r.ev === EV.BUMP) this.bumps++;
    if (r.ev === EV.PIT) this.fell = true;
    const done = r.ev === EV.PIT || r.ev === EV.GOAL;
    const timeout = !done && this.t >= this.L.maxSteps;
    return { s0, a, s2: this.state(), ev: r.ev, done, timeout, px, py, x: this.x, y: this.y };
  }
}

export class Agent {
  constructor(numStates) {
    this.Q = new Float32Array(numStates * 4).fill(HP.q0);
  }

  /** Forget everything. */
  wipe() { this.Q.fill(HP.q0); }

  reward(ev) {
    return REWARDS.step
      + (ev === EV.BUMP ? REWARDS.bump : 0)
      + (ev === EV.PIT ? REWARDS.pit : 0)
      + (ev === EV.GOAL ? REWARDS.goal : 0)
      + (ev === EV.KEY ? REWARDS.key : 0);
  }

  maxQ(s) {
    const i = s * 4;
    return Math.max(this.Q[i], this.Q[i + 1], this.Q[i + 2], this.Q[i + 3]);
  }

  /** Highest-valued move, breaking ties at random. */
  best(s) {
    const i = s * 4;
    let best = 0, bestV = -Infinity, ties = 0;
    for (let a = 0; a < 4; a++) {
      const v = this.Q[i + a];
      if (v > bestV + 1e-6) { bestV = v; best = a; ties = 1; }
      else if (Math.abs(v - bestV) <= 1e-6) { ties++; if (rand() * ties < 1) best = a; }
    }
    return best;
  }

  act(s, epsilon) { return rand() < epsilon ? (rand() * 4) | 0 : this.best(s); }

  /** Q-learning update. */
  learn(s, a, s2, ev) {
    const i = s * 4 + a;
    const terminal = ev === EV.PIT || ev === EV.GOAL;
    const target = this.reward(ev) + (terminal ? 0 : HP.gamma * this.maxQ(s2));
    this.Q[i] += HP.alpha * (target - this.Q[i]);
  }
}

/** Play and learn one whole attempt without drawing anything. */
export function runEpisode(env, agent, epsilon) {
  env.reset();
  for (;;) {
    const a = agent.act(env.state(), epsilon);
    const r = env.step(a);
    agent.learn(r.s0, a, r.s2, r.ev);
    if (r.done || r.timeout) {
      return {
        ok: r.ev === EV.GOAL, steps: env.t,
        mistakes: env.bumps + (env.fell ? 1 : 0), fell: env.fell, timeout: r.timeout
      };
    }
  }
}
