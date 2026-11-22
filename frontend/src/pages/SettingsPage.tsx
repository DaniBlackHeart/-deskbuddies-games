import { useEffect, useRef, useState } from "react";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../contexts/AuthContext";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../lib/theme";
import { supabase } from "../lib/supabaseClient";
import { getMotionChoice, setMotionChoice, type MotionChoice } from "../lib/motion";

// Settings. Follows the "Debbie Settings" design. Theme and motion stay on this device
// (localStorage). The four switches are saved on the member's account (member_settings, written
// by the member-settings Edge Function). Desk Stickies, the bell and Who's around do not exist
// yet, so nothing reads these switches yet; whatever ships them must check them on the server.

type SwitchKey = "notify_stickies" | "notify_news" | "allow_stickies" | "show_in_around";
const NOTIFY: { key: SwitchKey; label: string; hint: string }[] = [
  { key: "notify_stickies", label: "Desk Stickies", hint: "When someone leaves one on your desk." },
  { key: "notify_news", label: "What’s new", hint: "Updates from Debbie." },
];
const PRIVACY: { key: SwitchKey; label: string; hint: string }[] = [
  { key: "allow_stickies", label: "Let members leave Desk Stickies", hint: "Off hides the sticky button on your desk." },
  { key: "show_in_around", label: "Show me in Who’s around", hint: "Others see you there while you focus or co-work." },
];
const ALL_ON: Record<SwitchKey, boolean> = { notify_stickies: true, notify_news: true, allow_stickies: true, show_in_around: true };

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
  const [sw, setSw] = useState<Record<SwitchKey, boolean> | null>(null);
  const signOutBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { data, error } = await supabase.from("member_settings").select("notify_stickies,notify_news,allow_stickies,show_in_around").maybeSingle();
        if (error) throw error;
        if (live) setSw({ ...ALL_ON, ...(data ?? {}) });
      } catch {
        if (live) setSw(ALL_ON);
      }
    })();
    return () => { live = false; };
  }, []);

  const toggle = async (key: SwitchKey, label: string) => {
    if (!sw) return;
    const next = !sw[key];
    setSw({ ...sw, [key]: next });
    try {
      const { data, error } = await supabase.functions.invoke("member-settings", { body: { action: "set", key, value: next } });
      if (error || (data as { status?: string })?.status !== "ok") throw error ?? new Error("not saved");
      setSaved(label + " is now " + (next ? "on" : "off") + ". Saved.");
    } catch {
      setSw((cur) => (cur ? { ...cur, [key]: !next } : cur));
      setSaved("That didn’t save. Please try again.");
    }
  };

  const switchRow = (r: { key: SwitchKey; label: string; hint: string }) => {
    const on = sw ? sw[r.key] : true;
    return (
      <button key={r.key} type="button" role="switch" aria-checked={on} disabled={!sw} className="set-switch" onClick={() => void toggle(r.key, r.label)}>
        <span className="set-switch__text">
          <span className="set-switch__title">{r.label}</span>
          <span className="set-hint text-muted">{r.hint}</span>
        </span>
        <span className={"set-track" + (on ? " set-track--on" : "")} aria-hidden="true"><span className="set-knob" /></span>
        <span className="set-state" aria-hidden="true">{on ? "On" : "Off"}</span>
      </button>
    );
  };

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
          <p className="set-hint text-muted" style={{ marginTop: -10 }}>How Debbie looks and moves on this device.</p>
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

        <section className="set-card" aria-labelledby="set-notif">
          <h2 className="set-h2" id="set-notif">Notifications</h2>
          <p className="set-hint text-muted" style={{ marginTop: -10 }}>Choose what shows up on your bell.</p>
          {NOTIFY.map(switchRow)}
          <p className="set-hint text-muted">Turning one off only hides it from the bell. Desk Stickies stay on your desk.</p>
        </section>

        <section className="set-card" aria-labelledby="set-privacy">
          <h2 className="set-h2" id="set-privacy">Privacy</h2>
          <p className="set-hint text-muted" style={{ marginTop: -10 }}>Who can see what. Some things are always private.</p>
          <div className="set-fixed">
            <strong>Your Buddybook</strong>
            <span className="text-muted">Only you. Visitors never see it, even when they visit your desk.</span>
          </div>
          <div className="set-fixed">
            <strong>Books, habits, journals and focus goals</strong>
            <span className="text-muted">Only you, unless you choose to share something.</span>
          </div>
          <div className="set-fixed">
            <strong>The Brag Shelf</strong>
            <span className="text-muted">Visitors see only the items you leave visible on it.</span>
          </div>
          {PRIVACY.map(switchRow)}
        </section>

        <section className="set-card" aria-labelledby="set-account">
          <h2 className="set-h2" id="set-account">Account</h2>
          <p className="set-hint text-muted" style={{ marginTop: -10 }}>Debbie uses your Discord sign-in.</p>
          <p className="t-body" style={{ margin: 0 }}>
            Signed in with Discord{name ? <> as <strong>{name}</strong></> : null}.
          </p>
          <p className="set-hint text-muted" style={{ marginTop: -10 }}>Your name comes from your nickname in the DeskBuddies server.</p>
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

        <p className="set-footnote">Only you can see this page. Theme and motion are saved on this device; the other choices are saved to your account.</p>
      </main>
    </div>
  );
}
