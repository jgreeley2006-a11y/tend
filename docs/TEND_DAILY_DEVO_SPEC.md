# Today's Devo — Build Spec for Claude Code

> Read `docs/HANDOFF.md` first; its ground rules still apply. Commit this file as `docs/TEND_DAILY_DEVO_SPEC.md`.
> Written Oct 7, 2026. The database part is already live. This spec covers only the app (frontend) change.

## What's already done (live in Supabase)

- `verses` now has **78** rows (n = 0–77). Rows 54–77 were added Oct 7 (migration `tend_daily_devos_schema_and_new_verses`).
- New table `devotionals`, one row per verse with the **same `n`**:

| column | type | notes |
|---|---|---|
| `n` | int PK → `verses.n` | same number as the verse |
| `title` | text | e.g. "Here am I" |
| `body` | text | 3–4 short paragraphs separated by a blank line (`\n\n`). Plain text, no markdown. |
| `today` | text | one small action ("Today:") |
| `pray` | text | one-line prayer ("Pray:") |
| `updated_at` | timestamptz | |

- RLS on, policy "anyone signed in reads devotionals" (SELECT for `authenticated`). Read-only from the app.
- Content source: the "Tend Daily Devos — Draft 1" doc (both tabs). Migrations: `tend_daily_devos_0_25`, `_26_51`, `_52_77`. Pull these into `supabase/migrations/` in the repo.

## Which devo is today's

Use **the exact same rule as the verse of the day** so the devo and the morning push verse always match:

```js
// same as verseFor() in send-reminders
const dayN = Math.floor((Date.parse(today + "T00:00:00Z") - Date.UTC(2026, 0, 1)) / 86400000);
const n = ((dayN % count) + count) % count;   // count = number of verses (now 78)
```

- `today` = the user's local date (`YYYY-MM-DD` in `meta.timezone`), same as everywhere else.
- `count` = number of rows in `verses`. Do **not** hardcode 54 or 78. If the app already has its own verse-of-the-day code, reuse it, and fix it if it hardcodes 54.
- Fetch `verses` + `devotionals` once and cache them (e.g. in memory/localStorage with a version check). They rarely change.

## UI: "Today's devo" card on the Today screen

- Card at the **top of the Today screen** (above the Tend the Week card when both show).
- Collapsed state: eyebrow **"TODAY'S DEVO · 1 MIN"**, the title, and the verse ref. Tap → opens the full devo.
- Full view (sheet or full-screen, reuse the app's existing sheet component):
  1. Title (Newsreader)
  2. Verse text in a quote style + ref (pull from `verses` by `n`, **not** retyped in the devo)
  3. Body paragraphs (split on `\n\n`)
  4. **Today:** line (green accent)
  5. **Pray:** line
  6. Button **"Amen"** closes it and marks today's devo read.
- After it's read today, the card shrinks to a one-line "✓ Today's devo · {title}" that can still be tapped to reread. The next day it's full again.
- Store read state per user in `meta.data.devoReadOn = "YYYY-MM-DD"` (additive field; old clients ignore it). Don't use a separate table.
- Respect dark mode; evangelism green accent; no streaks or guilt copy.

## Optional (separate commit)
Make the **Today:** line tappable when it clearly maps to an app action: "Add them to Tend" → Add Person; "Set up a Meetup" / "Set a Meetup" → Add Task with Meetup selected; "Add an Invite next step" → Add Task; "Open your Church family tab" → People › Church family; "Open your Focus 5" / "prayer list" → the relevant screen. Simple keyword match; if nothing matches, it's just text.

## Not changing
- The morning push stays as it is (still ends with the verse of the day, which now matches the devo).
- No edge function changes needed: `verseFor()` already uses `VERSES.length`.

## Commits
1. Add the migrations to `supabase/migrations/` + this spec to `docs/`.
2. Data helper: `devoForToday()` (shares the verse-of-the-day rule) + caching.
3. Today card + full devo view + "Amen" / read state.
4. (Optional) Tappable Today: actions.

## Acceptance checklist (iPhone PWA)
- [ ] The devo's verse ref matches the verse in that morning's push.
- [ ] Oct 7, 2026 → n = 45 ("He first loved us", 1 John 4:19). Oct 8 → 46.
- [ ] Card collapses after "Amen" and comes back full the next day.
- [ ] Works offline after first load (cached).
- [ ] Dark mode looks right.
- [ ] Users who never open it see no other change.

## Prompt to paste into Claude Code

> Read `docs/HANDOFF.md`, then this spec (`docs/TEND_DAILY_DEVO_SPEC.md`; commit it if it isn't there). The database part is already live: `verses` has 78 rows and a new `devotionals` table has one devo per verse with the same `n`. Pull the four Oct 7 migrations into `supabase/migrations/`. Then add the "Today's devo" card to the Today screen following the spec. Today's devo must use the same day-number rule as the verse of the day (`verseFor()` in send-reminders), using the verse count rather than a hardcoded number. Keep data changes additive (`meta.data.devoReadOn`). Small commits to main, each explained in plain language.
