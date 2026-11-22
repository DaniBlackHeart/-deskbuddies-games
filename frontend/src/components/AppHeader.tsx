import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { isGamesRoute } from "../lib/gameRoutes";
import PixelIcon, { type PixelIconName } from "./PixelIcon";
import MemberStats from "./MemberStats";
import ProfileAvatar from "./ProfileAvatar";
import { useUnreadCount } from "../lib/useNotifications";

// Icon-only navigation, from the 21-22 Nov 2026 Navigation Decision and the
// Debbie nav boards (placeholder IA, still waiting on Rika's approval).
//
// - Desktop: one icon-only bar, no More menu. Names show on hover AND on
//   keyboard focus; every link also has an accessible name and aria-current.
// - Phones: five icon-only tabs; More opens a dialog sheet with full labels
//   and a one-line hint for each item.
// Roadmap items (Buddy Boards, Buddy Clubs) are left out until they ship.
type NavItem = {
  to: string;
  label: string;
  icon: PixelIconName;
  hint: string; // shown in the phone More sheet (provisional copy)
  end?: boolean;
};

const HOME: NavItem = { to: "/", label: "Home", icon: "home", hint: "", end: true };
const COMMON_ROOM: NavItem = { to: "/common-room", label: "The Common Room", icon: "common-room", hint: "" };
const DESK_TIME: NavItem = { to: "/desk-time", label: "Desk Time", icon: "desk-time", hint: "" };
const REALITY_BREAK: NavItem = { to: "/games", label: "Reality Break", icon: "reality-break", hint: "" };
const BEYOND: NavItem = {
  to: "/beyond-the-desk",
  label: "Beyond the Desk",
  icon: "beyond-the-desk",
  hint: "Daily Detours, Weekly Wins, Side Quests",
};
const MY_DESK: NavItem = { to: "/my-desk", label: "My Desk", icon: "my-desk", hint: "Your desk and your buddies" };
const DESK_FINDS: NavItem = { to: "/deskfinds", label: "Desk Finds", icon: "desk-finds", hint: "Spend your deskbits" };
const BUDDYBOOK: NavItem = { to: "/buddybook", label: "Buddybook", icon: "buddybook", hint: "Your stamps and milestones" };
const CALENDAR: NavItem = { to: "/events", label: "Buddy Calendar", icon: "buddy-calendar", hint: "Events and dates" };
const KEEP_LIT: NavItem = {
  to: "/keep-the-desk-lit",
  label: "Keep the Desk Lit",
  icon: "keep-the-desk-lit",
  hint: "Help keep Debbie running. It does not buy deskbits or XP.",
};
const NOTE: NavItem = {
  to: "/note-for-debbie",
  label: "A Note for Debbie",
  icon: "note-for-debbie",
  hint: "Suggestions, feedback, or something broken?",
};
// Settings has its own placeholder page; theme and sign out stay on the
// Profile page (the avatar) until Settings is built.
const SETTINGS: NavItem = {
  to: "/settings",
  label: "Settings",
  icon: "settings",
  hint: "Theme, motion and notifications",
};

// Desktop groups: Play | You | Account (thin dividers between).
const DESKTOP_GROUPS: NavItem[][] = [
  [HOME, COMMON_ROOM, DESK_TIME, REALITY_BREAK],
  [BEYOND, MY_DESK, DESK_FINDS, BUDDYBOOK, CALENDAR, KEEP_LIT],
  [NOTE, SETTINGS],
];
// Phone bar, then the More sheet (a divider sits before the last three).
const BAR_TABS = [HOME, COMMON_ROOM, DESK_TIME, REALITY_BREAK];
const SHEET_MAIN = [BEYOND, MY_DESK, DESK_FINDS, BUDDYBOOK, CALENDAR];
const SHEET_ACCOUNT = [KEEP_LIT, NOTE, SETTINGS];

const PHONE_QUERY = "(max-width: 640px)";

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

function matches(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

export default function AppHeader() {
  // The unread count comes from the server. The badge shows only when it is above
  // zero (a number, never colour alone). Unknown counts show no badge.
  const unread = useUnreadCount();
  const { pathname } = useLocation();
  const isPhone = useIsPhone();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reserve room under the page for the fixed bottom bar (phones only; the
  // CSS does nothing on wider screens).
  useEffect(() => {
    document.body.classList.add("has-tabbar");
    return () => document.body.classList.remove("has-tabbar");
  }, []);

  // Close the sheet after navigating, and when the layout switches.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname, isPhone]);

  // The sheet is a modal dialog: focus moves in, Tab stays inside, Escape
  // closes and returns focus to the More tab, and the page behind stops
  // scrolling while it is open.
  useEffect(() => {
    if (!moreOpen) return;
    const sheet = sheetRef.current;
    const focusables = () =>
      Array.from(sheet?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMoreOpen(false);
        moreRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [moreOpen]);

  // Game lobby/play and MOD pages live outside /games, but they belong to
  // Reality Break, so keep it highlighted there.
  const inGames = isGamesRoute(pathname);
  const isActive = (item: NavItem) =>
    item.to === "/" ? pathname === "/" : item.to === "/games" ? inGames || matches(pathname, "/games") : matches(pathname, item.to);

  // On phones, a page reached from More highlights the More tab.
  const moreActive = [...SHEET_MAIN, ...SHEET_ACCOUNT].some(isActive);

  function closeSheet() {
    setMoreOpen(false);
    moreRef.current?.focus();
  }

  const sheetRow = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      aria-current={isActive(item) ? "page" : undefined}
      className={"app-sheet__item" + (isActive(item) ? " app-sheet__item--active" : "")}
    >
      <span className="app-sheet__icon" aria-hidden="true">
        <PixelIcon name={item.icon} size={32} />
      </span>
      <span className="app-sheet__text">
        <span className="app-sheet__label">{item.label}</span>
        <span className="app-sheet__hint">{item.hint}</span>
      </span>
    </NavLink>
  );

  return (
    <header
      className="app-header"
      style={{
        borderBottom: "1px solid var(--color-border-soft)",
        background: "var(--color-surface)",
      }}
    >
      <div className="container app-headrow">
        <Link to="/" className="app-brand">
          Debbie
        </Link>

        {/* Desktop and tablet: icon-only bar. Hidden on phones, which use the bottom bar. */}
        <nav className="app-iconnav" aria-label="Main">
          {DESKTOP_GROUPS.map((group, gi) => (
            <ul className="app-iconnav__group" key={gi}>
              {group.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      data-tip={item.label}
                      className={"app-icontab" + (active ? " app-icontab--active" : "")}
                    >
                      <PixelIcon name={item.icon} size={32} />
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          ))}
        </nav>

        <div className="app-right">
          <MemberStats />
          <NavLink
            to="/notifications"
            className="app-bell"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 13h10l-1.5-2V8a3.5 3.5 0 0 0-7 0v3z" />
              <path d="M7.5 15.5h3" />
            </svg>
            {unread > 0 && (
              <span className="app-bell__badge" aria-hidden="true">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </NavLink>
          <ProfileAvatar />
        </div>
      </div>

      {/* Phones: five icon-only tabs; More opens the sheet above them. */}
      {isPhone && moreOpen && (
        <>
          <div className="app-sheet-backdrop" onClick={closeSheet} aria-hidden="true" />
          <div className="app-sheet" id="more-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label="More">
            <div className="app-sheet__head">
              <h2 className="app-sheet__title">More</h2>
              <button type="button" className="app-sheet__close" onClick={closeSheet} aria-label="Close More">
                ×
              </button>
            </div>
            {SHEET_MAIN.map(sheetRow)}
            <div className="app-sheet__rule" aria-hidden="true" />
            {SHEET_ACCOUNT.map(sheetRow)}
          </div>
        </>
      )}
      <nav className="app-bottombar" aria-label="Main">
        <ul className="app-bottombar__list">
          {BAR_TABS.map((tab) => {
            const active = isActive(tab);
            const lit = active && !moreOpen; // the open sheet takes the highlight
            return (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  aria-label={tab.label}
                  aria-current={active ? "page" : undefined}
                  className={"app-bt" + (lit ? " app-bt--active" : "")}
                >
                  <PixelIcon name={tab.icon} size={32} />
                </NavLink>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              ref={moreRef}
              aria-label="More"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-controls="more-sheet"
              className={"app-bt" + (moreActive || moreOpen ? " app-bt--active" : "")}
              onClick={() => setMoreOpen((o) => !o)}
            >
              <PixelIcon name="more" size={32} />
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}
