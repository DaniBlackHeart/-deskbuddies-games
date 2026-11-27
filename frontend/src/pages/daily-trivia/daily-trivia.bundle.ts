// Re-exports every page belonging to the Daily Trivia. App.tsx lazy-loads them through a
// single import() of this file (same pattern as trivia.bundle.ts and daily-puzzle.bundle.ts).
export { default as DailyTriviaPage } from "./DailyTriviaPage";
