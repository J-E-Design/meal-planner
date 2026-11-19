// What's for tea? - core: constants, looks, sounds, server access and the household passcode.
// Loaded in order by index.html (plain scripts sharing one global scope - no build step).
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
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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

async function stateGet(name, fallback, extraQuery = "") {
  const res = await fetch(`${API_URL}?name=${encodeURIComponent(name)}${extraQuery}`, { cache: "no-store", headers: authHeaders() });
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
