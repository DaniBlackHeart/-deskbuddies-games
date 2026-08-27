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
import ImpostorLobbyPage from "./pages/impostor/ImpostorLobbyPage";
import ImpostorPlayPage from "./pages/impostor/ImpostorPlayPage";
import ImpostorCategoriesPage from "./pages/mod/ImpostorCategoriesPage";
import ImpostorCategoryEditorPage from "./pages/mod/ImpostorCategoryEditorPage";
import HostImpostorSessionPage from "./pages/mod/HostImpostorSessionPage";
import ImpostorSpectatorPage from "./pages/mod/ImpostorSpectatorPage";
import WheelLobbyPage from "./pages/wheel/WheelLobbyPage";
import WheelPlayPage from "./pages/wheel/WheelPlayPage";
import WheelCategoriesPage from "./pages/mod/WheelCategoriesPage";
import WheelCategoryEditorPage from "./pages/mod/WheelCategoryEditorPage";
import HostWheelSessionPage from "./pages/mod/HostWheelSessionPage";
import WheelSpectatorPage from "./pages/mod/WheelSpectatorPage";
import RebusLobbyPage from "./pages/rebus/RebusLobbyPage";
import RebusPlayPage from "./pages/rebus/RebusPlayPage";
import RebusSetsPage from "./pages/mod/RebusSetsPage";
import RebusSetEditorPage from "./pages/mod/RebusSetEditorPage";
import HostRebusSessionPage from "./pages/mod/HostRebusSessionPage";
import RebusSpectatorPage from "./pages/mod/RebusSpectatorPage";

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
      </AuthProvider>
    </BrowserRouter>
  );
}
