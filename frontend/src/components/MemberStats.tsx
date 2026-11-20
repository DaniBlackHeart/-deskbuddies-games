import PixelIcon from "./PixelIcon";
import { useMemberProgress } from "../lib/useMemberProgress";

// Header chips: deskbits, Buddy Level (with a progress bar) and Buddy XP.
// Names follow the Debbie Naming Guide: "deskbits" is lowercase, and
// "Buddy XP" is never pluralised. Sprites are decorative; each chip has a text
// name for screen readers. Layout follows the Home concept's status chips.
export default function MemberStats({ className }: { className?: string }) {
  const { level, xp, deskbits, levelProgress } = useMemberProgress();
  const fmt = (n: number) => n.toLocaleString();
  const pct = Math.round(Math.min(1, Math.max(0, levelProgress)) * 100);

  return (
    <ul className={"app-stats" + (className ? " " + className : "")} aria-label="Your progress">
      <li className="app-stat" title="deskbits">
        <PixelIcon name="deskbits" size={16} />
        <span>
          {fmt(deskbits)}
          <span className="app-stat__word"> deskbits</span>
        </span>
        <span className="sr-only">deskbits</span>
      </li>
      <li className="app-stat" title="Buddy Level">
        <PixelIcon name="buddy-level" size={32} />
        <span>{fmt(level)}</span>
        <span className="app-stat__bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="sr-only">Buddy Level, {pct}% to the next level</span>
      </li>
      <li className="app-stat" title="Buddy XP">
        <PixelIcon name="buddy-xp" size={32} />
        <span>{fmt(xp)}</span>
        <span className="sr-only">Buddy XP</span>
      </li>
    </ul>
  );
}
