import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getUser } from './lib/auth';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import Home from './pages/Home';
import Leagues from './pages/Leagues';
import CreateLeague from './pages/CreateLeague';
import JoinLeague from './pages/JoinLeague';
import LeagueDetail from './pages/LeagueDetail';
import MyTeams from './pages/MyTeams';
import CreateTeam from './pages/CreateTeam';
import CaptainSelect from './pages/CaptainSelect';
import TeamPreview from './pages/TeamPreview';
import Leaderboard from './pages/Leaderboard';
import TeamCompare from './pages/TeamCompare';
import MatchDetail from './pages/MatchDetail';
import Admin from './pages/Admin';

function ProtectedRoute({ children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppShell({ children }) {
  return (
    <>
      <Header />
      {children}
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<ProtectedRoute><AppShell><Home /></AppShell></ProtectedRoute>} />
        <Route path="/leagues" element={<ProtectedRoute><AppShell><Leagues /></AppShell></ProtectedRoute>} />
        <Route path="/leagues/create" element={<ProtectedRoute><AppShell><CreateLeague /></AppShell></ProtectedRoute>} />
        <Route path="/leagues/join" element={<ProtectedRoute><AppShell><JoinLeague /></AppShell></ProtectedRoute>} />
        <Route path="/leagues/:id" element={<ProtectedRoute><AppShell><LeagueDetail /></AppShell></ProtectedRoute>} />
        <Route path="/my-teams" element={<ProtectedRoute><AppShell><MyTeams /></AppShell></ProtectedRoute>} />
        <Route path="/create-team/:matchId/:leagueId" element={<ProtectedRoute><CreateTeam /></ProtectedRoute>} />
        <Route path="/captain-select/:matchId/:leagueId" element={<ProtectedRoute><CaptainSelect /></ProtectedRoute>} />
        <Route path="/team-preview/:teamId" element={<ProtectedRoute><TeamPreview /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><AppShell><Leaderboard /></AppShell></ProtectedRoute>} />
        <Route path="/compare/:leagueId" element={<ProtectedRoute><AppShell><TeamCompare /></AppShell></ProtectedRoute>} />
        <Route path="/match/:id" element={<ProtectedRoute><AppShell><MatchDetail /></AppShell></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AppShell><Admin /></AppShell></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
