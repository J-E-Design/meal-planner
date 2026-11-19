// Navigation, accessibility helpers, service worker and starting the app.
// Loaded in order by index.html (plain scripts sharing one global scope - no build step).
// ---- Nav ----
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => { b.classList.remove("active"); b.removeAttribute("aria-current"); });
    btn.classList.add("active");
    btn.setAttribute("aria-current", "page");
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

// ---- Share the week / shopping list (phone's Share menu, or copy as a fallback) ----
async function shareText(title, text) {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return; }
  } catch (e) {
    if (e && e.name === "AbortError") return; // closed the share sheet
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied — paste it into WhatsApp or a message");
  } catch (e) {
    showAlert(text, "Here it is to copy");
  }
}
function weekShareText(offset = viewOffset) {
  const days = weekDays(offset);
  const lines = DAYS.map((day, i) => {
    const d = days[i];
    const date = dayDate(offset, i);
    const note = notes[isoDate(date)];
    const occ = occasionOn(isoDate(date));
    let what = !d ? "—" : d.eatingOut ? `🥡 ${d.text}` : `${getMealEmoji(d.text)} ${d.text}${d.leftover ? " (leftovers)" : ""}`;
    if (occ) what += ` ${occ.emoji || "🎉"} ${occ.label}`;
    if (note) what += ` · ${note}`;
    return `${day} ${date.getDate()}: ${what}`;
  });
  return `What's for tea — ${weekTitle(offset).toLowerCase()} (${weekRangeLabel(offset)}) 🍲\n\n${lines.join("\n")}`;
}
function listShareText() {
  const view = shopView();
  const ticked = new Set(view.ticks);
  const staples = new Set(Array.isArray(settings.staples) ? settings.staples : []);
  const items = buildShoppingList(view).filter(i => !ticked.has(i.key) && !(staples.has(i.key) && !i.extra));
  if (!items.length) return "";
  const groups = orderedAisles().map(a => {
    const g = items.filter(i => i.aisle === a.id);
    return g.length ? `${a.emoji} ${a.label.toUpperCase()}\n${g.map(i => `• ${formatShoppingItem(i)}`).join("\n")}` : "";
  }).filter(Boolean);
  return `Shopping list 🛒\n\n${groups.join("\n\n")}`;
}
document.getElementById("shareWeekBtn").addEventListener("click", () => {
  if (!week.some(d => d)) { showToast("Nothing planned yet — shuffle first"); return; }
  shareText("What's for tea", weekShareText());
});
document.getElementById("shareListBtn").addEventListener("click", () => {
  const text = listShareText();
  if (!text) { showToast("Nothing left to buy"); return; }
  shareText("Shopping list", text);
});

// ---- Home-screen shortcuts (long-press the app icon): ?view=shop / plan / meals&add=1 ----
function handleLaunchView() {
  const q = new URLSearchParams(location.search);
  const view = q.get("view");
  if (!view || q.get("share_url") || q.get("share_text")) return;
  window.history.replaceState(null, "", location.pathname);
  const btn = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (btn) btn.click();
  if (view === "meals" && q.get("add")) openMealModal(null);
}

// ---- Accessibility: dialogs announce themselves, Escape closes the top one ----
document.querySelectorAll(".modal-overlay").forEach((overlay, n) => {
  const box = overlay.querySelector(".modal, .swipe-sheet");
  if (!box) return;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  const heading = box.querySelector("h2");
  if (heading) {
    if (!heading.id) heading.id = "dialogTitle" + n;
    box.setAttribute("aria-labelledby", heading.id);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const open = [...document.querySelectorAll(".modal-overlay.active")].pop();
  if (!open) return;
  // "Who's this phone?" can't be dismissed until a name is set; swipe & confirm have their own handling
  if (open.id === "whoModalOverlay" && !getMe()) return;
  if (open.id === "swipeOverlay" || open.id === "confirmModalOverlay") return;
  open.classList.remove("active");
  if (open.id === "dayModalOverlay") editingDayIndex = null;
});
document.querySelector(".nav-btn.active")?.setAttribute("aria-current", "page");
document.querySelector(".bottom-nav")?.setAttribute("aria-label", "Main");
document.querySelector(".bottom-nav")?.setAttribute("role", "navigation");

// ---- Service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---- Init ----
init();

