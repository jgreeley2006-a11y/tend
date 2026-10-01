// Tend: meetup-calendar
// Serves a user's meetups as a subscribable calendar (.ics), for Apple Calendar and Google Calendar.
// GET /functions/v1/meetup-calendar?t=<token>. The token is the only key, so it is long and random,
// and the app can replace it ("Make a new link"). Read-only: nothing here changes data.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const MEETUP_MINUTES = 60; // Tend stores only a start time; show each meetup as one hour.

// ---------- calendar text (plain JS so it can be tested in a browser) ----------
// Offset (ms) of a time zone from UTC at a given instant.
function tzOffset(tz, utcMs) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs;
}
// "2026-10-09" + "09:00" in America/New_York -> UTC milliseconds
function localToUtc(date, time, tz) {
  const [y, mo, d] = date.split("-").map(Number); const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let utc = wall - tzOffset(tz, wall);
  utc = wall - tzOffset(tz, utc); // second pass settles DST edges
  return utc;
}
const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escText = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Lines longer than 75 characters continue on the next line, starting with a space.
function fold(line) {
  const out = []; let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest); return out.join("\r\n");
}
const isMeetup = t => t && t.kind === "meetup" && /^\d{4}-\d{2}-\d{2}$/.test(t.due || "") && /^\d{2}:\d{2}$/.test(t.time || "");

export function buildCalendar(people, meta, tz, now = Date.now()) {
  const meetups = [];
  for (const p of people || []) for (const t of p?.tasks || []) if (isMeetup(t)) meetups.push(t);
  for (const t of meta?.tasks || []) if (isMeetup(t)) meetups.push(t);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tend//Meetups//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Tend Meetups", "X-WR-TIMEZONE:" + tz, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const t of meetups) {
    let start;
    try { start = localToUtc(t.due, t.time, tz); } catch { continue; }
    lines.push("BEGIN:VEVENT", "UID:" + escText(t.id) + "@tend", "DTSTAMP:" + stamp(now),
      "DTSTART:" + stamp(start), "DTEND:" + stamp(start + MEETUP_MINUTES * 60000), "SUMMARY:" + escText(t.title || "Meetup"));
    if (t.location) lines.push("LOCATION:" + escText(t.location));
    lines.push("STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ---------- request ----------
Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Not found", { status: 404 });
  const token = new URL(req.url).searchParams.get("t") || "";
  if (!/^[a-f0-9]{32,128}$/.test(token)) return new Response("Not found", { status: 404 });
  try {
    const { data: feed } = await admin.from("calendar_feeds").select("user_id").eq("token", token).maybeSingle();
    if (!feed) return new Response("Not found", { status: 404 });
    const [{ data: people }, { data: meta }] = await Promise.all([
      admin.from("people").select("data").eq("user_id", feed.user_id),
      admin.from("meta").select("data,timezone").eq("user_id", feed.user_id).maybeSingle(),
    ]);
    let tz = meta?.timezone || "America/New_York";
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { tz = "America/New_York"; }
    const body = buildCalendar((people || []).map((r: any) => r.data), meta?.data, tz);
    return new Response(req.method === "HEAD" ? null : body, { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="tend-meetups.ics"',
      "Cache-Control": "private, max-age=300",
    } });
  } catch (e) {
    console.error(e);
    return new Response("Something went wrong", { status: 500 });
  }
});
