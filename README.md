# Awakening

A Solo Leveling-style, offline-first learning app (PWA). Daily 10–15 minute lessons across every area of knowledge, with ranks, XP, quests, a Shadow Army of mastered topics, and Gates.

No backend, no accounts, no API keys. All lessons are static files in `content/`. Progress is stored on each device, with **Export** and **Import & merge** in Settings for backups and iPhone ↔ laptop sync.

## Everyday commands

```bash
npm install        # once, after downloading the project
npm run dev        # run locally at http://localhost:5173
npm run validate   # check every lesson file
npm run stats      # lesson counts per region
npm run build      # validate + type-check + build into dist/
```

Pushing to `main` on GitHub deploys automatically (`.github/workflows/deploy.yml`).

## Project layout

- `content/regions.json`: regions, topics, map positions, unlock order
- `content/lessons/<region>/<region>.<topic>.<level>.json`: one file per lesson
- `content/gates/<region>.json`: Gate challenges
- `src/state/`: game logic (`rules.ts` holds all the XP and rank numbers)
- `src/styles/tokens.css`: colours, fonts and sizes
- `PLAN.md`: the design plan

A full guide to adding lessons and regions comes in Phase 4.
