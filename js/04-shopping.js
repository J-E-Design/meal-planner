// Shopping list: aisles, quantities, shop layout, ticks/extras sync, activity, move items.
// Loaded in order by index.html (plain scripts sharing one global scope - no build step).
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
  ["veg", /onion|garlic|potato|carrot|broc+o?l+[iy]|brocc?oli|let+uce|lettice|tomato|pepper|mush?r+o+m|coriander|parsley|basil|ginger|lemon|lime|spinach|\bpeas\b|courgett?e|zucchini|leek|celery|cucumber|avocado|herb|\bveg|salad|sweetcorn|cabbage|cauli|parsnip|swede|apple|banana|berr|fruit|chilli|kale|beansprout|squash|aubergine/i],
];
function aisleFor(text) {
  for (const [id, re] of AISLE_RULES) if (re.test(text)) return id;
  return "other";
}
// Your own choice (Move items) wins over the rules; shared between phones in settings.
function itemAisle(key, text) {
  const o = settings.aisleOverrides && settings.aisleOverrides[key];
  return AISLES.some(a => a.id === o) ? o : aisleFor(text);
}

// ---- Quantities: "2 onions" + "1 onion" -> "3 onions"; scaled to how many you cook for ----
const FRACTIONS = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
const UNIT_ALIASES = {
  g: "g", gram: "g", grams: "g", kg: "kg", ml: "ml", l: "l", litre: "l", litres: "l", liter: "l",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  pack: "pack", packs: "pack", packet: "pack", packets: "pack", tin: "tin", tins: "tin", can: "tin", cans: "tin",
  jar: "jar", jars: "jar", clove: "clove", cloves: "clove", rasher: "rasher", rashers: "rasher",
  slice: "slice", slices: "slice", bunch: "bunch", bunches: "bunch", bag: "bag", bags: "bag",
};
const QTY_RE = /^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[½¼¾⅓⅔])\s*(?:x\s+)?/i;
function parseQty(s) {
  if (FRACTIONS[s]) return FRACTIONS[s];
  if (s.includes("/")) { const [a, b] = s.split("/").map(Number); return b ? a / b : NaN; }
  return parseFloat(s.replace(",", "."));
}
function parseIngredient(raw) {
  const text = raw.trim().replace(/\s+/g, " ");
  const m = text.match(QTY_RE);
  if (!m) return { qty: null, unit: "", name: text };
  let qty = parseQty(m[1]);
  let rest = text.slice(m[0].length);
  // "1 x 280g jar of ..." - the "x" means "this many of": keep the size in the name
  if (/^\d+\s*x\s/i.test(text)) return isNaN(qty) ? { qty: null, unit: "", name: text } : { qty, unit: "", name: rest, times: true };
  const u = rest.match(/^([a-zA-Z]+)\.?\s+(?:of\s+)?/);
  let unit = "", unitText = "";
  if (u && UNIT_ALIASES[u[1].toLowerCase()]) { unit = UNIT_ALIASES[u[1].toLowerCase()]; unitText = u[1]; rest = rest.slice(u[0].length); }
  else {
    // "500g mince" - unit stuck to the number
    const stuck = text.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b\s*(?:of\s+)?/i);
    if (stuck) { unit = stuck[2].toLowerCase(); rest = text.slice(stuck[0].length); }
  }
  if (!rest || isNaN(qty)) return { qty: null, unit: "", name: text };
  // Weigh and measure in one base unit so 1.5 kg + 500 g adds up
  if (unit === "kg") { qty *= 1000; unit = "g"; }
  if (unit === "l") { qty *= 1000; unit = "ml"; }
  return { qty, unit, unitText, name: rest };
}
function singular(word) {
  return word.replace(/(tomato|potato)es$/i, "$1").replace(/ies$/i, "y").replace(/([^s])s$/i, "$1");
}
function itemKey(name) {
  return name.toLowerCase().replace(/[.,;:!]+$/, "").split(" ").map(singular).join(" ").trim();
}
function roundQty(q, unit) {
  if (unit === "g" || unit === "ml") return q >= 50 ? Math.ceil(q / 10) * 10 : Math.ceil(q / 5) * 5;
  if (unit === "kg" || unit === "l" || unit === "tbsp" || unit === "tsp") return Math.ceil(q * 2) / 2;
  return Math.ceil(q - 1e-9); // you can't buy half an onion
}
function formatNumber(q) {
  const whole = Math.floor(q), frac = q - whole;
  const f = Math.abs(frac - 0.5) < 0.01 ? "½" : Math.abs(frac - 0.25) < 0.01 ? "¼" : Math.abs(frac - 0.75) < 0.01 ? "¾" : "";
  if (f) return (whole ? whole : "") + f;
  return String(Math.round(q * 10) / 10);
}
// "Serves 4", "4-6", "4 people" -> 4
function parseServings(v) {
  const m = String(v || "").match(/\d+/);
  const n = m ? parseInt(m[0]) : 0;
  return n >= 1 && n <= 24 ? n : 0;
}
function householdSize() { const n = parseInt(settings.householdSize); return n >= 1 && n <= 12 ? n : 2; }

function buildShoppingList(view = shopView()) {
  const seen = new Map();
  const add = (raw, scale, flags) => {
    const p = parseIngredient(raw);
    if (!p.name) return;
    const key = itemKey(p.name);
    let item = seen.get(key);
    if (!item) {
      item = { key, name: p.name, text: raw.trim(), parts: [], count: 0, aisle: itemAisle(key, p.name) };
      seen.set(key, item);
    }
    item.count++;
    item.parts.push({ qty: p.qty === null ? null : p.qty * scale, unit: p.unit, unitText: p.unitText || "", times: !!p.times, name: p.name });
    Object.assign(item, flags);
  };
  shopWeeks.flatMap(o => weekDays(o)).forEach(d => {
    if (!d || d.eatingOut) return;
    const meal = mealByName(d.text);
    if (!meal) return;
    const serves = parseInt(meal.servings);
    const scale = serves >= 1 ? householdSize() / serves : 1;
    (meal.ingredients || []).forEach(ing => { if (ing.trim()) add(ing, scale, { fromMeal: true }); });
  });
  // Things you've added yourself (milk, bin bags...)
  view.extras.items.forEach(x => add(x.text, 1, { extra: true, extraKey: x.key }));
  for (const item of seen.values()) item.text = describeItem(item);
  const order = orderedAisles().map(a => a.id);
  return [...seen.values()].sort((a, b) => order.indexOf(a.aisle) - order.indexOf(b.aisle));
}
// "3 onions", "650g mince beef", or the original text with "×2" when amounts don't line up
function formatAmount(q, unit, unitText) {
  q = roundQty(q, unit);
  if (unit === "g" || unit === "ml") {
    return q >= 1000 ? `${formatNumber(q / 1000)}${unit === "g" ? "kg" : "l"}` : `${formatNumber(q)}${unit}`;
  }
  if (!unit) return formatNumber(q);
  // keep the unit as the recipe wrote it ("cloves", "tins"), matching singular/plural to the amount
  let word = unitText || unit;
  if (q > 1 && !/s$/i.test(word) && !["tbsp", "tsp"].includes(word.toLowerCase())) word += word.endsWith("ch") ? "es" : "s";
  if (q <= 1 && /s$/i.test(word) && UNIT_ALIASES[word.toLowerCase().replace(/e?s$/, "")]) word = word.replace(/e?s$/, "");
  return `${formatNumber(q)} ${word}`;
}
function describeItem(item) {
  const parts = item.parts;
  const units = new Set(parts.map(p => p.unit));
  const withQty = parts.filter(p => p.qty !== null);
  // "Onion" + "2 onions": a plain count-less mention counts as one
  const countOnly = units.size === 1 && !parts[0].unit && withQty.length > 0 && !parts.some(p => p.times);
  if ((withQty.length === parts.length || countOnly) && units.size === 1 && withQty.length) {
    const unit = parts[0].unit;
    const total = parts.reduce((s, p) => s + (p.qty === null ? 1 : p.qty), 0);
    item.count = 1; // the total already says how many
    const biggest = withQty.reduce((best, p) => (p.qty > best.qty ? p : best), withQty[0]);
    if (parts.length === 1) {
      const p = parts[0];
      return p.times ? `${formatNumber(roundQty(p.qty, ""))} x ${p.name}` : `${formatAmount(p.qty, p.unit, p.unitText)} ${p.name}`;
    }
    if (unit) return `${formatAmount(total, unit, biggest.unitText)} ${biggest.name}`;
    const rounded = roundQty(total, "");
    // Use the recipe's own plural if one of them already said "2 onions"; only add an "s" to short names
    const named = biggest.qty > 1 || rounded <= 1 || /s$/i.test(biggest.name) || biggest.name.split(" ").length > 2 ? biggest.name : biggest.name + "s";
    return `${formatNumber(rounded)} ${named}`;
  }
  const plain = parts.find(p => p.qty === null);
  return plain ? plain.name.replace(/^./, c => c.toUpperCase()) : item.text;
}

// ---- Your shop's layout: aisle order (shared, so you both walk the same route) ----
function orderedAisles() {
  const saved = Array.isArray(settings.aisleOrder) ? settings.aisleOrder : [];
  const known = saved.map(id => AISLES.find(a => a.id === id)).filter(Boolean);
  return [...known, ...AISLES.filter(a => !saved.includes(a.id))];
}
document.getElementById("householdSelect").addEventListener("change", (e) => {
  settings.householdSize = parseInt(e.target.value);
  saveSettings(settings);
  renderShoppingList();
});
function renderAisleOrder() {
  document.getElementById("householdSelect").value = String(householdSize());
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
    .filter(p => !onList.has(itemKey(parseIngredient(p).name))).slice(0, 60)
    .map(p => `<option value="${escapeHtml(p)}"></option>`).join("");

  if (items.length === 0) {
    ul.innerHTML = `<li class="shop-empty">Plan your week, or add something above.</li>`;
    lastShopHtml = "";
    progress.textContent = syncNote.replace(/^ · /, "");
    finishBtn.hidden = true;
    return;
  }
  const tickSet = new Set(view.ticks);
  // "Always in the cupboard" items stay out of the way unless you add them back (running low)
  const staples = new Set(Array.isArray(settings.staples) ? settings.staples : []);
  const isStaple = i => staples.has(i.key) && !i.extra;
  const shopping = shopMoveMode ? items : items.filter(i => !isStaple(i));
  const cupboard = shopMoveMode ? [] : items.filter(isStaple);
  const done = shopping.filter(i => tickSet.has(i.key)).length;
  let html = orderedAisles().map(a => {
    const group = shopping.filter(i => i.aisle === a.id);
    if (!group.length) return "";
    return `<li class="shop-aisle" role="presentation"><span class="shop-aisle-emoji" aria-hidden="true">${a.emoji}</span>${escapeHtml(a.label)}</li>` +
      group.map(i => {
        const on = tickSet.has(i.key);
        const removable = i.extra && !i.fromMeal;
        if (shopMoveMode) {
          // Move items: pick an aisle per item, or mark it as always in the cupboard
          const st = staples.has(i.key);
          return `<li class="shop-item moving"><span class="shop-item-text">${escapeHtml(formatShoppingItem(i))}</span>` +
            `<button type="button" class="staple-toggle${st ? " active" : ""}" data-staple="${escapeHtml(i.key)}" aria-pressed="${st}" aria-label="${escapeHtml(i.text)} is always in the cupboard" title="Always in the cupboard">🧂</button>` +
            `<select class="aisle-pick" data-aisle-key="${escapeHtml(i.key)}" aria-label="Aisle for ${escapeHtml(i.text)}">` +
            AISLES.map(x => `<option value="${x.id}"${x.id === i.aisle ? " selected" : ""}>${escapeHtml(x.label)}</option>`).join("") +
            `</select></li>`;
        }
        return `<li class="shop-item${on ? " ticked" : ""}${i.extra ? " extra" : ""}" role="checkbox" tabindex="0" aria-checked="${on}" data-tick="${escapeHtml(i.key)}">` +
          `<span class="shop-item-text">${escapeHtml(formatShoppingItem(i))}</span>` +
          (removable ? `<button type="button" class="shop-remove" data-remove="${escapeHtml(i.extraKey || i.key)}" aria-label="Remove ${escapeHtml(i.text)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : "") +
          `</li>`;
      }).join("");
  }).join("");
  if (cupboard.length) {
    html += `<li class="shop-aisle cupboard-aisle" role="presentation"><span class="shop-aisle-emoji" aria-hidden="true">🧂</span>Already in the cupboard</li>` +
      `<li class="cupboard-hint" role="presentation">Tap anything you're running low on to add it to the list.</li>` +
      cupboard.map(i => `<li class="shop-item cupboard-item"><button type="button" class="cupboard-btn" data-running-low="${escapeHtml(i.key)}">${escapeHtml(i.name.replace(/^./, c => c.toUpperCase()))}<span class="cupboard-add" aria-hidden="true">＋</span></button></li>`).join("");
  }
  if (html !== lastShopHtml) { ul.innerHTML = html; lastShopHtml = html; } // avoid flicker on background refreshes
  progress.textContent = shopMoveMode ? "Pick the right aisle for any item, or tap 🧂 for things that are always in the cupboard. Remembered for both of you." : (done === 0 ? "Tap an item to tick it off — you'll both see it."
    : done === shopping.length ? "All done — everything's in the trolley! 🎉"
    : `${done} of ${shopping.length} in the trolley`) + syncNote;
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
    case "finishShop": items = items.filter(i => !ticks.has(i.key) && !ticks.has(itemKey(parseIngredient(i.text).name))); ticks.clear(); break;
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
  const removed = before.extras.items.filter(i => before.ticks.includes(i.key) || before.ticks.includes(itemKey(parseIngredient(i.text).name))).length;
  queueShopOp({ type: "finishShop" });
  showToast(removed ? `Shop done — ${removed} added item${removed === 1 ? "" : "s"} cleared` : "Shop done — all unticked", {
    undo: () => {
      queueShopOp({ type: "setExtras", items: before.extras.items });
      queueShopOp({ type: "setTicks", keys: before.ticks });
    },
  });
}
// ---- Always in the cupboard (staples) ----
document.getElementById("shopList").addEventListener("click", (e) => {
  const toggle = e.target.closest("[data-staple]");
  if (toggle) {
    const key = toggle.dataset.staple;
    const set = new Set(Array.isArray(settings.staples) ? settings.staples : []);
    const nowStaple = !set.has(key);
    if (nowStaple) set.add(key); else set.delete(key);
    settings.staples = [...set];
    saveSettings(settings);
    lastShopHtml = "";
    renderShoppingList();
    return;
  }
  const low = e.target.closest("[data-running-low]");
  if (low) {
    const item = buildShoppingList().find(i => i.key === low.dataset.runningLow);
    if (!item) return;
    const text = item.name.replace(/^./, c => c.toUpperCase());
    queueShopOp({ type: "addExtra", key: item.key, text, who: getMe() || undefined, at: Date.now() });
    showToast(`${text} added — running low`);
  }
});

// ---- Move items: choose an item's aisle yourself (remembered for both of you) ----
let shopMoveMode = false;
document.getElementById("moveItemsBtn").addEventListener("click", () => {
  shopMoveMode = !shopMoveMode;
  const btn = document.getElementById("moveItemsBtn");
  btn.textContent = shopMoveMode ? "✓ Done moving" : "↕ Move items";
  btn.setAttribute("aria-pressed", String(shopMoveMode));
  document.getElementById("shopList").classList.toggle("move-mode", shopMoveMode);
  lastShopHtml = "";
  renderShoppingList();
});
document.getElementById("shopList").addEventListener("change", (e) => {
  const sel = e.target.closest("[data-aisle-key]");
  if (!sel) return;
  const key = sel.dataset.aisleKey;
  const item = buildShoppingList().find(i => i.key === key);
  const overrides = { ...(settings.aisleOverrides || {}) };
  // Choosing what the rules would have picked anyway removes the override
  if (item && aisleFor(item.parts[0].name) === sel.value) delete overrides[key]; else overrides[key] = sel.value;
  settings.aisleOverrides = overrides;
  saveSettings(settings);
  lastShopHtml = "";
  renderShoppingList();
  const label = (AISLES.find(a => a.id === sel.value) || {}).label;
  if (item && label) showToast(`${item.text} → ${label} from now on`);
});

document.getElementById("shopList").addEventListener("click", (e) => {
  if (shopMoveMode) return;
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
  const key = itemKey(parseIngredient(text).name);
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


