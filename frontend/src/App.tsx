import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, ModRoute } from "./components/ProtectedRoute";
import SoundToggle from "./components/SoundToggle";
import RouteLoadingFallback from "./components/RouteLoadingFallback";

// Kept as static imports: this is the "shell" every visitor hits before
// they've even reached a game (or ever, if they're not a member) — no
// reason to make login/first-paint wait on a chunk fetch for it.
import LoginPage from "./pages/LoginPage";
import NotAMemberPage from "./pages/NotAMemberPage";
import DashboardPage from "./pages/DashboardPage";

// Everything below is lazy-loaded, grouped into one chunk per game. Each
// game's pages (lobby, play, and its mod pages, which live flat in
// pages/mod/ rather than their own folder — a naming leftover from Trivia
// being first) are re-exported from one pages/<game>/<game>.bundle.ts
// barrel file. Every lazy() below for a given game calls the SAME
// `import("...<game>.bundle")` specifier, and the module loader dedupes
// that automatically — it fetches
// that one chunk once, on first navigation into the game, and reuses it for
// every other page in that game for the rest of the session. A player only
// ever downloads the one game they're playing; a MOD moving between that
// game's lobby/host/spectator/editor screens gets it all from that single
// already-cached chunk instead of several separate fetches.
//
// This relies on plain JS import() caching rather than any custom bundler
// chunking config — deliberately: the obvious alternative (a custom
// manualChunks/codeSplitting rule to merge each game's separately-lazy-
// loaded pages into one chunk) hit real bugs in the current Vite/Rolldown
// version, where a component shared by two games (Timer, Buzzer, sounds.ts,
// etc.) would get welded entirely inside one game's chunk instead of its
// own, making a supposedly-unrelated game silently fetch that whole other
// game's bundle just to get the shared piece. Barrel-file caching sidesteps
// that entirely and needs no bundler-version-specific configuration.
//
// Adding game #7: put its pages in their own pages/<game>/ folder as usual,
// add a pages/<game>/<game>.bundle.ts re-exporting them (mirror an existing
// one), and add its lazy() + Route entries below. It automatically gets its own
// chunk — no other game's bundle grows, and nothing here needs to know
// which components or lib files it happens to share with existing games.

const ModDashboardPage = lazy(() => import("./pages/mod/ModDashboardPage"));

// Trivia
const loadTrivia = () => import("./pages/trivia/trivia.bundle");
const TriviaLobbyPage = lazy(() => loadTrivia().then((m) => ({ default: m.TriviaLobbyPage })));
const TriviaPlayPage = lazy(() => loadTrivia().then((m) => ({ default: m.TriviaPlayPage })));
const QuestionSetsPage = lazy(() => loadTrivia().then((m) => ({ default: m.QuestionSetsPage })));
const QuestionSetEditorPage = lazy(() => loadTrivia().then((m) => ({ default: m.QuestionSetEditorPage })));
const HostSessionPage = lazy(() => loadTrivia().then((m) => ({ default: m.HostSessionPage })));
const SpectatorPage = lazy(() => loadTrivia().then((m) => ({ default: m.SpectatorPage })));

// Family Feud
const loadFeud = () => import("./pages/feud/feud.bundle");
const FeudLobbyPage = lazy(() => loadFeud().then((m) => ({ default: m.FeudLobbyPage })));
const FeudPlayPage = lazy(() => loadFeud().then((m) => ({ default: m.FeudPlayPage })));
const FeudSetsPage = lazy(() => loadFeud().then((m) => ({ default: m.FeudSetsPage })));
const FeudSetEditorPage = lazy(() => loadFeud().then((m) => ({ default: m.FeudSetEditorPage })));
const HostFeudSessionPage = lazy(() => loadFeud().then((m) => ({ default: m.HostFeudSessionPage })));
const FeudSpectatorPage = lazy(() => loadFeud().then((m) => ({ default: m.FeudSpectatorPage })));

// UNO
const loadUno = () => import("./pages/uno/uno.bundle");
const UnoLobbyPage = lazy(() => loadUno().then((m) => ({ default: m.UnoLobbyPage })));
const UnoPlayPage = lazy(() => loadUno().then((m) => ({ default: m.UnoPlayPage })));
const HostUnoSessionPage = lazy(() => loadUno().then((m) => ({ default: m.HostUnoSessionPage })));
const UnoSpectatorPage = lazy(() => loadUno().then((m) => ({ default: m.UnoSpectatorPage })));

// Impostor WHO?
const loadImpostor = () => import("./pages/impostor/impostor.bundle");
const ImpostorLobbyPage = lazy(() => loadImpostor().then((m) => ({ default: m.ImpostorLobbyPage })));
const ImpostorPlayPage = lazy(() => loadImpostor().then((m) => ({ default: m.ImpostorPlayPage })));
const ImpostorCategoriesPage = lazy(() => loadImpostor().then((m) => ({ default: m.ImpostorCategoriesPage })));
const ImpostorCategoryEditorPage = lazy(() =>
  loadImpostor().then((m) => ({ default: m.ImpostorCategoryEditorPage }))
);
const HostImpostorSessionPage = lazy(() => loadImpostor().then((m) => ({ default: m.HostImpostorSessionPage })));
const ImpostorSpectatorPage = lazy(() => loadImpostor().then((m) => ({ default: m.ImpostorSpectatorPage })));

// Wheel of Fortune
const loadWheel = () => import("./pages/wheel/wheel.bundle");
const WheelLobbyPage = lazy(() => loadWheel().then((m) => ({ default: m.WheelLobbyPage })));
const WheelPlayPage = lazy(() => loadWheel().then((m) => ({ default: m.WheelPlayPage })));
const WheelCategoriesPage = lazy(() => loadWheel().then((m) => ({ default: m.WheelCategoriesPage })));
const WheelCategoryEditorPage = lazy(() => loadWheel().then((m) => ({ default: m.WheelCategoryEditorPage })));
const HostWheelSessionPage = lazy(() => loadWheel().then((m) => ({ default: m.HostWheelSessionPage })));
const WheelSpectatorPage = lazy(() => loadWheel().then((m) => ({ default: m.WheelSpectatorPage })));

// Type What You See (rebus)
const loadRebus = () => import("./pages/rebus/rebus.bundle");
const RebusLobbyPage = lazy(() => loadRebus().then((m) => ({ default: m.RebusLobbyPage })));
const RebusPlayPage = lazy(() => loadRebus().then((m) => ({ default: m.RebusPlayPage })));
const RebusSetsPage = lazy(() => loadRebus().then((m) => ({ default: m.RebusSetsPage })));
const RebusSetEditorPage = lazy(() => loadRebus().then((m) => ({ default: m.RebusSetEditorPage })));
const HostRebusSessionPage = lazy(() => loadRebus().then((m) => ({ default: m.HostRebusSessionPage })));
const RebusSpectatorPage = lazy(() => loadRebus().then((m) => ({ default: m.RebusSpectatorPage })));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SoundToggle />
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/not-a-member" element={<NotAMemberPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trivia"
              element={
                <ProtectedRoute>
                  <TriviaLobbyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trivia/play/:sessionId"
              element={
                <ProtectedRoute>
                  <TriviaPlayPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feud/lobby"
              element={
                <ProtectedRoute>
                  <FeudLobbyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feud/play/:sessionId"
              element={
                <ProtectedRoute>
                  <FeudPlayPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/uno/lobby"
              element={
                <ProtectedRoute>
                  <UnoLobbyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/uno/play/:sessionId"
              element={
                <ProtectedRoute>
                  <UnoPlayPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/impostor/lobby"
              element={
                <ProtectedRoute>
                  <ImpostorLobbyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/impostor/play/:sessionId"
              element={
                <ProtectedRoute>
                  <ImpostorPlayPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wheel/lobby"
              element={
                <ProtectedRoute>
                  <WheelLobbyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wheel/play/:sessionId"
              element={
                <ProtectedRoute>
                  <WheelPlayPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rebus/lobby"
              element={
                <ProtectedRoute>
                  <RebusLobbyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rebus/play/:sessionId"
              element={
                <ProtectedRoute>
                  <RebusPlayPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/mod"
              element={
                <ModRoute>
                  <ModDashboardPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/sets"
              element={
                <ModRoute>
                  <QuestionSetsPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/sets/:setId"
              element={
                <ModRoute>
                  <QuestionSetEditorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/host/:sessionId"
              element={
                <ModRoute>
                  <HostSessionPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/spectate/:sessionId"
              element={
                <ModRoute>
                  <SpectatorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/feud-sets"
              element={
                <ModRoute>
                  <FeudSetsPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/feud-sets/:setId"
              element={
                <ModRoute>
                  <FeudSetEditorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/feud-host/:sessionId"
              element={
                <ModRoute>
                  <HostFeudSessionPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/feud-spectate/:sessionId"
              element={
                <ModRoute>
                  <FeudSpectatorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/uno-host/:sessionId"
              element={
                <ModRoute>
                  <HostUnoSessionPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/uno-spectate/:sessionId"
              element={
                <ModRoute>
                  <UnoSpectatorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/impostor-categories"
              element={
                <ModRoute>
                  <ImpostorCategoriesPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/impostor-categories/:categoryId"
              element={
                <ModRoute>
                  <ImpostorCategoryEditorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/impostor-host/:sessionId"
              element={
                <ModRoute>
                  <HostImpostorSessionPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/impostor-spectate/:sessionId"
              element={
                <ModRoute>
                  <ImpostorSpectatorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/wheel-categories"
              element={
                <ModRoute>
                  <WheelCategoriesPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/wheel-categories/:categoryId"
              element={
                <ModRoute>
                  <WheelCategoryEditorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/wheel-host/:sessionId"
              element={
                <ModRoute>
                  <HostWheelSessionPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/wheel-spectate/:sessionId"
              element={
                <ModRoute>
                  <WheelSpectatorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/rebus-sets"
              element={
                <ModRoute>
                  <RebusSetsPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/rebus-sets/:setId"
              element={
                <ModRoute>
                  <RebusSetEditorPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/rebus-host/:sessionId"
              element={
                <ModRoute>
                  <HostRebusSessionPage />
                </ModRoute>
              }
            />
            <Route
              path="/mod/rebus-spectate/:sessionId"
              element={
                <ModRoute>
                  <RebusSpectatorPage />
                </ModRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
