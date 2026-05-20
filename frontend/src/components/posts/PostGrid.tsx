import { Post } from "@/lib/api";
import { remoteUrl } from "@/lib/config";
import { Heart, MessageCircle } from "lucide-react";
import { useState } from "react";
import PostDetailModal from "./PostDetailModal";

interface PostGridProps {
  posts: Post[];
  isLoading: boolean;
  isOwnProfile: boolean;
  onPostDeleted?: (postId: number) => void;
}

export default function PostGrid({ posts, isLoading, isOwnProfile, onPostDeleted }: PostGridProps) {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const getThumbnailUrl = (post: Post): string => {
    if (!post.media || post.media.length === 0) {
      return ""; // Fallback for text-only posts
    }
    const firstMedia = post.media[0];
    return remoteUrl(firstMedia.url);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-[#1C1C1C]/40">Loading posts...</div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-[#1C1C1C]/40 text-sm">
          {isOwnProfile ? "No proof of work yet. Share your first post!" : "No posts yet"}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 md:gap-2 sm:grid-cols-2 xs:grid-cols-1">
        {posts.map((post) => {
          const hasMedia = post.media && post.media.length > 0;
          const isVideo = hasMedia && post.media[0].resource_type === "video";

          return (
            <button
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="group relative aspect-square overflow-hidden bg-[#F5F5F5] rounded-lg hover:shadow-lg transition-all duration-200"
            >
              {/* Thumbnail */}
              {hasMedia ? (
                <>
                  {isVideo ? (
                    <video
                      src={getThumbnailUrl(post)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <img
                      src={getThumbnailUrl(post)}
                      alt="Post"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/80 group-hover:bg-white transition-colors">
                        <svg className="w-6 h-6 text-[#1C1C1C]" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#00A4EF]/10 to-[#007BB5]/10">
                  <div className="text-center px-4">
                    <p className="text-[#1C1C1C]/60 text-xs line-clamp-3">{post.text}</p>
                  </div>
                </div>
              )}

              {/* Overlay with stats */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-4 text-white">
                  <div className="flex items-center gap-1.5">
                    <Heart className="h-5 w-5 fill-white" />
                    <span className="text-sm font-medium">{post.likes?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">{post.comments?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Multiple media indicator */}
              {post.media && post.media.length > 1 && (
                <div className="absolute top-2 right-2 bg-white/80 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-[#1C1C1C]">
                  +{post.media.length - 1}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          isOpen={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          onPostDeleted={onPostDeleted}
          isOwnProfile={isOwnProfile}
        />
      )}
    </>
  );
}
