// Fast checks of the pure logic in js/*.js (no browser needed): aisle rules and quantities.
// Run from the repo root:  node tests/unit.js
const fs = require("fs");
const path = require("path");
// The app is split into js/01-*.js ... js/07-*.js; read them joined, in order.
const jsDir = path.join(__dirname, "..", "js");
const src = fs.readdirSync(jsDir).filter((f) => f.endsWith(".js")).sort().map((f) => fs.readFileSync(path.join(jsDir, f), "utf8")).join("\n");
const grab = (start, end) => {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error("Couldn't find " + start);
  return src.slice(i, j);
};

let settings = { householdSize: 2 };
// eslint-disable-next-line no-eval
eval(grab("const AISLES = [", "// Your own choice (Move items)").replace("const AISLES", "var AISLES").replace("const AISLE_RULES", "var AISLE_RULES"));
eval(grab("const FRACTIONS =", "function buildShoppingList").replace("const FRACTIONS", "var FRACTIONS").replace("const UNIT_ALIASES", "var UNIT_ALIASES").replace("const QTY_RE", "var QTY_RE"));
eval(grab("function formatAmount", "\n// ---- Your shop"));

let failures = 0;
function check(label, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(52)} → ${got}${ok ? "" : `   (wanted ${want})`}`);
}

// Aisles
for (const [text, want] of [
  ["Brocolli", "veg"], ["Broccoli", "veg"], ["Mushrom", "veg"], ["Chicken stock", "cupboard"],
  ["Chicken nuggets", "frozen"], ["Chicken thighs", "meat"], ["Frozen peas", "frozen"], ["Gravy granules", "cupboard"],
  ["Garlic bread", "bakery"], ["Coconut milk", "cupboard"], ["Soured cream", "dairy"], ["Tortilla chips", "cupboard"],
  ["Toppings of choice", "other"],
]) check(`aisle: ${text}`, aisleFor(text), want);

// Quantities
const describe = (lines, scale = 1) => {
  const item = {
    parts: lines.map((l) => { const p = parseIngredient(l); return { qty: p.qty === null ? null : p.qty * scale, unit: p.unit, unitText: p.unitText || "", times: !!p.times, name: p.name }; }),
    count: lines.length, text: lines[0],
  };
  return describeItem(item) + (item.count > 1 ? " ×" + item.count : "");
};
for (const [lines, want, scale] of [
  [["2 onions", "1 onion"], "3 onions"],
  [["500g mince beef", "250g mince beef"], "750g mince beef"],
  [["1.5 kg potatoes", "500 g potatoes"], "2kg potatoes"],
  [["2 tbsp oil", "1 tbsp oil"], "3 tbsp oil"],
  [["1 clove garlic", "2 cloves garlic"], "3 cloves garlic"],
  [["2 garlic cloves crushed"], "2 garlic cloves crushed"],
  [["1 x 280g jar of sun-dried tomatoes"], "1 x 280g jar of sun-dried tomatoes"],
  [["Onion", "2 onions"], "3 onions"],
  [["Mince beef", "Mince beef"], "Mince beef ×2"],
  [["Frozen pizza x3"], "Frozen pizza x3"],
  [["6 chicken thighs"], "3 chicken thighs", 0.5],
  [["4 rashers bacon"], "2 rashers bacon", 0.5],
  [["½ tsp chilli flakes"], "½ tsp chilli flakes"],
]) check(`qty: ${JSON.stringify(lines)}${scale ? " x" + scale : ""}`, describe(lines, scale || 1), want);

check("key: Onions", itemKey(parseIngredient("Onions").name), "onion");
check("key: 2 x Bin bags", itemKey(parseIngredient("Bin bags").name), "bin bag");
check("servings: Serves 4-6", String(parseServings("Serves 4-6")), "4");

console.log(failures ? `\n${failures} FAILED` : "\nAll unit checks passed");
process.exitCode = failures ? 1 : 0;
