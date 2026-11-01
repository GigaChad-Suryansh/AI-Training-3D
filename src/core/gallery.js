import { LEVEL_DEFS } from './levels.js';

/** Hand-picked starter worlds. Each is a 9 by 9 maze in the shared format. */
export const GALLERY = [
  ...LEVEL_DEFS.map(d => ({ name: d.name, by: 'Built in', note: d.brief, rows: d.rows })),
  {
    name: 'Serpentine', by: 'Built in', note: 'One long winding corridor. Easy to understand, slow to wander through by chance.',
    rows: ['G........', '########.', '.........', '.########', '.........', '########.', '.........', '.########', 'S........']
  },
  {
    name: 'Minefield', by: 'Built in', note: 'Pits scattered everywhere. The robot has to find a safe line by falling in a few.',
    rows: ['..P....PG', '.P..P.P..', '...P..P..', 'P.P...P..', '..P.P..P.', '.P....P..', '...PP.P..', '.P.....P.', 'S..P.P...']
  },
  {
    name: 'The Vault', by: 'Built in', note: 'The beacon sits behind a door and the key is hidden in a walled nook.',
    rows: ['#######G#', '#######D#', '.........', '.........', '.#######.', '.#K....#.', '.#.###.#.', '.........', 'S########']
  }
];
