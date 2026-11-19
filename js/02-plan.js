// Weeks, notes, saving, dialogs/toasts and start-up (init).
// Loaded in order by index.html (plain scripts sharing one global scope - no build step).
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
    const [p, n, s] = await Promise.all([
      stateGet("plan", null), stateGet("notes", {}), stateGet("swipes", {}).catch(() => ({})),
    ]);
    if (planSavesPending > 0) return;
    const nextPlan = normalisePlan(p);
    const nextNotes = n && typeof n === "object" && !Array.isArray(n) ? n : {};
    const nextSwipes = normaliseSwipes(s);
    const changed = JSON.stringify([nextPlan, nextNotes, nextSwipes]) !== JSON.stringify([plan, notes, swipes]);
    if (changed) {
      plan = nextPlan;
      notes = nextNotes;
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
    const returnFocus = document.activeElement;
    setTimeout(() => (cancelLabel ? cancelBtn : okBtn).focus(), 30);

    function cleanup(result) {
      overlay.classList.remove("active");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlay);
      document.removeEventListener("keydown", onKey);
      if (returnFocus && returnFocus.focus) returnFocus.focus();
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === overlay) cleanup(false); }
    function onKey(e) { if (e.key === "Escape") cleanup(false); }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKey);
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
    const [remoteMeals, remoteWeek, remoteSettings, remoteHistory, remotePlan, remoteNotes, remoteSwipes] = await Promise.all([
      stateGet("meals", []),
      stateGet("week", Array(7).fill(null)),
      stateGet("settings", DEFAULT_SETTINGS),
      stateGet("history", []),
      stateGet("plan", null).catch(() => null),
      stateGet("notes", {}).catch(() => ({})),
      stateGet("swipes", {}).catch(() => ({})),
    ]);
    meals = remoteMeals;
    week = remoteWeek;
    settings = { ...DEFAULT_SETTINGS, ...remoteSettings };
    history = remoteHistory;
    plan = normalisePlan(remotePlan);
    notes = remoteNotes && typeof remoteNotes === "object" && !Array.isArray(remoteNotes) ? remoteNotes : {};
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

