// Today's level for the daily games (picked at random each day, the same for everyone).
export const levelName = (d?: string | null) => (d === "easy" ? "Easy" : d === "medium" ? "Medium" : d === "hard" ? "Hard" : "");
