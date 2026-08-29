// See pages/trivia/trivia.bundle.ts for why this file exists: one shared
// `import()` per game so all of Family Feud's pages load as a single chunk.
export { default as FeudLobbyPage } from "./FeudLobbyPage";
export { default as FeudPlayPage } from "./FeudPlayPage";
export { default as FeudSetsPage } from "../mod/FeudSetsPage";
export { default as FeudSetEditorPage } from "../mod/FeudSetEditorPage";
export { default as HostFeudSessionPage } from "../mod/HostFeudSessionPage";
export { default as FeudSpectatorPage } from "../mod/FeudSpectatorPage";
