// Focus Block options — the SERVER's source of truth. Mirror of
// frontend/src/lib/focusBlock.ts (which adds display labels). If you change one,
// change both.
//
// PROVISIONAL: the lengths are the Desk Time board's starting set, not approved
// policy. Custom lengths are wanted but not built. Reward amounts are NOT here:
// they live in reward_rules (event_type 'focus_block_complete').

export const LENGTHS = [15, 25, 45] as const;
export const ACTIVITIES = ["work", "study", "read", "journal", "create"] as const;
export const MAX_GOAL_LENGTH = 140;
