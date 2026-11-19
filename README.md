# What's for tea?

A weekly meal planner for our household: shuffle a week of teas, plan up to four weeks
ahead, and share one shopping list between two phones.

**App:** https://j-e-design.github.io/meal-planner/ (asks for the household passcode once per phone)

## How it fits together

| Part | Where it lives | What it does |
|---|---|---|
| The app (HTML/CSS/JS) | This repo, served by **GitHub Pages** | Everything you see. No build step — plain files. |
| Data API | `api/` → uploaded to **iFastNet** at `jamieemerydesign.co.uk/meal-planner/` | Stores everything in one MySQL table, checks the passcode, makes daily backups. |
| Calendar feed | `api/calendar.php` | iCalendar feed of planned teas with reminders (link in Settings). |
| Recipe import | `api/import.php` | Reads the recipe data from a recipe page link. |

The app talks to the API cross-origin; the API only accepts requests from the GitHub Pages
address **and** with the household passcode.

### Files

```
index.html            the page
styles.css            base styles (and the "Classic" look)
looks/*.css           the Fridge door, Café chalkboard and Calm modern looks
js/01-core.js …       the app, split into 7 files loaded in order (shared global scope):
  01-core             constants, looks, sounds, server access, passcode
  02-plan             weeks, notes, saving, start-up
  03-week             week view, shuffle weighting, swipe & match, vetoes
  04-shopping         aisles, quantities, shopping list, offline ticks
  05-meals            day editor, My meals, recipe import, search
  06-settings         settings, who's this phone, Year in tea, backups, calendar
  07-app              navigation, accessibility, start-up
sw.js                 service worker (offline cache) — bump CACHE when files change
api/                  PHP for the iFastNet hosting (see below)
tests/                checks — see "Testing"
```

### Data

One table, `app_state (name, value JSON, updated_at)`, one row per kind of data:
`meals`, `plan` (weeks by date), `notes`, `settings`, `swipes`, `ticks`, `extras`,
`activity`, `history` (and the older `week`). The allowed names are listed in `api/state.php`.

## Server setup (iFastNet)

1. Create a MySQL database + user in cPanel, and run `sql/mysql_schema.sql` in phpMyAdmin.
2. Copy `api/config.sample.php` to `config.php` and fill in the database details and the
   passcode hashes (instructions are in the file). **`config.php` is never committed.**
3. Upload `api/*.php` (and `config.php`, `.htaccess`) to `public_html/meal-planner/`.

Daily backups are written automatically to `public_html/meal-planner/backups/`
(blocked from the web, last 30 kept) and can be restored from **Settings → Backups**.

## Testing

```
bash tests/run.sh        # everything (needs Chrome/Edge for the browser tests)
bash tests/run.sh unit   # just the fast checks
```

- `tests/unit.js` — aisle rules and quantity maths
- `tests/contrast.js` — colour contrast for every look, light and dark
- `tests/harness.js` + `tests/fixture.js` — browser tests against a **fake server with made-up data**
  (they never touch the real data)

## Changing things safely

- Bump `CACHE` in `sw.js` whenever a file changes, so phones pick up the new version.
- New kind of data? Add its name to `$ALLOWED_NAMES` in `api/state.php` and to `BACKUP_NAMES`
  in `js/06-settings.js`.
- Run `bash tests/run.sh` before pushing.
