// My Avatar catalog: the SERVER's source of truth for which part ids exist and which are open to
// everyone. Mirror of frontend/src/lib/avatarCatalog.ts (which adds names, colours and hints for
// display). If you add a part, add it in both.
//
// "open" = every member owns it (starter parts). Anything else is owned only if the member has a
// row in member_items with item_key "avatar:<slot>:<id>". Nothing grants those rows yet, so today
// only starter parts can be saved. Which purchase or achievement grants which part is undecided.

export const AVATAR_SLOTS = [
  "skin", "build", "face", "hair", "hairc", "top", "head", "eyes", "acc", "back", "frame", "plate",
] as const;
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];

export const DEFAULT_AVATAR: Record<AvatarSlot, string> = {
  skin: "s3", build: "neut", face: "calm", hair: "crop", hairc: "h2", top: "tee",
  head: "none", eyes: "none", acc: "none", back: "cream", frame: "none", plate: "none",
};

// slot -> every id that exists (open or not)
export const ALL_PARTS: Record<AvatarSlot, string[]> = {
  skin: ["s1", "s2", "s3", "s4", "s5", "s6"],
  build: ["fem", "neut", "masc"],
  face: ["calm", "smile", "wink", "sleepy"],
  hair: ["crop", "bob", "curls", "bun", "long", "close"],
  hairc: ["h1", "h2", "h3", "h4", "h5", "h6"],
  top: ["tee", "collar", "hoodie", "cardi", "knit"],
  head: ["none", "scarf", "beanie", "cap", "bow", "cozy"],
  eyes: ["none", "round", "square", "shades"],
  acc: ["none", "studs", "pin", "wrap"],
  back: ["cream", "sage", "terra", "night", "win"],
  frame: ["none", "cozy", "gold"],
  plate: ["none", "early", "lamp"],
};

// slot -> ids open to every member
export const OPEN_PARTS: Record<AvatarSlot, string[]> = {
  skin: ["s1", "s2", "s3", "s4", "s5", "s6"],
  build: ["fem", "neut", "masc"],
  face: ["calm", "smile", "wink", "sleepy"],
  hair: ["crop", "bob", "curls", "bun", "long", "close"],
  hairc: ["h1", "h2", "h3", "h4", "h5", "h6"],
  top: ["tee", "collar"],
  head: ["none", "scarf"],
  eyes: ["none"],
  acc: ["none"],
  back: ["cream", "sage", "terra"],
  frame: ["none"],
  plate: ["none"],
};
