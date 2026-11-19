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

