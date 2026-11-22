import type { PixelIconName } from "../components/PixelIcon";

// Common Room placeholder data. Follows the "Debbie Common Room" board and the
// Common Room decisions of 21 Nov 2026. Everything here is a SAMPLE: the kind
// names, the Discord channel names and the members are placeholders, and no
// backend or Discord call exists yet. Nothing is sent anywhere.

export type KindKey = "pets" | "made" | "eats" | "thought" | "meme" | "outside" | "win" | "other";
export type ReactionKey = "cheer" | "metoo" | "cozy" | "proud";

export type Kind = {
  key: KindKey;
  label: string;
  icon: PixelIconName;
  // Placeholder Discord destination. The two new kinds and "Anything else"
  // land in #common-room, tagged with their kind.
  channel: string;
  // True when posting needs a level-gated channel. The real check is server-side
  // later; here it only lets the composer show a locked kind.
  gated: boolean;
};

export const KINDS: Kind[] = [
  { key: "pets", label: "Pets", icon: "kind-pets", channel: "#pet-buddies", gated: false },
  { key: "made", label: "Made it", icon: "kind-made", channel: "#arts-hobbies-crafts", gated: false },
  { key: "eats", label: "Eats", icon: "kind-eats", channel: "#foodies", gated: false },
  { key: "thought", label: "A thought", icon: "kind-thought", channel: "#life-wisdom", gated: false },
  { key: "meme", label: "Meme", icon: "kind-meme", channel: "#meme-corner", gated: true },
  { key: "outside", label: "Outside", icon: "kind-outside", channel: "#common-room", gated: false },
  { key: "win", label: "Small win", icon: "kind-win", channel: "#common-room", gated: false },
  { key: "other", label: "Anything else", icon: "kind-other", channel: "#common-room", gated: false },
];

export const KIND_BY_KEY: Record<KindKey, Kind> = Object.fromEntries(KINDS.map((k) => [k.key, k])) as Record<KindKey, Kind>;

// Placeholder reaction set (Reaction Icons v1.3). Reactions earn nothing.
export const REACTIONS: { key: ReactionKey; label: string; icon: PixelIconName }[] = [
  { key: "cheer", label: "Cheer", icon: "react-cheer" },
  { key: "metoo", label: "Me too", icon: "react-metoo" },
  { key: "cozy", label: "Cozy", icon: "react-cozy" },
  { key: "proud", label: "Proud of you", icon: "react-proud" },
];

export type SamplePost = {
  id: string;
  name: string;
  tile: string; // avatar tile colour (placeholder until avatar art is decided)
  when: string;
  kind: KindKey;
  text: string;
  photo: boolean;
  counts: Record<ReactionKey, number>;
  mine?: boolean;
};

export const MAX_POST_LENGTH = 500;

export const SAMPLE_POSTS: SamplePost[] = [
  { id: "s0", name: "Mika", tile: "#E8977A", when: "12 min ago", kind: "outside", text: "Closed the laptop at lunch and walked to the corner sari-sari store. Bought a cold Milo and sat under the tree for ten minutes. Phone stayed in my bag.", photo: false, counts: { cheer: 4, metoo: 1, cozy: 2, proud: 3 } },
  { id: "s1", name: "Jun", tile: "#8FA98A", when: "1 hour ago", kind: "win", text: "Finished the draft I kept putting off. It is rough, but it exists now.", photo: false, counts: { cheer: 6, metoo: 0, cozy: 0, proud: 9 } },
  { id: "s2", name: "Tala", tile: "#7FA3B5", when: "3 hours ago", kind: "pets", text: "Biscuit decided my keyboard is a bed. Typing with one hand today.", photo: true, counts: { cheer: 8, metoo: 0, cozy: 11, proud: 2 } },
  { id: "s3", name: "Ren", tile: "#B79AAE", when: "Today, 9:40", kind: "made", text: "First finished crochet square. Wobbly corners, very proud.", photo: true, counts: { cheer: 3, metoo: 0, cozy: 1, proud: 7 } },
  { id: "s4", name: "Ica", tile: "#F2C766", when: "Yesterday", kind: "eats", text: "Tried making pandesal from scratch. Dense, but the kitchen smelled amazing.", photo: false, counts: { cheer: 5, metoo: 2, cozy: 6, proud: 1 } },
  { id: "s5", name: "Lio", tile: "#E8977A", when: "Yesterday", kind: "thought", text: "Rest is part of the work, not a prize you get after it.", photo: false, counts: { cheer: 2, metoo: 9, cozy: 3, proud: 1 } },
];
