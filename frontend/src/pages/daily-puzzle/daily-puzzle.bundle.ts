// Re-exports every page belonging to the Daily Puzzle. App.tsx lazy-loads them through
// a single import() of this file (same pattern as trivia.bundle.ts), so no custom
// bundler chunk config is needed.
export { default as DailyPuzzlePage } from "./DailyPuzzlePage";
