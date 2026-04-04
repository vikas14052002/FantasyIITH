import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getUser, needsPhoneLink } from './lib/auth';
import { startHeartbeat } from './lib/heartbeat';
import { initTheme } from './lib/theme';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import UpdatePrompt from './components/UpdatePrompt';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import PhoneLinkPopup from './components/PhoneLinkPopup';
import { PageLoaderSkeleton } from './components/Skeleton';

// Apply saved theme on load
initTheme();

// Lazy load all pages
const Login = lazy(() => import('./pages/Login'));
const Leagues = lazy(() => import('./pages/Leagues'));
const CreateLeague = lazy(() => import('./pages/CreateLeague'));
const JoinLeague = lazy(() => import('./pages/JoinLeague'));
const LeagueDetail = lazy(() => import('./pages/LeagueDetail'));
const CreateTeam = lazy(() => import('./pages/CreateTeam'));

const CaptainSelect = lazy(() => import('./pages/CaptainSelect'));
const TeamPreview = lazy(() => import('./pages/TeamPreview'));
const MatchDetail = lazy(() => import('./pages/MatchDetail'));
const Admin = lazy(() => import('./pages/Admin'));
const PointsSystem = lazy(() => import('./pages/PointsSystem'));
const Feedback = lazy(() => import('./pages/Feedback'));
const UserBreakdown = lazy(() => import('./pages/UserBreakdown'));

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
  return <PageLoaderSkeleton />;
}

export default function App() {
  const [showPhoneLink, setShowPhoneLink] = useState(needsPhoneLink());
  useEffect(() => { startHeartbeat(); }, []);
  return (
    <BrowserRouter>
      <OfflineBanner />
      <UpdatePrompt />
      {showPhoneLink && <PhoneLinkPopup onComplete={() => setShowPhoneLink(false)} />}
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/leagues" element={<ProtectedRoute><AppShell><Leagues /></AppShell></ProtectedRoute>} />
          <Route path="/leagues/create" element={<ProtectedRoute><AppShell><CreateLeague /></AppShell></ProtectedRoute>} />
          <Route path="/leagues/join" element={<ProtectedRoute><AppShell><JoinLeague /></AppShell></ProtectedRoute>} />
          <Route path="/leagues/:id" element={<ProtectedRoute><AppShell><LeagueDetail /></AppShell></ProtectedRoute>} />
          <Route path="/create-team/:matchId/:leagueId" element={<ProtectedRoute><CreateTeam /></ProtectedRoute>} />

          <Route path="/captain-select/:matchId/:leagueId" element={<ProtectedRoute><CaptainSelect /></ProtectedRoute>} />
          <Route path="/team-preview/:teamId" element={<ProtectedRoute><TeamPreview /></ProtectedRoute>} />
          <Route path="/match/:id" element={<ProtectedRoute><AppShell><MatchDetail /></AppShell></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AppShell><Admin /></AppShell></ProtectedRoute>} />
          <Route path="/points" element={<ProtectedRoute><PointsSystem /></ProtectedRoute>} />
          <Route path="/feedback" element={<ProtectedRoute><AppShell><Feedback /></AppShell></ProtectedRoute>} />
          <Route path="/leagues/:leagueId/breakdown/:userId" element={<ProtectedRoute><UserBreakdown /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/leagues" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
