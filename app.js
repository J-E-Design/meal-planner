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
const DEFAULT_SETTINGS = { sound: "nom.mp3", muted: false, confetti: true, darkMode: false, excludedCategories: [] };

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

// ---- Server-backed storage (Supabase) ----
const SUPABASE_URL = "https://fqyacrjfyqfpqbfungqh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxeWFjcmpmeXFmcHFiZnVuZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDM3MDIsImV4cCI6MjEwNDI3OTcwMn0.wWaW18-IiNSvHcx8CSD1zKMQMrtY23gtMDUUUqiqKRw";
const SUPABASE_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + SUPABASE_ANON_KEY,
};

async function stateGet(name, fallback) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/app_state?name=eq.${name}&select=value`,
    { headers: SUPABASE_HEADERS }
  );
  if (!res.ok) throw new Error("GET " + name + " failed: " + res.status);
  const rows = await res.json();
  return rows.length ? rows[0].value : fallback;
}
async function stateSet(name, value) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
    method: "POST",
    headers: {
      ...SUPABASE_HEADERS,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ name, value }),
  });
  if (!res.ok) throw new Error("SET " + name + " failed: " + res.status);
}

async function saveMeals(m) {
  meals = m;
  try {
    await stateSet("meals", m);
  } catch (e) {
    showToast("Couldn't save your meals — check your connection.");
  }
}
async function saveWeek(w) {
  week = w;
  try {
    await stateSet("week", w);
  } catch (e) {
    showToast("Couldn't save your week — check your connection.");
  }
}
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
function showToast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
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
}

async function init() {
  try {
    const [remoteMeals, remoteWeek, remoteSettings, remoteHistory] = await Promise.all([
      stateGet("meals", []),
      stateGet("week", Array(7).fill(null)),
      stateGet("settings", DEFAULT_SETTINGS),
      stateGet("history", []),
    ]);
    meals = remoteMeals;
    week = remoteWeek;
    settings = { ...DEFAULT_SETTINGS, ...remoteSettings };
    history = remoteHistory;

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
  } catch (e) {
    showLoadError();
    return;
  }
  applySettings();
  showApp();
  renderWeek();
  renderMeals();
  renderSettingsView();
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

// Favourite meals appear more often in the shuffle deck; everything else appears once.
function weightedDeck(excludeNames) {
  const pool = meals.filter(m => !excludeNames.has(m.name));
  const usePool = pool.length > 0 ? pool : meals; // don't let exclusion empty the deck entirely
  return usePool.flatMap(m => Array(m.favourite ? 3 : 1).fill(m.name));
}

function pickWeek() {
  const result = week.map(d => d && (d.locked || d.eatingOut) ? d : null);
  const slotsToFill = [];
  result.forEach((d, i) => { if (!d) slotsToFill.push(i); });

  // avoid repeating meals from the last couple of shuffles where possible
  const recentNames = new Set(history.flat());

  let deck = [];
  let lastPicked = null;
  slotsToFill.forEach((i) => {
    if (deck.length === 0) {
      deck = weightedDeck(recentNames).sort(() => Math.random() - 0.5);
      if (lastPicked && deck[0] === lastPicked && deck.length > 1) {
        [deck[0], deck[1]] = [deck[1], deck[0]];
      }
    }
    const pick = deck.pop();
    lastPicked = pick;
    result[i] = { text: pick, locked: false };
  });
  return result;
}

function renderWeek() {
  const list = document.getElementById("weekList");
  list.innerHTML = "";
  const hasPlan = week.some(d => d !== null);
  document.getElementById("shuffleLabel").textContent = hasPlan ? "Shuffle again" : "Plan my week";
  document.getElementById("shuffleBtn").disabled = meals.length === 0;

  DAYS.forEach((day, i) => {
    const d = week[i];
    const row = document.createElement("div");
    row.className = "day-row pop-in" + (d && d.locked ? " locked" : "");
    row.style.animationDelay = (i * 0.05) + "s";
    row.id = "day-" + i;
    const col = DAY_COLORS[i];
    row.innerHTML = `
      <div class="day-badge" style="background:${col.bg}; color:${col.fg};">${day}</div>
      <button class="day-meal-btn" data-open="${i}">
        <div class="day-meal ${d ? "" : "empty"}">${d ? getMealEmoji(d.text) + " " + escapeHtml(d.text) : "🎲 Not decided yet"}</div>
        ${d && d.eatingOut ? `<div class="lock-tag eating-out-tag">🥡 Eating out</div>` : (d && d.locked ? `<div class="lock-tag"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3z"/></svg>Locked</div>` : "")}
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

  renderShoppingList();
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
    week = pickWeek();
    saveWeek(week);
    saveHistory([week.filter(d => d && !d.eatingOut).map(d => d.text), ...history].slice(0, 2));
    renderWeek();
    btn.classList.remove("pop", "spin");
    if (settings.confetti !== false) spawnConfetti(btn);
    document.getElementById("pageSubtitle").textContent = FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)];
  }, 380);
}

function rerollDay(i) {
  if (meals.length === 0) return;
  if (week[i] && (week[i].locked || week[i].eatingOut)) return;
  const currentText = week[i] ? week[i].text : null;
  const others = meals.filter(m => m.name !== currentText);
  const pool = others.length ? others : meals;
  const weighted = pool.flatMap(m => Array(m.favourite ? 3 : 1).fill(m));
  const next = weighted[Math.floor(Math.random() * weighted.length)];
  week[i] = { text: next.name, locked: false };
  saveWeek(week);
  renderWeek();
  const row = document.getElementById("day-" + i);
  if (row) {
    row.classList.add("wiggle");
    setTimeout(() => row.classList.remove("wiggle"), 380);
  }
}

async function resetWeek() {
  const ok = await showConfirm("Locked and eating-out days will stay put.", {
    title: "Clear this week's plan?",
    confirmLabel: "Clear week",
  });
  if (!ok) return;
  week = week.map(d => d && (d.locked || d.eatingOut) ? d : null);
  saveWeek(week);
  renderWeek();
}
document.getElementById("resetWeekBtn").addEventListener("click", resetWeek);

function buildShoppingList() {
  const seen = new Map();
  week.forEach(d => {
    if (!d || d.eatingOut) return;
    const meal = mealByName(d.text);
    if (!meal) return;
    (meal.ingredients || []).forEach(ing => {
      const key = ing.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, ing.trim());
    });
  });
  return [...seen.values()];
}

function renderShoppingList() {
  const items = buildShoppingList();
  const ul = document.getElementById("shopList");
  if (items.length === 0) {
    ul.innerHTML = `<li style="list-style:none; margin-left:-18px; color:#B3A594; font-weight:600;">Plan your week to build a shopping list.</li>`;
    return;
  }
  ul.innerHTML = items.map(i => `<li>${escapeHtml(i)}</li>`).join("");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

document.getElementById("shuffleBtn").addEventListener("click", shuffleAll);

document.getElementById("copyBtn").addEventListener("click", async () => {
  const items = buildShoppingList();
  if (items.length === 0) return;
  const text = items.join("\n");
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById("copyBtn");
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = original, 1400);
  } catch (e) {
    showAlert(text, "Couldn't copy automatically - here's your list");
  }
});

// ---- Day modal ----
function populateQuickPick() {
  const sel = document.getElementById("dayQuickPick");
  sel.innerHTML = `<option value="">Choose a saved meal…</option>` +
    meals.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join("");
}

function openDayModal(i) {
  editingDayIndex = i;
  const d = week[i];
  document.getElementById("dayModalTitle").textContent = "Edit " + DAYS[i];
  document.getElementById("dayTextInput").value = d ? d.text : "";
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
document.getElementById("dayClearBtn").addEventListener("click", () => {
  if (editingDayIndex === null) return;
  week[editingDayIndex] = null;
  saveWeek(week);
  closeDayModal();
  renderWeek();
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
  closeDayModal();
  renderWeek();
});

// ---- Meals view ----
function renderMeals() {
  const list = document.getElementById("mealsList");
  if (meals.length === 0) {
    list.innerHTML = `<div class="empty-state">🍽️ No meals yet. Add your first favourite below.</div>`;
    return;
  }
  list.innerHTML = meals.map(m => `
    <div class="meal-card">
      <div class="meal-card-top">
        <div class="meal-name">${getMealEmoji(m.name)} ${escapeHtml(m.name)}</div>
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

function deleteMeal(id) {
  const meal = mealById(id);
  meals = meals.filter(m => m.id !== id);
  saveMeals(meals);
  if (meal) {
    week = week.map(d => (d && d.text === meal.name) ? null : d);
    saveWeek(week);
  }
  renderMeals();
  renderWeek();
}

let editingMealSourceUrl = null;

function openMealModal(id, prefill) {
  editingMealId = id || null;
  const meal = id ? mealById(id) : null;
  editingMealSourceUrl = meal ? (meal.sourceUrl || null) : (prefill && prefill.sourceUrl) || null;
  document.getElementById("mealModalTitle").textContent = id ? "Edit meal" : "Add a meal";
  document.getElementById("mealNameInput").value = meal ? meal.name : (prefill ? prefill.name : "");
  document.getElementById("mealIngInput").value = meal ? (meal.ingredients || []).join("\n") : (prefill ? prefill.ingredients.join("\n") : "");
  document.getElementById("mealModalOverlay").classList.add("active");
  document.getElementById("mealNameInput").focus();
}
function closeMealModal() {
  document.getElementById("mealModalOverlay").classList.remove("active");
  editingMealId = null;
  editingMealSourceUrl = null;
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

  if (editingMealId) {
    const meal = mealById(editingMealId);
    meal.name = name;
    meal.ingredients = ingredients;
    if (oldName && oldName !== name) {
      week = week.map(d => (d && d.text === oldName) ? { ...d, text: name } : d);
      saveWeek(week);
    }
  } else {
    meals.push({ id: uid(), name, ingredients, sourceUrl: editingMealSourceUrl || undefined });
  }
  saveMeals(meals);
  closeMealModal();
  renderMeals();
  renderWeek();
});

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
    currentSuggestion = { name: meal.strMeal, ingredients, sourceUrl: readMoreUrl };
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

function renderSettingsView() {
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
    "This permanently erases all your meals and this week's plan, and starts fresh with the defaults.",
    { title: "Reset all data?", confirmLabel: "Reset everything" }
  );
  if (!ok) return;
  meals = STARTER_MEALS.map(m => ({ ...m }));
  week = Array(7).fill(null);
  await Promise.all([saveMeals(meals), saveWeek(week), saveHistory([])]);
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
