import { useEffect, useRef, useState } from "react";
import { getVolume, isAudioUnlocked, setVolume, sounds, unlockAudio } from "../lib/sounds";

/**
 * Small floating volume control, mounted once at the app root so it's
 * present on every screen — including the bare center-screen player pages
 * that don't render AppHeader.
 *
 * Browsers refuse to play ANY audio — including sounds triggered later by a
 * realtime event, not a direct click — until a real user gesture has
 * happened on that page load. If someone opens a play link directly (or a
 * refresh drops them straight into a screen where the first thing that
 * happens is automatic, like a question timing out with no click at all),
 * that gesture may never occur, and every sound is silently blocked with no
 * error. So: keep retrying the unlock on every gesture until it actually
 * reports success (not just once), and show a small hint bubble until it
 * does, so it's obvious when sound genuinely isn't enabled yet rather than
 * looking like nothing is happening.
 */
export default function SoundToggle() {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(() => isAudioUnlocked());
  const [volume, setVolumeState] = useState(() => getVolume());
  const lastNonZeroRef = useRef(volume > 0 ? volume : 70);

  useEffect(() => {
    if (unlocked) return;
    function tryUnlock() {
      void unlockAudio().then((ok) => {
        if (ok) setUnlocked(true);
      });
    }
    window.addEventListener("pointerdown", tryUnlock);
    window.addEventListener("keydown", tryUnlock);
    return () => {
      window.removeEventListener("pointerdown", tryUnlock);
      window.removeEventListener("keydown", tryUnlock);
    };
  }, [unlocked]);

  function applyVolume(next: number, playConfirmation: boolean) {
    const clamped = Math.min(100, Math.max(0, next));
    setVolumeState(clamped);
    setVolume(clamped);
    if (clamped > 0) lastNonZeroRef.current = clamped;
    void unlockAudio().then((ok) => {
      if (ok) {
        setUnlocked(true);
        // Immediate, audible proof the slider actually does something —
        // and doubles as the unlock gesture if this is the very first
        // interaction anywhere on the page.
        if (playConfirmation && clamped > 0) sounds.tick();
      }
    });
  }

  function toggleMute() {
    applyVolume(volume > 0 ? 0 : lastNonZeroRef.current || 70, true);
  }

  return (
    <div style={{ position: "fixed", bottom: "16px", right: "16px", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
      {open && (
        <div className="card card--tight" style={{ padding: "10px 14px", boxShadow: "var(--shadow-md)" }}>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "4px" }} onClick={toggleMute} aria-label={volume === 0 ? "Unmute sound effects" : "Mute sound effects"}>
              {volume === 0 ? "🔇" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => applyVolume(Number(e.target.value), false)}
              onMouseUp={() => applyVolume(volume, true)}
              onTouchEnd={() => applyVolume(volume, true)}
              style={{ width: "110px" }}
              aria-label="Sound effects volume"
            />
            <span className="text-muted" style={{ fontSize: "0.75rem", width: "30px", textAlign: "right" }}>
              {volume}%
            </span>
          </div>
          {!unlocked && (
            <p className="hint" style={{ margin: "6px 0 0", maxWidth: "180px" }}>
              Your browser blocks sound until you tap something once — this popover counts.
            </p>
          )}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {!unlocked && !open && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "var(--color-warning)",
              border: "2px solid var(--color-bg)",
            }}
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setOpen((o) => !o)}
          aria-label="Sound settings"
          title={unlocked ? "Sound settings" : "Sound settings — tap to enable sound"}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            padding: 0,
            fontSize: "1.15rem",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {volume === 0 ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
