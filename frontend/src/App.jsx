import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getUser } from './lib/auth';
import { startHeartbeat } from './lib/heartbeat';
import { initTheme } from './lib/theme';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import UpdatePrompt from './components/UpdatePrompt';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';

// Apply saved theme on load
initTheme();

// Lazy load all pages
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const Leagues = lazy(() => import('./pages/Leagues'));
const CreateLeague = lazy(() => import('./pages/CreateLeague'));
const JoinLeague = lazy(() => import('./pages/JoinLeague'));
const LeagueDetail = lazy(() => import('./pages/LeagueDetail'));
const MyTeams = lazy(() => import('./pages/MyTeams'));
const CreateTeam = lazy(() => import('./pages/CreateTeam'));
const BackupSelect = lazy(() => import('./pages/BackupSelect'));
const CaptainSelect = lazy(() => import('./pages/CaptainSelect'));
const TeamPreview = lazy(() => import('./pages/TeamPreview'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const TeamCompare = lazy(() => import('./pages/TeamCompare'));
const MatchDetail = lazy(() => import('./pages/MatchDetail'));
const Admin = lazy(() => import('./pages/Admin'));
const PointsSystem = lazy(() => import('./pages/PointsSystem'));
const Feedback = lazy(() => import('./pages/Feedback'));

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

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div className="spinner" />
    </div>
  );
}

export default function App() {
  useEffect(() => { startHeartbeat(); }, []);
  return (
    <BrowserRouter>
      <OfflineBanner />
      <UpdatePrompt />
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<ProtectedRoute><AppShell><Home /></AppShell></ProtectedRoute>} />
          <Route path="/leagues" element={<ProtectedRoute><AppShell><Leagues /></AppShell></ProtectedRoute>} />
          <Route path="/leagues/create" element={<ProtectedRoute><AppShell><CreateLeague /></AppShell></ProtectedRoute>} />
          <Route path="/leagues/join" element={<ProtectedRoute><AppShell><JoinLeague /></AppShell></ProtectedRoute>} />
          <Route path="/leagues/:id" element={<ProtectedRoute><AppShell><LeagueDetail /></AppShell></ProtectedRoute>} />
          <Route path="/my-teams" element={<ProtectedRoute><AppShell><MyTeams /></AppShell></ProtectedRoute>} />
          <Route path="/create-team/:matchId/:leagueId" element={<ProtectedRoute><CreateTeam /></ProtectedRoute>} />
          <Route path="/backup-select/:matchId/:leagueId" element={<ProtectedRoute><BackupSelect /></ProtectedRoute>} />
          <Route path="/captain-select/:matchId/:leagueId" element={<ProtectedRoute><CaptainSelect /></ProtectedRoute>} />
          <Route path="/team-preview/:teamId" element={<ProtectedRoute><TeamPreview /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><AppShell><Leaderboard /></AppShell></ProtectedRoute>} />
          <Route path="/compare/:leagueId" element={<ProtectedRoute><AppShell><TeamCompare /></AppShell></ProtectedRoute>} />
          <Route path="/match/:id" element={<ProtectedRoute><AppShell><MatchDetail /></AppShell></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AppShell><Admin /></AppShell></ProtectedRoute>} />
          <Route path="/points" element={<ProtectedRoute><PointsSystem /></ProtectedRoute>} />
          <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
