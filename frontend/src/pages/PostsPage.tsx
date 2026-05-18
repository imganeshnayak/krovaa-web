import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserPosts, Post } from "@/lib/api";
import PostCreate from "@/components/posts/PostCreate";
import PostGrid from "@/components/posts/PostGrid";
import LoadingScreen from "@/components/ui/LoadingScreen";
import Logo from "@/components/Logo";

const PostsPage = () => {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadPosts = async () => {
    if (!currentUser) return;
    setIsLoadingPosts(true);
    try {
      const userPosts = await getUserPosts(currentUser.id);
      setPosts(userPosts);
    } catch (err) {
      console.error("Failed to load posts:", err);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    } else if (currentUser) {
      loadPosts();
    }
  }, [currentUser, authLoading, navigate]);

  const handlePostCreated = (post: Post) => {
    setPosts([post, ...posts]);
    setShowCreateForm(false);
  };

  const handlePostDeleted = (postId: number) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  const handleFABClick = () => {
    setShowCreateForm(!showCreateForm);
    if (!showCreateForm) {
      setTimeout(() => {
        document.querySelector('[data-create-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  if (authLoading) return <LoadingScreen />;

  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="min-h-screen bg-[#F5F5F5] text-[#1C1C1C]"
    >
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#00A4EF]/5 blur-[120px]" />
        <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] rounded-full bg-[#00A4EF]/3 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(to right, #E0E0E0 1px, transparent 1px), linear-gradient(to bottom, #E0E0E0 1px, transparent 1px)`,
          backgroundSize: "64px 64px"
        }} />
      </div>

      {/* Sticky Header */}
      <div className="sticky top-0 z-50 border-b border-[#E0E0E0] backdrop-blur-xl bg-white/80">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            to={`/${currentUser?.username}`}
            className="flex items-center gap-2 text-[#1C1C1C]/60 hover:text-[#1C1C1C] transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Link to="/" className="flex items-center">
            <Logo size="sm" theme="dark" />
          </Link>
          <div className="w-12" />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 pb-40 relative z-10">
        {/* ── Floating Action Button ── */}
        <button
          onClick={handleFABClick}
          className={`fixed bottom-24 right-6 z-[60] w-16 h-16 rounded-full bg-[#00A4EF] hover:bg-[#007BB5] text-white shadow-2xl shadow-[#00A4EF]/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
            showCreateForm ? 'rotate-45' : ''
          }`}
          style={{ transitionDuration: '300ms' }}
          title={showCreateForm ? 'Close' : 'Create new post'}
        >
          <Plus className="h-8 w-8" />
        </button>

        {/* Page Header */}
        <div className="mb-10 mt-10">
          <div className="flex items-baseline gap-3 mb-3">
            <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-4xl font-bold text-[#1C1C1C]">
              Your Posts
            </h1>
            <span className="px-3 py-1 rounded-full bg-[#00A4EF]/10 border border-[#00A4EF]/20 text-sm font-bold text-[#00A4EF]">
              {posts.length}
            </span>
          </div>
          <p className="text-[#1C1C1C]/60 text-base leading-relaxed">
            Showcase your work and demonstrate your expertise. Build credibility with clients and employers.
          </p>
        </div>

        {/* Create Post Section */}
        {showCreateForm && (
          <div
            data-create-form
            className="mb-12 animate-in fade-in slide-in-from-top-4 duration-300"
          >
            <div className="relative p-8 rounded-2xl border border-[#E0E0E0] bg-gradient-to-br from-white via-white to-[#F9F9F9] shadow-[0_8px_32px_rgba(0,164,239,0.08)]">
              {/* Decorative top border */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#00A4EF] to-transparent rounded-t-2xl" />
              
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-[#E0E0E0]">
                <div>
                  <h2 className="text-xl font-bold text-[#1C1C1C]">Create New Post</h2>
                  <p className="text-sm text-[#1C1C1C]/50 mt-1">Share your latest work and achievements</p>
                </div>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-2 hover:bg-[#E0E0E0]/50 rounded-lg transition-colors text-[#1C1C1C]/40 hover:text-[#1C1C1C]"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Form Content */}
              <div className="animate-in fade-in duration-400">
                <PostCreate onPostCreated={handlePostCreated} />
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingPosts && posts.length === 0 && !showCreateForm && (
          <div className="py-20 text-center animate-in fade-in duration-500">
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00A4EF]/20 to-[#00A4EF]/5 flex items-center justify-center">
                <Plus className="h-10 w-10 text-[#00A4EF]" />
              </div>
            </div>
            <h3 style={{ fontFamily: "'Syne', sans-serif" }} className="text-2xl font-bold text-[#1C1C1C] mb-2">
              No posts yet
            </h3>
            <p className="text-[#1C1C1C]/60 text-base mb-8 max-w-sm mx-auto leading-relaxed">
              Start building your portfolio today. Your posts help clients and employers understand your capabilities.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-8 py-3 bg-[#00A4EF] text-white font-semibold rounded-xl hover:bg-[#007BB5] transition-all shadow-lg shadow-[#00A4EF]/20 hover:shadow-xl hover:shadow-[#00A4EF]/30 active:scale-95"
            >
              Create Your First Post
            </button>
          </div>
        )}

        {/* Posts Grid */}
        {posts.length > 0 && (
          <div className="animate-in fade-in duration-500">
            <div className="mb-8 pb-6 border-b border-[#E0E0E0]">
              <h2 className="text-lg font-bold text-[#1C1C1C] tracking-tight">
                All Posts
              </h2>
              <p className="text-sm text-[#1C1C1C]/50 mt-1">
                Total: <span className="font-semibold text-[#1C1C1C]">{posts.length}</span>
              </p>
            </div>
            
            {isLoadingPosts ? (
              <div className="py-12 text-center">
                <div className="inline-flex items-center gap-2 text-[#1C1C1C]/60">
                  <div className="w-2 h-2 rounded-full bg-[#00A4EF] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#00A4EF] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#00A4EF] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : (
              <PostGrid
                posts={posts}
                isLoading={false}
                isOwnProfile={true}
                onPostDeleted={handlePostDeleted}
              />
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translateY(-16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-in {
          animation: slideInFromTop 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PostsPage;
