# Awakening: Phase 1 Plan

> Status: **approved** (Wave B, GitHub Pages) on 2026-11-22, with one addition: the app must work well on a laptop too (section 9).

---

## 0. What's already on your Mac

I checked your Mac. You already have everything needed to build the app:

| Tool | Version | What it's for |
|---|---|---|
| Node.js | 22.9 | Runs the build tools |
| npm | 10.8 | Downloads the few libraries we use |
| git | 2.50 | Saves versions of the project and uploads it for hosting |

You don't need to install anything yet. In Phase 2 you'll need a free **GitHub account** (see section 7).

---

## 1. Tech stack (small and light)

| Piece | Choice | Why |
|---|---|---|
| Build tool | **Vite** | Fast, simple, produces plain static files |
| Language | **TypeScript** | Catches mistakes before they reach your phone |
| UI | **Preact** (about 4 KB) | Same style as React but tiny. No component libraries |
| Routing | Hand-written hash router (`#/region/space`) | No dependency, and it works on any static host |
| Offline | **vite-plugin-pwa** (Workbox), used only at build time | Generates the service worker that caches the app and every lesson |
| Storage | `localStorage` (one versioned JSON blob) + `navigator.storage.persist()` | Progress data is small (well under 1 MB). It's simple and synchronous, and backup export/import is one JSON file |
| Fonts | Self-hosted, cached offline: **Literata** (serif, lessons), **Inter** (UI), **JetBrains Mono** (numbers and stats) | All free (OFL licence) and very readable |
| Diagrams | Small hand-written inline SVG | No chart library |

Only three runtime dependencies: `preact`, `preact/hooks`, and the small service worker helper.

---

## 2. File structure

```
Awakening/
├─ index.html                  ← iOS meta tags, safe-area viewport
├─ package.json
├─ vite.config.ts              ← PWA + manifest config
├─ public/
│  ├─ icons/                   ← app icon, apple-touch-icon (180px), maskable
│  └─ fonts/                   ← self-hosted woff2 files
├─ content/                    ← ★ ALL LESSONS LIVE HERE (just data)
│  ├─ regions.json             ← region list: id, name, glyph, map position, unlock order
│  ├─ gates/
│  │  └─ space.json            ← Gate questions per region tier
│  └─ lessons/
│     ├─ space/
│     │  ├─ space.stars.1.json
│     │  ├─ space.stars.2.json
│     │  └─ ...
│     ├─ law/
│     └─ ...
├─ scripts/
│  ├─ validate.ts              ← checks every lesson against the schema (npm run validate)
│  └─ stats.ts                 ← counts lessons and words per region
├─ src/
│  ├─ main.tsx                 ← app entry
│  ├─ router.ts
│  ├─ content/
│  │  ├─ schema.ts             ← TypeScript types for lessons (shared with the validator)
│  │  └─ catalog.ts            ← builds a lightweight index at build time; full lessons load on demand
│  ├─ state/
│  │  ├─ store.ts              ← load/save/migrate progress, export/import backup
│  │  ├─ xp.ts                 ← XP and rank math
│  │  ├─ adaptive.ts           ← level logic (Got it / Mostly / Lost me)
│  │  ├─ quests.ts             ← daily, bonus and penalty quests, streaks
│  │  └─ review.ts             ← Shadow Army spaced review (3/10/30 days)
│  ├─ screens/
│  │  ├─ Home.tsx              ← star-chart map + daily quest + rank/XP
│  │  ├─ Region.tsx            ← topic path
│  │  ├─ Lesson.tsx            ← reader
│  │  ├─ Check.tsx             ← explain-in-your-words + 3 buttons
│  │  ├─ Profile.tsx           ← rank, per-region bars/radar, achievements
│  │  ├─ Shadows.tsx           ← Shadow Army
│  │  ├─ Gates.tsx             ← boss challenges
│  │  └─ Settings.tsx          ← reading settings, backup, reset
│  ├─ components/              ← SystemPanel, ProgressRing, XPBar, BlockRenderer, TabBar…
│  └─ styles/
│     ├─ tokens.css            ← colours, spacing, type scale (one place to tweak the look)
│     └─ app.css
└─ README.md                   ← how to add lessons and regions (Phase 4)
```

**Adding content later** works like this: drop new `.json` files into `content/lessons/<region>/`, run `npm run validate`, then deploy. You don't touch any code.

---

## 3. Data model

### 3.1 Lesson file (one per lesson)

```jsonc
{
  "id": "space.stars.1",              // region.topic.level, unique
  "region": "space",
  "topic": "stars",                   // topic id within the region
  "topic_title": "How Stars Live and Die",
  "level": 1,                         // 1–5
  "prerequisites": [],                // other lesson ids, e.g. ["physics.atoms.1"]
  "title": "A Star Is a Balancing Act",
  "estimated_minutes": 12,
  "tags": ["fusion", "gravity"],      // optional
  "disclaimer": null,                 // e.g. "health" | "legal" | "financial" → shows a light note
  "blocks": [
    { "type": "text",      "role": "hook", "md": "Every star is a fight between two forces…" },
    { "type": "text",      "role": "core", "md": "…" },
    { "type": "callout",   "tone": "analogy", "title": "Think of it like…", "md": "…" },
    { "type": "steps",     "title": "Worked example: the Sun's lifetime", "items": ["…", "…", "…"] },
    { "type": "reveal",    "prompt": "Why doesn't the Sun explode?", "md": "…" },
    { "type": "diagram",   "svg": "<svg …>…</svg>", "caption": "Gravity in, pressure out" },
    { "type": "keypoints", "items": ["…", "…", "…"] },
    { "type": "text",      "role": "why", "md": "Why this matters: …" }
  ],
  "check": {
    "explain_prompt": "In your own words: what keeps a star from collapsing?",
    "bridge_hint": "space.stars.1b"   // optional simpler bridge lesson
  }
}
```

- `md` is a small Markdown subset: paragraphs, **bold**, *italic*, and lists.
- `callout.tone` is one of `analogy | definition | note | caution | open-question`. Each tone has its own icon and label, so the meaning never depends on colour alone.
- The **validator** checks: required fields; `id` matches the filename and `region.topic.level`; level is 1–5; the region exists; prerequisites point to real lessons; block types are known; keypoints exist and come before the check; the word count is in range (warning only); and diagrams contain only safe SVG tags (no scripts).

### 3.2 Topic / region data
`regions.json` holds the order, the map coordinates, and the topic order inside each region. A topic's levels come automatically from whatever lesson files exist.

### 3.3 Your progress (on the device)

```ts
{
  version: 1,
  createdAt, lastActiveDay,             // "2026-11-22" (local date)
  xp: number,
  streak: { current, best, lastQuestDay, forgivenThisWeek },
  regions: { [regionId]: { xp, level, gotRun, recent: ["got","mostly","lost",…] } },
  topics:  { [topicId]:  { level, completedLessons: [...], lastResult } },
  lessons: { [lessonId]: { completedAt, result, explanation?: string, reads } },
  shadows: { [topicId]:  { joinedAt, reviews: [dates], nextDue } },
  gates:   { [gateId]:   { answer, revealedAt, selfRating } },
  quests:  { [day]: { daily: lessonId, done, bonus?, penalty? } },
  achievements: { [id]: unlockedAt },
  settings: { textSize: "S|M|L|XL", paper: boolean, reduceMotion: "system|on" }
}
```

**Export** downloads `awakening-backup-2026-11-22.json`. **Import** validates the file, shows a summary ("Rank C · 42 lessons · streak 6"), and asks you to confirm before replacing your current progress.

---

## 4. Game logic

### 4.1 XP per session

| Event | XP |
|---|---|
| Finish a lesson | 40 + 20 × (level − 1) → L1 = 40, L3 = 80, L5 = 120 |
| Check answered **Got it** | +20 |
| Check answered **Mostly** | +15 |
| Check answered **Lost me** | +15 *(honesty is never punished)* |
| Wrote an explanation in own words | +15 |
| Daily Quest completed | +50 |
| Bonus Quest | +30 |
| Penalty Quest (recap) | +40 |
| Re-summon a shadow (review) | +20 |
| Clear a Gate | +150 |

A typical day (one daily quest at level 2) earns about **150 XP**.

### 4.2 Hunter rank (overall)

| Rank | Total XP | Roughly |
|---|---|---|
| E | 0 | Day 1 |
| D | 1,000 | about 1 week of daily sessions |
| C | 3,500 | about 3–4 weeks |
| B | 8,000 | about 2 months |
| A | 16,000 | about 4 months |
| S | 28,000 | about 7 months: most of Wave 1 plus Wave 2 |

Each rank has sub-levels shown as `Lv. 1–10` with a fill bar, so there's always visible progress between ranks.

### 4.3 Region rank
Each region has its own XP and rank: **E 0 · D 150 · C 400 · B 800 · A 1,400 · S 2,200**. So you can be **S** in Space and **E** in Law. A full Wave 1 region is worth about 2,000–2,500 XP, so S in a region means you really covered it.

### 4.4 Adaptive level (1–5, per region and per topic)

```
On "Got it":
    region.gotRun += 1
    if region.gotRun >= 2 and region.level < 5:
        region.level += 1, gotRun = 0            → "LEVEL UP: Space Lv.3"
On "Mostly":
    hold level; gotRun is not reset (a "Mostly" doesn't erase earned progress)
On "Lost me":
    gotRun = 0
    topic.level = max(1, topic.level − 1)        → that topic eases off right away
    queue a bridge lesson next (bridge file, or the lower level of the same topic)
    region.level drops by 1 ONLY IF 2 of the last 4 checks in the region were "Lost me"
                                                  (smoothing: one bad day can't whiplash it)
    never drops more than one level at a time; never below 1
```

**Next-lesson picker** (for a region):
1. A pending bridge lesson, if there is one.
2. Otherwise, the next unfinished lesson whose prerequisites are met, at `min(region.level, unlocked tier)`, in topic order.
3. If nothing exists at that exact level (Wave 1 only has L1–L3), take the nearest available level.

An **"Explore something new"** card always shows a lesson from a region you've touched least.

### 4.5 Quests and streak

- **Daily Quest**: chosen once per day, the same all day. It alternates between *Continue* (the next lesson in your most active region) and *Discover* (a level-1 lesson in a region you've barely explored). Finishing it keeps your streak.
- **Bonus Quest** (optional): appears after the daily is done. It's usually a due shadow re-summon or a "Discover" lesson.
- **Missed exactly one day**: the System issues a **Penalty Quest**, a 5-minute recap that uses the key points from 2–3 lessons you've already finished. If you do it, **your streak is restored** (once per week). Example copy:
  > `[ PENALTY QUEST ]` *The System noticed a gap. A short recall will restore your streak, Hunter.*
- **Missed two or more days**: the streak starts again from 1 and your best streak is kept. The copy is welcoming:
  > *Welcome back, Hunter. The gates are still open.*
- An in-app banner says "Your daily quest is waiting" when you open the app and haven't done it yet. No push notifications.

### 4.6 Shadow Army (spaced review)
- When you finish a topic's lesson and pick **Got it**, that topic joins the army as a "shadow": a named card with a small glyph and the region colour.
- Re-summons are due **3, 10 and 30 days** later. Due shadows appear under "Shadows to re-summon". A re-summon is a quick re-read of the key points and the reveal blocks, then Got it / Mostly / Lost me. "Lost me" moves that interval back one step.
- After all three re-summons, the shadow becomes **"Commander"**: a small visual upgrade.

### 4.7 Gates (boss challenges)
- Each region has a Gate after tier 1 (L1) and after tier 2 (L2). A Gate unlocks once you've finished at least 4 lessons in that tier.
- A Gate asks one synthesis question linking 2–3 topics you learned. You write your answer (saved), then tap **Reveal**. You see a model answer plus 3–5 key points, and you tick off the ones you covered. Nothing is graded right or wrong.
- Clearing a Gate unlocks the next tier in that region and plays a "gate cleared" moment.

### 4.8 Map unlocking
- **5 regions start unlocked** (a spread: Space & Cosmos, Mind & Body, History & Civilizations, Daily Life & Money, Technology & AI).
- Every **3 completed sessions** unlocks one more region, which plays a short "new region detected" animation. All 15 are open after about 30 sessions.
- Locked regions show as dim constellations with their name hidden as `[ ??? ]`, so the universe feels unexplored.

### 4.9 Achievements (a starter set of ~15)
Some examples: *First Gate*, *7-Day Streak*, *Polymath* (a lesson in 10 regions), *Shadow Monarch* (25 shadows), *Night Reader*, and *Honest Hunter* (used "Lost me" and came back to master it).

---

## 5. Design approach (built in Phase 2)

- **Colours** (all in `tokens.css`):
  - Background `#11151D`, panels `#171C26`, borders `#262D3B`.
  - Body text `#E6E9EF` on `#11151D`, about **14:1** contrast. Secondary text `#9AA4B5`, about 7.3:1.
  - Accent: electric blue `#6EA8FE`, used for rank, progress, and primary buttons.
  - Reward: muted gold `#D4B26A`, used only for XP gains and rank-ups.
- **Paper theme**: warm `#F4EFE4` background with `#2A2620` text for long reading.
- **Text sizes**: S/M/L/XL = 17/19/21/24 px for lesson text, line-height 1.6, max width about 36em.
- **Glow**: only on the single "next tap" element. It's turned off when reduced motion is on.
- **Home map**: an SVG star chart. Regions are nodes placed like constellations, with faint lines between related regions and a slow, subtle parallax of distant stars (static if reduced motion is on). Each node has a thin progress ring, the region name, and a rank letter in monospace.
- **Bottom tabs**: Map · Shadows · Gates · Hunter. Settings opens from the Hunter tab.

---

## 6. Wave 1 content and token estimate

### Regions
You listed **15** regions (the prompt said "about 12"). I suggest keeping all 15, since they're all distinct.

### How I estimated
- One 800–1,200-word lesson ≈ 1,300–1,600 tokens of prose.
- The JSON structure, check prompts, and an occasional diagram add about 25% → **~1,900 output tokens per lesson**.
- Each lesson also has working overhead: reading the schema, validating, fixing, and occasional rewrites. That's roughly **1.5× in total → ~3,000 tokens per lesson**.
- Gates: about 30 (2 per region) × ~800 tokens ≈ 25k.

### Options

| Wave size | Shape | Lessons | Words of content | Est. total tokens |
|---|---|---|---|---|
| **A. Starter** | 15 regions × 4 topics × 1–2 levels | ~90 | ~90k | **~300k** |
| **B. Recommended** | 15 regions × 6 topics × 2 levels (+ a few L3) | ~190 | ~190k | **~600k** |
| **C. Full** | 15 regions × 8–9 topics × 2–3 levels | ~250 | ~250k | **~800k** |

What this means in practice:
- On a Claude subscription, this uses your plan's usage limits. You don't get a separate bill. Even option A won't fit in one sitting, so content generation will run across **several sessions over a few days**, one or two regions at a time. That's also what lets you review as we go.
- Option B gives you about 190 sessions: over 6 months of daily quests before you'd need Wave 2.
- You can start with A and grow to B or C later with no rework. New files just get added.

---

## 7. Hosting

**Recommendation: GitHub Pages**, with automatic deploys using GitHub Actions.
- It's free, uses HTTPS (which iOS needs to install the app and run it offline), and needs only one account.
- After setup, publishing an update is one command (`git push`), and the site rebuilds itself.
- Trade-off: on the free plan the code repository is **public**. That's only the app and the lessons. Your progress and written answers never leave your phone.
- The alternative is **Netlify**. It allows a **private** repository but needs a second account. I'll walk you through whichever you pick.

In Phase 2 I'll give you click-by-click steps: create the GitHub account and repository, push, turn on Pages, then on your iPhone open Safari → your URL → **Share** → **Add to Home Screen**.

---

## 8. Phases (as you specified)

1. ✅ **Plan** (this document): waiting for your OK
2. **Skeleton + design**: the full UI and game logic, plus 3 sample lessons (e.g. Space, Economics, Philosophy). Then deploy and install it on your iPhone, and iterate on the look.
3. **Content**: batches by region, validated each time, with one sample per region for your approval first.
4. **Polish**: offline test, backup/restore test, reading settings, an accessibility pass, and the README.

---

## 9. Laptop + iPhone (added after approval)

**Layout:** one app, responsive.
- Phone (< 900px wide): bottom tab bar, single column.
- Laptop (≥ 900px): the tab bar becomes a left sidebar. The map is bigger, with the Daily Quest beside it. The lesson reader stays a calm, centred column.
- Hover effects are only a bonus, never required. Full keyboard focus styles. Installable from Chrome/Edge ("Install app") or Safari on macOS ("File → Add to Dock").

**Keeping progress in step between devices (still no backend):**
- Each device keeps its own copy of your progress. Making them match is a manual step.
- Progress is stored as a **log of events** ("finished lesson X with Got it on 22 Nov", "cleared Gate Y"…). XP, ranks, levels, streaks and shadows are all *recalculated* from that log.
- That makes **merging** safe. **Import & merge** combines the two logs and drops duplicates, so nothing is double-counted and nothing is lost. (Your written notes keep the newest version. Reading settings stay per device.)
- How to sync: on the iPhone, Settings → **Export** → AirDrop it to the Mac (or save to iCloud Drive). On the Mac, **Import & merge**. To bring the Mac's progress back to the phone, do the same in reverse.
- No accounts, no servers, no API keys, as required. Truly automatic sync would need a backend. It could be added later if you ever want it.
