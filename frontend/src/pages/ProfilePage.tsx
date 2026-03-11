import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Share2, MessageSquare, Twitter, Instagram, Linkedin,
  Github, Globe, Plus, Trash2, Star, LogOut, Facebook, Youtube,
  Camera, Save, X, Edit2, Eye, MapPin, CheckCircle2, RotateCcw, Trash, Phone, Lock, Briefcase
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

/* ── Font injection ── */
if (typeof document !== "undefined" && !document.getElementById("krovaa-profile-fonts")) {
  const l = document.createElement("link");
  l.id = "krovaa-profile-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap";
  document.head.appendChild(l);
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
  const { user: currentUser, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "", bio: "", email: "", city: "", pincode: "", phoneNumber: "",
    profession: "",
    socialLinks: [] as { platform: string; url: string }[]
  });
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [canRateUser, setCanRateUser] = useState(false);
  const [ratingEligibilityReason, setRatingEligibilityReason] = useState("");
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [verificationFee, setVerificationFee] = useState(0);
  const [isViewAllRatingsOpen, setIsViewAllRatingsOpen] = useState(false);
  const [allRatings, setAllRatings] = useState<any[]>([]);

  const loadUser = async () => {
    setIsLoading(true);
    try {
      if (username) {
        const userData = await getUserByUsername(username);
        setUser(userData);
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
        setEditForm({
          displayName: userData.displayName || "",
          bio: userData.bio || "",
          email: userData.email || "",
          city: userData.city || "",
          pincode: userData.pincode || "",
          phoneNumber: (userData as any).phoneNumber || "",
          profession: (userData as any).profession || "",
          socialLinks: userData.socialLinks || []
        });
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
    setIsSaving(true);
    try {
      const updated = await updateUserProfile(user.id, {
        ...editForm,
        displayName: editForm.displayName.trim(),
        bio: editForm.bio.trim(),
        email: editForm.email.trim().toLowerCase(),
        city: editForm.city.trim(),
        pincode: editForm.pincode.trim(),
        profession: editForm.profession.trim() || null,
        phoneNumber: (editForm as any).phoneNumber ? (editForm as any).phoneNumber.trim() : undefined,
      });
      setUser(updated);
      setIsEditing(false);
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
    try {
      const { avatarUrl } = await uploadAvatar(file);
      setUser({ ...user, avatarUrl });
      toast({ title: "Avatar updated!" });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", variant: "destructive" }); return; }
    try {
      const { coverPhotoUrl } = await uploadCoverPhoto(file);
      setUser({ ...user, coverPhotoUrl });
      toast({ title: "Cover updated!" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
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
          <Link to="/" style={{ fontFamily: "'Syne', sans-serif" }} className="text-base font-bold text-white/60 hover:text-white transition-colors">
            Krovaa
          </Link>
          <button onClick={copyLink} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-blue-400 transition-colors">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-24 relative z-10">

        {/* ── Cover ── */}
        <div className="relative h-44 rounded-b-3xl overflow-hidden -mx-4 group/cover">
          {user.coverPhotoUrl ? (
            <img src={user.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-900/40 via-[#050810] to-[#070d1f]">
              <div className="absolute inset-0 opacity-[0.06]" style={{
                backgroundImage: "linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)",
                backgroundSize: "32px 32px"
              }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-blue-600/10 blur-[60px]" />
            </div>
          )}
          {/* Cover actions — visible on hover */}
          {isOwnProfile && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-200">
              {user.coverPhotoUrl && (
                <button
                  onClick={handleDeleteCoverPhoto}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 text-red-400 hover:bg-red-500/20 text-xs font-medium border border-red-500/30 transition-all"
                  title="Remove cover photo"
                >
                  <Trash className="h-3 w-3" /> Remove
                </button>
              )}
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 text-white hover:bg-white/10 text-xs font-medium border border-white/20 cursor-pointer transition-all">
                <Camera className="h-3 w-3" /> Change cover
                <input type="file" className="hidden" accept="image/*" onChange={handleCoverPhotoUpload} />
              </label>
            </div>
          )}
        </div>

        {/* ── Avatar + header ── */}
        <div className="flex items-end gap-4 px-2 -mt-12 mb-5">
          {/* Avatar with camera + delete overlay */}
          <div className="relative flex-shrink-0 group/avatar">
            <div className="w-24 h-24 rounded-2xl border-4 border-[#050810] overflow-hidden shadow-xl shadow-black/50">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-600/20 flex items-center justify-center">
                  <span style={{ fontFamily: "'Syne', sans-serif" }} className="text-2xl font-extrabold text-blue-300">
                    {initials}
                  </span>
                </div>
              )}
            </div>
            {isOwnProfile && (
              <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover/avatar:bg-black/50 transition-all duration-200 flex items-center justify-center gap-1.5 opacity-0 group-hover/avatar:opacity-100">
                <label className="cursor-pointer p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" title="Change photo">
                  <Camera className="h-3.5 w-3.5 text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                </label>
                {user.avatarUrl && (
                  <button
                    onClick={handleDeleteAvatar}
                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors"
                    title="Remove photo"
                  >
                    <Trash className="h-3.5 w-3.5 text-red-400" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Name & status — below cover, no overlap */}
          <div className="pb-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-xl font-extrabold tracking-tight truncate">
                {user.displayName || user.username}
              </h1>
              {user.verified && (
                <img src="/verified-badge.svg" alt="Verified" className="h-5 w-5 flex-shrink-0" title="Verified" />
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-white/30">@{user.username}</span>
              {user.profession && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <Briefcase className="h-3 w-3 text-blue-400" />
                  <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">{user.profession}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
                <span className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
                  {user.status === "active" ? "Available" : "Unavailable"}
                </span>
              </div>
              {(user.city || (isOwnProfile && user.pincode)) && (
                <div className="flex items-center gap-1 text-[11px] text-white/30">
                  <MapPin className="h-3 w-3" />
                  {user.city}{isOwnProfile && user.city && user.pincode ? ", " : ""}{isOwnProfile ? user.pincode : ""}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Rating strip ── */}
        {user.averageRating !== undefined && user.averageRating > 0 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 mb-5">
            <div className="flex items-center gap-3">
              <Stars value={Math.round(user.averageRating)} />
              <span style={{ fontFamily: "'Syne', sans-serif" }} className="text-sm font-bold">{user.averageRating}</span>
              <span className="text-xs text-white/25">({user.ratingCount} {user.ratingCount === 1 ? "review" : "reviews"})</span>
            </div>
            {!isOwnProfile && user.ratingCount > 0 && (
              <button onClick={openViewAllRatings} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> View all
              </button>
            )}
          </div>
        )}

        {/* ── Bio ── */}
        {!isEditing && user.bio && (
          <p className="text-sm text-white/40 leading-relaxed mb-5 whitespace-pre-wrap font-light">
            {user.bio}
          </p>
        )}

        {/* Phone (private) shown only to owner */}
        {!isEditing && isOwnProfile && user.phoneNumber && (
          <div className="mb-4">
            <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2 ml-0.5">Phone (private)</label>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Lock className="h-4 w-4 text-white/30" />
              <span>{user.phoneNumber}</span>
            </div>
          </div>
        )}

        {/* ── Social links ── */}
        {!isEditing && user.socialLinks && user.socialLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {user.socialLinks.map((link: any, i: number) => (
              <a
                key={i}
                href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-white/[0.03] hover:border-blue-500/40 hover:bg-blue-500/5 text-white/30 hover:text-blue-400 transition-all text-xs"
              >
                <SocialIcon platform={link.platform} className="h-3.5 w-3.5" />
                <span className="capitalize">{link.platform}</span>
              </a>
            ))}
          </div>
        )}

        {/* ── Edit form ── */}
        {isEditing && (
          <div
            className="mb-6 p-6 rounded-2xl border border-white/8 bg-white/[0.02] space-y-6"
            style={{ animation: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both" }}
          >
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

            {/* Profession / Skill */}
            <div className="group">
              <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2 ml-0.5">Profession / Skill</label>
              <select
                className="w-full bg-transparent border-b border-white/10 focus:border-blue-500/60 outline-none pb-2.5 pt-1 text-sm text-white appearance-none cursor-pointer"
                value={editForm.profession}
                onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
              >
                <option value="" className="bg-[#0a0f1e] text-white/40">Select your profession...</option>
                {[
                  "Software Developer", "UI/UX Designer", "Graphic Designer", "Web Developer",
                  "Data Scientist", "AI / ML Engineer", "Cybersecurity Analyst", "DevOps Engineer",
                  "Product Manager", "Digital Marketer", "Content Creator", "Video Editor",
                  "Photographer", "Videographer", "Artist / Illustrator", "Musician",
                  "Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Architect",
                  "Doctor", "Nurse", "Pharmacist", "Lawyer", "Chartered Accountant",
                  "Teacher / Educator", "Writer / Author", "Entrepreneur", "Consultant", "Other"
                ].map(p => (
                  <option key={p} value={p} className="bg-[#0a0f1e] text-white">{p}</option>
                ))}
              </select>
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
        {!isEditing && (
          <div className="space-y-2.5">
            {isOwnProfile ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full h-11 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-blue-600/10 hover:border-blue-500/30 text-white/60 hover:text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 className="h-4 w-4" /> Edit profile
                </button>
                <button
                  onClick={() => { logout(); navigate("/login"); }}
                  className="w-full h-11 rounded-xl border border-white/5 hover:border-red-500/20 hover:bg-red-500/5 text-white/20 hover:text-red-400 text-sm transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </>
            ) : currentUser ? (
              <>
                <Link to={`/chat?userId=${user.id}`}>
                  <button className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] shadow-xl shadow-blue-900/30 flex items-center justify-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Send message
                  </button>
                </Link>
                <button
                  onClick={() => canRateUser && setIsRatingDialogOpen(true)}
                  disabled={!canRateUser}
                  className="w-full h-11 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-yellow-500/5 hover:border-yellow-500/25 disabled:opacity-30 disabled:cursor-not-allowed text-white/50 hover:text-yellow-300 text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Star className="h-4 w-4" /> Rate {user.displayName?.split(" ")[0]}
                </button>
                {!canRateUser && ratingEligibilityReason && (
                  <p className="text-center text-[11px] text-white/20 px-4">{ratingEligibilityReason}</p>
                )}
              </>
            ) : (
              /* Unauthenticated visitor — show login CTA */
              <Link to={`/login`}>
                <button className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] shadow-xl shadow-blue-900/30 flex items-center justify-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Login to message
                </button>
              </Link>
            )}

            <button
              onClick={copyLink}
              className="w-full h-11 rounded-xl border border-white/5 hover:border-blue-500/25 hover:bg-blue-500/5 text-white/20 hover:text-blue-400 text-sm transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="h-3.5 w-3.5" /> {isOwnProfile ? "Copy profile link" : "Share profile"}
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