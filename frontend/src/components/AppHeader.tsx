import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { isGamesRoute } from "../lib/gameRoutes";
import PixelIcon, { type PixelIconName } from "./PixelIcon";
import MemberStats from "./MemberStats";
import ProfileAvatar from "./ProfileAvatar";

// Navigation follows the Home concept and the 21 Nov 2026 navigation decision
// (placeholder IA, waiting on Rika's approval). Icons are the locked Icon Set
// v1; labels are the Naming Guide names. Roadmap items (Buddy Boards, Buddy
// Clubs) stay out of the bar until they ship, and A Note for Debbie is left out
// until its home is decided.
type NavItem = { to: string; label: string; icon?: PixelIconName; end?: boolean };

const HOME: NavItem = { to: "/", label: "Home", icon: "home", end: true };
const COMMON_ROOM: NavItem = { to: "/common-room", label: "The Common Room", icon: "common-room" };
const DESK_TIME: NavItem = { to: "/desk-time", label: "Desk Time", icon: "desk-time" };
const REALITY_BREAK: NavItem = { to: "/games", label: "Reality Break", icon: "reality-break" };
const BEYOND: NavItem = { to: "/beyond-the-desk", label: "Beyond the Desk", icon: "beyond-the-desk" };
const DESK_FINDS: NavItem = { to: "/deskfinds", label: "Desk Finds", icon: "desk-finds" };
const MY_DESK: NavItem = { to: "/my-desk", label: "My Desk", icon: "my-desk" };
const BUDDYBOOK: NavItem = { to: "/buddybook", label: "Buddybook", icon: "buddybook" };
const CALENDAR: NavItem = { to: "/events", label: "Buddy Calendar", icon: "buddy-calendar" };
const KEEP_LIT: NavItem = { to: "/keep-the-desk-lit", label: "Keep the Desk Lit", icon: "keep-the-desk-lit" };
// Profile has no icon in v1; Settings (theme, sign out) is the Profile page.
const SETTINGS: NavItem = { to: "/profile", label: "Settings" };

// Desktop top bar, then a More menu.
const TOP_TABS = [HOME, COMMON_ROOM, DESK_TIME, REALITY_BREAK, BEYOND, DESK_FINDS];
const DESKTOP_MORE = [MY_DESK, BUDDYBOOK, CALENDAR, KEEP_LIT, SETTINGS];
// Phone bottom bar (four tabs + More), then a More sheet.
const BAR_TABS = [HOME, COMMON_ROOM, DESK_TIME, REALITY_BREAK];
const PHONE_MORE = [BEYOND, MY_DESK, DESK_FINDS, BUDDYBOOK, CALENDAR, KEEP_LIT, SETTINGS];

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
  const { pathname } = useLocation();
  const isPhone = useIsPhone();
  const [moreOpen, setMoreOpen] = useState(false);
  const deskMoreRef = useRef<HTMLButtonElement>(null);
  const phoneMoreRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reserve room under the page for the fixed bottom bar (phones only; the
  // CSS does nothing on wider screens).
  useEffect(() => {
    document.body.classList.add("has-tabbar");
    return () => document.body.classList.remove("has-tabbar");
  }, []);

  // Close the menu after navigating, and when the layout switches.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname, isPhone]);

  // Escape closes and returns focus to the More button; focus moves into the
  // menu when it opens.
  useEffect(() => {
    if (!moreOpen) return;
    sheetRef.current?.querySelector<HTMLElement>("a")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMoreOpen(false);
        (isPhone ? phoneMoreRef : deskMoreRef).current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen, isPhone]);

  // Game lobby/play and MOD pages live outside /games, but they belong to
  // Reality Break, so keep it highlighted there.
  const inGames = isGamesRoute(pathname);
  const isActive = (item: NavItem) =>
    item.to === "/" ? pathname === "/" : item.to === "/games" ? inGames || matches(pathname, "/games") : matches(pathname, item.to);

  const moreItems = isPhone ? PHONE_MORE : DESKTOP_MORE;
  const moreActive = moreItems.some(isActive);
  const iconSize = isPhone ? 32 : 16;

  const sheet = moreOpen && (
    <>
      <div className="app-sheet-backdrop" onClick={() => setMoreOpen(false)} aria-hidden="true" />
      <div className="app-sheet" id="more-sheet" ref={sheetRef} role="group" aria-label="More">
        {moreItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={"app-sheet__item" + (isActive(item) ? " app-sheet__item--active" : "")}
          >
            <span className="app-sheet__icon" aria-hidden="true">
              {item.icon && <PixelIcon name={item.icon} size={iconSize} />}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </>
  );

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
        {/* Chips and the profile avatar sit at the right of the brand row (as in
            the Home concept); the tab row below has the room for seven tabs. */}
        <div className="app-right">
          <MemberStats />
          <ProfileAvatar />
        </div>
      </div>

      <div className="container app-navrow">
        <div className="app-navleft">
          <nav className="app-tabs" aria-label="Main">
            {TOP_TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={"app-tab" + (isActive(tab) ? " app-tab--active" : "")}
                aria-current={undefined}
              >
                <span className="app-tab__icon" aria-hidden="true">
                  {tab.icon && <PixelIcon name={tab.icon} size={16} />}
                </span>
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="app-more">
            <button
              type="button"
              ref={deskMoreRef}
              className={"app-tab" + (moreActive || (moreOpen && !isPhone) ? " app-tab--active" : "")}
              aria-expanded={!isPhone && moreOpen}
              aria-controls="more-sheet"
              onClick={() => setMoreOpen((o) => !o)}
            >
              <span className="app-tab__icon" aria-hidden="true">
                <PixelIcon name="more" size={16} />
              </span>
              <span>More</span>
            </button>
            {!isPhone && sheet}
          </div>
        </div>
      </div>

      {/* Phones: the menu is a sheet above a fixed bottom bar (see global.css). */}
      {isPhone && sheet}
      <nav className="app-bottombar" aria-label="Main">
        <ul className="app-bottombar__list">
          {BAR_TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={"app-bt" + (isActive(tab) ? " app-bt--active" : "")}
                aria-current={undefined}
              >
                <span className="app-bt__icon" aria-hidden="true">
                  {tab.icon && <PixelIcon name={tab.icon} size={32} />}
                </span>
                <span>{tab.label}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              ref={phoneMoreRef}
              className={"app-bt" + (moreActive || (moreOpen && isPhone) ? " app-bt--active" : "")}
              aria-expanded={isPhone && moreOpen}
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
