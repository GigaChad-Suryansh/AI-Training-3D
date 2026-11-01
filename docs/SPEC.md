# File formats, version 1

Plain JSON. Anyone can read or write these files. Every file starts with a `format` and a `version`, and readers must refuse a file whose version they do not know.

## Maze

A maze is 9 rows of 9 characters:

| Char | Meaning |
|---|---|
| `.` | floor |
| `#` | wall |
| `P` | pit (ends the attempt) |
| `K` | key (at most one) |
| `D` | door, locked until the key is held (at most one) |
| `S` | start (exactly one) |
| `G` | beacon, the goal (exactly one) |

Rules for a playable maze: it has `S` and `G`, a `D` needs a `K` and the other way round, and the beacon can be reached from the start (taking the key first if a door is in the way).

### Share code

The maze as one 81-character string in reading order, with walls written `W` instead of `#`. Used in the page address: `index.html#maze=<code>`.

## Environment file (`*.maze.json`)

```json
{
  "format": "ai-training-3d/environment",
  "version": 1,
  "created": "2026-11-01T12:00:00.000Z",
  "card": { "name": "Your Maze" },
  "environment": {
    "rows": ["........G", ".........", ".........", ".........", ".........", ".........", ".........", ".........", "S........"],
    "rewards": { "goal": 10, "key": 3, "pit": -10, "bump": -0.5, "step": -0.05 }
  }
}
```

`rows` is the maze (9 strings, as above). Reward values are numbers between -100 and 100.

## Agent file (`*.agent.json`)

An environment plus what a robot learned in it.

```json
{
  "format": "ai-training-3d/agent",
  "version": 1,
  "created": "2026-11-01T12:00:00.000Z",
  "card": { "name": "Robot 1", "level": "Walls", "attempts": 60, "mastered": true, "masteredAt": 41, "successRecent": 1, "bestRoute": 28 },
  "environment": { "rows": ["...9 strings..."], "rewards": { "goal": 10, "key": 3, "pit": -10, "bump": -0.5, "step": -0.05 } },
  "learning": { "algorithm": "q-learning", "alpha": 0.2, "gamma": 0.97, "q0": 1 },
  "q": [1, 1, 1, 1]
}
```

`q` is the Q-table, flattened. Each tile has two states (without and with the key), so state number is `(y * 9 + x) * 2 + hasKey`, and the four numbers for a state are the values of up, right, down and left. For a 9 by 9 maze it has 648 numbers. The `card` is a summary for people and is not used when loading.

## Trust

Files come from strangers, so readers validate everything: the format and version, the maze rules, reward ranges and that every `q` value is a finite number. A file that fails is refused with a plain message, and nothing is run from it.
