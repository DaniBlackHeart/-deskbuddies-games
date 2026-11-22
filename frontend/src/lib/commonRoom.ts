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

// The live page starts empty so members never see invented people. The design's
// six sample posts are not shipped; posts made here live in component state only.
export const SAMPLE_POSTS: SamplePost[] = [];
