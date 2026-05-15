import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { themeColors } from "@/lib/themeColors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Share2, MessageSquare, Twitter, Instagram, Linkedin,
  Github, Globe, Plus, Trash2, Star, LogOut, Facebook, Youtube,
  Camera, Save, X, Edit2, Eye, MapPin, CheckCircle2, RotateCcw, Trash, Phone, Lock, Briefcase,
  Code, Palette, Hammer, GanttChart, Users, GraduationCap, UserCircle, HelpCircle, ChevronRight,
  MoreHorizontal, Flag, AlertCircle, Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUser, getUserByUsername, getUserByShareId, updateUserProfile, uploadAvatar,
  rateUser, AuthUser, applyForVerification, getVerificationStatus,
  getVerificationFee, VerificationRequest, getRatingEligibility, uploadCoverPhoto,
  deleteAvatar, deleteCoverPhoto
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import LoadingScreen from "@/components/ui/LoadingScreen";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Logo from "@/components/Logo";
import { getUserPosts, Post } from "@/lib/api";
import PostCreate from "@/components/posts/PostCreate";
import PostGrid from "@/components/posts/PostGrid";



/* ── Constants for Profession Selection ── */
const CATEGORIES = [
  { id: "tech", label: "Tech", icon: Code, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
  { id: "creative", label: "Creative", icon: Palette, color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
  { id: "engineering", label: "Engineering", icon: Hammer, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
  { id: "professional", label: "Professional", icon: GanttChart, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  { id: "freelancer", label: "Freelancer", icon: Users, color: "text-pink-400", bg: "bg-pink-400/10", border: "border-pink-400/20" },
  { id: "student", label: "Student", icon: GraduationCap, color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20" },
  { id: "none", label: "None", icon: UserCircle, color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20" },
  { id: "other", label: "Other", icon: HelpCircle, color: "text-zinc-400", bg: "bg-zinc-400/10", border: "border-zinc-400/20" },
];

const SUB_PROFESSIONS: Record<string, string[]> = {
  tech: ["Software Developer", "Web Developer", "Data Scientist", "AI / ML Engineer", "Cybersecurity Analyst", "DevOps Engineer", "Mobile App Developer"],
  creative: ["UI/UX Designer", "Graphic Designer", "3D Designer", "2D Designer", "Content Creator", "Video Editor", "Photographer", "Videographer", "Artist / Illustrator", "Musician"],
  engineering: ["Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Architect", "Structural Engineer"],
  professional: ["Product Manager", "Digital Marketer", "Doctor", "Nurse", "Pharmacist", "Lawyer", "Chartered Accountant", "Teacher / Educator", "Consultant"],
};

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const PLATFORMS = [
  { id: "facebook", name: "Facebook", icon: Facebook },
  { id: "twitter", name: "Twitter", icon: Twitter },
  { id: "instagram", name: "Instagram", icon: Instagram },
  { id: "youtube", name: "YouTube", icon: Youtube },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin },
  { id: "github", name: "GitHub", icon: Github },
  { id: "website", name: "Website", icon: Globe },
  { id: "other", name: "Other", icon: Globe },
];

const SocialIcon = ({ platform, className }: { platform: string; className?: string }) => {
  const p = platform.toLowerCase();
  const cls = className || "h-4 w-4";
  if (p.includes("facebook")) return <Facebook className={cls} />;
  if (p.includes("twitter")) return <Twitter className={cls} />;
  if (p.includes("instagram")) return <Instagram className={cls} />;
  if (p.includes("youtube")) return <Youtube className={cls} />;
  if (p.includes("linkedin")) return <Linkedin className={cls} />;
  if (p.includes("github")) return <Github className={cls} />;
  return <Globe className={cls} />;
};

/* ── Underline field ── */
const Field = ({ label, icon: Icon, textarea, className = "", ...props }: any) => (
  <div className="group">
    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-[#1C1C1C]/40 mb-2 ml-0.5">{label}</label>
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-3 w-3.5 h-3.5 text-[#1C1C1C]/25 group-focus-within:text-[#00A4EF] transition-colors duration-200" />}
      {textarea ? (
        <textarea
          className={`w-full bg-[#F5F5F5] border border-[#E0E0E0] focus:border-[#00A4EF]/50 outline-none rounded-lg ${Icon ? "pl-10" : "px-3"} pb-2.5 pt-2 text-sm text-[#1C1C1C] placeholder:text-[#1C1C1C]/20 transition-colors duration-200 resize-none ${className}`}
          rows={3}
          {...props}
        />
      ) : (
        <input
          className={`w-full bg-[#F5F5F5] border border-[#E0E0E0] focus:border-[#00A4EF]/50 outline-none rounded-lg ${Icon ? "pl-10" : "px-3"} h-10 text-sm text-[#1C1C1C] placeholder:text-[#1C1C1C]/20 transition-colors duration-200 ${className}`}
          {...props}
        />
      )}
    </div>
  </div>
);

/* ── Star row ── */
const Stars = ({ value, max = 5, size = "h-4 w-4", interactive = false, onChange }: any) => (
  <div className="flex gap-1">
    {Array.from({ length: max }).map((_, i) => (
      <button
        key={i}
        type="button"
        onClick={() => interactive && onChange?.(i + 1)}
        className={interactive ? "hover:scale-110 transition-transform" : "cursor-default"}
        disabled={!interactive}
      >
        <Star className={`${size} transition-colors ${i < value ? "fill-yellow-400 text-yellow-400" : "text-white/15"}`} />
      </button>
    ))}
  </div>
);

const ProfilePage = () => {
  const { username, shareId } = useParams();
  const { user: currentUser, isLoading: authLoading, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customProfession, setCustomProfession] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "", bio: "", email: "", city: "", pincode: "", phoneNumber: "",
    profession: "", gender: "", age: "", userGoal: "",
    skills: [] as string[],
    socialLinks: [] as { platform: string; url: string }[]
  });
  const [skillInput, setSkillInput] = useState("");
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [canRateUser, setCanRateUser] = useState(false);
  const [ratingEligibilityReason, setRatingEligibilityReason] = useState("");
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [verificationFee, setVerificationFee] = useState(0);
  const [isViewAllRatingsOpen, setIsViewAllRatingsOpen] = useState(false);
  const [allRatings, setAllRatings] = useState<any[]>([]);
  const [imageVersion, setImageVersion] = useState(Date.now());
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverPhotoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCoverPhoto, setIsUploadingCoverPhoto] = useState(false);
  const [localAvatarOverride, setLocalAvatarOverride] = useState<string | null>(null);
  const [localCoverOverride, setLocalCoverOverride] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // Helper to get image URL with cache busting, unless it's a blob preview
  const getImageUrl = (url?: string, type: 'avatar' | 'cover' = 'avatar') => {
    const effectiveUrl = (type === 'avatar' ? localAvatarOverride : localCoverOverride) || url;
    
    if (!effectiveUrl) return "";
    if (effectiveUrl.startsWith('blob:') || effectiveUrl.startsWith('data:')) return effectiveUrl;
    
    let finalUrl = effectiveUrl;
    if (!effectiveUrl.startsWith('http')) {
      const baseApiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
      finalUrl = `${baseApiUrl}${effectiveUrl.startsWith('/') ? '' : '/'}${effectiveUrl}`;
    }
    
    return `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}v=${imageVersion}`;
  };

  const loadUser = async () => {
    setIsLoading(true);
    try {
      if (shareId) {
        const userData = await getUserByShareId(shareId);
        setUser(userData);
        if (userData.avatarUrl) setLocalAvatarOverride(null);
        if (userData.coverPhotoUrl) setLocalCoverOverride(null);
        if (currentUser?.id && userData.id !== currentUser.id) {
          try {
            const eligibility = await getRatingEligibility(userData.id);
            setCanRateUser(eligibility.canRate);
            setRatingEligibilityReason(eligibility.reason || "");
          } catch { setCanRateUser(false); }
        }
      } else if (username) {
        const userData = await getUserByUsername(username);
        setUser(userData);
        if (userData.avatarUrl) setLocalAvatarOverride(null);
        if (userData.coverPhotoUrl) setLocalCoverOverride(null);
        if (currentUser?.id && userData.id !== currentUser.id) {
          try {
            const eligibility = await getRatingEligibility(userData.id);
            setCanRateUser(eligibility.canRate);
            setRatingEligibilityReason(eligibility.reason || "");
          } catch { setCanRateUser(false); }
        }
      } else if (currentUser?.id) {
        const userData = await getUser(currentUser.id);
        setUser(userData);
        if (userData.avatarUrl) setLocalAvatarOverride(null);
        if (userData.coverPhotoUrl) setLocalCoverOverride(null);
        setEditForm({
          displayName: userData.displayName || "",
          bio: userData.bio || "",
          email: userData.email || "",
          city: userData.city || "",
          pincode: userData.pincode || "",
          phoneNumber: userData.phoneNumber || "",
          profession: userData.profession || "",
          gender: userData.gender || "",
          age: userData.age ? userData.age.toString() : "",
          skills: userData.skills || [],
          socialLinks: userData.socialLinks || [],
          userGoal: userData.userGoal || ""
        });

        const currentProf = userData.profession;
        if (currentProf) {
          if (currentProf === "None") setSelectedCategory("none");
          else if (currentProf === "Freelancer") setSelectedCategory("freelancer");
          else if (currentProf === "Student") setSelectedCategory("student");
          else {
            let found = false;
            for (const [cat, subProfs] of Object.entries(SUB_PROFESSIONS)) {
              if (subProfs.includes(currentProf)) {
                setSelectedCategory(cat);
                found = true;
                break;
              }
            }
            if (!found) {
              setSelectedCategory("other");
              setCustomProfession(currentProf);
            }
          }
        }
      } else {
        setError("Please log in to view your profile.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally { setIsLoading(false); }
  };

  const loadVerificationData = async () => {
    try {
      const [status, feeData] = await Promise.all([getVerificationStatus(), getVerificationFee()]);
      setVerificationRequest(status);
      setVerificationFee(feeData.fee);
    } catch { }
  };

  const loadPosts = async () => {
    if (!user) return;
    setIsLoadingPosts(true);
    try {
      const userPosts = await getUserPosts(user.id);
      setPosts(userPosts);
    } catch { } finally {
      setIsLoadingPosts(false);
    }
  };

  const handlePostCreated = (post: Post) => {
    setPosts([post, ...posts]);
  };

  const handlePostDeleted = (postId: number) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  useEffect(() => {
    if (username) {
      loadUser();
    } else if (!authLoading) {
      loadUser();
      if (currentUser) loadVerificationData();
    }
  }, [username, currentUser, authLoading]);

  useEffect(() => {
    if (user) {
      document.title = `${user.displayName || user.username} · Krovaa`;
      loadPosts();
    }
  }, [user]);

  if (authLoading && !username) return <LoadingScreen />;
  if (isLoading && !user) return <LoadingScreen />;
  if (!user || error) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <p className="text-white/40">{error || "User not found"}</p>
      </div>
    );
  }

  const isOwnProfile = !!currentUser && user.id === currentUser.id;
  const profileLink = `${window.location.origin}/s/${user.shareId || user.username}`;

  const handleShare = async () => {
    const shareData = {
      title: `${user?.displayName || user?.username} on Krovaa`,
      text: `Check out ${user?.displayName || user?.username}'s professional profile on Krovaa.`,
      url: profileLink,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          copyLink();
        }
      }
    } else {
      copyLink();
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(profileLink);
    toast({ title: "Copied!", description: "Profile link copied to clipboard." });
  };

  const handleSave = async () => {
    if (!user) return;

    let finalProfession = editForm.profession;
    if (selectedCategory === "none") finalProfession = "None";
    else if (selectedCategory === "freelancer") finalProfession = "Freelancer";
    else if (selectedCategory === "student") finalProfession = "Student";
    else if (selectedCategory === "other") finalProfession = customProfession || "Other";
    else if (editForm.profession === "Other") finalProfession = customProfession || "Other";

    setIsSaving(true);
    try {
      const updated = await updateUserProfile(user.id, {
        ...editForm,
        displayName: editForm.displayName.trim(),
        bio: editForm.bio.trim(),
        email: editForm.email.trim().toLowerCase(),
        city: editForm.city.trim(),
        pincode: editForm.pincode.trim(),
        profession: finalProfession?.trim() || null,
        phoneNumber: editForm.phoneNumber?.trim(),
        gender: editForm.gender,
        age: editForm.age ? parseInt(editForm.age) : null,
        userGoal: editForm.userGoal,
        skills: editForm.skills
      });
      setUser(updated);
      setIsEditing(false);
      await refreshUser();
      toast({ title: "Saved!", description: "Your profile has been updated." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Update failed", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleRateUser = async () => {
    if (!user) return;
    try {
      await rateUser({ reviewedId: user.id, rating, comment: ratingComment.trim() });
      toast({ title: "Rating submitted!", description: `You rated ${user.displayName} ${rating} stars.` });
      setIsRatingDialogOpen(false);
      setRatingComment("");
      loadUser();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", variant: "destructive" }); return; }
    
    setIsUploadingAvatar(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      setLocalAvatarOverride(blobUrl);
      setImageVersion(Date.now());
      
      const response = await uploadAvatar(file);
      const { avatarUrl } = response;
      
      setLocalAvatarOverride(avatarUrl);
      setImageVersion(Date.now());
      
      setUser((prevUser) => prevUser ? { ...prevUser, avatarUrl } : prevUser);
      
      await refreshUser();
      
      toast({ title: "Avatar updated!" });
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Failed to upload avatar", variant: "destructive" });
      try {
        const freshUser = await getUser(user.id);
        setUser(freshUser);
      } catch (e) {
        console.error('Failed to restore user state:', e);
      }
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", variant: "destructive" }); return; }
    
    setIsUploadingCoverPhoto(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      setLocalCoverOverride(blobUrl);
      setImageVersion(Date.now());
      
      const response = await uploadCoverPhoto(file);
      const { coverPhotoUrl } = response;
      
      setLocalCoverOverride(coverPhotoUrl);
      setImageVersion(Date.now());
      
      setUser((prevUser) => prevUser ? { ...prevUser, coverPhotoUrl } : prevUser);
      
      await refreshUser();
      
      toast({ title: "Cover updated!" });
      if (coverPhotoInputRef.current) {
        coverPhotoInputRef.current.value = '';
      }
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Failed to upload cover", variant: "destructive" });
      try {
        const freshUser = await getUser(user.id);
        setUser(freshUser);
      } catch (e) {
        console.error('Failed to restore user state:', e);
      }
      if (coverPhotoInputRef.current) {
        coverPhotoInputRef.current.value = '';
      }
    } finally {
      setIsUploadingCoverPhoto(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user) return;
    try {
      await deleteAvatar();
      setUser({ ...user, avatarUrl: undefined });
      toast({ title: "Profile photo removed." });
    } catch {
      toast({ title: "Failed to remove photo", variant: "destructive" });
    }
  };

  const handleDeleteCoverPhoto = async () => {
    if (!user) return;
    try {
      await deleteCoverPhoto();
      setUser({ ...user, coverPhotoUrl: undefined });
      toast({ title: "Cover photo removed." });
    } catch {
      toast({ title: "Failed to remove cover", variant: "destructive" });
    }
  };

  const addSocialLink = () => setEditForm({ ...editForm, socialLinks: [...editForm.socialLinks, { platform: "twitter", url: "" }] });
  const removeSocialLink = (i: number) => { const s = [...editForm.socialLinks]; s.splice(i, 1); setEditForm({ ...editForm, socialLinks: s }); };
  const updateSocialLink = (i: number, field: "platform" | "url", v: string) => { const s = [...editForm.socialLinks]; s[i] = { ...s[i], [field]: v }; setEditForm({ ...editForm, socialLinks: s }); };

  const openViewAllRatings = async () => {
    setIsViewAllRatingsOpen(true);
    try {
      const res = await fetch(`/api/users/${user.id}/ratings`);
      if (res.ok) {
        const data = await res.json();
        setAllRatings(data.ratings.map((r: any) => ({
          rating: r.rating, comment: r.comment,
          reviewerDisplayName: r.reviewer.displayName || r.reviewer.username,
          reviewerAvatar: r.reviewer.avatarUrl, createdAt: r.createdAt
        })));
      }
    } catch { toast({ title: "Failed to load reviews", variant: "destructive" }); }
  };

  const initials = user.displayName ? user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?";

  const currentAvatarUrl = localAvatarOverride || user.avatarUrl;
  const currentCoverUrl = localCoverOverride || user.coverPhotoUrl;

  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="min-h-screen bg-[#F5F5F5] text-[#1C1C1C]"
    >
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#00A4EF]/5 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: `linear-gradient(to right, #E0E0E0 1px, transparent 1px), linear-gradient(to bottom, #E0E0E0 1px, transparent 1px)`,
          backgroundSize: "64px 64px"
        }} />
      </div>

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-50 border-b border-[#E0E0E0] backdrop-blur-xl bg-white/80">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            to={currentUser ? "/chat" : "/"}
            className="flex items-center gap-2 text-[#1C1C1C]/60 hover:text-[#1C1C1C] transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Link to="/" className="flex items-center">
            <Logo size="sm" />
          </Link>
          <button 
            onClick={handleShare}
            className="flex items-center justify-center p-2 rounded-lg text-[#1C1C1C]/60 hover:text-[#1C1C1C] hover:bg-black/5 transition-all"
            title="Share profile"
          >
            <Share2 className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-24 relative z-10">
        {/* ── Cover Photo ── */}
        <div className="relative h-44 rounded-b-xl overflow-hidden -mx-4 group/cover">
          {currentCoverUrl ? (
            <>
              <img 
                key={`cover-${imageVersion}`}
                src={getImageUrl(user.coverPhotoUrl, 'cover')} 
                alt="Cover" 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(to bottom right, #00A4EF, #005580)` }}>
              <div className="absolute inset-0 opacity-[0.1]" style={{
                backgroundImage: `linear-gradient(to right, #FFFFFF 1px, transparent 1px), linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)`,
                backgroundSize: "32px 32px"
              }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[60px]" style={{ background: `#FFFFFF19` }} />
            </div>
          )}
          {isUploadingCoverPhoto && (
            <div className="absolute inset-0 bg-black/30 rounded-b-xl flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* ── Cover Actions Dropdown (Owner Only) ── */}
        {isOwnProfile && (
          <div className="relative h-0 w-full z-30">
            <div className="absolute -top-12 right-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2.5 rounded-lg border border-[#00A4EF]/30 bg-white/90 backdrop-blur-md hover:bg-white text-[#00A4EF] transition-all shadow-xl">
                    <MoreHorizontal className="h-4.5 w-4.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-[#E0E0E0] text-[#1C1C1C] min-w-[180px] p-1.5 shadow-2xl rounded-lg">
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer py-2.5 rounded-lg focus:bg-[#F5F5F5]">
                    <Edit2 className="h-3.5 w-3.5 mr-2.5 text-[#00A4EF]" /> 
                    <span className="text-xs font-semibold">Edit Details</span>
                  </DropdownMenuItem>
                  
                  <div className="h-px bg-[#E0E0E0] my-1.5" />
                  
                  <DropdownMenuItem 
                    onClick={() => coverPhotoInputRef.current?.click()} 
                    className="focus:bg-[#F5F5F5] cursor-pointer py-2.5 rounded-lg" 
                    disabled={isUploadingCoverPhoto}
                  >
                    <div className={`flex items-center gap-2.5 w-full ${isUploadingCoverPhoto ? 'opacity-50' : ''}`}>
                      {isUploadingCoverPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      <span className="text-xs font-semibold">{isUploadingCoverPhoto ? 'Uploading...' : 'Change Cover'}</span>
                    </div>
                  </DropdownMenuItem>
                  
                  {user.coverPhotoUrl && (
                    <DropdownMenuItem onClick={handleDeleteCoverPhoto} className="focus:bg-red-50/10 text-red-400 cursor-pointer py-2.5 rounded-lg">
                      <div className="flex items-center gap-2.5 w-full text-xs font-semibold">
                        <Trash className="h-3.5 w-3.5" /> Remove Cover
                      </div>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* ── Profile Header Section ── */}
        <div className="relative z-20 px-6 -mt-16 sm:-mt-20 flex flex-col items-center text-center mb-12">
          {/* Avatar */}
          <div className="relative group/avatar mb-8">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white p-1 shadow-2xl overflow-hidden border-4 border-[#F5F5F5] relative">
              {currentAvatarUrl ? (
                <img 
                  key={`avatar-${imageVersion}`}
                  src={getImageUrl(user.avatarUrl, 'avatar')} 
                  alt={user.displayName} 
                  className="w-full h-full object-cover rounded-xl" 
                />
              ) : (
                <div className="w-full h-full bg-[#00A4EF]/10 flex items-center justify-center rounded-xl">
                  <span style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-extrabold text-[#00A4EF]">
                    {initials}
                  </span>
                </div>
              )}
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              )}
            </div>
            {isOwnProfile && (
              <div className="absolute -bottom-2 -right-2 z-30">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2.5 rounded-full bg-[#00A4EF] text-white border-2 border-[#F5F5F5] hover:bg-[#007BB5] transition-all active:scale-95 shadow-lg group-hover:scale-110">
                      <Camera className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="bg-white border-[#E0E0E0] text-[#1C1C1C] min-w-[140px] rounded-lg">
                    <DropdownMenuItem 
                      onClick={() => avatarInputRef.current?.click()} 
                      className="focus:bg-[#F5F5F5] cursor-pointer py-2" 
                      disabled={isUploadingAvatar}
                    >
                      <div className={`flex items-center gap-2 w-full ${isUploadingAvatar ? 'opacity-50' : ''}`}>
                        {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                        <span className="text-xs font-semibold">{isUploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
                      </div>
                    </DropdownMenuItem>
                    {user.avatarUrl && (
                      <DropdownMenuItem onClick={handleDeleteAvatar} className="focus:bg-red-50/10 text-red-400 cursor-pointer py-2">
                        <div className="flex items-center gap-2 w-full text-xs font-semibold">
                          <Trash className="h-3.5 w-3.5" /> Remove Photo
                        </div>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex flex-col items-center gap-3 mb-8 w-full">
            <span className="text-sm font-bold text-[#1C1C1C]/60 tracking-tight">@{user.username}</span>
            
            {user.profession && user.profession !== 'None' && (
              <div className="px-3 py-1.5 rounded-full bg-[#00A4EF]/10 border border-[#00A4EF]/20 text-[9px] font-bold text-[#00A4EF] uppercase tracking-[0.2em] flex items-center gap-2">
                <Briefcase className="h-3 w-3" /> {user.profession}
              </div>
            )}
            
            <div className="flex items-center justify-center gap-5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#1C1C1C]/40">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-black/10"}`} />
                <span>{user.status === "active" ? "Available" : "Away"}</span>
              </div>
              {user.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 opacity-50" />
                  <span>{user.city}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {!isEditing && user.bio && (
            <div className="mb-10 max-w-lg">
              <p className="text-sm text-[#1C1C1C]/60 leading-relaxed font-medium italic">
                "{user.bio}"
              </p>
            </div>
          )}
        </div>

        {/* ── Main Content Section ── */}
        {!isEditing && (
          <div className="space-y-8 mb-12">
            {/* Social Links */}
            {user.socialLinks && user.socialLinks.length > 0 && (
              <div className="px-6 space-y-3">
                <label className="block text-[9px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/40">Connect</label>
                <div className="flex flex-wrap justify-center gap-3">
                  {user.socialLinks.map((link: any, i: number) => (
                    <a
                      key={i}
                      href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F5F5F5] hover:border-[#00A4EF]/30 transition-all active:scale-95 group"
                    >
                      <SocialIcon platform={link.platform} className="h-4 w-4 text-[#1C1C1C]/40 group-hover:text-[#00A4EF] transition-colors" />
                      <span className="text-[11px] font-bold text-[#1C1C1C]/60 group-hover:text-[#1C1C1C] transition-colors capitalize tracking-wide">
                        {link.platform}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="px-6 space-y-3">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full h-14 bg-[#00A4EF] text-white font-bold rounded-lg hover:bg-[#007BB5] transition-all flex items-center justify-center gap-2 shadow-2xl shadow-[#00A4EF]/20 active:scale-[0.98]"
                  >
                    <Edit2 className="h-4 w-4" /> Edit Profile
                  </button>
                  <Link to="/posts" className="w-full block">
                    <button className="w-full h-14 bg-white border-2 border-[#00A4EF] text-[#00A4EF] font-bold rounded-lg hover:bg-[#00A4EF]/5 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                      <Plus className="h-4 w-4" /> Manage Posts
                    </button>
                  </Link>
                </>
              ) : currentUser ? (
                <Link to={`/chat?userId=${user.id}`} className="w-full block">
                  <button className="w-full h-14 bg-[#00A4EF] text-white font-bold rounded-lg hover:bg-[#007BB5] transition-all flex items-center justify-center gap-2 shadow-2xl shadow-[#00A4EF]/20 active:scale-[0.98]">
                    <MessageSquare className="h-5 w-5" /> Message
                  </button>
                </Link>
              ) : (
                <Link to={`/login`} className="w-full block">
                  <button className="w-full h-14 bg-[#00A4EF] text-white font-bold rounded-lg hover:bg-[#007BB5] transition-all flex items-center justify-center gap-2 shadow-2xl shadow-[#00A4EF]/20 active:scale-[0.98]">
                    <MessageSquare className="h-5 w-5" /> Login to message
                  </button>
                </Link>
              )}
            </div>

            {/* Skills Section */}
            {(user.profession || (user.skills && user.skills.length > 0)) && (
              <div className="px-6 space-y-4 pt-6 border-t border-[#E0E0E0]">
                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/40">Expertise & Skills</label>
                <div className="flex flex-wrap justify-center gap-2">
                  {user.profession && user.profession !== 'None' && (
                    <Badge className="bg-[#00A4EF]/10 text-[#00A4EF] border-none text-[9px] px-3 py-1 font-bold tracking-widest uppercase">
                      {user.profession}
                    </Badge>
                  )}
                  {user.skills && user.skills.length > 0 && user.skills.map(skill => (
                    <Badge 
                      key={skill} 
                      className="bg-[#1C1C1C]/5 text-[#1C1C1C]/60 border-none text-[9px] px-3 py-1 font-bold tracking-widest uppercase"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Info Cards (Owner Only) ── */}
        {isOwnProfile && !isEditing && (
          <div className="px-6 sm:px-2 space-y-6 mb-12 pt-6 border-t border-[#E0E0E0]">
            <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/40">Profile Information</label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Personal Details Card */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-white to-[#F9F9F9] border border-[#E0E0E0] hover:shadow-[0_4px_12px_rgba(0,164,239,0.05)] transition-all duration-300 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-4 bg-gradient-to-b from-emerald-500 to-emerald-400 rounded-full" />
                  <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/50">Personal Details</span>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {user.age && (
                      <div>
                        <span className="block text-[8px] text-[#1C1C1C]/40 uppercase tracking-wider font-medium mb-1.5">Age</span>
                        <span className="text-sm font-semibold text-[#1C1C1C]">{user.age}</span>
                        <span className="text-[10px] text-[#1C1C1C]/40"> years</span>
                      </div>
                    )}
                    {user.gender && (
                      <div>
                        <span className="block text-[8px] text-[#1C1C1C]/40 uppercase tracking-wider font-medium mb-1.5">Gender</span>
                        <span className="text-sm font-semibold text-[#1C1C1C]">{user.gender}</span>
                      </div>
                    )}
                  </div>
                  
                  {user.city && (
                    <div className="pt-2 border-t border-[#E0E0E0]/50">
                      <span className="block text-[8px] text-[#1C1C1C]/40 uppercase tracking-wider font-medium mb-2">Location</span>
                      <div className="flex items-center gap-2 text-sm text-[#1C1C1C]">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500/60" />
                        <span className="font-medium">{user.city}</span>
                        {user.pincode && <span className="text-[#1C1C1C]/40 text-xs">({user.pincode})</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Identity & Contact Card */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-white to-[#F9F9F9] border border-[#E0E0E0] hover:shadow-[0_4px_12px_rgba(0,164,239,0.05)] transition-all duration-300 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-4 bg-gradient-to-b from-[#00A4EF] to-[#0088BB] rounded-full" />
                  <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/50">Identity & Contact</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <span className="block text-[8px] text-[#1C1C1C]/40 uppercase tracking-wider font-medium mb-1.5">Username</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#1C1C1C]">@{user.username}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#00A4EF]/10 text-[#00A4EF] font-medium">Verified</span>
                    </div>
                  </div>
                  
                  {user.phoneNumber && (
                    <div className="pt-2 border-t border-[#E0E0E0]/50">
                      <span className="block text-[8px] text-[#1C1C1C]/40 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                        <Phone className="h-2.5 w-2.5" /> Phone
                      </span>
                      <span className="text-sm font-semibold text-[#00A4EF]">{user.phoneNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Form ── */}
        {isEditing && (
          <div className="px-6 sm:px-2 mb-6">
            <div
              className="p-6 rounded-2xl border border-[#E0E0E0] bg-[#FCFCFC] shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-6"
              style={{ animation: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both" }}
            >
              {/* Goal */}
              <div className="group">
                <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-[#1C1C1C]/40 mb-2 ml-0.5">I am here to...</label>
                <select
                  className="w-full bg-transparent border-b-2 border-[#E0E0E0] focus:border-[#00A4EF] outline-none pb-2.5 pt-1 text-sm text-[#1C1C1C] appearance-none cursor-pointer font-medium"
                  value={editForm.userGoal}
                  onChange={(e) => setEditForm({ ...editForm, userGoal: e.target.value })}
                >
                  <option value="" className="bg-white text-[#1C1C1C]/40">Select goal...</option>
                  <option value="OFFER_SERVICE" className="bg-white text-[#1C1C1C]">Offer my services</option>
                  <option value="HIRE_PROFESSIONALS" className="bg-white text-[#1C1C1C]">Hire professionals</option>
                </select>
              </div>

              {/* Basic Info */}
              <div className="space-y-4 pt-4 border-t border-[#E0E0E0]">
                <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/60">Basic Information</h3>
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Display Name" icon={null}
                    placeholder="Your name"
                    value={editForm.displayName}
                    onChange={(e: any) => setEditForm({ ...editForm, displayName: e.target.value })}
                  />
                  <Field label="City" icon={MapPin}
                    placeholder="Mumbai"
                    value={editForm.city}
                    onChange={(e: any) => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <Field label="Pincode" icon={null}
                  placeholder="400001"
                  value={editForm.pincode}
                  onChange={(e: any) => setEditForm({ ...editForm, pincode: e.target.value })}
                />
                <Field label="Phone (private)" icon={Phone}
                  placeholder="+91 98765 43210"
                  value={(editForm as any).phoneNumber}
                  onChange={(e: any) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                />
                <Field label="Bio" icon={null} textarea
                  placeholder="Tell the world what you do..."
                  value={editForm.bio}
                  onChange={(e: any) => setEditForm({ ...editForm, bio: e.target.value })}
                />
              </div>

              {/* Personal Details */}
              <div className="space-y-4 pt-4 border-t border-[#E0E0E0]">
                <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/60">Personal Details</h3>
                <div className="grid grid-cols-2 gap-5">
                  <div className="group">
                    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-[#1C1C1C]/40 mb-2 ml-0.5">Gender</label>
                    <select
                      className="w-full bg-transparent border-b border-[#E0E0E0] focus:border-[#00A4EF] outline-none pb-2.5 pt-1 text-sm text-[#1C1C1C] appearance-none cursor-pointer"
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    >
                      <option value="" className="bg-white text-[#1C1C1C]/40">Select Gender</option>
                      <option value="Male" className="bg-white text-[#1C1C1C]">Male</option>
                      <option value="Female" className="bg-white text-[#1C1C1C]">Female</option>
                      <option value="Other" className="bg-white text-[#1C1C1C]">Other</option>
                    </select>
                  </div>
                  <Field label="Age" icon={null} type="number"
                    placeholder="25"
                    value={editForm.age}
                    onChange={(e: any) => setEditForm({ ...editForm, age: e.target.value })}
                  />
                </div>
              </div>

              {/* Profession Section */}
              <div className="space-y-4 pt-4 border-t border-[#E0E0E0]">
                <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/60">Profession & Expertise</h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setEditForm({ ...editForm, profession: "" });
                        setCustomProfession("");
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all duration-200 text-center",
                        selectedCategory === cat.id
                          ? `${cat.bg} ${cat.border} ring-1 ring-[#00A4EF]/20`
                          : "bg-[#F5F5F5] border-[#E0E0E0] hover:bg-[#EFEFEF]"
                      )}
                    >
                      <div className={cn("p-2 rounded-lg", cat.bg, cat.color)}>
                        <cat.icon className="w-4 h-4" />
                      </div>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider", selectedCategory === cat.id ? "text-[#1C1C1C]" : "text-[#1C1C1C]/40")}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>

                {selectedCategory && SUB_PROFESSIONS[selectedCategory] && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-[9px] font-bold tracking-[0.15em] uppercase text-[#00A4EF]/60 ml-0.5 flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3" /> Select Expertise
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SUB_PROFESSIONS[selectedCategory].map((prof) => (
                        <button
                          key={prof}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, profession: prof })}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border uppercase tracking-wider",
                            editForm.profession === prof
                              ? "bg-[#00A4EF] border-[#00A4EF] text-white shadow-lg shadow-[#00A4EF]/20"
                              : "bg-[#F5F5F5] border-[#E0E0E0] text-[#1C1C1C]/60 hover:border-[#E0E0E0]"
                          )}
                        >
                          {prof}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, profession: "Other" })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border uppercase tracking-wider",
                          editForm.profession === "Other"
                            ? "bg-[#00A4EF] border-[#00A4EF] text-white"
                            : "bg-[#F5F5F5] border-[#E0E0E0] text-[#1C1C1C]/60 hover:border-[#E0E0E0]"
                        )}
                      >
                        Other...
                      </button>
                    </div>
                  </div>
                )}

                {(selectedCategory === "other" || editForm.profession === "Other") && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-[9px] font-bold tracking-[0.15em] uppercase text-[#00A4EF]/60 ml-0.5 flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3" /> Specify Profession
                    </label>
                    <Input
                      value={customProfession}
                      onChange={e => setCustomProfession(e.target.value)}
                      className="bg-[#F5F5F5] border-[#E0E0E0] text-[#1C1C1C] h-10 focus:ring-[#00A4EF]/50 placeholder:text-[#1C1C1C]/20 text-sm"
                      placeholder="E.g. Full Stack Engineer, UX Specialist..."
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Skills */}
              <div className="space-y-3 pt-4 border-t border-[#E0E0E0]">
                <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/60">Skills (Press Enter to add)</h3>
                <Input 
                  placeholder="Coding, Design, Marketing..."
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && skillInput.trim()) {
                      e.preventDefault();
                      if (!editForm.skills.includes(skillInput.trim())) {
                        setEditForm({ ...editForm, skills: [...editForm.skills, skillInput.trim()] });
                      }
                      setSkillInput("");
                    }
                  }}
                  className="bg-[#F5F5F5] border-[#E0E0E0] text-[#1C1C1C] h-10 focus:ring-[#00A4EF]/50"
                />
                <div className="flex flex-wrap gap-2">
                  {editForm.skills.map(skill => (
                    <div 
                      key={skill} 
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00A4EF]/10 border border-[#00A4EF]/20 group/skill animate-in fade-in zoom-in duration-200"
                    >
                      <span className="text-[11px] text-[#00A4EF] font-bold uppercase tracking-wider">{skill}</span>
                      <button 
                        type="button"
                        onClick={() => setEditForm({ ...editForm, skills: editForm.skills.filter(s => s !== skill) })}
                        className="hover:text-red-400 text-[#00A4EF]/50 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-3 pt-4 border-t border-[#E0E0E0]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]/60">Social Links</h3>
                  <button
                    type="button" onClick={addSocialLink}
                    className="flex items-center gap-1.5 text-[11px] text-[#00A4EF] hover:text-[#007BB5] transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add link
                  </button>
                </div>
                <div className="space-y-2">
                  {editForm.socialLinks.map((link, i) => (
                    <div key={i} className="flex gap-2 items-center p-3 rounded-lg border border-[#E0E0E0] bg-[#F5F5F5]">
                      <Select value={link.platform} onValueChange={(v) => updateSocialLink(i, "platform", v)}>
                        <SelectTrigger className="w-28 h-8 bg-white border-[#E0E0E0] text-xs text-[#1C1C1C] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-[#E0E0E0] rounded-lg">
                          {PLATFORMS.map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-[#1C1C1C]/70 text-xs focus:bg-[#F5F5F5] focus:text-[#1C1C1C]">{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input
                        className="flex-1 bg-transparent border-b border-[#E0E0E0] focus:border-[#00A4EF] outline-none text-xs text-[#1C1C1C] placeholder:text-[#1C1C1C]/20 pb-1.5 transition-colors"
                        placeholder="https://..."
                        value={link.url}
                        onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                      />
                      <button onClick={() => removeSocialLink(i)} className="text-[#1C1C1C]/20 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-3 pt-6 border-t border-[#E0E0E0]">
                <button
                  onClick={handleSave} disabled={isSaving}
                  className="flex-1 h-10 bg-[#00A4EF] hover:bg-[#007BB5] disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                >
                  {isSaving ? <><RotateCcw className="h-3.5 w-3.5 animate-spin" /> Saving...</> : <><Save className="h-3.5 w-3.5" /> Save changes</>}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-5 h-10 border border-[#E0E0E0] hover:border-[#1C1C1C]/20 text-[#1C1C1C]/40 hover:text-[#1C1C1C] rounded-lg text-sm transition-all flex items-center gap-2"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Logout Button ── */}
        {!isEditing && isOwnProfile && (
          <div className="mt-4 px-6 sm:px-2">
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="w-full h-11 rounded-lg border border-[#E0E0E0] hover:border-red-500/20 hover:bg-red-500/5 text-[#1C1C1C]/40 hover:text-red-400 text-sm transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-16 pt-8 border-t border-[#E0E0E0] text-center">
          <Link to="/" className="text-[10px] text-[#1C1C1C]/20 hover:text-[#00A4EF] tracking-[0.2em] uppercase font-bold transition-colors">
            krovaa.com
          </Link>
        </div>
      </div>

      {/* ── Rating Dialog ── */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent
          className="border-[#E0E0E0] sm:max-w-sm bg-white rounded-2xl"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00A4EF]/40 to-transparent" />
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif" }} className="text-[#1C1C1C]">
              Rate {user?.displayName?.split(" ")[0]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-3">
              <Stars value={rating} size="h-8 w-8" interactive onChange={setRating} />
              <span className="text-xs text-[#1C1C1C]/40">{["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}</span>
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-[#1C1C1C]/40 mb-2">Your review</label>
              <textarea
                className="w-full bg-[#F5F5F5] border border-[#E0E0E0] focus:border-[#00A4EF]/50 outline-none rounded-lg p-3 text-sm text-[#1C1C1C] placeholder:text-[#1C1C1C]/20 resize-none transition-colors"
                rows={3}
                placeholder="Share your experience..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />
            </div>
            <button
              onClick={handleRateUser}
              disabled={!canRateUser || ratingComment.trim().length === 0}
              className="w-full h-11 bg-[#00A4EF] hover:bg-[#007BB5] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> Submit rating
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View All Ratings Dialog ── */}
      <Dialog open={isViewAllRatingsOpen} onOpenChange={setIsViewAllRatingsOpen}>
        <DialogContent
          className="border-[#E0E0E0] sm:max-w-md max-h-[80vh] overflow-y-auto bg-white rounded-2xl"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00A4EF]/40 to-transparent" />
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif" }} className="text-[#1C1C1C]">
              Reviews for {user?.displayName?.split(" ")[0]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {allRatings.length > 0 ? allRatings.map((r, i) => (
              <div key={i} className="p-4 rounded-lg border border-[#E0E0E0] bg-[#F5F5F5] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#00A4EF]/20 flex items-center justify-center text-[#00A4EF] text-[11px] font-bold">
                      {r.reviewerDisplayName[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-[#1C1C1C]/80">{r.reviewerDisplayName}</span>
                  </div>
                  <Stars value={r.rating} size="h-3.5 w-3.5" />
                </div>
                {r.comment && <p className="text-sm text-[#1C1C1C]/60 leading-relaxed font-light">{r.comment}</p>}
                <p className="text-[10px] text-[#1C1C1C]/40">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )) : (
              <p className="text-center text-[#1C1C1C]/40 py-10 text-sm">No reviews yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden File Inputs */}
      <input 
        ref={avatarInputRef} 
        type="file" 
        className="hidden" 
        accept="image/*" 
        onChange={handleAvatarUpload} 
      />
      <input 
        ref={coverPhotoInputRef} 
        type="file" 
        className="hidden" 
        accept="image/*" 
        onChange={handleCoverPhotoUpload} 
      />

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;