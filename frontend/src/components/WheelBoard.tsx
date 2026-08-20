type WheelBoardProps = {
  maskedPhrase: string;
  categoryName: string;
};

/**
 * Renders the puzzle board: one tile per letter (blank until guessed),
 * grouped into words so they wrap as units, with spaces/punctuation
 * showing through as-is. `maskedPhrase` is exactly what the server sent —
 * "_" marks an unrevealed letter, everything else renders as-is.
 */
export default function WheelBoard({ maskedPhrase, categoryName }: WheelBoardProps) {
  const words = maskedPhrase.split(" ");

  return (
    <div className="wheel-board">
      <div className="wheel-board__category">{categoryName}</div>
      <div className="wheel-board__grid">
        {words.map((word, wi) => (
          <div className="wheel-board__word" key={wi}>
            {word.split("").map((ch, ci) => {
              if (ch === "_") {
                return <span className="wheel-board__tile wheel-board__tile--blank" key={ci} />;
              }
              if (/[A-Za-z]/.test(ch)) {
                return (
                  <span className="wheel-board__tile wheel-board__tile--revealed" key={ci}>
                    {ch}
                  </span>
                );
              }
              return (
                <span className="wheel-board__punct" key={ci}>
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
