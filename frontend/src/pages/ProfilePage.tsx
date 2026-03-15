import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
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
  getUser, getUserByUsername, updateUserProfile, uploadAvatar,
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
    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2 ml-0.5">{label}</label>
    <div className="relative">
      {Icon && <Icon className="absolute left-0 top-3 w-3.5 h-3.5 text-white/20 group-focus-within:text-blue-400 transition-colors duration-200" />}
      {textarea ? (
        <textarea
          className={`w-full bg-transparent border-0 border-b border-white/10 focus:border-blue-500/60 outline-none ${Icon ? "pl-6" : ""} pb-2.5 pt-1 text-sm text-white placeholder:text-white/15 transition-colors duration-200 resize-none ${className}`}
          rows={3}
          {...props}
        />
      ) : (
        <input
          className={`w-full bg-transparent border-0 border-b border-white/10 focus:border-blue-500/60 outline-none ${Icon ? "pl-6" : ""} pb-2.5 pt-1 text-sm text-white placeholder:text-white/15 transition-colors duration-200 ${className}`}
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
  const { username } = useParams();
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

  // Helper to get image URL with cache busting, unless it's a blob preview
  // Helper to get image URL with cache busting, unless it's a blob preview
  const getImageUrl = (url?: string, type: 'avatar' | 'cover' = 'avatar') => {
    // Priority: Local override (blob or server-confirmed URL) > user object URL
    const effectiveUrl = (type === 'avatar' ? localAvatarOverride : localCoverOverride) || url;
    
    if (!effectiveUrl) return "";
    if (effectiveUrl.startsWith('blob:') || effectiveUrl.startsWith('data:')) return effectiveUrl;
    
    // If it's a relative path, prepend API_URL (using standard http/https check)
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
      if (username) {
        const userData = await getUserByUsername(username);
        setUser(userData);
        // Clear overrides if server now has the data
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
        // Clear overrides if server now has the data
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

        // Try to match current profession to a category
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
        // Not logged in and no username in URL — shouldn't happen but handle gracefully
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

  useEffect(() => {
    // For public profiles (username param set), load immediately without waiting for auth
    // For own profile view (/profile), wait for auth to know who is logged in
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
    }
  }, [user]);

  // Don't wait for authLoading if we have a username (public profile — auth is optional)
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
  const profileLink = `${window.location.origin}/${user.username}`;

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
      // Refresh global auth context to update other UI parts like navbars
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
    console.log('Avatar upload started', { file: file?.name, size: file?.size, type: file?.type });
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", variant: "destructive" }); return; }
    
    setIsUploadingAvatar(true);
    try {
      // Create immediate preview using functional override
      const blobUrl = URL.createObjectURL(file);
      setLocalAvatarOverride(blobUrl);
      setImageVersion(Date.now());
      
      // Upload to server
      const response = await uploadAvatar(file);
      const { avatarUrl } = response;
      
      // Confirm the server URL locally
      setLocalAvatarOverride(avatarUrl);
      setImageVersion(Date.now());
      
      setUser((prevUser) => prevUser ? { ...prevUser, avatarUrl } : prevUser);
      
      // Update global user state
      await refreshUser();
      console.log('User refreshed from context');
      
      toast({ title: "Avatar updated!" });
      // Clear the input so the same file can be uploaded again
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Failed to upload avatar", variant: "destructive" });
      // Re-fetch user data to restore correct avatar on error
      try {
        const freshUser = await getUser(user.id);
        console.log('Fetched fresh user after error:', freshUser);
        setUser(freshUser);
      } catch (e) {
        console.error('Failed to restore user state:', e);
      }
      // Clear input on error too
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('Cover photo upload started', { file: file?.name, size: file?.size, type: file?.type });
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", variant: "destructive" }); return; }
    
    setIsUploadingCoverPhoto(true);
    try {
      // Create immediate preview
      const blobUrl = URL.createObjectURL(file);
      setLocalCoverOverride(blobUrl);
      setImageVersion(Date.now());
      
      // Upload to server
      const response = await uploadCoverPhoto(file);
      const { coverPhotoUrl } = response;
      
      // Confirm server URL
      setLocalCoverOverride(coverPhotoUrl);
      setImageVersion(Date.now());
      
      setUser((prevUser) => prevUser ? { ...prevUser, coverPhotoUrl } : prevUser);
      
      // Update global user state
      await refreshUser();
      console.log('User refreshed from context');
      
      toast({ title: "Cover updated!" });
      // Clear the input so the same file can be uploaded again
      if (coverPhotoInputRef.current) {
        coverPhotoInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Cover photo upload error:', err);
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Failed to upload cover", variant: "destructive" });
      // Re-fetch user data to restore correct cover on error
      try {
        const freshUser = await getUser(user.id);
        console.log('Fetched fresh user after error:', freshUser);
        setUser(freshUser);
      } catch (e) {
        console.error('Failed to restore user state:', e);
      }
      // Clear input on error too
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

  console.log('Rendering for:', user.username, 'Auth ID:', currentUser?.id, 'Display User ID:', user.id, 'Avatar:', user.avatarUrl, 'Override:', localAvatarOverride);

  const currentAvatarUrl = localAvatarOverride || user.avatarUrl;
  const currentCoverUrl = localCoverOverride || user.coverPhotoUrl;

  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="min-h-screen bg-[#050810] text-white"
    >
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-blue-700/8 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: "linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)",
          backgroundSize: "64px 64px"
        }} />
      </div>

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#050810]/80">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            to={currentUser ? "/chat" : "/"}
            className="flex items-center gap-2 text-white/30 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Link to="/" style={{ fontFamily: "'Outfit', sans-serif" }} className="text-base font-bold text-white/60 hover:text-white transition-colors">
            Krovaa
          </Link>
          <button 
            onClick={copyLink}
            className="flex items-center justify-center p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all"
            title="Share profile"
          >
            <Share2 className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-24 relative z-10">
        {/* ── Cover ── */}
        <div className="relative h-44 rounded-b-3xl overflow-hidden -mx-4 group/cover">
          {currentCoverUrl ? (
            <>
              <img 
                key={`cover-${imageVersion}`}
                src={getImageUrl(user.coverPhotoUrl, 'cover')} 
                alt="Cover" 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-900/40 via-[#050810] to-[#070d1f]">
              <div className="absolute inset-0 opacity-[0.06]" style={{
                backgroundImage: "linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)",
                backgroundSize: "32px 32px"
              }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-blue-600/10 blur-[60px]" />
            </div>
          )}
          {isUploadingCoverPhoto && (
            <div className="absolute inset-0 bg-black/50 rounded-b-3xl flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Secondary Actions — More (Now only for owner) */}
        {isOwnProfile && (
          <div className="relative h-0 w-full z-30">
            <div className="absolute -top-12 right-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-md hover:bg-blue-500/20 text-blue-400 transition-all shadow-xl">
                    <MoreHorizontal className="h-4.5 w-4.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#0a0f1e] border-white/10 text-white min-w-[180px] p-1.5 shadow-2xl">
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer py-2.5 rounded-lg focus:bg-white/5">
                    <Edit2 className="h-3.5 w-3.5 mr-2.5 text-blue-400" /> 
                    <span className="text-xs font-semibold">Edit Details</span>
                  </DropdownMenuItem>
                  
                  <div className="h-px bg-white/5 my-1.5" />
                  
                  <DropdownMenuItem 
                    onClick={() => coverPhotoInputRef.current?.click()} 
                    className="focus:bg-blue-600/20 focus:text-blue-400 cursor-pointer py-2.5 rounded-lg" 
                    disabled={isUploadingCoverPhoto}
                  >
                    <div className={`flex items-center gap-2.5 w-full ${isUploadingCoverPhoto ? 'opacity-50' : ''}`}>
                      {isUploadingCoverPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      <span className="text-xs font-semibold">{isUploadingCoverPhoto ? 'Uploading...' : 'Change Cover'}</span>
                    </div>
                  </DropdownMenuItem>
                  
                  {user.coverPhotoUrl && (
                    <DropdownMenuItem onClick={handleDeleteCoverPhoto} className="focus:bg-red-500/10 text-red-400 cursor-pointer py-2.5 rounded-lg">
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

        {/* ── Avatar + header ── */}
        {/* ── Avatar + header ── */}
        <div className="relative z-20 px-6 -mt-16 sm:-mt-20 flex flex-col items-center text-center">
          {/* Centered Square Avatar */}
          <div className="relative group/avatar mb-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white p-1 shadow-2xl overflow-hidden border-4 border-[#050810] relative">
              {currentAvatarUrl ? (
                <img 
                  key={`avatar-${imageVersion}`}
                  src={getImageUrl(user.avatarUrl, 'avatar')} 
                  alt={user.displayName} 
                  className="w-full h-full object-cover rounded-xl" 
                />
              ) : (
                <div className="w-full h-full bg-blue-600/20 flex items-center justify-center rounded-xl">
                  <span style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-extrabold text-blue-300">
                    {initials}
                  </span>
                </div>
              )}
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              )}
            </div>
            {isOwnProfile && (
              <div className="absolute -bottom-2 -right-2 z-30">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2.5 rounded-full bg-blue-600 text-white border-2 border-[#050810] hover:bg-blue-500 transition-all active:scale-95 shadow-lg group-hover:scale-110">
                      <Camera className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="bg-[#0a0f1e] border-white/10 text-white min-w-[140px]">
                    <DropdownMenuItem 
                      onClick={() => avatarInputRef.current?.click()} 
                      className="focus:bg-blue-600/20 focus:text-blue-400 cursor-pointer py-2" 
                      disabled={isUploadingAvatar}
                    >
                      <div className={`flex items-center gap-2 w-full ${isUploadingAvatar ? 'opacity-50' : ''}`}>
                        {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                        <span className="text-xs font-semibold">{isUploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
                      </div>
                    </DropdownMenuItem>
                    {user.avatarUrl && (
                      <DropdownMenuItem onClick={handleDeleteAvatar} className="focus:bg-red-500/10 text-red-400 cursor-pointer py-2">
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

          {/* Centered Info Container */}
          <div className="flex flex-col items-center gap-4 mb-10 w-full">
            {/* Username */}
            <span className="text-sm font-bold text-white/40 tracking-tight">@{user.username}</span>
            
            {/* Profession Badge */}
            {user.profession && user.profession !== 'None' && (
              <div className="px-3 py-1.5 rounded-full bg-blue-600/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Briefcase className="h-3 w-3" /> {user.profession}
              </div>
            )}
            
            {/* Status & Location Row */}
            <div className="flex items-center justify-center gap-5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-white/10"}`} />
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

          {/* Bio Section - Centered Clean Typography */}
          {!isEditing && user.bio && (
            <div className="mb-10 max-w-lg">
              <p className="text-sm text-white/40 leading-relaxed font-medium italic">
                "{user.bio}"
              </p>
            </div>
          )}
        </div>

        {/* ── Social Chips & Main Actions ── */}
        {!isEditing && (
          <div className="px-6 space-y-8 mb-12">
            {/* Social Media Chips - Perfectly Centered Grid-like row */}
            {user.socialLinks && user.socialLinks.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {user.socialLinks.map((link: any, i: number) => (
                  <a
                    key={i}
                    href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0a101f] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all active:scale-95 group min-w-[120px] justify-center"
                  >
                    <SocialIcon platform={link.platform} className="h-4 w-4 text-white/30 group-hover:text-blue-400 transition-colors" />
                    <span className="text-[11px] font-bold text-white/30 group-hover:text-white transition-colors capitalize tracking-wide">
                      {link.platform}
                    </span>
                  </a>
                ))}
              </div>
            )}

            {/* Main Primary Actions */}
            <div className="space-y-3.5 w-full">
              {isOwnProfile ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full h-14 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-2xl shadow-blue-600/20 active:scale-[0.98]"
                >
                  <Edit2 className="h-4 w-4" /> Edit Profile
                </button>
              ) : currentUser ? (
                <Link to={`/chat?userId=${user.id}`} className="w-full block">
                  <button className="w-full h-14 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-2xl shadow-blue-600/20 active:scale-[0.98]">
                    <MessageSquare className="h-5 w-5" /> Message
                  </button>
                </Link>
              ) : (
                <Link to={`/login`} className="w-full block">
                  <button className="w-full h-14 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-2xl shadow-blue-600/20 active:scale-[0.98]">
                    <MessageSquare className="h-5 w-5" /> Login to message
                  </button>
                </Link>
              )}

              {/* Redundant share button removed */}
            </div>

            {/* Skills Section - Centered Minimal badges */}
            {!isEditing && (user.profession || (user.skills && user.skills.length > 0)) && (
              <div className="space-y-4 pt-6 border-t border-white/5 text-center">
                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-white/10">Expertise & Skills</label>
                <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                  {user.profession && user.profession !== 'None' && (
                    <Badge className="bg-blue-600/10 text-blue-400 border-none text-[9px] px-3 py-1 font-bold tracking-widest uppercase">
                      {user.profession}
                    </Badge>
                  )}
                  {user.skills && user.skills.length > 0 && user.skills.map(skill => (
                    <Badge 
                      key={skill} 
                      className="bg-white/5 text-white/30 border-none text-[9px] px-3 py-1 font-bold tracking-widest uppercase"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Info Sections ── */}
        <div className="space-y-10 px-6 sm:px-2 mb-10">
          


          {/* Details Grid (Personal + Identity) - Owner Only */}
          {isOwnProfile && !isEditing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Personal Details as Cards */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 flex items-center gap-2">
                  <div className="w-1 h-3 bg-emerald-500 rounded-full" /> Personal Details
                </label>
                <div className="grid grid-cols-2 gap-y-4">
                  {user.age && (
                    <div>
                      <span className="block text-[9px] text-white/20 uppercase tracking-wider mb-1">Age</span>
                      <span className="text-sm text-white/70">{user.age} Years</span>
                    </div>
                  )}
                  {user.gender && (
                    <div>
                      <span className="block text-[9px] text-white/20 uppercase tracking-wider mb-1">Gender</span>
                      <span className="text-sm text-white/70">{user.gender}</span>
                    </div>
                  )}
                  {user.city && (
                    <div className="col-span-2">
                      <span className="block text-[9px] text-white/20 uppercase tracking-wider mb-1">Location</span>
                      <div className="flex items-center gap-1.5 text-sm text-white/70">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500/60" />
                        <span>{user.city}{isOwnProfile && user.pincode ? ` (${user.pincode})` : ""}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Identity & Contact as Cards */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 flex items-center gap-2">
                  <div className="w-1 h-3 bg-blue-500 rounded-full" /> Identity & Contact
                </label>
                <div className="space-y-4">
                  <div>
                    <span className="block text-[9px] text-white/20 uppercase tracking-wider mb-1">Username</span>
                    <span className="text-sm text-white/70 tracking-tight">@{user.username}</span>
                  </div>
                  {user.phoneNumber && (
                    <div>
                      <span className="block text-[9px] text-white/20 uppercase tracking-wider mb-1 flex items-center gap-1">
                        Phone <Lock className="h-2 w-2" />
                      </span>
                      <span className="text-sm text-blue-400 font-medium">{user.phoneNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Edit form ── */}
        {isEditing && (
          <div
            className="mb-6 p-6 rounded-2xl border border-white/8 bg-white/[0.02] space-y-6"
            style={{ animation: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            <div className="group">
              <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2 ml-0.5">I am here to...</label>
              <select
                className="w-full bg-transparent border-b border-white/10 focus:border-blue-500/60 outline-none pb-2.5 pt-1 text-sm text-white appearance-none cursor-pointer"
                value={editForm.userGoal}
                onChange={(e) => setEditForm({ ...editForm, userGoal: e.target.value })}
              >
                <option value="" className="bg-[#0a0f1e] text-white/40">Select goal...</option>
                <option value="OFFER_SERVICE" className="bg-[#0a0f1e] text-white">Offer my services</option>
                <option value="HIRE_PROFESSIONALS" className="bg-[#0a0f1e] text-white">Hire professionals</option>
              </select>
            </div>

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

            <div className="grid grid-cols-2 gap-5">
              <div className="group">
                <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2 ml-0.5">Gender</label>
                <select
                  className="w-full bg-transparent border-b border-white/10 focus:border-blue-500/60 outline-none pb-2.5 pt-1 text-sm text-white appearance-none cursor-pointer"
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                >
                  <option value="" className="bg-[#0a0f1e] text-white/40">Select Gender</option>
                  <option value="Male" className="bg-[#0a0f1e] text-white">Male</option>
                  <option value="Female" className="bg-[#0a0f1e] text-white">Female</option>
                  <option value="Other" className="bg-[#0a0f1e] text-white">Other</option>
                </select>
              </div>
              <Field label="Age" icon={null} type="number"
                placeholder="25"
                value={editForm.age}
                onChange={(e: any) => setEditForm({ ...editForm, age: e.target.value })}
              />
            </div>

            {/* Profession — Category/Subcategory Structure */}
            <div className="space-y-4 pt-2">
              <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 ml-0.5">Profession / My Category</label>
              
              {/* Category Grid */}
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
                      "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200 text-center",
                      selectedCategory === cat.id
                        ? `${cat.bg} ${cat.border} ring-1 ring-blue-500/20`
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg", cat.bg, cat.color)}>
                      <cat.icon className="w-4 h-4" />
                    </div>
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", selectedCategory === cat.id ? "text-white" : "text-white/40")}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Sub-Professions Display */}
              {selectedCategory && SUB_PROFESSIONS[selectedCategory] && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-[9px] font-bold tracking-[0.15em] uppercase text-blue-400/60 ml-0.5 flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" /> Select Expertise
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUB_PROFESSIONS[selectedCategory].map((prof) => (
                      <button
                        key={prof}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, profession: prof })}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border uppercase tracking-wider",
                          editForm.profession === prof
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                            : "bg-white/5 border-white/5 text-white/30 hover:border-white/10"
                        )}
                      >
                        {prof}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, profession: "Other" })}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border uppercase tracking-wider",
                        editForm.profession === "Other"
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-white/5 border-white/5 text-white/30 hover:border-white/10"
                      )}
                    >
                      Other...
                    </button>
                  </div>
                </div>
              )}

              {/* Specify Custom Profession */}
              {(selectedCategory === "other" || editForm.profession === "Other") && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-[9px] font-bold tracking-[0.15em] uppercase text-blue-400/60 ml-0.5 flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" /> Specify Profession
                  </label>
                  <Input
                    value={customProfession}
                    onChange={e => setCustomProfession(e.target.value)}
                    className="bg-white/5 border-white/10 text-white h-10 focus:ring-blue-500/50 placeholder:text-white/10 text-sm"
                    placeholder="E.g. Full Stack Engineer, UX Specialist..."
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Skills Multi-Select */}
            <div className="group">
              <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2 ml-0.5">Skills (Press Enter to add)</label>
              <div className="space-y-3">
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
                  className="bg-white/5 border-white/10 text-white h-10 focus:ring-blue-500/50"
                />
                <div className="flex flex-wrap gap-2">
                  {editForm.skills.map(skill => (
                    <div 
                      key={skill} 
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 group/skill animate-in fade-in zoom-in duration-200"
                    >
                      <span className="text-[11px] text-blue-300 font-bold uppercase tracking-wider">{skill}</span>
                      <button 
                        type="button"
                        onClick={() => setEditForm({ ...editForm, skills: editForm.skills.filter(s => s !== skill) })}
                        className="hover:text-red-400 text-blue-400/50 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Social links */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/25">Social Links</label>
                <button
                  type="button" onClick={addSocialLink}
                  className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add link
                </button>
              </div>
              <div className="space-y-2">
                {editForm.socialLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 items-center p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                    <Select value={link.platform} onValueChange={(v) => updateSocialLink(i, "platform", v)}>
                      <SelectTrigger className="w-28 h-8 bg-white/5 border-white/10 text-xs text-white rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0f1e] border-white/10">
                        {PLATFORMS.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-white/70 text-xs focus:bg-blue-600/20 focus:text-white">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      className="flex-1 bg-transparent border-b border-white/10 focus:border-blue-500/60 outline-none text-xs text-white placeholder:text-white/15 pb-1.5 transition-colors"
                      placeholder="https://..."
                      value={link.url}
                      onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                    />
                    <button onClick={() => removeSocialLink(i)} className="text-white/20 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave} disabled={isSaving}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                {isSaving ? <><RotateCcw className="h-3.5 w-3.5 animate-spin" /> Saving...</> : <><Save className="h-3.5 w-3.5" /> Save changes</>}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-5 h-10 border border-white/8 hover:border-white/20 text-white/40 hover:text-white rounded-xl text-sm transition-all flex items-center gap-2"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </div>
        )}
        {/* ── Action buttons ── */}
        {!isEditing && isOwnProfile && (
          <div className="mt-4 px-6 sm:px-2">
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="w-full h-11 rounded-full border border-white/5 hover:border-red-500/20 hover:bg-red-500/5 text-white/20 hover:text-red-400 text-sm transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}

        {/* ── Page Footer ── */}
        <div className="mt-16 pt-8 border-t border-white/5 text-center">
          <Link to="/" className="text-[10px] text-white/10 hover:text-blue-400 tracking-[0.2em] uppercase font-bold transition-colors">
            krovaa.com
          </Link>
        </div>
      </div>

      {/* ── Rating Dialog ── */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent
          className="border-white/8 sm:max-w-sm"
          style={{ background: "#080c17", fontFamily: "'DM Sans', sans-serif" }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif" }} className="text-white">
              Rate {user?.displayName?.split(" ")[0]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-3">
              <Stars value={rating} size="h-8 w-8" interactive onChange={setRating} />
              <span className="text-xs text-white/25">{["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}</span>
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2">
                Your review
              </label>
              <textarea
                className="w-full bg-white/[0.03] border border-white/8 focus:border-blue-500/50 outline-none rounded-xl p-3 text-sm text-white placeholder:text-white/15 resize-none transition-colors"
                rows={3}
                placeholder="Share your experience..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />
            </div>
            <button
              onClick={handleRateUser}
              disabled={!canRateUser || ratingComment.trim().length === 0}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> Submit rating
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View All Ratings Dialog ── */}
      <Dialog open={isViewAllRatingsOpen} onOpenChange={setIsViewAllRatingsOpen}>
        <DialogContent
          className="border-white/8 sm:max-w-md max-h-[80vh] overflow-y-auto"
          style={{ background: "#080c17", fontFamily: "'DM Sans', sans-serif" }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif" }} className="text-white">
              Reviews for {user?.displayName?.split(" ")[0]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {allRatings.length > 0 ? allRatings.map((r, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-300 text-[11px] font-bold">
                      {r.reviewerDisplayName[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white/70">{r.reviewerDisplayName}</span>
                  </div>
                  <Stars value={r.rating} size="h-3.5 w-3.5" />
                </div>
                {r.comment && <p className="text-sm text-white/35 leading-relaxed font-light">{r.comment}</p>}
                <p className="text-[10px] text-white/15">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )) : (
              <p className="text-center text-white/20 py-10 text-sm">No reviews yet</p>
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
