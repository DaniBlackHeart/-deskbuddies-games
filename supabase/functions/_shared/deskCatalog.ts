// My Desk item catalog — the SERVER's source of truth for which item ids exist
// and which are open to everyone. Mirror of frontend/src/lib/deskCatalog.ts
// (which adds names/colours for display). If you add an item, add it in both.
//
// "open" = every member owns it (starter, or colours that are open to all for
// now). Anything else is owned only if the member has a row in member_items
// with item_key "<slot>:<id>". Which milestone grants which item is undecided.

export const SLOTS = [
  "surface", "monitor", "extra", "keyboard", "mouse", "pad", "mat", "lamp",
] as const;
export type Slot = (typeof SLOTS)[number];

/** Provisional: how many buddies fit on the desk. The real rule is undecided. */
export const MAX_COMPANIONS = 4;

export const DEFAULT_LAYOUT = {
  surface: "oak", monitor: "basic", extra: "none", keyboard: "full",
  mouse: "wired", pad: "sage", mat: "none", lamp: "starter",
  companions: [] as string[],
};

// slot -> ids open to every member
export const OPEN_ITEMS: Record<Slot, string[]> = {
  surface: ["oak", "birch"],
  monitor: ["basic"],
  extra: ["none"],
  keyboard: ["full"],
  mouse: ["wired"],
  pad: ["sage", "terracotta", "cream"],
  mat: ["none"],
  lamp: ["starter"],
};

// slot -> every id that exists (open or not)
export const ALL_ITEMS: Record<Slot, string[]> = {
  surface: ["oak", "birch"],
  monitor: ["basic", "wide"],
  extra: ["none", "land", "port"],
  keyboard: ["full", "k80", "k75", "k60"],
  mouse: ["wired", "wireless"],
  pad: ["sage", "terracotta", "cream"],
  mat: ["none", "felt"],
  lamp: ["starter", "mushroom"],
};

// Buddies are never open: each must be earned (a member_items row).
export const BUDDIES = [
  "paper", "sprout", "foundie", "mug", "sticky", "keycap", "bookmark", "button",
  "cloudlet", "patch", "pebble", "pencil", "riceball", "snackling", "spoolie", "tabby",
];

// Desk Finds items that sit on the desk in a decor slot (design: Debbie_Desk_Finds_Item_Art_v1_LOCKED,
// "Desk scene and slots", a PROPOSAL not yet approved by Rika). The ids are shop_items.key; a member
// owns one when member_items has "find:<key>". Each can be placed once. Slots d1..d6 hold one item each.
export const DECOR_SLOTS = ["d1", "d2", "d3", "d4", "d5", "d6"] as const;
export const DECOR_ITEMS = [
  "sticky_note_stack", "pen_cup", "coaster_set", "snack_tin", "mini_cactus", "tea_mug_with_steam", "fern_pot",
];
