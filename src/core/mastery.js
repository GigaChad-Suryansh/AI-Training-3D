/**
 * A level counts as mastered when, over the last 10 attempts, at least 9
 * reached the beacon and those successes averaged no more than 1.5x the
 * shortest possible route.
 */
export function isMastered(attempts, optimalSteps) {
  if (attempts.length < 10) return false;
  const wins = attempts.slice(-10).filter(a => a.ok);
  if (wins.length < 9) return false;
  const avg = wins.reduce((sum, a) => sum + a.steps, 0) / wins.length;
  return avg <= optimalSteps * 1.5;
}

/** Share of the last 10 attempts that reached the beacon, 0 to 1. */
export function recentSuccess(attempts) {
  const w = attempts.slice(-10);
  return w.length ? w.filter(a => a.ok).length / w.length : 0;
}
