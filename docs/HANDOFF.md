# Tend — Project Handoff for Claude Code

> Written Oct 1, 2026; updated Oct 6 with repo findings (see "Repo facts" below) and the secrets fix (§6, §7). The backend sections were pulled from the live Supabase project.

## Repo facts (confirmed Oct 6)

- Plain JavaScript PWA, no framework or build step: `app.js` (state, rendering, Supabase sync, delegated `data-act` handlers), `styles.css`, `index.html`, `sw.js` (network-first, bump cache version on each release), `config.js`. Fonts: Newsreader + Figtree.
- Church members = `circle: "family"` (every person has `kind: "person"`). UI name "Church family", amber color (`--fam`). Evangelism side is green.
- Meetup reminder defaults come from `defaultReminders(due, time)` in `app.js` and can be overridden by `meta.meetupDefaults`.
- Edge functions live in `supabase/functions/` (`send-reminders`, `meetup-calendar`). Deploy from there; the repo is the source of truth.

---

## 1. What Tend is

Tend is a **personal evangelism CRM** that runs as an **iPhone home-screen app** (a PWA added to the home screen, with web push notifications). It helps one person faithfully "tend" relationships with people they're praying for and sharing their faith with.

Core idea: keep everything about each person in one place — who they are, where they are spiritually, what you've talked about, what you're praying for, and what your next step is — and have the app nudge you at the right times.

**Who uses it:** Josiah (the builder) plus a small group of friends testing it and giving feedback. Real people's data is in production.

**Explicitly out of scope for now:**

- No church / leader / admin hierarchy. Every user only ever sees their own data. Don't build roles, teams, or shared visibility.
- No quiet hours for meetup reminders.

---

## 2. Feature overview

### People
Each person record holds:

- **Basics:** name, phone, email, job, family, interests, note
- **How we know each other:** `howMet`, `metOn` (date), `relationship`
- **Circle:** `"family"` (church family) or `"reach"` (nullable) — with `circleHistory`
- **Spiritual stage:** numeric `stage` (values seen: 0–5) — with `stageHistory`
- **Relationship depth:** numeric `depth` (values seen: 0–4, nullable) — with `depthHistory`
- **Faith:** free-form `faith` field
- **Focus:** `focus` boolean — "focus people" are featured in the daily summary prayer line and get "Check in with X" nudges if not contacted in 14+ days
- **Prayed:** `prayed` — array of `YYYY-MM-DD` dates the user tapped "Prayed" (last 60 kept)
- **Dates to remember:** `dates[]` — birthdays, anniversaries, etc. (`yearly` repeats every year)
- **Interaction log:** `logs[]` — each entry has a type (`"In person"`, `"Text"`, …), date, and what was shared / their cares / their questions
- **Prayer requests:** `prayers[]` — with `answeredAt` when answered
- **Tasks:** `tasks[]` — next steps tied to this person

### Tasks
Tasks can be attached to a person (`people.data.tasks`) or be standalone (`meta.data.tasks`). A regular task has a due date and an optional `remindAt` time that fires a push notification at that exact time on the due date.

### Meetups
- Created from the **Add Task** section. The UI word is **"Meetup"** — never "appointment."
- A meetup is a task with `kind: "meetup"`, plus `time`, optional `location`, optional `bringUp[]` (talking points), and a `reminders[]` array.
- **Default reminders** (from `defaultReminders`):
  - `prep` — the **night before**: "Take a minute to pray for {name}."
  - `dayof` — the **morning of**: shows location + "Bring up" list
  - `followup` — **6 hours after the start time**, wherever that lands (e.g. 9am coffee → 3pm). "How did it go? Tap to jot down what you talked about and set a next step."
- **Every reminder must be adjustable or deletable** by the user. `custom` reminders are also supported.
- When a meetup is rescheduled, the app **recalculates** each reminder's `date`/`time`. (The server's dedup key includes date+time, so moved reminders fire again.)
- Once a meetup is marked done, none of its remaining reminders fire.
- No quiet hours apply to meetup reminders.

### Daily summary notification
Once a day at the user's chosen `reminder_time` (default 07:30 in their timezone), a push summarizing:

1. Overdue/due-today tasks (meetups today show "at 9am")
2. Important dates today or within 7 days
3. "Check in with X" for focus people with no contact in 14+ days
4. "Pray for A, B, C": today's people from the finished Tend the Week plan's prayer rotation if there is one (omitted if no one is on today), otherwise the focus people — `prayToday()` in both `app.js` and `send-reminders`
5. The verse of the day

If there's nothing to say and no verse, it stays silent. Users can turn it off (`meta.data.dailySummary = false`) or pause it (`meta.data.quietUntil` = `"on"` or a date). The summary message must match what the **Today screen** shows — the server's `buildMessage()` mirrors those rules, so keep them in sync if you change either.

### Daily verses
54 verses in the `verses` table, rotating one per day starting Jan 1, 2026. **Planned (paused):** switch to the ESV translation.

### Church family tab
A separate tab under **People** for getting to know existing church members you don't know well yet. People with `circle: "family"`, shown in amber; the evangelism side stays green.

---

## 3. Architecture

| Layer | What |
|---|---|
| Frontend | Plain-JS PWA on GitHub, installed to the iPhone home screen. `config.js` holds the Supabase URL/anon key and `VAPID_PUBLIC_KEY`. |
| Auth | Supabase Auth |
| Database | Supabase Postgres, project **`tend - evangelism app`** (ref `eztsbheokrpkbyjkntxc`, us-east-1) |
| Push | Web Push (VAPID) via the `web-push` npm package |
| Scheduler | `pg_cron` job `tend-reminders` running **every minute**, calling the `send-reminders` edge function via `pg_net` with an `x-cron-secret` header read from Vault |

### Data model philosophy
The app is **document-style**: each person is one row with a JSONB `data` blob holding everything about them (tasks, logs, prayers, dates, history). The frontend reads/writes whole documents. Don't normalize this into many tables unless Josiah asks — it would mean a large migration of live user data.

---

## 4. Database schema (live)

All tables have **RLS enabled**.

### `people`
| column | type | notes |
|---|---|---|
| `id` | text PK | client-generated |
| `user_id` | uuid → auth.users | default `auth.uid()` |
| `data` | jsonb | the full person document |
| `updated_at` | timestamptz | default now() |

Policy: **own people** — `ALL` where `auth.uid() = user_id`.

### `meta` (one row per user)
| column | type | notes |
|---|---|---|
| `user_id` | uuid PK → auth.users | |
| `data` | jsonb | `dailySummary`, `hideExamples`, `kind`, `quietUntil`, `reviewAt`, `meetupDefaults`, `tasks[]` (standalone tasks), `weekPlans` (Tend the Week plans keyed by Monday; latest 12; shape in the planner spec §6) |
| `notify_enabled` | bool | default false; only these users are processed by the scheduler |
| `reminder_time` | text `HH:MM` | default `07:30` |
| `timezone` | text IANA | default `America/New_York` |
| `last_sent_on` | date | daily summary dedup |
| `updated_at` | timestamptz | |

Policy: **own meta** — `ALL` where `auth.uid() = user_id`.

### `push_subscriptions`
| column | type |
|---|---|
| `endpoint` | text PK |
| `user_id` | uuid → auth.users |
| `subscription` | jsonb (PushSubscription JSON) |
| `created_at` | timestamptz |

Policy: **own subscriptions**. Dead endpoints (404/410) are auto-deleted by the edge function.

### `sent_reminders` (dedup ledger)
| column | type |
|---|---|
| `user_id` | uuid (PK part) |
| `key` | text (PK part) |
| `sent_at` | timestamptz |

Keys look like:
- regular task: `{taskId}|{due}|{remindAt}` → e.g. `t-abc123|2026-09-28|09:30`
- meetup reminder: `{taskId}|{reminderId or type}|{date}T{time}`

The edge function "claims" a key via upsert with `ignoreDuplicates`; if nothing comes back, it was already sent.

### `verses`
`n` int PK, `ref` text, `text` text. Policy: any signed-in user can read.

### `calendar_feeds`
One private token per user for the subscribable meetup calendar (`meetup-calendar` function). Policy: own row.

### Migrations applied
1. `20260927211327_tend_grant_table_access`
2. `20260927212152_tend_task_reminders`
3. `20260927215908_tend_daily_verses`
4. `20261001191107_tend_calendar_feeds`
5. `tend_cron_secret_in_vault` — Vault secret `tend_cron_secret` + `public.tend_check_cron_secret(text)` (service role only)
6. `tend_reminders_cron_from_vault` — the `tend-reminders` cron job, reading its header from Vault

---

## 5. JSON shapes

### Person (`people.data`)
```ts
type Person = {
  id: string;
  kind: "person";
  name: string;
  phone?: string; email?: string; job?: string;
  family?: string; interests?: string; note?: string;
  howMet?: string; metOn?: string /* YYYY-MM-DD */; relationship?: string;
  circle?: "family" | "reach" | null;   circleHistory?: any[];
  stage?: number;                       stageHistory?: any[];
  depth?: number | null;                depthHistory?: any[];
  faith?: string;
  focus?: boolean;
  prayed?: string[];         // YYYY-MM-DD dates
  dates?: { id: string; label: string; date: string /* YYYY-MM-DD */; yearly?: boolean }[];
  logs?: { id: string; at: string; type: string; shared?: string; cares?: string; questions?: string }[];
  prayers?: { id: string; at: string; text: string; answeredAt?: string }[];
  tasks?: Task[];
  createdAt?: string; updatedAt?: string;
};
```

### Task
```ts
type Task = {
  id: string;            // e.g. "t-mukbzmvejy0d0"
  title: string;
  due: string;           // YYYY-MM-DD (user's local date)
  remindAt?: string;     // HH:MM, regular tasks only
  done?: boolean; doneAt?: string;
  planWeek?: string; stepType?: string; // set on tasks made by Tend the Week
  letGo?: boolean;       // "Let go" in Tend the Week: done without being completed

  // Meetup-only fields
  kind?: "meetup";
  time?: string;         // HH:MM start time
  location?: string;
  bringUp?: (string | { text: string })[];
  reminders?: MeetupReminder[];
};

type MeetupReminder = {
  id?: string;
  type: "prep" | "dayof" | "followup" | "custom";
  date: string;          // YYYY-MM-DD, user's local time zone
  time: string;          // HH:MM, user's local time zone
};
```
All dates/times are stored as **local wall-clock values in the user's `meta.timezone`**, not UTC.

---

## 6. Edge function: `send-reminders`

Source: `supabase/functions/send-reminders/index.ts`. **No secrets in the source.**

Two entry points:

1. **Cron** (header `x-cron-secret` matches) → `runSchedule()` for every user with `notify_enabled = true`:
   - Regular tasks: fire at `remindAt` on `due` date, up to 60 min late.
   - Meetups: fire each reminder at its own `date`+`time`, up to 60 min late; skip if task done.
   - Daily summary: once per day, within 3 hours after `reminder_time`, unless disabled/paused.
2. **App's "Send a test notification" button** (Bearer user JWT) → sends the user their current summary or a "Tend is set up" message.

`verify_jwt` is **off** (the function checks the cron secret or the user token itself). Push uses `urgency: "high"` and TTL 6h so iOS delivers promptly.

### Where the secrets live
- **VAPID keys:** Supabase function secrets `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (Dashboard › Edge Functions › Secrets). The public key must equal `VAPID_PUBLIC_KEY` in `config.js`. If they're missing, the function logs an error and sends nothing.
- **Cron secret:** generated inside Postgres and stored in **Vault** as `tend_cron_secret`. The cron job reads it from `vault.decrypted_secrets`; the function checks it by calling `tend_check_cron_secret()` (executable by `service_role` only). Nobody needs to know its value. To rotate it, run `select vault.update_secret((select id from vault.secrets where name = 'tend_cron_secret'), encode(extensions.gen_random_bytes(32), 'hex'));` — the job and function pick it up on the next minute.
- **Rotating VAPID keys** invalidates every push subscription. Users fix it by turning Notifications off and on (Settings); the app replaces a subscription made with an old key when they turn it on.

---

## 7. Known issues

1. ~~Secrets hardcoded in the edge function source.~~ **Fixed Oct 6:** moved out (see §6) and both rotated. Never commit secrets to GitHub; don't paste secret values into docs, commits, or chat.
2. ~~Redundant check in `addMeetup`.~~ **Fixed Oct 6:** a done meetup returns before looking at any reminders.
3. ~~`send-reminders` not in GitHub.~~ **Fixed Oct 6:** `supabase/functions/send-reminders/index.ts`.
4. **Migrations vs. repo:** the first three migrations (Sept 27) were applied by hand and aren't in `supabase/migrations/` yet. The cron job is now captured in `20261006000100_tend_reminders_cron_from_vault.sql`. Capture any future hand-made schema/policy/cron change as a migration in the repo.

---

## 8. Ground rules for working on Tend

- **It's live with real users.** Any change to the JSON shape must be backward compatible: read old shapes, fill defaults, never wipe fields you don't recognize.
- **Keep RLS tight.** Every new table gets RLS + an "own rows" policy. Users must never see each other's data.
- **Timezones:** do date math in the user's `meta.timezone`. Store local `YYYY-MM-DD` and `HH:MM` like existing fields.
- **Today screen ↔ daily push must agree.** If you change one, update `buildMessage()` (or the frontend equivalent) too.
- **Words matter:** "Meetup" (not appointment), "next steps," gentle, encouraging, pastoral tone in all notification copy.
- **Colors:** evangelism side is green; church family is amber.
- **iPhone first:** Josiah tests on a home-screen-installed PWA on iOS — that's where web push behaves differently.
- **Small, reviewable commits.** Explain what changed in plain language; Josiah isn't a full-time developer.

---

## 9. Roadmap / backlog

| Item | Status |
|---|---|
| Fix hardcoded secrets (§7.1) + add `send-reminders` to repo (§7.3) | Done Oct 6 |
| Tend the Week planner, phase 1 (`docs/TEND_WEEK_PLANNER_SPEC.md`) | Live Oct 6 (replaced Weekly review) |
| Tend the Week phase 2: Sunday nudge, Wednesday check-in, Saturday reflection pushes | Next |
| Meetups with night-before / morning-of / +6h follow-up reminders, each editable/deletable | Live |
| Church family tab under People (amber) | Live |
| Daily verses → ESV | Paused |
| Church/leader hierarchy | Not planned for now |
| Gather tester feedback and track sign-ups | Ongoing |
