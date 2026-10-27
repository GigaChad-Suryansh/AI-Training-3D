/**
 * Level layouts and the single transition rule shared by the simulator
 * and the solver, so "what the agent experiences" and "what is solvable"
 * can never disagree.
 *
 * Legend: S start, G beacon (goal), # wall, P pit, K key, D locked door, . floor
 */

export const EV = { STEP: 0, BUMP: 1, PIT: 2, GOAL: 3, KEY: 4 };
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left

export const LEVEL_DEFS = [
  {
    id: 1, name: 'First Steps', skill: 'Find the beacon',
    brief: 'An empty room. The agent has no map, so it has to try moves and see what happens.',
    rows: [
      '........G',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      'S........'
    ]
  },
  {
    id: 2, name: 'Walls', skill: 'Navigate walls',
    brief: 'Walls block the way. Walking into one costs points, so the agent has to remember where they are.',
    rows: [
      '.....#..G',
      '.###.#.#.',
      '.#...#.#.',
      '.#.###.#.',
      '.#.....#.',
      '.#####.#.',
      '.....#.#.',
      '.###.#.#.',
      'S....#...'
    ]
  },
  {
    id: 3, name: 'Pits', skill: 'Avoid hazards',
    brief: 'Glowing pits end the attempt. The agent has to learn which tiles are safe to step on.',
    rows: [
      '....#...G',
      '.##.#.##.',
      '.#P.....P',
      '.#.###.#.',
      '...#...#.',
      '.#.#.###.',
      '.#P...P#.',
      '.####.##.',
      'S.......P'
    ]
  },
  {
    id: 4, name: 'Key and Door', skill: 'Fetch the key',
    brief: 'The beacon is behind a locked door. The key is somewhere else, so the agent has to plan a detour.',
    rows: [
      'K..#.....',
      '.#.#.###.',
      '.#...#.#.',
      '.####P.#.',
      '.....#.#.',
      '.###.#.#.',
      '...#...#.',
      '.#.#.###.',
      'S#...D.#G'
    ]
  }
];

/** One step of the world. State is (x, y, hasKey). */
export function move(L, x, y, k, a) {
  const nx = x + DIRS[a][0], ny = y + DIRS[a][1];
  if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) return { x, y, k, ev: EV.BUMP };
  const c = L.grid[ny * L.W + nx];
  if (c === '#') return { x, y, k, ev: EV.BUMP };
  if (c === 'D' && !k) return { x, y, k, ev: EV.BUMP };
  if (c === 'P') return { x: nx, y: ny, k, ev: EV.PIT };
  if (c === 'G') return { x: nx, y: ny, k, ev: EV.GOAL };
  if (c === 'K' && !k) return { x: nx, y: ny, k: 1, ev: EV.KEY };
  return { x: nx, y: ny, k, ev: EV.STEP };
}

/** Breadth-first shortest path length to the goal, or Infinity. */
export function solve(L, withoutKey) {
  const W = L.W, H = L.H;
  const dist = new Int32Array(W * H * 2).fill(-1);
  const queue = [[L.start.x, L.start.y, 0]];
  dist[(L.start.y * W + L.start.x) * 2] = 0;
  for (let i = 0; i < queue.length; i++) {
    const [x, y, k] = queue[i];
    const d = dist[(y * W + x) * 2 + k];
    for (let a = 0; a < 4; a++) {
      const r = move(L, x, y, k, a);
      if (r.ev === EV.GOAL) return d + 1;
      if (r.ev === EV.PIT || r.ev === EV.BUMP) continue;
      if (withoutKey && r.ev === EV.KEY) continue;
      const id = (r.y * W + r.x) * 2 + r.k;
      if (dist[id] < 0) { dist[id] = d + 1; queue.push([r.x, r.y, r.k]); }
    }
  }
  return Infinity;
}

export function buildLevel(def) {
  const H = def.rows.length, W = def.rows[0].length;
  const L = {
    id: def.id, name: def.name, skill: def.skill, brief: def.brief, W, H, grid: [],
    pits: [], walls: [], start: null, goal: null, key: null, door: null
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = def.rows[y][x];
      L.grid.push(ch);
      if (ch === 'S') L.start = { x, y };
      else if (ch === 'G') L.goal = { x, y };
      else if (ch === 'K') L.key = { x, y };
      else if (ch === 'D') L.door = { x, y };
      else if (ch === 'P') L.pits.push({ x, y });
      else if (ch === '#') L.walls.push({ x, y });
    }
  }
  L.optimal = solve(L, false);
  L.needsKey = L.key ? solve(L, true) === Infinity : false;
  L.maxSteps = Math.max(60, Math.round(L.optimal * 3));
  return L;
}

export const LEVELS = LEVEL_DEFS.map(buildLevel);
