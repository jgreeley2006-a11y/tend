
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

/* ---------- state ---------- */
const S = {
  people: new Map(),       // id -> person
  meta: { kind:"meta", tasks:[], quietUntil:null, reviewAt:null, hideExamples:false },
  settings: { notify:false, time:"07:30", tz:null },
  mode: "loading",         // loading | signin | db
  examples: false,
  ui: { tab:"today", personId:null, stageFilter:"All", q:"", open:null },
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
}
function verseToday(){
  const v = S.verses || []; if (!v.length) return null;
  const t = today(); const n = Math.floor((Date.UTC(+t.slice(0,4), +t.slice(5,7) - 1, +t.slice(8,10)) - Date.UTC(2026,0,1)) / 86400000);
  return v[((n % v.length) + v.length) % v.length];
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
    <section class="stack"><h3>Quiet mode</h3><p class="small muted" style="margin:0">Pause reminders for a day, a week, or until you turn it back on.</p><div><button class="btn small ghost" data-act="quiet">${isQuiet() ? "Quiet mode is on" : "Turn on quiet mode"}</button></div></section>
    <section class="stack"><h3>Your data</h3><p class="small muted" style="margin:0">Signed in as ${esc(USER?.email || "")}. Only you can see your list.</p>
      <div class="row wrap"><button class="btn small ghost" data-act="export">Download a copy</button><button class="btn small ghost" data-act="signout">Sign out</button></div></section>
    <div><button class="btn" data-act="close-sheet">Done</button></div>
  </div>`);
}
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
  const { tab, personId } = S.ui;
  if (personId && S.people.has(personId)) app.innerHTML = viewPerson(S.people.get(personId));
  else { S.ui.personId = null; app.innerHTML = tab === "people" ? viewPeople() : tab === "prayer" ? viewPrayer() : tab === "tasks" ? viewTasks() : viewToday(); }
  document.querySelectorAll(".nav button").forEach(b => { if (b.dataset.tab === tab && !S.ui.personId) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
}

function notifyNudge(){
  if (S.settings.notify || S.meta.nudgeOff || S.examples || realPeople().length === 0) return "";
  return `<div class="banner info"><div class="grow"><div><b>Get reminders on your phone.</b> Turn on notifications so Tend can remind you about follow-ups and next steps.</div><div class="row wrap"><button class="btn small" data-act="nudge-on">Turn on notifications</button><button class="linkbtn muted" data-act="nudge-off">Not now</button></div></div></div>`;
}
function exampleBanner(){
  if (!S.examples) return "";
  return `<div class="banner info"><div class="grow"><div><b>These are example people.</b> They show how Tend works and aren't saved to your account. Add your first person and they'll disappear.</div><div><button class="linkbtn" data-act="hide-examples">Hide examples</button></div></div></div>`;
}
function storageNote(){ return `<p class="sync" id="sync" role="status">${esc(S.syncMsg||"")}</p>`; }

function stageTag(p){ return `<span class="stage">${esc(STAGE_SHORT[p.stage||0])}</span>`; }
function nameLink(p){ return `<button class="who" data-open="${esc(p.id)}">${esc(p.name)}</button>`; }

/* Today */
function todaySteps(){
  const t = today(); const steps = [];
  const ppl = people(); const byId = new Map(ppl.map(p => [p.id, p]));
  allTasks().filter(x => !x.done && x.due && x.due <= t).sort((a,b)=>a.due.localeCompare(b.due)).forEach(x => {
    const p = x.personId ? byId.get(x.personId) : null;
    steps.push({ kind: x.due < t ? "Pick back up" : "Due today", title: x.title, person: p, task: x });
  });
  ppl.forEach(p => (p.dates||[]).forEach(d => { const n = nextDateOf(d); if (n){ const k = daysBetween(t, n); if (k >= 0 && k <= 7) steps.push({ kind: `${d.label} · ${fmtDay(n)}`, title: `Reach out to ${first(p.name)} before ${k===0?"the end of today":fmtDay(n)}`, person:p, moment:true }); } }));
  focusPeople().forEach(p => { const s = sinceContact(p); if (s === null || s >= 14) steps.push({ kind: s === null ? "No contact logged yet" : `Last contact ${s} days ago`, title: `Check in with ${first(p.name)}`, person:p, reconnect:true }); });
  return steps;
}
function viewToday(){
  const quiet = isQuiet();
  const steps = todaySteps();
  const shown = steps.slice(0,3);
  const focus = focusPeople();
  const ws = weekStart(); const t = today();
  let prayedN=0, convN=0, mealN=0, invN=0;
  people().forEach(p => {
    prayedN += (p.prayed||[]).filter(d => d>=ws && d<=t).length;
    (p.logs||[]).filter(l => l.at>=ws && l.at<=t).forEach(l => { convN++; if (l.type==="Meal"||l.type==="Served") mealN++; if (l.type==="Invited") invN++; });
  });
  const hello = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const isSun = new Date().getDay() === 0;
  return `
  <div class="top"><div><div class="date">${esc(new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}))}</div><h1>${hello}</h1></div>
    <div class="top-actions"><button class="iconbtn" data-act="quiet">${quiet ? "Quiet on" : "Quiet mode"}</button><button class="iconbtn gear" data-act="settings" aria-label="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></div></div>
  <div class="stack-lg">
    ${(v => v ? `<section class="verse"><div class="eyebrow">Today's verse</div><blockquote>${esc(v.text)}</blockquote><div class="row spread"><span class="vref">${esc(v.ref)} · KJV</span><button class="linkbtn" data-copy="${esc(v.text + " (" + v.ref + ", KJV)")}">Copy</button></div></section>` : "")(verseToday())}
    ${exampleBanner()}
    ${notifyNudge()}
    ${quiet ? `<div class="banner quiet"><div class="grow"><div><b>Quiet mode is on${S.meta.quietUntil!=="on" ? " until " + esc(fmtDay(S.meta.quietUntil)) : ""}.</b> Reminders are paused. Rest is part of faithfulness.</div><div><button class="linkbtn" data-act="quiet-off">Turn off quiet mode</button></div></div></div>` : ""}
    ${quiet ? "" : `<section>
      <div class="section-head"><h2>Next steps</h2>${steps.length>3?`<button class="linkbtn" data-tab-go="tasks">${steps.length-3} more</button>`:""}</div>
      <div class="card">${shown.length ? `<div class="steps">${shown.map((s,i) => `
        <div class="step">
          ${s.task ? `<button class="dot" aria-label="Mark done" data-done-task="${esc(s.task.id)}" data-pid="${esc(s.task.personId||"")}"></button>` : `<span class="dot" style="border-color:var(--gold)"></span>`}
          <div class="grow"><div class="kind">${esc(s.kind)}</div><div class="title">${esc(s.title)}</div>${s.person ? `<div class="small">${nameLink(s.person)}</div>`:""}</div>
        </div>`).join("")}</div>` : `<div class="empty">Nothing pressing today. Pray for your Focus 5 and enjoy the people God put around you.</div>`}</div>
    </section>`}
    <section>
      <div class="section-head"><h2>Pray today</h2><button class="linkbtn" data-tab-go="prayer">Prayer list</button></div>
      ${focus.length ? `<div class="pray-list">${focus.map(p => prayRow(p)).join("")}</div>` : `<div class="card empty">Star up to 5 people to pray for them here each day.</div>`}
    </section>
    <section>
      <div class="section-head"><h2>This week</h2><span class="small muted">Faithfulness, not results</span></div>
      <div class="tally"><div><b>${prayedN}</b><span>prayers</span></div><div><b>${convN}</b><span>conversations</span></div><div><b>${mealN}</b><span>meals &amp; service</span></div><div><b>${invN}</b><span>invites</span></div></div>
    </section>
    <section class="card stack">
      <div><h3>Weekly review</h3><p class="small muted" style="margin:4px 0 0">${isSun ? "It's Sunday. " : ""}Five minutes: who's been quiet, what God answered, and three steps for the week.${S.meta.reviewAt ? " Last done " + esc(fmtDate(S.meta.reviewAt)) + "." : ""}</p></div>
      <div><button class="btn small" data-act="review">Start review</button></div>
    </section>
    ${storageNote()}
  </div>`;
}
function prayRow(p){
  const needs = (p.prayers||[]).filter(r => !r.answeredAt).map(r => r.text).join(" · ");
  const done = (p.prayed||[]).includes(today());
  return `<div class="pray"><div class="avatar">${esc(initials(p.name))}</div><div class="grow"><div class="pname">${nameLink(p)}</div><div class="needs">${esc(needs || "No prayer needs yet")}</div></div>
    <button class="pill-btn ${done?"on":""}" data-prayed="${esc(p.id)}" aria-pressed="${done}">${done?"Prayed ✓":"Prayed"}</button></div>`;
}

/* People */
function viewPeople(){
  const q = S.ui.q.toLowerCase(); const f = S.ui.stageFilter;
  let list = people().filter(p => (f==="All" || (f==="Focus 5" ? p.focus : STAGES[p.stage||0]===f)) && (!q || JSON.stringify([p.name,p.note,p.howMet,p.relationship,p.job,p.interests]).toLowerCase().includes(q)));
  list.sort((a,b) => (b.focus?1:0)-(a.focus?1:0) || a.name.localeCompare(b.name));
  const filters = ["All","Focus 5",...STAGES];
  return `
  <div class="top"><div><div class="date">${people().length} ${people().length===1?"person":"people"}</div><h1>My People</h1></div></div>
  <div class="stack">
    ${exampleBanner()}
    <input class="search" id="people-q" type="search" placeholder="Search names, notes, interests" value="${esc(S.ui.q)}">
    <div class="chips" role="group" aria-label="Filter by stage">${filters.map(x => `<button class="chip" data-filter="${esc(x)}" aria-pressed="${x===f}">${esc(x)}</button>`).join("")}</div>
    ${list.length ? `<div class="plist">${list.map(p => { const s = sinceContact(p); return `
      <button class="pitem" data-open="${esc(p.id)}"><div class="avatar">${esc(initials(p.name))}</div>
        <div class="grow"><div class="pname">${esc(p.name)} ${p.focus?`<span class="star" aria-label="Focus 5">★</span>`:""} ${p.example?`<span class="ex">Example</span>`:""}</div>
        <div class="meta">${esc(p.howMet||"")}${p.howMet?" · ":""}${esc(lastContactLabel(p) || "No contact logged")}</div></div>${stageTag(p)}</button>`; }).join("")}</div>`
      : `<div class="card empty">${people().length ? "No one matches that search." : "No one here yet. Tap Add person after your next conversation."}</div>`}
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
    ? { sort:"0" + x.due, text:x.title, sub:"Overdue, was " + fmtDay(x.due), overdue:true }
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
  const g = groups[f] || null;
  const list = items.filter(i => !g || g.includes(i.kind)).sort((a,b) => b.sort.localeCompare(a.sort));
  const chips = Object.keys(groups).map(k => `<button class="chip" data-hist="${esc(k)}" aria-pressed="${k===f}">${esc(k)}</button>`).join("");
  const row = i => i.task
    ? `<div class="tl done-task"><div class="when">${esc(fmtDate(i.task.doneAt))} · Task done</div><p>${esc(i.task.title)}</p></div>`
    : `<div class="tl"><div class="when">${esc(fmtDate(i.log.at))} · ${esc(LOG_VERB[i.log.type] || i.log.type)}</div>${i.log.shared?`<p>${esc(i.log.shared)}</p>`:""}${i.log.cares?`<p><span class="lbl">Cares about:</span> ${esc(i.log.cares)}</p>`:""}${i.log.questions?`<p><span class="lbl">Asked:</span> ${esc(i.log.questions)}</p>`:""}${!i.log.shared && !i.log.cares && !i.log.questions && i.log.id ? `<button class="linkbtn" data-note-log="${esc(i.log.id)}">Add a note</button>` : ""}</div>`;
  return `<div class="chips" role="group" aria-label="Filter history">${chips}</div>` + (list.length
    ? `<div class="timeline">${list.map(row).join("")}</div>`
    : `<div class="card empty">${f === "All" ? "Tap Called, Texted, or Saw them after you reach out, or log a longer conversation." : "Nothing here yet."}</div>`);
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
      <div class="phead"><div class="avatar">${esc(initials(p.name))}</div>
        <div class="grow"><h1 style="font-size:26px">${esc(p.name)}</h1><div class="meta">${esc([p.howMet, p.relationship].filter(Boolean).join(" · "))}${s!==null?` · last contact ${s===0?"today":s+"d ago"}`:""}</div></div>
        <button class="pill-btn ${p.focus?"on":""}" data-act="focus" aria-pressed="${!!p.focus}" ${!p.focus && focusCount>=5 ? `title="Focus 5 is full"`:""}>${p.focus?"★ Focus 5":"☆ Focus 5"}</button></div>
      <div>
        <div class="row spread"><span class="stage-label">Stage: <b>${esc(STAGES[p.stage||0])}</b></span><span class="small muted">Tap to change</span></div>
        <div class="stagebar" role="group" aria-label="Journey stage">${STAGES.map((st,i)=>`<button class="${i<=(p.stage||0)?"done":""}" data-stage="${i}" aria-label="${esc(st)}" title="${esc(st)}"></button>`).join("")}</div>
      </div>
    </div>

    <section class="card stack glance">
      <div class="row spread"><h3>At a glance</h3>${s !== null && s >= 14 ? `<span class="nudge">No contact in ${s} days</span>` : ""}</div>
      <dl class="kv">
        <dt>Last call</dt><dd>${esc(agoFull(lastOf(p, ["Call"])))}</dd>
        <dt>Last text</dt><dd>${esc(agoFull(lastOf(p, ["Text"])))}</dd>
        <dt>In person</dt><dd>${esc(agoFull(lastOf(p, IN_PERSON)))}</dd>
        <dt>Coming up</dt><dd>${up.length ? up.map(i => `<div class="${i.overdue ? "danger" : ""}">${esc(i.text)} <span class="meta">· ${esc(i.sub)}</span></div>`).join("") : "Nothing scheduled"}</dd>
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
      <div class="section-head"><h2>Next steps</h2><button class="linkbtn" data-act="open-task">Add</button></div>
      ${o==="task" ? taskForm(p) : ""}
      <div class="chips wrap">${NEXT_BY_STAGE[p.stage||0].map(x=>`<button class="chip" data-suggest="${esc(x)}">+ ${esc(x)}</button>`).join("")}</div>
      ${tasks.length ? `<ul class="plain-list">${tasks.map(t=>`<li><button class="check ${t.done?"on":""}" data-toggle-task="${esc(t.id)}" aria-label="${t.done?"Mark not done":"Mark done"}">${t.done?"✓":""}</button><div class="grow"><button class="tasktitle ${t.done?"strike":""}" data-edit-task="${esc(t.id)}" data-pid="${esc(p.id)}">${esc(t.title)}</button>${t.due?`<div class="meta">${t.done?"Done":"Due "+esc(fmtDay(t.due))+(t.remindAt?" · Reminder "+esc(fmtTime(t.remindAt)):"")}</div>`:""}</div><button class="linkbtn muted" data-del-task="${esc(t.id)}" aria-label="Remove">✕</button></li>`).join("")}</ul>` : ""}
    </section>

    <section class="stack">
      <div class="section-head"><h2>Prayer</h2><button class="linkbtn" data-act="open-prayer">Add need</button></div>
      ${o==="prayer" ? `<form class="card stack" data-form="prayer"><label class="f">Prayer need<input class="t" id="pr-text" required placeholder="e.g. His dad's surgery on the 14th"></label><div class="row"><button class="btn small">Add</button><button type="button" class="btn small ghost" data-act="close">Cancel</button></div></form>` : ""}
      ${openPrayers.length || answered.length ? `<ul class="plain-list">${openPrayers.map(r=>`<li><span class="star">♡</span><div class="grow">${esc(r.text)}<div class="meta">Since ${esc(fmtDate(r.at))}</div></div><button class="pill-btn" data-answer="${esc(r.id)}">Answered</button></li>`).join("")}
        ${answered.map(r=>`<li><span class="star">✓</span><div class="grow">${esc(r.text)}<div class="meta">Answered ${esc(fmtDate(r.answeredAt))}</div></div></li>`).join("")}</ul>` : `<p class="small muted">No prayer needs yet.</p>`}
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
        <dt>How we met</dt><dd>${esc([p.howMet, p.metOn?fmtDate(p.metOn):""].filter(Boolean).join(", ")||"—")}</dd>
        <dt>Family</dt><dd>${esc(p.family||"—")}</dd>
        <dt>Work</dt><dd>${esc(p.job||"—")}</dd>
        <dt>Interests</dt><dd>${esc(p.interests||"—")}</dd>
        <dt>Faith</dt><dd>${esc(p.faith||"—")}</dd>
        <dt>Phone</dt><dd>${p.phone?`<span>${esc(p.phone)}</span> <button class="linkbtn" data-copy="${esc(p.phone)}">Copy</button>`:"—"}</dd>
        <dt>Email</dt><dd>${p.email?`<span>${esc(p.email)}</span> <button class="linkbtn" data-copy="${esc(p.email)}">Copy</button>`:"—"}</dd>
      </dl>`}
    </section>

    <section>${o==="delete" ? `<div class="card stack"><div>Remove ${esc(p.name)} and everything you've logged about them? This can't be undone.</div><div class="row"><button class="btn small" style="background:var(--warn)" data-act="delete-yes">Remove</button><button class="btn small ghost" data-act="close">Keep</button></div></div>` : `<button class="linkbtn danger" data-act="delete">Remove from my list</button>`}</section>
  </div>`;
}
function suggestQuestion(p, last, openPrayers){
  if (openPrayers[0]) return `"I've been praying about ${openPrayers[0].text.replace(/^(his|her)\s+/i,"your ").replace(/^./,c=>c.toLowerCase())}. How's that going?"`;
  if (last && last.cares) return `"You mentioned ${last.cares.toLowerCase()}. How's that going?"`;
  const byStage = ["\"What's been the best part of your week?\"","\"What was growing up like for you?\"","\"Where are you at with God these days?\"","\"What questions are still on your mind?\"","\"What's God been showing you lately?\"","\"Who in your life could use what you've found?\""];
  return byStage[p.stage||0];
}
function logForm(p){
  return `<form class="card stack" data-form="log">
    <div class="chips wrap" role="group" aria-label="Type">${LOG_TYPES.map((x,i)=>`<button type="button" class="chip" data-logtype="${esc(x)}" aria-pressed="${i===0}">${esc(x)}</button>`).join("")}</div>
    <label class="f">Date<input class="t" id="lg-date" type="date" value="${today()}"></label>
    <label class="f">What did ${esc(first(p.name))} share?<textarea class="t" id="lg-shared" placeholder="Their words, their news, what's on their heart"></textarea></label>
    <label class="f">What do they care about?<input class="t" id="lg-cares" placeholder="e.g. Being a good dad"></label>
    <label class="f">Questions they asked<input class="t" id="lg-q" placeholder="e.g. Why do you pray before meals?"></label>
    <label class="f">Prayer need (optional)<input class="t" id="lg-prayer" placeholder="Adds to their prayer list"></label>
    <div class="row"><button class="btn small">Save</button><button type="button" class="btn small ghost" data-act="close">Cancel</button></div>
  </form>`;
}
function taskForm(p){
  return `<form class="card stack" data-form="task"><label class="f">Next step<input class="t" id="tk-title" required placeholder="e.g. Text Marcus about the game"></label>
    <div class="row wrap" style="gap:10px;align-items:flex-end"><label class="f grow">Day<input class="t" id="tk-due" type="date" value="${addDays(today(),3)}"></label><label class="f grow">Remind me at<input class="t" id="tk-time" type="time"></label></div>
    <span class="hint">Leave the time blank if you don't want a phone reminder.</span>
    <div class="row"><button class="btn small">Add</button><button type="button" class="btn small ghost" data-act="close">Cancel</button></div></form>`;
}
function editForm(p){
  const f = (id,label,val,ph="") => `<label class="f">${label}<input class="t" id="${id}" value="${esc(val||"")}" placeholder="${esc(ph)}"></label>`;
  return `<form class="card stack" data-form="edit">
    ${f("ed-name","Name",p.name)}
    <label class="f">What I know about them<textarea class="t" id="ed-note" placeholder="Write it as if they might read it someday">${esc(p.note||"")}</textarea></label>
    <label class="f">How we met<select class="t" id="ed-how"><option value=""></option>${HOW_MET.map(x=>`<option ${x===p.howMet?"selected":""}>${x}</option>`).join("")}</select></label>
    ${f("ed-rel","Relationship",p.relationship,"Coworker, cousin, neighbor two doors down")}
    ${f("ed-family","Family",p.family,"Names of spouse, kids, parents")}
    ${f("ed-job","Work",p.job)}
    ${f("ed-int","Interests",p.interests)}
    <label class="f">Faith background<select class="t" id="ed-faith"><option value=""></option>${FAITH.map(x=>`<option ${x===p.faith?"selected":""}>${x}</option>`).join("")}</select></label>
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
      ${answered.length ? `<ul class="plain-list card">${answered.map(({p,r})=>`<li><span class="star">✓</span><div class="grow">${esc(r.text)}<div class="meta">${nameLink(p)} · ${esc(fmtDate(r.answeredAt))}</div></div></li>`).join("")}</ul>` : `<p class="small muted">When God answers, mark it. This list becomes your encouragement.</p>`}</section>
  </div>`;
}

/* Tasks tab */
function viewTasks(){
  const t = today(); const byId = new Map(people().map(p=>[p.id,p]));
  const open = allTasks().filter(x=>!x.done);
  const groups = [
    ["Pick back up", open.filter(x=>x.due && x.due<t)],
    ["Today", open.filter(x=>x.due===t)],
    ["Coming up", open.filter(x=>x.due && x.due>t).sort((a,b)=>a.due.localeCompare(b.due))],
    ["Anytime", open.filter(x=>!x.due)]
  ];
  const doneRecent = allTasks().filter(x=>x.done && x.doneAt && x.doneAt>=addDays(t,-7));
  return `
  <div class="top"><div><div class="date">${open.length} open</div><h1>Tasks</h1></div></div>
  <div class="stack-lg">
    ${exampleBanner()}
    ${S.ui.open==="gtask" ? `<form class="card stack" data-form="gtask"><label class="f">Task<input class="t" id="gt-title" required placeholder="e.g. Buy a Bible for Dana"></label>
      <label class="f">For<select class="t" id="gt-person"><option value="">No one in particular</option>${people().map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
      <div class="row wrap" style="gap:10px;align-items:flex-end"><label class="f grow">Day<input class="t" id="gt-due" type="date"></label><label class="f grow">Remind me at<input class="t" id="gt-time" type="time"></label></div>
      <span class="hint">Leave the time blank if you don't want a phone reminder.</span>
      <div class="row"><button class="btn small">Add</button><button type="button" class="btn small ghost" data-act="close">Cancel</button></div></form>` : `<div><button class="btn small" data-act="open-gtask">Add a task</button></div>`}
    ${groups.filter(g=>g[1].length).map(([name, list]) => `<section><div class="section-head"><h2>${name}</h2></div>
      <ul class="plain-list card">${list.map(x=>{ const p = x.personId?byId.get(x.personId):null; return `<li><button class="check" data-toggle-task="${esc(x.id)}" data-pid="${esc(x.personId||"")}" aria-label="Mark done"></button><div class="grow"><button class="tasktitle" data-edit-task="${esc(x.id)}" data-pid="${esc(x.personId||"")}">${esc(x.title)}</button><div class="meta">${p?nameLink(p)+" · ":""}${x.due?esc(fmtDay(x.due)):"No date"}${x.remindAt?" · Reminder "+esc(fmtTime(x.remindAt)):""}</div></div></li>`; }).join("")}</ul></section>`).join("") || `<div class="card empty">No open tasks. Add a next step from anyone's page.</div>`}
    ${doneRecent.length ? `<section><div class="section-head"><h2>Done this week</h2></div><ul class="plain-list">${doneRecent.map(x=>`<li><button class="check on" data-toggle-task="${esc(x.id)}" data-pid="${esc(x.personId||"")}" aria-label="Mark not done">✓</button><div class="grow strike">${esc(x.title)}</div></li>`).join("")}</ul></section>`:""}
  </div>`;
}

/* ---------- sheets ---------- */
function openSheet(html){
  $("#sheet-root").innerHTML = `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  const f = $("#sheet-root [data-autofocus]"); if (f) setTimeout(()=>f.focus(), 50);
}
function closeSheet(){ $("#sheet-root").innerHTML = ""; }

let addDraft = { how:"" };
function addSheet(){
  addDraft = { how:"" };
  openSheet(`<form class="stack" data-form="add" autocomplete="off">
    <h2>Add a person</h2>
    <label class="f">Name<input class="t" id="ad-name" data-autofocus required placeholder="Mike from the gym is fine"></label>
    <div class="f" style="display:flex;flex-direction:column;gap:6px"><span class="f">How you met</span><div class="chips wrap" role="group">${HOW_MET.map(x=>`<button type="button" class="chip" data-how="${esc(x)}" aria-pressed="false">${esc(x)}</button>`).join("")}</div></div>
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
      <button class="chip" data-quick-step="Text ${esc(first(p.name))}|3">Text in 3 days</button>
      <button class="chip" data-quick-step="Pray for ${esc(first(p.name))}|7">Pray this week</button>
      <button class="chip" data-quick-step="Invite ${esc(first(p.name))} to coffee|7">Invite to coffee</button></div></div>
    ${canFocus ? `<div class="row spread card"><div><b>Add to Focus 5?</b><div class="small muted">You'll pray for them daily on Today.</div></div><button class="pill-btn" data-act="add-focus">★ Add</button></div>` : ""}
    ${!S.settings.notify && realPeople().length === 1 ? `<div class="row spread card"><div><b>Want reminders?</b><div class="small muted">Turn on notifications so Tend can remind you to follow up.</div></div><button class="pill-btn" data-act="nudge-on">Turn on</button></div>` : ""}
    <div class="row"><button class="btn" data-act="open-new">Open ${esc(first(p.name))}</button><button class="btn ghost" data-act="close-sheet">Done</button></div></div>`);
  S.lastAdded = p.id;
}
let editing = null;
function taskRef(pid, id){ const list = pid ? (S.people.get(pid)?.tasks || []) : S.meta.tasks; return { list, t: list.find(x => x.id === id) }; }
function editTaskSheet(pid, id, confirmDelete){
  const { t } = taskRef(pid, id); if (!t) return;
  editing = { pid, id };
  const who = pid ? S.people.get(pid) : null;
  openSheet(`<form class="stack" data-form="tedit">
    <h2>Edit task</h2>
    ${who ? `<p class="small muted" style="margin:0">For ${esc(who.name)}</p>` : ""}
    <label class="f">Task<input class="t" id="te-title" required value="${esc(t.title)}"></label>
    <div class="row wrap" style="gap:10px;align-items:flex-end"><label class="f grow">Day<input class="t" id="te-due" type="date" value="${esc(t.due||"")}"></label><label class="f grow">Remind me at<input class="t" id="te-time" type="time" value="${esc(t.remindAt||"")}"></label></div>
    <span class="hint">Clear the time to turn off the phone reminder.</span>
    ${confirmDelete ? `<div class="card stack"><div>Delete this task? This can't be undone.</div><div class="row"><button type="button" class="btn small" style="background:var(--warn)" data-act="tdel-yes">Delete</button><button type="button" class="btn small ghost" data-act="tdel-no">Keep it</button></div></div>` : ""}
    <div class="row wrap"><button class="btn">Save</button><button type="button" class="btn ghost" data-act="close-sheet">Cancel</button><button type="button" class="linkbtn danger" data-act="tdel-ask" style="margin-left:auto">Delete task</button></div>
  </form>`);
}
function reviewSheet(){
  const t = today(); const ws = addDays(t,-7);
  const quiet = people().filter(p => { const s = sinceContact(p); return s === null || s >= 30; });
  const answered = []; people().forEach(p => (p.prayers||[]).filter(r=>r.answeredAt && r.answeredAt>=ws).forEach(r=>answered.push({p,r})));
  openSheet(`<form class="stack" data-form="review">
    <h2>Weekly review</h2>
    <div class="stack"><h3>1. What God answered</h3>${answered.length?`<ul class="plain-list">${answered.map(({p,r})=>`<li><span class="star">✓</span><div>${esc(r.text)} <span class="meta">· ${esc(p.name)}</span></div></li>`).join("")}</ul>`:`<p class="small muted">No answered prayers marked this week. Is there one to mark?</p>`}</div>
    <div class="stack"><h3>2. Gone quiet</h3>${quiet.length?`<p class="small muted">No contact in 30+ days. No guilt; just notice.</p><ul class="plain-list">${quiet.slice(0,6).map(p=>`<li><div class="avatar" style="width:28px;height:28px;font-size:11px">${esc(initials(p.name))}</div><div class="grow">${esc(p.name)}</div></li>`).join("")}</ul>`:`<p class="small muted">Everyone's been in touch this month.</p>`}</div>
    <div class="stack"><h3>3. Three steps for this week</h3>
      ${[0,1,2].map(i=>`<div class="row wrap" style="gap:8px"><select class="t" id="rv-p${i}" style="flex:1 1 140px"><option value="">Who?</option>${people().map(p=>`<option value="${esc(p.id)}" ${quiet[i]&&quiet[i].id===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select><input class="t" id="rv-t${i}" style="flex:2 1 180px" placeholder="Step"></div>`).join("")}
    </div>
    <div class="row"><button class="btn">Finish review</button><button type="button" class="linkbtn muted" data-act="close-sheet">Cancel</button></div>
  </form>`);
}
function quietSheet(){
  openSheet(`<div class="stack"><h2>Quiet mode</h2><p class="muted" style="margin:0">Pause next-step reminders. Your people and prayers stay right where they are.</p>
    <div class="stack"><button class="btn ghost" data-quiet="1">Rest of today</button><button class="btn ghost" data-quiet="7">One week</button><button class="btn ghost" data-quiet="on">Until I turn it off</button>
    ${isQuiet()?`<button class="btn" data-act="quiet-off">Turn off quiet mode</button>`:""}</div></div>`);
}

/* ---------- actions ---------- */
function toast(msg){ const r = $("#toast-root"); r.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(()=>{ r.innerHTML=""; }, 2600); }
function cur(){ return S.people.get(S.ui.personId); }
function go(tab){ S.ui.tab = tab; S.ui.personId = null; S.ui.open = null; render(); window.scrollTo(0,0); }
function openPerson(id){ S.ui.personId = id; S.ui.open = null; S.ui.hist = "All"; closeSheet(); render(); window.scrollTo(0,0); }
function findTask(pid, tid){ const list = pid ? (S.people.get(pid)?.tasks||[]) : S.meta.tasks; return { list, t: list.find(x=>x.id===tid) }; }
function toggleTask(pid, tid){
  if (!pid){ const t = S.meta.tasks.find(x=>x.id===tid); if (!t) return; t.done=!t.done; t.doneAt=t.done?today():null; saveMeta(); }
  else { const p = S.people.get(pid); const t = (p.tasks||[]).find(x=>x.id===tid); if (!t) return; t.done=!t.done; t.doneAt=t.done?today():null; savePerson(p); }
  if (arguments[2] !== false) toast("Done. Well done.");
  render();
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
  if (d.open){ openPerson(d.open); return; }
  if (d.filter){ S.ui.stageFilter = d.filter; render(); return; }
  if (d.prayed){ const p = S.people.get(d.prayed); p.prayed ||= []; const t = today(); if (p.prayed.includes(t)) p.prayed = p.prayed.filter(x=>x!==t); else { p.prayed.push(t); p.prayed = p.prayed.slice(-60); } savePerson(p); render(); return; }
  if (d.doneTask){ toggleTask(d.pid || null, d.doneTask); return; }
  if (d.toggleTask){ const pid = d.pid !== undefined ? (d.pid || null) : S.ui.personId; toggleTask(pid, d.toggleTask); return; }
  if (d.hist){ S.ui.hist = d.hist; render(); return; }
  if (d.quicklog){ const p = cur(); if (!p) return; const entry = { id:uid("l"), at:today(), type:d.quicklog, shared:"", cares:"", questions:"" }; (p.logs ||= []).push(entry); savePerson(p); render(); toast(({ "Call":"Called", "Text":"Texted", "In person":"Saw" }[d.quicklog] || "Logged") + " " + first(p.name) + " today. Tap Add a note below to add details."); return; }
  if (d.noteLog){ noteSheet(d.noteLog); return; }
  if (d.editTask){ editTaskSheet(d.pid || null, d.editTask); return; }
  if (d.delTask){ const p = cur(); p.tasks = p.tasks.filter(t=>t.id!==d.delTask); savePerson(p); render(); return; }
  if (d.delDate){ const p = cur(); p.dates = p.dates.filter(t=>t.id!==d.delDate); savePerson(p); render(); return; }
  if (d.stage !== undefined){ const p = cur(); const s = +d.stage; if (s !== p.stage){ p.stage = s; (p.stageHistory ||= []).push({stage:s, at:today()}); savePerson(p); toast("Stage: " + STAGES[s]); render(); } return; }
  if (d.suggest){ const p = cur(); (p.tasks ||= []).push({id:uid("t"), title:d.suggest, due:addDays(today(),7), done:false}); savePerson(p); toast("Added for this week"); render(); return; }
  if (d.answer){ const p = cur(); const r = p.prayers.find(x=>x.id===d.answer); r.answeredAt = today(); savePerson(p); toast("Praise God. Added to Answered."); render(); return; }
  if (d.copy){ try { await navigator.clipboard.writeText(d.copy); toast("Copied"); } catch(_){ toast("Select the text to copy it"); } return; }
  if (d.how){ addDraft.how = addDraft.how === d.how ? "" : d.how; el.closest(".chips").querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.how === addDraft.how)); return; }
  if (d.logtype){ el.closest(".chips").querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c === el)); return; }
  if (d.quickStep){ const [title, n] = d.quickStep.split("|"); const p = S.people.get(S.lastAdded); if (p){ (p.tasks ||= []).push({id:uid("t"), title, due:addDays(today(),+n), done:false}); savePerson(p); toast("Next step added"); el.setAttribute("aria-pressed","true"); el.disabled = true; } return; }
  if (d.quiet){ S.meta.quietUntil = d.quiet === "on" ? "on" : addDays(today(), +d.quiet - 1); saveMeta(); closeSheet(); toast("Quiet mode on"); render(); return; }
  if (d.submit){ el.form.dataset.mode = d.submit; return; }

  switch (d.act){
    case "back": S.ui.personId = null; S.ui.open = null; render(); break;
    case "close": S.ui.open = null; render(); break;
    case "close-sheet": closeSheet(); render(); break;
    case "open-log": S.ui.open = "log"; render(); $("#lg-shared")?.focus(); break;
    case "open-task": S.ui.open = "task"; render(); $("#tk-title")?.focus(); break;
    case "open-prayer": S.ui.open = "prayer"; render(); $("#pr-text")?.focus(); break;
    case "open-date": S.ui.open = "date"; render(); $("#dt-label")?.focus(); break;
    case "open-edit": S.ui.open = "edit"; render(); break;
    case "open-gtask": S.ui.open = "gtask"; render(); $("#gt-title")?.focus(); break;
    case "delete": S.ui.open = "delete"; render(); break;
    case "delete-yes": { const p = cur(); deletePerson(p.id); S.ui.personId = null; S.ui.open = null; toast(p.name + " removed"); render(); break; }
    case "focus": { const p = cur(); if (!p.focus && focusPeople().length >= 5){ toast("Focus 5 is full. Unstar someone first."); break; } p.focus = !p.focus; savePerson(p); render(); break; }
    case "add-focus": { const p = S.people.get(S.lastAdded); if (p && focusPeople().length < 5){ p.focus = true; savePerson(p); el.classList.add("on"); el.textContent = "★ Added"; el.disabled = true; } break; }
    case "open-new": openPerson(S.lastAdded); break;
    case "hide-examples": S.meta.hideExamples = true; saveMeta(); render(); break;
    case "review": reviewSheet(); break;
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
      editing = null; closeSheet(); toast("Task deleted"); render(); break; }
    case "nudge-on": {
      if (!pushSupported()){ settingsSheet(); break; }
      el.disabled = true;
      if (await enableNotifications()){ toast("Notifications on. You'll get reminders at the times you set."); el.textContent = "On ✓"; render(); } else el.disabled = false;
      break; }
    case "nudge-off": S.meta.nudgeOff = true; saveMeta(); render(); break;
    case "toggle-daily": S.meta.dailySummary = S.meta.dailySummary === false; saveMeta(); settingsSheet(); break;
    case "export": exportData(); break;
    case "signout": await sb.auth.signOut(); USER = null; S.people = new Map(); S.mode = "signin"; S.signin = { step:"signin" }; closeSheet(); render(); break;
    case "signin-toggle": S.signin = { step: S.signin.step === "create" ? "signin" : "create", email: ($("#si-email")?.value || S.signin.email || "") }; render(); break;
    case "ai-question": aiQuestion(el); break;
  }
});

document.addEventListener("change", e => {
  if (e.target.id === "set-time" && e.target.value){ S.settings.time = e.target.value; S.settings.tz = Intl.DateTimeFormat().resolvedOptions().timeZone; saveMeta(); toast("Reminder time set to " + e.target.value); }
});
document.addEventListener("input", e => {
  if (e.target.id === "people-q"){ S.ui.q = e.target.value; const pos = e.target.selectionStart; render(); const i = $("#people-q"); i.focus(); try { i.setSelectionRange(pos,pos); } catch(_){} }
});

document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target; const kind = f.dataset.form; const v = id => ($("#"+id)?.value || "").trim();
  if (kind === "auth"){ const em = v("si-email"), pw = $("#si-pass").value; if (em && pw) doAuth(em, pw); return; }
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
    if (addDraft.ai){ const a = addDraft.ai; if (a.prayer) p.prayers.push({id:uid("r"), text:a.prayer, at:today(), answeredAt:null}); if (a.task) p.tasks.push({id:uid("t"), title:a.task, due:addDays(today(), 3), done:false}); if (a.interests) p.interests = a.interests; if (a.family) p.family = a.family; }
    if (S.examples){ for (const [id,x] of S.people) if (x.example) S.people.delete(id); }
    savePerson(p);
    if (f.dataset.mode === "another"){ toast(first(name) + " added"); addSheet(); render(); }
    else { afterAddSheet(p); render(); }
    return;
  }
  const p = cur();
  if (kind === "log"){
    const type = f.querySelector('[data-logtype][aria-pressed="true"]')?.dataset.logtype || "In person";
    const entry = { id:uid("l"), at: v("lg-date") || today(), type, shared:v("lg-shared"), cares:v("lg-cares"), questions:v("lg-q") };
    (p.logs ||= []).push(entry);
    const pr = v("lg-prayer"); if (pr) (p.prayers ||= []).push({id:uid("r"), text:pr, at:entry.at, answeredAt:null});
    savePerson(p); S.ui.open = null; toast("Conversation saved"); render();
  } else if (kind === "task"){
    const tm = v("tk-time"); const due = v("tk-due") || (tm ? today() : null); (p.tasks ||= []).push({id:uid("t"), title:v("tk-title"), due, remindAt: tm || null, done:false}); savePerson(p); S.ui.open = null; render(); remindNote(tm, due);
  } else if (kind === "prayer"){
    (p.prayers ||= []).push({id:uid("r"), text:v("pr-text"), at:today(), answeredAt:null}); savePerson(p); S.ui.open = null; render();
  } else if (kind === "date"){
    (p.dates ||= []).push({id:uid("d"), label:v("dt-label"), date:v("dt-date"), yearly: $("#dt-yearly").checked}); savePerson(p); S.ui.open = null; render();
  } else if (kind === "edit"){
    Object.assign(p, { name:v("ed-name")||p.name, note:v("ed-note"), howMet:v("ed-how"), relationship:v("ed-rel"), family:v("ed-family"), job:v("ed-job"), interests:v("ed-int"), faith:v("ed-faith"), phone:v("ed-phone"), email:v("ed-email") });
    savePerson(p); S.ui.open = null; toast("Saved"); render();
  } else if (kind === "gtask"){
    const pid = v("gt-person"); const tm = v("gt-time"); const t = {id:uid("t"), title:v("gt-title"), due:v("gt-due") || (tm ? today() : null), remindAt: tm || null, done:false}; remindNote(tm, t.due);
    if (pid){ const q = S.people.get(pid); (q.tasks ||= []).push(t); savePerson(q); } else { S.meta.tasks.push(t); saveMeta(); }
    S.ui.open = null; render();
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
  } else if (kind === "review"){
    let n = 0;
    [0,1,2].forEach(i => { const pid = v("rv-p"+i), title = v("rv-t"+i); if (!title) return; const t = {id:uid("t"), title, due:addDays(today(), 2+i*2), done:false}; if (pid){ const q = S.people.get(pid); (q.tasks ||= []).push(t); savePerson(q); } else S.meta.tasks.push(t); n++; });
    S.meta.reviewAt = today(); saveMeta(); closeSheet(); toast(n ? `Review done. ${n} step${n>1?"s":""} planned.` : "Review done."); render();
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
