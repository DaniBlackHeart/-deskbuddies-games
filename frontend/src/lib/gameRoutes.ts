// Routes that belong to the Games tab: the games hub, every game's lobby and
// play pages, and the MOD pages (which live under Games). Used by the header
// (to highlight the tab) and the sound button (shown only here).
export const GAME_ROUTE_PREFIXES = [
  "/games",
  "/trivia",
  "/feud",
  "/uno",
  "/impostor",
  "/wheel",
  "/rebus",
  "/mod",
];

export function isGamesRoute(pathname: string): boolean {
  return GAME_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
