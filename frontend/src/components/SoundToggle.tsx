import { useEffect, useState } from "react";
import { isMuted, setMuted, unlockAudio } from "../lib/sounds";

/**
 * Small floating mute toggle, mounted once at the app root so it's present
 * on every screen — including the bare center-screen player pages that
 * don't render AppHeader. Also unlocks the AudioContext on the first
 * pointer/key interaction anywhere in the app, so sounds triggered later by
 * a realtime event (not a direct click) aren't blocked by autoplay policy.
 */
export default function SoundToggle() {
  const [muted, setMutedState] = useState(() => isMuted());

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) unlockAudio();
  }

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={toggle}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      title={muted ? "Sound off" : "Sound on"}
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        zIndex: 50,
        width: "44px",
        height: "44px",
        borderRadius: "50%",
        padding: 0,
        fontSize: "1.15rem",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
