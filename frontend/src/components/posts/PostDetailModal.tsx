import { Post, addPostComment, deletePostComment, likePost, deletePost } from "@/lib/api";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { X, Heart, MessageCircle, Trash2, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { remoteUrl } from "@/lib/config";

interface PostDetailModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onPostDeleted?: (postId: number) => void;
  isOwnProfile: boolean;
}

import { createPortal } from "react-dom";

export default function PostDetailModal({
  post,
  isOpen,
  onClose,
  onPostDeleted,
  isOwnProfile,
}: PostDetailModalProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  const [comments, setComments] = useState(post.comments || []);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    setLikeCount(post.likes?.length || 0);
    setIsLiked(!!user?.id && !!post.likes?.some((like) => like.userId === user.id));
    setComments(post.comments || []);
  }, [post, user?.id]);

  if (!isOpen) return null;

  const getMediaUrl = (url: string) => {
    return remoteUrl(url);
  };

  const handleLike = async () => {
    try {
      const result = await likePost(post.id);
      setIsLiked(result.liked);
      setLikeCount((current) => Math.max(0, result.liked ? current + 1 : current - 1));
    } catch (err) {
      toast({ title: "Error", description: "Failed to like post", variant: "destructive" });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const comment = await addPostComment(post.id, newComment.trim());
      setComments([comment, ...comments]);
      setNewComment("");
    } catch (err) {
      toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deletePostComment(post.id, commentId);
      setComments(comments.filter((c) => c.id !== commentId));
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete comment", variant: "destructive" });
    }
  };

  const handleDeletePost = async () => {
    if (!confirm("Delete this post?")) return;
    setIsDeleting(true);
    try {
      await deletePost(post.id);
      toast({ title: "Post deleted" });
      onPostDeleted?.(post.id);
      onClose();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete post", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = user?.id === post.userId;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col relative z-[10000]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E0E0E0]">
          {post.user && (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.user.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">{post.user.username?.[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-[#1C1C1C]">
                  {post.user.displayName || post.user.username}
                </p>
                <p className="text-xs text-[#1C1C1C]/50">
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                onClick={handleDeletePost}
                disabled={isDeleting}
                aria-label="Delete post"
                title="Delete post"
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-5 w-5 text-red-500" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close post details"
              title="Close post details"
              className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-[#1C1C1C]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Media */}
          {post.media && post.media.length > 0 && (
            <div className="w-full bg-black flex items-center justify-center max-h-[400px] overflow-hidden">
              {post.media[0].resource_type === "video" ? (
                <video
                  src={getMediaUrl(post.media[0].url)}
                  controls
                  className="block w-full max-h-[400px] object-contain"
                />
              ) : (
                <img
                  src={getMediaUrl(post.media[0].url)}
                  alt="Post"
                  className="block w-full max-h-[400px] object-contain"
                />
              )}
            </div>
          )}

          <div className="border-b border-[#E0E0E0] bg-white px-4 py-4 space-y-4">
            {/* Post text */}
            {post.text && (
              <p className="text-sm text-[#1C1C1C] whitespace-pre-wrap">{post.text}</p>
            )}

            {/* Stats and actions */}
            <div className="flex flex-wrap items-center gap-6 border-t border-[#E0E0E0] pt-3">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 transition-colors ${
                  isLiked ? "text-red-500" : "text-[#1C1C1C]/60 hover:text-red-500"
                }`}
              >
                <Heart
                  className="h-5 w-5 transition-all"
                  fill={isLiked ? "currentColor" : "none"}
                />
                <span className="text-sm font-medium">{likeCount} Likes</span>
              </button>

              <div className="flex items-center gap-2 text-[#1C1C1C]/60">
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm font-medium">{comments.length} Comments</span>
              </div>
            </div>
          </div>

          {/* Comments section */}
          <div className="p-4 space-y-4 bg-white">
            {comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.user.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {comment.user.username?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="bg-[#F5F5F5] rounded-lg px-3 py-2">
                        <p className="text-xs font-medium text-[#1C1C1C]">
                          {comment.user.displayName || comment.user.username}
                        </p>
                        <p className="text-sm text-[#1C1C1C] mt-1">{comment.text}</p>
                      </div>
                      <p className="text-xs text-[#1C1C1C]/40 mt-1">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {user?.id === comment.user.id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        aria-label="Delete comment"
                        title="Delete comment"
                        className="text-[#1C1C1C]/40 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-[#1C1C1C]/40">No comments yet</p>
            )}
          </div>
        </div>

        {/* Comment input */}
        <form
          onSubmit={handleAddComment}
          className="border-t border-[#E0E0E0] p-4 flex gap-2"
        >
          <input
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:border-[#00A4EF]"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmittingComment}
            aria-label="Send comment"
            title="Send comment"
            className="px-3 py-2 bg-[#00A4EF] hover:bg-[#007BB5] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
