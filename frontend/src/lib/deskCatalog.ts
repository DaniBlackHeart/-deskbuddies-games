// My Desk catalog for display. The SERVER (supabase/functions/_shared/deskCatalog.ts)
// decides what is allowed; this file only gives items names and colours.
// Keep the two in step. All names are placeholders until Rika/Kai approve them.

export type Slot = "surface" | "monitor" | "extra" | "keyboard" | "mouse" | "pad" | "mat" | "lamp";
export const SLOTS: Slot[] = ["surface", "monitor", "extra", "keyboard", "mouse", "pad", "mat", "lamp"];

export const SLOT_LABEL: Record<Slot | "companions" | "decor", string> = {
  surface: "Desk surface", monitor: "Monitor", extra: "Extra monitor", keyboard: "Keyboard",
  mouse: "Mouse", pad: "Mousepad", mat: "Desk mat", lamp: "Lamp", companions: "Companions", decor: "Desk items",
};

export const SLOT_HINT: Record<Slot | "companions" | "decor", string> = {
  surface: "Colors are open to everyone for now. More unlock through milestones and Challenge rewards.",
  monitor: "Monitors unlock through milestones and Challenge rewards.",
  extra: "An extra monitor is its own item, landscape or portrait. Each unlocks through milestones and Challenge rewards.",
  keyboard: "Keyboard sizes (60, 75, 80, 100%) unlock through milestones and Challenge rewards.",
  mouse: "Wired or wireless. More unlock through milestones and Challenge rewards.",
  pad: "Colors are open to everyone for now. More unlock through milestones and Challenge rewards.",
  mat: "A desk mat under your keyboard and mouse. Unlocks through milestones and Challenge rewards.",
  lamp: "Colors are open to everyone for now. More unlock through milestones and Challenge rewards.",
  decor: "Desk items come from Desk Finds. Each one can go in one spot. Placing them is free, and your desk keeps what you own.",
  companions: "Seat as many buddies as you like. How many fit will grow as your collection grows (the rule isn't decided).",
};

export type DeskItem = { id: string; name: string; starter?: boolean; open: boolean; swatch: string };

export const ITEMS: Record<Slot, DeskItem[]> = {
  surface: [
    { id: "oak", name: "Warm oak desk", starter: true, open: true, swatch: "#C99A6B" },
    { id: "birch", name: "Pale birch desk (placeholder)", open: true, swatch: "#E9D3A9" },
  ],
  monitor: [
    { id: "basic", name: "Basic monitor", starter: true, open: true, swatch: "#6B7C8A" },
    { id: "wide", name: "Wide monitor (placeholder)", open: false, swatch: "#7E8FA0" },
  ],
  extra: [
    { id: "none", name: "No extra monitor", starter: true, open: true, swatch: "#F3E6D2" },
    { id: "land", name: "Extra monitor, landscape (placeholder)", open: false, swatch: "#7E8FA0" },
    { id: "port", name: "Extra monitor, portrait (placeholder)", open: false, swatch: "#8A9BAA" },
  ],
  keyboard: [
    { id: "full", name: "Full-size keyboard, 100%", starter: true, open: true, swatch: "#D9CBB6" },
    { id: "k80", name: "80% keyboard (placeholder)", open: false, swatch: "#C9D4C2" },
    { id: "k75", name: "75% keyboard (placeholder)", open: false, swatch: "#E8C9BE" },
    { id: "k60", name: "60% keyboard (placeholder)", open: false, swatch: "#BFC8D6" },
  ],
  mouse: [
    { id: "wired", name: "Wired mouse", starter: true, open: true, swatch: "#B8B2A8" },
    { id: "wireless", name: "Wireless mouse (placeholder)", open: false, swatch: "#CFC8BC" },
  ],
  pad: [
    { id: "sage", name: "Sage mousepad", starter: true, open: true, swatch: "#8FA98A" },
    { id: "terracotta", name: "Terracotta mousepad (placeholder)", open: true, swatch: "#C8694A" },
    { id: "cream", name: "Cream mousepad (placeholder)", open: true, swatch: "#F6EBD9" },
  ],
  mat: [
    { id: "none", name: "No desk mat", starter: true, open: true, swatch: "#F3E6D2" },
    { id: "felt", name: "Felt desk mat (placeholder)", open: false, swatch: "#9A8F86" },
  ],
  lamp: [
    { id: "starter", name: "Small desk lamp", starter: true, open: true, swatch: "#F2C766" },
    { id: "mushroom", name: "Mushroom lamp (placeholder)", open: false, swatch: "#E8A598" },
  ],
};

// Buddies. Every one must be earned; none are open to everyone.
export const BUDDIES: { id: string; name: string }[] = [
  { id: "paper", name: "Paper Pal" },
  { id: "sprout", name: "Lamp Sprout" },
  { id: "foundie", name: "Foundie" },
  { id: "mug", name: "Mug Mallow" },
  { id: "sticky", name: "Sticky Sprite" },
  { id: "keycap", name: "Keycap Kitty" },
  // Placeholder names: the desk art exists for these, the names are not final.
  { id: "bookmark", name: "Bookmark (placeholder name)" },
  { id: "button", name: "Button (placeholder name)" },
  { id: "cloudlet", name: "Cloudlet (placeholder name)" },
  { id: "patch", name: "Patch (placeholder name)" },
  { id: "pebble", name: "Pebble (placeholder name)" },
  { id: "pencil", name: "Pencil (placeholder name)" },
  { id: "riceball", name: "Riceball (placeholder name)" },
  { id: "snackling", name: "Snackling (placeholder name)" },
  { id: "spoolie", name: "Spoolie (placeholder name)" },
  { id: "tabby", name: "Tabby (placeholder name)" },
];

/** Provisional: how many buddies fit on the desk. The real rule is undecided. */
export const MAX_COMPANIONS = 4;

/** Desk Finds items that sit on the desk (shop_items.key). Spots are a PROPOSAL (6 slots, staggered). */
export const DECOR_SLOTS = ["d1", "d2", "d3", "d4", "d5", "d6"] as const;
export type DecorSlot = (typeof DECOR_SLOTS)[number];
export type Decor = Record<DecorSlot, string>;
/** Top-left of each 16x16 spot on the 160x112 desk scene. */
export const DECOR_POS: Record<DecorSlot, { x: number; y: number }> = {
  d1: { x: 118, y: 40 }, d2: { x: 136, y: 43 }, d3: { x: 50, y: 44 },
  d4: { x: 94, y: 42 }, d5: { x: 66, y: 82 }, d6: { x: 90, y: 80 },
};
export const DECOR_ITEMS: { key: string; name: string }[] = [
  { key: "sticky_note_stack", name: "Sticky-note stack" },
  { key: "pen_cup", name: "Pen cup" },
  { key: "coaster_set", name: "Coaster set" },
  { key: "snack_tin", name: "Snack tin" },
  { key: "mini_cactus", name: "Mini cactus" },
  { key: "tea_mug_with_steam", name: "Tea mug with steam" },
  { key: "fern_pot", name: "Fern pot" },
];
export const EMPTY_DECOR: Decor = { d1: "", d2: "", d3: "", d4: "", d5: "", d6: "" };
export function decorName(key: string): string {
  return DECOR_ITEMS.find((i) => i.key === key)?.name ?? key;
}
/** Only known spots and items; anything else becomes an empty spot. */
export function cleanDecor(raw: unknown): Decor {
  const out: Decor = { ...EMPTY_DECOR };
  if (!raw || typeof raw !== "object") return out;
  for (const d of DECOR_SLOTS) {
    const v = (raw as Record<string, unknown>)[d];
    if (typeof v === "string" && DECOR_ITEMS.some((i) => i.key === v)) out[d] = v;
  }
  return out;
}

export type Layout = Record<Slot, string> & { companions: string[]; decor: Decor };

export const DEFAULT_LAYOUT: Layout = {
  surface: "oak", monitor: "basic", extra: "none", keyboard: "full",
  mouse: "wired", pad: "sage", mat: "none", lamp: "starter", companions: [], decor: { ...EMPTY_DECOR },
};

export function itemName(slot: Slot, id: string): string {
  return ITEMS[slot].find((i) => i.id === id)?.name ?? id;
}
export function buddyName(id: string): string {
  return BUDDIES.find((b) => b.id === id)?.name ?? id;
}
