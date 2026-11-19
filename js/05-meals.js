// Day editor, My meals, recipe import, search, backup/restore of meals, web suggestions.
// Loaded in order by index.html (plain scripts sharing one global scope - no build step).
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
// Weeks since a meal was last on the plan (up to today); -1 if it hasn't been yet.
function weeksSinceEaten(name) {
  const today = isoDate(new Date());
  let last = "";
  for (const [k, days] of Object.entries(plan.weeks)) {
    days.forEach((d, i) => {
      if (!d || d.text !== name) return;
      const dt = new Date(k + "T12:00:00");
      dt.setDate(dt.getDate() + i);
      const iso = isoDate(dt);
      if (iso <= today && iso > last) last = iso;
    });
  }
  if (!last) return -1;
  return Math.floor((Date.now() - new Date(last + "T12:00:00")) / (7 * 864e5));
}

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
      ${(() => { const w = weeksSinceEaten(m.name); return w >= 4 ? `<div class="meal-tag ages-tag">${currentLook().noEmoji ? "" : "🕰️ "}Not had for ${w} weeks</div>` : ""; })()}
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
  document.getElementById("mealServesInput").value = (meal && meal.servings) || (prefill && parseServings(prefill.servings)) || "";
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
    if (parseServings(data.servings)) document.getElementById("mealServesInput").value = parseServings(data.servings);
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
  const servings = parseServings(document.getElementById("mealServesInput").value);
  if (editingMealId) {
    const meal = mealById(editingMealId);
    meal.name = name;
    meal.ingredients = ingredients;
    if (defrost) meal.defrost = true; else delete meal.defrost;
    if (servings) meal.servings = servings; else delete meal.servings;
    if (editingMealImage) meal.image = editingMealImage; else delete meal.image;
    if (editingMealSourceUrl) meal.sourceUrl = editingMealSourceUrl;
    if (oldName && oldName !== name) {
      mapUpcomingWeeks(d => (d && d.text === oldName) ? { ...d, text: name } : d);
    }
  } else {
    meals.push({
      id: uid(), name, ingredients, sourceUrl: editingMealSourceUrl || undefined,
      ...(defrost ? { defrost: true } : {}), ...(editingMealImage ? { image: editingMealImage } : {}),
      ...(servings ? { servings } : {}),
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
      ...(parseServings(m.servings) ? { servings: parseServings(m.servings) } : {}),
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

