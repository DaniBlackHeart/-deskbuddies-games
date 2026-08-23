import { WHEEL_CONSONANTS, WHEEL_VOWELS } from "../lib/wheelConstants";

type WheelLetterTrackerProps = {
  guessedLetters: string[];
};

/**
 * A persistent reference showing every consonant and vowel, greyed out
 * once it's been called (hit or miss — both count as "used", same as
 * `round.guessed_letters` itself). Shown to everyone regardless of whose
 * turn it is, so the whole table can track what's left without needing
 * to remember it themselves.
 */
export default function WheelLetterTracker({ guessedLetters }: WheelLetterTrackerProps) {
  const usedSet = new Set(guessedLetters.map((l) => l.toUpperCase()));

  return (
    <div className="wheel-letter-tracker">
      <div className="wheel-letter-tracker__row">
        {WHEEL_CONSONANTS.map((c) => (
          <span key={c} className={`wheel-letter-tracker__letter ${usedSet.has(c) ? "wheel-letter-tracker__letter--used" : ""}`}>
            {c}
          </span>
        ))}
      </div>
      <div className="wheel-letter-tracker__row">
        {WHEEL_VOWELS.map((v) => (
          <span
            key={v}
            className={`wheel-letter-tracker__letter wheel-letter-tracker__letter--vowel ${usedSet.has(v) ? "wheel-letter-tracker__letter--used" : ""}`}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
