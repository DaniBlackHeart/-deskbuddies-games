import type { PixelIconName } from "../components/PixelIcon";

// One place that knows how each game is reached. Hosting and spectating pages
// keep their original /mod/... URLs (the code-splitting setup depends on that
// naming), but any verified member can open them now.

export type GameKey = "trivia" | "feud" | "uno" | "impostor" | "wheel" | "rebus";

export type HostOptions = {
  /** Chill / Hard pacing (Trivia Night, Type What You See). */
  pace?: boolean;
  /** Solo / Team (Wheel of Fortune, Type What You See). */
  teams?: boolean;
};

/** Games where the host can pick the set / category (otherwise a random mix is used). */
export type ContentPicker = {
  param: string; // create_session body field that carries the chosen id
  label: string;
  randomLabel: string;
  randomBody?: Record<string, unknown>; // extra body when "random" is chosen
};

export type GameInfo = {
  key: GameKey;
  title: string;
  icon: PixelIconName;
  blurb: string;
  lobbyPath: string;
  hostFunction: string;
  hostPath: (sessionId: string) => string;
  spectatePath: (sessionId: string) => string;
  hostOptions: HostOptions;
  content?: ContentPicker;
  /** Extra body for create_session when a member starts a game without picking content. */
  createBody: Record<string, unknown>;
};

export const GAME_CATALOG: GameInfo[] = [
  {
    key: "trivia",
    title: "Trivia Night",
    icon: "game-trivia",
    blurb: "Live-hosted trivia with a mix of multiple choice and typed answers.",
    lobbyPath: "/trivia",
    hostFunction: "trivia-host",
    hostPath: (id) => `/mod/host/${id}`,
    spectatePath: (id) => `/mod/spectate/${id}`,
    hostOptions: { pace: true },
    content: { param: "question_set_id", label: "Question set", randomLabel: "Random mix of all sets" },
    createBody: {},
  },
  {
    key: "uno",
    title: "UNO",
    icon: "game-uno",
    blurb: "Classic card matching.",
    lobbyPath: "/uno/lobby",
    hostFunction: "uno-host",
    hostPath: (id) => `/mod/uno-host/${id}`,
    spectatePath: (id) => `/mod/uno-spectate/${id}`,
    hostOptions: {},
    createBody: {},
  },
  {
    key: "feud",
    title: "Family Feud",
    icon: "game-family-feud",
    blurb: "Guess the most popular answers.",
    lobbyPath: "/feud/lobby",
    hostFunction: "feud-host",
    hostPath: (id) => `/mod/feud-host/${id}`,
    spectatePath: (id) => `/mod/feud-spectate/${id}`,
    hostOptions: {},
    content: { param: "feud_set_id", label: "Set", randomLabel: "Random set" },
    createBody: {},
  },
  {
    key: "impostor",
    title: "Impostor WHO?",
    icon: "game-impostor-who",
    blurb: "Work out who is bluffing.",
    lobbyPath: "/impostor/lobby",
    hostFunction: "impostor-host",
    hostPath: (id) => `/mod/impostor-host/${id}`,
    spectatePath: (id) => `/mod/impostor-spectate/${id}`,
    hostOptions: {},
    content: { param: "category_id", label: "Category", randomLabel: "Random category", randomBody: { random_category: true } },
    createBody: {},
  },
  {
    key: "wheel",
    title: "Wheel of Fortune",
    icon: "game-wheel-of-fortune",
    blurb: "Spin and solve the phrase.",
    lobbyPath: "/wheel/lobby",
    hostFunction: "wheel-host",
    hostPath: (id) => `/mod/wheel-host/${id}`,
    spectatePath: (id) => `/mod/wheel-spectate/${id}`,
    hostOptions: { teams: true },
    createBody: {},
  },
  {
    key: "rebus",
    title: "Type What You See",
    icon: "game-type-what-you-see",
    blurb: "Type it fast and get it right.",
    lobbyPath: "/rebus/lobby",
    hostFunction: "rebus-host",
    hostPath: (id) => `/mod/rebus-host/${id}`,
    spectatePath: (id) => `/mod/rebus-spectate/${id}`,
    hostOptions: { pace: true, teams: true },
    createBody: {},
  },
];

export function gameInfo(key: string): GameInfo | undefined {
  return GAME_CATALOG.find((g) => g.key === key);
}
