import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Edit3, Trash2, Eye, Users, IndianRupee, Briefcase, 
  MapPin, Clock, AlertTriangle, X, LayoutGrid, Layers, Loader2, 
  History, Bookmark, ShoppingBag, Copy, Check, PauseCircle, 
  PlayCircle, BarChart3, TrendingUp, DollarSign, Package
} from "lucide-react";
import { 
  getMyJobs, deleteJob, MyJob, updateJob, getMyCollabProjects, 
  ProjectListing, deleteCollabProject, updateCollabProject, 
  getMyDealListings, deleteDealListing, setDealStatus, DealListing,
  apiFetch
} from "../lib/api";
import ShareJobDialog from "@/components/ShareJobDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

interface SellerStats {
  totalSalesCount: number;
  pendingEscrowBalance: number;
  releasedEarningsBalance: number;
  salesHistory: Array<{
    id: number;
    title: string;
    buyerName: string;
    createdAt: string;
    status: string;
    shippingStatus: string | null;
    grossAmount: number;
    platformFee: number;
    netPayout: number;
  }>;
}

export default function SellerDashboard() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const isBusiness = user?.accountType === "business";
  const [searchParams, setSearchParams] = useSearchParams();
  const mainTabParam = searchParams.get("tab") || "analytics";
  const listingsTabParam = searchParams.get("subtab") || "jobs";

  const [activeMainTab, setActiveMainTab] = useState<"analytics" | "listings">(
    mainTabParam === "listings" ? "listings" : "analytics"
  );
  const [activeListingsTab, setActiveListingsTab] = useState<"jobs" | "collabs" | "deals">(
    listingsTabParam === "collabs" || listingsTabParam === "deals" ? listingsTabParam : "jobs"
  );

  const [showHistory, setShowHistory] = useState(false);
  
  // Analytics State
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Listings Data State
  const [myJobs, setMyJobs] = useState<MyJob[]>([]);
  const [myCollabProjects, setMyCollabProjects] = useState<ProjectListing[]>([]);
  const [myDeals, setMyDeals] = useState<DealListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollabLoading, setIsCollabLoading] = useState(false);
  const [isDealsLoading, setIsDealsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteConfirmCollabId, setDeleteConfirmCollabId] = useState<number | null>(null);
  const [dealDeleteConfirmId, setDealDeleteConfirmId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDealDeleting, setIsDealDeleting] = useState(false);

  // Form Sync Targets
  const [editingJob, setEditingJob] = useState<MyJob | null>(null);
  const [editForm, setEditForm] = useState({ title: "", company: "", location: "", budget: "", mode: "", description: "" });

  const [editingCollabProject, setEditingCollabProject] = useState<ProjectListing | null>(null);
  const [editCollabForm, setEditCollabForm] = useState({ title: "", description: "", company: "", location: "", workMode: "", duration: "", deadline: "", skills: "", terms: "" });

  // Dialog anchors
  const [sharingCollab, setSharingCollab] = useState<ProjectListing | null>(null);
  const [dealCopiedId, setDealCopiedId] = useState<number | null>(null);
  const [dealStatusLoading, setDealStatusLoading] = useState<number | null>(null);

  // Load seller stats
  const loadSellerStats = async () => {
    setIsStatsLoading(true);
    try {
      const data = await apiFetch("/api/seller/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to load seller statistics:", err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  // Listings APIs
  const loadMyJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyJobs();
      setMyJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings.");
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

  const loadMyDeals = async () => {
    setIsDealsLoading(true);
    try {
      setMyDeals(await getMyDealListings());
    } catch (err) {
      console.error(err);
    } finally {
      setIsDealsLoading(false);
    }
  };

  useEffect(() => {
    loadSellerStats();
    loadMyJobs();
    loadMyCollabProjects();
    loadMyDeals();
    refreshUser();
  }, []);

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
    } catch (err) { 
      console.error(err); 
    } finally { 
      setDealStatusLoading(null); 
    }
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
    } finally { 
      setIsDealDeleting(false); 
    }
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

  const handleDeleteJob = async (jobId: number) => {
    setIsDeleting(true);
    try {
      await deleteJob(jobId);
      setMyJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success("Job listing successfully removed.");
      setDeleteConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove job.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditJobSave = async () => {
    if (!editingJob) return;
    setIsSaving(true);
    try {
      const updated = await updateJob(editingJob.id, editForm);
      setMyJobs(prev => prev.map(j => j.id === editingJob.id ? { ...j, ...updated } : j));
      toast.success("Job listing updated.");
      setEditingJob(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update job.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCollab = async (projectId: number) => {
    setIsDeleting(true);
    try {
      await deleteCollabProject(projectId);
      setMyCollabProjects(prev => prev.filter(p => p.id !== projectId));
      toast.success("Collaboration workspace listing removed.");
      setDeleteConfirmCollabId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete collaboration.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditCollabSave = async () => {
    if (!editingCollabProject) return;
    setIsSaving(true);
    try {
      const updated = await updateCollabProject(editingCollabProject.id, editCollabForm);
      setMyCollabProjects(prev => prev.map(p => p.id === editingCollabProject.id ? { ...p, ...updated } : p));
      toast.success("Collaboration listing updated.");
      setEditingCollabProject(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update collaboration.");
    } finally {
      setIsSaving(false);
    }
  };

  const changeMainTab = (tab: "analytics" | "listings") => {
    setActiveMainTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  const changeSubTab = (subtab: "jobs" | "collabs" | "deals") => {
    setActiveListingsTab(subtab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("subtab", subtab);
      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24 pt-6 sm:px-6">
      
      {/* Header Banner */}
      <div className="mb-6 border-b border-slate-100 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#00A4EF]/10 flex items-center justify-center text-[#00A4EF]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Seller Workspace</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage your listings, track payouts, and view sales performance</p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1 shrink-0 self-start md:self-auto border border-slate-200/55 shadow-inner">
          <button
            onClick={() => changeMainTab("analytics")}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
              activeMainTab === "analytics" 
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/60" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Analytics & Payouts
          </button>
          <button
            onClick={() => changeMainTab("listings")}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
              activeMainTab === "listings" 
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/60" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Listings Management
          </button>
        </div>
      </div>

      {/* ─── TAB 1: ANALYTICS & SALES ─── */}
      {activeMainTab === "analytics" && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid gap-5 sm:grid-cols-3">
            {/* Total Wallet Payouts */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Earnings Paid</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-500 text-xs">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {isStatsLoading ? <Skeleton className="h-8 w-28 bg-slate-100" /> : formatCurrency(stats?.releasedEarningsBalance || 0)}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Credited directly to your wallet balance</p>
              </div>
            </div>

            {/* Locked Escrow Amount */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Locked in Escrow</span>
                <div className="p-1.5 rounded-lg bg-[#00A4EF]/15 text-[#00A4EF] text-xs">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {isStatsLoading ? <Skeleton className="h-8 w-28 bg-slate-100" /> : formatCurrency(stats?.pendingEscrowBalance || 0)}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Pending delivery validation or confirmation</p>
              </div>
            </div>

            {/* Total Sales Count */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Transactions</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 text-xs">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {isStatsLoading ? <Skeleton className="h-8 w-16 bg-slate-100" /> : stats?.totalSalesCount || 0}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Total products/services purchased</p>
              </div>
            </div>
          </div>

          {/* Sales History Log */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Recent Sales History</h3>
            </div>

            {isStatsLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(n => <Skeleton key={n} className="h-14 rounded-xl bg-slate-50" />)}
              </div>
            ) : !stats?.salesHistory || stats.salesHistory.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 font-medium">
                No sales records found. List your deals and share links to start earning!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="px-5 py-3">Deal Details</th>
                      <th className="px-5 py-3">Buyer Name</th>
                      <th className="px-5 py-3">Gross Sale</th>
                      <th className="px-5 py-3">Krovaa Fee (10%)</th>
                      <th className="px-5 py-3">Net Payout</th>
                      <th className="px-5 py-3">Escrow Status</th>
                      <th className="px-5 py-3 text-right">Sold Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {stats.salesHistory.map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/deal/transaction/${sale.id}`)}>
                        <td className="px-5 py-3.5 font-bold text-slate-900">{sale.title}</td>
                        <td className="px-5 py-3.5 text-slate-500">{sale.buyerName}</td>
                        <td className="px-5 py-3.5 font-mono">{formatCurrency(sale.grossAmount)}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-400">-{formatCurrency(sale.platformFee)}</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">{formatCurrency(sale.netPayout)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            sale.status === 'completed' || sale.status === 'released' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                            sale.status === 'active' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                            'bg-slate-50 text-slate-500 border border-slate-200'
                          }`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-400">
                          {new Date(sale.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: LISTINGS ─── */}
      {activeMainTab === "listings" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            {/* Sub-tab selection */}
            <div className="relative flex items-center bg-slate-100 border border-slate-200/50 rounded-xl p-1 shrink-0">
              <button
                onClick={() => changeSubTab("jobs")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                  activeListingsTab === "jobs" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Jobs
              </button>
              <button
                onClick={() => changeSubTab("collabs")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                  activeListingsTab === "collabs" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Collabs
              </button>
              {isBusiness && (
                <button
                  onClick={() => changeSubTab("deals")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                    activeListingsTab === "deals" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Deals
                </button>
              )}
            </div>

            {/* Utility drop-down menu */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-lg bg-white border-slate-200">
                    <LayoutGrid className="w-4 h-4 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-slate-200 shadow-lg rounded-xl min-w-[180px] p-1">
                  <DropdownMenuItem onClick={() => navigate("/saved-jobs")} className="cursor-pointer text-xs font-semibold py-2 px-3 text-slate-700 hover:text-slate-900 flex items-center gap-2 rounded-lg">
                    <Bookmark className="w-3.5 h-3.5 text-slate-400" /> Saved Listings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowHistory(!showHistory)} className="cursor-pointer text-xs font-semibold py-2 px-3 text-slate-700 hover:text-slate-900 flex items-center gap-2 rounded-lg">
                    <History className="w-3.5 h-3.5 text-slate-400" /> {showHistory ? "Hide History" : "View History"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Render Listings Tab Content */}
          {activeListingsTab === "jobs" && (
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
                                <div className="flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{Number(job.budget).toLocaleString('en-IN')}</span></div>
                                <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{formatPostedAgo(job.createdAt)}</span></div>
                              </div>
                            </div>
                            <div className="flex sm:flex-col items-center gap-1.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-50">
                              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg w-full bg-white border-slate-200" onClick={() => navigate(`/jobs/${job.id}`)}>
                                <Eye className="h-3.5 w-3.5 mr-1" /> View
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg w-full bg-white border-slate-200" onClick={() => { setEditingJob(job); setEditForm({ title: job.title, company: job.company, location: job.location, budget: job.budget, mode: job.mode, description: job.description }); }}>
                                <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                              </Button>
                              {deleteConfirmId === job.id ? (
                                <div className="flex gap-1 w-full">
                                  <Button variant="destructive" size="sm" className="h-8 text-xs font-bold rounded-lg flex-1" disabled={isDeleting} onClick={() => handleDeleteJob(job.id)}>Confirm</Button>
                                  <Button variant="outline" size="sm" className="h-8 px-2 rounded-lg bg-white border-slate-200" onClick={() => setDeleteConfirmId(null)}><X className="h-3.5 w-3.5" /></Button>
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 w-full" onClick={() => setDeleteConfirmId(job.id)}>
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

          {activeListingsTab === "collabs" && (
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
                    return (
                      <div key={project.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition-colors">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[140px]">{project.company || "Collab"}</span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                project.status === 'ACTIVE' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200'
                              }`}>{project.status}</span>
                            </div>
                            <h2 className="text-base font-bold text-slate-900 tracking-tight">{project.title}</h2>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-slate-500 pt-1">
                              <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{project.location}</span></div>
                              <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{project.duration}</span></div>
                              <div className="flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{Number(project.baseBudget).toLocaleString('en-IN')}</span></div>
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-center gap-1.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-50">
                            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg w-full bg-white border-slate-200" onClick={() => navigate(`/blueprint/${project.id}`)}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg w-full bg-white border-slate-200" onClick={() => {
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
                              <div className="flex gap-1 w-full">
                                <Button variant="destructive" size="sm" className="h-8 text-xs font-bold rounded-lg flex-1" disabled={isDeleting} onClick={() => handleDeleteCollab(project.id)}>Confirm</Button>
                                <Button variant="outline" size="sm" className="h-8 px-2 rounded-lg bg-white border-slate-200" onClick={() => setDeleteConfirmCollabId(null)}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 w-full" onClick={() => setDeleteConfirmCollabId(project.id)}>
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

          {activeListingsTab === "deals" && isBusiness && (
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
                  <Button size="sm" onClick={() => navigate("/deal/create")} className="bg-[#00A4EF] hover:bg-[#0087d1] text-white font-bold px-4 h-9 rounded-xl shadow">
                    + Create Deal
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myDeals.map(deal => (
                    <div key={deal.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-[#00A4EF]/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 truncate">{deal.title}</h3>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              deal.status === 'active' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200'
                            }`}>{deal.status}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <IndianRupee className="h-3.5 w-3.5 text-[#00A4EF]" />
                            <span className="text-sm font-black text-[#00A4EF]">{Number(deal.price).toLocaleString('en-IN')}</span>
                            <span className="text-[11px] text-slate-400 ml-2">· {deal.deliveryType}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 font-medium">
                            <span>👁 {deal.viewCount} views</span>
                            <span>💬 {deal._count?.inquiries ?? 0} inquiries</span>
                            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/60 font-bold">
                              📦 {deal._count?.escrowDeals ?? 0} orders placed
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold" onClick={() => handleCopyDealLink(deal)}>
                              {dealCopiedId === deal.id ? "Copied" : "Copy Link"}
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold" onClick={() => navigate(`/deal/${deal.shareCode}`)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline" size="sm"
                              className="h-7 px-2 text-[10px] font-bold"
                              disabled={dealStatusLoading === deal.id}
                              onClick={() => handleToggleDealStatus(deal)}
                            >
                              {deal.status === 'active' ? "Pause" : "Activate"}
                            </Button>
                            {dealDeleteConfirmId === deal.id ? (
                              <div className="flex gap-1">
                                <Button variant="destructive" size="sm" className="h-7 text-[10px] font-bold" disabled={isDealDeleting} onClick={() => handleDeleteDeal(deal.id)}>Confirm</Button>
                                <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setDealDeleteConfirmId(null)}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold text-rose-600 border-rose-200" onClick={() => setDealDeleteConfirmId(deal.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Editing Dialogs from MyListingsPage */}
      <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
        <DialogContent className="max-w-md bg-white border-slate-200 p-5 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight text-slate-900">Adjust Job Requirements</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Position Title</Label>
              <Input className="h-9 text-xs" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Corporate Hub / Entity</Label>
              <Input className="h-9 text-xs" value={editForm.company} onChange={e => setEditForm(p => ({ ...p, company: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Location Scope</Label>
                <Input className="h-9 text-xs" value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Capital Budget Pool</Label>
                <Input className="h-9 text-xs font-mono" value={editForm.budget} onChange={e => setEditForm(p => ({ ...p, budget: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Functional Role Description</Label>
              <Textarea rows={3} className="text-xs leading-relaxed" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="ghost" size="sm" className="h-9 text-xs font-bold text-slate-500" disabled={isSaving} onClick={() => setEditingJob(null)}>Cancel</Button>
            <Button size="sm" className="h-9 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800" disabled={isSaving} onClick={handleEditJobSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collaborative Blueprint Parameter Editor */}
      <Dialog open={!!editingCollabProject} onOpenChange={(open) => !open && setEditingCollabProject(null)}>
        <DialogContent className="max-w-xl bg-white border-slate-200 p-5 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight text-slate-900">Modify Collab Workspace Blueprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Workspace Title</Label>
              <Input className="h-9 text-xs" value={editCollabForm.title} onChange={e => setEditCollabForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Entity Organization</Label>
                <Input className="h-9 text-xs" value={editCollabForm.company} onChange={e => setEditCollabForm(p => ({ ...p, company: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Work Mode</Label>
                <select value={editCollabForm.workMode} onChange={e => setEditCollabForm(p => ({ ...p, workMode: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs outline-hidden text-slate-800">
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Onsite">Onsite</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Ecosystem Scope Description</Label>
              <Textarea rows={3} className="text-xs leading-relaxed" value={editCollabForm.description} onChange={e => setEditCollabForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button variant="ghost" size="sm" className="h-9 text-xs font-bold text-slate-500" disabled={isSaving} onClick={() => setEditingCollabProject(null)}>Cancel</Button>
            <Button size="sm" className="h-9 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800" disabled={isSaving} onClick={handleEditCollabSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
