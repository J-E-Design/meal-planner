const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const STORE_MEALS = "mp_meals_v1";
const STORE_WEEK = "mp_week_v2";
const STORE_WEEK_OLD = "mp_week_v1";

const DAY_COLORS = [
  { bg: "#FBE3DC", fg: "#C9503B" },
  { bg: "#FBEFD9", fg: "#C4791A" },
  { bg: "#EAF2D0", fg: "#6E8B1F" },
  { bg: "#DCF2EC", fg: "#2F8F7A" },
  { bg: "#DDEBFB", fg: "#3A72B8" },
  { bg: "#E9E0F7", fg: "#7B5AC4" },
  { bg: "#FBE0EC", fg: "#C34C82" },
];

const MEAL_EMOJI_MAP = [
  [/pizza/i, "🍕"],
  [/taco|burrito|fajita/i, "🌮"],
  [/curry/i, "🍛"],
  [/pasta|spaghetti|bolognese|lasagne|lasagna/i, "🍝"],
  [/noodle|stir.?fry|ramen/i, "🍜"],
  [/rice/i, "🍚"],
  [/fish|salmon|prawn|shrimp/i, "🐟"],
  [/chicken/i, "🍗"],
  [/beef|steak|burger/i, "🍔"],
  [/pork|bacon|sausage/i, "🥓"],
  [/salad/i, "🥗"],
  [/soup/i, "🍲"],
  [/sandwich|wrap/i, "🥪"],
  [/egg/i, "🍳"],
  [/pie/i, "🥧"],
  [/roast/i, "🍖"],
  [/bbq|barbecue|grill/i, "🍖"],
  [/takeaway|take.?away|chinese/i, "🥡"],
  [/veg/i, "🥦"],
];
function getMealEmoji(name) {
  if (!name) return "🍽️";
  for (const [re, emoji] of MEAL_EMOJI_MAP) {
    if (re.test(name)) return emoji;
  }
  return "🍽️";
}

const FUN_MESSAGES = [
  "Yum! Dinner's sorted 🎉",
  "Tea's sorted for the week!",
  "Look at that beautiful week 😋",
  "Fed happens here 🍽️",
  "Nom nom, all planned!",
  "Bon appétit, future you!",
];

const CONFETTI_EMOJI = ["🎉", "✨", "🥳", "🍕", "🌮", "🍗", "🥕", "⭐"];

const SOUND_OPTIONS = [
  { id: "nom.mp3", label: "Cookie Monster" },
  { id: "cowabunga.mp3", label: "Cowabunga" },
  { id: "om_nom_nom_nom_nom.mp3", label: "Om Nom Nom Nom Nom" },
];
const DEFAULT_SETTINGS = { sound: "nom.mp3", muted: false, confetti: true, darkMode: false, excludedCategories: [], teaTime: "17:30", remindMins: 60, defrostTime: "20:00" };
const CALENDAR_FEED = "jamieemerydesign.co.uk/meal-planner/calendar.php";

// ---- Looks (per-device, stored in localStorage so each phone can differ) ----
const LOOKS = [
  { id: "classic", label: "Classic", desc: "The original", swatch: ["#FFF6EA", "#F5B942", "#E85D3D", "#5B7F4B"], themeColor: "#E85D3D", available: true, shuffle: "classic" },
  { id: "fridge", label: "Fridge door", desc: "Paper notes & magnets", swatch: ["#EFE8DC", "#FFFDF7", "#D94F30", "#2F7D6B"], themeColor: "#EFE8DC", themeColorDark: "#1F1C19", available: true, shuffle: "reel" },
  { id: "chalk", label: "Café chalkboard", desc: "This week's menu", swatch: ["#F4EFE4", "#1F1B16", "#A8322D", "#1F2621"], themeColor: "#F4EFE4", themeColorDark: "#1F2621", available: true, shuffle: "write", noEmoji: true },
  { id: "calm", label: "Calm modern", desc: "Big, bold & clean", swatch: ["#F7F7F5", "#111111", "#FF5A36", "#E8E8E4"], themeColor: "#F7F7F5", themeColorDark: "#0E0E0E", available: true, shuffle: "cards" },
];
const LOOK_KEY = "mp_look";
function currentLook() {
  const id = document.documentElement.dataset.look;
  return LOOKS.find(l => l.id === id && l.available) || LOOKS[0];
}
function setLook(id) {
  const look = LOOKS.find(l => l.id === id && l.available) || LOOKS[0];
  document.documentElement.dataset.look = look.id;
  try { localStorage.setItem(LOOK_KEY, look.id); } catch (e) {}
  applyThemeColor();
  renderWeek();
  renderMeals();
  renderLookOptions();
}
function applyThemeColor() {
  const look = currentLook();
  const color = (settings.darkMode && look.themeColorDark) || look.themeColor;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && color) meta.setAttribute("content", color);
}
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Meal label with or without its emoji, depending on the look.
function mealLabel(name) {
  return currentLook().noEmoji ? escapeHtml(name) : getMealEmoji(name) + " " + escapeHtml(name);
}
// Run the current look's shuffle animation on the given day indices.
function animateDays(indices) {
  const kind = currentLook().shuffle;
  if (kind === "reel") reelDays(indices);
  else if (kind === "write") staggerDays(indices, "writing", 700, 160);
  else if (kind === "cards") {
    staggerDays(indices, "dealing", 600, 70);
    try { if (navigator.vibrate) navigator.vibrate([10, 40, 10]); } catch (e) {}
  }
}
// Add a CSS animation class to each day in turn; the look's CSS does the drawing,
// using --n (the day's position in the sequence) for its delay.
function staggerDays(indices, cls, baseMs, stepMs) {
  if (prefersReducedMotion()) return;
  indices.forEach((i, n) => {
    const row = document.getElementById("day-" + i);
    if (!row) return;
    row.style.setProperty("--n", n);
    row.classList.remove(cls);
    void row.offsetWidth; // restart the animation
    row.classList.add(cls);
    setTimeout(() => row.classList.remove(cls), baseMs + n * stepMs);
  });
}

// Slot-machine reel: each day flicks through random meals, then lands, one after another.
function reelDays(indices) {
  const names = meals.map(m => m.name);
  if (names.length < 2 || prefersReducedMotion()) return;
  indices.forEach((i, n) => {
    const row = document.getElementById("day-" + i);
    const el = row && row.querySelector(".day-meal");
    if (!el) return;
    const finalHtml = el.innerHTML;
    const stopAt = performance.now() + 420 + n * 150;
    row.classList.add("reeling");
    const tick = () => {
      if (!el.isConnected) return; // re-rendered mid-spin
      if (performance.now() >= stopAt) {
        el.innerHTML = finalHtml;
        row.classList.remove("reeling");
        row.classList.add("landed");
        setTimeout(() => row.classList.remove("landed"), 450);
        return;
      }
      el.innerHTML = mealLabel(names[Math.floor(Math.random() * names.length)]);
      setTimeout(tick, 65);
    };
    tick();
  });
}

// TheMealDB's stable category list (from /list.php?c=list)
const MEAL_CATEGORIES = ["Beef", "Breakfast", "Chicken", "Dessert", "Goat", "Lamb", "Miscellaneous", "Pasta", "Pork", "Seafood", "Side", "Starter", "Vegan", "Vegetarian"];

const NOM_AUDIO = new Audio();
function updateNomAudioSrc() { NOM_AUDIO.src = settings.sound || DEFAULT_SETTINGS.sound; }
function playNomSound() {
  if (settings.muted) return;
  try {
    NOM_AUDIO.currentTime = 0;
    NOM_AUDIO.play().catch(() => {});
  } catch (e) {}
}
function previewSound(src) {
  try {
    new Audio(src).play().catch(() => {});
  } catch (e) {}
}

function spawnConfetti(originEl) {
  const rect = originEl.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  for (let i = 0; i < 18; i++) {
    const el = document.createElement("span");
    el.textContent = CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)];
    el.style.cssText = `position:fixed; left:${originX}px; top:${originY}px; font-size:${14 + Math.random() * 10}px; pointer-events:none; z-index:60; will-change:transform,opacity;`;
    document.body.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 40;
    const rot = (Math.random() - 0.5) * 360;
    const duration = 700 + Math.random() * 500;
    el.animate([
      { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy + 160}px) rotate(${rot}deg)`, opacity: 0 },
    ], { duration, easing: "cubic-bezier(.2,.7,.3,1)" });
    setTimeout(() => el.remove(), duration + 50);
  }
}

const STARTER_MEALS = [
  { id: "m1", name: "Spaghetti bolognese", ingredients: ["Mince beef","Spaghetti","Tinned tomatoes","Onion","Garlic","Parmesan"] },
  { id: "m2", name: "Tacos", ingredients: ["Taco shells","Mince beef","Cheddar","Lettuce","Salsa","Soured cream"] },
  { id: "m3", name: "Chicken curry", ingredients: ["Chicken thighs","Curry paste","Coconut milk","Rice","Coriander"] },
  { id: "m4", name: "Stir fry", ingredients: ["Noodles","Mixed veg","Soy sauce","Chicken or tofu","Ginger"] },
  { id: "m5", name: "Pizza night", ingredients: ["Pizza bases","Mozzarella","Passata","Toppings of choice"] },
];

// ---- Server-backed storage (PHP + MySQL on our own hosting) ----
// The app shell is served from GitHub Pages; the API lives on iFastNet.
// state.php only accepts cross-origin requests from the GitHub Pages origin.
const API_URL = "https://jamieemerydesign.co.uk/meal-planner/state.php";

// ---- Household passcode: entered once per phone, sent with every request ----
const KEY_STORE = "mp_key";
function getKey() { try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } }
function setKey(k) { try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch (e) {} }
function normaliseKey(k) { return (k || "").trim().toLowerCase().replace(/\s+/g, "-"); }
function authHeaders(extra = {}) {
  const k = getKey();
  return k ? { ...extra, "X-Household-Key": k } : extra;
}
let locked = false;
function handleUnauthorised() {
  if (locked) return;
  locked = true;
  setKey("");
  showLockScreen("That passcode has changed — please enter it again.");
}

async function stateGet(name, fallback) {
  const res = await fetch(`${API_URL}?name=${encodeURIComponent(name)}`, { cache: "no-store", headers: authHeaders() });
  if (res.status === 401) { handleUnauthorised(); throw new Error("Passcode needed"); }
  if (!res.ok) throw new Error("GET " + name + " failed: " + res.status);
  const data = await res.json();
  return data.value === null || data.value === undefined ? fallback : data.value;
}
async function stateSet(name, value) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name, value }),
  });
  if (res.status === 401) { handleUnauthorised(); throw new Error("Passcode needed"); }
  if (!res.ok) throw new Error("SET " + name + " failed: " + res.status);
}

function showLockScreen(message) {
  document.getElementById("lockError").textContent = message || "";
  document.getElementById("lockInput").value = "";
  setBodyState("state-locked");
  setTimeout(() => document.getElementById("lockInput").focus(), 50);
}
document.getElementById("lockForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = normaliseKey(document.getElementById("lockInput").value);
  const errorEl = document.getElementById("lockError");
  const btn = document.getElementById("lockBtn");
  if (!key) { errorEl.textContent = "Type your passcode first."; return; }
  btn.disabled = true;
  errorEl.textContent = "Checking…";
  try {
    const res = await fetch(`${API_URL}?name=settings`, { cache: "no-store", headers: { "X-Household-Key": key } });
    if (res.status === 401) { errorEl.textContent = "That's not it — check the passcode and try again."; return; }
    if (!res.ok) throw new Error("status " + res.status);
    setKey(key);
    locked = false;
    errorEl.textContent = "";
    setBodyState("state-loading");
    init();
  } catch (err) {
    errorEl.textContent = "Couldn't reach the server — check your connection.";
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("lockPhoneBtn").addEventListener("click", async () => {
  const ok = await showConfirm("You'll need the household passcode to open the app on this phone again.", {
    title: "Lock this phone?", confirmLabel: "Lock it", danger: false,
  });
  if (!ok) return;
  setKey("");
  showLockScreen();
});

// Calendar feed key = first 32 hex chars of sha256("calendar:" + passcode), so the
// calendar link never contains the passcode itself.
async function calendarToken() {
  const key = getKey();
  if (!key || !(window.crypto && crypto.subtle)) return "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("calendar:" + key));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function saveMeals(m) {
  meals = m;
  try {
    await stateSet("meals", m);
  } catch (e) {
    showToast("Couldn't save your meals — check your connection.");
  }
}
// ---- Weeks: today's week plus up to 3 weeks ahead, keyed by the week's Sunday ----
// "plan" on the server = { weeks: { "2026-11-15": [7 days, Sun..Sat], ... } }.
// Past weeks are kept (pruned after a year) - they feed "no repeats" and Year in tea.
const MAX_WEEKS_AHEAD = 3;
let plan = { weeks: {} };
let viewOffset = 0; // 0 = this week, 1 = next week, ...

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekStart(offset = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0); // midday avoids daylight-saving edge cases
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return d;
}
function weekKey(offset = 0) { return isoDate(weekStart(offset)); }
function dayDate(offset, i) { const d = weekStart(offset); d.setDate(d.getDate() + i); return d; }
function dateKey(offset, i) { return isoDate(dayDate(offset, i)); }
function emptyWeek() { return Array(7).fill(null); }
function weekDays(offset) {
  const w = plan.weeks[weekKey(offset)];
  return Array.isArray(w) && w.length === 7 ? w : emptyWeek();
}
function normalisePlan(v) {
  const weeks = {};
  if (v && v.weeks && typeof v.weeks === "object") {
    for (const [k, w] of Object.entries(v.weeks)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(w) && w.length === 7) weeks[k] = w;
  }
  return { weeks };
}
function prunePlan(p) {
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cut = isoDate(cutoff);
  for (const k of Object.keys(p.weeks)) if (k < cut) delete p.weeks[k];
  return p;
}
let planChain = Promise.resolve();
let planSavesPending = 0;
function savePlanWeek(key, days) {
  plan.weeks[key] = days;
  planSavesPending++;
  // Read the latest copy first so the two phones editing different weeks don't overwrite each other.
  planChain = planChain.then(async () => {
    try {
      const latest = normalisePlan(await stateGet("plan", null));
      latest.weeks[key] = plan.weeks[key];
      prunePlan(latest);
      await stateSet("plan", latest);
      for (const [k, w] of Object.entries(latest.weeks)) if (k !== key) plan.weeks[k] = w;
      if (key === weekKey(0)) stateSet("week", plan.weeks[key]).catch(() => {}); // keep the old field current too
    } catch (e) {
      showToast("Couldn't save your week — check your connection.");
    } finally {
      planSavesPending--;
    }
  });
  return planChain;
}
async function saveWeek(w) {
  week = w;
  return savePlanWeek(weekKey(viewOffset), w);
}

// ---- Notes on a day: { "2026-11-19": "Football - eat at 7" } ----
let notes = {};
let notesChain = Promise.resolve();
function saveNote(date, text) {
  const clean = (text || "").trim();
  if (clean) notes[date] = clean; else delete notes[date];
  notesChain = notesChain.then(async () => {
    try {
      const latest = await stateGet("notes", {});
      const next = latest && typeof latest === "object" && !Array.isArray(latest) ? latest : {};
      if (clean) next[date] = clean; else delete next[date];
      const cutoff = isoDate(new Date(Date.now() - 60 * 864e5));
      for (const k of Object.keys(next)) if (k < cutoff) delete next[k];
      await stateSet("notes", next);
      notes = next;
    } catch (e) {
      showToast("Couldn't save that note — check your connection.");
    }
  });
}

// Refresh the plan and notes when the app comes back to the front (the other phone may have changed them).
async function refreshPlan() {
  if (planSavesPending > 0 || document.querySelector(".modal-overlay.active")) return;
  try {
    const [p, n, r, s] = await Promise.all([
      stateGet("plan", null), stateGet("notes", {}),
      stateGet("ratings", null).catch(() => null), stateGet("swipes", {}).catch(() => ({})),
    ]);
    if (planSavesPending > 0) return;
    const nextPlan = normalisePlan(p);
    const nextNotes = n && typeof n === "object" && !Array.isArray(n) ? n : {};
    const nextRatings = normaliseRatings(r);
    const nextSwipes = normaliseSwipes(s);
    const changed = JSON.stringify([nextPlan, nextNotes, nextRatings, nextSwipes]) !== JSON.stringify([plan, notes, ratings, swipes]);
    if (changed) {
      plan = nextPlan;
      notes = nextNotes;
      ratings = nextRatings;
      swipes = nextSwipes;
      week = weekDays(viewOffset);
      renderWeek();
      renderMeals();
    }
  } catch (e) { /* offline - keep what we have */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshPlan(); });
async function saveSettings(s) {
  settings = s;
  try {
    await stateSet("settings", s);
  } catch (e) {
    showToast("Couldn't save settings — check your connection.");
  }
}
async function saveHistory(h) {
  history = h;
  try {
    await stateSet("history", h);
  } catch (e) { /* non-critical, fail silently */ }
}

// one-time migration: pick up anything left over from the old localStorage-only version
function readLegacyLocalMeals() {
  try {
    const raw = localStorage.getItem(STORE_MEALS);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function readLegacyLocalWeek() {
  try {
    const raw = localStorage.getItem(STORE_WEEK);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

let meals = [];
let week = Array(7).fill(null);
let settings = { ...DEFAULT_SETTINGS };
let history = [];
let editingMealId = null;
let editingDayIndex = null;

let toastTimer = null;
// showToast("Deleted Tacos", { undo: () => ... }) adds an Undo button and stays up a little longer.
function showToast(message, opts = {}) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = message;
  el.appendChild(text);
  el.classList.toggle("has-action", !!opts.undo);
  if (opts.undo) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = "Undo";
    btn.addEventListener("click", () => {
      el.classList.remove("show");
      clearTimeout(toastTimer);
      opts.undo();
    }, { once: true });
    el.appendChild(btn);
  }
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), opts.undo ? 6000 : 3000);
}

function showConfirm(message, opts = {}) {
  const { title = "Are you sure?", confirmLabel = "Confirm", cancelLabel = "Cancel", danger = true } = opts;
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirmModalOverlay");
    const okBtn = document.getElementById("confirmOkBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");
    document.getElementById("confirmModalTitle").textContent = title;
    document.getElementById("confirmModalMessage").textContent = message;
    okBtn.textContent = confirmLabel;
    okBtn.className = danger ? "btn-danger" : "btn-primary";
    cancelBtn.textContent = cancelLabel;
    cancelBtn.style.display = cancelLabel ? "" : "none";
    overlay.classList.add("active");

    function cleanup(result) {
      overlay.classList.remove("active");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlay);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === overlay) cleanup(false); }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlay);
  });
}
function showAlert(message, title = "Heads up") {
  return showConfirm(message, { title, confirmLabel: "OK", cancelLabel: null, danger: false });
}
function setBodyState(state) {
  document.body.classList.remove("state-loading", "state-ready", "state-error");
  document.body.classList.add(state);
}
function showApp() { setBodyState("state-ready"); }
function showLoadError() { setBodyState("state-error"); }

function applySettings() {
  document.body.classList.toggle("dark-mode", !!settings.darkMode);
  updateNomAudioSrc();
  applyThemeColor();
}

async function init() {
  if (!getKey()) { showLockScreen(); return; }
  try {
    const [remoteMeals, remoteWeek, remoteSettings, remoteHistory, remotePlan, remoteNotes, remoteRatings, remoteSwipes] = await Promise.all([
      stateGet("meals", []),
      stateGet("week", Array(7).fill(null)),
      stateGet("settings", DEFAULT_SETTINGS),
      stateGet("history", []),
      stateGet("plan", null).catch(() => null),
      stateGet("notes", {}).catch(() => ({})),
      stateGet("ratings", null).catch(() => null),
      stateGet("swipes", {}).catch(() => ({})),
    ]);
    meals = remoteMeals;
    week = remoteWeek;
    settings = { ...DEFAULT_SETTINGS, ...remoteSettings };
    history = remoteHistory;
    plan = normalisePlan(remotePlan);
    notes = remoteNotes && typeof remoteNotes === "object" && !Array.isArray(remoteNotes) ? remoteNotes : {};
    ratings = normaliseRatings(remoteRatings);
    swipes = normaliseSwipes(remoteSwipes);

    // fresh database: seed it from whatever this device already had saved locally
    if (meals.length === 0) {
      const legacy = readLegacyLocalMeals();
      meals = (legacy && legacy.length) ? legacy : STARTER_MEALS;
      await stateSet("meals", meals);
    }
    if (week.every(d => d === null)) {
      const legacy = readLegacyLocalWeek();
      if (legacy && legacy.some(d => d !== null)) {
        week = legacy;
        await stateSet("week", week);
      }
    }
    // First run with dated weeks: the existing single week becomes this week.
    if (!plan.weeks[weekKey(0)] && Array.isArray(week) && week.some(d => d !== null)) {
      savePlanWeek(weekKey(0), week);
    }
    viewOffset = 0;
    week = weekDays(0);
  } catch (e) {
    if (!locked) showLoadError(); // a wrong/changed passcode shows the lock screen instead
    return;
  }
  applySettings();
  showApp();
  // Shopping ticks/extras are optional extra data - never let them stop the app loading.
  if (shopQueue.length) flushShopQueue(); else refreshShop();
  renderWeek();
  renderMeals();
  renderSettingsView();
  if (!getMe()) setTimeout(openWhoModal, 600);
  handleShareTarget();
}
document.getElementById("retryBtn").addEventListener("click", () => {
  setBodyState("state-loading");
  init();
});

function uid() { return "m" + Date.now() + Math.floor(Math.random()*1000); }
function mealById(id) { return meals.find(m => m.id === id); }
function mealByName(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return meals.find(m => m.name.trim().toLowerCase() === key) || null;
}

// ---- How likely each meal is to come up: favourites, your 👍/👎 ratings and this week's swipes ----
let ratings = { byMeal: {}, asked: {} }; // byMeal: { "Tacos": { up: 2, down: 0 } }, asked: { "2026-11-18": "up" }
let swipes = {};                          // { "2026-11-22": { "Jamie": { "Tacos": true, "Stew": false } } }
function normaliseRatings(v) {
  return {
    byMeal: v && typeof v.byMeal === "object" && !Array.isArray(v.byMeal) ? v.byMeal : {},
    asked: v && typeof v.asked === "object" && !Array.isArray(v.asked) ? v.asked : {},
  };
}
function normaliseSwipes(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function swipeVotes(name, offset = viewOffset) {
  const byPerson = swipes[weekKey(offset)] || {};
  let yes = 0, no = 0;
  for (const votes of Object.values(byPerson)) {
    if (votes && votes[name] === true) yes++;
    else if (votes && votes[name] === false) no++;
  }
  return { yes, no };
}
function mealWeight(name, offset = viewOffset) {
  const m = mealByName(name);
  let w = m && m.favourite ? 3 : 1;
  const r = ratings.byMeal[name];
  if (r) w *= Math.min(2.5, Math.max(0.35, 1 + 0.35 * ((r.up || 0) - (r.down || 0))));
  const { yes, no } = swipeVotes(name, offset);
  if (yes >= 2) w *= 4;                 // a match - you both fancy it
  else if (yes === 1 && no === 0) w *= 2;
  else if (no >= 2 && yes === 0) w = 0; // you both said no this week
  else if (no >= 1 && yes === 0) w *= 0.4;
  return w;
}
function deckCopies(w) { return w <= 0 ? 0 : Math.max(1, Math.round(w * 2)); }
function weightedDeck(excludeNames) {
  const allowed = meals.filter(m => mealWeight(m.name) > 0);
  const pool = allowed.filter(m => !excludeNames.has(m.name));
  // don't let exclusions empty the deck entirely
  const usePool = pool.length ? pool : (allowed.length ? allowed : meals);
  return usePool.flatMap(m => Array(deckCopies(mealWeight(m.name)) || 1).fill(m.name));
}

// ---- Quick ratings: "How was Tacos last night?" ----
let ratingsChain = Promise.resolve();
function weekStartOf(date) { const d = new Date(date); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d; }
function pendingRating() {
  for (const back of [1, 2]) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - back);
    const key = isoDate(d);
    if (ratings.asked[key]) continue;
    const days = plan.weeks[isoDate(weekStartOf(d))];
    const entry = Array.isArray(days) ? days[d.getDay()] : null;
    if (entry && !entry.eatingOut && mealByName(entry.text)) {
      return { date: key, name: entry.text, when: back === 1 ? "last night" : "on " + FULL_DAYS[d.getDay()] };
    }
  }
  return null;
}
function renderRating() {
  const card = document.getElementById("rateCard");
  const p = viewOffset === 0 ? pendingRating() : null;
  card.hidden = !p;
  if (!p) return;
  card.dataset.date = p.date;
  card.dataset.name = p.name;
  document.getElementById("rateQuestion").innerHTML = `How was the <strong>${escapeHtml(p.name)}</strong> ${p.when}?`;
}
function saveRating(date, name, vote) {
  ratings.asked[date] = vote;
  if (vote !== "skip") {
    const r = ratings.byMeal[name] || { up: 0, down: 0 };
    r[vote]++;
    ratings.byMeal[name] = r;
  }
  renderRating();
  renderMeals();
  ratingsChain = ratingsChain.then(async () => {
    try {
      const latest = normaliseRatings(await stateGet("ratings", null));
      if (!latest.asked[date]) {
        latest.asked[date] = vote;
        if (vote !== "skip") {
          const r = latest.byMeal[name] || { up: 0, down: 0 };
          r[vote] = (r[vote] || 0) + 1;
          latest.byMeal[name] = r;
        }
      }
      const cutoff = isoDate(new Date(Date.now() - 45 * 864e5));
      for (const k of Object.keys(latest.asked)) if (k < cutoff) delete latest.asked[k];
      await stateSet("ratings", latest);
      ratings = latest;
      renderMeals();
    } catch (e) {
      showToast("Couldn't save that rating — check your connection.");
    }
  });
}
document.getElementById("rateCard").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-rate]");
  if (!btn) return;
  const card = document.getElementById("rateCard");
  const { date, name } = card.dataset;
  const vote = btn.dataset.rate;
  saveRating(date, name, vote);
  if (vote === "up") showToast(`Noted — ${name} will come up a bit more often 😋`);
  if (vote === "down") showToast(`Noted — ${name} will come up less often`);
});

function pickWeek() {
  const result = week.map(d => d && (d.locked || d.eatingOut) ? d : null);
  const slotsToFill = [];
  result.forEach((d, i) => { if (!d) slotsToFill.push(i); });

  // avoid repeating meals from the two weeks before this one (and anything planned the week after)
  const recentNames = new Set([
    ...[-2, -1, 1].flatMap(o => weekDays(viewOffset + o)).filter(d => d && !d.eatingOut).map(d => d.text),
    ...(viewOffset === 0 ? history.flat() : []),
  ]);

  // Favourites sit in the deck several times (more likely to come up), but a meal should
  // only land once per week unless there genuinely aren't enough different meals.
  const used = new Set(result.filter(Boolean).map(d => d.text));
  let deck = [];
  slotsToFill.forEach((i) => {
    if (deck.length === 0) deck = weightedDeck(recentNames).sort(() => Math.random() - 0.5);
    let idx = -1;
    for (let j = deck.length - 1; j >= 0; j--) if (!used.has(deck[j])) { idx = j; break; }
    if (idx === -1) {
      // everything left in the deck is already this week - try the full meal list before repeating
      const fresh = meals.map(m => m.name).filter(n => !used.has(n));
      const pick = fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : deck.pop();
      used.add(pick);
      result[i] = { text: pick, locked: false };
      return;
    }
    const pick = deck.splice(idx, 1)[0];
    used.add(pick);
    result[i] = { text: pick, locked: false };
  });
  return result;
}

function renderWeek() {
  const list = document.getElementById("weekList");
  list.innerHTML = "";
  const hasPlan = week.some(d => d !== null);
  const weekWord = ["this week", "next week", "that week", "that week"][viewOffset];
  document.getElementById("shuffleLabel").textContent = hasPlan ? "Shuffle again" : `Plan ${weekWord}`;
  document.getElementById("shuffleBtn").disabled = meals.length === 0;
  renderWeekNav();

  const todayIndex = viewOffset === 0 ? new Date().getDay() : -1;
  DAYS.forEach((day, i) => {
    const d = week[i];
    const date = dayDate(viewOffset, i);
    const note = notes[isoDate(date)];
    const row = document.createElement("div");
    row.className = "day-row pop-in" + (d && d.locked ? " locked" : "") + (d && d.eatingOut ? " eating-out" : "") + (i === todayIndex ? " today" : "") + (note ? " has-note" : "");
    row.style.animationDelay = (i * 0.05) + "s";
    row.id = "day-" + i;
    const col = DAY_COLORS[i];
    row.style.setProperty("--day-bg", col.bg);
    row.style.setProperty("--day-fg", col.fg);
    row.innerHTML = `
      <div class="day-badge"><span class="day-name">${day}</span><span class="day-date">${date.getDate()}</span></div>
      <button class="day-meal-btn" data-open="${i}">
        <div class="day-meal ${d ? "" : "empty"}">${d ? mealLabel(d.text) : (currentLook().noEmoji ? "To be decided" : "🎲 Not decided yet")}</div>
        ${d && d.eatingOut ? `<div class="lock-tag eating-out-tag">🥡 Eating out</div>` : (d && d.locked ? `<div class="lock-tag"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3z"/></svg>Locked</div>` : "")}
        ${d && d.vetoedBy ? `<div class="veto-tag">${currentLook().noEmoji ? "" : "🙅 "}${escapeHtml(d.vetoedBy)} vetoed ${escapeHtml(d.vetoed || "it")}</div>` : ""}
        ${note ? `<div class="day-note">${currentLook().noEmoji ? "" : "📝 "}${escapeHtml(note)}</div>` : ""}
      </button>
      <div class="day-actions">
        ${(d && !d.locked) ? `<button class="reroll-btn" data-reroll="${i}" aria-label="Reroll ${day}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0114.85-3.36L23 10M1 14l4.65 4.36A9 9 0 0020.5 15"/></svg>
        </button>` : ""}
        ${d && d.eatingOut ? "" : `<button class="lock-btn ${d && d.locked ? "active" : ""}" data-lock="${i}" aria-label="${d && d.locked ? "Unlock" : "Lock"} ${day}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3z"/></svg>
        </button>`}
      </div>
    `;
    list.appendChild(row);
  });

  document.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => openDayModal(parseInt(btn.dataset.open)));
  });
  document.querySelectorAll("[data-reroll]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); rerollDay(parseInt(btn.dataset.reroll)); });
  });
  document.querySelectorAll("[data-lock]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleLock(parseInt(btn.dataset.lock)); });
  });
  list.querySelectorAll(".day-row").forEach((row, i) => enableDayDrag(row, i));

  renderTonight();
  renderRating();
  renderSwipeStatus();
  renderShopWeeks();
  renderShoppingList();
}

// ---- Week switcher: this week + up to 3 weeks ahead ----
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function weekRangeLabel(offset) {
  const a = dayDate(offset, 0), b = dayDate(offset, 6);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${SHORT_MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${SHORT_MONTHS[a.getMonth()]} – ${b.getDate()} ${SHORT_MONTHS[b.getMonth()]}`;
}
function weekTitle(offset) { return ["This week", "Next week", "In 2 weeks", "In 3 weeks"][offset]; }
function renderWeekNav() {
  document.getElementById("weekNavTitle").textContent = weekTitle(viewOffset);
  document.getElementById("weekNavDates").textContent = weekRangeLabel(viewOffset);
  document.getElementById("weekPrev").disabled = viewOffset === 0;
  document.getElementById("weekNext").disabled = viewOffset === MAX_WEEKS_AHEAD;
  document.getElementById("planView").classList.toggle("future-week", viewOffset > 0);
  document.querySelectorAll("#weekDots [data-week]").forEach(dot => {
    const o = parseInt(dot.dataset.week);
    dot.classList.toggle("active", o === viewOffset);
    dot.classList.toggle("planned", weekDays(o).some(d => d));
  });
}
function goToWeek(offset) {
  viewOffset = Math.max(0, Math.min(MAX_WEEKS_AHEAD, offset));
  week = weekDays(viewOffset);
  renderWeek();
}
document.getElementById("weekPrev").addEventListener("click", () => goToWeek(viewOffset - 1));
document.getElementById("weekNext").addEventListener("click", () => goToWeek(viewOffset + 1));
document.getElementById("weekDots").addEventListener("click", (e) => {
  const dot = e.target.closest("[data-week]");
  if (dot) goToWeek(parseInt(dot.dataset.week));
});

// ---- Which week(s) the shopping list covers ----
let shopWeeks = [0];
function renderShopWeeks() {
  const box = document.getElementById("shopWeeks");
  const options = [0, 1, 2, 3].filter(o => o === 0 || weekDays(o).some(d => d));
  const hint = document.getElementById("shopHint");
  if (options.length === 1) {
    box.hidden = true; shopWeeks = [0];
    hint.textContent = "Ingredients for everything planned this week.";
    return;
  }
  box.hidden = false;
  hint.textContent = "Ingredients for everything planned in:";
  shopWeeks = shopWeeks.filter(o => options.includes(o));
  if (!shopWeeks.length) shopWeeks = [0];
  box.innerHTML = options.map(o =>
    `<button type="button" class="chip shop-week-chip${shopWeeks.includes(o) ? " active" : ""}" data-shop-week="${o}" aria-pressed="${shopWeeks.includes(o)}">${weekTitle(o)}</button>`
  ).join("");
}
document.getElementById("shopWeeks").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-shop-week]");
  if (!chip) return;
  const o = parseInt(chip.dataset.shopWeek);
  shopWeeks = shopWeeks.includes(o) ? shopWeeks.filter(x => x !== o) : [...shopWeeks, o].sort();
  if (!shopWeeks.length) shopWeeks = [o];
  renderShopWeeks();
  renderShoppingList();
});

// ---- Drag a day (by its day badge) onto another day to swap them ----
function enableDayDrag(row, i) {
  const handle = row.querySelector(".day-badge");
  handle.setAttribute("title", "Drag to swap with another day");
  handle.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const startY = e.clientY;
    // Other rows don't move during a drag, so their positions can be measured once.
    const others = [...document.querySelectorAll("#weekList .day-row")]
      .map((r, j) => ({ r, j, rect: r.getBoundingClientRect() }))
      .filter(o => o.j !== i);
    let moved = false;
    let target = null;
    try { handle.setPointerCapture(e.pointerId); } catch (err) {}

    const onMove = (ev) => {
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dy) < 6) return;
      if (!moved) { moved = true; row.classList.add("dragging"); }
      row.style.translate = `0 ${dy}px`;
      const over = others.find(o => ev.clientY >= o.rect.top && ev.clientY <= o.rect.bottom);
      const next = over ? over.j : null;
      if (next !== target) {
        others.forEach(o => o.r.classList.toggle("drop-target", o.j === next));
        target = next;
      }
    };
    const onEnd = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onEnd);
      handle.removeEventListener("pointercancel", onEnd);
      row.classList.remove("dragging");
      row.style.translate = "";
      others.forEach(o => o.r.classList.remove("drop-target"));
      if (moved && target !== null) swapDays(i, target);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onEnd);
    handle.addEventListener("pointercancel", onEnd);
  });
}
function swapDays(a, b, isUndo = false) {
  [week[a], week[b]] = [week[b], week[a]];
  saveWeek(week);
  renderWeek();
  if (currentLook().shuffle !== "classic") animateDays([a, b]);
  if (!isUndo) showToast(`Swapped ${FULL_DAYS[a]} and ${FULL_DAYS[b]}`, { undo: () => swapDays(a, b, true) });
}

const FULL_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function renderTonight() {
  const card = document.getElementById("tonightCard");
  const i = new Date().getDay();
  const d = weekDays(0)[i];
  const next = i === 6 ? weekDays(1)[0] : weekDays(0)[i + 1];
  const note = notes[dateKey(0, i)];
  const nextMeal = next ? mealByName(next.text) : null;
  const meal = d && !d.eatingOut ? mealByName(d.text) : null;
  const ingCount = meal ? (meal.ingredients || []).length : 0;
  let main, sub;
  if (!d) {
    main = `<span class="tonight-emoji">🎲</span><span class="tonight-meal empty">Nothing planned yet</span>`;
    sub = "Tap to pick something";
  } else if (d.eatingOut) {
    main = `<span class="tonight-emoji">🥡</span><span class="tonight-meal">${escapeHtml(d.text)}</span>`;
    sub = "Night off — no cooking!";
  } else {
    main = `<span class="tonight-emoji">${getMealEmoji(d.text)}</span><span class="tonight-meal">${escapeHtml(d.text)}</span>`;
    sub = ingCount ? `${ingCount} ingredient${ingCount === 1 ? "" : "s"}` : "";
  }
  if (note) sub = (sub ? sub + " · " : "") + escapeHtml(note);
  card.innerHTML = `
    <span class="tonight-magnet" aria-hidden="true"></span>
    <span class="tonight-label">Tonight · ${FULL_DAYS[i]}</span>
    <span class="tonight-main">${main}</span>
    ${sub ? `<span class="tonight-sub">${sub}</span>` : ""}
    <span class="tonight-next">Tomorrow: ${next ? mealLabel(next.text) : "not decided yet"}${nextMeal && nextMeal.defrost && !next.eatingOut ? ` <span class="tonight-defrost">🧊 defrost tonight</span>` : ""}</span>
  `;
  card.setAttribute("aria-label", `Tonight: ${d ? d.text : "nothing planned"}. Tap to edit.`);
}
document.getElementById("tonightCard").addEventListener("click", () => {
  if (viewOffset !== 0) goToWeek(0);
  openDayModal(new Date().getDay());
});

// Put a week back exactly as it was (used by Undo), even if you've since switched weeks.
function restoreWeek(offset, days) {
  savePlanWeek(weekKey(offset), days);
  if (offset === viewOffset) week = days;
  renderWeek();
}

function toggleLock(i) {
  if (!week[i]) return; // nothing to lock
  if (week[i].eatingOut) return; // eating-out days are locked by design - edit the day to change it
  week[i] = { ...week[i], locked: !week[i].locked };
  saveWeek(week);
  renderWeek();
}

function shuffleAll() {
  if (meals.length === 0) return;
  const btn = document.getElementById("shuffleBtn");
  btn.classList.add("pop", "spin");
  playNomSound();
  setTimeout(() => {
    const before = week;
    const offset = viewOffset;
    const beforeHistory = history;
    const beforeTicks = shopView().ticks;
    const affectsShop = shopWeeks.includes(offset);
    week = pickWeek();
    saveWeek(week);
    if (affectsShop) clearShopTicks(); // new week, new shop
    if (offset === 0) saveHistory([week.filter(d => d && !d.eatingOut).map(d => d.text), ...history].slice(0, 2));
    showToast(`${weekTitle(offset)} planned`, {
      undo: () => {
        restoreWeek(offset, before);
        if (offset === 0) saveHistory(beforeHistory);
        if (affectsShop && beforeTicks.length) queueShopOp({ type: "setTicks", keys: beforeTicks });
      },
    });
    renderWeek();
    animateDays(week.map((d, i) => (d && !(before[i] && (before[i].locked || before[i].eatingOut))) ? i : -1).filter(i => i >= 0));
    btn.classList.remove("pop", "spin");
    if (settings.confetti !== false) spawnConfetti(btn);
    document.getElementById("pageSubtitle").textContent = FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)];
  }, 380);
}

function rerollDay(i) {
  if (meals.length === 0) return;
  if (week[i] && (week[i].locked || week[i].eatingOut)) return;
  const currentText = week[i] ? week[i].text : null;
  const next = pickReplacement(i, [currentText]);
  week[i] = { text: next, locked: false };
  saveWeek(week);
  renderWeek();
  if (currentLook().shuffle !== "classic") { animateDays([i]); return; }
  const row = document.getElementById("day-" + i);
  if (row) {
    row.classList.add("wiggle");
    setTimeout(() => row.classList.remove("wiggle"), 380);
  }
}

// ---- Swipe & match: each of you swipes the meals for a week; matches get picked far more often ----
let swipeChain = Promise.resolve();
let swipeDeck = [];
let swipeOffset = 0;
function mySwipes(offset = swipeOffset) {
  const wk = swipes[weekKey(offset)] || {};
  return wk[getMe()] || {};
}
function swipeMatches(offset = viewOffset) {
  const byPerson = swipes[weekKey(offset)] || {};
  const names = Object.keys(byPerson);
  if (names.length < 2) return [];
  return meals.map(m => m.name).filter(n => names.every(p => byPerson[p] && byPerson[p][n] === true));
}
function renderSwipeStatus() {
  const status = document.getElementById("swipeStatus");
  const launch = document.getElementById("swipeLaunchBtn");
  const byPerson = swipes[weekKey(viewOffset)] || {};
  const me = getMe();
  const swiped = Object.keys(byPerson).filter(p => Object.keys(byPerson[p] || {}).length);
  const other = otherPerson();
  const iDone = me && swiped.includes(me) && meals.every(m => m.name in (byPerson[me] || {}));
  launch.textContent = iDone ? "💞 Change my swipes" : swiped.includes(me) ? "💞 Finish swiping" : "💞 Swipe to choose together";
  const matches = swipeMatches(viewOffset);
  if (swiped.length >= 2) {
    status.textContent = matches.length
      ? `${matches.length} match${matches.length === 1 ? "" : "es"} — the shuffle will favour ${matches.length === 1 ? "it" : "them"}`
      : "No matches yet — the shuffle uses what either of you liked";
  } else if (swiped.length === 1) {
    status.textContent = swiped[0] === me ? `Waiting for ${other || "the other phone"} to swipe` : `${swiped[0]} has swiped — your turn!`;
  } else {
    status.textContent = "";
  }
}
function openSwipe() {
  if (!getMe()) { openWhoModal(); return; }
  swipeOffset = viewOffset;
  const done = mySwipes();
  // Unswiped meals first (shuffled), then anything already swiped so you can change your mind
  const fresh = meals.filter(m => !(m.name in done)).sort(() => Math.random() - 0.5);
  swipeDeck = fresh.length ? fresh : meals.slice().sort(() => Math.random() - 0.5);
  document.getElementById("swipeTitle").textContent = `${weekTitle(swipeOffset)}: what do you fancy?`;
  document.getElementById("swipeOverlay").classList.add("active");
  renderSwipeCards();
}
function closeSwipe() {
  document.getElementById("swipeOverlay").classList.remove("active");
  renderWeek();
}
function swipeCardHtml(m, isTop) {
  const ings = (m.ingredients || []).slice(0, 5).join(", ");
  return `<div class="swipe-card${isTop ? " top" : ""}" data-name="${escapeHtml(m.name)}">
    <div class="swipe-photo"><span class="swipe-emoji">${getMealEmoji(m.name)}</span>${safeImage(m.image)
      ? `<img src="${escapeHtml(safeImage(m.image))}" alt="" referrerpolicy="no-referrer" draggable="false" onerror="this.remove()">` : ""}</div>
    <div class="swipe-body">
      <div class="swipe-name">${escapeHtml(m.name)}${m.favourite ? ' <span class="swipe-fav">★</span>' : ""}</div>
      ${ings ? `<div class="swipe-ings">${escapeHtml(ings)}${(m.ingredients || []).length > 5 ? "…" : ""}</div>` : ""}
    </div>
    <span class="swipe-stamp yes">YES!</span><span class="swipe-stamp no">NOPE</span>
  </div>`;
}
function renderSwipeCards() {
  const stack = document.getElementById("swipeStack");
  const total = meals.length;
  const done = Object.keys(mySwipes()).filter(n => mealByName(n)).length;
  document.getElementById("swipeProgress").textContent = swipeDeck.length ? `${Math.min(done + 1, total)} of ${total}` : "All done!";
  document.getElementById("swipeActions").hidden = !swipeDeck.length;
  document.getElementById("swipeHint").hidden = !swipeDeck.length;
  if (!swipeDeck.length) { stack.innerHTML = swipeSummaryHtml(); return; }
  // Render the next card underneath, then the top card
  stack.innerHTML = (swipeDeck[1] ? swipeCardHtml(swipeDeck[1], false) : "") + swipeCardHtml(swipeDeck[0], true);
  enableCardDrag(stack.querySelector(".swipe-card.top"));
}
function swipeSummaryHtml() {
  const mine = mySwipes();
  const liked = meals.filter(m => mine[m.name] === true).map(m => m.name);
  const matches = swipeMatches(swipeOffset);
  const byPerson = swipes[weekKey(swipeOffset)] || {};
  const other = Object.keys(byPerson).find(p => p !== getMe() && Object.keys(byPerson[p] || {}).length);
  let html = `<div class="swipe-summary"><div class="swipe-summary-emoji">${matches.length ? "💞" : "👍"}</div>`;
  html += `<p class="swipe-summary-line">You fancy <strong>${liked.length}</strong> meal${liked.length === 1 ? "" : "s"} ${weekTitle(swipeOffset).toLowerCase()}.</p>`;
  if (other) {
    html += matches.length
      ? `<p class="swipe-summary-line">You and ${escapeHtml(other)} matched on <strong>${matches.length}</strong>:</p><p class="swipe-matches">${matches.map(escapeHtml).join(" · ")}</p>`
      : `<p class="swipe-summary-line">No matches with ${escapeHtml(other)} yet — the shuffle will use what either of you liked.</p>`;
  } else {
    html += `<p class="swipe-summary-line">Waiting for ${escapeHtml(otherPerson() || "the other phone")} to swipe. The shuffle will use both of your picks.</p>`;
  }
  html += `<div class="swipe-summary-actions"><button type="button" class="btn-primary" id="swipeShuffleBtn">Shuffle ${escapeHtml(weekTitle(swipeOffset).toLowerCase())}</button><button type="button" class="btn-secondary" id="swipeRedoBtn">Start again</button></div></div>`;
  return html;
}
document.getElementById("swipeStack").addEventListener("click", (e) => {
  if (e.target.closest("#swipeShuffleBtn")) {
    closeSwipe();
    if (viewOffset !== swipeOffset) goToWeek(swipeOffset);
    shuffleAll();
  } else if (e.target.closest("#swipeRedoBtn")) {
    swipeDeck = meals.slice().sort(() => Math.random() - 0.5);
    renderSwipeCards();
  }
});
function decideSwipe(yes) {
  const card = document.querySelector("#swipeStack .swipe-card.top");
  if (!card || card.classList.contains("leaving")) return;
  const name = card.dataset.name;
  card.classList.add("leaving", yes ? "to-yes" : "to-no");
  saveSwipe(swipeOffset, name, yes);
  try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  setTimeout(() => { swipeDeck.shift(); renderSwipeCards(); }, prefersReducedMotion() ? 0 : 220);
}
function enableCardDrag(card) {
  if (!card) return;
  let startX = 0, startY = 0, dx = 0, dragging = false;
  card.addEventListener("pointerdown", (e) => {
    dragging = true; startX = e.clientX; startY = e.clientY; dx = 0;
    card.setPointerCapture(e.pointerId);
    card.classList.add("dragging");
  });
  card.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    const dy = (e.clientY - startY) * 0.2;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    card.style.setProperty("--yes", String(Math.max(0, Math.min(1, dx / 90))));
    card.style.setProperty("--no", String(Math.max(0, Math.min(1, -dx / 90))));
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("dragging");
    if (Math.abs(dx) > 90) { decideSwipe(dx > 0); return; }
    card.style.transform = "";
    card.style.setProperty("--yes", "0");
    card.style.setProperty("--no", "0");
  };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", end);
}
function saveSwipe(offset, name, yes) {
  const key = weekKey(offset);
  const me = getMe();
  swipes[key] = swipes[key] || {};
  swipes[key][me] = { ...(swipes[key][me] || {}), [name]: yes };
  swipeChain = swipeChain.then(async () => {
    try {
      const latest = normaliseSwipes(await stateGet("swipes", {}));
      latest[key] = latest[key] || {};
      latest[key][me] = { ...(latest[key][me] || {}), [name]: yes };
      const oldest = weekKey(-2);
      for (const k of Object.keys(latest)) if (k < oldest) delete latest[k];
      await stateSet("swipes", latest);
      // keep my latest local votes on top of whatever the other phone has saved
      latest[key][me] = { ...latest[key][me], ...swipes[key][me] };
      swipes = latest;
    } catch (e) {
      showToast("Couldn't save your swipes — check your connection.");
    }
  });
}
document.getElementById("swipeLaunchBtn").addEventListener("click", openSwipe);
document.getElementById("swipeClose").addEventListener("click", closeSwipe);
document.getElementById("swipeYes").addEventListener("click", () => decideSwipe(true));
document.getElementById("swipeNo").addEventListener("click", () => decideSwipe(false));
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("swipeOverlay").classList.contains("active")) return;
  if (e.key === "ArrowRight") decideSwipe(true);
  else if (e.key === "ArrowLeft") decideSwipe(false);
  else if (e.key === "Escape") closeSwipe();
});

// Pick one meal for day i: weighted, avoiding the given names and anything else already this week.
function pickReplacement(i, avoid = []) {
  const taken = new Set([...avoid, ...week.filter((d, j) => d && j !== i).map(d => d.text)].filter(Boolean));
  let pool = meals.filter(m => !taken.has(m.name) && mealWeight(m.name) > 0);
  if (!pool.length) pool = meals.filter(m => !avoid.includes(m.name));
  if (!pool.length) pool = meals;
  const deck = pool.flatMap(m => Array(deckCopies(mealWeight(m.name)) || 1).fill(m.name));
  return deck[Math.floor(Math.random() * deck.length)];
}

// ---- Vetoes: one each per week. Re-rolls the day and stamps it "vetoed by ..." ----
function vetoesLeft(person, days = week) {
  return Math.max(0, 1 - days.filter(d => d && d.vetoedBy === person).length);
}
function vetoDay(i) {
  const me = getMe();
  if (!me) { closeDayModal(); openWhoModal(); return; }
  const d = week[i];
  if (!d || d.eatingOut || d.locked || vetoesLeft(me) === 0) return;
  const offset = viewOffset;
  const before = week.slice();
  const vetoed = d.text;
  const pick = pickReplacement(i, [vetoed]);
  week[i] = { text: pick, locked: false, vetoedBy: me, vetoed };
  saveWeek(week);
  closeDayModal();
  playNomSound();
  renderWeek();
  animateDays([i]);
  const row = document.getElementById("day-" + i);
  if (row) { row.classList.add("veto-stamp"); setTimeout(() => row.classList.remove("veto-stamp"), 900); }
  showToast(`🙅 ${vetoed} vetoed — ${pick} instead`, { undo: () => restoreWeek(offset, before) });
}

function resetWeek() {
  const before = week;
  const offset = viewOffset;
  const beforeTicks = shopView().ticks;
  const affectsShop = shopWeeks.includes(offset);
  week = week.map(d => d && (d.locked || d.eatingOut) ? d : null);
  saveWeek(week);
  if (affectsShop) clearShopTicks();
  renderWeek();
  showToast(`${weekTitle(offset)} cleared (locked days kept)`, {
    undo: () => {
      restoreWeek(offset, before);
      if (affectsShop && beforeTicks.length) queueShopOp({ type: "setTicks", keys: beforeTicks });
    },
  });
}
document.getElementById("resetWeekBtn").addEventListener("click", resetWeek);

// ---- Aisles: group the shopping list in the order you walk round the shop ----
const AISLES = [
  { id: "veg", label: "Fruit & veg", emoji: "🥕" },
  { id: "meat", label: "Meat & fish", emoji: "🥩" },
  { id: "dairy", label: "Dairy & eggs", emoji: "🧀" },
  { id: "bakery", label: "Bakery", emoji: "🍞" },
  { id: "cupboard", label: "Cupboard", emoji: "🥫" },
  { id: "frozen", label: "Frozen", emoji: "🧊" },
  { id: "other", label: "Everything else", emoji: "🛒" },
];
// First match wins, so the specific rules come before the general ones
// (e.g. "chicken stock" is cupboard, "chicken nuggets" is frozen, "chicken" is meat).
const AISLE_RULES = [
  ["cupboard", /tortilla chips|crisps/i],
  ["frozen", /frozen|nugget|fish ?finger|kiev|yorkshire|fishcake|ice ?cream|\bchips\b|hash ?brown|waffle/i],
  ["cupboard", /\btins?\b|tinned|canned|passata|sauce|stock|gravy|paste|coconut|hoops|\bkit\b|granules|\bbeans\b|salsa|ketchup|mayo|soy|vinegar|\boil\b|flour|sugar|spice|seasoning|cumin|paprika|dried|taco shell|stuffing|\bjar\b|rice|pasta|spaghetti|penne|noodle|lasagne|macaroni|couscous|oats|cereal|biscuit/i],
  ["meat", /mince|beef|chicken|turkey|pork|lamb|steak|sausage|bacon|pancetta|\bham\b|gammon|chorizo|salami|meatball|fish|salmon|\bcod\b|haddock|prawn|tuna|mackerel|tofu|quorn/i],
  ["dairy", /chees|cheddar|mozzarella|parmesan|halloumi|feta|milk|cream|butter|yog|cr[eè]me|\beggs?\b/i],
  ["bakery", /bread|\brolls?\b|\bwraps?\b|tortilla|pitta|naan|bagel|baguette|\bbuns?\b|crumpet|pizza base|croissant/i],
  ["veg", /onion|garlic|potato|carrot|broccoli|lettuce|tomato|pepper|mushroom|coriander|parsley|basil|ginger|lemon|lime|spinach|\bpeas\b|courgette|leek|celery|cucumber|avocado|herb|\bveg|salad|sweetcorn|cabbage|cauliflower|parsnip|swede|apple|banana|berr|fruit|chilli|kale|beansprout|squash|aubergine/i],
];
function aisleFor(text) {
  for (const [id, re] of AISLE_RULES) if (re.test(text)) return id;
  return "other";
}

function buildShoppingList(view = shopView()) {
  const seen = new Map();
  shopWeeks.flatMap(o => weekDays(o)).forEach(d => {
    if (!d || d.eatingOut) return;
    const meal = mealByName(d.text);
    if (!meal) return;
    (meal.ingredients || []).forEach(ing => {
      const key = ing.trim().toLowerCase();
      if (!key) return;
      if (seen.has(key)) {
        seen.get(key).count++;
      } else {
        seen.set(key, { key, text: ing.trim(), count: 1, aisle: aisleFor(ing), fromMeal: true });
      }
    });
  });
  // Things you've added yourself (milk, bin bags...)
  view.extras.items.forEach(x => {
    if (seen.has(x.key)) seen.get(x.key).extra = true;
    else seen.set(x.key, { key: x.key, text: x.text, count: 1, aisle: aisleFor(x.text), extra: true });
  });
  const order = orderedAisles().map(a => a.id);
  return [...seen.values()].sort((a, b) => order.indexOf(a.aisle) - order.indexOf(b.aisle));
}

// ---- Your shop's layout: aisle order (shared, so you both walk the same route) ----
function orderedAisles() {
  const saved = Array.isArray(settings.aisleOrder) ? settings.aisleOrder : [];
  const known = saved.map(id => AISLES.find(a => a.id === id)).filter(Boolean);
  return [...known, ...AISLES.filter(a => !saved.includes(a.id))];
}
function renderAisleOrder() {
  const list = orderedAisles();
  document.getElementById("aisleOrder").innerHTML = list.map((a, i) => `
    <li class="aisle-row">
      <span class="aisle-name"><span aria-hidden="true">${a.emoji}</span> ${escapeHtml(a.label)}</span>
      <span class="aisle-moves">
        <button type="button" class="icon-btn" data-aisle-move="${a.id}" data-dir="-1" aria-label="Move ${escapeHtml(a.label)} earlier" ${i === 0 ? "disabled" : ""}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>
        </button>
        <button type="button" class="icon-btn" data-aisle-move="${a.id}" data-dir="1" aria-label="Move ${escapeHtml(a.label)} later" ${i === list.length - 1 ? "disabled" : ""}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </span>
    </li>`).join("");
}
document.getElementById("aisleOrder").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-aisle-move]");
  if (!btn || btn.disabled) return;
  const ids = orderedAisles().map(a => a.id);
  const i = ids.indexOf(btn.dataset.aisleMove);
  const j = i + parseInt(btn.dataset.dir);
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  settings.aisleOrder = ids;
  saveSettings(settings);
  renderAisleOrder();
  renderShoppingList();
  const moved = document.querySelector(`[data-aisle-move="${btn.dataset.aisleMove}"][data-dir="${btn.dataset.dir}"]`);
  if (moved && !moved.disabled) moved.focus();
});

function formatShoppingItem(item) {
  return item.text + (item.count > 1 ? ` ×${item.count}` : "");
}

let lastShopHtml = "";
function renderShoppingList() {
  const view = shopView();
  const items = buildShoppingList(view);
  const ul = document.getElementById("shopList");
  const progress = document.getElementById("shopProgress");
  const finishBtn = document.getElementById("clearTicksBtn");
  const syncNote = shopOffline && shopQueue.length ? " · 📶 No signal — saved on this phone, will sync" : "";

  // Suggestions for the add box: things you've added before that aren't on the list now
  const onList = new Set(items.map(i => i.key));
  document.getElementById("shopPastItems").innerHTML = view.extras.past
    .filter(p => !onList.has(p.toLowerCase())).slice(0, 60)
    .map(p => `<option value="${escapeHtml(p)}"></option>`).join("");

  if (items.length === 0) {
    ul.innerHTML = `<li class="shop-empty">Plan your week, or add something above.</li>`;
    lastShopHtml = "";
    progress.textContent = syncNote.replace(/^ · /, "");
    finishBtn.hidden = true;
    return;
  }
  const tickSet = new Set(view.ticks);
  const done = items.filter(i => tickSet.has(i.key)).length;
  const html = orderedAisles().map(a => {
    const group = items.filter(i => i.aisle === a.id);
    if (!group.length) return "";
    return `<li class="shop-aisle" role="presentation"><span class="shop-aisle-emoji" aria-hidden="true">${a.emoji}</span>${escapeHtml(a.label)}</li>` +
      group.map(i => {
        const on = tickSet.has(i.key);
        const removable = i.extra && !i.fromMeal;
        return `<li class="shop-item${on ? " ticked" : ""}${i.extra ? " extra" : ""}" role="checkbox" tabindex="0" aria-checked="${on}" data-tick="${escapeHtml(i.key)}">` +
          `<span class="shop-item-text">${escapeHtml(formatShoppingItem(i))}</span>` +
          (removable ? `<button type="button" class="shop-remove" data-remove="${escapeHtml(i.key)}" aria-label="Remove ${escapeHtml(i.text)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : "") +
          `</li>`;
      }).join("");
  }).join("");
  if (html !== lastShopHtml) { ul.innerHTML = html; lastShopHtml = html; } // avoid flicker on background refreshes
  progress.textContent = (done === 0 ? "Tap an item to tick it off — you'll both see it."
    : done === items.length ? "All done — everything's in the trolley! 🎉"
    : `${done} of ${items.length} in the trolley`) + syncNote;
  finishBtn.hidden = done === 0;
  renderActivity();
}

// ---- Shopping: ticks + your own items, shared between phones and safe with no signal ----
// Server data: "ticks" = [item keys]; "extras" = { items: [{key, text}], past: [text, ...] }.
// Every change is queued on this phone first (so it survives no signal and app restarts),
// then replayed on top of the latest server copy - two people ticking at once never clash.
const SHOP_QUEUE_KEY = "mp_shop_queue";
let serverTicks = [];
let serverExtras = { items: [], past: [] };
let shopQueue = loadShopQueue();
let shopOffline = false;
let shopFlushing = false;
let shopPoll = null;

function loadShopQueue() {
  try { const q = JSON.parse(localStorage.getItem(SHOP_QUEUE_KEY) || "[]"); return Array.isArray(q) ? q : []; }
  catch (e) { return []; }
}
function persistShopQueue() {
  try { localStorage.setItem(SHOP_QUEUE_KEY, JSON.stringify(shopQueue)); } catch (e) {}
}
function normaliseExtras(v) {
  return {
    items: Array.isArray(v && v.items) ? v.items.filter(i => i && i.key && i.text) : [],
    past: Array.isArray(v && v.past) ? v.past.filter(p => typeof p === "string") : [],
  };
}
function applyShopOp(state, op) {
  const ticks = new Set(state.ticks);
  let items = state.extras.items;
  let past = state.extras.past;
  switch (op.type) {
    case "tick": if (op.on) ticks.add(op.key); else ticks.delete(op.key); break;
    case "setTicks": ticks.clear(); op.keys.forEach(k => ticks.add(k)); break;
    case "addExtra":
      if (!items.some(i => i.key === op.key)) items = [...items, { key: op.key, text: op.text }];
      past = [op.text, ...past.filter(p => p.toLowerCase() !== op.key)].slice(0, 150);
      break;
    case "removeExtra": items = items.filter(i => i.key !== op.key); ticks.delete(op.key); break;
    case "setExtras": items = op.items; break;
    case "finishShop": items = items.filter(i => !ticks.has(i.key)); ticks.clear(); break;
  }
  return { ticks: [...ticks], extras: { items, past } };
}
function shopView() {
  return shopQueue.reduce(applyShopOp, { ticks: serverTicks, extras: serverExtras });
}
function queueShopOp(op) {
  shopQueue.push(op);
  persistShopQueue();
  renderShoppingList();
  flushShopQueue();
}
async function flushShopQueue() {
  if (shopFlushing || shopQueue.length === 0) return;
  shopFlushing = true;
  const batch = shopQueue.slice();
  try {
    const [t, x] = await Promise.all([stateGet("ticks", []), stateGet("extras", null)]);
    const base = { ticks: Array.isArray(t) ? t : [], extras: normaliseExtras(x) };
    const next = batch.reduce(applyShopOp, base);
    const writes = [];
    if (JSON.stringify(next.ticks) !== JSON.stringify(base.ticks)) writes.push(stateSet("ticks", next.ticks));
    if (JSON.stringify(next.extras) !== JSON.stringify(base.extras)) writes.push(stateSet("extras", next.extras));
    await Promise.all(writes);
    serverTicks = next.ticks;
    serverExtras = next.extras;
    shopQueue = shopQueue.slice(batch.length);
    persistShopQueue();
    shopOffline = false;
    recordActivity(batch);
  } catch (e) {
    shopOffline = true;
  } finally {
    shopFlushing = false;
    renderShoppingList();
    if (!shopOffline && shopQueue.length) flushShopQueue();
  }
}
async function refreshShop() {
  if (document.hidden) return;
  if (shopQueue.length) { flushShopQueue(); return; }
  try {
    const [t, x, a] = await Promise.all([stateGet("ticks", []), stateGet("extras", null), stateGet("activity", []).catch(() => null)]);
    if (Array.isArray(a)) activity = a;
    if (shopQueue.length) return; // a change was made while we were fetching - the flush will catch up
    serverTicks = Array.isArray(t) ? t : [];
    serverExtras = normaliseExtras(x);
    shopOffline = false;
  } catch (e) {
    shopOffline = true;
  }
  renderShoppingList();
}
function startTickPolling() {
  stopTickPolling();
  refreshShop();
  shopPoll = setInterval(refreshShop, 5000);
}
function stopTickPolling() {
  if (shopPoll) clearInterval(shopPoll);
  shopPoll = null;
}
// Keep retrying queued changes in the background until they reach the server.
setInterval(() => { if (shopQueue.length) flushShopQueue(); }, 15000);
window.addEventListener("online", () => flushShopQueue());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { if (shopPoll) refreshShop(); else flushShopQueue(); }
});

// ---- Activity line: "Sarah ticked Mince beef · 2 min ago" ----
let activity = []; // newest first: [{ who, action, text, at }]
function recordActivity(batch) {
  const entries = batch
    .filter(op => op.who && op.text && ((op.type === "tick" && op.on) || op.type === "addExtra"))
    .map(op => ({ who: op.who, action: op.type === "tick" ? "ticked" : "added", text: op.text, at: op.at || Date.now() }))
    .reverse();
  if (!entries.length) return;
  activity = [...entries, ...activity].slice(0, 30);
  (async () => {
    try {
      const latest = await stateGet("activity", []);
      await stateSet("activity", [...entries, ...(Array.isArray(latest) ? latest : [])].slice(0, 30));
    } catch (e) { /* nice-to-have - never block the shop */ }
  })();
}
function timeAgo(ms) {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}
function renderActivity() {
  const el = document.getElementById("shopActivity");
  const me = getMe();
  const latest = activity.find(a => a && a.who && a.who !== me && Date.now() - a.at < 3 * 3600e3);
  el.hidden = !latest;
  if (latest) el.textContent = `${currentLook().noEmoji ? "" : "🛒 "}${latest.who} ${latest.action} ${latest.text} · ${timeAgo(latest.at)}`;
}

function toggleTick(key) {
  const on = !shopView().ticks.includes(key);
  const item = buildShoppingList().find(i => i.key === key);
  queueShopOp({ type: "tick", key, on, who: getMe() || undefined, text: item ? item.text : undefined, at: Date.now() });
}
function clearShopTicks() {
  if (shopView().ticks.length) queueShopOp({ type: "setTicks", keys: [] });
}
function finishShop() {
  const before = shopView();
  const removed = before.extras.items.filter(i => before.ticks.includes(i.key)).length;
  queueShopOp({ type: "finishShop" });
  showToast(removed ? `Shop done — ${removed} added item${removed === 1 ? "" : "s"} cleared` : "Shop done — all unticked", {
    undo: () => {
      queueShopOp({ type: "setExtras", items: before.extras.items });
      queueShopOp({ type: "setTicks", keys: before.ticks });
    },
  });
}
document.getElementById("shopList").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    e.stopPropagation();
    const item = shopView().extras.items.find(i => i.key === rm.dataset.remove);
    queueShopOp({ type: "removeExtra", key: rm.dataset.remove });
    if (item) showToast(`Removed ${item.text}`, { undo: () => queueShopOp({ type: "addExtra", key: item.key, text: item.text }) });
    return;
  }
  const li = e.target.closest("[data-tick]");
  if (li) toggleTick(li.dataset.tick);
});
document.getElementById("shopList").addEventListener("keydown", (e) => {
  if (e.target.closest("[data-remove]")) return;
  const li = e.target.closest("[data-tick]");
  if (li && (e.key === " " || e.key === "Enter")) { e.preventDefault(); toggleTick(li.dataset.tick); }
});
document.getElementById("clearTicksBtn").addEventListener("click", finishShop);
document.getElementById("shopAddForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("shopAddInput");
  const text = input.value.trim().replace(/\s+/g, " ");
  if (!text) return;
  const key = text.toLowerCase();
  const existing = buildShoppingList().find(i => i.key === key);
  if (existing) {
    if (shopView().ticks.includes(key)) queueShopOp({ type: "tick", key, on: false });
    showToast(`${existing.text} is already on the list`);
  } else {
    queueShopOp({ type: "addExtra", key, text, who: getMe() || undefined, at: Date.now() });
  }
  input.value = "";
  input.focus();
});

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

document.getElementById("shuffleBtn").addEventListener("click", shuffleAll);


// ---- Day modal ----
function populateQuickPick() {
  const sel = document.getElementById("dayQuickPick");
  sel.innerHTML = `<option value="">Choose a saved meal…</option>` +
    meals.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join("");
}

function openDayModal(i) {
  editingDayIndex = i;
  const d = week[i];
  const date = dayDate(viewOffset, i);
  document.getElementById("dayModalTitle").textContent = `${FULL_DAYS[i]} ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
  document.getElementById("dayTextInput").value = d ? d.text : "";
  document.getElementById("dayNoteInput").value = notes[isoDate(date)] || "";
  // Veto button: only for a planned, unlocked meal
  const vetoBtn = document.getElementById("dayVetoBtn");
  const me = getMe();
  const canVeto = d && !d.eatingOut && !d.locked;
  vetoBtn.hidden = !canVeto;
  if (canVeto) {
    const left = me ? vetoesLeft(me) : 1;
    vetoBtn.disabled = left === 0;
    vetoBtn.textContent = left === 0 ? "🙅 You've used your veto this week" : "🙅 Veto this (1 veto each per week)";
  }
  document.getElementById("dayLockCheckbox").checked = !!(d && d.locked);
  document.getElementById("dayEatingOutCheckbox").checked = !!(d && d.eatingOut);
  populateQuickPick();
  document.getElementById("dayQuickPick").value = "";
  document.getElementById("dayModalOverlay").classList.add("active");
  document.getElementById("dayTextInput").focus();
}
function closeDayModal() {
  document.getElementById("dayModalOverlay").classList.remove("active");
  editingDayIndex = null;
}
document.getElementById("dayQuickPick").addEventListener("change", (e) => {
  if (e.target.value) document.getElementById("dayTextInput").value = e.target.value;
});
document.getElementById("dayEatingOutCheckbox").addEventListener("change", (e) => {
  const textInput = document.getElementById("dayTextInput");
  if (e.target.checked && !textInput.value.trim()) {
    textInput.value = "Takeaway";
  }
});
document.getElementById("dayModalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "dayModalOverlay") closeDayModal();
});
document.getElementById("dayVetoBtn").addEventListener("click", () => {
  if (editingDayIndex !== null) vetoDay(editingDayIndex);
});
document.getElementById("dayClearBtn").addEventListener("click", () => {
  if (editingDayIndex === null) return;
  const i = editingDayIndex;
  const offset = viewOffset;
  const beforeWeek = week.slice();
  const before = week[i];
  week[i] = null;
  saveWeek(week);
  closeDayModal();
  renderWeek();
  if (before) {
    showToast(`Cleared ${FULL_DAYS[i]}`, { undo: () => restoreWeek(offset, beforeWeek) });
  }
});
document.getElementById("daySaveBtn").addEventListener("click", () => {
  if (editingDayIndex === null) return;
  const text = document.getElementById("dayTextInput").value.trim();
  const eatingOut = document.getElementById("dayEatingOutCheckbox").checked;
  const locked = document.getElementById("dayLockCheckbox").checked || eatingOut;
  if (!text) {
    week[editingDayIndex] = null;
  } else {
    week[editingDayIndex] = { text, locked, eatingOut };
  }
  saveWeek(week);
  const date = dateKey(viewOffset, editingDayIndex);
  const note = document.getElementById("dayNoteInput").value.trim();
  if (note !== (notes[date] || "")) saveNote(date, note);
  closeDayModal();
  renderWeek();
});

// ---- Meals view ----
let mealSearch = "";
function mealMatches(m, query) {
  const haystack = (m.name + " " + (m.ingredients || []).join(" ")).toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}

function renderMeals() {
  const list = document.getElementById("mealsList");
  const favs = meals.filter(m => m.favourite).length;
  const query = mealSearch.trim();
  const shown = query ? meals.filter(m => mealMatches(m, query)) : meals;
  document.getElementById("mealsCount").textContent = meals.length === 0 ? ""
    : query ? `${shown.length} of ${meals.length} meals match`
    : `${meals.length} meal${meals.length === 1 ? "" : "s"}` + (favs ? ` · ${favs} favourite${favs === 1 ? "" : "s"}` : "");
  if (meals.length === 0) {
    list.innerHTML = `<div class="empty-state">🍽️ No meals yet. Tap “Add a meal” to add your first favourite.</div>`;
    return;
  }
  if (shown.length === 0) {
    list.innerHTML = `<div class="empty-state">No meals match “${escapeHtml(query)}”.</div>`;
    return;
  }
  list.innerHTML = shown.map(m => `
    <div class="meal-card">
      <div class="meal-card-top">
        <div class="meal-name">${safeImage(m.image) ? `<img class="meal-thumb" src="${escapeHtml(safeImage(m.image))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}${safeImage(m.image) && !currentLook().noEmoji ? escapeHtml(m.name) : mealLabel(m.name)}</div>
        <div class="meal-card-actions">
          <button class="icon-btn fav-btn ${m.favourite ? "active" : ""}" data-fav="${m.id}" aria-label="${m.favourite ? "Unfavourite" : "Favourite"} ${escapeHtml(m.name)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${m.favourite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button class="icon-btn" data-edit="${m.id}" aria-label="Edit ${escapeHtml(m.name)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg>
          </button>
          <button class="icon-btn danger" data-del="${m.id}" aria-label="Delete ${escapeHtml(m.name)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
          </button>
        </div>
      </div>
      <div class="meal-ing">${(m.ingredients||[]).map(escapeHtml).join(", ") || "No ingredients added"}</div>
      ${m.defrost ? `<div class="meal-tag">🧊 Defrost the night before</div>` : ""}
      ${ratings.byMeal[m.name] && (ratings.byMeal[m.name].up || ratings.byMeal[m.name].down)
        ? `<div class="meal-rating">${ratings.byMeal[m.name].up ? `👍 ${ratings.byMeal[m.name].up}` : ""}${ratings.byMeal[m.name].up && ratings.byMeal[m.name].down ? " · " : ""}${ratings.byMeal[m.name].down ? `👎 ${ratings.byMeal[m.name].down}` : ""}</div>` : ""}
      ${m.sourceUrl ? `<a href="${escapeHtml(m.sourceUrl)}" target="_blank" rel="noopener" class="meal-recipe-link">📖 Recipe</a>` : ""}
    </div>
  `).join("");

  list.querySelectorAll("[data-fav]").forEach(btn => {
    btn.addEventListener("click", () => toggleFavourite(btn.dataset.fav));
  });
  list.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openMealModal(btn.dataset.edit));
  });
  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => deleteMeal(btn.dataset.del));
  });
}

function toggleFavourite(id) {
  const meal = mealById(id);
  if (!meal) return;
  meal.favourite = !meal.favourite;
  saveMeals(meals);
  renderMeals();
}

// Apply a change to every day of this week and the weeks ahead; returns what they were (for Undo).
function mapUpcomingWeeks(fn) {
  const before = {};
  for (let o = 0; o <= MAX_WEEKS_AHEAD; o++) {
    const days = weekDays(o);
    const next = days.map(fn);
    if (next.some((d, i) => d !== days[i])) {
      before[o] = days;
      savePlanWeek(weekKey(o), next);
      if (o === viewOffset) week = next;
    }
  }
  return before;
}
function restoreUpcomingWeeks(before) {
  for (const [o, days] of Object.entries(before)) restoreWeek(parseInt(o), days);
}

function deleteMeal(id) {
  const meal = mealById(id);
  const beforeMeals = meals;
  meals = meals.filter(m => m.id !== id);
  saveMeals(meals);
  const beforeWeeks = meal ? mapUpcomingWeeks(d => (d && d.text === meal.name) ? null : d) : {};
  renderMeals();
  renderWeek();
  if (meal) {
    showToast(`Deleted ${meal.name}`, {
      undo: () => {
        meals = beforeMeals;
        saveMeals(meals);
        restoreUpcomingWeeks(beforeWeeks);
        renderMeals();
      },
    });
  }
}

let editingMealSourceUrl = null;
let editingMealImage = null;

// Only ever use plain http(s) image links (never javascript:, data: etc.)
function safeImage(url) {
  return typeof url === "string" && /^https?:\/\/\S+$/i.test(url.trim()) ? url.trim() : null;
}
function setMealPhoto(url) {
  url = safeImage(url);
  editingMealImage = url || null;
  const img = document.getElementById("mealPhotoPreview");
  img.hidden = !url;
  if (url) img.src = url; else img.removeAttribute("src");
}
function openMealModal(id, prefill) {
  editingMealId = id || null;
  const meal = id ? mealById(id) : null;
  editingMealSourceUrl = meal ? (meal.sourceUrl || null) : (prefill && prefill.sourceUrl) || null;
  setMealPhoto(meal ? meal.image : prefill && prefill.image);
  document.getElementById("mealModalTitle").textContent = id ? "Edit meal" : "Add a meal";
  document.getElementById("mealNameInput").value = meal ? meal.name : (prefill ? prefill.name : "");
  document.getElementById("mealIngInput").value = meal ? (meal.ingredients || []).join("\n") : (prefill ? prefill.ingredients.join("\n") : "");
  document.getElementById("mealDefrostCheckbox").checked = !!(meal && meal.defrost);
  document.getElementById("importUrlInput").value = "";
  document.getElementById("importStatus").textContent = "";
  document.getElementById("importStatus").className = "import-status";
  document.getElementById("mealModalOverlay").classList.add("active");
  document.getElementById(id || prefill ? "mealNameInput" : "importUrlInput").focus();
}
function closeMealModal() {
  document.getElementById("mealModalOverlay").classList.remove("active");
  editingMealId = null;
  editingMealSourceUrl = null;
  setMealPhoto(null);
}

// ---- Import a recipe from a link (the server reads the recipe data on the page) ----
const IMPORT_URL = "https://jamieemerydesign.co.uk/meal-planner/import.php";
async function importRecipe(link) {
  const status = document.getElementById("importStatus");
  const btn = document.getElementById("importBtn");
  const url = (link.match(/https?:\/\/\S+/i) || [""])[0].replace(/[).,]+$/, "");
  if (!url) { status.textContent = "Paste a link that starts with https://"; status.className = "import-status error"; return; }
  status.textContent = "Fetching the recipe…";
  status.className = "import-status";
  btn.disabled = true;
  try {
    const res = await fetch(`${IMPORT_URL}?url=${encodeURIComponent(url)}`, { cache: "no-store", headers: authHeaders() });
    if (res.status === 401) { handleUnauthorised(); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || "Couldn't import that recipe.");
    if (data.name) document.getElementById("mealNameInput").value = data.name;
    if (data.ingredients && data.ingredients.length) document.getElementById("mealIngInput").value = data.ingredients.join("\n");
    editingMealSourceUrl = data.sourceUrl || url;
    setMealPhoto(data.image || null);
    let site = "";
    try { site = new URL(editingMealSourceUrl).hostname.replace(/^www\./, ""); } catch (e) {}
    const n = (data.ingredients || []).length;
    status.textContent = n
      ? `✓ Got ${n} ingredient${n === 1 ? "" : "s"} from ${site}${data.totalTime ? " · " + data.totalTime : ""}. Tidy them up if you like, then save.`
      : `✓ Got the name from ${site}, but no ingredient list — add them below.`;
    status.className = "import-status ok";
  } catch (e) {
    status.textContent = (e && e.message && !/fetch|network/i.test(e.message)) ? e.message : "Couldn't reach the importer — check your connection.";
    status.className = "import-status error";
  } finally {
    btn.disabled = false;
  }
}
document.getElementById("importForm").addEventListener("submit", (e) => {
  e.preventDefault();
  importRecipe(document.getElementById("importUrlInput").value);
});
// Pasting a link imports straight away
document.getElementById("importUrlInput").addEventListener("paste", () => {
  setTimeout(() => {
    const v = document.getElementById("importUrlInput").value;
    if (/^https?:\/\//i.test(v.trim())) importRecipe(v);
  }, 0);
});
document.getElementById("mealPhotoPreview").addEventListener("error", () => setMealPhoto(null));

// Shared from another app (Android "Share" -> What's for tea?)
function handleShareTarget() {
  const q = new URLSearchParams(location.search);
  const shared = [q.get("share_url"), q.get("share_text"), q.get("share_title")].filter(Boolean).join(" ");
  if (!shared) return;
  history.replaceState(null, "", location.pathname);
  const link = (shared.match(/https?:\/\/\S+/i) || [""])[0];
  if (!link) return;
  document.querySelector('.nav-btn[data-view="meals"]').click();
  openMealModal(null);
  document.getElementById("importUrlInput").value = link;
  importRecipe(link);
}
document.getElementById("addMealBtn").addEventListener("click", () => openMealModal(null));
document.getElementById("mealCancelBtn").addEventListener("click", closeMealModal);
document.getElementById("mealModalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "mealModalOverlay") closeMealModal();
});
document.getElementById("mealSaveBtn").addEventListener("click", () => {
  const name = document.getElementById("mealNameInput").value.trim();
  if (!name) {
    document.getElementById("mealNameInput").focus();
    return;
  }
  const ingredients = document.getElementById("mealIngInput").value
    .split("\n").map(s => s.trim()).filter(Boolean);
  const oldName = editingMealId ? mealById(editingMealId).name : null;

  const defrost = document.getElementById("mealDefrostCheckbox").checked;
  if (editingMealId) {
    const meal = mealById(editingMealId);
    meal.name = name;
    meal.ingredients = ingredients;
    if (defrost) meal.defrost = true; else delete meal.defrost;
    if (editingMealImage) meal.image = editingMealImage; else delete meal.image;
    if (editingMealSourceUrl) meal.sourceUrl = editingMealSourceUrl;
    if (oldName && oldName !== name) {
      mapUpcomingWeeks(d => (d && d.text === oldName) ? { ...d, text: name } : d);
    }
  } else {
    meals.push({
      id: uid(), name, ingredients, sourceUrl: editingMealSourceUrl || undefined,
      ...(defrost ? { defrost: true } : {}), ...(editingMealImage ? { image: editingMealImage } : {}),
    });
  }
  saveMeals(meals);
  closeMealModal();
  renderMeals();
  renderWeek();
});

// ---- My meals search: the toolbar turns into a search bar in place ----
const mealsToolbar = document.getElementById("mealsToolbar");
const searchBox = document.getElementById("mealsSearch");
const searchInput = document.getElementById("mealsSearchInput");
const searchBtn = document.getElementById("mealsSearchBtn");
function setMealSearch(open) {
  mealsToolbar.classList.toggle("searching", open);
  searchBox.hidden = !open;
  searchBtn.setAttribute("aria-expanded", String(open));
  if (open) {
    searchInput.focus();
  } else {
    searchInput.value = "";
    mealSearch = "";
    renderMeals();
    searchBtn.focus();
  }
}
searchBtn.addEventListener("click", () => setMealSearch(true));
document.getElementById("mealsSearchClose").addEventListener("click", () => setMealSearch(false));
searchInput.addEventListener("input", () => { mealSearch = searchInput.value; renderMeals(); });
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMealSearch(false);
  if (e.key === "Enter") searchInput.blur(); // close the phone keyboard
});

// ---- My meals "⋯" menu ----
const moreBtn = document.getElementById("mealsMoreBtn");
const moreMenu = document.getElementById("mealsMoreMenu");
function setMoreMenu(open) {
  moreMenu.hidden = !open;
  moreBtn.setAttribute("aria-expanded", String(open));
  if (open) moreMenu.querySelector("button").focus();
}
moreBtn.addEventListener("click", (e) => { e.stopPropagation(); setMoreMenu(moreMenu.hidden); });
moreMenu.addEventListener("click", () => setMoreMenu(false));
document.addEventListener("click", (e) => { if (!moreMenu.hidden && !moreMenu.contains(e.target)) setMoreMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !moreMenu.hidden) { setMoreMenu(false); moreBtn.focus(); } });

// ---- Backup / restore ----
document.getElementById("backupMealsBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(meals, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meal-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("restoreMealsBtn").addEventListener("click", () => {
  document.getElementById("restoreFileInput").click();
});

document.getElementById("restoreFileInput").addEventListener("change", (e) => {
  const input = e.target;
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onerror = async () => {
    await showAlert("Couldn't read that file.");
    input.value = "";
  };
  reader.onload = async () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      await showAlert("That file doesn't look like a valid backup.");
      input.value = "";
      return;
    }
    if (!Array.isArray(parsed) || !parsed.every(m => m && typeof m.name === "string")) {
      await showAlert("That file doesn't look like a valid meals backup.");
      input.value = "";
      return;
    }
    const ok = await showConfirm(
      `Replace your current ${meals.length} meal(s) with the ${parsed.length} meal(s) from this backup?`,
      { title: "Restore from backup?", confirmLabel: "Replace" }
    );
    if (!ok) {
      input.value = "";
      return;
    }
    meals = parsed.map(m => ({
      id: typeof m.id === "string" ? m.id : uid(),
      name: m.name,
      ingredients: Array.isArray(m.ingredients) ? m.ingredients.filter(i => typeof i === "string") : [],
      favourite: !!m.favourite,
      sourceUrl: typeof m.sourceUrl === "string" ? m.sourceUrl : undefined,
      ...(m.defrost ? { defrost: true } : {}),
      ...(typeof m.image === "string" ? { image: m.image } : {}),
    }));
    saveMeals(meals);
    renderMeals();
    renderWeek();
    input.value = "";
  };
  reader.readAsText(file);
});

// ---- Suggest a meal from the web ----
let currentSuggestion = null;

async function fetchSuggestion() {
  const content = document.getElementById("suggestContent");
  const addBtn = document.getElementById("suggestAddBtn");
  content.innerHTML = `<p class="hint">Fetching an idea…</p>`;
  addBtn.disabled = true;
  try {
    const excluded = new Set(settings.excludedCategories || []);
    let meal = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await fetch("https://www.themealdb.com/api/json/v1/1/random.php");
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      const candidate = data.meals[0];
      if (!excluded.has(candidate.strCategory)) {
        meal = candidate;
        break;
      }
    }
    if (!meal) throw new Error("no meal outside excluded categories");
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const meas = meal[`strMeasure${i}`];
      if (ing && ing.trim()) {
        ingredients.push(`${(meas || "").trim()} ${ing.trim()}`.trim());
      }
    }
    const readMoreUrl = (meal.strSource && meal.strSource.trim())
      || `https://www.themealdb.com/meal/${meal.idMeal}`;
    currentSuggestion = { name: meal.strMeal, ingredients, sourceUrl: readMoreUrl, image: meal.strMealThumb || null };
    content.innerHTML = `
      <img src="${escapeHtml(meal.strMealThumb)}" alt="" class="suggest-photo">
      <div class="suggest-name">${getMealEmoji(meal.strMeal)} ${escapeHtml(meal.strMeal)}</div>
      <ul class="suggest-ing">${ingredients.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
      <a href="${escapeHtml(readMoreUrl)}" target="_blank" rel="noopener" class="suggest-link">📖 Read more about this recipe</a>
    `;
    addBtn.disabled = false;
  } catch (e) {
    currentSuggestion = null;
    content.innerHTML = `<p class="hint">Couldn't find an idea — check your connection, or try enabling more categories in Settings.</p>`;
  }
}
function openSuggestModal() {
  document.getElementById("suggestModalOverlay").classList.add("active");
  fetchSuggestion();
}
function closeSuggestModal() {
  document.getElementById("suggestModalOverlay").classList.remove("active");
}
document.getElementById("suggestMealBtn").addEventListener("click", openSuggestModal);
document.getElementById("suggestAnotherBtn").addEventListener("click", fetchSuggestion);
document.getElementById("suggestModalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "suggestModalOverlay") closeSuggestModal();
});
document.getElementById("suggestAddBtn").addEventListener("click", () => {
  if (!currentSuggestion) return;
  closeSuggestModal();
  openMealModal(null, currentSuggestion);
});

// ---- Settings ----
function renderSoundOptions() {
  const container = document.getElementById("soundOptions");
  container.innerHTML = SOUND_OPTIONS.map(opt => `
    <div class="sound-option ${settings.sound === opt.id ? "active" : ""}" data-sound="${opt.id}">
      <div class="sound-radio"></div>
      <div class="sound-label">${escapeHtml(opt.label)}</div>
      <button class="icon-btn preview-btn" data-preview="${opt.id}" aria-label="Preview ${escapeHtml(opt.label)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
    </div>
  `).join("");
  container.querySelectorAll("[data-sound]").forEach(row => {
    row.addEventListener("click", () => {
      settings.sound = row.dataset.sound;
      saveSettings(settings);
      updateNomAudioSrc();
      renderSoundOptions();
    });
  });
  container.querySelectorAll("[data-preview]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      previewSound(btn.dataset.preview);
    });
  });
}

function renderCategoryChips() {
  const container = document.getElementById("categoryChips");
  const excluded = new Set(settings.excludedCategories || []);
  container.innerHTML = MEAL_CATEGORIES.map(cat => `
    <button class="chip ${excluded.has(cat) ? "excluded" : ""}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
  `).join("");
  container.querySelectorAll("[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      const set = new Set(settings.excludedCategories || []);
      if (set.has(cat)) set.delete(cat); else set.add(cat);
      settings.excludedCategories = [...set];
      saveSettings(settings);
      renderCategoryChips();
    });
  });
}

// ---- Who's this phone? (stored on the phone; the list of names is shared in settings) ----
const ME_KEY = "mp_me";
function getMe() { try { return localStorage.getItem(ME_KEY) || ""; } catch (e) { return ""; } }
function people() { return Array.isArray(settings.people) ? settings.people.filter(p => typeof p === "string" && p) : []; }
function otherPerson() { return people().find(p => p !== getMe()) || ""; }
function openWhoModal() {
  const names = people();
  const opts = document.getElementById("whoOptions");
  opts.innerHTML = names.map(n => `<button type="button" class="chip who-chip${n === getMe() ? " active" : ""}" data-who="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("");
  document.getElementById("whoNameLabel").textContent = names.length ? "Or type a different name" : "Your name";
  document.getElementById("whoNameInput").value = "";
  document.getElementById("whoModalOverlay").classList.add("active");
}
function setMe(name) {
  const clean = name.trim().slice(0, 20);
  if (!clean) return;
  try { localStorage.setItem(ME_KEY, clean); } catch (e) {}
  if (!people().includes(clean)) {
    settings.people = [...people(), clean].slice(-6);
    saveSettings(settings);
  }
  document.getElementById("whoModalOverlay").classList.remove("active");
  renderWho();
}
function renderWho() { document.getElementById("whoCurrent").textContent = getMe() || "not set"; }
document.getElementById("whoOptions").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-who]");
  if (chip) setMe(chip.dataset.who);
});
document.getElementById("whoSaveBtn").addEventListener("click", () => {
  const typed = document.getElementById("whoNameInput").value;
  if (typed.trim()) setMe(typed);
  else document.getElementById("whoNameInput").focus();
});
document.getElementById("whoNameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("whoSaveBtn").click();
});
document.getElementById("whoChangeBtn").addEventListener("click", openWhoModal);
document.getElementById("whoModalOverlay").addEventListener("click", (e) => {
  // Only dismissable by tapping outside once a name is set
  if (e.target.id === "whoModalOverlay" && getMe()) e.target.classList.remove("active");
});

function renderLookOptions() {
  const container = document.getElementById("lookOptions");
  const active = currentLook().id;
  container.innerHTML = LOOKS.map(l => `
    <button class="look-option ${l.id === active ? "active" : ""}" data-look-id="${l.id}" ${l.available ? "" : "disabled"} aria-pressed="${l.id === active}">
      <span class="look-swatch">${l.swatch.map(c => `<span style="background:${c}"></span>`).join("")}</span>
      <span class="look-name">${escapeHtml(l.label)}</span>
      <span class="look-desc">${escapeHtml(l.desc)}</span>
      ${l.available ? "" : `<span class="look-soon">Coming soon</span>`}
    </button>
  `).join("");
  container.querySelectorAll("[data-look-id]:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => setLook(btn.dataset.lookId));
  });
}

// ---- Year in tea: stats from the dated plan (builds up as you use the app) ----
function teaStats() {
  const now = new Date();
  const todayIso = isoDate(now);
  const year = now.getFullYear();
  const entries = [];
  for (const [k, days] of Object.entries(plan.weeks)) {
    days.forEach((d, i) => {
      if (!d || !d.text) return;
      const dt = new Date(k + "T12:00:00");
      dt.setDate(dt.getDate() + i);
      const iso = isoDate(dt);
      if (iso > todayIso || dt.getFullYear() !== year) return;
      entries.push({ iso, dow: dt.getDay(), ...d });
    });
  }
  entries.sort((a, b) => a.iso.localeCompare(b.iso));
  const home = entries.filter(e => !e.eatingOut);
  const counts = {};
  home.forEach(e => { counts[e.text] = (counts[e.text] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const takeaways = entries.filter(e => e.eatingOut);
  const byDow = Array(7).fill(0);
  takeaways.forEach(e => byDow[e.dow]++);
  const takeawayDay = takeaways.length ? byDow.indexOf(Math.max(...byDow)) : -1;
  // Longest run of days without pizza
  const pizzaDates = home.filter(e => /pizza/i.test(e.text)).map(e => new Date(e.iso + "T12:00:00"));
  const first = entries.length ? new Date(entries[0].iso + "T12:00:00") : null;
  let pizzaGap = 0;
  if (first) {
    const marks = [first, ...pizzaDates, now];
    for (let i = 1; i < marks.length; i++) pizzaGap = Math.max(pizzaGap, Math.round((marks[i] - marks[i - 1]) / 864e5));
  }
  const loved = Object.entries(ratings.byMeal).filter(([, r]) => r.up).sort((a, b) => b[1].up - a[1].up).slice(0, 3);
  const vetoes = {};
  entries.forEach(e => { if (e.vetoedBy) vetoes[e.vetoedBy] = (vetoes[e.vetoedBy] || 0) + 1; });
  return { entries, home, top, takeaways, takeawayDay, pizzaGap, pizzaCount: pizzaDates.length, loved, vetoes, first, year };
}
function openStats() {
  const s = teaStats();
  const body = document.getElementById("statsBody");
  document.getElementById("statsTitle").textContent = `Your ${s.year} in tea`;
  if (!s.entries.length) {
    body.innerHTML = `<p class="confirm-message">Nothing to show yet — your stats build up as the weeks go by. Check back in a few weeks!</p>`;
  } else {
    const stat = (big, label) => `<div class="stat"><span class="stat-big">${big}</span><span class="stat-label">${label}</span></div>`;
    body.innerHTML = `
      <p class="stats-since">Since ${s.first.getDate()} ${SHORT_MONTHS[s.first.getMonth()]}</p>
      <div class="stats-grid">
        ${stat(s.home.length, "teas at home")}
        ${stat(s.takeaways.length, "nights off")}
        ${stat(Object.keys(Object.fromEntries(s.home.map(e => [e.text, 1]))).length, "different meals")}
        ${stat(s.pizzaGap, `days — longest run without pizza`)}
      </div>
      ${s.top.length ? `<h3 class="stats-h">Most eaten</h3><ol class="stats-top">${s.top.map(([n, c], i) =>
        `<li><span class="stats-rank">${["🥇", "🥈", "🥉", "4", "5"][i]}</span><span class="stats-name">${escapeHtml(n)}</span><span class="stats-count">×${c}</span></li>`).join("")}</ol>` : ""}
      ${s.takeawayDay >= 0 ? `<p class="stats-line">🥡 Favourite night off: <strong>${FULL_DAYS[s.takeawayDay]}</strong></p>` : ""}
      ${s.loved.length ? `<p class="stats-line">😋 Most loved: <strong>${s.loved.map(([n, r]) => `${escapeHtml(n)} (👍${r.up})`).join(", ")}</strong></p>` : ""}
      ${Object.keys(s.vetoes).length ? `<p class="stats-line">🙅 Vetoes used: <strong>${Object.entries(s.vetoes).map(([p, c]) => `${escapeHtml(p)} ${c}`).join(" · ")}</strong></p>` : ""}
    `;
  }
  document.getElementById("statsOverlay").classList.add("active");
}
document.getElementById("statsOpenBtn").addEventListener("click", openStats);
document.getElementById("statsCloseBtn").addEventListener("click", () => document.getElementById("statsOverlay").classList.remove("active"));
document.getElementById("statsOverlay").addEventListener("click", (e) => { if (e.target.id === "statsOverlay") e.target.classList.remove("active"); });

// ---- Calendar feed settings ----
function renderCalendarSettings() {
  calendarToken().then(token => {
    const feed = "webcal://" + CALENDAR_FEED + (token ? "?key=" + token : "");
    document.getElementById("calAppleLink").href = feed;
    document.getElementById("calGoogleLink").href = "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(feed);
  });
  document.getElementById("teaTimeInput").value = settings.teaTime || DEFAULT_SETTINGS.teaTime;
  document.getElementById("remindSelect").value = String(settings.remindMins ?? DEFAULT_SETTINGS.remindMins);
  document.getElementById("defrostTimeInput").value = settings.defrostTime || DEFAULT_SETTINGS.defrostTime;
}
for (const [id, key, parse] of [["teaTimeInput", "teaTime", v => v], ["remindSelect", "remindMins", v => parseInt(v)], ["defrostTimeInput", "defrostTime", v => v]]) {
  document.getElementById(id).addEventListener("change", (e) => {
    if (e.target.value === "") return;
    settings[key] = parse(e.target.value);
    saveSettings(settings);
  });
}

function renderSettingsView() {
  renderWho();
  renderCalendarSettings();
  renderAisleOrder();
  renderLookOptions();
  document.getElementById("muteToggle").checked = !!settings.muted;
  document.getElementById("confettiToggle").checked = settings.confetti !== false;
  document.getElementById("darkModeToggle").checked = !!settings.darkMode;
  renderSoundOptions();
  renderCategoryChips();
}

document.getElementById("muteToggle").addEventListener("change", (e) => {
  settings.muted = e.target.checked;
  saveSettings(settings);
});
document.getElementById("confettiToggle").addEventListener("change", (e) => {
  settings.confetti = e.target.checked;
  saveSettings(settings);
});
document.getElementById("darkModeToggle").addEventListener("change", (e) => {
  settings.darkMode = e.target.checked;
  saveSettings(settings);
  applySettings();
});
document.getElementById("resetDataBtn").addEventListener("click", async () => {
  const ok = await showConfirm(
    "This permanently erases all your meals, every planned week and your notes, and starts fresh with the defaults.",
    { title: "Reset all data?", confirmLabel: "Reset everything" }
  );
  if (!ok) return;
  meals = STARTER_MEALS.map(m => ({ ...m }));
  plan = { weeks: {} };
  notes = {};
  viewOffset = 0;
  week = emptyWeek();
  await Promise.all([
    saveMeals(meals), saveHistory([]),
    stateSet("plan", plan).catch(() => {}), stateSet("notes", {}).catch(() => {}), stateSet("week", week).catch(() => {}),
  ]);
  renderMeals();
  renderWeek();
  showToast("All data reset.");
});

// ---- Nav ----
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.view;
    document.getElementById("planView").classList.toggle("active", target === "plan");
    document.getElementById("shopView").classList.toggle("active", target === "shop");
    document.getElementById("mealsView").classList.toggle("active", target === "meals");
    document.getElementById("settingsView").classList.toggle("active", target === "settings");
    if (target === "shop") startTickPolling(); else stopTickPolling();
    const titles = { plan: "What's for tea? 🍲", shop: "Shopping list 🛒", meals: "My meals 📖", settings: "Settings ⚙️" };
    const subtitles = {
      plan: "Tap the button, get a week of dinners.",
      shop: "Everything you need for the week ahead.",
      meals: "Define your favourites and their ingredients.",
      settings: "Make it yours.",
    };
    document.getElementById("pageTitle").textContent = titles[target];
    document.getElementById("pageSubtitle").textContent = subtitles[target];
  });
});

// ---- Service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---- Init ----
init();
