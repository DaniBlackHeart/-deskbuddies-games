import { useRef, useState } from "react";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../contexts/AuthContext";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../lib/theme";
import { getMotionChoice, setMotionChoice, type MotionChoice } from "../lib/motion";

// Settings. Follows the "Debbie Settings" design, trimmed to what is real today.
// Theme and motion are kept on this device only (localStorage). Not built because the
// features they control do not exist yet: notification switches, "Let members leave Desk
// Stickies", "Show me in Who's around", and the Brag Shelf privacy row. When those ship,
// their switches must be enforced on the server, not just hidden in the browser.

const THEMES: { key: ThemeChoice; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "Match my device" },
];
const MOTIONS: { key: MotionChoice; label: string }[] = [
  { key: "system", label: "Match my device" },
  { key: "reduce", label: "Always reduce" },
];

export default function SettingsPage() {
  const { profile, signOut } = useAuth();
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice);
  const [motion, setMotion] = useState<MotionChoice>(getMotionChoice);
  const [saved, setSaved] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const signOutBtn = useRef<HTMLButtonElement>(null);

  const pickTheme = (k: ThemeChoice) => {
    setTheme(k);
    setThemeChoice(k);
    setSaved("Saved. Theme is " + (THEMES.find((t) => t.key === k)?.label.toLowerCase() ?? "") + " on this device.");
  };
  const pickMotion = (k: MotionChoice) => {
    setMotion(k);
    setMotionChoice(k);
    setSaved("Saved. Motion is set to " + (MOTIONS.find((m) => m.key === k)?.label.toLowerCase() ?? "") + " on this device.");
  };

  const doSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  const name = profile?.username ?? "";

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page set-page" id="settings">
        <div className="set-head">
          <div className="set-eyebrow">JUST FOR YOU</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Settings</h1>
          <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>Make Debbie feel right for you.</p>
        </div>

        <section className="set-card" aria-labelledby="set-appearance">
          <h2 className="set-h2" id="set-appearance">Appearance</h2>
          <div role="radiogroup" aria-label="Theme" className="set-group">
            <span className="set-label">Theme</span>
            <div className="set-row">
              {THEMES.map((t) => (
                <button key={t.key} type="button" role="radio" aria-checked={theme === t.key} className={"set-chip" + (theme === t.key ? " set-chip--on" : "")} onClick={() => pickTheme(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div role="radiogroup" aria-label="Motion" className="set-group">
            <span className="set-label">Motion</span>
            <div className="set-row">
              {MOTIONS.map((m) => (
                <button key={m.key} type="button" role="radio" aria-checked={motion === m.key} className={"set-chip" + (motion === m.key ? " set-chip--on" : "")} onClick={() => pickMotion(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            <p className="set-hint text-muted">Reduced motion shows page turns, stamps and buddies already settled. Nothing loops either way.</p>
          </div>
          <p className="set-saved" role="status">{saved}</p>
        </section>

        <section className="set-card" aria-labelledby="set-privacy">
          <h2 className="set-h2" id="set-privacy">Privacy</h2>
          <div className="set-fixed">
            <strong>Your Buddybook</strong>
            <span className="text-muted">Only you. Visitors never see it, even when they visit your desk.</span>
          </div>
          <div className="set-fixed">
            <strong>Books, habits, journals and focus goals</strong>
            <span className="text-muted">Only you, unless you choose to share something.</span>
          </div>
        </section>

        <section className="set-card" aria-labelledby="set-account">
          <h2 className="set-h2" id="set-account">Account</h2>
          <p className="t-body" style={{ margin: 0 }}>
            Signed in with Discord{name ? <> as <strong>{name}</strong></> : null}.
          </p>
          {confirming ? (
            <div className="set-confirm" role="group" aria-labelledby="set-so-h">
              <strong id="set-so-h">Sign out of Debbie?</strong>
              <span className="text-muted">Your progress, items and Discord server membership are not affected. You can sign back in any time.</span>
              <div className="set-row">
                <button type="button" className="set-btn set-btn--primary" aria-disabled={busy} onClick={() => void doSignOut()}>{busy ? "Signing out…" : "Sign out"}</button>
                <button type="button" className="set-btn" onClick={() => { setConfirming(false); signOutBtn.current?.focus(); }}>Stay signed in</button>
              </div>
            </div>
          ) : (
            <div>
              <button ref={signOutBtn} type="button" className="set-btn" onClick={() => setConfirming(true)}>Sign out</button>
            </div>
          )}
        </section>

        <p className="set-footnote">Only you can see this page. Theme and motion are saved on this device.</p>
      </main>
    </div>
  );
}
