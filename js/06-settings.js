// Settings: sounds, who's this phone, looks, Year in tea, full backups, calendar.
// Loaded in order by index.html (plain scripts sharing one global scope - no build step).
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

// ---- Full backups: everything (meals, plans, notes, ratings, shopping...) ----
const BACKUP_NAMES = ["meals", "week", "settings", "history", "plan", "notes", "ratings", "swipes", "ticks", "extras", "activity"];
async function collectEverything() {
  const values = await Promise.all(BACKUP_NAMES.map(n => stateGet(n, null).catch(() => null)));
  const data = {};
  BACKUP_NAMES.forEach((n, i) => { if (values[i] !== null) data[n] = values[i]; });
  return data;
}
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function reloadApp() { location.reload(); }
async function restoreEverything(data, label) {
  const names = BACKUP_NAMES.filter(n => n in data);
  if (!names.length || !Array.isArray(data.meals)) {
    await showAlert("That doesn't look like a full backup from this app.");
    return;
  }
  const ok = await showConfirm(
    `This replaces everything — ${data.meals.length} meal${data.meals.length === 1 ? "" : "s"}, your planned weeks, notes, ratings and shopping list — with ${label}. Both phones will see the change.`,
    { title: "Restore everything?", confirmLabel: "Restore" }
  );
  if (!ok) return;
  try {
    for (const n of names) await stateSet(n, data[n]);
    try { localStorage.removeItem(SHOP_QUEUE_KEY); } catch (e) {}
    showToast("Restored — reloading…");
    setTimeout(() => reloadApp(), 900);
  } catch (e) {
    showAlert("Couldn't finish restoring — check your connection and try again.");
  }
}
document.getElementById("fullBackupBtn").addEventListener("click", async () => {
  const btn = document.getElementById("fullBackupBtn");
  btn.disabled = true;
  try {
    const data = await collectEverything();
    downloadJson({ app: "whats-for-tea", version: 1, created: new Date().toISOString(), data }, `whats-for-tea-backup-${isoDate(new Date())}.json`);
  } catch (e) {
    showAlert("Couldn't make the backup — check your connection.");
  } finally {
    btn.disabled = false;
  }
});
document.getElementById("fullRestoreBtn").addEventListener("click", () => document.getElementById("fullRestoreInput").click());
document.getElementById("fullRestoreInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try { parsed = JSON.parse(reader.result); } catch (err) { showAlert("That file isn't a backup."); return; }
    if (Array.isArray(parsed)) { showAlert("That's a meals-only backup — restore it from My meals → ⋯ → Restore."); return; }
    restoreEverything(parsed && parsed.data ? parsed.data : {}, "this backup file");
  };
  reader.readAsText(file);
});
async function renderServerBackups() {
  const sel = document.getElementById("serverBackupSelect");
  const btn = document.getElementById("serverRestoreBtn");
  const note = document.getElementById("serverBackupNote");
  try {
    const dates = await stateGet("_backups", []);
    if (!Array.isArray(dates) || !dates.length) {
      sel.innerHTML = `<option value="">None yet</option>`;
      btn.disabled = true;
      note.textContent = "The first automatic copy is made the next time the app opens.";
      return;
    }
    sel.innerHTML = dates.map(d => {
      const dt = new Date(d + "T12:00:00");
      return `<option value="${d}">${FULL_DAYS[dt.getDay()].slice(0, 3)} ${dt.getDate()} ${SHORT_MONTHS[dt.getMonth()]}</option>`;
    }).join("");
    btn.disabled = false;
    note.textContent = `${dates.length} daily cop${dates.length === 1 ? "y" : "ies"} on your server. Each is taken first thing that day.`;
  } catch (e) {
    sel.innerHTML = `<option value="">Unavailable</option>`;
    btn.disabled = true;
    note.textContent = "";
  }
}
document.getElementById("serverRestoreBtn").addEventListener("click", async () => {
  const date = document.getElementById("serverBackupSelect").value;
  if (!date) return;
  try {
    const backup = await stateGet("_backup", null, "&date=" + encodeURIComponent(date));
    const data = {};
    for (const [n, row] of Object.entries((backup && backup.data) || {})) data[n] = row && "value" in row ? row.value : row;
    const dt = new Date(date + "T12:00:00");
    restoreEverything(data, `the copy from ${FULL_DAYS[dt.getDay()]} ${dt.getDate()} ${SHORT_MONTHS[dt.getMonth()]}`);
  } catch (e) {
    showAlert("Couldn't fetch that copy — check your connection.");
  }
});

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
  renderServerBackups();
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

