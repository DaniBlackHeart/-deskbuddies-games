import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, ModRoute } from "./components/ProtectedRoute";
import SoundToggle from "./components/SoundToggle";

import LoginPage from "./pages/LoginPage";
import NotAMemberPage from "./pages/NotAMemberPage";
import DashboardPage from "./pages/DashboardPage";
import TriviaLobbyPage from "./pages/trivia/TriviaLobbyPage";
import TriviaPlayPage from "./pages/trivia/TriviaPlayPage";
import FeudLobbyPage from "./pages/feud/FeudLobbyPage";
import FeudPlayPage from "./pages/feud/FeudPlayPage";
import UnoLobbyPage from "./pages/uno/UnoLobbyPage";
import UnoPlayPage from "./pages/uno/UnoPlayPage";
import ModDashboardPage from "./pages/mod/ModDashboardPage";
import QuestionSetsPage from "./pages/mod/QuestionSetsPage";
import QuestionSetEditorPage from "./pages/mod/QuestionSetEditorPage";
import HostSessionPage from "./pages/mod/HostSessionPage";
import SpectatorPage from "./pages/mod/SpectatorPage";
import FeudSetsPage from "./pages/mod/FeudSetsPage";
import FeudSetEditorPage from "./pages/mod/FeudSetEditorPage";
import HostFeudSessionPage from "./pages/mod/HostFeudSessionPage";
import FeudSpectatorPage from "./pages/mod/FeudSpectatorPage";
import HostUnoSessionPage from "./pages/mod/HostUnoSessionPage";
import UnoSpectatorPage from "./pages/mod/UnoSpectatorPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SoundToggle />
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
