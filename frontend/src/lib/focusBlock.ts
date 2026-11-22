// Focus Block options. Mirror of supabase/functions/_shared/focusBlock.ts (the
// server is the source of truth and re-checks everything). If you change one,
// change both.
//
// PROVISIONAL: the lengths are the Desk Time board's starting set, not approved
// policy. Reward amounts are not here at all: they live in the database
// (reward_rules, 'focus_block_complete') and the page only shows what the server
// says was paid.

export const LENGTHS = [15, 25, 45] as const;
export const MAX_GOAL_LENGTH = 140;

export const ACTIVITIES = [
  { id: "work", label: "Work" },
  { id: "study", label: "Study" },
  { id: "read", label: "Read" },
  { id: "journal", label: "Journal" },
  { id: "create", label: "Create" },
] as const;

export type ActivityId = (typeof ACTIVITIES)[number]["id"];

export const activityLabel = (id: string) => ACTIVITIES.find((a) => a.id === id)?.label ?? id;
