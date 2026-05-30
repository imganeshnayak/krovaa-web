import { Suspense, useEffect, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useAuth } from "./contexts/AuthContext";
import LoadingScreen from "./components/ui/LoadingScreen";
import BottomNavbar from "./components/BottomNavbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChatPage from "./pages/ChatPage";
import ProfilePage from "./pages/ProfilePage";
import PostsPage from "./pages/PostsPage";
import ExplorePage from "./pages/ExplorePage";
import PostJobPage from "./pages/PostJobPage";
import JobDetailsPage from "./pages/JobDetailsPage";
import MyListingsPage from "./pages/MyListingsPage";
import EscrowPage from "./pages/EscrowPage";
import WalletPage from "./pages/WalletPage";
import WalletPayPage from "./pages/WalletPayPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminChatView from "./pages/AdminChatView";
import SettingsPage from "./pages/SettingsPage";
import BlockedUsersPage from "./pages/BlockedUsersPage";
import ForgotPassword from "./pages/ForgotPassword";
import CommunitiesPage from "./pages/CommunitiesPage";
import CommunityDetailPage from "./pages/CommunityDetailPage";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";
import Refund from "./pages/legal/Refund";
import CookiePolicy from "./pages/legal/CookiePolicy";
import NotFound from "./pages/NotFound";
import CookieConsent from "./components/CookieConsent";
import CommunitiesTabPage from "./pages/CommunitiesTabPage";
import JoinCommunityPage from "./pages/JoinCommunityPage";
// FloatingCommunityButton is rendered by ChatPage only
import { ENABLE_COMMUNITIES } from "./lib/features";

const queryClient = new QueryClient();

const QueryWrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/chat" replace />;

  return <>{children}</>;
};

const ClientRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "staff") return <Navigate to="/admin" replace />;

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (user) {
    return <Navigate to={user.role === "admin" || user.role === "staff" ? "/admin" : "/chat"} replace />;
  }

  return <>{children}</>;
};

const ProfileRedirect = () => {
  const { username } = useParams<{ username: string }>();

  return <Navigate to={`/${username}`} replace />;
};

const MainContent = () => {
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Clear profile cache on logout
  useEffect(() => {
    if (!user) {
      queryClient.removeQueries({ queryKey: ['profile'] });
    }
  }, [user, queryClient]);

  // Hide navbar on auth pages and on public profile pages when not logged in
  const isAuthPage = ["/login", "/register", "/", "/forgot-password"].includes(location.pathname);
  const showNavbar = !isAuthPage && !!user;

  return (
    <main className={`${showNavbar ? "pb-16" : ""} main-wrapper`}>
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={Capacitor.isNativePlatform() ? <Navigate to="/login" replace /> : <Landing />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/chat" element={<ClientRoute><ChatPage /></ClientRoute>} />
                <Route path="/posts" element={<ClientRoute><PostsPage /></ClientRoute>} />
        <Route path="/explore" element={<ClientRoute><ExplorePage /></ClientRoute>} />
        <Route path="/communities" element={ENABLE_COMMUNITIES ? <ClientRoute><CommunitiesPage /></ClientRoute> : <Navigate to="/chat" replace />} />
        <Route path="/communities/tab" element={ENABLE_COMMUNITIES ? <ClientRoute><CommunitiesTabPage /></ClientRoute> : <Navigate to="/chat" replace />} />
        <Route path="/communities/:id" element={ENABLE_COMMUNITIES ? <ClientRoute><CommunityDetailPage /></ClientRoute> : <Navigate to="/chat" replace />} />
        <Route path="/join/:slug" element={ENABLE_COMMUNITIES ? <ClientRoute><JoinCommunityPage /></ClientRoute> : <Navigate to="/chat" replace />} />
        <Route path="/post-job" element={<ClientRoute><PostJobPage /></ClientRoute>} />
        <Route path="/jobs/:jobId" element={<ClientRoute><JobDetailsPage /></ClientRoute>} />
        <Route path="/my-listings" element={<ClientRoute><MyListingsPage /></ClientRoute>} />
        {/* Own profile - requires login */}
        <Route path="/profile" element={<ClientRoute><ProfilePage /></ClientRoute>} />
        {/* Legacy /profile/:username -> redirect to /:username */}
        <Route path="/profile/:username" element={<ProfileRedirect />} />
        <Route path="/escrow" element={<ClientRoute><EscrowPage /></ClientRoute>} />
        <Route path="/wallet" element={<ClientRoute><WalletPage /></ClientRoute>} />
        <Route path="/wallet/pay/:shareId" element={<WalletPayPage />} />
        <Route path="/settings" element={<ClientRoute><SettingsPage /></ClientRoute>} />
        <Route path="/blocked-users" element={<ClientRoute><BlockedUsersPage /></ClientRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/chats/:chatId" element={<AdminRoute><AdminChatView /></AdminRoute>} />
        {/* Legal Pages */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/refund" element={<Refund />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />

        {/* Shared profile pages at /s/:shareId */}
        <Route path="/s/:shareId" element={<ProfilePage />} />

        {/* Public profile pages at /:username - works without login */}
        <Route path="/:username" element={<ProfilePage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>

      {showNavbar && (
        <Suspense fallback={null}>
          <BottomNavbar />
        </Suspense>
      )}
    </main>
  );
};

const App = () => (
  <Suspense fallback={<LoadingScreen />}>
    <QueryWrapper>
      <AuthProvider>
        <Suspense fallback={null}>
          <TooltipProvider>
            <Suspense fallback={null}>
              <Toaster />
              <Sonner />
            </Suspense>

            <BrowserRouter>
              <MainContent />
              <Suspense fallback={null}>
                <CookieConsent />
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </Suspense>
      </AuthProvider>
    </QueryWrapper>
  </Suspense>
);

export default App;
