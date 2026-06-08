import { useEffect, type ReactNode, lazy, Suspense } from "react";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useAuth } from "./contexts/AuthContext";
import LoadingScreen from "./components/ui/LoadingScreen";
import BottomNavbar from "./components/BottomNavbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import CookieConsent from "./components/CookieConsent";

// Lazy-load page components
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const PostsPage = lazy(() => import("./pages/PostsPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const PostJobPage = lazy(() => import("./pages/PostJobPage"));
const JobDetailsPage = lazy(() => import("./pages/JobDetailsPage"));
const MyListingsPage = lazy(() => import("./pages/MyListingsPage"));
const EscrowPage = lazy(() => import("./pages/EscrowPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const WalletPayPage = lazy(() => import("./pages/WalletPayPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminChatView = lazy(() => import("./pages/AdminChatView"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const BlockedUsersPage = lazy(() => import("./pages/BlockedUsersPage"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const CollabSpacePage = lazy(() => import("./pages/CollabSpacePage"));
const CollabReviewPage = lazy(() => import("./pages/CollabReviewPage"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Refund = lazy(() => import("./pages/legal/Refund"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CollabDetailsPage = lazy(() => import("./pages/CollabDetailsPage"));
const PostCollabPage = lazy(() => import("./pages/PostCollabPage"));
const SavedJobsPage = lazy(() => import("./components/SavedJobsPage").then((module) => ({ default: module.SavedJobsPage })));

import PublicNavbar from "./components/Navbar";

const queryClient = new QueryClient();

const QueryWrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();

  // Don't show loading if we have cached user - only show on initial auth check
  if (isLoading && !user) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/chat" replace />;

  return <>{children}</>;
};

const ClientRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();

  // Don't show loading if we have cached user - only show on initial auth check
  if (isLoading && !user) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "staff") return <Navigate to="/admin" replace />;

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();

  // Don't show loading if we have cached user - only show on initial auth check
  if (isLoading && !user) return <LoadingScreen />;
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
  const showBottomNavbar = !isAuthPage && !!user;
  const showPublicNavbar = !isAuthPage && !user;

  return (
    <main className={`${showBottomNavbar ? "pb-16" : ""} main-wrapper`}>
      {showPublicNavbar && <PublicNavbar />}
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/chat" element={<ClientRoute><ChatPage /></ClientRoute>} />
                  <Route path="/posts" element={<ClientRoute><PostsPage /></ClientRoute>} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/collab/:id" element={<ClientRoute><CollabSpacePage /></ClientRoute>} />
          <Route path="/collab/:id/review" element={<ClientRoute><CollabReviewPage /></ClientRoute>} />
          <Route path="/blueprint/:id" element={<CollabDetailsPage />} />
          <Route path="/post-job" element={<ClientRoute><PostJobPage /></ClientRoute>} />
          <Route path="/post-collab" element={<ClientRoute><PostCollabPage /></ClientRoute>} />
          <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
          <Route path="/saved-jobs" element={<ClientRoute><SavedJobsPage /></ClientRoute>} />
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

      {showBottomNavbar && (
          <BottomNavbar />
      )}
    </main>
  );
};

const App = () => (
    <QueryWrapper>
      <AuthProvider>
          <TooltipProvider>
              <Toaster />
              <Sonner />

            <BrowserRouter>
              <MainContent />
                <CookieConsent />
            </BrowserRouter>
          </TooltipProvider>
      </AuthProvider>
    </QueryWrapper>
);

export default App;
