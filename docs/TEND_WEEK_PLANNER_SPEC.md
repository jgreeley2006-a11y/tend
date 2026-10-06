# Tend the Week — Build Spec

Feature spec for adding the Tend the Week planning walk-through to the live Tend app. Read `docs/HANDOFF.md` first — every ground rule there still applies. The approved clickable prototype is `docs/prototypes/tend-the-week-prototype.html`. Match its flow, copy and interactions, but restyle with the app's existing components, colors and fonts. The prototype uses fake sample people; the real feature reads the user's own data.

Written Oct 6, 2026. Updated Oct 6 with repo findings (marked **Confirmed**).

## 0. How to ship this

Josiah wants this to go straight to live (main branch). Because real people use Tend:

* Ship in the small commits listed in §9, each one working on its own.
* Test each commit in the in-app browser at phone size (light + dark), push to main, then wait for Josiah's OK on his home-screen-installed iPhone PWA before the next commit.
* All JSON changes are additive and backward compatible (§6). Never rewrite or drop fields you don't recognize.
* Explain each commit in plain language.

**Confirmed repo facts:** plain-JS PWA (`app.js` renders HTML strings, delegated `data-act` handlers); Today screen is `viewToday()`; tasks live on `person.tasks` / `meta.tasks`; Meetups are tasks with `kind:"meetup"` and reminders from `defaultReminders(due, time)`; church members are `circle: "family"` (UI: "Church family", amber `--fam`); `buildMessage()` lives in `supabase/functions/send-reminders/index.ts`.

## 1. What it is

A guided, full-screen, swipe-through weekly planner (about 6 minutes). It walks the user through their Focus 5, helps them add several optional next steps per person, surfaces people beyond the Focus 5, lays out the week, and builds a daily prayer rotation that drives the "Pray for…" line.

Screens, in order (story-style progress bar on top, Back / Next bar at bottom, × to close and resume later):

1. Pause → 2. Look back → 3. Focus 5 (one card per focus person) → 4. Beyond the Five → 5. Shape the week → 6. Prayer rotation → 7. Send-off

"Week" = Monday–Sunday in the user's `meta.timezone`. Planning on a Sat/Sun plans the upcoming week; planning Mon–Fri plans the current week (only remaining days are selectable; earlier days shown disabled).

## 2. Entry points

* Today screen card (green, gently glowing): "TEND THE WEEK / Your week is ready to plan / Your Focus 5, next steps, and who else is on your heart. About 6 minutes. / Start →"
  * Shows from Sunday 12:00 PM through Monday 11:59 PM if the upcoming/current week has no completed plan. (Assumption — kept as a single constant so it's easy to change.)
  * If a draft exists: "Pick up where you left off / Continue →".
* Always-available "Plan the week" entry on Today. Opens the planner any day; if the week is already planned it opens the plan for editing.
* **Confirmed:** Tend the Week **replaces the old "Weekly review" card** on Today. The review's pieces map to the planner: "What God answered" → Look back's answered prayers; "Gone quiet" (30+ days) → Beyond the Five (rank 4); "Three steps" → Focus 5 / Beyond steps. Finishing a plan also sets the existing `meta.reviewAt`.

## 3. Screen-by-screen

### 3.1 Pause

* Eyebrow "BEFORE YOU PLAN"
* Verse: Colossians 4:5 — "Walk in wisdom toward them that are without, redeeming the time." (KJV, fine to keep fixed; switch to ESV later with the rest of the verses.)
* Line (left green rule): Take a moment to pray, asking: "Lord, who do you want me to love this week?"
* Next button "I'm ready" is disabled for 2.5 s (immediately enabled if `prefers-reduced-motion`). No other text on this screen.

### 3.2 Look back (previous Mon–Sun)

* 3 stat tiles: conversations logged (count of `logs[].at` in last week across all people), next steps done (`X/Y` = tasks due last week that are done / all tasks due last week, person + standalone), prayers answered (`prayers[].answeredAt` in last week).
* If ≥1 prayer answered: a green card per answered prayer: "Answered: {name}, {prayer text}" + "You started praying {at}. Marked answered {answeredAt}."
* "Unfinished from last week" — every undone task due last week (or earlier overdue, cap 8), each with three toggle pills:
  * Carry forward → task `due` = Monday of plan week (or the first open day if planning midweek). Note "Added to Monday."
  * Reschedule → shows a day picker; `due` = chosen day.
  * Let go → strike-through. On save set `done: true, letGo: true, doneAt: today` (so no reminders fire; history knows it wasn't "completed").
  * Nothing chosen → leave the task untouched.
* Hide the section if there's nothing unfinished.

### 3.3 Focus 5 (one card per `focus: true` person, existing app order)

Card header: avatar/initials, name, stage (or Church family depth) + relationship, "{n} of {total}".

Context box:

* Last talked: "{days} days ago · {log type}" — if > 14 days show in warning color + " · time to check in". If no logs: "No conversations logged yet".
* Last log snippet in italics (prefer `shared`, else `cares`, else `questions`).
* Praying for: open prayers (no `answeredAt`).
* This week: any `dates[]` falling in the plan week (handle `yearly`).

Prompt: "What would you like to do with {first} this week?" Sub: "All optional. Tap as many as you like, tap again to add another. Press and hold a chip for a rhythm."

Chips (repeatable): Text · Meetup · Invite · Send a verse · Drop something off · Pray · (dashed) Rhythms…

* Each tap adds one more step of that type. Chip shows count badge "×3" and filled state.
* Default day per type for the first one: Text Mon, Pray Tue, Invite Wed, Verse Thu, Drop-off Fri, Meetup Sat 9:00 AM. (Midweek: if the default day has passed, use the first open day.)
* Repeat spacing: next of the same type for the same person = last day + 3 if ≤ Sunday, else the first day that type isn't used yet.
* Default titles: "Text {first}", "Coffee with {first}", "Invite {first} to…", "Send {first} a verse", "Drop something off for {first}", "Pray for {first}".
* Press-and-hold 500 ms (or tap "Rhythms…") opens a bottom sheet; choosing a rhythm replaces that person's steps of that type:
  * Text: twice (Mon, Thu) · three times (Mon, Wed, Fri)
  * Pray: daily (all 7) · every other day (Mon, Wed, Fri, Sun) · twice (Tue, Fri)
  * Meetup: two meetups (Tue, Sat)
  * Others: twice (Tue, Fri)
  * Suppress the iOS long-press callout/text selection on chips.

Step rows (one per step, under the chips): type tag · editable title · × remove; then Day picker and time ("Remind at" for regular steps → `remindAt`; "Starts" for Meetups → `time`), and for Meetups a "Where" field (`location`).

* Meetup rows show their reminders as pills (e.g. "Night before · Fri 8:00pm", "Day of · Sat 7:00am", "Follow-up · Sat 3:00pm") — **computed with the existing `defaultReminders()`** (honors `meta.meetupDefaults`). Each pill has × (remove) / ↺ (restore), and they recalc when day/time changes.
* Swipe a row left (> 90 px) to remove it, as well as the × button.
* "+ Add your own" adds a blank custom step and focuses its title.

Suggestions (dashed "Suggested" rows, Add / ×): generated from data, max 3 per person:

* A date this week → "Happy birthday text" / "Drop off a birthday card" on that day (use the date's label).
* Each open prayer → "Ask how {prayer text} is going" (Text, Mon).
* Last contact > 14 days → "Check in with {first}" (Text, Mon).
* No Meetup in 30+ days → "Coffee with {first}" (Meetup, Sat).
* Dismissed suggestions stay dismissed for that plan.

Other controls:

* If a person has ≥ 4 steps: warning note "That's a full week with {first}. Good problem to have." (never blocks).
* "Nothing this week, just pray" → removes their steps for this plan, marks them `justPray`, shows a banner "Just praying for {first} this week. No tasks. {first} goes into your prayer rotation." with Undo; advances to next person.
* "Swap out of Focus 5" → opens the people list to choose who takes the spot (toggles `focus` on both people) and reloads that card.
* Zero focus people → friendly empty state "Choose up to 5 people to focus on" with a link to People.

### 3.4 Beyond the Five

Header: "Who else is on your heart?" / "A few people the app noticed. Light touches only."

Swipeable card deck (max 5, then the "That's everyone" card). Candidates are non-focus people, ranked:

1. a `dates[]` entry this week ("Birthday Wednesday")
2. met in last 30 days with no logs ("Met 3 weeks ago, no follow-up yet")
3. **Church family** (`circle: "family"`) with no logs ("You haven't really met yet") — card uses the **amber** Church family color
4. no contact ≥ 30 days ("47 days since you talked")
5. open prayer request ("Open prayer request")

Card: avatar, name, tag (Reaching / Church family), the reason line (large), detail (`note`/`howMet`/latest log), last-contact line.

* Swipe right (> 90 px) or Add a touch → bottom sheet "A light touch for {first}" with repeatable chips Text · Pray · Meetup · Send a verse · Invite + Done. Steps behave exactly like Focus 5 steps.
* Swipe left or Not this week → next card.
* After the deck: "You added touches for Carol, Ruth." + "Go through them again".
* "Did God bring anyone new to mind?" name field + Add → creates a new person doc (via the app's `newPerson()`, name only) and a Pray entry on the first open day; toast "{name} added to Monday's prayers".

### 3.5 Shape the week

* "Tending {people} people with {steps} next steps. Tap a step to move it."
* Capacity: Light / Normal / Full segmented (per-day thresholds 3 / 5 / 8). Stored on the plan.
* 7-day strip: count + colored dots (one per step, person color) per day; days over threshold turn amber-warning, with a note per heavy day: "{Tuesday} looks heavy ({6} steps). Move something?"
* List grouped by day: color dot · title · "{first} · {type} · {time}". Tap → inline "Move to [day]" + Remove. Empty days say "Open".
* Person color: stable color from the person id (hash → fixed palette of 10 colors readable in light and dark).

### 3.6 Prayer rotation

Header: "Who you'll pray for each day".

* Built from: every Pray step (solid chip), plus each focus person with no Pray step spread across the week twice, 3 days apart (dashed chip = auto), plus `justPray` people, plus anything the user added here.
* Tap a name → sheet: Move to [Mon…Sun] · Also pray on [Mon…Sun] · Take {first} off {Monday} · Cancel.
* + at the end of each day → sheet listing focus people + anyone with steps this week not already on that day.
* Moving a name that came from a Pray step moves that step too (stay in sync with Shape the week).
* Footer note: "Your daily summary's "Pray for…" line follows this list, so Monday's notification names only Monday's people."

### 3.7 Send-off

* "Tending {n} people with {m} next steps." + tiles per type (meetups, texts, prayer days, invites, verses, drop-offs, other steps) + person chips with step counts.
* Blessing: Galatians 6:9 — "And let us not be weary in well doing: for in due season we shall reap, if we faint not."
* Button: Back to Today. (Drop the prototype's "Start over" and the example Wednesday notification / explanatory note.)
* Tapping Finish on 3.6 is what commits everything (§5).

## 4. Copy & tone rules

Gentle, pastoral, never guilt. Use "next steps" and "Meetup". No streak shaming. Strings above are final unless they don't fit the app's components.

## 5. Saving

Drafts: save the in-progress plan to `meta.data.weekPlans[weekOf]` (debounced, ~1 s) so × / app close resumes where they left off. Draft steps are not real tasks yet.

On Finish:

* Each non-Pray step → a real task:
  * Focus/Beyond person → appended to that person's `people.data.tasks`.
  * Regular step: `{ id, title, due, remindAt?, done:false, planWeek, stepType }`.
  * Meetup step: `{ id, title, due, kind:"meetup", time, location?, reminders[], done:false, planWeek, stepType:"meetup" }` with reminders from `defaultReminders()` minus any the user removed.
* Pray steps do not become tasks — they live only in the plan's `rotation`.
* Carry-over decisions applied (§3.2).
* Plan marked `completedAt`; `meta.reviewAt` set to today.
* Re-opening a completed plan edits it: tasks it created (matched via `taskId`) are updated/removed; tasks the user created elsewhere are never touched.

## 6. Data shape (additive, backward compatible)

```ts
// meta.data.weekPlans — keyed by the plan week's Monday (YYYY-MM-DD, user's timezone)
type WeekPlan = {
  weekOf: string;                 // "2026-10-12"
  createdAt: string; updatedAt: string; completedAt?: string;
  capacity: "light" | "normal" | "full";
  steps: {                        // draft + record of what was planned
    id: string; personId: string; type: "text"|"meetup"|"invite"|"verse"|"drop"|"pray"|"custom";
    title: string; day: string;   // YYYY-MM-DD
    time?: string; location?: string; removedReminders?: string[];
    taskId?: string;              // set after Finish (non-pray steps)
  }[];
  justPray: string[];             // personIds
  dismissedSuggestions: string[];
  rotation: Record<string /*YYYY-MM-DD*/, string[] /*personIds*/>;
  carry: { taskId: string; choice: "carry"|"resched"|"letgo"; day?: string }[];
  reflection?: string;            // phase 2
};

// Task — new optional fields only
planWeek?: string;  stepType?: string;  letGo?: boolean;
```

* Keep only the latest 12 weeks in `weekPlans` (trim oldest on save).
* Missing `weekPlans` = no plans. Old clients ignore the new fields.

## 7. Daily summary + Today screen (must stay in sync)

"Pray for…" line, in both the Today screen and the edge function's `buildMessage()`:

* If a completed plan exists for the week containing today → use `rotation[today]` (names in that order). If that day's list is empty → omit the prayer line.
* Otherwise → current behavior (all focus people).

Redeploy `send-reminders` after the change. (The HANDOFF §7.1–7.3 cleanup is already done.)

## 8. Phase 2 (separate commits, after phase 1 is live and tested)

* Sunday nudge push (same window as the Today card, sent once at 4:00 PM local if no completed plan): "Your week is ready to plan. Who do you want to love this week?"
* Wednesday check-in push (12:00 PM local, if a completed plan exists): "You're halfway through the week. Marcus 1 of 3 · Jen 0 of 1. Who's left?" — dedup key `weekcheck|{weekOf}`.
* Saturday reflection (Today card + optional push 10:00 AM): "Where did you see God at work this week?" → saved to `reflection`; shown in next week's Look back.
* Each new push respects `notify_enabled`, `dailySummary` off / `quietUntil` pause, and uses the `sent_reminders` ledger.

## 9. Commit plan

1. Commit the prototype to `docs/prototypes/` + this spec to `docs/`.
2. Data helpers: week math in user timezone, `weekPlans` read/write with defaults, person color hash. No UI.
3. Planner shell: entry card + "Plan the week" (replacing Weekly review), full-screen container, progress bar, Back/Next, close/resume, Pause screen.
4. Look back.
5. Focus 5 (chips, rows, rhythms, suggestions, swipe-remove, just pray, swap).
6. Beyond the Five (deck, light-touch sheet, new person).
7. Shape the week.
8. Prayer rotation + Send-off + Finish/commit logic.
9. Today screen + `buildMessage()` rotation change; redeploy edge function.
10. Phase 2 items, one commit each.

## 10. Acceptance checklist (test on iPhone PWA)

* [ ] Tapping Text 3× creates three Text rows spaced Mon/Thu/Sun-ish; badge shows ×3.
* [ ] Long-press opens Rhythms without adding a step or triggering iOS callout.
* [ ] Meetup step creates a real Meetup with correct night-before / day-of / +6 h reminders; removed reminders don't fire.
* [ ] Closing mid-plan and reopening resumes the draft; no tasks exist until Finish.
* [ ] Prayer rotation: move, also-pray-on, take off, and + all work; moving a Pray-step name updates Shape the week.
* [ ] Daily push and Today show the same "Pray for…" names for that day.
* [ ] Let go tasks never fire reminders.
* [ ] A user with zero focus people sees a friendly Focus 5 empty state ("Choose up to 5 people to focus on") with a link to People.
* [ ] Existing users with no `weekPlans` see no change except the Today card/entry replacing Weekly review.
* [ ] Dark mode and the Church family color look right.
