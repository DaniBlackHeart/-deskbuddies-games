import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUnreadCount } from "../lib/useNotifications";
import PixelIcon, { type PixelIconName } from "./PixelIcon";

// Account menu (Debbie nav v4, 24 Nov 2026). The avatar opens a menu in place:
// a popover under it on desktop, a bottom sheet on phones. It never navigates
// by itself. It closes with Escape, an outside click, or the × button. On an
// account page the avatar gets a ring and aria-current; no nav tab is lit.
// The bell stays in the header AND the Notifications row stays here (both go
// to the same page, confirmed 24 Nov).

type Row = { to: string; label: string; hint: string; icon: PixelIconName | "bell" };

const ROWS: Row[] = [
  { to: "/profile", label: "Buddy Profile", hint: "How you look to other members", icon: "buddy-level" },
  { to: "/notifications", label: "Notifications", hint: "", icon: "bell" },
  { to: "/settings", label: "Settings", hint: "Theme, motion and notifications", icon: "settings" },
  { to: "/note-for-debbie", label: "A Note for Debbie", hint: "Suggestions, feedback, or something broken?", icon: "note-for-debbie" },
  { to: "/keep-the-desk-lit", label: "Keep the Desk Lit", hint: "Help keep Debbie running. It does not buy deskbits or XP.", icon: "keep-the-desk-lit" },
];

// Pages that belong to the account menu. Desk Log opens from the Buddy Profile.
const ACCOUNT_PATHS = ROWS.map((r) => r.to).concat("/desk-log");

function isAccountPath(pathname: string): boolean {
  return ACCOUNT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function BellIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 13h10l-1.5-2V8a3.5 3.5 0 0 0-7 0v3z" />
      <path d="M7.5 15.5h3" />
    </svg>
  );
}

export default function AccountMenu({ phone }: { phone: boolean }) {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const name = profile?.username ?? "";
  const url = profile?.avatar_url;
  const onAccountPage = isAccountPath(pathname);

  // Close after navigating or when the layout switches.
  useEffect(() => {
    setOpen(false);
  }, [pathname, phone]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();

    // On phones the sheet is modal: the page behind stops scrolling.
    const prevOverflow = document.body.style.overflow;
    if (phone) document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (phone) {
        // Modal sheet: Tab stays inside.
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    function onPointer(e: PointerEvent) {
      if (!phone && wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(false);
    }
    function onFocusIn(e: FocusEvent) {
      // Desktop popover: tabbing out of it closes it.
      if (!phone && wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phone]);

  const row = (r: Row) => {
    const active = pathname === r.to || pathname.startsWith(r.to + "/") || (r.to === "/profile" && pathname === "/desk-log");
    const isBell = r.to === "/notifications";
    return (
      <NavLink
        key={r.to}
        to={r.to}
        aria-current={active ? "page" : undefined}
        className={"app-menu__item" + (active ? " app-menu__item--active" : "")}
      >
        <span className="app-menu__icon" aria-hidden="true">
          {r.icon === "bell" ? <BellIcon /> : <PixelIcon name={r.icon} size={32} />}
        </span>
        <span className="app-menu__text">
          <span className="app-menu__label">{r.label}</span>
          {r.hint && <span className="app-menu__hint">{r.hint}</span>}
        </span>
        {isBell && unread > 0 && (
          <span className="app-menu__count">
            {unread > 9 ? "9+" : unread}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </NavLink>
    );
  };

  const list = <nav aria-label="Account">{ROWS.map(row)}</nav>;

  return (
    <div className="app-acct" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={"app-avatar" + (onAccountPage ? " app-avatar--active" : "")}
        aria-label={name ? `Account menu, ${name}` : "Account menu"}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-current={onAccountPage ? "page" : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {url && !failed ? (
          <img src={url} alt="" width={44} height={44} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        ) : (
          <span aria-hidden="true">{(name[0] ?? "?").toUpperCase()}</span>
        )}
      </button>

      {open && !phone && (
        <div className="app-pop" id="account-menu" ref={panelRef}>
          {list}
        </div>
      )}

      {open && phone && (
        <>
          <div className="app-sheet-backdrop" onClick={() => close()} aria-hidden="true" />
          <div className="app-sheet" id="account-menu" ref={panelRef} role="dialog" aria-modal="true" aria-label="Account">
            <div className="app-sheet__head">
              <h2 className="app-sheet__title">Account</h2>
              <button type="button" className="app-sheet__close" onClick={() => close()} aria-label="Close account menu">
                ×
              </button>
            </div>
            {list}
          </div>
        </>
      )}
    </div>
  );
}
