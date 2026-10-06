// Tend: send-reminders
// Called every minute by the schedule (with x-cron-secret), and by the app's
// "Send a test notification" button (with the signed-in user's token).
//
// No secrets live in this file:
// - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are Supabase function secrets (Edge Functions > Secrets).
//   The public key must match VAPID_PUBLIC_KEY in the app's config.js.
// - The cron secret is generated inside the database and kept in Vault ("tend_cron_secret").
//   The tend-reminders cron job reads it from Vault, and this function checks it with the
//   tend_check_cron_secret() database function (see supabase/migrations).
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
const VAPID_PRIVATE = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
const VAPID_READY = !!(VAPID_PUBLIC && VAPID_PRIVATE);
if (VAPID_READY) webpush.setVapidDetails("mailto:jgreeley2006@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
else console.error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set. Add them under Edge Functions > Secrets.");
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------- dates in the user's own time zone ----------
function localParts(tz: string, now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return { date, time: time.replace(/^24/, "00") };
}
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const days = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
const first = (n: string) => (n || "").trim().split(/\s+/)[0] || n;
function nextDate(d: any, today: string): string | null {
  if (!d?.date) return null;
  if (!d.yearly) return d.date;
  const y = +today.slice(0, 4);
  let n = y + d.date.slice(4);
  if (n < today) n = (y + 1) + d.date.slice(4);
  return n;
}
function weekday(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}
// "09:00" -> "9am", "14:30" -> "2:30pm"
function niceTime(hhmm?: string) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}`;
}
// "today" / "tomorrow" / "Saturday" for a meetup date, relative to a given day
function whenWord(meetDate: string, fromDate: string) {
  const k = days(fromDate, meetDate);
  if (k === 0) return "today";
  if (k === 1) return "tomorrow";
  if (k > 1 && k <= 6) return weekday(meetDate);
  return meetDate;
}
const isMeetup = (t: any) => t?.kind === "meetup";
// Monday of the week containing a "YYYY-MM-DD" date
function mondayOf(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
// Who to pray for today: a finished Tend the Week plan's rotation for today, otherwise the Focus 5.
// Same rule as prayToday() on the Today screen.
export function prayToday(people: any[], meta: any, today: string) {
  const plan = meta?.weekPlans?.[mondayOf(today)];
  if (plan?.completedAt && plan.rotation && typeof plan.rotation === "object") {
    const ids: string[] = Array.isArray(plan.rotation[today]) ? plan.rotation[today] : [];
    const byId = new Map(people.map(p => [p.id, p]));
    return ids.map(id => byId.get(id)).filter(Boolean);
  }
  return people.filter(p => p.focus);
}

// ---------- the message: same rules as the Today screen ----------
export function buildMessage(people: any[], meta: any, today: string) {
  const steps: string[] = [];
  const tasks: { title: string; due: string; kind?: string; time?: string }[] = [];
  for (const p of people) for (const t of p.tasks || []) if (!t.done && t.due && t.due <= today) tasks.push(t);
  for (const t of meta?.tasks || []) if (!t.done && t.due && t.due <= today) tasks.push(t);
  tasks.sort((a, b) => a.due.localeCompare(b.due) || (a.time || "").localeCompare(b.time || ""))
    .forEach(t => steps.push(isMeetup(t) && t.time && t.due === today ? `${t.title} at ${niceTime(t.time)}` : t.title));
  for (const p of people) for (const d of p.dates || []) {
    const n = nextDate(d, today); if (!n) continue;
    const k = days(today, n);
    if (k === 0) steps.push(`${first(p.name)}: ${d.label} is today`);
    else if (k > 0 && k <= 7) steps.push(`${first(p.name)}: ${d.label} is ${k === 1 ? "tomorrow" : weekday(n)}`);
  }
  const focus = people.filter(p => p.focus);
  for (const p of focus) {
    const last = [...(p.logs || []).map((l: any) => l.at), p.metOn].filter(Boolean).sort().pop();
    const since = last ? days(last, today) : null;
    if (since === null || since >= 14) steps.push(`Check in with ${first(p.name)}`);
  }
  const pray = prayToday(people, meta, today);
  if (steps.length) {
    const shown = steps.slice(0, 3);
    return {
      title: steps.length === 1 ? "1 next step today" : `${steps.length} next steps today`,
      body: shown.join("\n") + (pray.length ? `\nPray for ${pray.map(p => first(p.name)).join(", ")}` : ""),
    };
  }
  if (pray.length) return { title: "Pray today", body: `${pray.map(p => first(p.name)).join(", ")}. Tap to open your prayer list.` };
  return null; // nothing to say: stay quiet
}

// ---------- meetup reminder wording ----------
// r.type: "prep" (night before), "dayof", "followup", or "custom"
export function meetupMessage(t: any, r: any, person: string | null) {
  const when = whenWord(t.due, r.date);
  const at = t.time ? ` at ${niceTime(t.time)}` : "";
  const where = t.location ? `\n${t.location}` : "";
  const name = person ? first(person) : null;
  const bring = (t.bringUp || []).filter((b: any) => b && (b.text || typeof b === "string"))
    .map((b: any) => "• " + (typeof b === "string" ? b : b.text)).slice(0, 4);
  if (r.type === "prep") {
    return { title: `${t.title} ${when}${at}`, body: (name ? `Take a minute to pray for ${name}.` : "Take a minute to pray ahead of it.") + where };
  }
  if (r.type === "dayof") {
    return { title: `${t.title} ${when}${at}`, body: (t.location || "Reminder from Tend") + (bring.length ? `\nBring up:\n${bring.join("\n")}` : "") };
  }
  if (r.type === "followup") {
    return { title: `How did it go? · ${t.title}`, body: "Tap to jot down what you talked about and set a next step." };
  }
  return { title: `${t.title} ${when}${at}`, body: (name ? `Meetup · ${person}` : "Meetup reminder") + where };
}

async function sendToUser(userId: string, msg: { title: string; body: string }, tag = "tend-daily") {
  if (!VAPID_READY) return 0;
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint,subscription").eq("user_id", userId);
  let sent = 0;
  for (const s of subs || []) {
    try {
      // urgency "high" tells Apple to deliver right away instead of batching it for later.
      await webpush.sendNotification(s.subscription, JSON.stringify({ ...msg, tag: tag.replace(/[^a-zA-Z0-9-]/g, "-"), url: "./" }), { TTL: 60 * 60 * 6, urgency: "high" });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      else console.error("push failed", e?.statusCode, e?.body);
    }
  }
  return sent;
}

let VERSES: any[] | null = null;
async function verseFor(date: string) {
  if (!VERSES) { const { data } = await admin.from("verses").select("n,ref,text").order("n"); VERSES = data || []; }
  if (!VERSES.length) return null;
  const n = Math.floor((Date.parse(date + "T00:00:00Z") - Date.UTC(2026, 0, 1)) / 86400000);
  return VERSES[((n % VERSES.length) + VERSES.length) % VERSES.length];
}

async function loadPeople(userId: string) {
  const { data } = await admin.from("people").select("data").eq("user_id", userId);
  return (data || []).map((r: any) => r.data);
}

// Runs every minute: task reminders at their exact time, meetup reminders, plus the once-a-day summary.
async function runSchedule() {
  const { data: users, error } = await admin.from("meta").select("*").eq("notify_enabled", true);
  if (error) throw error;
  let summaries = 0, reminders = 0;
  for (const u of users || []) {
    const tz = u.timezone || "America/New_York";
    let local;
    try { local = localParts(tz); } catch { local = localParts("America/New_York"); }
    const q = u.data?.quietUntil;
    const quiet = q && (q === "on" || q >= local.date);
    const people = await loadPeople(u.user_id);

    // 1. Reminders that are due now (up to 60 minutes late), not done, not already sent.
    const due: { msg: { title: string; body: string }; key: string }[] = [];
    // 1a. Regular tasks: one reminder at remindAt on the due date.
    const addTask = (t: any, person: string | null) => {
      if (!t || t.done || isMeetup(t) || !t.remindAt || t.due !== local.date) return;
      const late = toMin(local.time) - toMin(t.remindAt);
      if (late < 0 || late > 60) return;
      due.push({ msg: { title: t.title, body: person ? `Reminder · ${person}` : "Reminder from Tend" }, key: `${t.id}|${t.due}|${t.remindAt}` });
    };
    // 1b. Meetups: each reminder has its own local date + time, so it can fire on any day.
    // The app recalculates these when a meetup is rescheduled; the key includes date+time so moved reminders send again.
    const addMeetup = (t: any, person: string | null) => {
      if (!t || !isMeetup(t) || !Array.isArray(t.reminders)) return;
      if (t.done) return; // once a meetup is marked done, none of its reminders fire
      for (const r of t.reminders) {
        if (!r?.date || !r?.time) continue;
        const late = days(r.date, local.date) * 1440 + toMin(local.time) - toMin(r.time);
        if (late < 0 || late > 60) continue;
        due.push({ msg: meetupMessage(t, r, person), key: `${t.id}|${r.id || r.type}|${r.date}T${r.time}` });
      }
    };
    for (const p of people) for (const t of p.tasks || []) { addTask(t, p.name); addMeetup(t, p.name); }
    for (const t of u.data?.tasks || []) { addTask(t, null); addMeetup(t, null); }
    for (const r of due) {
      const { data: claimed } = await admin.from("sent_reminders")
        .upsert({ user_id: u.user_id, key: r.key }, { onConflict: "user_id,key", ignoreDuplicates: true }).select();
      if (!claimed || !claimed.length) continue; // already sent
      const sent = await sendToUser(u.user_id, r.msg, "task-" + r.key);
      if (sent) reminders++;
    }

    // 2. Daily summary, once, in the 3 hours after their chosen time.
    if (u.data?.dailySummary === false || quiet || u.last_sent_on === local.date) continue;
    const lateDaily = toMin(local.time) - toMin(u.reminder_time || "07:30");
    if (lateDaily < 0 || lateDaily > 180) continue;
    await admin.from("meta").update({ last_sent_on: local.date }).eq("user_id", u.user_id);
    const msg = buildMessage(people, u.data, local.date);
    const verse = await verseFor(local.date);
    const out = msg
      ? { title: msg.title, body: msg.body + (verse ? `\n${verse.ref}: ${verse.text}` : "") }
      : verse ? { title: "Today's verse · " + verse.ref, body: verse.text } : null;
    if (out && await sendToUser(u.user_id, out)) summaries++;
  }
  return { checked: users?.length || 0, summaries, reminders };
}

// The cron secret lives only in Vault; the database compares it for us.
async function isCron(req: Request) {
  const candidate = req.headers.get("x-cron-secret");
  if (!candidate) return false;
  const { data, error } = await admin.rpc("tend_check_cron_secret", { candidate });
  if (error) { console.error("cron secret check failed", error); return false; }
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (await isCron(req)) {
      if (!VAPID_READY) return json({ error: "Push keys are not configured." }, 500);
      return json(await runSchedule());
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Please sign in again." }, 401);
    if (!VAPID_READY) return json({ error: "Notifications aren't set up on the server yet." }, 500);
    const { data: meta } = await admin.from("meta").select("*").eq("user_id", user.id).maybeSingle();
    const local = localParts(meta?.timezone || "America/New_York");
    const msg = buildMessage(await loadPeople(user.id), meta?.data, local.date)
      ?? { title: "Tend is set up", body: "Your daily reminder will arrive at " + (meta?.reminder_time || "07:30") + "." };
    const sent = await sendToUser(user.id, msg, "tend-test");
    return json(sent ? { sent } : { sent: 0, error: "No notification subscription found. Turn Notifications off and on again." });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong sending the notification." }, 500);
  }
});
