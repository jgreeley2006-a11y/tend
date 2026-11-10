# Tend polish, save safety and quick log (Nov 10, 2026)

What was built, and where it differs from the plan in the project's `TEND_POLISH_SPEC.md`. That spec was written before reading the code; several things it asked for already existed.

## Already in the app (not rebuilt)
Showing saved data first, a queue for failed saves, JSON export, people search, one-tap Called / Texted / Saw them on a person's page, and secrets kept out of `send-reminders`.

## Look and feel
- **Tokens.** 8 text sizes (12, 13, 15, 16, 18, 21, 26, 30), 4 corner sizes (6, 10, 14, 20) plus pill, 6 spacing steps. The spec said 7 sizes; 16px stays because iPhone zooms the page on any input smaller than that. Spacing tokens replaced only values that matched exactly, so nothing moved.
- **Tap targets.** Checkboxes, step dots, reminder x buttons, icon buttons, text links, Back, pills and the stage bar have a larger invisible touch area. Chips are 6px taller.
- **Motion.** Sheets slide, checked tasks show the checkmark for a quarter second before the list redraws, screens fade in, buttons press, toasts fade. Off under Reduce Motion.
- **Loading and empty states.** Placeholder cards on a first run. People, Today and Tasks empty states have a heading and (for People) an Add a person button. The existing wording was kept where it already told you what to do.

## Save safety
See "Saving" in `HANDOFF.md`. The spec's `_removed` list was not needed: keeping the last in-step copy of each unsynced record tells a merge what was deleted, with no change to the saved data.

## Quick log and notification links
See `HANDOFF.md`. The "+" button still adds a person; quick log lives on Today instead.

## Tested
In a phone-sized browser with a stand-in backend: two devices editing the same person (lists and single fields), deleting on one device while the other is out of date, offline edit then restart then back online, new and deleted people, settings, quick log, and every notification link including one to a deleted task.

**Not tested: a real iPhone.** Check on the home-screen app: sheet and check-off animation feel, that small controls are easy to hit, tapping a real task reminder and a real meetup follow-up (both with Tend closed and with it open in the background), and dark mode.

## Not done
Filters by last contact / open prayer, an answered-prayer timeline, planner phase 2 pushes, ESV verses.
