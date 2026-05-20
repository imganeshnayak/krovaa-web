import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "./contexts/AuthContext";
import LoadingScreen from "./components/ui/LoadingScreen";
import BottomNavbar from "./components/BottomNavbar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import EscrowPage from "./pages/EscrowPage";
import WalletPage from "./pages/WalletPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminChatView from "./pages/AdminChatView";
import SettingsPage from "./pages/SettingsPage";
import ImageGeneratorPage from "./pages/ImageGeneratorPage";
import ImageGeneratorPricingPage from "./pages/ImageGeneratorPricingPage";
import BlockedUsersPage from "./pages/BlockedUsersPage";
import ForgotPassword from "./pages/ForgotPassword";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";
import Refund from "./pages/legal/Refund";
import CookiePolicy from "./pages/legal/CookiePolicy";
import NotFound from "./pages/NotFound";
import CookieConsent from "./components/CookieConsent";

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
  // Hide navbar on auth pages and on public profile pages when not logged in
  const isAuthPage = ["/login", "/register", "/", "/forgot-password"].includes(location.pathname);
  const showNavbar = !isAuthPage && !!user;

  return (
    <div className={`${showNavbar ? "pb-16" : ""} main-wrapper`}>
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
        <Route path="/post-job" element={<ClientRoute><PostJobPage /></ClientRoute>} />
        <Route path="/jobs/:jobId" element={<ClientRoute><JobDetailsPage /></ClientRoute>} />
        {/* Own profile - requires login */}
        <Route path="/profile" element={<ClientRoute><ProfilePage /></ClientRoute>} />
        {/* Legacy /profile/:username -> redirect to /:username */}
        <Route path="/profile/:username" element={<ProfileRedirect />} />
        <Route path="/escrow" element={<ClientRoute><EscrowPage /></ClientRoute>} />
        <Route path="/wallet" element={<ClientRoute><WalletPage /></ClientRoute>} />
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
      {showNavbar && <BottomNavbar />}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
);

export default App;
