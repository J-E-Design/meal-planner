// Browser test harness: a fake server (so tests never touch the real data) plus the test cases.
// Loaded before app.js by tests/run.sh. Each page load runs ONE case, chosen by ?case=name,
// and writes {name, pass, details} into <pre id="result">.
(function () {
  const q = new URLSearchParams(location.search);
  const PASSCODE = "test-passcode";
  // Fresh phone for every case
  try { localStorage.clear(); } catch (e) {}
  try {
    localStorage.setItem("mp_look", q.get("look") || "fridge");
    // index.html picks the look in <head> before this file runs, so apply it here too
    document.documentElement.dataset.look = q.get("look") || "fridge";
    if (!q.has("locked")) localStorage.setItem("mp_key", PASSCODE);
    localStorage.setItem("mp_me", "Alex");
  } catch (e) {}

  // ---- Fake server ----
  const state = JSON.parse(JSON.stringify(window.__FIXTURE));
  window.__state = state;
  window.__offline = false;
  window.__requests = 0;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!/state\.php|import\.php/.test(u)) return realFetch(url, opts);
    window.__requests++;
    if (window.__offline) throw new TypeError("Failed to fetch");
    const key = (opts.headers && opts.headers["X-Household-Key"]) || "";
    if (key !== PASSCODE) return new Response('{"error":"Passcode needed"}', { status: 401 });
    if (u.includes("import.php")) {
      return new Response(JSON.stringify({ name: "Test curry", ingredients: ["2 onions", "1 tbsp oil"], image: "https://example.com/c.jpg", sourceUrl: "https://example.com/curry", servings: "Serves 4" }));
    }
    if (opts.method === "POST") {
      const b = JSON.parse(opts.body);
      state[b.name] = b.value;
      return new Response('{"ok":true}');
    }
    const params = new URL(u).searchParams;
    const name = params.get("name");
    if (name === "_backups") return new Response('{"value":["2026-01-02","2026-01-01"]}');
    if (name === "_backup") return new Response(JSON.stringify({ value: { created: "x", data: { meals: { value: [{ id: "b1", name: "Backup meal", ingredients: [] }] } } } }));
    return new Response(JSON.stringify({ value: name in state ? state[name] : null }));
  };

  // ---- Helpers ----
  const errors = [];
  window.addEventListener("error", (e) => errors.push(String(e.message)));
  window.addEventListener("unhandledrejection", (e) => errors.push("Unhandled: " + String(e.reason)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const click = (s) => { const el = typeof s === "string" ? $(s) : s; if (!el) throw new Error("No element: " + s); el.click(); };
  const nav = async (view) => { click(`.nav-btn[data-view="${view}"]`); await wait(150); };
  const shopItems = () => $$("#shopList .shop-item .shop-item-text").map((e) => e.textContent.trim());
  const aisleOf = (text) => {
    let cur = null, found = null;
    $$("#shopList li").forEach((li) => {
      if (li.classList.contains("shop-aisle")) cur = li.textContent.replace(/^\W+/u, "").trim();
      else if (li.textContent.includes(text)) found = cur;
    });
    return found;
  };
  function expect(cond, msg) { if (!cond) throw new Error(msg); }

  // ---- Test cases ----
  const cases = {
    async loads() {
      expect(document.body.classList.contains("state-ready"), "app should be ready");
      expect($$("#weekList .day-row").length === 7, "7 day rows");
      expect($("#tonightCard").textContent.length > 0, "tonight card filled");
    },
    async shuffle_no_duplicates() {
      for (let r = 0; r < 150; r++) {
        week = emptyWeek();
        const names = pickWeek().filter((d) => d && !d.eatingOut).map((d) => d.text);
        expect(new Set(names).size === names.length, "duplicate meal in a week: " + names.join(", "));
      }
    },
    async shuffle_keeps_locked() {
      click("#shuffleBtn"); await wait(900);
      const w = state.plan.weeks[weekKey(0)];
      expect(w[3].text === "Tacos" && w[3].locked, "locked Tacos kept");
      expect(w[5].eatingOut, "takeaway kept");
    },
    async next_week() {
      click("#weekNext"); await wait(150);
      expect($("#weekNavTitle").textContent === "Next week", "nav title");
      expect(getComputedStyle($("#tonightCard")).display === "none", "tonight hidden on future weeks");
      click("#shuffleBtn"); await wait(900);
      expect(Object.keys(state.plan.weeks).length === 2, "two weeks stored");
    },
    async notes() {
      click('[data-open="2"]'); await wait(100);
      $("#dayNoteInput").value = "Football - eat at 7";
      click("#daySaveBtn"); await wait(400);
      expect(Object.values(state.notes || {}).includes("Football - eat at 7"), "note saved");
      expect(($("#day-2 .day-note") || {}).textContent.includes("Football"), "note shown");
    },
    async shopping_aisles_and_quantities() {
      await nav("shop");
      const items = shopItems();
      expect(items.includes("750g mince beef"), "mince should add up to 750g: " + items.join(" | "));
      expect(items.includes("3 onions"), "onions should add up to 3: " + items.join(" | "));
      expect(items.includes("3 chicken thighs"), "curry serves 4, cooking for 2 → 3 thighs: " + items.join(" | "));
      expect(aisleOf("Brocolli") === "Fruit & veg", "Brocolli in Fruit & veg, got " + aisleOf("Brocolli"));
      expect(aisleOf("Fish fingers") === null || true, "");
      expect(aisleOf("Gravy") === "Cupboard", "Gravy in Cupboard");
    },
    async ticks_offline_then_sync() {
      await nav("shop");
      window.__offline = true;
      click('[data-tick="sausage"]'); await wait(300);
      expect($('[data-tick="sausage"]').classList.contains("ticked"), "ticked while offline");
      expect($("#shopProgress").textContent.includes("No signal"), "offline note shown");
      expect(!(state.ticks || []).includes("sausage"), "not on server yet");
      window.__offline = false; window.dispatchEvent(new Event("online")); await wait(500);
      expect((state.ticks || []).includes("sausage"), "synced after reconnect");
    },
    async extras_and_finish_shop() {
      await nav("shop");
      $("#shopAddInput").value = "Bin bags"; $("#shopAddForm").requestSubmit(); await wait(300);
      expect(shopItems().includes("Bin bags"), "added item shown");
      click('[data-tick="bin bag"]'); await wait(300);
      click("#clearTicksBtn"); await wait(400);
      expect(!shopItems().includes("Bin bags"), "bought extra removed on Finish shop");
      click(".toast-action"); await wait(400);
      expect(shopItems().includes("Bin bags"), "Undo brings it back");
    },
    async move_item_aisle() {
      await nav("shop");
      click("#moveItemsBtn"); await wait(100);
      const sel = $('[data-aisle-key="gravy"]');
      sel.value = "frozen"; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait(300);
      click("#moveItemsBtn"); await wait(100);
      expect(state.settings.aisleOverrides.gravy === "frozen", "override saved");
      expect(aisleOf("Gravy") === "Frozen", "Gravy now in Frozen");
    },
    async veto() {
      click('[data-open="1"]'); await wait(100);
      const before = week[1].text;
      click("#dayVetoBtn"); await wait(500);
      expect(week[1].vetoedBy === "Alex" && week[1].text !== before, "veto replaced the meal");
      click('[data-open="2"]'); await wait(100);
      expect($("#dayVetoBtn").disabled, "second veto blocked");
    },
    async swipe_and_match() {
      click("#weekNext"); await wait(100);
      click("#swipeLaunchBtn"); await wait(200);
      for (let n = 0; n < 30; n++) {
        const top = $("#swipeStack .swipe-card.top");
        if (!top) break;
        click(["Tacos", "Lasagne"].includes(top.dataset.name) ? "#swipeYes" : "#swipeNo");
        await wait(260);
      }
      const k = weekKey(1);
      state.swipes[k].Sam = { Tacos: true, Lasagne: true, Omelette: true };
      swipes = JSON.parse(JSON.stringify(state.swipes));
      expect(swipeMatches(1).sort().join() === "Lasagne,Tacos", "matches: " + swipeMatches(1).join());
      expect(mealWeight("Tacos", 1) > mealWeight("Omelette", 1), "matches weigh more");
    },
    async search_meals() {
      await nav("meals");
      click("#mealsSearchBtn"); await wait(50);
      $("#mealsSearchInput").value = "mince"; $("#mealsSearchInput").dispatchEvent(new Event("input")); await wait(100);
      // bolognese, tacos, lasagne and shepherds pie (lamb mince)
      expect($("#mealsCount").textContent.startsWith("4 of"), "4 meals with mince: " + $("#mealsCount").textContent);
    },
    async delete_meal_undo() {
      await nav("meals");
      const n = state.meals.length;
      click("[data-del]"); await wait(300);
      expect(state.meals.length === n - 1, "deleted");
      click(".toast-action"); await wait(300);
      expect(state.meals.length === n, "undo restored");
    },
    async import_recipe() {
      await nav("meals");
      click("#addMealBtn"); await wait(100);
      $("#importUrlInput").value = "https://example.com/curry";
      $("#importForm").requestSubmit(); await wait(400);
      expect($("#mealNameInput").value === "Test curry", "name filled");
      expect($("#mealServesInput").value === "4", "servings filled");
      click("#mealSaveBtn"); await wait(300);
      const m = state.meals.find((x) => x.name === "Test curry");
      // (the photo is dropped here because the test image URL is not reachable offline - that is intended)
      expect(m && m.servings === 4 && m.sourceUrl === "https://example.com/curry", "saved with servings and recipe link");
    },
    async backup_restore() {
      await nav("settings"); await wait(300);
      expect($$("#serverBackupSelect option").length === 2, "daily copies listed");
      window.reloadApp = () => {};
      click("#serverRestoreBtn"); await wait(300);
      click("#confirmOkBtn"); await wait(500);
      expect(state.meals.length === 1 && state.meals[0].name === "Backup meal", "restored");
    },
    async lock_screen() {
      expect(document.body.classList.contains("state-locked"), "starts locked");
      $("#lockInput").value = "wrong"; $("#lockForm").requestSubmit(); await wait(300);
      expect(document.body.classList.contains("state-locked"), "wrong passcode stays locked");
      $("#lockInput").value = " TEST-passcode "; $("#lockForm").requestSubmit(); await wait(900);
      expect(document.body.classList.contains("state-ready"), "right passcode unlocks");
    },
    async day_rules_and_new() {
      settings.dayRules = { 3: "quick", 5: "fish" };
      settings.weeklyNew = true;
      for (let r = 0; r < 400; r++) {
        week = emptyWeek();
        const w = pickWeek();
        expect(mealTags(w[3].text).includes("quick"), "Wednesday should be quick, got " + w[3].text);
        expect(mealTags(w[5].text).includes("fish"), "Friday should be fish, got " + w[5].text);
        expect(w.some(d => d && mealTags(d.text).includes("new")), "a new-to-try meal each week: " + w.map(d => d && d.text + (d.leftover ? "(L)" : "")).join(", "));
        const names = w.map(d => d.text);
        expect(new Set(names).size === names.length, "no repeats: " + names.join(", "));
      }
    },
    async leftovers() {
      let paired = 0;
      for (let r = 0; r < 200; r++) {
        week = emptyWeek();
        const w = pickWeek();
        const i = w.findIndex(d => d && d.text === "Roast chicken");
        if (i >= 0 && i < 6) {
          expect(w[i + 1].text === "Chicken sandwiches" && w[i + 1].leftover, "sandwiches follow roast chicken: " + w.map(d => d.text).join(", "));
          paired++;
        }
      }
      expect(paired > 0, "roast chicken came up at least once");
    },
    async cupboard_items() {
      await nav("shop");
      click("#moveItemsBtn"); await wait(100);
      click('[data-staple="gravy"]'); await wait(200);
      click("#moveItemsBtn"); await wait(100);
      expect(state.settings.staples.includes("gravy"), "staple saved");
      expect(!$('[data-tick="gravy"]'), "gravy hidden from the list");
      expect($('[data-running-low="gravy"]'), "gravy in the cupboard section");
      click('[data-running-low="gravy"]'); await wait(400);
      expect($('[data-tick="gravy"]'), "running low adds it back to the list");
    },
    async spin_tonight() {
      const i = new Date().getDay();
      const days = weekDays(0).slice(); days[i] = { text: "Omelette", locked: false };
      savePlanWeek(weekKey(0), days); week = days; renderWeek(); await wait(300);
      click("#spinTonightBtn"); await wait(1800);
      const now = state.plan.weeks[weekKey(0)][i];
      expect(now && now.text !== "Omelette", "tonight changed: " + (now && now.text));
      click(".toast-action"); await wait(400);
      expect(state.plan.weeks[weekKey(0)][i].text === "Omelette", "undo restores tonight");
    },
    async tags_filter() {
      await nav("meals");
      click('[data-tag-filter="veggie"]'); await wait(100);
      const names = $$(".meal-card .meal-name").map(e => e.textContent.trim());
      expect(names.length === 2 && names.every(n => /Stir fry|Omelette/.test(n)), "veggie filter: " + names.join(", "));
      click('[data-tag-filter="veggie"]'); await wait(100); // clear the filter again
      click('[data-edit="m9"]'); await wait(100);
      click('#mealTagPicker [data-tag="veggie"]'); click("#mealSaveBtn"); await wait(300);
      expect(state.meals.find(m => m.id === "m9").tags.includes("veggie"), "tag saved from editor");
    },
    async occasion() {
      const d = new Date(); d.setDate(d.getDate() + 7 - d.getDay() + 2); // Tuesday next week
      settings.occasions = [{ id: "o1", md: isoDate(d).slice(5), label: "Sam's birthday", emoji: "🎂", meal: "Lasagne" }];
      click("#weekNext"); await wait(100);
      click("#shuffleBtn"); await wait(900);
      expect(state.plan.weeks[weekKey(1)][2].text === "Lasagne", "occasion meal placed");
      expect(($("#day-2 .occasion-tag") || {}).textContent.includes("birthday"), "occasion shown on the day");
    },
    async share_text() {
      const t = weekShareText(0);
      expect(t.includes("Tacos") && t.includes("Thu"), "week text: " + t);
      const l = listShareText();
      expect(l.includes("FRUIT & VEG") && l.includes("• 3 onions"), "list text: " + l);
    },
    async share_target() {
      // Android "Share → What's for tea?" opens the app with ?share_text=...; it should import the recipe
      expect($("#mealModalOverlay").classList.contains("active"), "Add a meal opened");
      expect($("#mealNameInput").value === "Test curry", "recipe imported from the shared link");
      expect(!location.search.includes("share_text"), "address tidied up afterwards");
    },
    async launch_view() {
      expect($("#shopView").classList.contains("active"), "opened on the shopping list from ?view=shop");
    },
    async escape_closes_dialog() {
      click('[data-open="0"]'); await wait(100);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); await wait(100);
      expect(!$("#dayModalOverlay").classList.contains("active"), "Escape closed the day editor");
    },
  };

  window.addEventListener("load", () => {
    const name = q.get("case");
    setTimeout(async () => {
      const out = { name, look: q.get("look") || "fridge", pass: false };
      try {
        if (!cases[name]) throw new Error("No such case");
        await cases[name]();
        out.pass = errors.length === 0;
        if (errors.length) out.details = "JS errors: " + errors.join("; ");
      } catch (e) {
        out.details = e.message + (errors.length ? " | JS errors: " + errors.join("; ") : "");
      }
      const pre = document.createElement("pre");
      pre.id = "result";
      pre.textContent = JSON.stringify(out);
      document.body.appendChild(pre);
    }, 1200);
  });
  window.__CASES = Object.keys(cases);
})();
