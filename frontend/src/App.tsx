import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, ModRoute } from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import NotAMemberPage from "./pages/NotAMemberPage";
import DashboardPage from "./pages/DashboardPage";
import TriviaLobbyPage from "./pages/trivia/TriviaLobbyPage";
import TriviaPlayPage from "./pages/trivia/TriviaPlayPage";
import ModDashboardPage from "./pages/mod/ModDashboardPage";
import QuestionSetsPage from "./pages/mod/QuestionSetsPage";
import QuestionSetEditorPage from "./pages/mod/QuestionSetEditorPage";
import HostSessionPage from "./pages/mod/HostSessionPage";
import SpectatorPage from "./pages/mod/SpectatorPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
