// The week view: shuffle weighting, week switcher, drag to swap, Tonight, swipe & match, vetoes.
// Loaded in order by index.html (plain scripts sharing one global scope - no build step).
// ---- How likely each meal is to come up: favourites and this week's swipes ----
let swipes = {};                          // { "2026-11-22": { "Jamie": { "Tacos": true, "Stew": false } } }
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

// ---- Meal tags (also used by day rules and filters) ----
const MEAL_TAGS = [
  { id: "quick", label: "Quick", emoji: "⚡" },
  { id: "slow", label: "Slow cooker", emoji: "🐢" },
  { id: "weekend", label: "Weekend treat", emoji: "🍖" },
  { id: "veggie", label: "Veggie", emoji: "🥦" },
  { id: "fish", label: "Fish", emoji: "🐟" },
  { id: "fakeaway", label: "Fakeaway", emoji: "🥡" },
  { id: "comfort", label: "Comfort food", emoji: "🧸" },
  { id: "new", label: "New to try", emoji: "✨" },
];
function tagInfo(id) { return MEAL_TAGS.find(t => t.id === id); }
function tagLabel(id) {
  const t = tagInfo(id);
  return t ? (currentLook().noEmoji ? t.label : `${t.emoji} ${t.label}`) : "";
}
function mealTags(name) {
  const m = mealByName(name);
  return m && Array.isArray(m.tags) ? m.tags.filter(t => tagInfo(t)) : [];
}
// Day rules: settings.dayRules = { "3": "quick", "5": "fish" } (0 = Sunday)
function dayRule(i) {
  const r = settings.dayRules && settings.dayRules[i];
  return tagInfo(r) ? r : "";
}
// Special occasions: settings.occasions = [{ id, md: "03-14", label, emoji, meal }]
function occasionOn(iso) {
  const md = iso.slice(5);
  return (Array.isArray(settings.occasions) ? settings.occasions : []).find(o => o && o.md === md) || null;
}

function pickWeek() {
  const result = week.map(d => d && (d.locked || d.eatingOut) ? d : null);

  // avoid repeating meals from the two weeks before this one (and anything planned the week after)
  const recent = new Set([
    ...[-2, -1, 1].flatMap(o => weekDays(viewOffset + o)).filter(d => d && !d.eatingOut).map(d => d.text),
    ...(viewOffset === 0 ? history.flat() : []),
  ]);
  const used = new Set(result.filter(Boolean).map(d => d.text));
  const generic = new Set(); // days filled by the plain shuffle (free for "new to try" / leftovers)

  // Weighted pick (favourites, swipes) among meals passing `fits`, never one already this week;
  // prefers meals that weren't in the last couple of weeks.
  const choose = (fits) => {
    const ok = m => !used.has(m.name) && mealWeight(m.name) > 0 && fits(m);
    let pool = meals.filter(m => ok(m) && !recent.has(m.name));
    if (!pool.length) pool = meals.filter(ok);
    if (!pool.length) return null;
    const deck = pool.flatMap(m => Array(deckCopies(mealWeight(m.name)) || 1).fill(m.name));
    return deck[Math.floor(Math.random() * deck.length)];
  };
  const place = (i, name, extra = {}) => { result[i] = { text: name, locked: false, ...extra }; used.add(name); };
  const free = () => result.map((d, i) => d ? -1 : i).filter(i => i >= 0);

  // 1. Special occasions that have a chosen meal
  free().forEach(i => {
    const occ = occasionOn(dateKey(viewOffset, i));
    if (occ && occ.meal && mealByName(occ.meal) && !used.has(occ.meal)) place(i, occ.meal);
  });
  // 2. Day rules ("Wednesdays are quick") - the rule with the fewest matching meals goes first,
  //    so e.g. "Fish Friday" isn't starved because "Quick Wednesday" took the only fish meal.
  const matching = tag => meals.filter(m => Array.isArray(m.tags) && m.tags.includes(tag)).length;
  free().filter(i => dayRule(i)).sort((a, b) => matching(dayRule(a)) - matching(dayRule(b))).forEach(i => {
    const tag = dayRule(i);
    const pick = choose(m => Array.isArray(m.tags) && m.tags.includes(tag));
    if (pick) place(i, pick);
  });
  // 3. Everything else
  free().forEach(i => {
    let pick = choose(() => true);
    if (!pick) {
      // genuinely not enough different meals - allow a repeat rather than leave a gap
      const any = meals.filter(m => mealWeight(m.name) > 0);
      const list = any.length ? any : meals;
      pick = list.length ? list[Math.floor(Math.random() * list.length)].name : null;
    }
    if (pick) { place(i, pick); generic.add(i); }
  });
  // 4. Leftovers: a meal that makes leftovers fills the next day, if that day was a plain shuffle pick
  for (let i = 0; i < 6; i++) {
    const d = result[i];
    const m = d && !d.eatingOut ? mealByName(d.text) : null;
    if (!m || !m.leftover || !generic.has(i + 1) || dayRule(i + 1)) continue;
    if (!mealByName(m.leftover)) continue;
    if (used.has(m.leftover)) {
      // Already elsewhere this week: swap it next door if it was a plain pick, otherwise leave it
      const j = result.findIndex(x => x && x.text === m.leftover);
      if (!generic.has(j)) continue;
      result[j] = result[i + 1];
    } else {
      used.delete(result[i + 1].text);
    }
    result[i + 1] = { text: m.leftover, locked: false, leftover: true };
    used.add(m.leftover);
    generic.delete(i + 1);
  }
  // 5. One "new to try" meal a week (if switched on) - after leftovers so nothing overwrites it
  if (settings.weeklyNew && !result.some(d => d && !d.eatingOut && mealTags(d.text).includes("new")) && generic.size) {
    const slots = [...generic];
    const i = slots[Math.floor(Math.random() * slots.length)];
    used.delete(result[i].text);
    const pick = choose(m => Array.isArray(m.tags) && m.tags.includes("new"));
    if (pick) { place(i, pick); generic.delete(i); } else used.add(result[i].text);
  }
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
        ${d && d.leftover ? `<div class="day-tag leftover-tag">${currentLook().noEmoji ? "" : "♻️ "}Leftovers</div>` : ""}
        ${occasionOn(isoDate(date)) ? `<div class="day-tag occasion-tag">${currentLook().noEmoji ? "" : escapeHtml(occasionOn(isoDate(date)).emoji || "🎉") + " "}${escapeHtml(occasionOn(isoDate(date)).label)}</div>` : ""}
        ${!d && dayRule(i) ? `<div class="day-tag rule-tag">${escapeHtml(tagLabel(dayRule(i)))} night</div>` : ""}
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
  const occ = occasionOn(dateKey(0, i));
  card.innerHTML = `
    <span class="tonight-magnet" aria-hidden="true"></span>
    <span class="tonight-label">Tonight · ${FULL_DAYS[i]}${occ ? ` · ${escapeHtml(occ.emoji || "🎉")} ${escapeHtml(occ.label)}` : ""}</span>
    <span class="tonight-main">${main}</span>
    ${sub ? `<span class="tonight-sub">${sub}</span>` : ""}
    <span class="tonight-next">Tomorrow: ${next ? mealLabel(next.text) : "not decided yet"}${nextMeal && nextMeal.defrost && !next.eatingOut ? ` <span class="tonight-defrost">🧊 defrost tonight</span>` : ""}</span>
  `;
  card.setAttribute("aria-label", `Tonight: ${d ? d.text : "nothing planned"}. Tap to edit.`);
  // Recipe link (for meals imported from a recipe page) and Spin
  const link = document.getElementById("tonightRecipeLink");
  const url = meal && meal.sourceUrl && /^https?:\/\//i.test(meal.sourceUrl) ? meal.sourceUrl : "";
  link.hidden = !url;
  if (url) link.href = url;
  const spin = document.getElementById("spinTonightBtn");
  spin.hidden = !!(d && (d.locked || d.eatingOut)) || meals.length < 2;
}

// ---- Spin for tonight: re-pick just tonight with a slot-machine spin ----
let spinning = false;
function spinTonight() {
  const i = new Date().getDay();
  const days = weekDays(0).slice();
  const d = days[i];
  if (spinning || meals.length < 2) return;
  if (d && (d.locked || d.eatingOut)) { showToast("Tonight is locked — unlock it to spin"); return; }
  spinning = true;
  const before = weekDays(0).slice();
  const pick = pickReplacement(i, d ? [d.text] : [], days);
  const mealEl = document.querySelector("#tonightCard .tonight-meal");
  const emojiEl = document.querySelector("#tonightCard .tonight-emoji");
  playNomSound();
  const finish = () => {
    days[i] = { text: pick, locked: false };
    savePlanWeek(weekKey(0), days);
    if (viewOffset === 0) week = days;
    spinning = false;
    renderWeek();
    if (settings.confetti !== false) spawnConfetti(document.getElementById("tonightCard"));
    showToast(`Tonight: ${pick}`, { undo: () => restoreWeek(0, before) });
  };
  if (prefersReducedMotion() || !mealEl) { finish(); return; }
  const names = meals.map(m => m.name);
  const stopAt = performance.now() + 1100;
  mealEl.classList.remove("empty");
  const tick = () => {
    if (performance.now() >= stopAt) { finish(); return; }
    const n = names[Math.floor(Math.random() * names.length)];
    mealEl.textContent = n;
    if (emojiEl) emojiEl.textContent = getMealEmoji(n);
    setTimeout(tick, 70);
  };
  tick();
}
document.getElementById("spinTonightBtn").addEventListener("click", spinTonight);
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
// Follows that day's rule ("Wednesdays are quick") when a suitable meal exists.
function pickReplacement(i, avoid = [], days = week) {
  const taken = new Set([...avoid, ...days.filter((d, j) => d && j !== i).map(d => d.text)].filter(Boolean));
  let pool = meals.filter(m => !taken.has(m.name) && mealWeight(m.name) > 0);
  const rule = dayRule(i);
  if (rule) {
    const ruled = pool.filter(m => Array.isArray(m.tags) && m.tags.includes(rule));
    if (ruled.length) pool = ruled;
  }
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

