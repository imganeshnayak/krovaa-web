import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoadingScreen from "./components/ui/LoadingScreen";

const Toaster = lazy(() => import("@/components/ui/toaster").then((module) => ({ default: module.Toaster })));
const BottomNavbar = lazy(() => import("./components/BottomNavbar"));
const Sonner = lazy(() => import("@/components/ui/sonner").then((module) => ({ default: module.Toaster })));
const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then((module) => ({ default: module.TooltipProvider })));
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

const QueryWrapper = lazy(() =>
  import("@tanstack/react-query").then(({ QueryClient, QueryClientProvider }) => {
    const queryClient = new QueryClient();

    return {
      default: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    };
  })
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
          <Route path="/profile" element={<ClientRoute><ProfilePage /></ClientRoute>} />
          <Route path="/profile/:username" element={<ProfileRedirect />} />
          <Route path="/escrow" element={<ClientRoute><EscrowPage /></ClientRoute>} />
          <Route path="/wallet" element={<ClientRoute><WalletPage /></ClientRoute>} />
          <Route path="/wallet/pay/:shareId" element={<WalletPayPage />} />
          <Route path="/settings" element={<ClientRoute><SettingsPage /></ClientRoute>} />
          <Route path="/blocked-users" element={<ClientRoute><BlockedUsersPage /></ClientRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/chats/:chatId" element={<AdminRoute><AdminChatView /></AdminRoute>} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund" element={<Refund />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/s/:shareId" element={<ProfilePage />} />
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
