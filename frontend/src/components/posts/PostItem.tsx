import { Post, PostMedia, likePost, deletePost } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Trash2, Share2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { remoteUrl } from "@/lib/config";

interface PostItemProps {
  post: Post;
  onPostDeleted?: (postId: number) => void;
}

export default function PostItem({ post, onPostDeleted }: PostItemProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return "";
    }
  };

  const getMediaUrl = (url: string) => {
    return remoteUrl(url);
  };

  const handleLike = async () => {
    try {
      const result = await likePost(post.id);
      setIsLiked(result.liked);
      setLikeCount(result.liked ? likeCount + 1 : likeCount - 1);
    } catch (err) {
      toast({ title: "Error", description: "Failed to like post", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    setIsDeleting(true);
    try {
      await deletePost(post.id);
      toast({ title: "Post deleted" });
      onPostDeleted?.(post.id);
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete post", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = user?.id === post.userId;

  return (
    <div className="rounded-xl bg-white border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header with user info */}
      {post.user && (
        <div className="flex items-center justify-between p-3 border-b border-[#E0E0E0]">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={post.user.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">{post.user.username?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-[#1C1C1C]">{post.user.displayName || post.user.username}</p>
              <p className="text-[10px] text-[#1C1C1C]/50">{formatDate(post.createdAt)}</p>
            </div>
          </div>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
        </div>
      )}

      {/* Content text */}
      {post.text && (
        <div className="px-4 py-3">
          <p className="text-sm text-[#1C1C1C]/80 whitespace-pre-wrap">{post.text}</p>
        </div>
      )}

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <div className={`grid gap-1 ${post.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {post.media.map((item: PostMedia, index: number) => {
            const isVideo = item.resource_type === "video";

            if (isVideo) {
              return (
                <div key={index} className="relative bg-black">
                  <video
                    src={getMediaUrl(item.url)}
                    controls
                    className="w-full h-48 object-cover"
                  />
                </div>
              );
            }

            return (
              <div key={index} className="relative overflow-hidden">
                <img
                  src={getMediaUrl(item.url)}
                  alt={`Post media ${index + 1}`}
                  className="w-full h-48 object-cover"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Actions footer */}
      <div className="px-4 py-3 border-t border-[#E0E0E0] space-y-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className="flex items-center gap-1 transition-colors group"
          >
            <Heart
              className={`h-5 w-5 transition-all ${
                isLiked
                  ? "fill-red-500 text-red-500"
                  : "text-[#1C1C1C]/60 group-hover:text-red-500"
              }`}
            />
            <span className="text-xs text-[#1C1C1C]/60">{likeCount}</span>
          </button>

          <button className="flex items-center gap-1 transition-colors hover:text-[#00A4EF]">
            <MessageCircle className="h-5 w-5 text-[#1C1C1C]/60" />
            <span className="text-xs text-[#1C1C1C]/60">{post.comments?.length || 0}</span>
          </button>

          <button className="flex items-center gap-1 transition-colors hover:text-[#00A4EF]">
            <Share2 className="h-5 w-5 text-[#1C1C1C]/60" />
          </button>
        </div>

        {/* Comments preview */}
        {post.comments && post.comments.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#E0E0E0]">
            {post.comments.slice(0, 2).map((comment) => (
              <div key={comment.id} className="text-xs">
                <span className="font-medium text-[#1C1C1C]">{comment.user.displayName || comment.user.username}</span>
                <span className="text-[#1C1C1C]/60 ml-1">{comment.text}</span>
              </div>
            ))}
            {post.comments.length > 2 && (
              <p className="text-xs text-[#00A4EF] font-medium">View all {post.comments.length} comments</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}