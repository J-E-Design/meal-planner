const CACHE = "meal-planner-v10";
const FILES = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.json", "./icon-192.png", "./icon-512.png",
  "./nom.mp3", "./cowabunga.mp3", "./om_nom_nom_nom_nom.mp3",
];

// Fetch and cache one file at a time, each with a timeout, so a single slow
// or blocked request (some free hosts rate-limit request bursts) can't hang
// the whole install forever and leave the worker stuck "installing".
async function precache(cache) {
  for (const url of FILES) {
    try {
      const res = await Promise.race([
        fetch(url, { cache: "no-store" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      if (res && res.ok) await cache.put(url, res);
    } catch (e) {
      // best-effort: skip files that fail so install still completes
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(precache));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // The database lives on a different origin (Supabase) and always needs live
  // data - never cache or fall back to a stale copy. Only manage our own
  // same-origin app-shell files here.
  if (new URL(event.request.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    // GitHub Pages serves static files with Cache-Control: max-age=600, so a
    // plain fetch() can silently return a stale disk-cached response even
    // though we're "hitting the network" - force a real bypass here.
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
