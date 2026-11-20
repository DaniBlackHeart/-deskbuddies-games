// What the header's deskbits / Buddy Level / Buddy XP chips show.
//
// DESIGN-ONLY PLACEHOLDER. The earning system isn't built or approved yet, so
// there is no progress data to read. This returns the empty starting state
// (Level 1, 0 Buddy XP, 0 deskbits) as constants, with no network call. When
// progression exists, replace the body with a read of the member's own
// progress row (server-owned; the browser never writes these values) and keep
// this return shape, so the header needs no changes.

export type MemberProgress = {
  level: number;
  xp: number;
  deskbits: number;
  /** 0 to 1: how far through the current level. */
  levelProgress: number;
};

const EMPTY: MemberProgress = { level: 1, xp: 0, deskbits: 0, levelProgress: 0 };

export function useMemberProgress(): MemberProgress {
  return EMPTY;
}
