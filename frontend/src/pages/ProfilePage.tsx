import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Share2, MessageSquare, Twitter, Instagram, Linkedin,
  Github, Globe, Plus, Trash2, Star, LogOut, Facebook, Youtube,
  Camera, Save, X, Edit2, MapPin, CheckCircle2, RotateCcw, Trash, Phone,
  Briefcase, Code, Palette, Hammer, GanttChart, Users, GraduationCap, 
  UserCircle, HelpCircle, ChevronRight, MoreHorizontal, Loader2, Calendar, Wallet
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileById, useInvalidateProfile } from "@/hooks/useProfileCache";
import {
  getUser, getUserByUsername, getUserByShareId, updateUserProfile, uploadAvatar,
  rateUser, AuthUser, getVerificationStatus, getVerificationFee, 
  VerificationRequest, getRatingEligibility, uploadCoverPhoto,
  deleteAvatar, deleteCoverPhoto, Post
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { remoteUrl } from "@/lib/config";
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
import PostGrid from "@/components/posts/PostGrid";

/* ── Constants for Profession Selection ── */
const CATEGORIES = [
  { id: "tech", label: "Tech", icon: Code },
  { id: "creative", label: "Creative", icon: Palette },
  { id: "engineering", label: "Engineering", icon: Hammer },
  { id: "professional", label: "Professional", icon: GanttChart },
  { id: "freelancer", label: "Freelancer", icon: Users },
  { id: "student", label: "Student", icon: GraduationCap },
  { id: "none", label: "None", icon: UserCircle },
  { id: "other", label: "Other", icon: HelpCircle },
];

const SUB_PROFESSIONS: Record<string, string[]> = {
  tech: ["Software Developer", "Web Developer", "Data Scientist", "AI / ML Engineer", "Cybersecurity Analyst", "DevOps Engineer", "Mobile App Developer"],
  creative: ["UI/UX Designer", "Graphic Designer", "3D Designer", "2D Designer", "Content Creator", "Video Editor", "Photographer", "Videographer", "Artist / Illustrator", "Musician"],
  engineering: ["Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Architect", "Structural Engineer"],
  professional: ["Product Manager", "Digital Marketer", "Doctor", "Nurse", "Pharmacist", "Lawyer", "Chartered Accountant", "Teacher / Educator", "Consultant"],
};

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

/* ── Upgraded High-Contrast Input Fields ── */
const Field = ({ label, icon: Icon, textarea, className = "", ...props }: any) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-[#1C1C1C]">
      {label}
    </label>
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-3.5 w-4 h-4 text-[#1C1C1C]/40" />}
      {textarea ? (
        <textarea
          className={`w-full bg-white border border-[#1C1C1C]/15 focus:border-[#1C1C1C] focus:ring-1 focus:ring-[#1C1C1C] outline-none rounded-lg ${Icon ? "pl-10" : "px-3.5"} py-3 text-sm text-[#1C1C1C] placeholder:text-[#1C1C1C]/30 transition-all duration-150 shadow-sm resize-none ${className}`}
          rows={3}
          {...props}
        />
      ) : (
        <input
          className={`w-full bg-white border border-[#1C1C1C]/15 focus:border-[#1C1C1C] focus:ring-1 focus:ring-[#1C1C1C] outline-none rounded-lg ${Icon ? "pl-10" : "px-3.5"} h-11 text-sm text-[#1C1C1C] placeholder:text-[#1C1C1C]/30 transition-all duration-150 shadow-sm ${className}`}
          {...props}
        />
      )}
    </div>
  </div>
);

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
        <Star className={`${size} transition-colors ${i < value ? "fill-[#1C1C1C] text-[#1C1C1C]" : "text-[#1C1C1C]/15"}`} />
      </button>
    ))}
  </div>
);

const ProfilePage = () => {
  const { username, shareId } = useParams();
  const { user: currentUser, isLoading: authLoading, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const invalidateProfile = useInvalidateProfile();
  
  const { data: profileFullData, refetch: refetchProfile } = useProfileById(
    !username && !shareId && currentUser?.id ? currentUser.id : null
  );
  
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
  const hasFetchedVerification = useRef(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCoverPhoto, setIsUploadingCoverPhoto] = useState(false);
  const [localAvatarOverride, setLocalAvatarOverride] = useState<string | null>(null);
  const [localCoverOverride, setLocalCoverOverride] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  const getImageUrl = (url?: string, type: 'avatar' | 'cover' = 'avatar') => {
    const effectiveUrl = (type === 'avatar' ? localAvatarOverride : localCoverOverride) || url;
    if (!effectiveUrl) return "";
    if (effectiveUrl.startsWith('blob:') || effectiveUrl.startsWith('data:')) return effectiveUrl;
    const finalUrl = remoteUrl(effectiveUrl);
    return `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}v=${imageVersion}`;
  };

  const loadUser = async () => {
    if (!shareId && !username && currentUser?.id) {
      // Current user profile is managed by React Query hook (profileFullData)
      setError("");
      return;
    }

    setIsLoading(true);
    setError("");
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
      } else {
        setError("Please log in to view your profile.");
      }
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profileFullData && !username && !shareId) {
      const userData = profileFullData.user;
      setUser(userData);
      setPosts(profileFullData.posts);
      setCanRateUser(profileFullData.ratingEligibility.canRate);
      setRatingEligibilityReason(profileFullData.ratingEligibility.reason || "");
      
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
      setIsLoading(false);
    }
  }, [profileFullData, username, shareId]);

  const loadVerificationData = async () => {
    try {
      const [status, feeData] = await Promise.all([getVerificationStatus(), getVerificationFee()]);
      setVerificationRequest(status);
      setVerificationFee(feeData.fee);
    } catch { }
  };

  const handlePostDeleted = (postId: number) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  useEffect(() => {
    if (username) {
      loadUser();
    } else if (!authLoading) {
      loadUser();
      // Only load verification data once per mount, not on every re-render
      if (currentUser && !hasFetchedVerification.current) {
        hasFetchedVerification.current = true;
        loadVerificationData();
      }
    }
  }, [username, currentUser, authLoading]);

  useEffect(() => {
    if (user && document.title) {
      document.title = `${user.displayName || user.username} · Krovaa`;
    }
  }, [user]);

  if (!user || error) {
    if (isLoading || authLoading) {
      // Skeleton profile — renders instantly, no waiting!
      return (
        <div className="min-h-screen bg-[#F5F5F5] animate-pulse">
          <div className="sticky top-0 z-50 border-b border-[#E0E0E0] bg-white/80 h-14" />
          <div className="max-w-xl mx-auto px-5 pb-20 pt-4">
            <div className="h-48 rounded-xl bg-gray-200" />
            <div className="flex flex-col items-center -mt-14 pt-4 gap-3">
              <div className="w-24 h-24 rounded-xl bg-gray-300 border-4 border-white" />
              <div className="h-5 w-40 bg-gray-300 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-8 w-28 bg-gray-200 rounded-lg" />
            </div>
            <div className="mt-8 space-y-3">
              <div className="h-11 bg-gray-200 rounded-lg w-full" />
              <div className="h-11 bg-gray-200 rounded-lg w-full" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-[#1C1C1C]/40 font-medium">{error || "User not found"}</p>
      </div>
    );
  }

  const isOwnProfile = !!currentUser && user.id === currentUser.id;
  const profileLink = `${window.location.origin}/s/${user.shareId || user.username}`;

  const handleShare = async () => {
    const shareData = {
      title: `${user?.displayName || user?.username} on Krovaa`,
      text: `Check out ${user?.displayName || user?.username}'s profile.`,
      url: profileLink,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) { if ((err as Error).name !== 'AbortError') copyLink(); }
    } else { copyLink(); }
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
    else if (selectedCategory === "other" || editForm.profession === "Other") finalProfession = customProfession || "Other";

    const trimmedPincode = editForm.pincode.trim();
    if (trimmedPincode && !/^\d{6}$/.test(trimmedPincode)) {
      toast({ title: "Validation Error", description: "Pincode must be exactly 6 digits.", variant: "destructive" });
      return;
    }

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
      invalidateProfile(user.id);
      await refreshUser();
      toast({ title: "Saved!", description: "Your profile has been updated." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Update failed", variant: "destructive" });
    } finally { setIsSaving(true); }
  };

  const handleRateUser = async () => {
    if (!user) return;
    try {
      await rateUser({ reviewedId: user.id, rating, comment: ratingComment.trim() });
      toast({ title: "Rating submitted!" });
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
    setIsUploadingAvatar(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      setLocalAvatarOverride(blobUrl);
      setImageVersion(Date.now());
      const response = await uploadAvatar(file);
      setLocalAvatarOverride(response.avatarUrl);
      setUser((prev) => prev ? { ...prev, avatarUrl: response.avatarUrl } : prev);
      invalidateProfile(user.id);
      await refreshUser();
      toast({ title: "Avatar updated!" });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally { setIsUploadingAvatar(false); }
  };

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploadingCoverPhoto(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      setLocalCoverOverride(blobUrl);
      setImageVersion(Date.now());
      const response = await uploadCoverPhoto(file);
      setLocalCoverOverride(response.coverPhotoUrl);
      setUser((prev) => prev ? { ...prev, coverPhotoUrl: response.coverPhotoUrl } : prev);
      invalidateProfile(user.id);
      await refreshUser();
      toast({ title: "Cover updated!" });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally { setIsUploadingCoverPhoto(false); }
  };

  const handleDeleteAvatar = async () => {
    if (!user) return;
    try {
      await deleteAvatar();
      setUser({ ...user, avatarUrl: undefined });
      toast({ title: "Profile photo removed." });
    } catch { toast({ title: "Failed to remove photo", variant: "destructive" }); }
  };

  const handleDeleteCoverPhoto = async () => {
    if (!user) return;
    try {
      await deleteCoverPhoto();
      setUser({ ...user, coverPhotoUrl: undefined });
      toast({ title: "Cover photo removed." });
    } catch { toast({ title: "Failed to remove cover", variant: "destructive" }); }
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
    <div className="min-h-screen bg-[#F5F5F5] text-[#1C1C1C] selection:bg-[#00A4EF] selection:text-white antialiased font-sans relative">
      
      {/* Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#00A4EF]/5 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(to right, #1C1C1C 1px, transparent 1px), linear-gradient(to bottom, #1C1C1C 1px, transparent 1px)`,
          backgroundSize: "64px 64px"
        }} />
      </div>

      {/* ── Structural Top Bar ── */}
      <div className="sticky top-0 z-50 border-b border-[#E0E0E0] bg-white/80 backdrop-blur-xl relative">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link
            to={currentUser ? "/chat" : "/"}
            className="flex items-center gap-2 text-[#1C1C1C]/60 hover:text-[#1C1C1C] transition-colors text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Link to="/" className="flex items-center">
            <Logo size="sm" theme="dark" />
          </Link>
          <button 
            onClick={handleShare}
            className="p-2 text-[#1C1C1C]/60 hover:text-[#1C1C1C] rounded-md transition-colors"
            title="Share profile"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 pb-20 pt-4 relative z-10">
        
        {/* ── High Contrast Canvas Cover Photo ── */}
        <div className="relative h-48 rounded-xl overflow-hidden border border-[#E0E0E0] bg-[#1C1C1C] group/cover">
          {currentCoverUrl ? (
            <img 
              key={`cover-${imageVersion}`}
              src={getImageUrl(user.coverPhotoUrl, 'cover')} 
              alt="Cover Canvas" 
              className="w-full h-full object-cover grayscale-[20%] contrast-[105%]" 
            />
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
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="h-6 w-6 text-[#00A4EF] animate-spin" />
            </div>
          )}
        </div>

        {/* ── Contextual Cover Actions Menu ── */}
        {isOwnProfile && (
          <div className="relative h-0 w-full z-30">
            <div className="absolute -top-11 right-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-lg border border-[#00A4EF]/30 bg-white shadow-sm hover:bg-[#F9F9F9] text-[#00A4EF] transition-all">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-[#E0E0E0] text-[#1C1C1C] min-w-[160px] p-1 shadow-md rounded-lg">
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer py-2 rounded-md focus:bg-[#F5F5F5] font-medium text-xs">
                    <Edit2 className="h-3.5 w-3.5 mr-2 text-[#00A4EF]" /> 
                    Edit Profile
                  </DropdownMenuItem>
                  <div className="h-px bg-[#E0E0E0] my-1" />
                  <DropdownMenuItem onClick={() => coverPhotoInputRef.current?.click()} className="focus:bg-[#F5F5F5] cursor-pointer py-2 rounded-md text-xs" disabled={isUploadingCoverPhoto}>
                    <Camera className="h-3.5 w-3.5 mr-2 text-[#00A4EF]" /> Change Cover
                  </DropdownMenuItem>
                  {user.coverPhotoUrl && (
                    <DropdownMenuItem onClick={handleDeleteCoverPhoto} className="focus:bg-red-50 text-red-600 cursor-pointer py-2 rounded-md text-xs">
                      <Trash className="h-3.5 w-3.5 mr-2" /> Remove Cover
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* ── Core Profile Identity Header ── */}
        <div className="relative z-20 px-4 -mt-14 flex flex-col items-center text-center">
          <div className="relative group/avatar mb-4">
            <div className="w-24 h-24 rounded-xl bg-white p-1 shadow-md border border-[#E0E0E0] overflow-hidden relative">
              {currentAvatarUrl ? (
                <img 
                  key={`avatar-${imageVersion}`}
                  src={getImageUrl(user.avatarUrl, 'avatar')} 
                  alt={user.displayName} 
                  className="w-full h-full object-cover rounded-lg" 
                />
              ) : (
                <div className="w-full h-full bg-[#00A4EF]/10 flex items-center justify-center rounded-lg">
                  <span className="text-2xl font-black text-[#00A4EF] tracking-tight">
                    {initials}
                  </span>
                </div>
              )}
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 text-[#00A4EF] animate-spin" />
                </div>
              )}
            </div>
            {isOwnProfile && (
              <div className="absolute -bottom-1.5 -right-1.5 z-30">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 rounded-lg bg-[#00A4EF] text-white border-2 border-white hover:bg-[#007BB5] transition-all shadow-md">
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="bg-white border-[#E0E0E0] text-[#1C1C1C] rounded-lg p-1 shadow-sm">
                    <DropdownMenuItem onClick={() => avatarInputRef.current?.click()} className="focus:bg-[#F5F5F5] cursor-pointer py-2 text-xs rounded-md" disabled={isUploadingAvatar}>
                      <Camera className="h-3.5 w-3.5 mr-2 text-[#00A4EF]" /> Upload Photo
                    </DropdownMenuItem>
                    {user.avatarUrl && (
                      <DropdownMenuItem onClick={handleDeleteAvatar} className="focus:bg-red-50 text-red-600 cursor-pointer py-2 text-xs rounded-md">
                        <Trash className="h-3.5 w-3.5 mr-2" /> Remove Photo
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          <div className="space-y-1.5 max-w-md w-full">
            <h1 className="text-xl font-black text-[#1C1C1C] tracking-tight">
              {user.displayName || user.username}
            </h1>
            <p className="text-xs font-bold text-[#1C1C1C]/50 tracking-normal">@{user.username}</p>
            
            {user.profession && user.profession !== 'None' && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#00A4EF]/10 border border-[#00A4EF]/20 text-[10px] font-bold text-[#00A4EF] uppercase tracking-wider">
                <Briefcase className="h-3 w-3 text-[#00A4EF]/70" /> {user.profession}
              </div>
            )}

            {user.averageRating !== undefined && (
              <div className="flex items-center justify-center pt-1">
                <button 
                  onClick={openViewAllRatings}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#E0E0E0] hover:border-[#00A4EF] transition-all text-xs font-bold text-[#00A4EF]"
                >
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span>{Number(user.averageRating) > 0 ? Number(user.averageRating).toFixed(1) : "0.0"}</span>
                  <span className="text-[#1C1C1C]/40 font-semibold">({user.ratingCount || 0})</span>
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-wider text-[#1C1C1C]/50 pt-2">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${user.status === "active" ? "bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]" : "bg-[#1C1C1C]/20"}`} />
                <span>{user.status === "active" ? "Available" : "Away"}</span>
              </div>
              {user.city && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#1C1C1C]/40" />
                  <span>{user.city}</span>
                </div>
              )}
            </div>
          </div>

          {!isEditing && user.bio && (
            <p className="mt-5 text-sm text-[#1C1C1C]/70 max-w-md font-medium leading-relaxed">
              {user.bio}
            </p>
          )}
        </div>

        <hr className="my-6 border-[#E0E0E0]" />

        {/* ── Main Operations Section ── */}
        {!isEditing && (
          <div className="space-y-6">
            
            {/* Action Callouts */}
            <div className="space-y-2.5">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full h-11 bg-[#00A4EF] text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-[#007BB5] transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit Profile
                  </button>
                  <Link to="/posts" className="w-full block">
                    <button className="w-full h-11 bg-white border border-[#00A4EF] text-[#00A4EF] hover:bg-[#00A4EF]/5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2">
                      <Plus className="h-3.5 w-3.5" /> Manage Posts
                    </button>
                  </Link>
                </>
              ) : currentUser ? (
                <>
                  <Link to={`/chat?userId=${user.id}`} className="w-full block">
                    <button className="w-full h-11 bg-[#00A4EF] text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-[#007BB5] transition-all flex items-center justify-center gap-2 shadow-sm">
                      <MessageSquare className="h-4 w-4" /> Message
                    </button>
                  </Link>
                  {canRateUser ? (
                    <button
                      onClick={() => setIsRatingDialogOpen(true)}
                      className="w-full h-11 bg-white border border-yellow-400 text-yellow-600 hover:bg-yellow-400/5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> Write a Review
                    </button>
                  ) : (
                    ratingEligibilityReason && (
                      <div className="w-full text-center text-[10px] text-[#1C1C1C]/40 font-semibold uppercase tracking-wider bg-white border border-[#E0E0E0] rounded-lg py-3 px-4 shadow-sm">
                        {ratingEligibilityReason}
                      </div>
                    )
                  )}
                </>
              ) : (
                <Link to={`/login`} className="w-full block">
                  <button className="w-full h-11 bg-[#00A4EF] text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-[#007BB5] transition-all flex items-center justify-center gap-2 shadow-sm">
                    <MessageSquare className="h-4 w-4" /> Log in to Message
                  </button>
                </Link>
              )}
            </div>

            {/* Skills & Expertise */}
            {(user.profession || (user.skills && user.skills.length > 0)) && (
              <div className="space-y-2.5 pt-2">
                <span className="block text-[10px] font-bold tracking-wider uppercase text-[#1C1C1C]/40">Skills & Expertise</span>
                <div className="flex flex-wrap gap-1.5">
                  {user.skills && user.skills.length > 0 ? user.skills.map(skill => (
                    <Badge 
                      key={skill} 
                      className="bg-white text-[#1C1C1C] border border-[#E0E0E0] text-[10px] px-2.5 py-1 font-bold tracking-normal uppercase rounded"
                    >
                      {skill}
                    </Badge>
                  )) : <span className="text-xs text-[#1C1C1C]/40 font-medium">No skills listed yet.</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Profile Details Dashboard (Owner Only) ── */}
        {isOwnProfile && !isEditing && (
          <div className="mt-8 pt-6 border-t border-[#E0E0E0] space-y-4">
            <span className="block text-[10px] font-bold tracking-wider uppercase text-[#1C1C1C]/40">Profile Information</span>
            
            <div className="grid grid-cols-1 gap-3">
              {/* Personal Information */}
              <div className="p-4 rounded-xl border border-[#E0E0E0] bg-white space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-[#00A4EF]" />
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#1C1C1C]">Contact & Details</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
                  <div>
                    <span className="block text-[9px] text-[#1C1C1C]/50 font-bold uppercase tracking-wider mb-0.5">Email</span>
                    <span className="font-bold text-[#1C1C1C] break-all">{user.email || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-[#1C1C1C]/50 font-bold uppercase tracking-wider mb-0.5">Phone</span>
                    <span className="font-bold text-[#1C1C1C]">{user.phoneNumber || "—"}</span>
                  </div>
                  {user.age && (
                    <div>
                      <span className="block text-[9px] text-[#1C1C1C]/50 font-bold uppercase tracking-wider mb-0.5">Age</span>
                      <span className="font-bold text-[#1C1C1C]">{user.age} Years</span>
                    </div>
                  )}
                  {user.gender && (
                    <div>
                      <span className="block text-[9px] text-[#1C1C1C]/50 font-bold uppercase tracking-wider mb-0.5">Gender</span>
                      <span className="font-bold text-[#1C1C1C]">{user.gender}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Status Frame */}
              <div className="p-4 rounded-xl border border-[#E0E0E0] bg-white space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#00A4EF]" />
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#1C1C1C]">Account Balance</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
                  <div>
                    <span className="block text-[9px] text-[#1C1C1C]/50 font-bold uppercase tracking-wider mb-0.5">Wallet Balance</span>
                    <span className="text-base font-black text-emerald-600">₹{user.walletBalance?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-[#1C1C1C]/50 font-bold uppercase tracking-wider mb-0.5">Member Since</span>
                    <span className="font-semibold text-[#1C1C1C] flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-[#1C1C1C]/40" />
                      {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Profile Form ── */}
        {isEditing && (
          <div className="mt-4">
            <div className="p-5 rounded-xl border border-[#E0E0E0] bg-white space-y-5 shadow-md">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[#1C1C1C]">I am here to...</label>
                <select
                  className="w-full bg-white border border-[#E0E0E0] focus:border-[#00A4EF] focus:ring-1 focus:ring-[#00A4EF] outline-none h-11 px-3 text-sm text-[#1C1C1C] rounded-lg font-medium shadow-sm appearance-none cursor-pointer"
                  value={editForm.userGoal}
                  onChange={(e) => setEditForm({ ...editForm, userGoal: e.target.value })}
                >
                  <option value="">Select Goal...</option>
                  <option value="OFFER_SERVICE">Offer my services</option>
                  <option value="HIRE_PROFESSIONALS">Hire professionals</option>
                </select>
              </div>

              <div className="space-y-4 pt-2">
                <span className="block text-[10px] font-black tracking-wider uppercase text-[#1C1C1C]/50">Basic Information</span>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Display Name" placeholder="Your display name" value={editForm.displayName} onChange={(e: any) => setEditForm({ ...editForm, displayName: e.target.value })} />
                  <Field label="City" placeholder="E.g. Bangalore" value={editForm.city} onChange={(e: any) => setEditForm({ ...editForm, city: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Pincode" placeholder="6 digits" maxLength={6} value={editForm.pincode} onChange={(e: any) => setEditForm({ ...editForm, pincode: e.target.value.replace(/\D/g, '') })} />
                  <Field label="Phone Number" placeholder="Include country code" value={editForm.phoneNumber} onChange={(e: any) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
                </div>
                <Field label="Bio" textarea placeholder="Tell us about yourself and what you do..." value={editForm.bio} onChange={(e: any) => setEditForm({ ...editForm, bio: e.target.value })} />
              </div>

              <div className="space-y-4 pt-2">
                <span className="block text-[10px] font-black tracking-wider uppercase text-[#1C1C1C]/50">Personal Details</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-wider uppercase text-[#1C1C1C]">Gender</label>
                    <select
                      className="w-full bg-white border border-[#E0E0E0] focus:border-[#00A4EF] focus:ring-1 focus:ring-[#00A4EF] h-11 px-3 text-sm rounded-lg"
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <Field label="Age" type="number" placeholder="Years" value={editForm.age} onChange={(e: any) => setEditForm({ ...editForm, age: e.target.value })} />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <span className="block text-[10px] font-black tracking-wider uppercase text-[#1C1C1C]/50">Profession & Expertise</span>
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
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border text-center transition-all ${
                        selectedCategory === cat.id ? "bg-[#00A4EF] text-white border-[#00A4EF]" : "bg-white border-[#E0E0E0] text-[#1C1C1C] hover:bg-[#F9F9F9]"
                      }`}
                    >
                      <cat.icon className="w-4 h-4" />
                      <span className="text-[9px] font-bold uppercase tracking-tight truncate w-full">{cat.label}</span>
                    </button>
                  ))}
                </div>

                {selectedCategory && SUB_PROFESSIONS[selectedCategory] && (
                  <div className="space-y-2.5 pt-2">
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[#1C1C1C]/60 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" /> Select Expertise
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {SUB_PROFESSIONS[selectedCategory].map((prof) => (
                        <button
                          key={prof}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, profession: prof })}
                          className={`px-3 py-1.5 rounded-md text-[11px] font-bold border transition-all ${
                            editForm.profession === prof ? "bg-[#00A4EF] border-[#00A4EF] text-white" : "bg-white border-[#E0E0E0] text-[#1C1C1C] hover:bg-[#F9F9F9]"
                          }`}
                        >
                          {prof}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, profession: "Other" })}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold border ${editForm.profession === "Other" ? "bg-[#00A4EF] text-white border-[#00A4EF]" : "bg-white border-[#E0E0E0] text-[#1C1C1C]"}`}
                      >
                        Other...
                      </button>
                    </div>
                  </div>
                )}

                {(selectedCategory === "other" || editForm.profession === "Other") && (
                  <div className="space-y-2">
                    <Input
                      value={customProfession}
                      onChange={e => setCustomProfession(e.target.value)}
                      className="border-[#E0E0E0] focus-visible:ring-[#00A4EF] rounded-lg text-sm h-11 bg-white"
                      placeholder="Specify your profession..."
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[#1C1C1C]">Skills (Press Enter to add)</label>
                <Input 
                  placeholder="E.g. Web Development, UI/UX, Copywriting"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && skillInput.trim()) {
                      e.preventDefault();
                      if (!editForm.skills.includes(skillInput.trim())) setEditForm({ ...editForm, skills: [...editForm.skills, skillInput.trim()] });
                      setSkillInput("");
                    }
                  }}
                  className="border-[#E0E0E0] focus-visible:ring-[#00A4EF] h-11 bg-white"
                />
                <div className="flex flex-wrap gap-1.5">
                  {editForm.skills.map(skill => (
                    <div key={skill} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#00A4EF] bg-[#00A4EF]/5 text-xs font-bold text-[#00A4EF] uppercase">
                      <span>{skill}</span>
                      <button type="button" onClick={() => setEditForm({ ...editForm, skills: editForm.skills.filter(s => s !== skill) })} className="text-[#00A4EF] hover:text-red-500 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSave} disabled={isSaving}
                  className="flex-1 h-11 bg-[#00A4EF] hover:bg-[#007BB5] disabled:opacity-40 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 h-11 border border-[#E0E0E0] hover:bg-[#F9F9F9] text-[#1C1C1C]/60 text-xs font-bold uppercase tracking-wider rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Proof of Work ── */}
        {!isEditing && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black tracking-widest uppercase text-[#1C1C1C]">
                  Proof of Work
                </span>
                {posts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-[#00A4EF] text-white text-[10px] font-black">
                    {posts.length}
                  </span>
                )}
              </div>
              {isOwnProfile && (
                <Link to="/posts" className="text-xs font-bold text-[#00A4EF] underline underline-offset-4">
                  Manage Posts →
                </Link>
              )}
            </div>

            <PostGrid
              posts={posts}
              isLoading={isLoadingPosts}
              isOwnProfile={isOwnProfile}
              onPostDeleted={handlePostDeleted}
            />

            {!isLoadingPosts && posts.length === 0 && isOwnProfile && (
              <Link to="/posts">
                <div className="py-12 text-center rounded-xl border border-dashed border-[#00A4EF]/30 bg-[#00A4EF]/5 hover:bg-white hover:border-[#00A4EF] transition-all cursor-pointer">
                  <p className="text-[#00A4EF]/70 text-xs font-medium mb-1.5">No proof of work uploaded yet.</p>
                  <p className="text-[#00A4EF] text-xs font-bold underline uppercase tracking-wider">+ Add Proof of Work</p>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* ── Logout Button ── */}
        {!isEditing && isOwnProfile && (
          <div className="mt-12">
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="w-full h-11 rounded-lg border border-red-200 bg-red-50/30 hover:bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-16 pt-6 border-t border-[#E0E0E0] text-center">
          <Link to="/" className="text-[10px] text-[#1C1C1C]/30 hover:text-[#00A4EF] tracking-[0.25em] uppercase font-bold transition-colors">
            krovaa.com
          </Link>
        </div>
      </div>

      {/* ── Rating Modals ── */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent className="border-[#E0E0E0] bg-white rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider text-[#1C1C1C]">
              Leave a Review
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="flex flex-col items-center gap-2">
              <Stars value={rating} size="h-7 w-7" interactive onChange={setRating} />
              <span className="text-[10px] font-black uppercase tracking-wider text-[#1C1C1C]/50">{["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}</span>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[#1C1C1C]">Your Review</label>
              <textarea
                className="w-full bg-[#F9F9F9] border border-[#E0E0E0] focus:border-[#00A4EF]/50 text-sm text-[#1C1C1C] p-3 rounded-lg resize-none outline-none"
                rows={3}
                placeholder="Share your experience..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />
            </div>
            <button
              onClick={handleRateUser}
              disabled={!canRateUser || ratingComment.trim().length === 0}
              className="w-full h-11 bg-[#00A4EF] hover:bg-[#007BB5] disabled:opacity-20 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            >
              Submit Review
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewAllRatingsOpen} onOpenChange={setIsViewAllRatingsOpen}>
        <DialogContent className="border-[#E0E0E0] max-w-md max-h-[75vh] overflow-y-auto bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider text-[#1C1C1C]">
              Client & Peer Reviews
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            {allRatings.length > 0 ? allRatings.map((r, i) => (
              <div key={i} className="p-4 rounded-lg border border-[#E0E0E0] bg-[#F9F9F9] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1C1C1C]">@{r.reviewerDisplayName}</span>
                  <Stars value={r.rating} size="h-3.5 w-3.5" />
                </div>
                {r.comment && <p className="text-sm text-[#1C1C1C]/80 font-normal leading-relaxed">"{r.comment}"</p>}
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#1C1C1C]/40">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )) : (
              <p className="text-center text-[#1C1C1C]/40 py-8 text-xs font-medium">No reviews yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden Upload Gates */}
      <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
      <input ref={coverPhotoInputRef} type="file" className="hidden" accept="image/*" onChange={handleCoverPhotoUpload} />
    </div>
  );
};

export default ProfilePage;