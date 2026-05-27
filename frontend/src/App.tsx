import { lazy, Suspense, useEffect } from "react";
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
import { useAuth } from "./contexts/AuthContext";
import LoadingScreen from "./components/ui/LoadingScreen";
import BottomNavbar from "./components/BottomNavbar";
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
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
const ImageGeneratorPage = lazy(() => import("./pages/ImageGeneratorPage"));
const ImageGeneratorPricingPage = lazy(() => import("./pages/ImageGeneratorPricingPage"));
const BlockedUsersPage = lazy(() => import("./pages/BlockedUsersPage"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const CommunitiesPage = lazy(() => import("./pages/CommunitiesPage"));
const CommunityDetailPage = lazy(() => import("./pages/CommunityDetailPage"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Refund = lazy(() => import("./pages/legal/Refund"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CookieConsent = lazy(() => import("./components/CookieConsent"));
const CommunitiesTabPage = lazy(() => import("./pages/CommunitiesTabPage"));
const JoinCommunityPage = lazy(() => import("./pages/JoinCommunityPage"));
// FloatingCommunityButton is rendered by ChatPage only

const queryClient = new QueryClient();

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Admin Route component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/chat" replace />;
  return <>{children}</>;
};

// Client Only Route (Regular users + Admins, but NOT staff)
const ClientRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'staff') return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

// Public Route component (redirects to chat if already logged in)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (user) {
    return <Navigate to={(user.role === 'admin' || user.role === 'staff') ? "/admin" : "/chat"} replace />;
  }
  return <>{children}</>;
};

// Redirect component: /profile/:username -> /:username
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
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/chat" element={<ClientRoute><ChatPage /></ClientRoute>} />
        <Route path="/image-generator" element={<ClientRoute><ImageGeneratorPage /></ClientRoute>} />
        <Route path="/image-generator/pricing" element={<ImageGeneratorPricingPage />} />
        <Route path="/posts" element={<ClientRoute><PostsPage /></ClientRoute>} />
        <Route path="/explore" element={<ClientRoute><ExplorePage /></ClientRoute>} />
        <Route path="/communities" element={<ClientRoute><CommunitiesPage /></ClientRoute>} />
        <Route path="/communities/tab" element={<ClientRoute><CommunitiesTabPage /></ClientRoute>} />
        <Route path="/communities/:id" element={<ClientRoute><CommunityDetailPage /></ClientRoute>} />
        <Route path="/join/:slug" element={<ClientRoute><JoinCommunityPage /></ClientRoute>} />
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
      {showNavbar && <BottomNavbar />}
    </main>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
