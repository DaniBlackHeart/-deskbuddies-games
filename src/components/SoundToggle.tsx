import { useEffect, useRef, useState } from "react";
import { getVolume, setVolume, unlockAudio } from "../lib/sounds";

/**
 * Small floating volume control, mounted once at the app root so it's
 * present on every screen — including the bare center-screen player pages
 * that don't render AppHeader. Also unlocks the AudioContext on the first
 * pointer/key interaction anywhere in the app, so sounds triggered later by
 * a realtime event (not a direct click) aren't blocked by autoplay policy.
 */
export default function SoundToggle() {
  const [open, setOpen] = useState(false);
  const [volume, setVolumeState] = useState(() => getVolume());
  const lastNonZeroRef = useRef(volume > 0 ? volume : 70);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  function applyVolume(next: number) {
    const clamped = Math.min(100, Math.max(0, next));
    setVolumeState(clamped);
    setVolume(clamped);
    if (clamped > 0) lastNonZeroRef.current = clamped;
    unlockAudio();
  }

  function toggleMute() {
    applyVolume(volume > 0 ? 0 : lastNonZeroRef.current || 70);
  }

  return (
    <div style={{ position: "fixed", bottom: "16px", right: "16px", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
      {open && (
        <div className="card card--tight row" style={{ padding: "10px 14px", boxShadow: "var(--shadow-md)" }}>
          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "4px" }} onClick={toggleMute} aria-label={volume === 0 ? "Unmute sound effects" : "Mute sound effects"}>
            {volume === 0 ? "🔇" : "🔊"}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => applyVolume(Number(e.target.value))}
            style={{ width: "110px" }}
            aria-label="Sound effects volume"
          />
          <span className="text-muted" style={{ fontSize: "0.75rem", width: "30px", textAlign: "right" }}>
            {volume}%
          </span>
        </div>
      )}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Sound settings"
        title="Sound settings"
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
  );
}
