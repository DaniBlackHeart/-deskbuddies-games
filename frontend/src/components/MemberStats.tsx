import PixelIcon from "./PixelIcon";
import { useMemberProgress } from "../lib/useMemberProgress";

// Header chips: deskbits, Buddy Level and Buddy XP. Names follow the Debbie
// Naming Guide: "deskbits" is lowercase and "Buddy XP" is never pluralised.
//
// The Level number sits in a cap at the left of its progress bar, and the XP
// number sits inside the star. Both are drawn on solid fills so the contrast
// holds in light and dark: white on terracotta (light), dark on peach (dark),
// and dark text on the star's fixed sage colour (the sprites keep the same
// colours in both themes). The sprites and bars are decorative; each chip has
// a text name for screen readers.

/** Fits the star: up to three characters ("999", "1k", "12k"). */
function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${Math.floor(n / 1_000_000)}m`;
}

export default function MemberStats({ className }: { className?: string }) {
  const { level, xp, deskbits, levelProgress } = useMemberProgress();
  const pct = Math.round(Math.min(1, Math.max(0, levelProgress)) * 100);

  return (
    <ul className={"app-stats" + (className ? " " + className : "")} aria-label="Your progress">
      <li className="app-stat" title="deskbits">
        <PixelIcon name="deskbits" size={32} />
        <span>{deskbits.toLocaleString()}</span>
        <span className="sr-only">deskbits</span>
      </li>
      <li className="app-stat app-stat--level" title="Buddy Level">
        <PixelIcon name="buddy-level" size={32} />
        <span className="app-level" aria-hidden="true">
          <span className="app-level__num">{level}</span>
          <span className="app-level__track">
            <span className="app-level__fill" style={{ width: `${pct}%` }} />
          </span>
        </span>
        <span className="sr-only">
          Buddy Level {level}, {pct}% to the next level
        </span>
      </li>
      <li className="app-stat app-stat--xp" title="Buddy XP">
        <span className="app-xp" aria-hidden="true">
          <PixelIcon name="buddy-xp" size={32} />
          <span className="app-xp__num">{compact(xp)}</span>
        </span>
        <span className="sr-only">Buddy XP {xp.toLocaleString()}</span>
      </li>
    </ul>
  );
}
