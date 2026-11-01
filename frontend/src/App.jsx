import { Route, Routes } from "react-router-dom";
import { JoinPage } from "./pages/JoinPage";
import { PlayerView } from "./pages/PlayerView";
import { ManagerLoginPage } from "./pages/manager/ManagerLoginPage";
import { GoogleCallbackPage } from "./pages/manager/GoogleCallbackPage";
import { DashboardPage } from "./pages/manager/DashboardPage";
import { TournamentManagerPage } from "./pages/manager/TournamentManagerPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<JoinPage />} />
      <Route path="/play/:tournamentId" element={<PlayerView />} />
      <Route path="/manager/login" element={<ManagerLoginPage />} />
      <Route path="/manager/oauth-callback" element={<GoogleCallbackPage />} />
      <Route
        path="/manager"
        element={
          <ProtectedRoute>
            <DashboardPage />
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
