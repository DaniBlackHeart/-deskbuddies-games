// See pages/trivia/trivia.bundle.ts for why this file exists: one shared
// `import()` per game so all of Impostor WHO?'s pages load as a single
// chunk.
export { default as ImpostorLobbyPage } from "./ImpostorLobbyPage";
export { default as ImpostorPlayPage } from "./ImpostorPlayPage";
export { default as ImpostorCategoriesPage } from "../mod/ImpostorCategoriesPage";
export { default as ImpostorCategoryEditorPage } from "../mod/ImpostorCategoryEditorPage";
export { default as HostImpostorSessionPage } from "../mod/HostImpostorSessionPage";
export { default as ImpostorSpectatorPage } from "../mod/ImpostorSpectatorPage";
