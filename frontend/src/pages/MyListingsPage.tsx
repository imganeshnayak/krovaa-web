import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit3, Trash2, Eye, Users, IndianRupee, Briefcase, MapPin, Clock, AlertTriangle, X, LayoutGrid, Layers, Loader2, History, Bookmark, MoreVertical, Plus, ShoppingBag, Copy, Check, PauseCircle, PlayCircle } from "lucide-react";
import { getMyJobs, deleteJob, MyJob, updateJob, getMyCollabProjects, ProjectListing, deleteCollabProject, updateCollabProject, getMyDealListings, deleteDealListing, setDealStatus, DealListing } from "../lib/api";
import ShareJobDialog from "@/components/ShareJobDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const formatPostedAgo = (createdAt: string) => {
  const diffMinutes = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hrs ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function MyListingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBusiness = user?.accountType === "business";
  const [activeTab, setActiveTab] = useState("jobs");
  const [showHistory, setShowHistory] = useState(false);
  
  // Data State Line
  const [myJobs, setMyJobs] = useState<MyJob[]>([]);
  const [myCollabProjects, setMyCollabProjects] = useState<ProjectListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollabLoading, setIsCollabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Operational Action Guard states
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteConfirmCollabId, setDeleteConfirmCollabId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form Struct Sync Targets
  const [editingJob, setEditingJob] = useState<MyJob | null>(null);
  const [editForm, setEditForm] = useState({ title: "", company: "", location: "", budget: "", mode: "", description: "" });

  const [editingCollabProject, setEditingCollabProject] = useState<ProjectListing | null>(null);
  const [editCollabForm, setEditCollabForm] = useState({ title: "", description: "", company: "", location: "", workMode: "", duration: "", deadline: "", skills: "", terms: "" });

  // Drawer Context Anchors
  const [sharingCollab, setSharingCollab] = useState<ProjectListing | null>(null);

  // Deal listings state
  const [myDeals, setMyDeals] = useState<DealListing[]>([]);
  const [isDealsLoading, setIsDealsLoading] = useState(false);
  const [dealCopiedId, setDealCopiedId] = useState<number | null>(null);
  const [dealStatusLoading, setDealStatusLoading] = useState<number | null>(null);
  const [dealDeleteConfirmId, setDealDeleteConfirmId] = useState<number | null>(null);
  const [isDealDeleting, setIsDealDeleting] = useState(false);

  // Core API Fetch Routines
  const loadMyJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyJobs();
      setMyJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your listings.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMyCollabProjects = async () => {
    setIsCollabLoading(true);
    try {
      const data = await getMyCollabProjects();
      setMyCollabProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCollabLoading(false);
    }
  };

  useEffect(() => {
    loadMyJobs();
    loadMyCollabProjects();
    loadMyDeals();
  }, []);

  const loadMyDeals = async () => {
    setIsDealsLoading(true);
    try { setMyDeals(await getMyDealListings()); }
    catch (err) { console.error(err); }
    finally { setIsDealsLoading(false); }
  };

  const handleCopyDealLink = (deal: DealListing) => {
    const url = `${window.location.origin}/deal/${deal.shareCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setDealCopiedId(deal.id);
      setTimeout(() => setDealCopiedId(null), 2000);
    });
  };

  const handleToggleDealStatus = async (deal: DealListing) => {
    setDealStatusLoading(deal.id);
    try {
      const newStatus = deal.status === 'active' ? 'paused' : 'active';
      const updated = await setDealStatus(deal.id, newStatus);
      setMyDeals(prev => prev.map(d => d.id === deal.id ? { ...d, status: updated.status } : d));
    } catch (err) { console.error(err); }
    finally { setDealStatusLoading(null); }
  };

  const handleDeleteDeal = async (dealId: number) => {
    setIsDealDeleting(true);
    try {
      await deleteDealListing(dealId);
      setMyDeals(prev => prev.filter(d => d.id !== dealId));
      toast.success("Deal listing removed.");
      setDealDeleteConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove deal.");
    } finally { setIsDealDeleting(false); }
  };

  const displayedJobs = myJobs.filter(j => {
    if (j.postedById !== user?.id) return false;
    const isCompleted = j.applications?.some(a => a.status === "accepted");
    return showHistory ? isCompleted : !isCompleted;
  });

  const displayedCollabProjects = myCollabProjects.filter(p => {
    if (p.creatorId !== user?.id) return false;
    const isCompleted = p.status === 'COMPLETED';
    return showHistory ? isCompleted : !isCompleted;
  });

  // Aggregation Metrics Computations
  const totalApplications = myJobs.reduce((sum, j) => sum + (j.applicationCount || 0), 0);
  const totalBids = myJobs.reduce((sum, j) => {
    if (!j.applications) return sum;
    return sum + j.applications.filter(a => a.bidAmount).length;
  }, 0);

  // Core Execution Mutations
  const handleDeleteJob = async (jobId: number) => {
    setIsDeleting(true);
    try {
      await deleteJob(jobId);
      setMyJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success("Job listing successfully removed.");
      setDeleteConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove execution entry.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditJobSave = async () => {
    if (!editingJob) return;
    const { title, company, location, budget, description } = editForm;
    if (!title.trim() || !company.trim() || !location.trim() || !budget.trim() || !description.trim()) {
      toast.error("Please fill down all structural criteria requirements.");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateJob(editingJob.id, editForm);
      setMyJobs(prev => prev.map(j => j.id === editingJob.id ? { ...j, ...updated } : j));
      toast.success("Job profile criteria updated smoothly.");
      setEditingJob(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update mutation crash.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCollab = async (projectId: number) => {
    setIsDeleting(true);
    try {
      await deleteCollabProject(projectId);
      setMyCollabProjects(prev => prev.filter(p => p.id !== projectId));
      toast.success("Collaboration workspace blueprint detached.");
      setDeleteConfirmCollabId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Blueprint removal breakdown.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditCollabSave = async () => {
    if (!editingCollabProject) return;
    if (!editCollabForm.title.trim() || !editCollabForm.description.trim()) {
      toast.error("Functional workspace configurations must specify titles and descriptions.");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateCollabProject(editingCollabProject.id, editCollabForm);
      setMyCollabProjects(prev => prev.map(p => p.id === editingCollabProject.id ? { ...p, ...updated } : p));
      toast.success("Collaboration pipeline parameters successfully updated.");
      setEditingCollabProject(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to synchronize operational criteria changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24 pt-4 sm:px-6">
      
      {/* Top Breadcrumb Header Context Row */}
      <div className="mb-6 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/explore")}
            className="text-slate-500 hover:text-slate-900 h-8 gap-1.5 px-2 text-xs font-semibold group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Hub Explorer
          </Button>
        </div>
        
        {/* Top Control Grid Action Row */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">My Listings</h1>
          </div>
          
          {/* Compact Utility Row Wrapper */}
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0 rounded-lg bg-white border-slate-200 hover:bg-slate-50 text-slate-600 shadow-2xs shrink-0"
                  title="More actions"
                >
                  <LayoutGrid className="w-4 h-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border-slate-200 shadow-lg rounded-xl min-w-[200px] p-1">
                <DropdownMenuItem
                  onClick={() => navigate("/saved-jobs")}
                  className="cursor-pointer text-xs font-semibold py-2 px-3 text-slate-700 hover:text-slate-900 flex items-center gap-2 rounded-lg"
                >
                  <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                  Saved Listings
                </DropdownMenuItem>
           
                <DropdownMenuItem
                  onClick={() => setShowHistory(!showHistory)}
                  className="cursor-pointer text-xs font-semibold py-2 px-3 text-slate-700 hover:text-slate-900 flex items-center gap-2 rounded-lg"
                >
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  {showHistory ? "Hide History" : "View History"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {showHistory && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Viewing History
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className={`relative rounded-full bg-slate-200/50 p-1.5 flex w-full border border-slate-200/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),_inset_0_-1px_1px_rgba(0,0,0,0.02)] ${isBusiness ? "" : ""}`}>
          <button
            type="button"
            onClick={() => setActiveTab("jobs")}
            className="relative z-10 rounded-full py-2.5 text-sm font-semibold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 focus-visible:outline-none focus:outline-none flex-1"
          >
            {activeTab === "jobs" && (
              <motion.div
                layoutId="activeMyListingsTab"
                className="absolute inset-0 bg-white rounded-full shadow-[0_2.5px_6px_rgba(0,0,0,0.08),_0_0.5px_1.5px_rgba(0,0,0,0.04)] border border-slate-200/60"
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
              />
            )}
            <span className={`relative z-20 transition-all duration-200 flex items-center gap-1.5 text-xs font-bold ${activeTab === "jobs" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <Briefcase className="w-3.5 h-3.5" /> Jobs
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("collabs")}
            className="relative z-10 rounded-full py-2.5 text-sm font-semibold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 focus-visible:outline-none focus:outline-none flex-1"
          >
            {activeTab === "collabs" && (
              <motion.div
                layoutId="activeMyListingsTab"
                className="absolute inset-0 bg-white rounded-full shadow-[0_2.5px_6px_rgba(0,0,0,0.08),_0_0.5px_1.5px_rgba(0,0,0,0.04)] border border-slate-200/60"
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
              />
            )}
            <span className={`relative z-20 transition-all duration-200 flex items-center gap-1.5 text-xs font-bold ${activeTab === "collabs" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <Layers className="w-3.5 h-3.5" /> Collabs
            </span>
          </button>
          {isBusiness && (
            <button
              type="button"
              onClick={() => setActiveTab("deals")}
              className="relative z-10 rounded-full py-2.5 text-sm font-semibold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 focus-visible:outline-none focus:outline-none flex-1"
            >
              {activeTab === "deals" && (
                <motion.div
                  layoutId="activeMyListingsTab"
                  className="absolute inset-0 bg-white rounded-full shadow-[0_2.5px_6px_rgba(0,0,0,0.08),_0_0.5px_1.5px_rgba(0,0,0,0.04)] border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <span className={`relative z-20 transition-all duration-200 flex items-center gap-1.5 text-xs font-bold ${activeTab === "deals" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                <ShoppingBag className="w-3.5 h-3.5" /> Deals
              </span>
            </button>
          )}
        </div>

        {/* ─── Jobs Tab ─── */}
        {activeTab === "jobs" && (
          <section className="space-y-6">
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((n) => <Skeleton key={n} className="h-20 rounded-xl bg-slate-200/60" />)}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-center text-xs font-medium text-rose-600 flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> {error}
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto">
                <Briefcase className="h-8 w-8 text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">{showHistory ? "No Completed Jobs" : "No Jobs Yet"}</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  {showHistory ? "You haven't completed any jobs yet." : "Post a job to find professionals for your projects."}
                </p>
                {!showHistory && (
                  <Button size="sm" onClick={() => navigate("/post-job")} className="bg-slate-900 text-white hover:bg-slate-800 font-bold px-4 h-9 rounded-xl shadow-xs">
                    Post a Job
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {displayedJobs.map((job) => {
                    const pendingApps = job.applications?.filter(a => a.status === "pending").length || 0;
                    const hasBids = job.applications?.some(a => a.bidAmount) || false;

                    return (
                      <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition-colors">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[140px]">{job.company}</span>
                              {pendingApps > 0 && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                  {pendingApps} pending
                                </span>
                              )}
                            </div>
                            <h2 className="text-base font-bold text-slate-900 tracking-tight">{job.title}</h2>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-slate-500 pt-1">
                              <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{job.location}</span></div>
                              <div className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{job.mode}</span></div>
                              <div className="flex items-center gap-1">
                                <IndianRupee className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{isNaN(Number(job.budget)) ? job.budget : Number(job.budget).toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{formatPostedAgo(job.createdAt)}</span></div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-md uppercase">
                                <Users className="h-3 w-3" />
                                <span>{job.applicationCount} submissions</span>
                              </div>
                              {hasBids && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md uppercase">
                                  <IndianRupee className="h-3 w-3" /> <span>Bids</span>
                                </div>
                              )}
                            </div>

                            {job.applications && job.applications.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Recent Candidates</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {job.applications.slice(0, 4).map((app) => (
                                    <div key={app.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-[11px] text-slate-700 font-medium">
                                      <span>{app.user.displayName || app.user.username}</span>
                                      {app.bidAmount && <span className="text-amber-600 font-bold">₹{Number(app.bidAmount).toLocaleString('en-IN')}</span>}
                                      <span className={`text-[9px] font-bold uppercase border-l border-slate-200 pl-1.5 ${
                                        app.status === "pending" ? "text-amber-500" : app.status === "accepted" ? "text-emerald-600" : "text-rose-500"
                                      }`}>{app.status}</span>
                                    </div>
                                  ))}
                                  {job.applications.length > 4 && (
                                    <span className="text-[10px] text-slate-400 self-center font-medium pl-1">+{job.applications.length - 4} more</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center gap-1.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-50">
                            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg flex-1 sm:flex-initial w-full bg-white border-slate-200" onClick={() => navigate(`/jobs/${job.id}`)}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg flex-1 sm:flex-initial w-full bg-white border-slate-200" onClick={() => { setEditingJob(job); setEditForm({ title: job.title, company: job.company, location: job.location, budget: job.budget, mode: job.mode, description: job.description }); }}>
                              <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            
                            {deleteConfirmId === job.id ? (
                              <div className="flex gap-1 w-full shrink-0">
                                <Button variant="destructive" size="sm" className="h-8 text-xs font-bold rounded-lg flex-1" disabled={isDeleting} onClick={() => handleDeleteJob(job.id)}>
                                  {isDeleting ? "..." : "Confirm"}
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 px-2 rounded-lg bg-white border-slate-200" onClick={() => setDeleteConfirmId(null)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 flex-1 sm:flex-initial w-full" onClick={() => setDeleteConfirmId(job.id)}>
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            )}
          </section>
        )}

        {/* ─── Collabs Tab ─── */}
        {activeTab === "collabs" && (
          <section className="space-y-6">
            {isCollabLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => <Skeleton key={n} className="h-28 rounded-xl bg-slate-200/60" />)}
              </div>
            ) : displayedCollabProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto">
                <Layers className="h-8 w-8 text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">{showHistory ? "No Completed Collabs" : "No Collabs Yet"}</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  {showHistory ? "No completed collaborative projects yet." : "Create a collaboration project to work with teams."}
                </p>
                {!showHistory && (
                  <Button size="sm" onClick={() => navigate("/collab/create")} className="bg-slate-900 text-white hover:bg-slate-800 font-bold px-4 h-9 rounded-xl shadow-xs">
                    Create Collab
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {displayedCollabProjects.map((project) => {
                  const occupiedSeats = project.seats?.filter(s => s.status === "OCCUPIED").length || 0;
                  const totalSeats = project.seats?.length || 0;
                  const totalBids = project.seats?.reduce((sum, s) => sum + (s.bidCount || s.bids?.length || 0), 0) || 0;

                  return (
                    <div key={project.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition-colors">
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[140px]">{project.company || "Collab"}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              project.status === 'ACTIVE' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' :
                              project.status === 'COMPLETED' ? 'text-sky-700 bg-sky-50 border border-sky-200' :
                              'text-amber-700 bg-amber-50 border border-amber-200'
                            }`}>{project.status}</span>
                            <span className="text-[9px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              {project.mode}
                            </span>
                          </div>
                          <h2 className="text-base font-bold text-slate-900 tracking-tight">{project.title}</h2>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-slate-500 pt-1">
                            {project.location && <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{project.location}</span></div>}
                            {project.duration && <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{project.duration}</span></div>}
                            {project.deadline && <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>Due {new Date(project.deadline).toLocaleDateString()}</span></div>}
                            {project.baseBudget > 0 && (
                              <div className="flex items-center gap-1">
                                <IndianRupee className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{Number(project.baseBudget).toLocaleString('en-IN')}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{formatPostedAgo(project.createdAt)}</span></div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-md uppercase">
                              <Users className="h-3 w-3" />
                              <span>{occupiedSeats}/{totalSeats} seats filled</span>
                            </div>
                            {totalBids > 0 && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md uppercase">
                                <IndianRupee className="h-3 w-3" /> <span>{totalBids} bids</span>
                              </div>
                            )}
                          </div>

                          {project.tags && project.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-2">
                              {project.tags.slice(0, 5).map((tag, i) => (
                                <span key={i} className="text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">{tag}</span>
                              ))}
                              {project.tags.length > 5 && (
                                <span className="text-[10px] text-slate-400 self-center font-medium pl-1">+{project.tags.length - 5} more</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex sm:flex-col items-center gap-1.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-50">
                          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg flex-1 sm:flex-initial w-full bg-white border-slate-200" onClick={() => navigate(`/blueprint/${project.id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg flex-1 sm:flex-initial w-full bg-white border-slate-200" onClick={() => {
                            setEditingCollabProject(project);
                            setEditCollabForm({
                              title: project.title,
                              description: project.description,
                              company: project.company || "",
                              location: project.location === "Remote" ? "" : (project.location || ""),
                              workMode: project.location === "Remote" ? "Remote" : (project.location ? "Onsite" : "Remote"),
                              duration: project.duration || "",
                              deadline: project.deadline ? project.deadline.split('T')[0] : "",
                              skills: project.tags ? project.tags.join(', ') : "",
                              terms: project.terms ? project.terms.join('\n') : ""
                            });
                          }}>
                            <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>

                          {deleteConfirmCollabId === project.id ? (
                            <div className="flex gap-1 w-full shrink-0">
                              <Button variant="destructive" size="sm" className="h-8 text-xs font-bold rounded-lg flex-1" disabled={isDeleting} onClick={() => handleDeleteCollab(project.id)}>
                                {isDeleting ? "..." : "Confirm"}
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 px-2 rounded-lg bg-white border-slate-200" onClick={() => setDeleteConfirmCollabId(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 flex-1 sm:flex-initial w-full" onClick={() => setDeleteConfirmCollabId(project.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ─── Deals Tab (Business Only) ─── */}
        {activeTab === "deals" && isBusiness && (
          <section className="space-y-6">
            {isDealsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2].map(n => <Skeleton key={n} className="h-28 rounded-xl bg-slate-200/60" />)}
              </div>
            ) : myDeals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto">
                <ShoppingBag className="h-8 w-8 text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No Deal Listings Yet</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">Create a deal and share the link anywhere to attract buyers.</p>
                <Button size="sm" onClick={() => navigate("/deal/create")} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 font-bold px-4 h-9 rounded-xl shadow">
                  + Create Deal
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {myDeals.map(deal => (
                  <div key={deal.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-violet-200 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{deal.title}</h3>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            deal.status === 'active' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' :
                            deal.status === 'paused' ? 'text-amber-700 bg-amber-50 border border-amber-200' :
                            'text-rose-700 bg-rose-50 border border-rose-200'
                          }`}>{deal.status}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <IndianRupee className="h-3.5 w-3.5 text-violet-600" />
                          <span className="text-sm font-black text-violet-700">{Number(deal.price).toLocaleString('en-IN')}</span>
                          <span className="text-[11px] text-slate-400 ml-2">· {deal.deliveryType}</span>
                          {deal.category && <span className="text-[11px] text-slate-400">· {deal.category}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                          <span>👁 {deal.viewCount} views</span>
                          <span>💬 {deal._count?.inquiries ?? 0} inquiries</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold" onClick={() => handleCopyDealLink(deal)}>
                            {dealCopiedId === deal.id ? <><Check className="h-3 w-3 text-green-600" /> Copied</> : <><Copy className="h-3 w-3" /> Copy Link</>}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold" onClick={() => navigate(`/deal/${deal.shareCode}`)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline" size="sm"
                            className={`h-7 px-2 text-[10px] font-bold ${
                              deal.status === 'active' ? 'text-amber-600 border-amber-200' : 'text-emerald-600 border-emerald-200'
                            }`}
                            disabled={dealStatusLoading === deal.id}
                            onClick={() => handleToggleDealStatus(deal)}
                          >
                            {dealStatusLoading === deal.id ? <Loader2 className="h-3 w-3 animate-spin" /> :
                              deal.status === 'active' ? <><PauseCircle className="h-3 w-3" /> Pause</> : <><PlayCircle className="h-3 w-3" /> Activate</>}
                          </Button>
                          {dealDeleteConfirmId === deal.id ? (
                            <div className="flex gap-1">
                              <Button variant="destructive" size="sm" className="h-7 text-[10px] font-bold" disabled={isDealDeleting} onClick={() => handleDeleteDeal(deal.id)}>
                                {isDealDeleting ? "..." : "Confirm"}
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setDealDeleteConfirmId(null)}><X className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => setDealDeleteConfirmId(deal.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  size="sm"
                  onClick={() => navigate("/deal/create")}
                  className="w-full h-9 text-xs font-bold border-2 border-dashed border-violet-300 text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-xl"
                  variant="outline"
                >
                  + Create Another Deal
                </Button>
              </div>
            )}
          </section>
        )}
      </Tabs>

      {/* ========================================== */}
      {/* DIALOG PRIMITIVES REPLACEMENT CORE ENGINE  */}
      {/* ========================================== */}

      {/* Overlay Context: Job Configuration Editor */}
      <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
        <DialogContent className="max-w-md bg-white border-slate-200 p-5 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight text-slate-900">Adjust Role Framework</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Modify market requirements parameters below for live synchronization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Position Title</Label>
              <Input className="h-9 text-xs" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Corporate Hub / Entity</Label>
              <Input className="h-9 text-xs" value={editForm.company} onChange={e => setEditForm(p => ({ ...p, company: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location Scope</Label>
                <Input className="h-9 text-xs" value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capital Budget Pool</Label>
                <Input className="h-9 text-xs font-mono" value={editForm.budget} onChange={e => setEditForm(p => ({ ...p, budget: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Work Execution Mode</Label>
              <select value={editForm.mode} onChange={e => setEditForm(p => ({ ...p, mode: e.target.value }))} className="w-full flex h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs outline-hidden focus:ring-1 focus:ring-slate-950 font-medium text-slate-800">
                <option value="Remote">Remote Operations</option>
                <option value="Hybrid">Hybrid Split Grid</option>
                <option value="Onsite">Onsite Localization</option>
              </select>
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Functional Role Description</Label>
              <Textarea rows={3} className="text-xs leading-relaxed" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="ghost" size="sm" className="h-9 text-xs font-bold text-slate-500" disabled={isSaving} onClick={() => setEditingJob(null)}>Cancel</Button>
            <Button size="sm" className="h-9 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800" disabled={isSaving} onClick={handleEditJobSave}>
              {isSaving && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />} Save Operational Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overlay Context: Collaborative Blueprint Parameter Editor */}
      <Dialog open={!!editingCollabProject} onOpenChange={(open) => !open && setEditingCollabProject(null)}>
        <DialogContent className="max-w-xl bg-white border-slate-200 p-5 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight text-slate-900">Modify Collaboration Workspace Blueprint</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Update underlying squad distribution thresholds and delivery matrices dynamically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-1 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workspace Title</Label>
              <Input className="h-9 text-xs" value={editCollabForm.title} onChange={e => setEditCollabForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entity Organization</Label>
                <Input className="h-9 text-xs" value={editCollabForm.company} onChange={e => setEditCollabForm(p => ({ ...p, company: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Execution Interface Mode</Label>
                <select value={editCollabForm.workMode} onChange={e => setEditCollabForm(p => ({ ...p, workMode: e.target.value }))} className="w-full flex h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs outline-hidden text-slate-800 font-medium">
                  <option value="Remote">🌐 Remote Ecosystem</option>
                  <option value="Hybrid">🤝 Hybrid Alignment</option>
                  <option value="Onsite">🏢 Onsite Localization</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Physical Workspace Location</Label>
                <Input className="h-9 text-xs" value={editCollabForm.location} disabled={editCollabForm.workMode === "Remote"} placeholder={editCollabForm.workMode === "Remote" ? "N/A (Global Remote)" : "e.g. Bangalore"} onChange={e => setEditCollabForm(p => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Roster Active Lifecycle Duration</Label>
                <Input className="h-9 text-xs" value={editCollabForm.duration} placeholder="e.g. 3 Months" onChange={e => setEditCollabForm(p => ({ ...p, duration: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Application Cutoff Boundary</Label>
                <Input type="date" className="h-9 text-xs" value={editCollabForm.deadline} onChange={e => setEditCollabForm(p => ({ ...p, deadline: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Core Competencies Stack Tags</Label>
                <Input className="h-9 text-xs" value={editCollabForm.skills} placeholder="Comma-separated tokens" onChange={e => setEditCollabForm(p => ({ ...p, skills: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ecosystem Scope Description</Label>
              <Textarea rows={3} className="text-xs leading-relaxed" value={editCollabForm.description} onChange={e => setEditCollabForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SLA Clauses & Project Terms</Label>
              <Textarea rows={2} className="text-xs leading-relaxed" value={editCollabForm.terms} placeholder="New line divided criteria lists" onChange={e => setEditCollabForm(p => ({ ...p, terms: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button variant="ghost" size="sm" className="h-9 text-xs font-bold text-slate-500" disabled={isSaving} onClick={() => setEditingCollabProject(null)}>Cancel</Button>
            <Button size="sm" className="h-9 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800" disabled={isSaving} onClick={handleEditCollabSave}>
              {isSaving && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />} Synchronize Blueprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overlay Context: Irreversible Framework Deletion Warning Anchor */}
      <Dialog open={!!deleteConfirmCollabId} onOpenChange={(open) => !open && setDeleteConfirmCollabId(null)}>
        <DialogContent className="max-w-xs bg-white border-slate-200 p-5 rounded-2xl text-center shadow-xl">
          <div className="mx-auto w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold tracking-tight text-slate-900 text-center">Teardown Project Configuration?</DialogTitle>
            <DialogDescription className="text-xs text-slate-400 text-center mt-1">
              This completely disassembles the collaboration hub parameters safely. Outgoing candidate links will be severed permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2 mt-4 sm:justify-center">
            <Button variant="outline" size="sm" className="h-9 text-xs font-semibold rounded-xl" disabled={isDeleting} onClick={() => setDeleteConfirmCollabId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" className="h-9 text-xs font-bold rounded-xl" disabled={isDeleting} onClick={() => deleteConfirmCollabId && handleDeleteCollab(deleteConfirmCollabId)}>
              {isDeleting ? "Dropping..." : "Confirm Dropping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sharingCollab && (
        <ShareJobDialog
          isOpen={!!sharingCollab}
          onClose={() => setSharingCollab(null)}
          jobId={sharingCollab.id}
          jobTitle={sharingCollab.title}
          companyName={sharingCollab.company || sharingCollab.creator.displayName}
          type="collab"
        />
      )}
    </div>
  );
}