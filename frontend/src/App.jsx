import { Route, Routes } from "react-router-dom";
import { JoinPage } from "./pages/JoinPage";
import { PlayerView } from "./pages/PlayerView";
import { ManagerLoginPage } from "./pages/manager/ManagerLoginPage";
import { GoogleCallbackPage } from "./pages/manager/GoogleCallbackPage";
import { DashboardPage } from "./pages/manager/DashboardPage";
import { ActiveTournamentsPage } from "./pages/manager/ActiveTournamentsPage";
import { TemplatesPage } from "./pages/manager/TemplatesPage";
import { PlayersPage } from "./pages/manager/PlayersPage";
import { TournamentSetupPage } from "./pages/manager/TournamentSetupPage";
import { TournamentManagerPage } from "./pages/manager/TournamentManagerPage";
import { HistoryPage } from "./pages/manager/HistoryPage";
import { HistoryDetailPage } from "./pages/manager/HistoryDetailPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ManagerLayout } from "./components/ManagerLayout";

function App() {
  return (
    <Routes>
      <Route path="/" element={<JoinPage />} />
      <Route path="/play/:tournamentId" element={<PlayerView />} />
      <Route path="/manager/login" element={<ManagerLoginPage />} />
      <Route path="/manager/oauth-callback" element={<GoogleCallbackPage />} />

      {/* Directory-style pages share the persistent sidebar. */}
      <Route
        element={
          <ProtectedRoute>
            <ManagerLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/manager" element={<DashboardPage />} />
        <Route path="/manager/tournaments" element={<ActiveTournamentsPage />} />
        <Route path="/manager/templates" element={<TemplatesPage />} />
        <Route path="/manager/history" element={<HistoryPage />} />
        <Route path="/manager/players" element={<PlayersPage />} />
      </Route>

      {/* Focused, full-bleed flows stay outside the sidebar layout. */}
      <Route
        path="/manager/setup"
        element={
          <ProtectedRoute>
            <TournamentSetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/history/:historyId"
        element={
          <ProtectedRoute>
            <HistoryDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/:tournamentId"
        element={
          <ProtectedRoute>
            <TournamentManagerPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
