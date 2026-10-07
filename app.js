
(() => {
"use strict";

/* ---------- constants ---------- */
const STAGES = ["Met","Building friendship","Spiritual conversation","Heard the gospel","Decision","Discipled"];
const STAGE_SHORT = ["Met","Friendship","Spiritual talk","Heard gospel","Decision","Discipled"];
const HOW_MET = ["Work","Neighbor","Family","Friend","Gym","Church","School","Online","Other"];
const FAITH = ["No faith","Other faith","Used to attend","Christian, not attending","Unsure"];
const LOG_TYPES = ["In person","Call","Text","Meal","Served","Invited","Shared my story"];
const NEXT_BY_STAGE = [
  ["Pray for them this week","Learn one thing about their life","Send a friendly text"],
  ["Share a meal or coffee","Ask about their story","Help with something they need"],
  ["Ask what they think about God","Share your testimony","Send a verse that fits their week"],
  ["Follow up on their questions","Invite to church or a study","Keep praying"],
  ["Start a first-steps study together","Introduce them to your church","Celebrate with them"],
  ["Meet regularly to grow","Ask how you can pray","Encourage them to share their story"]
];

/* ---------- church family (members you want to know better) ---------- */
const DEPTHS = ["Recognize","Acquainted","Connected","Friend","Walking together"];
const WHERE_SEEN = ["Sunday service","Small group","Serving team","Bible study","Kids ministry","Other"];
const NEXT_BY_DEPTH = [
  ["Learn their name","Say hello next Sunday","Note one thing about them"],
  ["Ask how they came to the church","Sit with them on Sunday","Learn their family's names"],
  ["Invite them for coffee or a meal","Ask how you can pray for them","Follow up on a prayer request"],
  ["Have them over to your home","Check in midweek","Remember a key date"],
  ["Study Scripture together","Serve side by side","Pray together regularly"]
];
const DEPTH_QUESTIONS = ["\"I don't think we've met yet. What's your name?\"","\"How did you end up at this church?\"","\"How can I be praying for you this week?\"","\"What's been the hardest and best part of your month?\"","\"What's God been teaching you lately?\""];
const ICON_SEED = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-9"/><path d="M12 12c0-4 3-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5z"/><path d="M12 14.5c0-3.2-2.4-5.5-6.5-5.5 0 3.2 2.4 5.5 6.5 5.5z"/></svg>`;
const ICON_HOME = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/></svg>`;
const isFam = p => !!p && p.circle === "family";
const depthOf = p => Math.min(DEPTHS.length - 1, Math.max(0, p.depth || 0));
const levels = p => isFam(p) ? DEPTHS : STAGES;
const levelShort = p => isFam(p) ? DEPTHS : STAGE_SHORT;
const levelOf = p => isFam(p) ? depthOf(p) : (p.stage || 0);
const avatar = (p, style="") => `<div class="avatar${isFam(p) ? " fam" : ""}"${style ? ` style="${style}"` : ""}>${esc(initials(p.name))}</div>`;
function selectOpts(list, val){ const all = val && !list.includes(val) ? [val, ...list] : list; return all.map(x => `<option ${x===val?"selected":""}>${esc(x)}</option>`).join(""); }

/* ---------- helpers ---------- */
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = p => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const pad = n => String(n).padStart(2,"0");
const dstr = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const today = () => dstr(new Date());
const addDays = (s, n) => { const d = s ? new Date(s+"T12:00:00") : new Date(); d.setDate(d.getDate()+n); return dstr(d); };
const daysBetween = (a, b) => Math.round((new Date(b+"T12:00:00") - new Date(a+"T12:00:00"))/86400000);
const fmtDate = s => s ? new Date(s+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"}) : "";
const fmtDay = s => { const n = daysBetween(today(), s); if (n===0) return "today"; if (n===1) return "tomorrow"; if (n===-1) return "yesterday"; if (n>1 && n<7) return new Date(s+"T12:00:00").toLocaleDateString(undefined,{weekday:"long"}); return fmtDate(s); };
const initials = n => (n||"?").replace(/\(.*?\)/g,"").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
const weekStart = () => { const d = new Date(); const day = (d.getDay()+6)%7; d.setDate(d.getDate()-day); return dstr(d); };
const clone = o => JSON.parse(JSON.stringify(o));
const first = n => (n||"").trim().split(/\s+/)[0] || n;
const fmtTime = t => { const [h,m] = String(t).split(":").map(Number); return new Date(2000,0,1,h,m).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}); };
function remindNote(tm, due){ if (!tm) return; if (!S.settings.notify) toast("Saved. Turn on Notifications (gear button) to get this reminder."); else toast("You'll get a reminder " + fmtDay(due) + " at " + fmtTime(tm) + "."); }

/* ---------- meetups (a task with kind:"meetup"; reminders are sent by the send-reminders function) ---------- */
const ICON_CAL = `<svg class="ic cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`;
const ICON_TRASH = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;
const REM_LABEL = { prep:"Prep", dayof:"Day of", followup:"Follow-up", custom:"Reminder" };
const isMeetup = t => !!t && t.kind === "meetup";
function meetupDefaults(){ return Object.assign({ prepTime:"20:00", morningTime:"07:00", followupHours:6 }, S.meta.meetupDefaults || {}); }
// local date + "HH:MM" <-> Date
const toDT = (date, time) => new Date(date + "T" + time + ":00");
const fromDT = d => ({ date: dstr(d), time: pad(d.getHours()) + ":" + pad(d.getMinutes()) });
const addMin = (d, n) => { const x = new Date(d); x.setMinutes(x.getMinutes() + n); return x; };
const remKey = r => r.date + "T" + r.time;
const sortRems = list => list.sort((a,b) => remKey(a).localeCompare(remKey(b)));
// "20:00" -> "8:00pm"
const clock = hhmm => { const [h, m] = String(hhmm).split(":").map(Number); return (h % 12 || 12) + ":" + pad(m) + (h < 12 ? "am" : "pm"); };
function fmtRem(r){
  const d = new Date(r.date + "T12:00:00"); const far = Math.abs(daysBetween(today(), r.date)) >= 7;
  return d.toLocaleDateString(undefined, far ? { weekday:"short", month:"short", day:"numeric" } : { weekday:"short" }) + " " + clock(r.time);
}
// The standard three. Anything already in the past is skipped.
function defaultReminders(due, time, now = new Date()){
  const md = meetupDefaults(); const start = toDT(due, time);
  const morning = toDT(due, md.morningTime); const before = addMin(start, -90);
  const out = [
    { type:"prep", ...fromDT(toDT(addDays(due, -1), md.prepTime)) },
    { type:"dayof", ...fromDT(morning < before ? morning : before) },
    { type:"followup", ...fromDT(addMin(start, Math.round((+md.followupHours || 6) * 60))) }
  ];
  return sortRems(out.filter(r => toDT(r.date, r.time) > now).map(r => ({ id: uid("rm"), ...r })));
}
// Move every reminder by the same amount the meetup moved; drop any that land in the past.
function shiftReminders(list, from, to, now = new Date()){
  const delta = (toDT(to.due, to.time) - toDT(from.due, from.time)) / 60000;
  return sortRems((list || []).map(r => ({ ...r, ...fromDT(addMin(toDT(r.date, r.time), delta)) })).filter(r => toDT(r.date, r.time) > now));
}
/* ---------- Tend the Week: week math, saved plans, person colors ---------- */
// Weeks run Monday–Sunday in the user's time zone (meta.timezone). Days are "YYYY-MM-DD" strings.
// When the Today card invites you to plan: Sunday 12:00 PM through the end of Monday. dow: 0 = Monday … 6 = Sunday.
const PLAN_WINDOW = { from: { dow: 6, hour: 12 }, to: { dow: 0, hour: 24 } };
const WEEK_PLANS_KEEP = 12;
function userTz(){
  const tz = S.settings.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch(_) { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
}
// The wall-clock date and time right now in the user's time zone
function tzNow(now = new Date()){
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: userTz(), hourCycle:"h23", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" })
    .formatToParts(now).map(x => [x.type, x.value]));
  return { date: p.year + "-" + p.month + "-" + p.day, hour: +p.hour % 24, minute: +p.minute };
}
const dowOf = s => (new Date(s + "T12:00:00").getDay() + 6) % 7;
const mondayOf = s => addDays(s, -dowOf(s));
// Planning Mon–Fri plans this week; planning on Sat/Sun plans the coming week.
const planWeekOf = (s = tzNow().date) => dowOf(s) >= 5 ? addDays(mondayOf(s), 7) : mondayOf(s);
const weekDates = weekOf => [0,1,2,3,4,5,6].map(i => addDays(weekOf, i));
function inPlanWindow(n = tzNow()){
  const d = dowOf(n.date), h = n.hour + n.minute / 60, { from, to } = PLAN_WINDOW;
  const after = d > from.dow || (d === from.dow && h >= from.hour);
  const before = d < to.dow || (d === to.dow && h < to.hour);
  return from.dow <= to.dow ? after && before : after || before; // the window may wrap past Sunday
}
// Saved plans live in meta.weekPlans, keyed by the week's Monday. Missing = no plans.
// Fill in defaults without touching anything we don't recognize.
function fillPlan(p, weekOf){
  const now = new Date().toISOString();
  p.weekOf ||= weekOf; p.createdAt ||= now; p.updatedAt ||= now;
  if (!["light","normal","full"].includes(p.capacity)) p.capacity = "normal";
  ["steps","justPray","dismissedSuggestions","carry"].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
  if (!p.rotation || typeof p.rotation !== "object" || Array.isArray(p.rotation)) p.rotation = {};
  return p;
}
function weekPlan(weekOf, create){
  const all = S.meta.weekPlans && typeof S.meta.weekPlans === "object" ? S.meta.weekPlans : null;
  if (!(all && all[weekOf]) && !create) return null;
  if (!all) S.meta.weekPlans = {};
  return S.meta.weekPlans[weekOf] = fillPlan(S.meta.weekPlans[weekOf] || {}, weekOf);
}
function saveWeekPlan(p){
  clearTimeout(saveWeekPlanSoon.t); saveWeekPlanSoon.t = null;
  p.updatedAt = new Date().toISOString();
  const all = S.meta.weekPlans || (S.meta.weekPlans = {});
  all[p.weekOf] = p;
  Object.keys(all).sort().reverse().slice(WEEK_PLANS_KEEP).forEach(k => delete all[k]);
  saveMeta();
}
// Drafts save about a second after the last change, and right away if the app is closed.
function saveWeekPlanSoon(p){ clearTimeout(saveWeekPlanSoon.t); saveWeekPlanSoon.p = p; saveWeekPlanSoon.t = setTimeout(() => saveWeekPlan(p), 1000); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && saveWeekPlanSoon.t) saveWeekPlan(saveWeekPlanSoon.p); });
// A steady color for each person (same color every time), readable in light and dark mode.
const PERSON_COLORS = ["#2A9D8F","#C9822A","#3D7CC9","#C4577A","#7A8B2E","#D9703F","#2F9AC2","#8A63C9","#6C7A89","#9A6B4A"];
function personColor(id){ let h = 2166136261; for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return PERSON_COLORS[(h >>> 0) % PERSON_COLORS.length]; }

const taskTitle = t => (isMeetup(t) ? ICON_CAL : "") + esc(t.title);
const meetupWhen = t =>(t.time ? fmtTime(t.time) : "") + (t.location ? (t.time ? " · " : "") + t.location : "");

/* ---------- state ---------- */
const S = {
  people: new Map(),       // id -> person
  meta: { kind:"meta", tasks:[], quietUntil:null, reviewAt:null, hideExamples:false },
  settings: { notify:false, time:"07:30", tz:null },
  mode: "loading",         // loading | signin | db
  examples: false,
  ui: { tab:"today", personId:null, stageFilter:"All", q:"", open:null, circle:"reach" },
  signin: { step:"signin" },
  syncMsg: "",
  ai: null,
  dirty: false
};

let sb = null;              // Supabase client
let USER = null;            // signed-in user
const cacheKey = () => "tend-cache-" + (USER ? USER.id : "anon");
const PENDKEY = () => "tend-pending-" + (USER ? USER.id : "anon");

/* ---------- persistence (Supabase) ---------- */
function loadPending(){ try { return new Set(JSON.parse(localStorage.getItem(PENDKEY()) || "[]")); } catch(_) { return new Set(); } }
function storePending(set){ try { localStorage.setItem(PENDKEY(), JSON.stringify([...set])); } catch(_){} }
const pending = { set: new Set() };
function cacheLocal(){
  try { localStorage.setItem(cacheKey(), JSON.stringify({ people:[...S.people.values()].filter(p=>!p.example), meta:S.meta, settings:S.settings })); } catch(_){}
}
const queues = new Map();
function enqueue(id, fn){
  const prev = queues.get(id) || Promise.resolve();
  const next = prev.then(async () => {
    const { error } = await fn();
    if (error) throw error;
    if (pending.set.delete(id)) storePending(pending.set);
    setSync("");
  }).catch(e => {
    console.warn("save failed", e);
    pending.set.add(id); storePending(pending.set);
    setSync(navigator.onLine ? "Couldn't sync. Will retry." : "Offline. Saved on this phone.");
  });
  queues.set(id, next); return next;
}
function writePerson(id){
  const p = S.people.get(id);
  if (!p) return enqueue(id, () => sb.from("people").delete().eq("id", id));
  return enqueue(id, () => sb.from("people").upsert({ id, user_id: USER.id, data: p, updated_at: new Date().toISOString() }));
}
function writeMeta(){
  return enqueue("meta", () => sb.from("meta").upsert({
    user_id: USER.id, data: S.meta,
    notify_enabled: !!S.settings.notify, reminder_time: S.settings.time || "07:30",
    timezone: S.settings.tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
    updated_at: new Date().toISOString()
  }));
}
function savePerson(p){
  p.updatedAt = Date.now();
  S.people.set(p.id, p);
  if (p.example) return;
  cacheLocal(); writePerson(p.id);
}
function deletePerson(id){
  const p = S.people.get(id); S.people.delete(id);
  if (!p || p.example) return;
  cacheLocal(); writePerson(id);
}
function saveMeta(){ cacheLocal(); writeMeta(); }
function flushPending(){
  [...pending.set].forEach(id => id === "meta" ? writeMeta() : writePerson(id));
}
function setSync(msg){ S.syncMsg = msg; const el = document.getElementById("sync"); if (el) el.textContent = msg; }

async function loadFromServer(){
  const [pr, mr] = await Promise.all([
    sb.from("people").select("id,data"),
    sb.from("meta").select("*").eq("user_id", USER.id).maybeSingle()
  ]);
  if (pr.error || mr.error) throw (pr.error || mr.error);
  const serverPeople = new Map();
  pr.data.forEach(r => serverPeople.set(r.id, r.data));
  // keep local versions of anything not yet synced
  pending.set.forEach(id => { if (id === "meta") return; const local = S.people.get(id); if (local) serverPeople.set(id, local); else serverPeople.delete(id); });
  S.people = serverPeople;
  if (mr.data && !pending.set.has("meta")){
    S.meta = Object.assign({ kind:"meta", tasks:[], quietUntil:null, reviewAt:null, hideExamples:false }, mr.data.data || {});
    S.settings = { notify: !!mr.data.notify_enabled, time: mr.data.reminder_time || "07:30", tz: mr.data.timezone };
  }
  S.meta.tasks ||= [];
  cacheLocal();
}

function loadVerses(){
  try { const c = JSON.parse(localStorage.getItem("tend-verses") || "null"); if (c && c.length) S.verses = c; } catch(_){}
  sb.from("verses").select("n,ref,text").order("n").then(({ data }) => { if (data && data.length){ S.verses = data; try { localStorage.setItem("tend-verses", JSON.stringify(data)); } catch(_){} softRender(); } });
  loadDevos();
}
// Daily devos rarely change, so keep them on the phone and only download them again
// when the table's row count or newest updated_at is different from what we saved.
function loadDevos(){
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("tend-devos") || "null"); if (saved && saved.list && saved.list.length) S.devos = saved.list; } catch(_){}
  sb.from("devotionals").select("updated_at", { count:"exact" }).order("updated_at", { ascending:false }).limit(1).then(({ data, count, error }) => {
    if (error || !data || !data.length) return;
    const version = count + "|" + data[0].updated_at;
    if (saved && saved.version === version && S.devos) return;
    sb.from("devotionals").select("n,title,body,today,pray").order("n").then(({ data: list }) => {
      if (!list || !list.length) return;
      S.devos = list; try { localStorage.setItem("tend-devos", JSON.stringify({ version, list })); } catch(_){}
      softRender();
    });
  });
}
// The verse (and devo) of the day: days since Jan 1, 2026, wrapped around the number of verses.
// Same rule as verseFor() in send-reminders, so Today matches the morning push.
function dayVerseN(){
  const count = (S.verses || []).length; if (!count) return null;
  const t = today(); const dayN = Math.floor((Date.parse(t + "T00:00:00Z") - Date.UTC(2026,0,1)) / 86400000);
  return ((dayN % count) + count) % count;
}
function verseToday(){ const i = dayVerseN(); return i === null ? null : S.verses[i]; }
// Today's devo, paired with its verse by n. Null until both have loaded at least once.
function devoForToday(){
  const verse = verseToday(); if (!verse) return null;
  const devo = (S.devos || []).find(d => d.n === verse.n);
  return devo ? Object.assign({ verse }, devo) : null;
}
async function boot(){
  const C = window.TEND_CONFIG || {};
  if (!window.supabase || !C.SUPABASE_URL || C.SUPABASE_URL.includes("YOUR-PROJECT")){
    $("#app").innerHTML = `<div class="signin"><h1>Almost there</h1><p class="lead">Tend isn't connected to its database yet. Fill in config.js (see SETUP.md, step 3).</p></div>`;
    return;
  }
  sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(e => console.warn(e));
  const { data: { session } } = await sb.auth.getSession();
  if (!session){ S.mode = "signin"; let back = false; try { back = !!localStorage.getItem("tend-returning"); } catch(_){} S.signin = { step: back ? "signin" : "create" }; render(); return; }
  await startSession(session.user);
}
async function startSession(user){
  USER = user;
  try { localStorage.setItem("tend-returning", "1"); } catch(_){}
  pending.set = loadPending();
  try { const raw = localStorage.getItem(cacheKey()); if (raw){ const d = JSON.parse(raw); (d.people||[]).forEach(p => S.people.set(p.id, p)); if (d.meta) S.meta = d.meta; if (d.settings) S.settings = d.settings; S.meta.tasks ||= []; S.mode = "db"; render(); } } catch(_){}
  loadVerses();
  try { await loadFromServer(); S.mode = "db"; softRender(); flushPending(); }
  catch(e){ console.warn(e); if (S.mode !== "db"){ S.mode = "db"; render(); } setSync("Offline. Showing what's saved on this phone."); }
  setTimeout(askContact, 300); // in case iPhone closed Tend while you were in Phone or Messages
}
window.addEventListener("online", () => { if (USER){ flushPending(); } });
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !USER) return;
  flushPending();
  try { await loadFromServer(); softRender(); } catch(_){}
});

/* ---------- sign in (email + password; no email sending needed) ---------- */
function viewSignIn(){
  const st = S.signin; const create = st.step === "create";
  return `<div class="signin">
    <div class="brand"><img src="icons/icon-192.png" alt=""><h1>Tend</h1></div>
    <p class="lead">A private place to keep track of the people you're reaching, what they've shared, and what to do next.</p>
    <form class="stack" data-form="auth">
      <label class="f">Email<input class="t" id="si-email" type="email" autocomplete="email" required value="${esc(st.email||"")}"></label>
      <label class="f">Password<input class="t" id="si-pass" type="password" autocomplete="${create?"new-password":"current-password"}" minlength="8" required>
        ${create ? `<span class="hint">At least 8 characters. Write it down; there's no reset email yet.</span>` : ""}</label>
      ${st.err ? `<div class="err">${esc(st.err)}</div>` : ""}
      <button class="btn" ${st.busy?"disabled":""}>${st.busy ? "One moment…" : create ? "Create my account" : "Sign in"}</button>
      <button type="button" class="linkbtn" data-act="signin-toggle">${create ? "I already have an account" : "New here? Create an account"}</button>
    </form>
  </div>`;
}
async function doAuth(email, password){
  const create = S.signin.step === "create";
  S.signin = { step: S.signin.step, email, busy:true }; render();
  const res = create ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
  if (res.error){
    const m = res.error.message || "";
    const err = /invalid login/i.test(m) ? "That email and password don't match. New to Tend? Tap \"New here? Create an account\" below." :
                /already registered|already exists/i.test(m) ? "There's already an account for that email. Sign in instead." :
                /confirm/i.test(m) ? "Supabase is still asking for email confirmation. Turn off \"Confirm email\" (SETUP.md step 4)." : m;
    S.signin = { step: /already registered|already exists/i.test(m) ? "signin" : S.signin.step, email, err }; render(); return;
  }
  if (!res.data.session){
    S.signin = { step:"create", email, err:"Account created, but Supabase wants an email confirmation first. Turn off \"Confirm email\" (SETUP.md step 4), then sign in." }; render(); return;
  }
  S.signin = { step:"signin" };
  await startSession(res.data.user);
}

/* ---------- notifications ---------- */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
function b64ToUint8(b64){ const pad = "=".repeat((4 - b64.length % 4) % 4); const s = atob((b64 + pad).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from([...s].map(c => c.charCodeAt(0))); }
// Does this push subscription use the server key in config.js? (true if the browser can't tell us)
function sameServerKey(sub){
  const k = sub.options && sub.options.applicationServerKey; if (!k) return true;
  const a = new Uint8Array(k), b = b64ToUint8(window.TEND_CONFIG.VAPID_PUBLIC_KEY);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

async function enableNotifications(){
  try {
    if (Notification.permission === "denied"){ toast("Notifications are blocked. iPhone Settings › Notifications › Tend › Allow Notifications."); return false; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted"){ toast("Notifications weren't allowed. iPhone Settings › Notifications › Tend › Allow Notifications."); return false; }
    toast("Setting up…");
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) reg = await navigator.serviceWorker.register("sw.js");
    reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error("The app's background worker didn't start. Close Tend fully and open it again.")), 10000))]);
    let sub = await reg.pushManager.getSubscription();
    // A subscription made with an older server key can't receive pushes any more; replace it.
    if (sub && !sameServerKey(sub)){
      await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe().catch(() => {}); sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(window.TEND_CONFIG.VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    const { error } = await sb.from("push_subscriptions").upsert({ endpoint: json.endpoint, user_id: USER.id, subscription: json });
    if (error) throw new Error("Couldn't save to Supabase: " + (error.message || error.code));
    S.settings.notify = true; S.settings.tz = Intl.DateTimeFormat().resolvedOptions().timeZone; saveMeta();
    return true;
  } catch(e){
    console.warn(e);
    showError("Couldn't turn on reminders: " + (e && (e.message || e.name) || e));
    return false;
  }
}
function showError(msg){
  const r = $("#toast-root"); r.innerHTML = `<div class="toast" role="alert" style="max-width:92%">${esc(msg)}<div style="margin-top:8px"><button class="linkbtn" style="color:inherit;text-decoration:underline" data-act="dismiss-toast">OK</button></div></div>`;
  clearTimeout(toast.t);
}
async function disableNotifications(){
  try {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (sub){ await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
  } catch(e){ console.warn(e); }
  S.settings.notify = false; saveMeta();
}
async function sendTest(btn){
  btn.disabled = true; btn.textContent = "Sending…";
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(window.TEND_CONFIG.SUPABASE_URL + "/functions/v1/send-reminders", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ test: true })
    });
    const out = await res.json().catch(() => ({}));
    toast(res.ok && out.sent ? "Sent. It should arrive in a few seconds." : (out.error || "The test didn't send. Check SETUP.md step 6."));
  } catch(e){ toast("The test didn't send. Check your connection."); }
  btn.disabled = false; btn.textContent = "Send a test notification";
}

function settingsSheet(){
  const s = S.settings;
  let notif;
  if (!pushSupported() && isIOS && !isStandalone()){
    notif = `<div class="banner info"><div class="grow"><div><b>Add Tend to your Home Screen first.</b> In Safari, tap Share, then Add to Home Screen. Open Tend from its icon, then come back here.</div></div></div>`;
  } else if (!pushSupported()){
    notif = `<p class="small muted">This browser can't show notifications. On iPhone, open Tend from its Home Screen icon.</p>`;
  } else {
    notif = `
      <div class="setting"><div class="grow"><div>Notifications</div><div class="small muted">Task reminders at the times you set</div></div>
        <button class="switch" role="switch" aria-checked="${!!s.notify}" data-act="toggle-notify" aria-label="Notifications"></button></div>
      <div class="setting"><div class="grow"><div>Daily summary</div><div class="small muted">Your next steps and Focus 5, once a day</div></div>
        <button class="switch" role="switch" aria-checked="${S.meta.dailySummary !== false}" data-act="toggle-daily" aria-label="Daily summary"></button></div>
      <div class="setting"><div class="grow"><div>Summary time</div><div class="small muted">${esc(s.tz || Intl.DateTimeFormat().resolvedOptions().timeZone)}</div></div>
        <input class="t" type="time" id="set-time" value="${esc(s.time || "07:30")}" style="width:auto"></div>
      ${s.notify ? `<div><button class="btn small ghost" data-act="test-push">Send a test notification</button></div>` : ""}`;
  }
  openSheet(`<div class="stack-lg">
    <h2>Settings</h2>
    <section class="stack"><h3>Notifications</h3>${notif}</section>
    <section class="stack"><h3>Meetup reminders</h3><p class="small muted" style="margin:0">Used for new meetups and when you tap Restore defaults. Meetups you've already planned keep their reminders.</p>
      <div>
        <div class="setting"><div class="grow"><div>Prep</div><div class="small muted">The night before</div></div><input class="t" type="time" id="set-prep" value="${esc(meetupDefaults().prepTime)}" style="width:auto"></div>
        <div class="setting"><div class="grow"><div>Day of</div><div class="small muted">At this time, or 90 minutes before if that's earlier</div></div><input class="t" type="time" id="set-morning" value="${esc(meetupDefaults().morningTime)}" style="width:auto"></div>
        <div class="setting"><div class="grow"><div>Follow-up</div><div class="small muted">Hours after the meetup starts</div></div><input class="t" type="number" inputmode="numeric" min="1" max="48" step="1" id="set-follow" value="${esc(meetupDefaults().followupHours)}" style="width:80px"></div>
      </div></section>
    <section class="stack" id="set-cal"><h3>Calendar</h3>${calSection()}</section>
    <section class="stack"><h3>Quiet mode</h3><p class="small muted" style="margin:0">Pause reminders for a day, a week, or until you turn it back on.</p><div><button class="btn small ghost" data-act="quiet">${isQuiet() ? "Quiet mode is on" : "Turn on quiet mode"}</button></div></section>
    <section class="stack"><h3>Your data</h3><p class="small muted" style="margin:0">Signed in as ${esc(USER?.email || "")}. Only you can see your list.</p>
      <div class="row wrap"><button class="btn small ghost" data-act="export">Download a copy</button><button class="btn small ghost" data-act="signout">Sign out</button></div></section>
    <div><button class="btn" data-act="close-sheet">Done</button></div>
  </div>`);
}
/* Calendar: a private, subscribable link to your meetups (served by the meetup-calendar function). */
const calFeedUrl = token => window.TEND_CONFIG.SUPABASE_URL + "/functions/v1/meetup-calendar?t=" + token;
async function loadCalToken(){
  const { data, error } = await sb.from("calendar_feeds").select("token").eq("user_id", USER.id).maybeSingle();
  S.cal = error ? { err:true } : { token: data?.token || null };
  if ($("#set-cal")) $("#set-cal").innerHTML = "<h3>Calendar</h3>" + calSection();
}
async function newCalToken(){
  const token = [...crypto.getRandomValues(new Uint8Array(24))].map(x => x.toString(16).padStart(2, "0")).join("");
  const { error } = await sb.from("calendar_feeds").upsert({ user_id: USER.id, token });
  if (error) throw error;
  S.cal = { token };
}
function calSection(){
  const c = S.cal;
  if (!c){ loadCalToken().catch(() => { S.cal = { err:true }; }); return `<p class="small muted" style="margin:0">Loading…</p>`; }
  if (c.err) return `<p class="small muted" style="margin:0">Couldn't load your calendar link. Check your connection and open Settings again.</p>`;
  if (!c.token) return `<p class="small muted" style="margin:0">See your meetups in Apple or Google Calendar. They update on their own when you add, move or delete a meetup in Tend.</p>
    <div><button class="btn small" data-act="cal-create">Add meetups to my calendar</button></div>`;
  const url = calFeedUrl(c.token);
  return `<p class="small muted" style="margin:0">Your meetups show up in a calendar called Tend Meetups. Changes can take up to an hour to appear.</p>
    <div class="row wrap"><a class="btn small" href="${esc(url.replace(/^https?:/, "webcal:"))}">Subscribe in Apple Calendar</a><button class="btn small ghost" data-copy="${esc(url)}">Copy link</button></div>
    <span class="hint">Google Calendar: on a computer, open calendar.google.com, then Other calendars › + › From URL, and paste the link.</span>
    <span class="hint">Keep this link private. Anyone with it can see your meetups.</span>
    <div id="cal-new">${calNewHtml(false)}</div>`;
}
const calNewHtml = ask => ask
  ? `<div class="card stack"><div>Make a new link? The old one stops working, so you'll need to subscribe again with the new one.</div><div class="row"><button class="btn small" data-act="cal-new-yes">Make a new link</button><button class="btn small ghost" data-act="cal-new-no">Keep this one</button></div></div>`
  : `<button class="linkbtn muted" data-act="cal-new-ask">Make a new link</button>`;
function exportData(){
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), people:[...S.people.values()].filter(p=>!p.example), meta:S.meta }, null, 2)], { type:"application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tend-" + today() + ".json"; document.body.append(a); a.click(); a.remove();
}

/* ---------- derived ---------- */
const realPeople = () => [...S.people.values()].filter(p => !p.example);
function people(){
  const real = realPeople();
  S.examples = real.length === 0 && !S.meta.hideExamples && S.mode !== "loading";
  if (S.examples){ ensureExamples(); return [...S.people.values()]; }
  for (const [id,p] of S.people) if (p.example) S.people.delete(id);
  return real;
}
function lastContact(p){ const l = (p.logs||[]).map(x=>x.at).sort().pop(); return l || p.metOn || null; }
function sinceContact(p){ const l = lastContact(p); return l ? daysBetween(l, today()) : null; }
function focusPeople(){ return people().filter(p => p.focus); }
function allTasks(){
  const out = [];
  people().forEach(p => (p.tasks||[]).forEach(t => out.push({...t, personId:p.id})));
  (S.meta.tasks||[]).forEach(t => out.push({...t, personId:null}));
  return out;
}
function nextDateOf(d){
  if (!d.date) return null;
  if (!d.yearly) return d.date;
  const t = today(); const y = +t.slice(0,4);
  let n = y + d.date.slice(4); if (n < t) n = (y+1) + d.date.slice(4); return n;
}
function isQuiet(){ const q = S.meta.quietUntil; return !!q && (q === "on" || q >= today()); }

/* ---------- examples ---------- */
function ensureExamples(){
  if ([...S.people.values()].some(p => p.example)) return;
  const t = today();
  const ex = [
    { id:"ex-marcus", example:true, kind:"person", name:"Marcus Reed", howMet:"Work", relationship:"Coworker on the ops team", stage:2, focus:true, metOn:addDays(t,-120),
      note:"Married to Tasha, two boys. Coaches youth soccer. Grew up Catholic, stopped going in college.", faith:"Used to attend", family:"Tasha (wife), Eli and Jonah", job:"Operations lead", interests:"Soccer, grilling, fantasy football", phone:"(813) 555-0142", email:"",
      dates:[{id:"d1",label:"Birthday",date:addDays(t,4),yearly:true}],
      logs:[
        {id:"l1",at:addDays(t,-9),type:"Meal",shared:"His dad is having heart surgery next month. He's scared but doesn't show it.",cares:"Being a steady dad for his boys",questions:"Why do you pray before lunch?"},
        {id:"l2",at:addDays(t,-40),type:"In person",shared:"Talked about the soccer season.",cares:"",questions:""}],
      prayers:[{id:"r1",text:"His dad's heart surgery",at:addDays(t,-9),answeredAt:null},{id:"r2",text:"Peace for Marcus as he waits",at:addDays(t,-9),answeredAt:null}],
      prayed:[addDays(t,-1),addDays(t,-2)], tasks:[{id:"t1",title:"Ask how his dad's pre-op visit went",due:t,done:false}],
      stageHistory:[{stage:0,at:addDays(t,-120)},{stage:1,at:addDays(t,-80)},{stage:2,at:addDays(t,-9)}] },
    { id:"ex-dana", example:true, kind:"person", name:"Dana & Luis Ortiz", howMet:"Neighbor", relationship:"Next door", stage:1, focus:true, metOn:addDays(t,-60),
      note:"Moved in this summer from Ohio. Dana is a nurse on night shifts. They have a golden retriever named Biscuit.", faith:"Unsure", family:"Daughter Mia (6)", job:"Dana: ER nurse. Luis: electrician", interests:"Gardening, dogs",
      dates:[], logs:[{id:"l3",at:addDays(t,-21),type:"Served",shared:"Helped Luis carry a new couch in. Dana said they don't know anyone here yet.",cares:"Making friends in a new city",questions:""}],
      prayers:[{id:"r3",text:"Friends and belonging in a new city",at:addDays(t,-21),answeredAt:null}], prayed:[addDays(t,-3)], tasks:[], stageHistory:[{stage:0,at:addDays(t,-60)},{stage:1,at:addDays(t,-21)}] },
    { id:"ex-carol", example:true, kind:"person", name:"Aunt Carol", howMet:"Family", relationship:"Mom's sister", stage:3, focus:false, metOn:addDays(t,-400),
      note:"Lost Uncle Ray two years ago. Has been reading the Gospel of John I gave her.", faith:"Other faith", family:"", job:"Retired teacher", interests:"Quilting, her church choir days",
      dates:[{id:"d2",label:"Anniversary of Ray's passing",date:addDays(t,12),yearly:true}],
      logs:[{id:"l4",at:addDays(t,-35),type:"Call",shared:"She said John 11 made her cry.",cares:"Whether she'll see Ray again",questions:"Is it too late for someone like me?"}],
      prayers:[{id:"r4",text:"Comfort in grief",at:addDays(t,-200),answeredAt:addDays(t,-6)}], prayed:[], tasks:[{id:"t2",title:"Mail her a card before the anniversary",due:addDays(t,7),done:false}],
      stageHistory:[{stage:3,at:addDays(t,-35)}] }
  ];
  ex.forEach(p => S.people.set(p.id, p));
}

/* ---------- rendering ---------- */
function softRender(){
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)){ S.dirty = true; return; }
  render();
}
document.addEventListener("focusout", () => setTimeout(() => { if (S.dirty){ const a = document.activeElement; if (!a || !/INPUT|TEXTAREA|SELECT/.test(a.tagName)){ S.dirty = false; render(); } } }, 0));

function render(){
  const app = $("#app");
  const signedIn = S.mode === "db";
  $("#nav").hidden = !signedIn; $("#fab").hidden = !signedIn;
  if (S.mode === "loading"){ app.innerHTML = `<div class="loading">Opening your list…</div>`; return; }
  if (S.mode === "signin"){ app.innerHTML = viewSignIn(); return; }
  if (S.tw){ app.innerHTML = viewPlanner(); $("#nav").hidden = true; $("#fab").hidden = true; document.body.dataset.planner = "1"; syncCircle("reach"); if (S.tw.screen === "beyond") twBindDeck(); return; }
  delete document.body.dataset.planner;
  const { tab, personId } = S.ui;
  if (personId && S.people.has(personId)) app.innerHTML = viewPerson(S.people.get(personId));
  else { S.ui.personId = null; app.innerHTML = tab === "people" ? viewPeople() : tab === "prayer" ? viewPrayer() : tab === "tasks" ? viewTasks() : viewToday(); }
  document.querySelectorAll(".nav button").forEach(b => { if (b.dataset.tab === tab && !S.ui.personId) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  syncCircle();
}
function viewCircle(){
  if (S.ui.personId) return isFam(S.people.get(S.ui.personId)) ? "family" : "reach";
  return S.ui.tab === "people" && S.ui.circle === "family" ? "family" : "reach";
}
function syncCircle(c){ document.body.dataset.circle = c || viewCircle(); }

function notifyNudge(){
  if (S.settings.notify || S.meta.nudgeOff || S.examples || realPeople().length === 0) return "";
  return `<div class="banner info"><div class="grow"><div><b>Get reminders on your phone.</b> Turn on notifications so Tend can remind you about follow-ups and next steps.</div><div class="row wrap"><button class="btn small" data-act="nudge-on">Turn on notifications</button><button class="linkbtn muted" data-act="nudge-off">Not now</button></div></div></div>`;
}
function exampleBanner(){
  if (!S.examples) return "";
  return `<div class="banner info"><div class="grow"><div><b>These are example people.</b> They show how Tend works and aren't saved to your account. Add your first person and they'll disappear.</div><div><button class="linkbtn" data-act="hide-examples">Hide examples</button></div></div></div>`;
}
function storageNote(){ return `<p class="sync" id="sync" role="status">${esc(S.syncMsg||"")}</p>`; }

function stageTag(p){ return `<span class="stage${isFam(p) ? " fam" : ""}">${esc(levelShort(p)[levelOf(p)])}</span>`; }
function nameLink(p){ return `<button class="who${isFam(p) ? " fam" : ""}" data-open="${esc(p.id)}">${esc(p.name)}</button>`; }

/* Today */
function todaySteps(){
  const t = today(); const steps = [];
  const ppl = people(); const byId = new Map(ppl.map(p => [p.id, p]));
  allTasks().filter(x => !x.done && x.due && x.due <= t).sort((a,b)=>a.due.localeCompare(b.due)).forEach(x => {
    const p = x.personId ? byId.get(x.personId) : null;
    const kind = isMeetup(x) ? (x.due < t || (x.time && toDT(x.due, x.time) <= new Date()) ? "How did it go?" : "Meetup today · " + meetupWhen(x)) : x.due < t ? "Pick back up" : "Due today";
    steps.push({ kind, title: x.title, person: p, task: x });
  });
  ppl.forEach(p => (p.dates||[]).forEach(d => { const n = nextDateOf(d); if (n){ const k = daysBetween(t, n); if (k >= 0 && k <= 7) steps.push({ kind: `${d.label} · ${fmtDay(n)}`, title: `Reach out to ${first(p.name)} before ${k===0?"the end of today":fmtDay(n)}`, person:p, moment:true }); } }));
  focusPeople().forEach(p => { const s = sinceContact(p); if (s === null || s >= 14) steps.push({ kind: s === null ? "No contact logged yet" : `Last contact ${s} days ago`, title: `Check in with ${first(p.name)}`, person:p, reconnect:true }); });
  return steps;
}
function viewToday(){
  const quiet = isQuiet();
  const steps = todaySteps();
  const shown = steps.slice(0,3);
  const ws = weekStart(); const t = today();
  let prayedN=0, convN=0, mealN=0, invN=0;
  people().forEach(p => {
    prayedN += (p.prayed||[]).filter(d => d>=ws && d<=t).length;
    (p.logs||[]).filter(l => l.at>=ws && l.at<=t).forEach(l => { convN++; if (l.type==="Meal"||l.type==="Served") mealN++; if (l.type==="Invited") invN++; });
  });
  const hello = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  return `
  <div class="top"><div><div class="date">${esc(new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}))}</div><h1>${hello}</h1></div>
    <div class="top-actions"><button class="iconbtn" data-act="quiet">${quiet ? "Quiet on" : "Quiet mode"}</button><button class="iconbtn gear" data-act="settings" aria-label="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></div></div>
  <div class="stack-lg">
    ${twTodayCard()}
    ${(v => v ? `<section class="verse"><div class="eyebrow">Today's verse</div><blockquote>${esc(v.text)}</blockquote><div class="row spread"><span class="vref">${esc(v.ref)} · KJV</span><button class="linkbtn" data-copy="${esc(v.text + " (" + v.ref + ", KJV)")}">Copy</button></div></section>` : "")(verseToday())}
    ${exampleBanner()}
    ${notifyNudge()}
    ${quiet ? `<div class="banner quiet"><div class="grow"><div><b>Quiet mode is on${S.meta.quietUntil!=="on" ? " until " + esc(fmtDay(S.meta.quietUntil)) : ""}.</b> Reminders are paused. Rest is part of faithfulness.</div><div><button class="linkbtn" data-act="quiet-off">Turn off quiet mode</button></div></div></div>` : ""}
    ${quiet ? "" : `<section>
      <div class="section-head"><h2>Next steps</h2>${steps.length>3?`<button class="linkbtn" data-tab-go="tasks">${steps.length-3} more</button>`:""}</div>
      <div class="card">${shown.length ? `<div class="steps">${shown.map((s,i) => `
        <div class="step">
          ${s.task ? `<button class="dot" aria-label="Mark done" data-done-task="${esc(s.task.id)}" data-pid="${esc(s.task.personId||"")}"></button>` : `<span class="dot" style="border-color:var(--gold)"></span>`}
          <div class="grow"><div class="kind">${esc(s.kind)}</div><div class="title">${s.task ? `<button class="tasktitle" data-edit-task="${esc(s.task.id)}" data-pid="${esc(s.task.personId||"")}">${taskTitle(s.task)}</button>` : esc(s.title)}</div>${s.person ? `<div class="small">${nameLink(s.person)}</div>`:""}</div>
        </div>`).join("")}</div>` : `<div class="empty">Nothing pressing today. Pray for your Focus 5 and enjoy the people God put around you.</div>`}</div>
    </section>`}
    ${viewWeek()}
    ${(pt => pt.plan && !pt.list.length ? "" : `<section>
      <div class="section-head"><h2>Pray today</h2><button class="linkbtn" data-tab-go="prayer">Prayer list</button></div>
      ${pt.list.length ? `<div class="pray-list">${pt.list.map(p => prayRow(p)).join("")}</div>` : `<div class="card empty">Star up to 5 people to pray for them here each day.</div>`}
      ${pt.plan ? `<p class="small muted" style="margin:8px 0 0">From your prayer rotation for this week.</p>` : ""}
    </section>`)(prayToday())}
    <section>
      <div class="section-head"><h2>This week</h2><span class="small muted">Faithfulness, not results</span></div>
      <div class="tally"><div><b>${prayedN}</b><span>prayers</span></div><div><b>${convN}</b><span>conversations</span></div><div><b>${mealN}</b><span>meals &amp; service</span></div><div><b>${invN}</b><span>invites</span></div></div>
    </section>
    ${twEntry()}
    ${storageNote()}
  </div>`;
}
/* ---------- Tend the Week: the planner ---------- */
const TW_SEQ = ["pause","back","focus","beyond","week","prayer","done"];
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// S.tw is the open planner: { weekOf, screen, focusIdx, pauseReady }. The plan itself lives in meta.weekPlans.
const twPlan = () => S.tw ? weekPlan(S.tw.weekOf, true) : null;
const twFocus = () => realPeople().filter(p => p.focus);
const twWeekLabel = weekOf => weekOf === mondayOf(tzNow().date) ? "this week" : "the week of " + fmtDate(weekOf);
function twOpen(){
  const weekOf = planWeekOf(); const p = weekPlan(weekOf, true);
  const r = !p.completedAt && p.resumeAt && TW_SEQ.includes(p.resumeAt.screen) && p.resumeAt.screen !== "done" ? p.resumeAt : null;
  S.tw = { weekOf, screen:"pause", focusIdx:0, pauseReady:false };
  closeSheet();
  if (p.completedAt) return twGo("week"); // a finished plan opens for editing; Finish again saves the changes
  twGo(r ? r.screen : "pause", r ? Math.min(r.focusIdx || 0, Math.max(0, twFocus().length - 1)) : 0);
}
function twGo(screen, focusIdx = 0){
  const tw = S.tw; tw.screen = screen; tw.focusIdx = focusIdx;
  const p = twPlan(); if (screen !== "done"){ p.resumeAt = { screen, focusIdx }; saveWeekPlanSoon(p); }
  render(); window.scrollTo(0, 0);
  if (screen === "pause" && !tw.pauseReady) setTimeout(() => { if (S.tw !== tw) return; tw.pauseReady = true; if (tw.screen === "pause") render(); }, reduceMotion() ? 0 : 2500);
}
function twClose(){
  const p = twPlan(); const done = S.tw.screen === "done";
  if (p) saveWeekPlan(p);
  S.tw = null; render(); window.scrollTo(0, 0);
  if (done) return;
  toast(p && p.completedAt ? "Closed. Any changes apply when you tap Finish planning." : "Saved. Pick up where you left off from Today.");
}
function twNext(){
  const tw = S.tw;
  if (tw.screen === "focus" && tw.focusIdx < twFocus().length - 1) return twGo("focus", tw.focusIdx + 1);
  if (tw.screen === "prayer") return twFinish();
  const i = TW_SEQ.indexOf(tw.screen); if (i < TW_SEQ.length - 1) twGo(TW_SEQ[i + 1]);
}
function twBack(){
  const tw = S.tw;
  if (tw.screen === "focus" && tw.focusIdx > 0) return twGo("focus", tw.focusIdx - 1);
  const i = TW_SEQ.indexOf(tw.screen);
  if (i <= 0) return twClose();
  const prev = TW_SEQ[i - 1];
  twGo(prev, prev === "focus" ? Math.max(0, twFocus().length - 1) : 0);
}
// Today: the glowing card shows in the planning window (or whenever a draft is waiting).
function twTodayCard(){
  if (S.examples) return "";
  const p = weekPlan(planWeekOf()); const draft = p && !p.completedAt;
  if (!draft && !(inPlanWindow() && !(p && p.completedAt))) return "";
  return `<button class="tw-card" data-act="tw-start">
      <span class="kick">Tend the Week</span>
      <span class="ttl">${draft ? "Pick up where you left off" : "Your week is ready to plan"}</span>
      <span class="sub">Your Focus 5, next steps, and who else is on your heart. About 6 minutes.</span>
      <span class="go">${draft ? "Continue" : "Start"} →</span></button>`;
}
// Today: always-available entry (where Weekly review used to be).
function twEntry(){
  if (S.examples) return "";
  const w = planWeekOf(); const p = weekPlan(w);
  const label = p && p.completedAt ? "Edit this week's plan" : p ? "Continue planning" : "Plan the week";
  return `<section class="card stack">
      <div><h3>Tend the Week</h3><p class="small muted" style="margin:4px 0 0">Your Focus 5, next steps, and a prayer rotation for ${esc(twWeekLabel(w))}. About 6 minutes.</p></div>
      <div><button class="btn small" data-act="tw-start">${label}</button></div>
    </section>`;
}
function viewPlanner(){
  const tw = S.tw; const cur = TW_SEQ.indexOf(tw.screen); const nF = twFocus().length;
  const frac = k => k === "focus" && nF ? (tw.focusIdx + 1) / nF : 1;
  const segs = TW_SEQ.map((k, i) => `<span class="tw-seg"><i style="width:${i < cur ? 100 : i > cur ? 0 : Math.round(frac(k) * 100)}%"></i></span>`).join("");
  let next = "Continue", dis = false;
  if (tw.screen === "pause"){ next = "I'm ready"; dis = !tw.pauseReady; }
  if (tw.screen === "back") next = "Start with my Focus 5";
  if (tw.screen === "focus") next = tw.focusIdx < nF - 1 ? "Next: " + first(twFocus()[tw.focusIdx + 1].name) : "Beyond the Five";
  if (tw.screen === "beyond") next = "Shape the week";
  if (tw.screen === "week") next = "Prayer rotation";
  if (tw.screen === "prayer") next = "Finish planning";
  return `<div class="tw">
    <div class="tw-top"><div class="tw-prog" role="progressbar" aria-label="Planning, step ${cur + 1} of ${TW_SEQ.length}" aria-valuemin="1" aria-valuemax="${TW_SEQ.length}" aria-valuenow="${cur + 1}">${segs}</div>
      <button class="tw-close" data-act="tw-close" aria-label="Close. Your place is saved.">×</button></div>
    <div class="tw-body">${(TW_SCREENS[tw.screen] || twSoon)()}</div>
    ${tw.screen === "done" ? "" : `<div class="tw-foot"><div class="tw-foot-in"><button class="btn ghost" data-act="tw-back">Back</button><button class="btn next" data-act="tw-next" ${dis ? "disabled" : ""}>${esc(next)}</button></div></div>`}
  </div>`;
}
// Screens still being built show a short placeholder so the walk-through can be tried end to end.
function twSoon(){
  const names = { back:"Look back", focus:"Focus 5", beyond:"Beyond the Five", week:"Shape the week", prayer:"Prayer rotation", done:"Your week is planned" };
  return `<div class="stack"><div><div class="eyebrow">Tend the Week</div><h2>${esc(names[S.tw.screen] || "")}</h2></div>
    <div class="card empty">This step is still being built. It's coming in the next update.</div>
    ${S.tw.screen === "done" ? `<div><button class="btn" data-act="tw-close">Back to Today</button></div>` : ""}</div>`;
}
/* Planner building blocks */
const TW_TYPES = {
  text:   { label:"Text",               def:0, title: f => `Text ${f}` },
  meetup: { label:"Meetup",             def:5, title: f => `Coffee with ${f}` },
  invite: { label:"Invite",             def:2, title: f => `Invite ${f} to…` },
  verse:  { label:"Send a verse",       def:3, title: f => `Send ${f} a verse` },
  drop:   { label:"Drop something off", def:4, title: f => `Drop something off for ${f}` },
  pray:   { label:"Pray",               def:1, title: f => `Pray for ${f}` },
  custom: { label:"Your own",           def:2, title: () => "" }
};
const twToday = () => tzNow().date;
const twDays = () => weekDates(S.tw.weekOf);
// Days still ahead in the plan week (planning midweek, earlier days can't be picked)
function twOpenDays(){ const t = twToday(); const d = twDays().filter(x => x >= t); return d.length ? d : twDays(); }
const wkShort = d => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday:"short" });
const wkLong = d => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday:"long" });
const dayOpt = d => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
const twP = id => { const p = S.people.get(id); return p && !p.example ? p : null; };
const twSave = () => saveWeekPlanSoon(twPlan());
const twAvatar = (p, sm) => `<div class="avatar tw-av${sm ? " sm" : ""}" style="--pc:${personColor(p.id)}">${esc(initials(p.name))}</div>`;
const twDayOptions = (sel, open = twOpenDays()) => twDays().map(d => `<option value="${d}" ${d === sel ? "selected" : ""} ${open.includes(d) ? "" : "disabled"}>${esc(dayOpt(d))}</option>`).join("");
// Find any task (on a person or standalone) by id
function twFindTask(id){
  for (const q of realPeople()){ const t = (q.tasks || []).find(x => x.id === id); if (t) return { t, owner:q }; }
  const t = (S.meta.tasks || []).find(x => x.id === id); return t ? { t, owner:null } : null;
}

/* Look back: last week at a glance, and what to do with anything unfinished */
function twUnfinished(){
  const cutoff = [S.tw.weekOf, twToday()].sort()[1]; const out = [];
  realPeople().forEach(q => (q.tasks || []).forEach(t => { if (!t.done && t.due && t.due < cutoff) out.push({ t, owner:q }); }));
  (S.meta.tasks || []).forEach(t => { if (!t.done && t.due && t.due < cutoff) out.push({ t, owner:null }); });
  return out.sort((a, b) => b.t.due.localeCompare(a.t.due)).slice(0, 8);
}
function twLookBack(){
  const p = twPlan(); const from = addDays(S.tw.weekOf, -7), to = addDays(S.tw.weekOf, -1);
  const inWk = d => d && d >= from && d <= to; const ppl = realPeople();
  let conv = 0, due = 0, done = 0; const answered = [];
  ppl.forEach(q => {
    conv += (q.logs || []).filter(l => inWk(l.at)).length;
    (q.prayers || []).filter(r => inWk(r.answeredAt)).forEach(r => answered.push({ q, r }));
  });
  [...ppl.flatMap(q => q.tasks || []), ...(S.meta.tasks || [])].filter(t => inWk(t.due)).forEach(t => { due++; if (t.done && !t.letGo) done++; });
  const open = twOpenDays(); const unfinished = twUnfinished();
  const carryOf = id => p.carry.find(c => c.taskId === id);
  const row = ({ t, owner }) => { const c = carryOf(t.id); const ch = c ? c.choice : null;
    return `<div class="card tw-carry${ch === "letgo" ? " letgo" : ""}">
      <div class="row">${owner ? twAvatar(owner, true) : ""}<div class="grow"><div class="tw-carry-title">${taskTitle(t)}</div><div class="meta">${owner ? esc(first(owner.name)) + " · " : ""}was due ${esc(fmtDay(t.due))}</div></div></div>
      <div class="row wrap tw-opts">${[["carry","Carry forward"],["resched","Reschedule"],["letgo","Let go"]].map(([k, l]) =>
        `<button class="pill-btn${ch === k ? " on" : ""}" aria-pressed="${ch === k}" data-act="tw-carry" data-tw-task="${esc(t.id)}" data-tw-pid="${esc(owner ? owner.id : "")}" data-tw-k="${k}">${l}</button>`).join("")}</div>
      ${ch === "carry" ? `<span class="small muted">Added to ${esc(wkLong(open[0]))}.</span>` : ""}
      ${ch === "resched" ? `<label class="row small muted" style="gap:8px">Move to <select class="t tw-sel" data-tw-carryday="${esc(t.id)}">${twDayOptions(c.day)}</select></label>` : ""}
      ${ch === "letgo" ? `<span class="small muted">Letting it go. It won't remind you again.</span>` : ""}
    </div>`; };
  return `<div class="stack-lg">
    <div><div class="eyebrow">Last week · ${esc(fmtDate(from))}–${esc(fmtDate(to))}</div><h2>Look back</h2></div>
    <div class="tw-stats">
      <div><b>${conv}</b><span>conversation${conv === 1 ? "" : "s"} logged</span></div>
      <div><b>${done}/${due}</b><span>next steps done</span></div>
      <div><b>${answered.length}</b><span>prayer${answered.length === 1 ? "" : "s"} answered</span></div>
    </div>
    ${answered.length ? `<div class="stack">${answered.map(({ q, r }) => `<div class="tw-answered"><b>Answered: ${esc(first(q.name))}, ${esc(r.text)}</b><p>${r.at ? `You started praying ${esc(fmtDate(r.at))}. ` : ""}Marked answered ${esc(fmtDate(r.answeredAt))}.</p></div>`).join("")}</div>` : ""}
    ${unfinished.length ? `<div class="stack">
      <div><h3>Unfinished from last week</h3><p class="small muted" style="margin:4px 0 0">Decide what comes with you. Letting go is fine.</p></div>
      ${unfinished.map(row).join("")}</div>` : ""}
  </div>`;
}

/* Steps: one planned next step for one person on one day */
const TW_CHIPS = ["text","meetup","invite","verse","drop","pray"];
const TW_RHYTHMS = {
  text:   [["Text twice this week","Mon · Thu",[0,3]], ["Text three times","Mon · Wed · Fri",[0,2,4]]],
  pray:   [["Pray daily","Every day",[0,1,2,3,4,5,6]], ["Every other day","Mon · Wed · Fri · Sun",[0,2,4,6]], ["Twice this week","Tue · Fri",[1,4]]],
  meetup: [["Two meetups","Tue · Sat",[1,5]]],
  _:      [["Twice this week","Tue · Fri",[1,4]]]
};
const TW_REM = { prep:"Night before", dayof:"Day of", followup:"Follow-up", custom:"Reminder" };
const twStepsFor = pid => twPlan().steps.filter(s => s.personId === pid);
// First one of a type goes on its usual day; each repeat lands 3 days later, or on the first day that type isn't used.
function twDefaultDay(pid, type){
  const days = twDays(), open = twOpenDays();
  const same = twStepsFor(pid).filter(s => s.type === type).map(s => s.day).sort();
  if (!same.length){ const d = days[TW_TYPES[type].def]; return open.includes(d) ? d : open[0]; }
  const n = addDays(same[same.length - 1], 3);
  if (n <= days[6] && open.includes(n)) return n;
  return open.find(d => !same.includes(d)) || same[same.length - 1];
}
function twAddStep(pid, type, o = {}){
  const person = twP(pid); const p = twPlan();
  const s = { id: uid("s"), personId: pid, type, title: o.title ?? TW_TYPES[type].title(first(person ? person.name : "")),
    day: o.day || twDefaultDay(pid, type), time: o.time ?? (type === "meetup" ? "09:00" : ""), location: "", removedReminders: [] };
  p.steps.push(s); p.justPray = p.justPray.filter(x => x !== pid); twSave(); return s;
}
function twRemoveStep(id){ const p = twPlan(); p.steps = p.steps.filter(s => s.id !== id); twSave(); }
const twStepRems = s => s.type === "meetup" && s.day && s.time ? defaultReminders(s.day, s.time) : [];
// A date (birthday etc.) that falls inside the plan week, including yearly ones
function twDatesInWeek(person){
  const days = twDays(), out = [];
  (person.dates || []).forEach(d => {
    if (!d.date) return;
    const cands = d.yearly ? [...new Set([days[0].slice(0, 4), days[6].slice(0, 4)])].map(y => y + d.date.slice(4)) : [d.date];
    cands.filter(c => c >= days[0] && c <= days[6]).forEach(c => out.push({ id: d.id, label: d.label, date: c }));
  });
  return out;
}
const twLastLog = person => [...(person.logs || [])].sort((a, b) => b.at.localeCompare(a.at))[0] || null;
const lcFirst = s => String(s || "").replace(/^./, c => c.toLowerCase());
// Up to 3 gentle suggestions from what you know about them
function twSuggestions(person){
  const p = twPlan(), f = first(person.name), days = twDays(), open = twOpenDays(), out = [];
  const add = (key, type, title, day) => { const k = person.id + "|" + key; if (!p.dismissedSuggestions.includes(k) && !out.some(x => x.key === k)) out.push({ key:k, type, title, day: open.includes(day) ? day : open[0] }); };
  twDatesInWeek(person).forEach(d => { const bday = /birthday/i.test(d.label);
    add("date-text-" + d.id + d.date, "text", bday ? "Happy birthday text" : `Text ${f} about ${lcFirst(d.label)}`, d.date);
    add("date-drop-" + d.id + d.date, "drop", bday ? "Drop off a birthday card" : `Drop off a card for ${lcFirst(d.label)}`, d.date); });
  (person.prayers || []).filter(r => !r.answeredAt).forEach(r => add("prayer-" + r.id, "text", `Ask how ${lcFirst(r.text)} is going`, days[0]));
  const since = sinceContact(person); if (since !== null && since > 14) add("checkin", "text", `Check in with ${f}`, days[0]);
  const lastMeet = (person.tasks || []).filter(t => isMeetup(t) && t.due).map(t => t.due).sort().pop();
  const planned = twStepsFor(person.id).some(s => s.type === "meetup");
  if (!planned && (!lastMeet || daysBetween(lastMeet, today()) > 30)) add("coffee", "meetup", `Coffee with ${f}`, days[5]);
  return out.slice(0, 3);
}
function twRow(s){
  const meet = s.type === "meetup"; const rems = twStepRems(s); const off = s.removedReminders || [];
  return `<div class="tw-row" data-tw-row="${esc(s.id)}">
    <div class="row"><span class="tw-tag ${s.type}">${esc(TW_TYPES[s.type].label)}</span>
      <input class="tw-title" id="tw-t-${esc(s.id)}" data-tw-sid="${esc(s.id)}" data-tw-f="title" value="${esc(s.title)}" placeholder="What's the step?" aria-label="Step">
      <button class="iconbtn-sm" data-act="tw-del" data-tw-sid="${esc(s.id)}" aria-label="Remove step">×</button></div>
    <div class="row wrap tw-fields">
      <select class="t tw-sel" aria-label="Day" data-tw-sid="${esc(s.id)}" data-tw-f="day">${twDayOptions(s.day)}</select>
      ${s.type === "pray" ? "" : `<label>${meet ? "Starts" : "Remind at"} <input class="t tw-time" type="time" data-tw-sid="${esc(s.id)}" data-tw-f="time" value="${esc(s.time || "")}"></label>`}
      ${meet ? `<label class="tw-where">Where <input class="t" data-tw-sid="${esc(s.id)}" data-tw-f="location" value="${esc(s.location || "")}" placeholder="Optional"></label>` : ""}
    </div>
    ${meet && rems.length ? `<div class="tw-rems">${rems.map(r => { const isOff = off.includes(r.type);
      return `<span class="tw-rem${isOff ? " off" : ""}">${esc(TW_REM[r.type] || "Reminder")} · ${esc(fmtRem(r))}<button data-act="tw-rem" data-tw-sid="${esc(s.id)}" data-tw-k="${r.type}" aria-label="${isOff ? "Restore" : "Remove"} reminder">${isOff ? "↺" : "×"}</button></span>`; }).join("")}</div>` : ""}
    ${meet && !s.time ? `<span class="hint">Pick a start time and Tend will set its reminders.</span>` : ""}
  </div>`;
}
function twChips(pid, types, act){
  return types.map(t => { const n = twStepsFor(pid).filter(s => s.type === t).length;
    return `<button class="chip tw-chip${n ? " on" : ""}" data-act="${act}" data-tw-pid="${esc(pid)}" data-tw-type="${t}">${esc(TW_TYPES[t].label)}${n ? `<span class="tw-badge">×${n}</span>` : ""}</button>`; }).join("");
}

/* Focus 5: one card per focus person */
function twFocusScreen(){
  const list = twFocus();
  if (!list.length) return `<div class="stack-lg"><div><div class="eyebrow">Focus 5</div><h2>Choose up to 5 people to focus on</h2>
      <p class="muted" style="margin:6px 0 0">Your Focus 5 are the people you pray for each day and plan next steps with. Open someone in People and tap ☆ Focus 5.</p></div>
      <div><button class="btn small" data-act="tw-to-people">Go to People</button></div></div>`;
  const i = Math.min(S.tw.focusIdx, list.length - 1); const person = list[i]; const p = twPlan(); const f = first(person.name);
  const steps = twStepsFor(person.id); const last = twLastLog(person);
  const ago = last ? daysBetween(last.at, today()) : null; const late = ago !== null && ago > 14;
  const noted = [...(person.logs || [])].sort((a, b) => b.at.localeCompare(a.at)).find(l => l.shared || l.cares || l.questions);
  const snippet = noted && (noted.shared || noted.cares || noted.questions);
  const prayers = (person.prayers || []).filter(r => !r.answeredAt);
  const dates = twDatesInWeek(person);
  const sugg = twSuggestions(person);
  const metaLine = [isFam(person) ? "Church family · " + DEPTHS[depthOf(person)] : STAGES[person.stage || 0], person.relationship || person.howMet].filter(Boolean).join(" · ");
  const justPray = p.justPray.includes(person.id) && !steps.length;
  return `<div class="stack-lg">
    <div class="row tw-ptop">${twAvatar(person)}<div class="grow"><div class="eyebrow">Focus 5</div><h2>${esc(person.name)}</h2><div class="meta">${esc(metaLine)}</div></div><span class="tw-count">${i + 1} of ${list.length}</span></div>
    <div class="card tw-ctx">
      <div class="tw-ctx-row"><span class="lbl">Last talked</span><span class="${late ? "danger" : ""}">${last ? `${ago <= 0 ? "Today" : ago === 1 ? "Yesterday" : ago + " days ago"} · ${esc(last.type)}${late ? " · time to check in" : ""}` : "No conversations logged yet"}</span></div>
      ${snippet ? `<p class="tw-snip">“${esc(snippet)}”</p>` : ""}
      ${prayers.length ? `<div class="tw-ctx-row"><span class="lbl">Praying for</span><span>${esc(prayers.map(r => r.text).join(", "))}</span></div>` : ""}
      ${dates.length ? `<div class="tw-ctx-row"><span class="lbl">This week</span><span class="danger">${esc(dates.map(d => d.label + " · " + wkLong(d.date)).join(", "))}</span></div>` : ""}
    </div>
    ${justPray ? `<div class="tw-prayonly"><div><b>Just praying for ${esc(f)} this week.</b><div class="small muted">No tasks. ${esc(f)} goes into your prayer rotation.</div></div><button class="pill-btn" data-act="tw-unpray" data-tw-pid="${esc(person.id)}">Undo</button></div>` : ""}
    <div class="stack">
      <div><h3 class="tw-q">What would you like to do with ${esc(f)} this week?</h3>
        <p class="small muted" style="margin:4px 0 0">All optional. Tap as many as you like, tap again to add another. Press and hold a chip for a rhythm.</p></div>
      <div class="chips wrap tw-chips">${twChips(person.id, TW_CHIPS, "tw-chip")}<button class="chip tw-chip rhythm" data-act="tw-rhythms" data-tw-pid="${esc(person.id)}">Rhythms…</button></div>
      ${sugg.length ? `<div class="stack tw-rows">${sugg.map(g => `<div class="tw-sugg"><span class="tw-tag">Suggested</span><span class="grow">${esc(g.title)} · ${esc(wkShort(g.day))}</span>
        <button class="pill-btn" data-act="tw-keep" data-tw-pid="${esc(person.id)}" data-tw-key="${esc(g.key)}">Add</button><button class="iconbtn-sm" data-act="tw-dismiss" data-tw-key="${esc(g.key)}" aria-label="Dismiss suggestion">×</button></div>`).join("")}</div>` : ""}
      ${steps.length ? `<div class="stack tw-rows">${steps.map(twRow).join("")}</div>` : ""}
      <button class="tw-addown" data-act="tw-addown" data-tw-pid="${esc(person.id)}">+ Add your own</button>
      ${steps.length >= 4 ? `<div class="banner info">That's a full week with ${esc(f)}. Good problem to have.</div>` : ""}
    </div>
    <div class="row spread wrap"><button class="linkbtn muted" data-act="tw-justpray" data-tw-pid="${esc(person.id)}">Nothing this week, just pray</button><button class="linkbtn muted" data-act="tw-swap" data-tw-pid="${esc(person.id)}">Swap out of Focus 5</button></div>
  </div>`;
}
function twRhythmSheet(pid, type){
  const f = first(twP(pid)?.name || ""); const types = type ? [type] : ["text","pray","meetup"];
  openSheet(`<div class="stack"><h2>Rhythms for ${esc(f)}</h2>
    <p class="small muted" style="margin:0">Fills in the steps for you. Replaces any ${type ? esc(TW_TYPES[type].label) + " " : ""}steps already set for ${esc(f)}.</p>
    ${types.map(t => (TW_RHYTHMS[t] || TW_RHYTHMS._).map(([l, dl, ds]) => `<button class="tw-sopt" data-act="tw-rhythm" data-tw-pid="${esc(pid)}" data-tw-type="${t}" data-tw-days="${ds.join(",")}"><span>${esc(type ? l : TW_TYPES[t].label + ": " + l)}</span><span class="muted">${esc(dl)}</span></button>`).join("")).join("")}
    <button class="btn ghost" data-act="close-sheet">Cancel</button></div>`);
}
function twSwapSheet(pid){
  const others = realPeople().filter(q => !q.focus).sort((a, b) => a.name.localeCompare(b.name));
  openSheet(`<div class="stack"><h2>Who takes ${esc(first(twP(pid)?.name || ""))}'s spot?</h2>
    ${others.length ? others.map(q => `<button class="tw-sopt" data-act="tw-swap-to" data-tw-pid="${esc(q.id)}" data-tw-from="${esc(pid)}"><span class="row" style="gap:10px">${twAvatar(q, true)}${esc(q.name)}</span><span class="muted">${esc(isFam(q) ? "Church family" : STAGE_SHORT[q.stage || 0])}</span></button>`).join("") : `<p class="muted">Everyone on your list is already in your Focus 5.</p>`}
    <button class="btn ghost" data-act="close-sheet">Cancel</button></div>`);
}

/* Beyond the Five: up to 5 other people the app noticed, as a swipeable deck */
function twBeyondList(){
  const p = twPlan(), days = twDays(), t = today(), out = [];
  const fresh = new Set(p.newPeople || []);
  const cands = realPeople().filter(q => !q.focus && !fresh.has(q.id));
  const reasons = q => {
    const logs = (q.logs || []).length; const since = sinceContact(q);
    const d = twDatesInWeek(q)[0]; if (d) return [1, `${d.label} ${wkLong(d.date)}`];
    if (!logs && q.metOn && daysBetween(q.metOn, t) <= 30) return [2, `Met ${agoText(q.metOn)}, no follow-up yet`];
    if (isFam(q) && !logs) return [3, "You haven't really met yet"];
    if (since !== null && since >= 30) return [4, `${since} days since you talked`];
    if ((q.prayers || []).some(r => !r.answeredAt)) return [5, "Open prayer request"];
    return null;
  };
  cands.forEach(q => { const r = reasons(q); if (r) out.push({ person:q, rank:r[0], why:r[1] }); });
  return out.sort((a, b) => a.rank - b.rank).slice(0, 5);
}
function twDeckCard(c, cls){
  const q = c.person; const last = twLastLog(q);
  const detail = q.note || (last && last.shared) || [q.howMet, q.relationship].filter(Boolean).join(" · ");
  const lastLine = lastContactLabel(q) || (isFam(q) || !q.metOn ? "Never talked" : "Met " + fmtDate(q.metOn));
  return `<div class="tw-deck-card ${cls}${isFam(q) ? " fam" : ""}"${cls === "front" ? ` id="tw-topcard"` : ""}>
    <span class="tw-stamp yes">Add</span><span class="tw-stamp no">Skip</span>
    <div class="row">${twAvatar(q)}<div class="grow"><b class="tw-deck-name">${esc(q.name)}</b><div><span class="tw-ctag">${isFam(q) ? ICON_HOME + "Church family" : "Reaching"}</span></div></div></div>
    <div class="tw-why">${esc(c.why)}</div>
    ${detail ? `<p>${esc(detail)}</p>` : ""}
    <p class="tw-last">${esc(lastLine)}</p>
  </div>`;
}
function twBeyondScreen(){
  const p = twPlan(); const list = twBeyondList(); const idx = S.tw.beyondIdx || 0;
  const touched = list.filter(c => twStepsFor(c.person.id).length).map(c => first(c.person.name));
  let deck;
  if (!list.length) deck = `<div class="card empty">No one else stands out this week. Add someone below if God brings them to mind.</div>`;
  else if (idx < list.length) deck = `<div class="tw-deck">${list[idx + 1] ? twDeckCard(list[idx + 1], "under") : ""}${twDeckCard(list[idx], "front")}</div>
      <div class="row tw-deck-btns"><button class="btn ghost" data-act="tw-skip">Not this week</button><button class="btn" data-act="tw-touch" data-tw-pid="${esc(list[idx].person.id)}">Add a touch</button></div>
      <p class="small muted" style="text-align:center;margin:0">Swipe right to add a touch, left to skip · ${idx + 1} of ${list.length}</p>`;
  else deck = `<div class="card stack"><b>That's everyone the app surfaced.</b><span class="small muted">${touched.length ? `You added touches for ${esc(touched.join(", "))}.` : "You skipped them all this week. That's okay."}</span>
      <div><button class="linkbtn" data-act="tw-redeck">Go through them again</button></div></div>`;
  const added = (p.newPeople || []).map(twP).filter(Boolean);
  return `<div class="stack-lg">
    <div><div class="eyebrow">Beyond the Five</div><h2>Who else is on your heart?</h2><p class="muted" style="margin:6px 0 0">A few people the app noticed. Light touches only.</p></div>
    <div class="stack">${deck}</div>
    <div class="stack">
      <div><h3>Did God bring anyone new to mind?</h3><p class="small muted" style="margin:4px 0 0">Add them and they'll go on your prayer list this week.</p></div>
      <form class="row tw-newp" data-form="tw-newp" autocomplete="off"><input class="t" id="tw-newname" placeholder="Their name" aria-label="Their name"><button class="btn">Add</button></form>
      ${added.length ? `<div class="row wrap" style="gap:8px">${added.map(q => { const s = twStepsFor(q.id).find(x => x.type === "pray");
        return `<span class="tw-pchip">${twAvatar(q, true)}${esc(q.name)}${s ? " · Pray " + esc(wkShort(s.day)) : ""}</span>`; }).join("")}</div>` : ""}
    </div>
  </div>`;
}
function twTouchSheet(pid){
  const q = twP(pid); if (!q) return;
  openSheet(`<div class="stack"><h2>A light touch for ${esc(first(q.name))}</h2><p class="small muted" style="margin:0">Tap as many as you like.</p>
    <div class="chips wrap tw-chips">${twChips(pid, ["text","pray","meetup","verse","invite"], "tw-touch-chip")}</div>
    ${twStepsFor(pid).length ? `<p class="small muted" style="margin:0">${esc(twStepsFor(pid).map(s => TW_TYPES[s.type].label + " " + wkShort(s.day)).join(" · "))}. Fine-tune days in Shape the week.</p>` : ""}
    <button class="btn" data-act="tw-touch-done">Done</button></div>`);
}
function twDeckAdvance(dir){
  const c = $("#tw-topcard");
  const nextCard = () => { S.tw.beyondIdx = (S.tw.beyondIdx || 0) + 1; twGo("beyond"); };
  if (c && !reduceMotion()){ c.style.transition = "transform .18s"; c.style.transform = `translateX(${dir * 140}%) rotate(${dir * 12}deg)`; setTimeout(nextCard, 170); }
  else nextCard();
}
function twBindDeck(){
  const c = $("#tw-topcard"); if (!c) return;
  const yes = c.querySelector(".tw-stamp.yes"), no = c.querySelector(".tw-stamp.no");
  let sx = null, dx = 0;
  c.addEventListener("pointerdown", e => { sx = e.clientX; dx = 0; try { c.setPointerCapture(e.pointerId); } catch(_){} c.style.transition = "none"; });
  c.addEventListener("pointermove", e => { if (sx === null) return; dx = e.clientX - sx; c.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`; yes.style.opacity = Math.max(0, dx / 90); no.style.opacity = Math.max(0, -dx / 90); });
  const end = () => { if (sx === null) return; sx = null; c.style.transition = "";
    if (dx > 90){ c.style.transform = ""; yes.style.opacity = 0; twTouchSheet(twBeyondList()[S.tw.beyondIdx || 0]?.person.id); }
    else if (dx < -90) twDeckAdvance(-1);
    else { c.style.transform = ""; yes.style.opacity = 0; no.style.opacity = 0; } };
  c.addEventListener("pointerup", end); c.addEventListener("pointercancel", end);
}
function twAddNewPerson(name){
  const p = twPlan(); const q = newPerson(name); savePerson(q);
  (p.newPeople ||= []).push(q.id);
  const day = twOpenDays()[0]; twAddStep(q.id, "pray", { day });
  render(); toast(`${name} added to ${wkLong(day)}'s prayers`);
}

/* Shape the week: everything planned, day by day */
const TW_CAP = { light:3, normal:5, full:8 };
// Steps plus anything carried over from last week, each with the day it lands on
function twWeekItems(){
  const p = twPlan(); const open = twOpenDays(); const items = [];
  p.steps.forEach(s => { const q = twP(s.personId); if (q) items.push({ key:s.id, day:s.day, person:q, title: s.title || TW_TYPES[s.type].label, kind: TW_TYPES[s.type].label, time:s.time }); });
  p.carry.forEach(c => { if (c.choice === "letgo") return; const ref = twFindTask(c.taskId); if (!ref || ref.t.done) return;
    items.push({ key:"c:" + c.taskId, day: c.choice === "carry" ? open[0] : c.day, person: ref.owner, title: ref.t.title, kind:"Carried over", time: ref.t.time || ref.t.remindAt }); });
  return items.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
}
function twWeekScreen(){
  const p = twPlan(); const days = twDays(); const open = twOpenDays(); const lim = TW_CAP[p.capacity] || 5;
  const items = twWeekItems(); const byDay = Object.fromEntries(days.map(d => [d, items.filter(i => i.day === d)]));
  const nPeople = new Set(items.map(i => i.person ? i.person.id : "-")).size;
  const heavy = days.filter(d => byDay[d].length > lim);
  const dot = i => `<i style="--pc:${i.person ? personColor(i.person.id) : "var(--ink-3)"}"></i>`;
  return `<div class="stack-lg">
    <div><div class="eyebrow">${esc(fmtDate(days[0]))}–${esc(fmtDate(days[6]))}</div><h2>Shape the week</h2>
      <p class="muted" style="margin:6px 0 0">Tending ${nPeople} ${nPeople === 1 ? "person" : "people"} with ${items.length} next step${items.length === 1 ? "" : "s"}. Tap a step to move it.</p></div>
    <div class="stack" style="gap:6px"><span class="small muted">How much room do you have this week?</span>
      <div class="circles tw-cap" role="radiogroup" aria-label="How much room this week">${["light","normal","full"].map(k => `<button role="radio" aria-checked="${p.capacity === k}" data-act="tw-cap" data-tw-k="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div></div>
    <div class="tw-strip">${days.map(d => `<div class="tw-day${byDay[d].length > lim ? " heavy" : ""}${open.includes(d) ? "" : " past"}"><small>${esc(wkShort(d))}</small><b>${byDay[d].length}</b><span class="dots">${byDay[d].slice(0, 8).map(dot).join("")}</span></div>`).join("")}</div>
    ${heavy.map(d => `<div class="banner info">${esc(wkLong(d))} looks heavy (${byDay[d].length} steps). Move something?</div>`).join("")}
    ${!items.length ? `<p class="muted" style="margin:0">No next steps yet. Go back to your Focus 5 to add some.</p>` : ""}
    <div class="stack">${days.map(d => `<div class="tw-dgroup"><div class="wk-day">${esc(wkLong(d))} <span>${esc(fmtDate(d))}</span></div>
      ${byDay[d].length ? byDay[d].map(i => `<button class="tw-item" data-act="tw-move" data-tw-key="${esc(i.key)}"><span class="tw-dot" style="--pc:${i.person ? personColor(i.person.id) : "var(--ink-3)"}"></span>
          <span class="grow"><b>${esc(i.title)}</b><span class="meta">${esc([i.person ? first(i.person.name) : "", i.kind, i.time ? fmtTime(i.time) : ""].filter(Boolean).join(" · "))}</span></span></button>
        ${S.tw.moveOpen === i.key ? `<div class="row wrap tw-movebox">Move to <select class="t tw-sel" data-tw-moveday="${esc(i.key)}">${twDayOptions(i.day)}</select><button class="linkbtn danger" data-act="tw-move-del" data-tw-key="${esc(i.key)}">Remove</button></div>` : ""}`).join("")
        : `<p class="small muted" style="margin:2px 0 6px">${open.includes(d) ? "Open" : "Past"}</p>`}</div>`).join("")}</div>
  </div>`;
}
// Move or remove a step (or a carried-over task) from Shape the week
function twMoveItem(key, day){
  const p = twPlan();
  if (key.startsWith("c:")){ const c = p.carry.find(x => x.taskId === key.slice(2)); if (!c) return;
    if (day){ c.choice = "resched"; c.day = day; } else p.carry = p.carry.filter(x => x !== c); }
  else { const s = p.steps.find(x => x.id === key); if (!s) return; if (day) s.day = day; else p.steps = p.steps.filter(x => x !== s); }
  S.tw.moveOpen = null; twSave(); render();
}

/* Prayer rotation: who you'll pray for each day */
// Built from Pray steps (solid), Focus 5 / "just pray" people without a Pray step spread twice
// across the week 3 days apart (dashed), plus anyone added here. Returns { "YYYY-MM-DD": [{ pid, kind, ref }] }.
function twRotation(p = twPlan()){
  const days = weekDates(p.weekOf), t = twToday(), open = days.filter(d => d >= t).length ? days.filter(d => d >= t) : days, r = {};
  days.forEach(d => r[d] = []);
  const add = (d, x) => { if (r[d] && twP(x.pid) && !r[d].some(y => y.pid === x.pid)) r[d].push(x); };
  p.steps.filter(s => s.type === "pray").forEach(s => add(s.day, { pid:s.personId, kind:"step", ref:s.id }));
  const hasPray = id => p.steps.some(s => s.personId === id && s.type === "pray");
  const auto = [...twFocus().map(q => q.id), ...p.justPray].filter((id, i, a) => a.indexOf(id) === i && !hasPray(id));
  const moves = p.prayMoves || {};
  auto.forEach((pid, i) => { const k = Math.round(i * open.length / auto.length) % open.length;
    [open[k], open[(k + 3) % open.length]].forEach((d, j) => { const key = pid + "|" + j; const nd = key in moves ? moves[key] : d; if (nd) add(nd, { pid, kind:"auto", ref:key }); }); });
  (p.prayExtra || []).forEach(x => add(x.day, { pid:x.pid, kind:"extra", ref:x.id }));
  return r;
}
// Move a name to another day (day) or take it off (day = "")
function twPrayMove(kind, ref, day){
  const p = twPlan();
  if (kind === "step"){ const s = p.steps.find(x => x.id === ref); if (!s) return; if (day) s.day = day; else p.steps = p.steps.filter(x => x !== s); }
  if (kind === "auto") (p.prayMoves ||= {})[ref] = day;
  if (kind === "extra"){ const x = (p.prayExtra || []).find(y => y.id === ref); if (!x) return; if (day) x.day = day; else p.prayExtra = p.prayExtra.filter(y => y !== x); }
  twSave();
}
function twPrayerScreen(){
  const r = twRotation(); const open = twOpenDays();
  return `<div class="stack-lg">
    <div><div class="eyebrow">Prayer rotation</div><h2>Who you'll pray for each day</h2>
      <p class="muted" style="margin:6px 0 0">Solid names come from your Pray steps. Dashed names were spread out for you. Tap a name to move it, or + to add someone.</p></div>
    <div>${Object.keys(r).map(d => `<div class="tw-prow${open.includes(d) ? "" : " past"}"><div class="tw-pd">${esc(wkShort(d))}<small>${esc(fmtDate(d))}</small></div>
      <div class="tw-pnames">${r[d].map(x => { const q = twP(x.pid);
        return `<button class="tw-pname${x.kind === "auto" ? " auto" : ""}" data-act="tw-pname" data-tw-kind="${x.kind}" data-tw-ref="${esc(x.ref)}" data-tw-pid="${esc(x.pid)}" data-tw-day="${d}"><span class="tw-dot" style="--pc:${personColor(q.id)}"></span>${esc(first(q.name))}</button>`; }).join("")}
        ${open.includes(d) ? `<button class="tw-pname auto" data-act="tw-padd" data-tw-day="${d}" aria-label="Add someone to ${esc(wkLong(d))}">+</button>` : ""}</div></div>`).join("")}</div>
    <div class="banner quiet">Your daily summary's “Pray for…” line follows this list, so ${esc(wkLong(open[0]))}'s notification names only ${esc(wkLong(open[0]))}'s people.</div>
  </div>`;
}
function twPrayNameSheet(d){
  const q = twP(d.twPid); if (!q) return; const day = d.twDay; const open = twOpenDays(); const f = first(q.name);
  const dayChips = act => `<div class="chips wrap">${twDays().map(x => `<button class="chip" data-act="${act}" data-tw-kind="${d.twKind}" data-tw-ref="${esc(d.twRef)}" data-tw-pid="${esc(q.id)}" data-tw-day="${x}" ${x === day || !open.includes(x) ? "disabled" : ""}>${esc(wkShort(x))}</button>`).join("")}</div>`;
  openSheet(`<div class="stack"><h2>Pray for ${esc(f)}</h2><p class="small muted" style="margin:0">Currently on ${esc(wkLong(day))}.</p>
    <span class="f">Move to</span>${dayChips("tw-pmove")}
    <span class="f">Also pray on</span>${dayChips("tw-palso")}
    <button class="tw-sopt" data-act="tw-poff" data-tw-kind="${d.twKind}" data-tw-ref="${esc(d.twRef)}" data-tw-pid="${esc(q.id)}" data-tw-day="${day}">Take ${esc(f)} off ${esc(wkLong(day))}</button>
    <button class="btn ghost" data-act="close-sheet">Cancel</button></div>`);
}
function twPrayAddSheet(day){
  const p = twPlan(); const on = twRotation()[day].map(x => x.pid);
  const pool = [...twFocus().map(q => q.id), ...p.justPray, ...p.steps.map(s => s.personId)].filter((id, i, a) => a.indexOf(id) === i && !on.includes(id)).map(twP).filter(Boolean);
  openSheet(`<div class="stack"><h2>Add to ${esc(wkLong(day))}</h2>
    ${pool.length ? pool.map(q => `<button class="tw-sopt" data-act="tw-paddp" data-tw-pid="${esc(q.id)}" data-tw-day="${day}"><span class="row" style="gap:10px">${twAvatar(q, true)}${esc(q.name)}</span></button>`).join("") : `<p class="muted">Everyone is already on this day.</p>`}
    <button class="btn ghost" data-act="close-sheet">Cancel</button></div>`);
}

/* Finish: turn the plan into real next steps */
function twFinish(){
  const p = twPlan(); const touched = new Set(); const keep = new Set(); const t0 = today();
  p.steps.forEach(s => {
    if (s.type === "pray") return;
    const person = twP(s.personId); if (!person) return;
    const ref = s.taskId && twFindTask(s.taskId); let t = ref && ref.t;
    if (t && t.done){ keep.add(t.id); return; } // already done: leave it be
    if (!t){ t = { id: uid("t"), done:false, doneAt:null }; (person.tasks ||= []).push(t); s.taskId = t.id; }
    const before = { due: t.due, time: t.time };
    Object.assign(t, { title: (s.title || "").trim() || TW_TYPES[s.type].label, due: s.day, planWeek: p.weekOf, stepType: s.type });
    if (s.type === "meetup" && s.time){
      const off = s.removedReminders || [];
      const same = isMeetup(t) && before.due === s.day && before.time === s.time;
      Object.assign(t, { kind:"meetup", time: s.time, location: (s.location || "").trim() });
      t.bringUp ||= [];
      t.reminders = same ? (t.reminders || []).filter(r => !off.includes(r.type)) : defaultReminders(s.day, s.time).filter(r => !off.includes(r.type));
      delete t.remindAt;
    } else {
      if (isMeetup(t)){ delete t.kind; delete t.time; delete t.reminders; delete t.location; delete t.bringUp; }
      t.remindAt = s.time || null;
    }
    keep.add(t.id); touched.add(ref && ref.owner ? ref.owner.id : person.id);
  });
  // Steps removed since the last time you finished: remove the tasks they made (unless already done)
  (p.taskIds || []).filter(id => !keep.has(id)).forEach(id => { const ref = twFindTask(id); if (!ref || ref.t.done) return;
    if (ref.owner){ ref.owner.tasks = ref.owner.tasks.filter(x => x.id !== id); touched.add(ref.owner.id); } else S.meta.tasks = S.meta.tasks.filter(x => x.id !== id); });
  p.taskIds = [...keep];
  // Unfinished from last week
  const first0 = twOpenDays()[0];
  p.carry.forEach(c => { const ref = twFindTask(c.taskId); if (!ref) return; const t = ref.t;
    if (c.choice === "letgo"){ if (!t.done){ t.done = true; t.letGo = true; t.doneAt = t0; } }
    else { const nd = c.choice === "carry" ? first0 : c.day; if (nd && !t.done && t.due !== nd){
      if (isMeetup(t) && t.time && t.due) t.reminders = shiftReminders(t.reminders, { due:t.due, time:t.time }, { due:nd, time:t.time });
      t.due = nd; } }
    if (ref.owner) touched.add(ref.owner.id); });
  p.rotation = Object.fromEntries(Object.entries(twRotation(p)).map(([d, l]) => [d, l.map(x => x.pid)]));
  p.completedAt = new Date().toISOString(); delete p.resumeAt;
  S.meta.reviewAt = t0;
  touched.forEach(id => { const q = twP(id); if (q) savePerson(q); });
  saveWeekPlan(p);
  twGo("done");
}
function twDoneScreen(){
  const p = twPlan(); const steps = p.steps.filter(s => twP(s.personId));
  const people = [...new Set(steps.map(s => s.personId))].map(twP);
  const counts = {}; steps.forEach(s => counts[s.type] = (counts[s.type] || 0) + 1);
  const names = { meetup:["meetup","meetups"], text:["text","texts"], pray:["prayer day","prayer days"], invite:["invite","invites"], verse:["verse","verses"], drop:["drop-off","drop-offs"], custom:["other step","other steps"] };
  return `<div class="stack-lg" style="padding-top:8px">
    <div class="eyebrow">Your week is planned</div>
    <p class="tw-big">Tending <em>${people.length} ${people.length === 1 ? "person" : "people"}</em> with ${steps.length} next step${steps.length === 1 ? "" : "s"}.</p>
    ${steps.length ? `<div class="tw-breakdown">${Object.keys(names).filter(k => counts[k]).map(k => `<div><b>${counts[k]}</b><span>${names[k][counts[k] === 1 ? 0 : 1]}</span></div>`).join("")}</div>` : ""}
    ${people.length ? `<div class="row wrap" style="gap:8px">${people.map(q => `<span class="tw-pchip">${twAvatar(q, true)}${esc(first(q.name))} · ${steps.filter(s => s.personId === q.id).length}</span>`).join("")}</div>` : ""}
    <div class="tw-blessing"><p>“And let us not be weary in well doing: for in due season we shall reap, if we faint not.”</p><small>Galatians 6:9</small></div>
    <div><button class="btn" data-act="tw-close">Back to Today</button></div>
  </div>`;
}

// Selects and pickers inside the planner. Returns true if it handled the change.
function twChange(el){
  const d = el.dataset; const p = twPlan(); if (!p) return false;
  if (d.twCarryday){ const c = p.carry.find(x => x.taskId === d.twCarryday); if (c){ c.day = el.value; twSave(); render(); } return true; }
  if (d.twMoveday){ const day = el.value; twMoveItem(d.twMoveday, day); toast("Moved to " + wkLong(day)); return true; }
  if (d.twSid && (d.twF === "day" || d.twF === "time")){ const s = p.steps.find(x => x.id === d.twSid); if (s){ s[d.twF] = el.value; twSave(); render(); } return true; }
  return false;
}
// Typing in a step's title or place: save without redrawing (keeps the keyboard up)
function twInput(el){
  const d = el.dataset; if (!d.twSid || (d.twF !== "title" && d.twF !== "location")) return;
  const s = twPlan()?.steps.find(x => x.id === d.twSid); if (s){ s[d.twF] = el.value; twSave(); }
}
// Planner buttons. Returns true if it handled the tap.
function twClick(act, d, el){
  const p = twPlan(); if (!p) return false;
  const pid = d.twPid;
  switch (act){
    case "tw-chip": if (twLP.fired){ twLP.fired = false; return true; } twAddStep(pid, d.twType); render(); return true;
    case "tw-rhythms": twRhythmSheet(pid); return true;
    case "tw-rhythm": {
      const days = d.twDays.split(",").map(i => twDays()[+i]).filter(x => twOpenDays().includes(x));
      closeSheet();
      if (!days.length){ toast("Those days have already passed this week."); render(); return true; }
      p.steps = p.steps.filter(s => !(s.personId === pid && s.type === d.twType));
      days.forEach(day => twAddStep(pid, d.twType, { day }));
      render(); return true; }
    case "tw-del": twRemoveStep(d.twSid); render(); return true;
    case "tw-rem": { const s = p.steps.find(x => x.id === d.twSid); if (!s) return true; const off = s.removedReminders ||= [];
      s.removedReminders = off.includes(d.twK) ? off.filter(k => k !== d.twK) : [...off, d.twK]; twSave(); render(); return true; }
    case "tw-keep": { const person = twP(pid); const g = person && twSuggestions(person).find(x => x.key === d.twKey);
      if (g) twAddStep(pid, g.type, { title: g.title, day: g.day }); p.dismissedSuggestions.push(d.twKey); twSave(); render(); return true; }
    case "tw-dismiss": p.dismissedSuggestions.push(d.twKey); twSave(); render(); return true;
    case "tw-addown": { const s = twAddStep(pid, "custom"); render(); setTimeout(() => $("#tw-t-" + s.id)?.focus(), 30); return true; }
    case "tw-justpray": { const f = first(twP(pid)?.name || "");
      p.steps = p.steps.filter(s => s.personId !== pid); if (!p.justPray.includes(pid)) p.justPray.push(pid); twSave();
      toast(`Just praying for ${f} this week`); twNext(); return true; }
    case "tw-unpray": p.justPray = p.justPray.filter(x => x !== pid); twSave(); render(); return true;
    case "tw-swap": twSwapSheet(pid); return true;
    case "tw-swap-to": { const from = twP(d.twFrom), to = twP(pid); if (!from || !to) return true;
      from.focus = false; to.focus = true; savePerson(from); savePerson(to); closeSheet();
      S.tw.focusIdx = Math.max(0, twFocus().findIndex(q => q.id === to.id)); twGo("focus", S.tw.focusIdx);
      toast(`${first(to.name)} is in your Focus 5`); return true; }
    case "tw-to-people": twClose(); go("people"); return true;
    case "tw-skip": twDeckAdvance(-1); return true;
    case "tw-touch": twTouchSheet(pid); return true;
    case "tw-touch-chip": twAddStep(pid, d.twType); twTouchSheet(pid); return true;
    case "tw-touch-done": closeSheet(); twDeckAdvance(1); return true;
    case "tw-redeck": S.tw.beyondIdx = 0; twGo("beyond"); return true;
    case "tw-cap": p.capacity = d.twK; twSave(); render(); return true;
    case "tw-move": S.tw.moveOpen = S.tw.moveOpen === d.twKey ? null : d.twKey; render(); return true;
    case "tw-move-del": twMoveItem(d.twKey, null); return true;
    case "tw-pname": twPrayNameSheet(d); return true;
    case "tw-padd": twPrayAddSheet(d.twDay); return true;
    case "tw-pmove": twPrayMove(d.twKind, d.twRef, d.twDay); closeSheet(); render(); toast(`${first(twP(pid)?.name || "")} moved to ${wkLong(d.twDay)}`); return true;
    case "tw-palso": (p.prayExtra ||= []).push({ id: uid("px"), pid, day: d.twDay }); twSave(); closeSheet(); render(); toast(`${first(twP(pid)?.name || "")} added to ${wkLong(d.twDay)}`); return true;
    case "tw-poff": twPrayMove(d.twKind, d.twRef, ""); closeSheet(); render(); return true;
    case "tw-paddp": (p.prayExtra ||= []).push({ id: uid("px"), pid, day: d.twDay }); twSave(); closeSheet(); render(); return true;
  }
  return false;
}
// Press and hold a chip (half a second) for rhythms, without iPhone's text-selection callout
const twLP = { t:null, fired:false, x:0, y:0 };
document.addEventListener("pointerdown", e => {
  twLP.fired = false; clearTimeout(twLP.t);
  const c = e.target.closest('[data-act="tw-chip"]'); if (!c) return;
  twLP.x = e.clientX; twLP.y = e.clientY;
  twLP.t = setTimeout(() => { twLP.fired = true; try { navigator.vibrate && navigator.vibrate(10); } catch(_){} twRhythmSheet(c.dataset.twPid, c.dataset.twType); }, 500);
});
document.addEventListener("pointermove", e => { if (twLP.t && Math.hypot(e.clientX - twLP.x, e.clientY - twLP.y) > 10) clearTimeout(twLP.t); });
["pointerup","pointercancel"].forEach(ev => document.addEventListener(ev, () => clearTimeout(twLP.t)));
document.addEventListener("contextmenu", e => { if (e.target.closest(".tw-chip")) e.preventDefault(); });
// Swipe a step row left to remove it
let twSw = null;
document.addEventListener("pointerdown", e => {
  const r = e.target.closest(".tw-row[data-tw-row]"); if (!r || e.target.closest("input,select,button")) return;
  twSw = { el:r, x:e.clientX, y:e.clientY, dx:0 };
});
document.addEventListener("pointermove", e => {
  if (!twSw) return; twSw.dx = e.clientX - twSw.x;
  if (Math.abs(e.clientY - twSw.y) > Math.abs(twSw.dx)){ twSw.el.style.transform = ""; twSw.el.style.opacity = ""; return; }
  if (twSw.dx < 0){ twSw.el.style.transform = `translateX(${twSw.dx}px)`; twSw.el.style.opacity = String(Math.max(.2, 1 + twSw.dx / 250)); }
});
["pointerup","pointercancel"].forEach(ev => document.addEventListener(ev, () => {
  if (!twSw) return; const { el, dx } = twSw; twSw = null;
  if (ev === "pointerup" && dx < -90 && S.tw){ twRemoveStep(el.dataset.twRow); render(); } else { el.style.transform = ""; el.style.opacity = ""; }
}));

const TW_SCREENS = {
  back: () => twLookBack(),
  focus: () => twFocusScreen(),
  beyond: () => twBeyondScreen(),
  week: () => twWeekScreen(),
  prayer: () => twPrayerScreen(),
  done: () => twDoneScreen(),
  pause: () => `<div class="tw-pause">
      <div class="eyebrow">Before you plan</div>
      <div><blockquote class="tw-verse">“Walk in wisdom toward them that are without, redeeming the time.”</blockquote><div class="vref muted">Colossians 4:5</div></div>
      <p class="tw-prayer">Take a moment to pray, asking: <b>“Lord, who do you want me to love this week?”</b></p>
    </div>`
};

// Who to pray for today. A finished plan for this week sets it (its prayer rotation);
// otherwise it's your Focus 5. send-reminders' buildMessage() uses the same rule.
function prayToday(){
  const t = today(); const plan = weekPlan(mondayOf(t));
  if (plan && plan.completedAt) return { plan:true, list: (Array.isArray(plan.rotation[t]) ? plan.rotation[t] : []).map(id => S.people.get(id)).filter(p => p && !p.example) };
  return { plan:false, list: focusPeople() };
}

/* Week ahead: the next 7 days at a glance */
function weekAhead(){
  const t = today(); const days = [0,1,2,3,4,5,6].map(i => addDays(t, i)); const end = days[6];
  const ppl = people(); const byId = new Map(ppl.map(p => [p.id, p]));
  const items = {}; days.forEach(d => items[d] = []);
  allTasks().filter(x => !x.done && x.due && x.due >= t && x.due <= end).forEach(x =>
    items[x.due].push(isMeetup(x)
      ? { kind:"task", sort:"1" + (x.time || "99"), title:x.title, sub:meetupWhen(x), person: x.personId ? byId.get(x.personId) : null, task:x }
      : { kind:"task", sort:"1" + (x.remindAt || "99"), title:x.title, sub:x.remindAt ? fmtTime(x.remindAt) : "", person: x.personId ? byId.get(x.personId) : null, task:x }));
  ppl.forEach(p => (p.dates||[]).forEach(d => { const n = nextDateOf(d); if (n && items[n]) items[n].push({ kind:"moment", sort:"0", title:d.label, person:p }); }));
  focusPeople().forEach(p => { const l = lastContact(p); const due = l ? addDays(l, 14) : null;
    if (due && due > t && items[due]) items[due].push({ kind:"checkin", sort:"2", title:"Check in with " + first(p.name), sub:"Two weeks since you last connected", person:p }); });
  days.forEach(d => items[d].sort((a,b) => a.sort.localeCompare(b.sort)));
  return { days, items };
}
function viewWeek(){
  const t = today(); const { days, items } = weekAhead();
  const sel = days.includes(S.ui.weekDay) ? S.ui.weekDay : null;
  const total = days.reduce((n, d) => n + items[d].length, 0);
  const dayLabel = d => d === t ? "Today" : daysBetween(t, d) === 1 ? "Tomorrow" : new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday:"long" });
  const dotCls = i => i.kind === "moment" ? "m" : isFam(i.person) ? "f" : "";
  const strip = days.map(d => `<button class="wday${d===t?" today":""}" data-wday="${d}" aria-pressed="${sel===d}" aria-label="${esc(dayLabel(d))}, ${items[d].length} planned">
      <span class="wd">${d===t ? "Today" : esc(new Date(d+"T12:00:00").toLocaleDateString(undefined,{weekday:"short"}))}</span>
      <span class="dn">${+d.slice(8)}</span>
      <span class="dots">${items[d].slice(0,3).map(i => `<i class="${dotCls(i)}"></i>`).join("")}</span></button>`).join("");
  const row = i => {
    const icon = i.task ? `<button class="check" data-toggle-task="${esc(i.task.id)}" data-pid="${esc(i.task.personId||"")}" aria-label="Mark done"></button>`
      : i.kind === "moment" ? `<span class="wk-ic">◆</span>` : `<span class="wk-ic wk-ci">↻</span>`;
    const meta = [i.person ? nameLink(i.person) : "", i.sub ? esc(i.sub) : ""].filter(Boolean).join(" · ");
    return `<div class="wk-row">${icon}<div class="grow"><div>${i.task ? `<button class="tasktitle" data-edit-task="${esc(i.task.id)}" data-pid="${esc(i.task.personId||"")}">${taskTitle(i.task)}</button>` : esc(i.title)}</div>${meta ? `<div class="meta">${meta}</div>` : ""}</div></div>`;
  };
  const block = d => `<div class="wk-day">${esc(dayLabel(d))} <span>${esc(fmtDate(d))}</span></div>${items[d].map(row).join("")}`;
  let body;
  if (sel) body = items[sel].length ? block(sel) : `<div class="wk-day">${esc(dayLabel(sel))} <span>${esc(fmtDate(sel))}</span></div><div class="empty" style="padding:10px 0">Nothing planned yet.<div style="margin-top:8px"><button class="btn small ghost" data-act="plan-day" data-day="${sel}">Plan a step for ${esc(dayLabel(sel).toLowerCase() === "today" ? "today" : dayLabel(sel))}</button></div></div>`;
  else body = total ? days.filter(d => items[d].length).map(block).join("") : `<div class="empty" style="padding:10px 0">Your week is wide open. Who could you reach out to?<div style="margin-top:8px"><button class="btn small ghost" data-act="plan-day" data-day="${addDays(t,1)}">Plan a step</button></div></div>`;
  return `<section>
      <div class="section-head"><h2>Week ahead</h2><span class="small muted">${sel ? `<button class="linkbtn" data-wday="${sel}">Show whole week</button>` : total + " planned"}</span></div>
      <div class="week" role="group" aria-label="Next 7 days">${strip}</div>
      <div class="card wk-list">${body}</div>
    </section>`;
}
function prayRow(p){
  const needs = (p.prayers||[]).filter(r => !r.answeredAt).map(r => r.text).join(" · ");
  const done = (p.prayed||[]).includes(today());
  return `<div class="pray">${avatar(p)}<div class="grow"><div class="pname">${nameLink(p)}</div><div class="needs">${esc(needs || "No prayer needs yet")}</div></div>
    <button class="pill-btn ${done?"on":""}" data-prayed="${esc(p.id)}" aria-pressed="${done}">${done?"Prayed ✓":"Prayed"}</button></div>`;
}

/* People */
function viewPeople(){
  const q = S.ui.q.toLowerCase(); const f = S.ui.stageFilter;
  const fam = S.ui.circle === "family"; const names = fam ? DEPTHS : STAGES;
  const all = people(); const inCircle = all.filter(p => isFam(p) === fam);
  const nFam = all.filter(isFam).length, nReach = all.length - nFam;
  let list = inCircle.filter(p => (f==="All" || (f==="Focus 5" ? p.focus : names[levelOf(p)]===f)) && (!q || JSON.stringify([p.name,p.note,p.howMet,p.relationship,p.job,p.interests]).toLowerCase().includes(q)));
  list.sort((a,b) => (b.focus?1:0)-(a.focus?1:0) || a.name.localeCompare(b.name));
  const filters = ["All","Focus 5",...names];
  return `
  <div class="top"><div><div class="date">${inCircle.length} ${inCircle.length===1?"person":"people"}</div><h1>My People</h1></div></div>
  <div class="stack">
    <div class="circles" role="tablist" aria-label="Which people">
      <button role="tab" class="reach" data-circle="reach" aria-selected="${!fam}">${ICON_SEED}Reaching<span class="count">${nReach}</span></button>
      <button role="tab" class="family" data-circle="family" aria-selected="${fam}">${ICON_HOME}Church family<span class="count">${nFam}</span></button>
    </div>
    ${fam ? `<p class="small muted" style="margin:0">Members you want to know better, one step deeper at a time.</p>` : exampleBanner()}
    <input class="search" id="people-q" type="search" placeholder="Search names, notes, interests" value="${esc(S.ui.q)}">
    <div class="chips" role="group" aria-label="Filter by stage">${filters.map(x => `<button class="chip" data-filter="${esc(x)}" aria-pressed="${x===f}">${esc(x)}</button>`).join("")}</div>
    ${list.length ? `<div class="plist">${list.map(p => { const s = sinceContact(p); return `
      <button class="pitem" data-open="${esc(p.id)}">${avatar(p)}
        <div class="grow"><div class="pname">${esc(p.name)} ${p.focus?`<span class="star" aria-label="Focus 5">★</span>`:""} ${p.example?`<span class="ex">Example</span>`:""}</div>
        <div class="meta">${esc(p.howMet||"")}${p.howMet?" · ":""}${esc(lastContactLabel(p) || "No contact logged")}</div></div>${stageTag(p)}</button>`; }).join("")}</div>`
      : `<div class="card empty">${inCircle.length ? "No one matches that search." : fam ? "No church family here yet. After Sunday, tap Add person for someone you'd like to know better. Already have someone on your list who joined the church? Open them and tap Move to Church family." : "No one here yet. Tap Add person after your next conversation."}</div>`}
    ${storageNote()}
  </div>`;
}

/* Person */
const LOG_VERB = { "Call":"Called", "Text":"Texted", "In person":"Saw them", "Meal":"Shared a meal", "Served":"Served", "Invited":"Invited", "Shared my story":"Shared your story" };
const IN_PERSON = ["In person","Meal","Served","Invited","Shared my story"];
function lastOf(p, types){ return (p.logs||[]).filter(x => types.includes(x.type)).map(x => x.at).sort().pop() || null; }
function agoText(d){ if (!d) return "never"; const n = daysBetween(d, today()); if (n <= 0) return "today"; if (n === 1) return "yesterday"; if (n < 7) return n + " days ago"; if (n < 14) return "last week"; if (n < 60) return Math.round(n/7) + " weeks ago"; return Math.round(n/30) + " months ago"; }
function agoFull(d){ if (!d) return "Never"; const t = agoText(d); return t.charAt(0).toUpperCase() + t.slice(1) + " (" + fmtDate(d) + ")"; }
function lastContactLabel(p){ let l = null; (p.logs||[]).forEach(x => { if (!l || x.at >= l.at) l = x; }); return l ? (LOG_VERB[l.type] || l.type) + " " + agoText(l.at) : null; }
function comingUp(p){
  const t = today(); const items = [];
  (p.tasks||[]).filter(x => !x.done && x.due).forEach(x => items.push(x.due < t
    ? { sort:"0" + x.due, text:x.title, meetup:isMeetup(x), sub: isMeetup(x) ? "How did it go? Was " + fmtDay(x.due) : "Overdue, was " + fmtDay(x.due), overdue:!isMeetup(x) }
    : isMeetup(x) ? { sort:x.due + (x.time || "99"), text:x.title, meetup:true, sub:fmtDay(x.due) + (x.time ? " · " + fmtTime(x.time) : "") }
    : { sort:x.due + (x.remindAt || "99"), text:x.title, sub:fmtDay(x.due) + (x.remindAt ? " · " + fmtTime(x.remindAt) : "") }));
  (p.dates||[]).forEach(d => { const n = nextDateOf(d); if (n){ const k = daysBetween(t, n); if (k >= 0 && k <= 30) items.push({ sort:n + "00", text:d.label, sub:fmtDay(n) }); } });
  return items.sort((a,b) => a.sort.localeCompare(b.sort)).slice(0, 4);
}
function historyView(p){
  const f = S.ui.hist || "All";
  const groups = { "All":null, "Calls":["Call"], "Texts":["Text"], "In person":IN_PERSON, "Tasks done":["__task"] };
  const items = [];
  (p.logs||[]).forEach((l, n) => items.push({ sort:l.at + "1" + String(n).padStart(5, "0"), kind:l.type, log:l }));
  (p.tasks||[]).filter(t => t.done && t.doneAt).forEach(t => items.push({ sort:t.doneAt + "0", kind:"__task", task:t }));
  const doneLabel = t => isMeetup(t) ? "Meetup" : "Task done";
  const g = groups[f] || null;
  const list = items.filter(i => !g || g.includes(i.kind)).sort((a,b) => b.sort.localeCompare(a.sort));
  const chips = Object.keys(groups).map(k => `<button class="chip" data-hist="${esc(k)}" aria-pressed="${k===f}">${esc(k)}</button>`).join("");
  const row = i => i.task
    ? `<div class="tl done-task"><div class="when row spread"><span>${esc(fmtDate(i.task.doneAt))} · ${doneLabel(i.task)}</span><button class="linkbtn tl-edit" data-edit-task="${esc(i.task.id)}" data-pid="${esc(p.id)}">Edit</button></div><p>${esc(i.task.title)}</p></div>`
    : `<div class="tl"><div class="when row spread"><span>${esc(fmtDate(i.log.at))} · ${esc(LOG_VERB[i.log.type] || i.log.type)}</span>${i.log.id ? `<button class="linkbtn tl-edit" data-edit-log="${esc(i.log.id)}">Edit</button>` : ""}</div>${i.log.shared?`<p>${esc(i.log.shared)}</p>`:""}${i.log.cares?`<p><span class="lbl">Cares about:</span> ${esc(i.log.cares)}</p>`:""}${i.log.questions?`<p><span class="lbl">Asked:</span> ${esc(i.log.questions)}</p>`:""}${!i.log.shared && !i.log.cares && !i.log.questions && i.log.id ? `<button class="linkbtn" data-edit-log="${esc(i.log.id)}">Add a note</button>` : ""}</div>`;
  return `<div class="chips" role="group" aria-label="Filter history">${chips}</div>` + (list.length
    ? `<div class="timeline">${list.map(row).join("")}</div>`
    : `<div class="card empty">${f === "All" ? "Tap Called, Texted, or Saw them after you reach out, or log a longer conversation." : "Nothing here yet."}</div>`);
}
function editLogSheet(logId, confirmDelete){
  const p = cur(); const l = (p?.logs||[]).find(x => x.id === logId); if (!l) return;
  S.editLog = logId;
  const types = LOG_TYPES.includes(l.type) ? LOG_TYPES : [l.type, ...LOG_TYPES];
  openSheet(`<form class="stack" data-form="logedit">
    <h2>Edit entry</h2>
    <p class="small muted" style="margin:0">With ${esc(p.name)}</p>
    <div class="row wrap" style="gap:10px;align-items:flex-end"><label class="f grow">Type<select class="t" id="le-type">${types.map(t => `<option value="${esc(t)}" ${t === l.type ? "selected" : ""}>${esc(LOG_VERB[t] || t)}</option>`).join("")}</select></label><label class="f grow">Date<input class="t" id="le-date" type="date" value="${esc(l.at)}"></label></div>
    <label class="f">What did ${esc(first(p.name))} share?<textarea class="t" id="le-shared" placeholder="Their words, their news, what's on their heart">${esc(l.shared||"")}</textarea></label>
    <label class="f">What do they care about?<input class="t" id="le-cares" value="${esc(l.cares||"")}"></label>
    <label class="f">Questions they asked<input class="t" id="le-q" value="${esc(l.questions||"")}"></label>
    ${confirmDelete ? `<div class="card stack"><div>Delete this entry? This can't be undone.</div><div class="row"><button type="button" class="btn small" style="background:var(--warn)" data-act="ldel-yes">Delete</button><button type="button" class="btn small ghost" data-act="ldel-no">Keep it</button></div></div>` : ""}
    <div class="row wrap"><button class="btn">Save</button><button type="button" class="btn ghost" data-act="close-sheet">Cancel</button><button type="button" class="linkbtn danger" data-act="ldel-ask" style="margin-left:auto">Delete entry</button></div>
  </form>`);
}
function editPrayerSheet(pid, id, confirmDelete){
  const q = S.people.get(pid); const r = (q?.prayers||[]).find(x => x.id === id); if (!r) return;
  S.editPrayer = { pid, id };
  openSheet(`<form class="stack" data-form="predit">
    <h2>Edit prayer need</h2>
    <p class="small muted" style="margin:0">For ${esc(q.name)}</p>
    <label class="f">Prayer need<textarea class="t" id="pe-text" required>${esc(r.text)}</textarea></label>
    <label class="f">Praying since<input class="t" id="pe-at" type="date" value="${esc(r.at||"")}"></label>
    <label class="row small" style="gap:8px"><input type="checkbox" id="pe-answered" ${r.answeredAt ? "checked" : ""}> God answered this</label>
    <label class="f">Answered on<input class="t" id="pe-ans" type="date" value="${esc(r.answeredAt || today())}"></label>
    ${confirmDelete ? `<div class="card stack"><div>Delete this prayer need? This can't be undone.</div><div class="row"><button type="button" class="btn small" style="background:var(--warn)" data-act="pdel-yes">Delete</button><button type="button" class="btn small ghost" data-act="pdel-no">Keep it</button></div></div>` : ""}
    <div class="row wrap"><button class="btn">Save</button><button type="button" class="btn ghost" data-act="close-sheet">Cancel</button><button type="button" class="linkbtn danger" data-act="pdel-ask" style="margin-left:auto">Delete</button></div>
  </form>`);
}
function noteSheet(logId){
  const p = cur(); const l = (p?.logs||[]).find(x => x.id === logId); if (!l) return;
  S.noteLog = logId;
  openSheet(`<form class="stack" data-form="lognote"><h2>Add a note</h2><p class="small muted" style="margin:0">${esc((LOG_VERB[l.type]||l.type) + " · " + fmtDate(l.at))}</p>
    <label class="f">What did ${esc(first(p.name))} share?<textarea class="t" id="ln-text" data-autofocus placeholder="Their words, their news, what's on their heart"></textarea></label>
    <div class="row"><button class="btn">Save</button><button type="button" class="btn ghost" data-act="close-sheet">Cancel</button></div></form>`);
}
function viewPerson(p){
  const s = sinceContact(p);
  const logs = [...(p.logs||[])].sort((a,b)=>b.at.localeCompare(a.at));
  const last = logs[0];
  const openPrayers = (p.prayers||[]).filter(r=>!r.answeredAt);
  const answered = (p.prayers||[]).filter(r=>r.answeredAt);
  const openQs = logs.map(l=>l.questions).filter(Boolean);
  const cares = logs.map(l=>l.cares).filter(Boolean);
  const tasks = [...(p.tasks||[])].sort((a,b)=>(a.done-b.done)||(a.due||"9").localeCompare(b.due||"9"));
  const o = S.ui.open;
  const focusCount = focusPeople().length;
  const up = comingUp(p);
  return `
  <button class="back" data-act="back">‹ Back</button>
  <div class="stack-lg">
    ${p.example ? `<div class="banner info"><div class="grow"><div><b>Example person.</b> Changes here aren't saved.</div></div></div>` : ""}
    <div class="stack">
      <div class="phead">${avatar(p)}
        <div class="grow">${isFam(p) ? `<div class="circle-tag">${ICON_HOME}Church family</div>` : ""}<h1 style="font-size:26px">${esc(p.name)}</h1><div class="meta">${esc([p.howMet, p.relationship].filter(Boolean).join(" · "))}${s!==null?` · last contact ${s===0?"today":s+"d ago"}`:""}</div></div>
        <button class="pill-btn ${p.focus?"on":""}" data-act="focus" aria-pressed="${!!p.focus}" ${!p.focus && focusCount>=5 ? `title="Focus 5 is full"`:""}>${p.focus?"★ Focus 5":"☆ Focus 5"}</button></div>
      ${contactButtons(p)}
      <div>
        <div class="row spread"><span class="stage-label">${isFam(p) ? "How well I know them" : "Stage"}: <b>${esc(levels(p)[levelOf(p)])}</b></span><span class="small muted">Tap to change</span></div>
        <div class="stagebar" style="grid-template-columns:repeat(${levels(p).length},1fr)" role="group" aria-label="${isFam(p) ? "How well I know them" : "Journey stage"}">${levels(p).map((st,i)=>`<button class="${i<=levelOf(p)?"done":""}" data-stage="${i}" aria-label="${esc(st)}" title="${esc(st)}"></button>`).join("")}</div>
      </div>
    </div>

    <section class="card stack glance">
      <div class="row spread"><h3>At a glance</h3>${s !== null && s >= 14 ? `<span class="nudge">No contact in ${s} days</span>` : ""}</div>
      <dl class="kv">
        <dt>Last call</dt><dd>${esc(agoFull(lastOf(p, ["Call"])))}</dd>
        <dt>Last text</dt><dd>${esc(agoFull(lastOf(p, ["Text"])))}</dd>
        <dt>In person</dt><dd>${esc(agoFull(lastOf(p, IN_PERSON)))}</dd>
        <dt>Coming up</dt><dd>${up.length ? up.map(i => `<div class="${i.overdue ? "danger" : ""}">${i.meetup ? ICON_CAL : ""}${esc(i.text)} <span class="meta">· ${esc(i.sub)}</span></div>`).join("") : "Nothing scheduled"}</dd>
      </dl>
      <div class="row wrap quicklog"><span class="small muted">Just reached out?</span><button class="pill-btn" data-quicklog="Call">Called</button><button class="pill-btn" data-quicklog="Text">Texted</button><button class="pill-btn" data-quicklog="In person">Saw them</button></div>
    </section>

    <section class="card prep stack">
      <div class="row spread"><h3>Before you meet</h3></div>
      <dl>
        <dt>Last time</dt><dd>${last ? esc(fmtDate(last.at)+" · "+last.type+(last.shared?": "+last.shared:"")) : "No conversations logged yet"}</dd>
        ${cares.length?`<dt>Cares about</dt><dd>${esc(cares.slice(0,2).join("; "))}</dd>`:""}
        ${openQs.length?`<dt>They asked</dt><dd>${esc(openQs[0])}</dd>`:""}
        ${openPrayers.length?`<dt>Pray for</dt><dd>${esc(openPrayers.map(r=>r.text).join("; "))}</dd>`:""}
        ${p.interests?`<dt>Interests</dt><dd>${esc(p.interests)}</dd>`:""}
        <dt>Try asking</dt><dd id="ask-idea">${esc(suggestQuestion(p, last, openPrayers))}</dd>
      </dl>
      ${S.ai ? `<div class="row wrap"><button class="linkbtn" data-act="ai-question">Suggest another question with Claude</button><span class="hint">Sends this person's notes to Claude</span></div>`:""}
    </section>

    <section class="stack">
      <div class="section-head"><h2>History</h2>${o==="log"?"":`<button class="btn small" data-act="open-log">Log a conversation</button>`}</div>
      ${o==="log" ? logForm(p) : ""}
      ${historyView(p)}
    </section>

    <section class="stack">
      <div class="section-head"><h2>Next steps</h2><div class="row"><button class="linkbtn" data-act="open-meetup">Plan a meetup</button><button class="linkbtn" data-act="open-task">Add</button></div></div>
      <div class="chips wrap">${(isFam(p) ? NEXT_BY_DEPTH[depthOf(p)] : NEXT_BY_STAGE[p.stage||0]).map(x=>`<button class="chip" data-suggest="${esc(x)}">+ ${esc(x)}</button>`).join("")}</div>
      ${tasks.length ? `<ul class="plain-list">${tasks.map(t=>`<li><button class="check ${t.done?"on":""}" data-toggle-task="${esc(t.id)}" aria-label="${t.done?"Mark not done":"Mark done"}">${t.done?"✓":""}</button><div class="grow"><button class="tasktitle ${t.done?"strike":""}" data-edit-task="${esc(t.id)}" data-pid="${esc(p.id)}">${taskTitle(t)}</button>${t.due?`<div class="meta">${t.done?"Done":isMeetup(t)?esc(fmtDay(t.due)+" · "+meetupWhen(t)):"Due "+esc(fmtDay(t.due))+(t.remindAt?" · Reminder "+esc(fmtTime(t.remindAt)):"")}</div>`:""}</div><button class="linkbtn muted" data-del-task="${esc(t.id)}" aria-label="Remove">✕</button></li>`).join("")}</ul>` : ""}
    </section>

    <section class="stack">
      <div class="section-head"><h2>Prayer</h2><button class="linkbtn" data-act="open-prayer">Add need</button></div>
      ${o==="prayer" ? `<form class="card stack" data-form="prayer"><label class="f">Prayer need<input class="t" id="pr-text" required placeholder="e.g. His dad's surgery on the 14th"></label><div class="row"><button class="btn small">Add</button><button type="button" class="btn small ghost" data-act="close">Cancel</button></div></form>` : ""}
      ${openPrayers.length || answered.length ? `<ul class="plain-list">${openPrayers.map(r=>`<li><span class="star">♡</span><div class="grow">${esc(r.text)}<div class="meta">Since ${esc(fmtDate(r.at))}</div></div><button class="linkbtn tl-edit" data-edit-prayer="${esc(r.id)}" data-pid="${esc(p.id)}">Edit</button><button class="pill-btn" data-answer="${esc(r.id)}">Answered</button></li>`).join("")}
        ${answered.map(r=>`<li><span class="star">✓</span><div class="grow">${esc(r.text)}<div class="meta">Answered ${esc(fmtDate(r.answeredAt))}</div></div><button class="linkbtn tl-edit" data-edit-prayer="${esc(r.id)}" data-pid="${esc(p.id)}">Edit</button></li>`).join("")}</ul>` : `<p class="small muted">No prayer needs yet.</p>`}
    </section>

    <section class="stack">
      <div class="section-head"><h2>Life moments</h2><button class="linkbtn" data-act="open-date">Add date</button></div>
      ${o==="date" ? `<form class="card stack" data-form="date"><label class="f">What is it<input class="t" id="dt-label" required placeholder="Birthday, new job, surgery"></label><label class="f">Date<input class="t" id="dt-date" type="date" required></label><label class="row small"><input type="checkbox" id="dt-yearly" checked> Repeats every year</label><div class="row"><button class="btn small">Add</button><button type="button" class="btn small ghost" data-act="close">Cancel</button></div></form>` : ""}
      ${(p.dates||[]).length ? `<ul class="plain-list">${p.dates.map(d=>`<li><span class="star">◆</span><div class="grow">${esc(d.label)}<div class="meta">${esc(fmtDate(nextDateOf(d)))}${d.yearly?" · yearly":""}</div></div><button class="linkbtn muted" data-del-date="${esc(d.id)}" aria-label="Remove">✕</button></li>`).join("")}</ul>` : `<p class="small muted">Birthdays and hard anniversaries show up on Today a week ahead.</p>`}
    </section>

    <section class="stack">
      <div class="section-head"><h2>About ${esc(first(p.name))}</h2><button class="linkbtn" data-act="open-edit">${o==="edit"?"":"Edit"}</button></div>
      ${o==="edit" ? editForm(p) : `
      <dl class="kv">
        <dt>What I know</dt><dd>${esc(p.note||"—")}</dd>
        <dt>${isFam(p) ? "Where I see them" : "How we met"}</dt><dd>${esc([p.howMet, p.metOn?fmtDate(p.metOn):""].filter(Boolean).join(", ")||"—")}</dd>
        <dt>Family</dt><dd>${esc(p.family||"—")}</dd>
        <dt>Work</dt><dd>${esc(p.job||"—")}</dd>
        <dt>Interests</dt><dd>${esc(p.interests||"—")}</dd>
        ${isFam(p) ? "" : `<dt>Faith</dt><dd>${esc(p.faith||"—")}</dd>`}
        <dt>Phone</dt><dd>${p.phone?`<span>${esc(p.phone)}</span> <button class="linkbtn" data-copy="${esc(p.phone)}">Copy</button>`:"—"}</dd>
        <dt>Email</dt><dd>${p.email?`<span>${esc(p.email)}</span> <button class="linkbtn" data-copy="${esc(p.email)}">Copy</button>`:"—"}</dd>
      </dl>`}
    </section>

    <section class="card stack move">${isFam(p)
      ? `<div><b>Church family</b><div class="small muted">Someone you're getting to know at church.</div></div><div><button class="linkbtn" data-act="move-circle">Move back to Reaching</button></div>`
      : `<div><b>Did ${esc(first(p.name))} join the church?</b><div class="small muted">Move them to Church family. Everything you've logged stays.</div></div><div><button class="btn small fam-btn" data-act="move-circle">${ICON_HOME} Move to Church family</button></div>`}</section>

    <section>${o==="delete" ? `<div class="card stack"><div>Remove ${esc(p.name)} and everything you've logged about them? This can't be undone.</div><div class="row"><button class="btn small" style="background:var(--warn)" data-act="delete-yes">Remove</button><button class="btn small ghost" data-act="close">Keep</button></div></div>` : `<button class="linkbtn danger" data-act="delete">Remove from my list</button>`}</section>
  </div>`;
}
/* Call / Text: open the iPhone's Phone or Messages app, then offer to log it when you come back to Tend. */
const ICON_PHONE = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>`;
const ICON_MSG = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/></svg>`;
// "(813) 555-0142 ext 4" -> "8135550142"; keeps a leading + for international numbers
function dialable(phone){
  const raw = String(phone || "").split(/\s*(?:x|ext\.?|extension)\s*\d/i)[0].trim();
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 3 ? (raw.startsWith("+") ? "+" : "") + digits : null;
}
function contactButtons(p){
  const num = dialable(p.phone);
  if (!num) return `<div class="row contact"><button class="linkbtn" data-act="add-phone">+ Add phone number</button><span class="hint">to call or text ${esc(first(p.name))} from here</span></div>`;
  return `<div class="row contact">
    <a class="pill-btn contact-btn" href="tel:${esc(num)}" data-contact="Call" data-pid="${esc(p.id)}">${ICON_PHONE}Call</a>
    <a class="pill-btn contact-btn" href="sms:${esc(num)}" data-contact="Text" data-pid="${esc(p.id)}">${ICON_MSG}Text</a></div>`;
}
const CONTACT_KEY = "tend-contact-pending";
function getContact(){ try { return JSON.parse(localStorage.getItem(CONTACT_KEY) || "null"); } catch(_) { return null; } }
function setContact(v){ try { if (v) localStorage.setItem(CONTACT_KEY, JSON.stringify(v)); else localStorage.removeItem(CONTACT_KEY); } catch(_){} }
// Only ask if Tend actually went to the background (they didn't cancel the "Call?" box), within two hours.
function askContact(){
  const c = getContact(); if (!c) return;
  if (!c.left){ if (Date.now() - c.at > 60000) setContact(null); return; }
  setContact(null);
  const p = S.people.get(c.pid);
  if (!p || Date.now() - c.at > 2 * 3600000) return;
  S.contactAsk = c;
  openSheet(`<div class="stack"><h2>Did you ${c.type === "Call" ? "call" : "text"} ${esc(first(p.name))}?</h2>
    <p class="small muted" style="margin:0">Tend can't see your calls or messages, so it checks with you before adding this to ${esc(first(p.name))}'s history.</p>
    <div class="row wrap"><button class="btn" data-act="contact-yes">Yes, log it</button><button class="btn ghost" data-act="contact-no">No</button></div></div>`);
}
function logQuick(p, type){
  (p.logs ||= []).push({ id:uid("l"), at:today(), type, shared:"", cares:"", questions:"" });
  savePerson(p); render();
  toast(({ "Call":"Called", "Text":"Texted", "In person":"Saw" }[type] || "Logged") + " " + first(p.name) + " today. Tap Add a note below to add details.");
}
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-contact]"); if (!a) return;
  setContact({ pid: a.dataset.pid, type: a.dataset.contact, at: Date.now(), left: false });
});
document.addEventListener("visibilitychange", () => {
  const c = getContact(); if (!c) return;
  if (document.visibilityState === "hidden"){ if (!c.left){ c.left = true; setContact(c); } }
  else if (S.mode === "db") setTimeout(askContact, 300);
});

function suggestQuestion(p, last, openPrayers){
  if (openPrayers[0]) return `"I've been praying about ${openPrayers[0].text.replace(/^(his|her)\s+/i,"your ").replace(/^./,c=>c.toLowerCase())}. How's that going?"`;
  if (last && last.cares) return `"You mentioned ${last.cares.toLowerCase()}. How's that going?"`;
  const byStage = ["\"What's been the best part of your week?\"","\"What was growing up like for you?\"","\"Where are you at with God these days?\"","\"What questions are still on your mind?\"","\"What's God been showing you lately?\"","\"Who in your life could use what you've found?\""];
  return isFam(p) ? DEPTH_QUESTIONS[depthOf(p)] : byStage[p.stage||0];
}
function logForm(p){
  return `<form class="card stack" data-form="log">
    <div class="chips wrap" role="group" aria-label="Type">${LOG_TYPES.map((x,i)=>`<button type="button" class="chip" data-logtype="${esc(x)}" aria-pressed="${i===0}">${esc(x)}</button>`).join("")}</div>
    <label class="f">Date<input class="t" id="lg-date" type="date" value="${esc(S.ui.logDate || today())}"></label>
    <label class="f">What did ${esc(first(p.name))} share?<textarea class="t" id="lg-shared" placeholder="Their words, their news, what's on their heart"></textarea></label>
    <label class="f">What do they care about?<input class="t" id="lg-cares" placeholder="e.g. Being a good dad"></label>
    <label class="f">Questions they asked<input class="t" id="lg-q" placeholder="e.g. Why do you pray before meals?"></label>
    <label class="f">Prayer need (optional)<input class="t" id="lg-prayer" placeholder="Adds to their prayer list"></label>
    <div class="row"><button class="btn small">Save</button><button type="button" class="btn small ghost" data-act="close">Cancel</button></div>
  </form>`;
}
function editForm(p){
  const f = (id,label,val,ph="") => `<label class="f">${label}<input class="t" id="${id}" value="${esc(val||"")}" placeholder="${esc(ph)}"></label>`;
  return `<form class="card stack" data-form="edit">
    ${f("ed-name","Name",p.name)}
    <label class="f">What I know about them<textarea class="t" id="ed-note" placeholder="Write it as if they might read it someday">${esc(p.note||"")}</textarea></label>
    <label class="f">${isFam(p) ? "Where you see them" : "How we met"}<select class="t" id="ed-how"><option value=""></option>${selectOpts(isFam(p) ? WHERE_SEEN : HOW_MET, p.howMet)}</select></label>
    ${f("ed-rel","Relationship",p.relationship,"Coworker, cousin, neighbor two doors down")}
    ${f("ed-family","Family",p.family,"Names of spouse, kids, parents")}
    ${f("ed-job","Work",p.job)}
    ${f("ed-int","Interests",p.interests)}
    ${isFam(p) ? "" : `<label class="f">Faith background<select class="t" id="ed-faith"><option value=""></option>${FAITH.map(x=>`<option ${x===p.faith?"selected":""}>${x}</option>`).join("")}</select></label>`}
    ${f("ed-phone","Phone",p.phone)}
    ${f("ed-email","Email",p.email)}
    <div class="row"><button class="btn small">Save</button><button type="button" class="btn small ghost" data-act="close">Cancel</button></div>
  </form>`;
}

/* Prayer tab */
function viewPrayer(){
  const ppl = people();
  const focus = ppl.filter(p=>p.focus);
  const others = ppl.filter(p=>!p.focus && (p.prayers||[]).some(r=>!r.answeredAt));
  const answered = []; ppl.forEach(p => (p.prayers||[]).filter(r=>r.answeredAt).forEach(r => answered.push({p, r})));
  answered.sort((a,b)=>b.r.answeredAt.localeCompare(a.r.answeredAt));
  return `
  <div class="top"><div><div class="date">${focus.length} of 5 in focus</div><h1>Prayer</h1></div></div>
  <div class="stack-lg">
    ${exampleBanner()}
    <section><div class="section-head"><h2>Focus 5 · today</h2></div>
      ${focus.length ? `<div class="pray-list">${focus.map(prayRow).join("")}</div>` : `<div class="card empty">Open someone and tap ☆ Focus 5 to pray for them daily.</div>`}</section>
    <section><div class="section-head"><h2>Also praying for</h2></div>
      ${others.length ? `<div class="pray-list">${others.map(prayRow).join("")}</div>` : `<p class="small muted">Prayer needs for everyone else show up here.</p>`}</section>
    <section><div class="section-head"><h2>Answered</h2></div>
      ${answered.length ? `<ul class="plain-list card">${answered.map(({p,r})=>`<li><span class="star">✓</span><div class="grow">${esc(r.text)}<div class="meta">${nameLink(p)} · ${esc(fmtDate(r.answeredAt))}</div></div><button class="linkbtn tl-edit" data-edit-prayer="${esc(r.id)}" data-pid="${esc(p.id)}">Edit</button></li>`).join("")}</ul>` : `<p class="small muted">When God answers, mark it. This list becomes your encouragement.</p>`}</section>
  </div>`;
}

/* Tasks tab */
function viewTasks(){
  const t = today(); const byId = new Map(people().map(p=>[p.id,p]));
  const open = allTasks().filter(x=>!x.done);
  const groups = [
    ["Pick back up", open.filter(x=>x.due && x.due<t)],
    ["Today", open.filter(x=>x.due===t)],
    ["Coming up", open.filter(x=>x.due && x.due>t).sort((a,b)=>a.due.localeCompare(b.due) || (a.time||a.remindAt||"99").localeCompare(b.time||b.remindAt||"99"))],
    ["Anytime", open.filter(x=>!x.due)]
  ];
  const doneRecent = allTasks().filter(x=>x.done && x.doneAt && x.doneAt>=addDays(t,-7));
  return `
  <div class="top"><div><div class="date">${open.length} open</div><h1>Tasks</h1></div></div>
  <div class="stack-lg">
    ${exampleBanner()}
    <div class="row wrap"><button class="btn small" data-act="open-gtask">Add a task</button><button class="btn small ghost" data-act="open-gmeetup">${ICON_CAL} Plan a meetup</button></div>
    ${groups.filter(g=>g[1].length).map(([name, list]) => `<section><div class="section-head"><h2>${name}</h2></div>
      <ul class="plain-list card">${list.map(x=>{ const p = x.personId?byId.get(x.personId):null; return `<li><button class="check" data-toggle-task="${esc(x.id)}" data-pid="${esc(x.personId||"")}" aria-label="Mark done"></button><div class="grow"><button class="tasktitle" data-edit-task="${esc(x.id)}" data-pid="${esc(x.personId||"")}">${taskTitle(x)}</button><div class="meta">${p?nameLink(p)+" · ":""}${x.due?esc(fmtDay(x.due)):"No date"}${isMeetup(x)?(x.time||x.location?" · "+esc(meetupWhen(x)):""):x.remindAt?" · Reminder "+esc(fmtTime(x.remindAt)):""}</div></div></li>`; }).join("")}</ul></section>`).join("") || `<div class="card empty">No open tasks. Add a next step from anyone's page.</div>`}
    ${doneRecent.length ? `<section><div class="section-head"><h2>Done this week</h2></div><ul class="plain-list">${doneRecent.map(x=>`<li><button class="check on" data-toggle-task="${esc(x.id)}" data-pid="${esc(x.personId||"")}" aria-label="Mark not done">✓</button><div class="grow strike">${taskTitle(x)}</div></li>`).join("")}</ul></section>`:""}
  </div>`;
}

/* ---------- sheets ---------- */
function openSheet(html){
  $("#sheet-root").innerHTML = `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  const f = $("#sheet-root [data-autofocus]"); if (f) setTimeout(()=>f.focus(), 50);
}
function closeSheet(){ $("#sheet-root").innerHTML = ""; syncCircle(); }

let addDraft = { how:"", circle:"reach" };
function howChips(){
  const fam = addDraft.circle === "family";
  return `<span class="f">${fam ? "Where you see them" : "How you met"}</span><div class="chips wrap" role="group">${(fam ? WHERE_SEEN : HOW_MET).map(x=>`<button type="button" class="chip" data-how="${esc(x)}" aria-pressed="${x===addDraft.how}">${esc(x)}</button>`).join("")}</div>`;
}
function addSheet(circle){
  addDraft = { how:"", circle: circle || viewCircle() };
  syncCircle(addDraft.circle);
  const fam = addDraft.circle === "family";
  openSheet(`<form class="stack" data-form="add" autocomplete="off">
    <h2>Add a person</h2>
    <div class="circles" role="radiogroup" aria-label="Who is this">
      <button type="button" role="radio" class="reach" data-add-circle="reach" aria-checked="${!fam}">${ICON_SEED}Reaching</button>
      <button type="button" role="radio" class="family" data-add-circle="family" aria-checked="${fam}">${ICON_HOME}Church family</button>
    </div>
    <label class="f">Name<input class="t" id="ad-name" data-autofocus required placeholder="${fam ? "Sarah from the 9am service is fine" : "Mike from the gym is fine"}"></label>
    <div class="f" id="how-chips" style="display:flex;flex-direction:column;gap:6px">${howChips()}</div>
    <label class="f">First note<textarea class="t" id="ad-note" placeholder="Write it as if they might read it someday"></textarea><span class="hint">Tip: tap your keyboard's mic to talk instead of type.</span></label>
    ${S.ai ? `<details class="card"><summary style="font-weight:600;cursor:pointer">Describe the conversation instead</summary>
      <div class="stack" style="margin-top:10px"><textarea class="t" id="ad-voice" placeholder="Met Carlos at my son's game. His dad just passed. He coaches the Tigers."></textarea>
      <div class="row wrap"><button type="button" class="btn small ghost" data-act="ai-fill">Fill in for me</button><span class="hint" id="ai-status">Claude reads this text and fills the form.</span></div></div></details>` : ""}
    <div id="ai-extra"></div>
    <div id="dup"></div>
    <div class="row wrap"><button class="btn" data-submit="done">Save</button><button class="btn ghost" data-submit="another">Save and add another</button><button type="button" class="linkbtn muted" data-act="close-sheet">Cancel</button></div>
  </form>`);
}
function afterAddSheet(p){
  const canFocus = focusPeople().length < 5;
  openSheet(`<div class="stack"><h2>${esc(first(p.name))} is on your list</h2>
    <div class="stack"><span class="f">Add a next step?</span><div class="chips wrap">
      ${isFam(p) ? `<button class="chip" data-quick-step="Say hi to ${esc(first(p.name))} on Sunday|7">Say hi next Sunday</button>` : `<button class="chip" data-quick-step="Text ${esc(first(p.name))}|3">Text in 3 days</button>`}
      <button class="chip" data-quick-step="Pray for ${esc(first(p.name))}|7">Pray this week</button>
      <button class="chip" data-quick-step="Invite ${esc(first(p.name))} to coffee|7">Invite to coffee</button></div></div>
    ${canFocus ? `<div class="row spread card"><div><b>Add to Focus 5?</b><div class="small muted">You'll pray for them daily on Today.</div></div><button class="pill-btn" data-act="add-focus">★ Add</button></div>` : ""}
    ${!S.settings.notify && realPeople().length === 1 ? `<div class="row spread card"><div><b>Want reminders?</b><div class="small muted">Turn on notifications so Tend can remind you to follow up.</div></div><button class="pill-btn" data-act="nudge-on">Turn on</button></div>` : ""}
    <div class="row"><button class="btn" data-act="open-new">Open ${esc(first(p.name))}</button><button class="btn ghost" data-act="close-sheet">Done</button></div></div>`);
  S.lastAdded = p.id;
}
let editing = null;
function taskRef(pid, id){ const list = pid ? (S.people.get(pid)?.tasks || []) : S.meta.tasks; return { list, t: list.find(x => x.id === id) }; }
/* Add sheet (Task / Meetup) and the meetup detail sheet share one draft. */
let md = null;
function addTaskSheet(o = {}){
  const pid = o.pid || null;
  md = { mode:"add", kind: o.kind || "task", fixedPid: !!pid, withPid: pid, title:"", due: o.due || (pid ? addDays(today(), 3) : ""), remindAt:"", time:"", location:"",
    bringUp:[], reminders:[], touched:false, openRem:null, moved:null };
  taskSheet();
}
function openMeetup(pid, id, convert){
  const { t } = taskRef(pid, id); if (!t) return;
  editing = { pid, id };
  md = { mode: convert ? "convert" : "edit", kind:"meetup", fixedPid:false, pid, id, withPid: pid, title: t.title || "", due: t.due || "", time: convert ? "" : (t.time || ""),
    location: t.location || "", bringUp: clone(t.bringUp || []), reminders: clone(t.reminders || []), done: !!t.done, touched:false, openRem:null, moved:null, movedAny:false };
  taskSheet();
  if (convert) setTimeout(() => $('[data-md="time"]')?.focus(), 60);
}
function taskSheet(){
  const m = md; const meet = m.kind === "meetup"; const ppl = people();
  const who = m.withPid ? S.people.get(m.withPid) : null;
  const withSel = label => `<label class="f">${label}<select class="t" data-md="withPid"><option value="">No one in particular</option>${ppl.map(p => `<option value="${esc(p.id)}" ${p.id === m.withPid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`;
  const head = m.mode === "add"
    ? `<h2>Add</h2><div class="circles kind-toggle" role="radiogroup" aria-label="What are you adding">
        <button type="button" role="radio" class="reach" data-tkind="task" aria-checked="${!meet}">Task</button>
        <button type="button" role="radio" class="reach" data-tkind="meetup" aria-checked="${meet}">${ICON_CAL}Meetup</button></div>`
    : `<h2>${m.mode === "convert" ? "Make this a meetup" : "Meetup"}</h2>${m.done ? `<p class="small muted" style="margin:0">Done. Reminders are off.</p>` : ""}`;
  const taskFields = `
    <label class="f">${m.fixedPid ? "Next step" : "Task"}<input class="t" data-md="title" data-autofocus required value="${esc(m.title)}" placeholder="${m.fixedPid && who ? `e.g. Text ${esc(first(who.name))} about the game` : "e.g. Buy a Bible for Dana"}"></label>
    ${m.fixedPid ? "" : withSel("For")}
    <div class="row wrap" style="gap:10px;align-items:flex-end"><label class="f grow">Day<input class="t" data-md="due" type="date" value="${esc(m.due)}"></label><label class="f grow">Remind me at<input class="t" data-md="remindAt" type="time" value="${esc(m.remindAt)}"></label></div>
    <span class="hint">Leave the time blank if you don't want a phone reminder.</span>`;
  const meetFields = `
    <label class="f">What<input class="t" data-md="title" ${m.mode === "add" ? "data-autofocus" : ""} required value="${esc(m.title)}" placeholder="${who ? `e.g. Coffee with ${esc(first(who.name))}` : "e.g. Coffee with Townsend"}"></label>
    <div class="row wrap" style="gap:10px;align-items:flex-end"><label class="f grow">Date<input class="t" data-md="due" type="date" required value="${esc(m.due)}"></label><label class="f grow">Time<input class="t" data-md="time" type="time" required value="${esc(m.time)}"></label></div>
    <label class="f">Where<input class="t" data-md="location" value="${esc(m.location)}" placeholder="Optional, e.g. Buddy Brew on Kennedy"></label>
    ${withSel("With")}
    <div class="stack" id="md-bring">${bringHtml()}</div>
    <div class="stack" id="md-rem">${remsHtml()}</div>`;
  const edit = m.mode === "edit";
  openSheet(`<form class="stack" data-form="tsheet" autocomplete="off">
    ${head}
    ${meet ? meetFields : taskFields}
    ${edit && !m.done && who ? `<div class="card row spread"><div><b>How did it go?</b><div class="small muted">Mark it done and log it in ${esc(first(who.name))}'s history.</div></div><button type="button" class="pill-btn" data-act="md-done">Log it</button></div>` : ""}
    ${edit ? `<div class="card stack" id="md-del" hidden><div>Delete this meetup and its reminders? This can't be undone.</div><div class="row"><button type="button" class="btn small" style="background:var(--warn)" data-act="tdel-yes">Delete</button><button type="button" class="btn small ghost" data-act="md-del-no">Keep it</button></div></div>` : ""}
    <div class="row wrap"><button class="btn">${m.mode === "add" ? "Add" : "Save"}</button><button type="button" class="btn ghost" data-act="close-sheet">Cancel</button>${edit ? `<button type="button" class="linkbtn danger" data-act="md-del-ask" style="margin-left:auto">Delete meetup</button>` : ""}</div>
  </form>`);
}
function bringHtml(){
  return `<span class="f">Things to bring up</span>
    ${md.bringUp.map(b => `<div class="row bring"><input class="t" data-bring="${esc(b.id)}" value="${esc(b.text)}" placeholder="e.g. Ask how his dad's surgery went"><button type="button" class="iconbtn-sm" data-bring-del="${esc(b.id)}" aria-label="Remove">${ICON_TRASH}</button></div>`).join("")}
    <div><button type="button" class="linkbtn" data-act="bring-add">+ Add something to bring up</button></div>`;
}
function remsHtml(){
  const m = md; const now = new Date(); const ready = m.due && m.time;
  const row = r => {
    const past = toDT(r.date, r.time) <= now;
    if (m.openRem === r.id) return `<div class="rem open">
      <div class="row wrap" style="gap:8px;align-items:flex-end"><label class="f grow">${esc(REM_LABEL[r.type] || "Reminder")} date<input class="t" type="date" data-rem-date="${esc(r.id)}" value="${esc(r.date)}"></label><label class="f grow">Time<input class="t" type="time" data-rem-time="${esc(r.id)}" value="${esc(r.time)}"></label></div>
      <div class="row"><button type="button" class="btn small ghost" data-act="rem-close">Done</button><button type="button" class="iconbtn-sm" data-rem-del="${esc(r.id)}" aria-label="Delete reminder" style="margin-left:auto">${ICON_TRASH}</button></div></div>`;
    return `<div class="rem${past ? " past" : ""}"><button type="button" class="rem-main" data-rem-open="${esc(r.id)}"><span>${esc(fmtRem(r))}</span> <span class="meta">· ${esc(REM_LABEL[r.type] || "Reminder")}${past ? (m.mode === "edit" ? " · sent" : " · already past") : ""}</span></button><button type="button" class="iconbtn-sm" data-rem-del="${esc(r.id)}" aria-label="Delete reminder">${ICON_TRASH}</button></div>`;
  };
  return `<div class="row spread"><span class="f">Reminders</span>${ready ? `<span class="hint">Tap one to change it</span>` : ""}</div>
    ${!ready ? `<p class="small muted" style="margin:0">Pick a date and time and Tend will suggest reminders.</p>`
      : m.reminders.length ? `<div class="rems">${m.reminders.map(row).join("")}</div>` : `<p class="small muted" style="margin:0">No reminders for this meetup.</p>`}
    ${m.moved ? `<div class="banner info"><div class="grow"><div><b>Reminders moved with your meetup.</b> ${esc(m.moved)}</div></div></div>` : ""}
    ${!S.settings.notify && ready && m.reminders.length ? `<span class="hint">Turn on Notifications (gear button) to get these on your phone.</span>` : ""}
    ${ready ? `<div class="row wrap"><button type="button" class="linkbtn" data-act="rem-add">+ Add reminder</button><button type="button" class="linkbtn muted" data-act="rem-restore">Restore defaults</button></div>` : ""}`;
}
const renderRems = () => { const el = $("#md-rem"); if (el) el.innerHTML = remsHtml(); };
const renderBring = () => { const el = $("#md-bring"); if (el) el.innerHTML = bringHtml(); };
const movedText = list => list.length ? "New times: " + list.map(r => fmtRem(r) + " (" + (REM_LABEL[r.type] || "Reminder") + ")").join(", ") + "." : "The new time leaves no reminders ahead of it.";
// date or time changed on a meetup draft
function whenChanged(prev){
  const m = md; m.moved = null;
  if (m.due && m.time){
    const had = prev.due && prev.time;
    if (m.mode !== "edit" && !m.touched) m.reminders = defaultReminders(m.due, m.time);
    else if (had){ m.reminders = shiftReminders(m.reminders, prev, m); m.moved = movedText(m.reminders); m.movedAny = true; }
  }
  renderRems();
}
function saveMeetup(){
  const m = md; const owner = m.withPid || null;
  let t;
  if (m.id){
    const ref = taskRef(m.pid, m.id); t = ref.t; if (!t){ closeSheet(); return; }
    if ((m.pid || null) !== owner){
      if (m.pid){ const q = S.people.get(m.pid); q.tasks = (q.tasks||[]).filter(x => x.id !== t.id); savePerson(q); } else { S.meta.tasks = S.meta.tasks.filter(x => x.id !== t.id); saveMeta(); }
    }
  } else t = { id: uid("t"), done:false, doneAt:null };
  Object.assign(t, { kind:"meetup", title: m.title.trim(), due: m.due, time: m.time, location: m.location.trim(),
    bringUp: m.bringUp.filter(b => b.text.trim()).map(b => ({ id:b.id, text:b.text.trim() })),
    reminders: sortRems(m.reminders.map(({ id, type, date, time }) => ({ id, type, date, time }))) });
  delete t.remindAt;
  if (t.done === undefined) t.done = false;
  const list = owner ? (S.people.get(owner).tasks ||= []) : S.meta.tasks;
  if (!list.includes(t)) list.push(t);
  if (owner) savePerson(S.people.get(owner)); else saveMeta();
  const mode = m.mode, moved = m.movedAny;
  md = null; editing = null; closeSheet(); render();
  if (mode === "edit" && moved) toast("Reminders moved with your meetup. " + movedText(t.reminders), 6000);
  else if (mode === "edit") toast("Meetup saved");
  else if (!t.reminders.length) toast("Meetup added");
  else toast(S.settings.notify ? "Meetup added. Reminders: " + t.reminders.map(fmtRem).join(", ") + "." : "Meetup added. Turn on Notifications (gear button) to get its reminders.", 4500);
}
// After a meetup is marked done: make it easy to log how it went.
function afterMeetupDone(pid, t){
  const p = pid ? S.people.get(pid) : null;
  if (!p){ toast("Done. Well done."); return; }
  S.meetLog = { pid, due: t.due };
  openSheet(`<div class="stack"><h2>How did it go?</h2><p class="muted" style="margin:0">${esc(t.title)} · ${esc(fmtDay(t.due))}</p>
    <p class="small muted" style="margin:0">Jot down what ${esc(first(p.name))} shared while it's fresh. It goes in their history.</p>
    <div class="row wrap"><button class="btn" data-act="md-log">Log the conversation</button><button class="btn ghost" data-act="close-sheet">Later</button></div></div>`);
}
function editTaskSheet(pid, id, confirmDelete){
  const { t } = taskRef(pid, id); if (!t) return;
  if (isMeetup(t)){ openMeetup(pid, id); return; }
  editing = { pid, id }; md = null;
  const who = pid ? S.people.get(pid) : null;
  openSheet(`<form class="stack" data-form="tedit">
    <h2>Edit task</h2>
    ${who ? `<p class="small muted" style="margin:0">For ${esc(who.name)}</p>` : ""}
    <label class="f">Task<input class="t" id="te-title" required value="${esc(t.title)}"></label>
    <div class="row wrap" style="gap:10px;align-items:flex-end"><label class="f grow">Day<input class="t" id="te-due" type="date" value="${esc(t.due||"")}"></label><label class="f grow">Remind me at<input class="t" id="te-time" type="time" value="${esc(t.remindAt||"")}"></label></div>
    <span class="hint">Clear the time to turn off the phone reminder.</span>
    ${t.done ? "" : `<div><button type="button" class="linkbtn" data-act="to-meetup">${ICON_CAL} Make this a meetup</button></div>`}
    ${confirmDelete ? `<div class="card stack"><div>Delete this task? This can't be undone.</div><div class="row"><button type="button" class="btn small" style="background:var(--warn)" data-act="tdel-yes">Delete</button><button type="button" class="btn small ghost" data-act="tdel-no">Keep it</button></div></div>` : ""}
    <div class="row wrap"><button class="btn">Save</button><button type="button" class="btn ghost" data-act="close-sheet">Cancel</button><button type="button" class="linkbtn danger" data-act="tdel-ask" style="margin-left:auto">Delete task</button></div>
  </form>`);
}
function quietSheet(){
  openSheet(`<div class="stack"><h2>Quiet mode</h2><p class="muted" style="margin:0">Pause next-step reminders. Your people and prayers stay right where they are.</p>
    <div class="stack"><button class="btn ghost" data-quiet="1">Rest of today</button><button class="btn ghost" data-quiet="7">One week</button><button class="btn ghost" data-quiet="on">Until I turn it off</button>
    ${isQuiet()?`<button class="btn" data-act="quiet-off">Turn off quiet mode</button>`:""}</div></div>`);
}

/* ---------- actions ---------- */
function toast(msg, ms){ const r = $("#toast-root"); r.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(()=>{ r.innerHTML=""; }, ms || 2600); }
function cur(){ return S.people.get(S.ui.personId); }
function go(tab){ S.ui.tab = tab; S.ui.personId = null; S.ui.open = null; render(); window.scrollTo(0,0); }
function openPerson(id){ S.ui.personId = id; S.ui.open = null; S.ui.hist = "All"; closeSheet(); render(); window.scrollTo(0,0); }
function findTask(pid, tid){ const list = pid ? (S.people.get(pid)?.tasks||[]) : S.meta.tasks; return { list, t: list.find(x=>x.id===tid) }; }
function toggleTask(pid, tid){
  const { t } = findTask(pid, tid); if (!t) return;
  t.done = !t.done; t.doneAt = t.done ? today() : null;
  if (pid) savePerson(S.people.get(pid)); else saveMeta();
  render();
  if (isMeetup(t) && t.done) afterMeetupDone(pid, t);
  else if (arguments[2] !== false && t.done) toast("Done. Well done.");
}
function newPerson(name){
  if (S.meta.hideExamples === undefined) S.meta.hideExamples = false;
  return { id: uid("p"), kind:"person", name, howMet:"", relationship:"", note:"", stage:0, focus:false, metOn: today(),
    faith:"", family:"", job:"", interests:"", phone:"", email:"", dates:[], logs:[], prayers:[], prayed:[], tasks:[], stageHistory:[{stage:0, at: today()}], createdAt: Date.now() };
}

document.addEventListener("click", async e => {
  const el = e.target.closest("button, .scrim, summary"); if (!el) return;
  const d = el.dataset;
  if (el.classList.contains("scrim") && e.target === el){ closeSheet(); return; }
  if (d.tab){ go(d.tab); return; }
  if (d.tabGo){ go(d.tabGo); return; }
  if (el.id === "fab"){ addSheet(); return; }
  if (d.circle){ S.ui.circle = d.circle; S.ui.stageFilter = "All"; render(); return; }
  if (d.addCircle){ const nm = $("#ad-name")?.value || ""; const nt = $("#ad-note")?.value || ""; addSheet(d.addCircle); $("#ad-name").value = nm; $("#ad-note").value = nt; return; }
  if (d.open){ openPerson(d.open); return; }
  if (d.filter){ S.ui.stageFilter = d.filter; render(); return; }
  if (d.prayed){ const p = S.people.get(d.prayed); p.prayed ||= []; const t = today(); if (p.prayed.includes(t)) p.prayed = p.prayed.filter(x=>x!==t); else { p.prayed.push(t); p.prayed = p.prayed.slice(-60); } savePerson(p); render(); return; }
  if (d.doneTask){ toggleTask(d.pid || null, d.doneTask); return; }
  if (d.toggleTask){ const pid = d.pid !== undefined ? (d.pid || null) : S.ui.personId; toggleTask(pid, d.toggleTask); return; }
  if (d.hist){ S.ui.hist = d.hist; render(); return; }
  if (d.wday){ S.ui.weekDay = S.ui.weekDay === d.wday ? null : d.wday; render(); return; }
  if (d.quicklog){ const p = cur(); if (!p) return; logQuick(p, d.quicklog); return; }
  if (d.noteLog){ noteSheet(d.noteLog); return; }
  if (d.editLog){ editLogSheet(d.editLog); return; }
  if (d.editPrayer){ editPrayerSheet(d.pid, d.editPrayer); return; }
  if (d.editTask){ editTaskSheet(d.pid || null, d.editTask); return; }
  if (d.delTask){ const p = cur(); p.tasks = p.tasks.filter(t=>t.id!==d.delTask); savePerson(p); render(); return; }
  if (d.delDate){ const p = cur(); p.dates = p.dates.filter(t=>t.id!==d.delDate); savePerson(p); render(); return; }
  if (d.stage !== undefined && isFam(cur())){ const p = cur(); const s = +d.stage; if (s !== depthOf(p)){ p.depth = s; (p.depthHistory ||= []).push({depth:s, at:today()}); savePerson(p); toast(DEPTHS[s]); render(); } return; }
  if (d.stage !== undefined){ const p = cur(); const s = +d.stage; if (s !== p.stage){ p.stage = s; (p.stageHistory ||= []).push({stage:s, at:today()}); savePerson(p); toast("Stage: " + STAGES[s]); render(); } return; }
  if (d.suggest){ const p = cur(); (p.tasks ||= []).push({id:uid("t"), title:d.suggest, due:addDays(today(),7), done:false}); savePerson(p); toast("Added for this week"); render(); return; }
  if (d.answer){ const p = cur(); const r = p.prayers.find(x=>x.id===d.answer); r.answeredAt = today(); savePerson(p); toast("Praise God. Added to Answered."); render(); return; }
  if (d.copy){ try { await navigator.clipboard.writeText(d.copy); toast("Copied"); } catch(_){ toast("Select the text to copy it"); } return; }
  if (d.how){ addDraft.how = addDraft.how === d.how ? "" : d.how; el.closest(".chips").querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.how === addDraft.how)); return; }
  if (d.logtype){ el.closest(".chips").querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c === el)); return; }
  if (d.quickStep){ const [title, n] = d.quickStep.split("|"); const p = S.people.get(S.lastAdded); if (p){ (p.tasks ||= []).push({id:uid("t"), title, due:addDays(today(),+n), done:false}); savePerson(p); toast("Next step added"); el.setAttribute("aria-pressed","true"); el.disabled = true; } return; }
  if (d.quiet){ S.meta.quietUntil = d.quiet === "on" ? "on" : addDays(today(), +d.quiet - 1); saveMeta(); closeSheet(); toast("Quiet mode on"); render(); return; }
  if (d.submit){ el.form.dataset.mode = d.submit; return; }
  if (d.tkind && md){ md.kind = d.tkind; taskSheet(); return; }
  if (d.bringDel && md){ md.bringUp = md.bringUp.filter(b => b.id !== d.bringDel); renderBring(); return; }
  if (d.remOpen && md){ md.openRem = d.remOpen; renderRems(); $(`[data-rem-time="${d.remOpen}"]`)?.focus(); return; }
  if (d.remDel && md){ md.reminders = md.reminders.filter(r => r.id !== d.remDel); md.touched = true; if (md.openRem === d.remDel) md.openRem = null; renderRems(); return; }
  if (S.tw && d.act && d.act.startsWith("tw-") && twClick(d.act, d, el)) return;

  switch (d.act){
    case "back": S.ui.personId = null; S.ui.open = null; render(); break;
    case "close": S.ui.open = null; render(); break;
    case "close-sheet": closeSheet(); render(); break;
    case "open-log": S.ui.open = "log"; S.ui.logDate = null; render(); $("#lg-shared")?.focus(); break;
    case "open-task": addTaskSheet({ pid: cur()?.id }); break;
    case "open-meetup": addTaskSheet({ pid: cur()?.id, kind:"meetup" }); break;
    case "open-gmeetup": addTaskSheet({ kind:"meetup" }); break;
    case "to-meetup": if (editing) openMeetup(editing.pid, editing.id, true); break;
    case "md-done": { if (!md || !md.id) break; const { pid, id } = md; md = null; editing = null; closeSheet(); toggleTask(pid, id); break; }
    case "md-log": { const ml = S.meetLog; closeSheet(); if (!ml) break; openPerson(ml.pid); S.ui.open = "log"; S.ui.logDate = ml.due && ml.due <= today() ? ml.due : today(); render(); $("#lg-shared")?.focus(); S.meetLog = null; break; }
    case "md-del-ask": { const b = $("#md-del"); if (b){ b.hidden = false; b.scrollIntoView({ block:"nearest" }); } break; }
    case "md-del-no": { const b = $("#md-del"); if (b) b.hidden = true; break; }
    case "bring-add": { if (!md) break; md.bringUp.push({ id: uid("b"), text:"" }); renderBring(); const ins = document.querySelectorAll("[data-bring]"); ins[ins.length-1]?.focus(); break; }
    case "rem-close": if (md){ md.openRem = null; sortRems(md.reminders); renderRems(); } break;
    case "rem-restore": if (md && md.due && md.time){ md.reminders = defaultReminders(md.due, md.time); md.openRem = null; md.moved = null; md.touched = md.mode === "edit"; renderRems(); toast(md.reminders.length ? "Default reminders restored" : "All the default times have already passed"); } break;
    case "rem-add": { if (!md || !md.due || !md.time) break;
      const r = { id: uid("rm"), type:"custom", ...fromDT(addMin(toDT(md.due, md.time), -60)) };
      md.reminders.push(r); md.openRem = r.id; md.touched = true; renderRems(); $(`[data-rem-time="${r.id}"]`)?.focus(); break; }
    case "open-prayer": S.ui.open = "prayer"; render(); $("#pr-text")?.focus(); break;
    case "open-date": S.ui.open = "date"; render(); $("#dt-label")?.focus(); break;
    case "open-edit": S.ui.open = "edit"; render(); break;
    case "add-phone": S.ui.open = "edit"; render(); { const ph = $("#ed-phone"); if (ph){ ph.scrollIntoView({ block:"center" }); ph.focus(); } } break;
    case "contact-yes": { const c = S.contactAsk; S.contactAsk = null; closeSheet(); const p = c && S.people.get(c.pid); if (p) logQuick(p, c.type); break; }
    case "contact-no": S.contactAsk = null; closeSheet(); break;
    case "cal-create": case "cal-new-yes":
      el.disabled = true;
      try { await newCalToken(); $("#set-cal").innerHTML = "<h3>Calendar</h3>" + calSection(); toast(d.act === "cal-create" ? "Your calendar link is ready" : "New link made. The old one no longer works."); }
      catch(e){ console.warn(e); el.disabled = false; toast("Couldn't make the link. Check your connection and try again."); }
      break;
    case "cal-new-ask": $("#cal-new").innerHTML = calNewHtml(true); break;
    case "cal-new-no": $("#cal-new").innerHTML = calNewHtml(false); break;
    case "open-gtask": addTaskSheet({}); break;
    case "plan-day": addTaskSheet({ due: d.day }); break;
    case "delete": S.ui.open = "delete"; render(); break;
    case "delete-yes": { const p = cur(); deletePerson(p.id); S.ui.personId = null; S.ui.open = null; toast(p.name + " removed"); render(); break; }
    case "focus": { const p = cur(); if (!p.focus && focusPeople().length >= 5){ toast("Focus 5 is full. Unstar someone first."); break; } p.focus = !p.focus; savePerson(p); render(); break; }
    case "add-focus": { const p = S.people.get(S.lastAdded); if (p && focusPeople().length < 5){ p.focus = true; savePerson(p); el.classList.add("on"); el.textContent = "★ Added"; el.disabled = true; } break; }
    case "open-new": openPerson(S.lastAdded); break;
    case "move-circle": { const p = cur(); if (!p) break;
      if (isFam(p)){ p.circle = "reach"; toast(first(p.name) + " moved to Reaching"); }
      else { p.circle = "family"; if (p.depth === undefined) p.depth = (p.stage||0) >= 4 ? 3 : 1; (p.circleHistory ||= []).push({ circle:"family", at:today() }); toast("Welcome to the family, " + first(p.name) + "!"); }
      S.ui.circle = p.circle; S.ui.stageFilter = "All"; savePerson(p); render(); window.scrollTo(0,0); break; }
    case "hide-examples": S.meta.hideExamples = true; saveMeta(); render(); break;
    case "tw-start": twOpen(); break;
    case "tw-close": twClose(); break;
    case "tw-next": if (S.tw) twNext(); break;
    case "tw-back": if (S.tw) twBack(); break;
    case "tw-carry": { const p = twPlan(); if (!p) break; const c = p.carry.find(x => x.taskId === d.twTask);
      if (c && c.choice === d.twK) p.carry = p.carry.filter(x => x !== c);
      else if (c){ c.choice = d.twK; if (d.twK === "resched" && !c.day) c.day = twOpenDays()[0]; }
      else p.carry.push({ taskId: d.twTask, personId: d.twPid || null, choice: d.twK, day: d.twK === "resched" ? twOpenDays()[0] : undefined });
      twSave(); render(); break; }
    case "quiet": quietSheet(); break;
    case "quiet-off": S.meta.quietUntil = null; saveMeta(); closeSheet(); toast("Quiet mode off"); render(); break;
    case "ai-fill": aiFill(el); break;
    case "settings": settingsSheet(); break;
    case "toggle-notify": {
      el.disabled = true;
      if (S.settings.notify){ await disableNotifications(); toast("Notifications off"); }
      else if (await enableNotifications()) toast("Notifications on");
      settingsSheet(); break; }
    case "test-push": sendTest(el); break;
    case "dismiss-toast": $("#toast-root").innerHTML = ""; break;
    case "tdel-ask": if (editing) editTaskSheet(editing.pid, editing.id, true); break;
    case "tdel-no": if (editing) editTaskSheet(editing.pid, editing.id, false); break;
    case "tdel-yes": { if (!editing) break; const { pid, id } = editing;
      if (pid){ const q = S.people.get(pid); q.tasks = (q.tasks||[]).filter(x => x.id !== id); savePerson(q); } else { S.meta.tasks = S.meta.tasks.filter(x => x.id !== id); saveMeta(); }
      const wasMeetup = !!md; editing = null; md = null; closeSheet(); toast(wasMeetup ? "Meetup deleted" : "Task deleted"); render(); break; }
    case "nudge-on": {
      if (!pushSupported()){ settingsSheet(); break; }
      el.disabled = true;
      if (await enableNotifications()){ toast("Notifications on. You'll get reminders at the times you set."); el.textContent = "On ✓"; render(); } else el.disabled = false;
      break; }
    case "nudge-off": S.meta.nudgeOff = true; saveMeta(); render(); break;
    case "pdel-ask": if (S.editPrayer) editPrayerSheet(S.editPrayer.pid, S.editPrayer.id, true); break;
    case "pdel-no": if (S.editPrayer) editPrayerSheet(S.editPrayer.pid, S.editPrayer.id, false); break;
    case "pdel-yes": { const ep = S.editPrayer; const q = ep && S.people.get(ep.pid); if (q){ q.prayers = (q.prayers||[]).filter(x => x.id !== ep.id); savePerson(q); } S.editPrayer = null; closeSheet(); toast("Prayer need deleted"); render(); break; }
    case "ldel-ask": if (S.editLog) editLogSheet(S.editLog, true); break;
    case "ldel-no": if (S.editLog) editLogSheet(S.editLog, false); break;
    case "ldel-yes": { const p = cur(); if (p && S.editLog){ p.logs = (p.logs||[]).filter(x => x.id !== S.editLog); savePerson(p); } S.editLog = null; closeSheet(); toast("Entry deleted"); render(); break; }
    case "toggle-daily": S.meta.dailySummary = S.meta.dailySummary === false; saveMeta(); settingsSheet(); break;
    case "export": exportData(); break;
    case "signout": await sb.auth.signOut(); USER = null; S.cal = null; S.people = new Map(); S.mode = "signin"; S.signin = { step:"signin" }; closeSheet(); render(); break;
    case "signin-toggle": S.signin = { step: S.signin.step === "create" ? "signin" : "create", email: ($("#si-email")?.value || S.signin.email || "") }; render(); break;
    case "ai-question": aiQuestion(el); break;
  }
});

document.addEventListener("change", e => {
  const el = e.target; const d = el.dataset;
  if (el.id === "set-time" && el.value){ S.settings.time = el.value; S.settings.tz = Intl.DateTimeFormat().resolvedOptions().timeZone; saveMeta(); toast("Reminder time set to " + el.value); }
  if (/^set-(prep|morning|follow)$/.test(el.id)){
    const md0 = meetupDefaults(); const val = el.value;
    if (el.id === "set-prep" && val) md0.prepTime = val;
    if (el.id === "set-morning" && val) md0.morningTime = val;
    if (el.id === "set-follow"){ const h = Math.min(48, Math.max(1, Math.round(+val || 6))); md0.followupHours = h; el.value = h; }
    S.meta.meetupDefaults = md0; saveMeta(); toast("Saved. Applies to new meetups and Restore defaults.");
  }
  if (S.tw && twChange(el)) return;
  if (!md) return;
  if (d.md === "due" || d.md === "time"){ const prev = { due: md.due, time: md.time }; md[d.md] = el.value; if (md.kind === "meetup") whenChanged(prev); }
  else if (d.md === "withPid"){ md.withPid = el.value || null; }
  else if (d.md){ md[d.md] = el.value; }
  if (d.remDate || d.remTime){ const r = md.reminders.find(x => x.id === (d.remDate || d.remTime)); if (r && el.value){ if (d.remDate) r.date = el.value; else r.time = el.value; md.touched = true; } }
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.bring !== undefined && md){ e.preventDefault(); $('[data-act="bring-add"]')?.click(); }
});
document.addEventListener("input", e => {
  const d = e.target.dataset;
  if (S.tw) twInput(e.target);
  if (md && (d.md === "title" || d.md === "location" || d.md === "remindAt")) md[d.md] = e.target.value;
  if (md && d.bring){ const b = md.bringUp.find(x => x.id === d.bring); if (b) b.text = e.target.value; }
  if (e.target.id === "people-q"){ S.ui.q = e.target.value; const pos = e.target.selectionStart; render(); const i = $("#people-q"); i.focus(); try { i.setSelectionRange(pos,pos); } catch(_){} }
});

document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target; const kind = f.dataset.form; const v = id => ($("#"+id)?.value || "").trim();
  if (kind === "auth"){ const em = v("si-email"), pw = $("#si-pass").value; if (em && pw) doAuth(em, pw); return; }
  if (kind === "tw-newp"){ const name = v("tw-newname"); if (name && S.tw) twAddNewPerson(name); return; }
  if (kind === "add"){
    const name = v("ad-name"); if (!name) return;
    const dupBox = $("#dup");
    if (!f.dataset.dupOk){
      const key = first(name).toLowerCase();
      const match = realPeople().find(p => first(p.name).toLowerCase() === key);
      if (match){ f.dataset.dupOk = "1"; dupBox.innerHTML = `<div class="banner info"><div class="grow"><div><b>You already have ${esc(match.name)}.</b> Same person?</div><div class="row"><button type="button" class="btn small ghost" data-open="${esc(match.id)}">Open ${esc(first(match.name))}</button><span class="small muted">or tap Save again to add someone new</span></div></div></div>`; return; }
    }
    const p = newPerson(name);
    p.howMet = addDraft.how; p.note = v("ad-note");
    if (addDraft.circle === "family"){ p.circle = "family"; p.depth = 0; if (S.ui.tab === "people") S.ui.circle = "family"; }
    if (addDraft.ai){ const a = addDraft.ai; if (a.prayer) p.prayers.push({id:uid("r"), text:a.prayer, at:today(), answeredAt:null}); if (a.task) p.tasks.push({id:uid("t"), title:a.task, due:addDays(today(), 3), done:false}); if (a.interests) p.interests = a.interests; if (a.family) p.family = a.family; }
    if (S.examples){ for (const [id,x] of S.people) if (x.example) S.people.delete(id); }
    savePerson(p);
    if (f.dataset.mode === "another"){ toast(first(name) + " added"); render(); addSheet(addDraft.circle); }
    else { afterAddSheet(p); render(); }
    return;
  }
  if (kind === "tsheet"){
    if (!md) return;
    if (md.kind === "meetup"){ saveMeetup(); return; }
    const tm = md.remindAt; const t = { id:uid("t"), title: md.title.trim(), due: md.due || (tm ? today() : null), remindAt: tm || null, done:false };
    if (md.withPid){ const q = S.people.get(md.withPid); (q.tasks ||= []).push(t); savePerson(q); } else { S.meta.tasks.push(t); saveMeta(); }
    md = null; closeSheet(); render(); remindNote(tm, t.due);
    return;
  }
  const p = cur();
  if (kind === "log"){
    S.ui.logDate = null;
    const type = f.querySelector('[data-logtype][aria-pressed="true"]')?.dataset.logtype || "In person";
    const entry = { id:uid("l"), at: v("lg-date") || today(), type, shared:v("lg-shared"), cares:v("lg-cares"), questions:v("lg-q") };
    (p.logs ||= []).push(entry);
    const pr = v("lg-prayer"); if (pr) (p.prayers ||= []).push({id:uid("r"), text:pr, at:entry.at, answeredAt:null});
    savePerson(p); S.ui.open = null; toast("Conversation saved"); render();
  } else if (kind === "prayer"){
    (p.prayers ||= []).push({id:uid("r"), text:v("pr-text"), at:today(), answeredAt:null}); savePerson(p); S.ui.open = null; render();
  } else if (kind === "date"){
    (p.dates ||= []).push({id:uid("d"), label:v("dt-label"), date:v("dt-date"), yearly: $("#dt-yearly").checked}); savePerson(p); S.ui.open = null; render();
  } else if (kind === "edit"){
    Object.assign(p, { name:v("ed-name")||p.name, note:v("ed-note"), howMet:v("ed-how"), relationship:v("ed-rel"), family:v("ed-family"), job:v("ed-job"), interests:v("ed-int"), faith: $("#ed-faith") ? v("ed-faith") : p.faith, phone:v("ed-phone"), email:v("ed-email") });
    savePerson(p); S.ui.open = null; toast("Saved"); render();
  } else if (kind === "predit"){
    const ep = S.editPrayer; const q = ep && S.people.get(ep.pid); const r = q && (q.prayers||[]).find(x => x.id === ep.id);
    if (r){ r.text = v("pe-text") || r.text; r.at = v("pe-at") || r.at; r.answeredAt = $("#pe-answered").checked ? (v("pe-ans") || today()) : null; savePerson(q); }
    S.editPrayer = null; closeSheet(); toast("Prayer need updated"); render();
  } else if (kind === "logedit"){
    const l = (p?.logs||[]).find(x => x.id === S.editLog);
    if (l){ l.type = v("le-type") || l.type; l.at = v("le-date") || l.at; l.shared = v("le-shared"); l.cares = v("le-cares"); l.questions = v("le-q"); savePerson(p); }
    S.editLog = null; closeSheet(); toast("Entry updated"); render();
  } else if (kind === "lognote"){
    const l = (p?.logs||[]).find(x => x.id === S.noteLog); if (l){ l.shared = v("ln-text"); savePerson(p); }
    closeSheet(); toast("Note saved"); render();
  } else if (kind === "tedit"){
    if (!editing) return;
    const { t } = taskRef(editing.pid, editing.id); if (!t) { closeSheet(); return; }
    const tm = v("te-time"); const oldKey = (t.due||"") + (t.remindAt||"");
    t.title = v("te-title") || t.title; t.due = v("te-due") || (tm ? today() : null); t.remindAt = tm || null;
    if (editing.pid) savePerson(S.people.get(editing.pid)); else saveMeta();
    closeSheet(); render();
    if (tm && (t.due||"") + tm !== oldKey) remindNote(tm, t.due); else toast("Task updated");
    editing = null;
  }
});

/* ---------- Claude-assisted ---------- */
function aiErr(e){
  const c = e && e.code;
  if (c === "not_granted" || c === "sampling_disabled" || c === "not_declared" || c === "capability_disabled" || c === "capability_removed"){ S.ai = null; return "Claude isn't available here. Fill it in by hand."; }
  if (c === "rate_limited") return "Too many requests right now. Try again in a minute.";
  if (c === "invalid_json") return "Couldn't read that one. Try again.";
  if (c === "cancelled") return "";
  return "Something went wrong reaching Claude. Try again.";
}
async function aiFill(btn){
  const text = ($("#ad-voice")?.value || "").trim(); const st = $("#ai-status");
  if (!text){ st.textContent = "Type or dictate a sentence or two first."; return; }
  btn.disabled = true; st.textContent = "Thinking…";
  try {
    const r = await S.ai.json(
      `A Christian is keeping a private, caring record of a person they met and hope to share their faith with. From the note below, pull out details. Reply with only JSON: {"name": string, "howMet": one of ${JSON.stringify(HOW_MET)} or "", "note": string (1-2 warm, factual sentences about the person), "family": string or "", "interests": string or "", "prayer": string or "" (a prayer need if one is mentioned), "task": string or "" (one gentle next step, e.g. "Text Carlos to ask how he's holding up")}.\n\nNote:\n${text.slice(0,3000)}`,
      { modelTier: "quick" });
    if (r && typeof r === "object"){
      if (r.name) $("#ad-name").value = String(r.name);
      if (r.note) $("#ad-note").value = String(r.note);
      if (r.howMet && HOW_MET.includes(r.howMet)){ addDraft.how = r.howMet; document.querySelectorAll("[data-how]").forEach(c => c.setAttribute("aria-pressed", c.dataset.how === r.howMet)); }
      addDraft.ai = { prayer: r.prayer ? String(r.prayer) : "", task: r.task ? String(r.task) : "", family: r.family ? String(r.family) : "", interests: r.interests ? String(r.interests) : "" };
      const bits = [addDraft.ai.prayer && `Prayer need: ${addDraft.ai.prayer}`, addDraft.ai.task && `Next step: ${addDraft.ai.task}`, addDraft.ai.family && `Family: ${addDraft.ai.family}`, addDraft.ai.interests && `Interests: ${addDraft.ai.interests}`].filter(Boolean);
      $("#ai-extra").innerHTML = bits.length ? `<div class="card small stack"><b>Also saving</b>${bits.map(b=>`<div>${esc(b)}</div>`).join("")}<div><button type="button" class="linkbtn muted" data-act="ai-clear">Don't save these</button></div></div>` : "";
      st.textContent = "Filled in. Check it, then save.";
    }
  } catch(e){ st.textContent = aiErr(e); }
  btn.disabled = false;
}
document.addEventListener("click", e => { if (e.target.closest('[data-act="ai-clear"]')){ addDraft.ai = null; $("#ai-extra").innerHTML = ""; } });
async function aiQuestion(btn){
  const p = cur(); const box = $("#ask-idea"); btn.disabled = true; const prev = box.textContent; box.textContent = "Thinking…";
  const logs = (p.logs||[]).slice(-5).map(l => `${l.at} ${l.type}: ${l.shared} ${l.cares?"Cares about: "+l.cares:""} ${l.questions?"Asked: "+l.questions:""}`).join("\n");
  try {
    const { text } = await S.ai(`Suggest ONE warm, natural question a Christian friend could ask this person next time they talk. It should show they listened, fit where the friendship is, and never feel pushy or scripted. Stage: ${STAGES[p.stage||0]}. Notes: ${p.note||""}. Interests: ${p.interests||""}. Recent conversations:\n${logs || "none"}\nOpen prayer needs: ${(p.prayers||[]).filter(r=>!r.answeredAt).map(r=>r.text).join("; ")||"none"}.\nReply with only the question in quotes.`, { modelTier:"quick", cache:false });
    box.textContent = text.trim();
  } catch(e){ box.textContent = prev; toast(aiErr(e) || "Stopped"); }
  btn.disabled = false;
}

boot();
})();
