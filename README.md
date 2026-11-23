# Awakening

A Solo Leveling-style, offline-first learning app (PWA). Daily 10–15 minute lessons across every area of knowledge, with ranks, XP, quests, a Shadow Army of mastered topics, and Gates.

No backend, no API keys, no AI at runtime. All lessons are static files in `content/`. Progress is stored on each device, with optional automatic sync through a private GitHub gist (Settings → Auto sync), plus **Export** and **Import & merge** for manual backups.

## Everyday commands

```bash
npm install        # once, after downloading the project
npm run dev        # run locally at http://localhost:5173
npm run lessons    # convert content/src/*.txt into lesson JSON
npm run validate   # convert, then check every lesson and gate
npm run stats      # lesson counts per region
npm run build      # validate + type-check + build into dist/
```

Pushing to `main` on GitHub deploys automatically (`.github/workflows/deploy.yml`).

## Project layout

- `content/regions.json`: regions, topics, map positions, unlock order
- `content/src/<region>/*.txt`: lesson sources in a plain-text format (see the header of `scripts/build-lessons.mjs`)
- `content/lessons/<region>/<region>.<topic>.<level>.json`: generated lesson files the app reads (the first sample lesson of each region was written directly as JSON)
- `content/gates/<region>.json`: the Gates for each region
- `content/gates/<region>.json`: Gate challenges
- `src/state/`: game logic (`rules.ts` holds all the XP and rank numbers)
- `src/styles/tokens.css`: colours, fonts and sizes
- `PLAN.md`: the design plan

A full guide to adding lessons and regions comes in Phase 4.
