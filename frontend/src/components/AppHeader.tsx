import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { isGamesRoute } from "../lib/gameRoutes";
import PixelIcon, { type PixelIconName } from "./PixelIcon";
import MemberStats from "./MemberStats";
import ProfileAvatar from "./ProfileAvatar";

// Tab order is fixed by product direction: Home, Games, Boards, Events,
// Desk Finds, Profile. Icons come from the locked Debbie icon set v1 and sit
// beside a visible label. Profile has no icon in v1 (see the .app-tab__icon
// placeholder below) — it needs a v1.1 addition.
const TABS: { to: string; label: string; icon?: PixelIconName; end?: boolean }[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/games", label: "Games", icon: "reality-break" },
  { to: "/boards", label: "Boards", icon: "buddy-boards" },
  { to: "/events", label: "Events", icon: "buddy-calendar" },
  { to: "/deskfinds", label: "Desk Finds", icon: "desk-finds" },
  { to: "/profile", label: "Profile" },
];

// Phone layout: a bottom bar with four tabs plus More. Desk Finds and Profile
// live in the More sheet until My Desk, Desk Time and the rest exist.
const BAR_TABS = TABS.filter((t) => ["/", "/games", "/boards", "/events"].includes(t.to));
const MORE_TABS = TABS.filter((t) => ["/deskfinds", "/profile"].includes(t.to));

export default function AppHeader() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reserve room under the page for the fixed bottom bar (phones only; the
  // CSS does nothing on wider screens).
  useEffect(() => {
    document.body.classList.add("has-tabbar");
    return () => document.body.classList.remove("has-tabbar");
  }, []);

  // Close the sheet after navigating.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Sheet: Escape closes and returns focus to the More button; focus moves
  // into the sheet when it opens.
  useEffect(() => {
    if (!moreOpen) return;
    sheetRef.current?.querySelector<HTMLElement>("a")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMoreOpen(false);
        moreBtnRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  // Game lobby/play and MOD pages live outside /games, but they belong to the
  // Games tab, so keep it highlighted there.
  const inGames = isGamesRoute(pathname);
  const moreActive = MORE_TABS.some((t) => pathname === t.to || pathname.startsWith(t.to + "/"));

  return (
    <header
      style={{
        borderBottom: "1px solid var(--color-border-soft)",
        background: "var(--color-surface)",
      }}
    >
      <div className="container app-brandrow">
        <Link to="/" className="app-brand">
          <img src="/favicon.svg" alt="" width={32} height={32} className="app-brand__mark" />
          Debbie
        </Link>
        {/* Narrow screens: chips sit beside the brand. Wide screens: right of the tabs. */}
        <div className="app-right app-right--narrow">
          <MemberStats className="app-stats--narrow" />
          <ProfileAvatar className="app-avatar--narrow" />
        </div>
      </div>

      <div className="container app-navrow">
        <nav className="app-tabs" aria-label="Main">
          {TABS.filter((t) => t.to !== "/profile").map((tab) => {
            const forceActive = tab.to === "/games" && inGames;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  "app-tab" + (isActive || forceActive ? " app-tab--active" : "")
                }
                aria-current={undefined}
              >
                <span className="app-tab__icon" aria-hidden="true">
                  {tab.icon && <PixelIcon name={tab.icon} size={16} />}
                </span>
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="app-right">
          <MemberStats className="app-stats--wide" />
          <ProfileAvatar className="app-avatar--wide" />
        </div>
      </div>
      {/* Phones: bottom tab bar. Hidden on wider screens (see global.css). */}
      {moreOpen && <div className="app-sheet-backdrop" onClick={() => setMoreOpen(false)} aria-hidden="true" />}
      {moreOpen && (
        <div className="app-sheet" id="more-sheet" ref={sheetRef} role="group" aria-label="More">
          {MORE_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => "app-sheet__item" + (isActive ? " app-sheet__item--active" : "")}
            >
              <span className="app-bt__icon" aria-hidden="true">
                {tab.icon && <PixelIcon name={tab.icon} size={32} />}
              </span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      )}
      <nav className="app-bottombar" aria-label="Main">
        <ul className="app-bottombar__list">
          {BAR_TABS.map((tab) => {
            const forceActive = tab.to === "/games" && inGames;
            return (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) => "app-bt" + (isActive || forceActive ? " app-bt--active" : "")}
                  aria-current={undefined}
                >
                  <span className="app-bt__icon" aria-hidden="true">
                    {tab.icon && <PixelIcon name={tab.icon} size={32} />}
                  </span>
                  <span>{tab.label}</span>
                </NavLink>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              ref={moreBtnRef}
              className={"app-bt" + (moreActive || moreOpen ? " app-bt--active" : "")}
              aria-expanded={moreOpen}
              aria-controls="more-sheet"
              onClick={() => setMoreOpen((o) => !o)}
            >
              <span className="app-bt__icon" aria-hidden="true">
                <PixelIcon name="more" size={32} />
              </span>
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}
