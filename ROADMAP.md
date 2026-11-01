# Roadmap

## The vision

**A place where anyone can see how AI learns, and share what they build.**

Hugging Face is where people share models and datasets. It is built for people who already work in machine learning, and what it hosts is mostly files. This project aims at a different gap: a hub for **learning environments and trained agents that you can watch, remix and race in the browser, with no GPU, no install and no code required.**

An honest note on scope: Hugging Face has years of head start, millions of models and a large team. Competing head on is not a realistic plan. The realistic plan is to win a narrow, well-defined group first (learners, students, teachers, hobbyists and RL beginners), be clearly the best at "watch it learn, then share it", and grow outward from there.

## Where we are today

A working lab in the browser: a 3D robot that learns by trial and error (Q-learning), five levels including a maze editor, up to four robots racing, saved-run comparison, share-by-link mazes, light and dark mode, and a plain-language guide. All of it runs client-side with no server.

What it cannot do yet: nothing leaves the browser except a maze link. There are no accounts, no way to publish a trained agent, one learning method, and one kind of world. That is the gap between a demo and a platform.

## Principles

1. **Visible first.** If you cannot watch it, it does not ship. This is the difference from a model file host.
2. **Zero setup.** Everything useful works in one click on a phone.
3. **Open formats.** Environments and agents are plain, documented files that anyone can read, write and remix.
4. **Earn each step.** Each phase must make the product better for a user before the next one is started.

## Phase 1: Make things portable (weeks 1 to 4)

Goal: an agent and a world become files you can keep and share. This is the foundation of any hub.

- [x] Share a maze by link
- [ ] **Agent files:** export a trained robot as a small JSON file and import it back (started in this release)
- [ ] **Environment files:** a documented format for a world (grid, rewards, rules), versioned
- [ ] **Agent cards:** every export carries a short card: what it was trained on, how many attempts, success rate, best route, learning settings
- [ ] A written spec in `docs/SPEC.md` so other people can build against the formats
- [ ] A gallery page of hand-picked starter worlds with one-click open

Done when: someone can train a robot, send the file to a friend, and the friend sees it perform.

## Phase 2: The hub (weeks 5 to 12)

Goal: a public place to publish and discover. This is the first step that needs a server.

- [ ] Backend and accounts (a hosted database with login, to avoid running servers early)
- [ ] Publish an environment or an agent with a title, description and preview image
- [ ] Browse, search, tags, likes and "remix this" (fork an environment into the editor)
- [ ] Profile pages that double as a portfolio of what a person has made
- [ ] Leaderboard per environment (fewest attempts to master, shortest route)
- [ ] Moderation basics: report button, rate limits, size limits on uploads

Done when: a stranger can find a world, train on it, publish their agent, and appear on a leaderboard.

## Phase 3: More ways to learn, more worlds (weeks 10 to 20)

Goal: stop being one algorithm on one grid.

- [ ] More algorithms the user can pick and compare side by side: SARSA, Monte Carlo, bandits, and a small neural network (DQN) in the browser
- [ ] More world types: moving obstacles, multiple goals, slippery floors, a continuous-control classic such as cart-pole
- [ ] A prompt-to-world generator ("a maze with two keys and a lava river")
- [ ] A plugin format so others can add an algorithm or a world without touching the core
- [ ] Better insight tools: show what the agent "sees", replay a past attempt, step one move at a time

Done when: the same world can be solved by three different learners and compared on one chart.

## Phase 4: Classrooms and challenges (weeks 16 to 28)

Goal: a reason for people to come back, and a clear audience.

- [ ] Challenges: weekly worlds with a leaderboard
- [ ] Teacher mode: a class code, assignments, a view of each student's progress
- [ ] Guided lessons built on the existing guide: short tracks with experiments and quizzes
- [ ] Embeddable widget so blogs and course sites can show a live robot
- [ ] Certificates or badges for finished tracks

Done when: a teacher can run a 30-minute lesson with a class without any help from us.

## Phase 5: Platform and ecosystem (6 months and beyond)

- [ ] Public API and a small Python package (run the same worlds from a notebook)
- [ ] Import agents trained elsewhere (ONNX or a simple weights format) and watch them in a world
- [ ] Bigger and community-contributed worlds with 3D assets
- [ ] Sponsored challenges, organization accounts, and a sustainable way to pay for hosting

## How we will know it is working

| Signal | Phase 1 | Phase 2 | Phase 4 |
|---|---|---|---|
| People who finish a level without help | baseline | 60% | 70% |
| Agent or world files shared | first 50 | 500 published | 5,000 |
| Return visitors within a week | track | 20% | 30% |
| Classrooms using it | 0 | 3 pilots | 25 |

These are targets to aim at, not forecasts. Phase 1 replaces the guesses with real numbers.

## Risks to watch

- **Scope.** A hub is a lot of product. Every phase has to stand on its own, so stopping after any phase still leaves something good.
- **Hosting cost and abuse.** Public uploads attract spam. Keep files small, rate limit, and use a managed backend at first.
- **A small audience.** Learners and teachers are a smaller group than machine learning engineers. That is the point: win them first.
- **Staying fun.** The risk of a platform is losing the calm, visual feel that makes this one work. Design review each phase.

## Next up

Finish Phase 1, starting with agent files, then the written spec. The agent export and import work is in this release.
