// My Avatar catalog for display. The SERVER (supabase/functions/_shared/avatarCatalog.ts)
// decides which parts exist and which are open to everyone; this file gives them names, colours
// and hints. Keep the two in step. Every name, price and colour is a placeholder until Rika/Kai
// approve them (Avatar Cosmetics draft v0).

export type AvatarSlot = "skin" | "build" | "face" | "hair" | "hairc" | "top" | "head" | "eyes" | "acc" | "back" | "frame" | "plate";
export type AvatarParts = Record<AvatarSlot, string>;

/** free = starter, open to all. shop = bought with deskbits. earned / supp = not for sale. */
export type PartKind = "free" | "shop" | "earned" | "supp";
export interface Part {
  id: string;
  name: string;
  kind: PartKind;
  /** Sample price in deskbits (shop parts only). */
  price?: number;
  /** Broad hint for earned and supporter parts. Never a requirement or a number. */
  hint?: string;
}

export const AVATAR_SLOTS: AvatarSlot[] = ["skin", "build", "face", "hair", "hairc", "top", "head", "eyes", "acc", "back", "frame", "plate"];

export const DEFAULT_AVATAR: AvatarParts = {
  skin: "s3", build: "neut", face: "calm", hair: "crop", hairc: "h2", top: "tee",
  head: "none", eyes: "none", acc: "none", back: "cream", frame: "none", plate: "none",
};

export const SLOT_LABEL: Record<AvatarSlot, string> = {
  skin: "Skin tone", build: "Features", face: "Face", hair: "Hair style", hairc: "Hair colour", top: "Top",
  head: "Headwear", eyes: "Eyewear", acc: "Accessory", back: "Backdrop", frame: "Frame", plate: "Nameplate",
};

export const SLOT_NOTE: Record<AvatarSlot, string> = {
  skin: "Every look is a starter option. Colours are placeholders.",
  build: "Changes how the drawing looks. It is not shown as a label on your profile.",
  face: "Starter faces. All free.",
  hair: "Starter styles. All free.",
  hairc: "Starter colours. All free.",
  top: "Some tops are in Desk Finds. Others are earned.",
  head: "Head coverings are a starter option, so those are free.",
  eyes: "Glasses come from Desk Finds.",
  acc: "Small extras. Some come from clubs.",
  back: "The backdrop sits behind your avatar.",
  frame: "Frames are earned. You cannot buy them.",
  plate: "A nameplate shows a title you have earned.",
};

// [id, name, main colour, shade]
export const SKIN: { id: string; name: string; main: string; shade: string }[] = [
  { id: "s1", name: "Light", main: "#F6D7B8", shade: "#E4B88F" },
  { id: "s2", name: "Fair", main: "#EBBE94", shade: "#D39F72" },
  { id: "s3", name: "Warm", main: "#D9A070", shade: "#B97E52" },
  { id: "s4", name: "Tan", main: "#B9784A", shade: "#965A34" },
  { id: "s5", name: "Deep", main: "#8A5535", shade: "#6B3F25" },
  { id: "s6", name: "Rich", main: "#5E3A26", shade: "#472A1A" },
];

export const HAIR_COLORS: { id: string; name: string; color: string }[] = [
  { id: "h1", name: "Black", color: "#2E2420" },
  { id: "h2", name: "Brown", color: "#6B4A34" },
  { id: "h3", name: "Auburn", color: "#A4502F" },
  { id: "h4", name: "Blond", color: "#D9B364" },
  { id: "h5", name: "Grey", color: "#A9A29A" },
  { id: "h6", name: "Sage green", color: "#7FA277" },
];

const f = (id: string, name: string): Part => ({ id, name, kind: "free" });
const shop = (id: string, name: string, price: number): Part => ({ id, name, kind: "shop", price });
const earned = (id: string, name: string, hint: string): Part => ({ id, name, kind: "earned", hint });
const supp = (id: string, name: string, hint: string): Part => ({ id, name, kind: "supp", hint });

export const PARTS: Record<Exclude<AvatarSlot, "skin" | "hairc">, Part[]> = {
  build: [f("fem", "Softer features"), f("neut", "Balanced features"), f("masc", "Stronger features")],
  face: [f("calm", "Calm"), f("smile", "Smile"), f("wink", "Wink"), f("sleepy", "Sleepy")],
  hair: [f("crop", "Short crop"), f("bob", "Bob"), f("curls", "Curls"), f("bun", "Top bun"), f("long", "Long"), f("close", "Close cut")],
  top: [f("tee", "Plain tee"), f("collar", "Collared shirt"), shop("hoodie", "Soft hoodie", 90), shop("cardi", "Cardigan", 120), earned("knit", "Stripy knit", "Earned through a streak")],
  head: [f("none", "No headwear"), f("scarf", "Headscarf"), shop("beanie", "Beanie", 60), shop("cap", "Cap", 70), earned("bow", "Ribbon", "Earned through a milestone"), supp("cozy", "Cozy hat", "A supporter cosmetic")],
  eyes: [f("none", "No eyewear"), shop("round", "Round glasses", 50), shop("square", "Square glasses", 50), shop("shades", "Sunglasses", 80)],
  acc: [f("none", "No accessory"), shop("studs", "Stud earrings", 40), earned("pin", "Collar pin", "Earned in a club"), shop("wrap", "Neck scarf", 70)],
  back: [f("cream", "Cream"), f("sage", "Sage"), f("terra", "Terracotta"), shop("night", "Night sky", 90), earned("win", "Window light", "Earned through a milestone")],
  frame: [f("none", "No frame"), earned("cozy", "Cosy border", "Earned through a streak"), supp("gold", "Supporter border", "A supporter cosmetic")],
  plate: [f("none", "No nameplate"), earned("early", "Early settler", "Earned early on"), earned("lamp", "Lamp keeper", "Earned through a streak")],
};

export function findPart(slot: keyof typeof PARTS, id: string): Part {
  return PARTS[slot].find((p) => p.id === id) ?? PARTS[slot][0];
}

/** Starter parts are owned by everyone; others only if the server says the member owns them. */
export function isOwned(slot: AvatarSlot, id: string, ownedKeys: ReadonlySet<string>): boolean {
  if (slot === "skin" || slot === "hairc") return true;
  const p = findPart(slot, id);
  return p.kind === "free" || ownedKeys.has(`avatar:${slot}:${id}`);
}

/** Turns stored JSON into a complete, valid set of parts (anything unknown falls back to the starter). */
export function cleanParts(raw: unknown): AvatarParts {
  const out: AvatarParts = { ...DEFAULT_AVATAR };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const slot of AVATAR_SLOTS) {
    const v = r[slot];
    if (typeof v !== "string") continue;
    const ok =
      slot === "skin" ? SKIN.some((s) => s.id === v)
      : slot === "hairc" ? HAIR_COLORS.some((h) => h.id === v)
      : PARTS[slot].some((p) => p.id === v);
    if (ok) out[slot] = v;
  }
  return out;
}

export function describeAvatar(d: AvatarParts): string {
  const skin = SKIN.find((s) => s.id === d.skin)?.name ?? "";
  const hc = HAIR_COLORS.find((h) => h.id === d.hairc)?.name ?? "";
  let s = `Your avatar. ${skin} skin, ${hc.toLowerCase()} ${findPart("hair", d.hair).name.toLowerCase()} hair, ${findPart("build", d.build).name.toLowerCase()}, ${findPart("face", d.face).name.toLowerCase()} face, wearing a ${findPart("top", d.top).name.toLowerCase()}`;
  if (d.head !== "none") s += `, ${findPart("head", d.head).name.toLowerCase()}`;
  if (d.eyes !== "none") s += `, ${findPart("eyes", d.eyes).name.toLowerCase()}`;
  return s + ".";
}
