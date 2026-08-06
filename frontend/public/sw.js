// Minimal service worker — just enough to satisfy PWA installability
// requirements. Intentionally does NOT cache aggressively, so members
// always get the latest build (important for a live trivia app).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass-through network fetch. No offline cache — a live trivia app
  // needs a live connection anyway.
  event.respondWith(fetch(event.request));
});
