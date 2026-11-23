# Awakening — project guide for Claude

Personal, offline-first learning PWA (Solo Leveling "System" vibe). Owner is a beginner: explain changes in plain language, say exactly what to click, and ask before pushing.

## Hard rules
- No backend, no paid services, no AI calls at runtime. All content is static files written in advance.
- Works offline (vite-plugin-pwa precaches everything). iPhone-first, but also a laptop layout (sidebar at ≥900px).
- Stack: Vite + TypeScript + Preact, no UI libraries. Deployed to GitHub Pages by `.github/workflows/deploy.yml` on push to `main` (BASE_PATH=/awakening/). Live: https://karanmaheshwari16.github.io/awakening/
- Design: deep navy, off-white text (7:1+), one blue accent, muted gold only for rewards; serif for lessons; respect reduced motion; reading settings S/M/L/XL + paper theme.
- Content: accuracy first, politically neutral, examples from India/US/UK and elsewhere; health/legal/financial disclaimers where relevant.

## Commands
- `npm run dev` — dev server (port 5173; `.claude/launch.json` has `awakening-dev`)
- `npm run lessons` — convert `content/src/**/*.txt` → `content/lessons/<region>/<id>.json`
- `npm run validate` — convert + check all lessons and gates (must be 0 errors)
- `npm run build` — validate + type-check + production build
- `npm run stats` — lesson counts/words per region

## Content
- 15 regions in `content/regions.json` (6 topics each). 180 lessons: every topic has level 1 and level 2.
- New lessons are authored in plain text in `content/src/<region>/*.txt` (format documented at the top of `scripts/build-lessons.mjs`). The first L1 sample of each region was written directly as JSON in `content/lessons/`.
- Gates (synthesis questions, self-assessed): `content/gates/<region>.json`, tier 1 and tier 2 per region.
- Lesson ids: `region.topic.level` (bridge lessons end in `b`). L2 lessons list the L1 as `prereq`.

## Code map
- `src/state/` — event-sourced progress: `store.ts` (localStorage `awakening:v1`, merge), `derive.ts` (XP, ranks, levels, tiers, streaks, shadows, unlocks, `nextInRegion`, `libraryProgress`), `rules.ts` (numbers), `quests.ts` (daily/bonus/penalty; daily and bonus follow the current region), `sync.ts` (optional auto sync via a private GitHub gist; token in localStorage `awakening:sync`).
- `src/screens/` — Home (HUD, quests, Keep going, Library tracker, star map), Region, Lesson, Check (reward → next in region or the region's Gate), Shadows, Gates, Hunter, Settings (reading, auto sync, manual backup).
- `src/components/` — ui primitives, StarMap, Blocks (lesson block renderer), Reward, SyncPanel.

## Status (2026-11-23)
Phases 1–3 done (plan, app, all content). Remaining from the original plan: Phase 4 polish (offline/backup/reading-settings tests, accessibility pass, full README). Optional ideas: a few level-3 lessons; lengthen the 15 original L1 sample lessons to match the newer ~1,300-word ones.
