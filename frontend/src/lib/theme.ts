// Light / dark theme. The choice ("light" | "dark" | "system") is kept in
// localStorage as a light per-device convenience and applied as data-theme on
// <html>, which tokens.css reads. index.html applies the saved choice before
// first paint so there is no flash. Default is light.

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "debbie-theme";

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage can be unavailable; fall through to the default */
  }
  return "light";
}

function resolve(choice: ThemeChoice): "light" | "dark" {
  if (choice === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return choice;
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.setAttribute("data-theme", resolve(choice));
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* ignore: the choice just won't persist */
  }
  applyTheme(choice);
}

// Call once at startup: applies the saved choice and follows the device while
// "system" is selected.
export function initTheme() {
  applyTheme(getThemeChoice());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemeChoice() === "system") applyTheme("system");
  });
}
