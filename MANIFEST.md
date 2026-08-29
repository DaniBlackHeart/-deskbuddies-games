# Route-based code splitting, per game

**Date:** 2026-08-29

## Why

Dani noticed the app loading slower after the Rules-modal delivery and asked for an investigation.
The modals themselves only added ~7 KB gzipped — real, but not enough to explain "everything loads
slower." The actual cause: `App.tsx` statically imported every page for all six games (lobby, play,
and every mod/host/spectator/editor screen — 40+ files) into one route table, so Vite bundled the
entire app into a single ~809 KB / 205 KB-gzipped JS file that downloads before anything renders,
even the login screen. Every game added since Trivia Night shipped made that same download heavier
for every visitor, whether they ever touch that game or not.

This delivery splits the app so each game's code only downloads when someone actually opens that
game.

## How it works

Each game's pages (lobby, play, and its mod pages — which live flat in `pages/mod/` rather than
their own folder, a naming leftover from Trivia being first) are re-exported from one new barrel
file per game: `pages/<game>/<game>.bundle.ts`. In `App.tsx`, every lazy-loaded page for a game
calls the *same* `import("...<game>.bundle")` specifier. The JS module loader dedupes identical
`import()` calls on its own — it fetches that one chunk once, the first time someone navigates into
the game, and reuses it for every other page in that game (lobby → play, or a MOD moving between
host/spectator/editor screens) for the rest of the session, with zero custom bundler configuration.

`vite.config.ts` is back to the plain default — no custom chunking rules. That's deliberate: the
first approach tried was a custom `manualChunks`/`codeSplitting` rule to merge each game's
separately-lazy-loaded pages into one chunk directly. That hit real bugs in the current Vite 8 /
Rolldown 1.2.3 pairing — a component used by two different games (`Timer`, `Buzzer`, `sounds.ts`,
`clockSync.ts`, `TypedAnswerBox`, all confirmed used by multiple games) would get welded entirely
inside whichever game's chunk claimed it first, and the *other* game's chunk would silently
cross-import that entire other game's bundle at runtime just to get the shared piece — e.g. loading
Wheel of Fortune alone would have also downloaded all of Family Feud's code. Several variations of
that approach were tried (a recursive module-graph walk, Rolldown's native `codeSplitting.groups`
API) and all hit the same underlying bug. The barrel-file approach sidesteps it completely by
relying only on plain, well-established `import()` caching — no bundler-internals workaround
needed, and nothing here depends on this specific Rolldown version's behavior.

`App.tsx` also gained a `<Suspense>` boundary around the route table, with a small new
`RouteLoadingFallback` component (the same center-screen + spinner pattern already used for
in-page loading elsewhere) shown while a chunk is being fetched. `LoginPage`, `NotAMemberPage`, and
`DashboardPage` stay as static/eager imports — they're the shell almost every visitor hits
immediately, so there's no reason to make first paint wait on a chunk fetch for them.

No page component itself was touched — every lobby/play/mod/host/spectator/editor file is
byte-for-byte the same as before. Only how they're imported and routed changed.

## Adding game #7 later

Put its pages in their own `pages/<game>/` folder as usual, add a `pages/<game>/<game>.bundle.ts`
re-exporting them (copy an existing one and swap the names), and add its `lazy()` + `<Route>`
entries in `App.tsx` (copy an existing game's block). It automatically gets its own chunk — no
other game's bundle grows, and nothing needs to be told which components or lib files it happens to
share with existing games; that's resolved automatically by ordinary bundler behavior, the same way
it already is for Timer/Buzzer/sounds.ts/etc. today.

## Numbers

Before (from the last build prior to this change): one bundle, always downloaded —
**809.27 kB / 205.10 kB gzipped**, on every single page including login.

After — what actually downloads, per situation:
- **Login / Dashboard (the shared shell everyone hits first):** `index` chunk —
  **459.34 kB / 132.21 kB gzipped**, plus the 21.22 kB / 4.53 kB CSS file (unchanged, CSS isn't
  split by this change).
- **Opening one game for the first time** (lobby or play — whichever hit first, since both are in
  the same chunk): an additional **28.71–77.63 kB / 7.07–17.49 kB gzipped**, varying by game (UNO
  smallest, Type What You See largest, matching how much code each game actually has). Cached after
  that — later navigation within the same game costs nothing further.
- **A MOD's session/editor pages:** included in that same per-game chunk already fetched — no
  extra request.
- **Shared pieces used by 2+ games** (`Timer`, `Buzzer`, `TypedAnswerBox`, `Leaderboard`): each
  correctly isolated into its own tiny (under 1 KB) chunk, fetched once by whichever game a player
  first opens that needs it, reused after that — confirmed with no game's chunk cross-importing
  another's.
- **`/mod` hub page:** its own small 11.41 kB / 2.26 kB gzipped chunk.

Net effect: someone who logs in and plays one game now downloads roughly 460–540 KB total instead
of 809 KB every time, and every game added after this one only grows that specific game's own
chunk — it stops adding weight to the shell every visitor pays for on login.

## Files changed

- `frontend/vite.config.ts` — reverted to the plain default (no custom chunk config needed)
- `frontend/src/App.tsx` — lazy-loaded routes via per-game barrel imports, `Suspense` boundary

New:
- `frontend/src/components/RouteLoadingFallback.tsx`
- `frontend/src/pages/trivia/trivia.bundle.ts`
- `frontend/src/pages/feud/feud.bundle.ts`
- `frontend/src/pages/uno/uno.bundle.ts`
- `frontend/src/pages/impostor/impostor.bundle.ts`
- `frontend/src/pages/wheel/wheel.bundle.ts`
- `frontend/src/pages/rebus/rebus.bundle.ts`

No page component files were modified.

## Validation run

From `frontend/`:
- `npx tsc -b` — clean
- `npx oxlint` on all changed/new files — clean
- `npx vite build` — clean; verified by direct inspection of the build output (grepping for
  game-specific markers across every chunk) that no game's chunk contains another game's code, and
  no chunk cross-imports another game's chunk at runtime

Frontend-only change: no Edge Functions, migrations, or backend logic touched, so no Supabase
deploy is needed for this one.

## Deploy steps

```bash
git add frontend/vite.config.ts frontend/src/App.tsx frontend/src/components/RouteLoadingFallback.tsx frontend/src/pages/trivia/trivia.bundle.ts frontend/src/pages/feud/feud.bundle.ts frontend/src/pages/uno/uno.bundle.ts frontend/src/pages/impostor/impostor.bundle.ts frontend/src/pages/wheel/wheel.bundle.ts frontend/src/pages/rebus/rebus.bundle.ts
git commit -m "perf: route-based code splitting per game, so the app only downloads the game being played instead of one monolithic bundle for every visit"
git push
```

No migration, no Edge Function deploy — this is all client-side.

## What to check on the next playtest

- [ ] Open the DevTools Network tab, hard-refresh the login/dashboard screen, and confirm only the
      shell chunk downloads — no game-specific chunk yet
- [ ] Open one game (e.g. Wheel of Fortune) and confirm exactly one new chunk downloads (its name
      will contain `wheel.bundle`), and that no *other* game's chunk downloads alongside it
- [ ] Navigate from that game's lobby into a live play session and confirm no second chunk fetch
      happens (same chunk, already cached)
- [ ] As a MOD, move between a game's host/spectator/editor pages and confirm no extra chunk
      fetches happen there either
- [ ] Confirm the brief loading spinner (same style as other in-app loading states) shows during
      the one chunk fetch on a throttled/slow connection, and disappears cleanly once the page
      renders
- [ ] Spot check that every game still works exactly as before — this only changed how pages are
      loaded, not any game logic
