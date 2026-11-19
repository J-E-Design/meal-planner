// Colour-contrast check for every look, light and dark (WCAG 2.1 ratios).
// Run from the repo root:  node tests/contrast.js
// Body text needs 4.5:1; large text, icons and accents need 3:1.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const lum = (hex) => {
  const c = hex.replace("#", "");
  const v = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function tokens(css, selector) {
  const out = {};
  const m = css.match(new RegExp(escapeRe(selector) + "\\s*\\{([^}]*)\\}"));
  if (!m) return out;
  for (const [, k, v] of m[1].matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) out[k] = v;
  return out;
}

const base = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const classicLight = tokens(base, ":root");
const looks = { classic: [classicLight, { ...classicLight, ...tokens(base, "body.dark-mode") }] };
for (const l of ["fridge", "chalk", "calm"]) {
  const css = fs.readFileSync(path.join(root, "looks", `${l}.css`), "utf8");
  const light = tokens(css, `[data-look="${l}"]`);
  looks[l] = [light, { ...light, ...tokens(css, `[data-look="${l}"] body.dark-mode`) }];
}

const checks = [
  ["text", "bg", 4.5], ["text", "card-bg", 4.5],
  ["muted", "bg", 4.5], ["muted", "card-bg", 4.5],
  ["muted2", "bg", 3], ["muted2", "card-bg", 3],
  ["accent", "bg", 3], ["accent", "card-bg", 3],
];
let failures = 0;
for (const [look, [light, dark]] of Object.entries(looks)) {
  for (const [mode, t] of [["light", light], ["dark", dark]]) {
    const bad = checks
      .filter(([a, b]) => t[a] && t[b])
      .map(([a, b, min]) => ({ a, b, min, r: ratio(t[a], t[b]) }))
      .filter((c) => c.r < c.min);
    failures += bad.length;
    console.log(
      `${look.padEnd(7)} ${mode.padEnd(5)} ` +
        (bad.length ? bad.map((c) => `✗ ${c.a} on ${c.b} ${c.r.toFixed(2)} (needs ${c.min})`).join("  ") : "all ok")
    );
  }
}
process.exitCode = failures ? 1 : 0;
