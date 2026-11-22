// Motion preference. "system" follows the device; "reduce" always settles
// animation. Kept in localStorage as a per-device convenience and applied as
// data-motion="reduce" on <html>, which global.css reads. index.html applies the
// saved choice before first paint.

export type MotionChoice = "system" | "reduce";
const KEY = "debbie-motion";

export function getMotionChoice(): MotionChoice {
  try {
    if (localStorage.getItem(KEY) === "reduce") return "reduce";
  } catch {
    /* storage can be unavailable; fall through to the default */
  }
  return "system";
}

export function applyMotion(choice: MotionChoice) {
  const el = document.documentElement;
  if (choice === "reduce") el.setAttribute("data-motion", "reduce");
  else el.removeAttribute("data-motion");
}

export function setMotionChoice(choice: MotionChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* ignore: the choice just won't persist */
  }
  applyMotion(choice);
}

export function initMotion() {
  applyMotion(getMotionChoice());
}

/** True when motion should be settled: the device asks for it or the member chose it. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return getMotionChoice() === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
