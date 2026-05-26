import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Edit3, Trash2, Eye, Users, IndianRupee, Briefcase, MapPin, Clock, AlertTriangle, X } from "lucide-react";
import { getMyJobs, deleteJob, MyJob, updateJob } from "../lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const formatPostedAgo = (createdAt: string) => {
  const diffMinutes = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hrs ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const MyListingsPage = () => {
  const navigate = useNavigate();
  const [myJobs, setMyJobs] = useState<MyJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingJob, setEditingJob] = useState<MyJob | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    company: "",
    location: "",
    budget: "",
    mode: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
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
    loadMyJobs();
  }, []);

  const totalApplications = myJobs.reduce((sum, j) => sum + j.applicationCount, 0);
  const totalBids = myJobs.reduce((sum, j) => {
    if (!j.applications) return sum;
    return sum + j.applications.filter(a => a.bidAmount).length;
  }, 0);

  const handleDelete = async (jobId: number) => {
    setIsDeleting(true);
    try {
      await deleteJob(jobId);
      setMyJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success("Job listing deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete job.");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const openEdit = (job: MyJob) => {
    setEditingJob(job);
    setEditForm({
      title: job.title,
      company: job.company,
      location: job.location,
      budget: job.budget,
      mode: job.mode,
      description: job.description,
    });
  };

  const handleEditSave = async () => {
    if (!editingJob) return;
    if (!editForm.title.trim() || !editForm.company.trim() || !editForm.location.trim() || !editForm.budget.trim() || !editForm.description.trim()) {
      toast.error("All fields are required.");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateJob(editingJob.id, editForm);
      setMyJobs(prev => prev.map(j => j.id === editingJob.id ? { ...j, ...updated } : j));
      toast.success("Job updated.");
      setEditingJob(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update job.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-28 pt-6 sm:px-6">
      <div className="mb-8 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => navigate("/explore")}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to listings
          </button>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">My Listings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your posted jobs, view applications, and track engagement.</p>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-12 text-center text-sm text-slate-500 animate-pulse">
          Loading your listings...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          {error}
        </div>
      ) : myJobs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/30 p-12 text-center text-sm text-slate-500">
          <div className="mb-4 text-slate-300">
            <Briefcase className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-base font-semibold text-slate-600 mb-1">No job listings yet</p>
          <p className="text-sm text-slate-400 mb-6">Post your first job to start receiving applications.</p>
          <Button
            onClick={() => navigate("/post-job")}
            className="rounded-2xl bg-[#00A4EF] hover:bg-[#0087d1]"
          >
            Post a Job
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Jobs</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{myJobs.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Applications</p>
              <p className="mt-1 text-3xl font-bold text-[#00A4EF]">{totalApplications}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Bids Received</p>
              <p className="mt-1 text-3xl font-bold text-amber-600">{totalBids}</p>
            </div>
          </div>

          <div className="space-y-4">
            {myJobs.map((job) => {
              const pendingApps = job.applications?.filter(a => a.status === "pending").length || 0;
              const hasBids = job.applications?.some(a => a.bidAmount) || false;

              return (
                <div
                  key={job.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{job.company}</span>
                        {pendingApps > 0 && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            {pendingApps} pending
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1 text-base font-bold text-slate-950 tracking-tight">{job.title}</h2>

                      <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-[11px] font-medium text-slate-500 mt-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{job.location}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                          <span>{job.mode}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <IndianRupee className="h-3.5 w-3.5 text-slate-400" />
                          <span>{job.budget}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatPostedAgo(job.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <div className="flex items-center gap-1 text-xs font-semibold text-[#00A4EF] bg-[#E8F4FF] px-2.5 py-1 rounded-lg">
                          <Users className="h-3.5 w-3.5" />
                          <span>{job.applicationCount} applicant{job.applicationCount === 1 ? "" : "s"}</span>
                        </div>
                        {hasBids && (
                          <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                            <IndianRupee className="h-3.5 w-3.5" />
                            <span>Bids available</span>
                          </div>
                        )}
                      </div>

                      {job.applications && job.applications.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Recent Applicants</p>
                          <div className="flex flex-wrap gap-2">
                            {job.applications.slice(0, 5).map((app) => (
                              <div
                                key={app.id}
                                className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg"
                              >
                                <span className="font-medium text-slate-700">{app.user.displayName || app.user.username}</span>
                                {app.bidAmount && (
                                  <span className="text-amber-600 font-semibold">₹{app.bidAmount}</span>
                                )}
                                <span className={`text-[10px] font-semibold uppercase ${
                                  app.status === "pending" ? "text-amber-500" :
                                  app.status === "accepted" ? "text-green-600" :
                                  app.status === "rejected" ? "text-red-500" : "text-slate-400"
                                }`}>
                                  {app.status}
                                </span>
                              </div>
                            ))}
                            {job.applications.length > 5 && (
                              <span className="text-xs text-slate-400">+{job.applications.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-slate-200 text-xs h-9 px-3"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-slate-200 text-xs h-9 px-3"
                        onClick={() => openEdit(job)}
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                      {deleteConfirmId === job.id ? (
                        <div className="flex gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-xl text-xs h-9 px-3"
                            disabled={isDeleting}
                            onClick={() => handleDelete(job.id)}
                          >
                            {isDeleting ? "..." : "Confirm"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-slate-200 text-xs h-9 px-3"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 text-xs h-9 px-3"
                          onClick={() => setDeleteConfirmId(job.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditingJob(null)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-6">Edit Job Listing</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Company</label>
                <input
                  type="text"
                  value={editForm.company}
                  onChange={e => setEditForm(p => ({ ...p, company: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Budget</label>
                  <input
                    type="text"
                    value={editForm.budget}
                    onChange={e => setEditForm(p => ({ ...p, budget: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Mode</label>
                <select
                  value={editForm.mode}
                  onChange={e => setEditForm(p => ({ ...p, mode: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Onsite">Onsite</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1 rounded-2xl border-slate-200 h-12 font-semibold"
                onClick={() => setEditingJob(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={isSaving}
                className="flex-1 rounded-2xl bg-[#00A4EF] h-12 font-semibold text-white hover:bg-[#0087d1] disabled:opacity-70"
                onClick={handleEditSave}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyListingsPage;
