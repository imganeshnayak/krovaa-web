import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileText, MessageSquare, Paperclip, User, Calendar, MapPin, Briefcase, IndianRupee, Clock, Code2, Share2, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getJob, applyJob, withdrawJobApplication, JobDetails } from "@/lib/api";
import ShareJobDialog from "../components/ShareJobDialog";
import { JobSaveButton } from "@/components/JobSaveButton";

const formatPostedAt = (createdAt: string) => {
  return new Date(createdAt).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const JobDetailsPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<(JobDetails & { skills?: string[]; duration?: string }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyBidAmount, setApplyBidAmount] = useState("");
  const [applyCoverLetter, setApplyCoverLetter] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [isApplied, setIsApplied] = useState(false);
  const [justApplied, setJustApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userApplication, setUserApplication] = useState<any>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showAuthPromptModal, setShowAuthPromptModal] = useState(false);
  const isJobOwner = Boolean(user && job && job.postedBy.id === user.id);

  useEffect(() => {
    const loadJob = async () => {
      if (!jobId) {
        setError("Invalid job selected.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const jobData = await getJob(Number(jobId));
        setJob(jobData);
        if (jobData.hasApplied) {
          setIsApplied(true);
          if (user && jobData.applications) {
            const userApp = jobData.applications.find((app: any) => app.userId === user.id);
            if (userApp) {
              setUserApplication(userApp);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load job details.");
      } finally {
        setIsLoading(false);
      }
    };

    loadJob();
  }, [jobId, user]);

  const openApplyModal = () => {
    if (!user) {
      setShowAuthPromptModal(true);
      return;
    }
    setApplyBidAmount("");
    setApplyCoverLetter("");
    setTermsAndConditions("");
    setShowApplyModal(true);
  };

  const handleApply = async () => {
    if (!job) return;
    if (!applyBidAmount.trim() || !applyCoverLetter.trim()) {
      toast.error("Please enter a bid amount and cover letter.");
      return;
    }

    setIsSubmitting(true);
    try {
      await applyJob(job.id, {
        bidAmount: applyBidAmount.trim(),
        coverLetter: applyCoverLetter.trim(),
        termsAndConditions: termsAndConditions.trim() || undefined,
      });
      setIsApplied(true);
      setJustApplied(true);
      const updatedJobData = await getJob(Number(jobId));
      setJob(updatedJobData);
      if (user && updatedJobData.applications) {
        const userApp = updatedJobData.applications.find((app: any) => app.userId === user.id);
        if (userApp) {
          setUserApplication(userApp);
        }
      }
      toast.success("Application submitted successfully!");
      setShowApplyModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    if (!job) return;

    const confirmWithdraw = window.confirm(
      "Are you sure you want to withdraw your application and cancel your bid? This action cannot be undone."
    );
    if (!confirmWithdraw) return;

    setIsWithdrawing(true);
    try {
      await withdrawJobApplication(job.id);
      setIsApplied(false);
      setUserApplication(null);

      // Reload job data to refresh public applications list
      const updatedJobData = await getJob(Number(jobId));
      setJob(updatedJobData);

      toast.success("Application withdrawn successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to withdraw application");
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pb-48 pt-6 sm:px-6 relative">
      {/* Navigation Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to listings
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-12 text-center text-sm text-slate-500 animate-pulse">
          Loading job details...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          {error}
        </div>
      ) : !job ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          Job details not found.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Layout Grid */}
          <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
            
            {/* Primary Content Container Block */}
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 uppercase tracking-wider">
                      {job.company}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowShareDialog(true)}
                        className="rounded-xl border-slate-200 text-xs font-semibold gap-1.5 hover:text-[#00A4EF] hover:border-[#00A4EF]/30"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share Job
                      </Button>
                      <JobSaveButton jobId={job.id} className="p-1" />
                    </div>
                  </div>
                  <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{job.title}</h1>
                  
                  {/* Dynamic Metadata Container Row */}
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-slate-600 mt-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                      <span>{job.mode}</span>
                    </div>
                    {job.duration && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{job.duration}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <IndianRupee className="h-4 w-4 text-slate-500" />
                      <span>{job.budget}</span>
                    </div>
                  </div>
                </div>

                {/* Displaying Target Input Array Badges (Skills Mapped) */}
                {job.skills && job.skills.length > 0 && (
                  <div className="border-t border-slate-100 pt-5 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5" />
                      Target Expertise Mapped
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {job.skills.map((skill, index) => (
                        <span 
                          key={`${skill}-${index}`}
                          className="text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200/60 px-2.5 py-1 rounded-lg"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description Scope Text Block */}
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Project Specifications</h3>
                  <div className="text-sm leading-7 text-slate-600 whitespace-pre-wrap font-normal">
                    {job.description}
                  </div>
                </div>

                {/* Terms and Conditions Block */}
                {job.terms && job.terms.length > 0 && (
                  <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Terms & Conditions</h3>
                    <div className="text-sm leading-7 text-slate-600 whitespace-pre-wrap font-normal">
                      {job.terms.join('\n')}
                    </div>
                  </div>
                )}

                {/* Render Attached Reference Media & Assets Grid */}
                {job.attachments && job.attachments.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Paperclip className="h-4 w-4 text-slate-500" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Project Reference Documentation ({job.attachments.length})</h2>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {job.attachments.map((attachment) => {
                        const isImage = attachment.mimeType.startsWith("image/");

                        return (
                          <a
                            key={attachment.id}
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
                          >
                            {isImage ? (
                              <img
                                src={attachment.fileUrl}
                                alt={attachment.fileName}
                                className="h-32 w-full object-cover border-b border-slate-100"
                              />
                            ) : (
                              <div className="flex h-32 items-center justify-center bg-slate-100 text-slate-400 border-b border-slate-100">
                                <FileText className="h-8 w-8 text-slate-400" />
                              </div>
                            )}

                            <div className="p-3 bg-white">
                              <p className="truncate text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {attachment.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{attachment.mimeType}</p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* User Application Progress Tracking Card */}
              {isApplied && userApplication && (
                <section className="rounded-3xl border border-indigo-100 bg-indigo-50/10 p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">Your Submitted Application</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Application Date</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {new Date(userApplication.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {userApplication.bidAmount && (
                      <div className="rounded-2xl border border-slate-100 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your Bid</p>
                        <p className="mt-1 text-sm font-bold text-amber-700">₹{userApplication.bidAmount}</p>
                      </div>
                    )}
                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Status</p>
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 capitalize mt-1">
                        {userApplication.status}
                      </span>
                    </div>
                  </div>
                  {userApplication.coverLetter && (
                    <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Your Cover Letter</p>
                      <p className="whitespace-pre-wrap text-slate-600 leading-relaxed text-xs">{userApplication.coverLetter}</p>
                    </div>
                  )}
                  {userApplication.terms && (
                    <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Your Proposed Terms</p>
                      <p className="whitespace-pre-wrap text-slate-600 leading-relaxed text-xs">{userApplication.terms}</p>
                    </div>
                  )}
                </section>
              )}

              {/* Public Bids & Proposals Board */}
              {job.applications && (
                <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Active Bids & Proposals</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Public offers submitted by creators</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                      {job.applications.length} {job.applications.length === 1 ? 'Bid' : 'Bids'}
                    </span>
                  </div>

                  {job.applications.length === 0 ? (
                    <div className="text-center py-12 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400 font-medium">No bids have been submitted yet. Be the first to apply!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {job.applications.map((app: any) => (
                        <div
                          key={app.id}
                          className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 sm:p-5 hover:border-slate-200 hover:bg-slate-50/50 transition-all duration-200 space-y-4"
                        >
                          {/* Top row: Profile & Bid Amount */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <a href={`/profile/${app.user.username}`} className="flex items-center gap-3 group shrink-0">
                                <div className="h-11 w-11 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                  {app.user.avatarUrl ? (
                                    <img src={app.user.avatarUrl} alt={app.user.displayName || app.user.username} className="h-full w-full object-cover" />
                                  ) : (
                                    <User className="h-5 w-5 text-slate-400" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                    {app.user.displayName || app.user.username}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {app.user.profession ? `${app.user.profession} • ` : ''}@{app.user.username}
                                  </p>
                                </div>
                              </a>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-center">
                              {app.bidAmount && (
                                <div className="inline-flex items-center rounded-xl bg-amber-50 border border-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                                  <span className="text-[10px] text-amber-500 font-semibold mr-0.5">Bid:</span>
                                  ₹{app.bidAmount}
                                </div>
                              )}
                              {app.createdAt && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {new Date(app.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Cover Letter & Terms (Proposals) */}
                          <div className="space-y-2.5">
                            {app.coverLetter && (
                              <div className="bg-white rounded-xl p-3 border border-slate-100/80 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Proposal / Pitch</span>
                                {app.coverLetter}
                              </div>
                            )}

                            {app.terms && (
                              <div className="bg-indigo-50/20 rounded-xl p-3 border border-indigo-100/50 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-indigo-500 mb-1">Proposed Terms & Conditions</span>
                                {app.terms}
                              </div>
                            )}
                          </div>

                          {/* Action Footer: Message Button */}
                          {user && app.userId !== user.id && (
                            <div className="flex justify-end pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl h-8 px-3 border-slate-200 hover:bg-slate-50 hover:text-indigo-600 hover:border-slate-300 text-[11px] font-semibold transition-all"
                                onClick={() => navigate(`/chat`)}
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-slate-400 group-hover:text-indigo-500" />
                                Message Applicant
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Sidebar Structural Deck Area */}
            <aside className="space-y-6 lg:sticky lg:top-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                
                {/* Meta Configuration Parameters */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <Calendar className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date Posted</p>
                      <p className="text-xs font-medium text-slate-800 mt-0.5">{formatPostedAt(job.createdAt)}</p>
                    </div>
                  </div>

                  {job.deadline && (
                    <div className="flex items-center gap-3 border-t border-slate-50 pt-3">
                      <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                        <Clock className="h-4 w-4 text-rose-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 font-semibold">Application Deadline</p>
                        <p className="text-xs font-bold text-rose-700 mt-0.5">
                          {new Date(job.deadline).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <hr className="border-slate-100" />

                {/* Inline Client Credentials Context */}
                <div className="space-y-4">
                  <a href={`/profile/${job.postedBy.username}`} className="flex items-center gap-3 group">
                    <div className="h-11 w-11 rounded-full bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {job.postedBy.avatarUrl ? (
                        <img 
                          src={job.postedBy.avatarUrl} 
                          alt={job.postedBy.displayName || job.postedBy.username} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Project Client</p>
                      <p className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors mt-0.5">
                        {job.postedBy.displayName || job.postedBy.username}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">@{job.postedBy.username}</p>
                    </div>
                  </a>

                  {job.postedBy.profession && (
                    <div className="text-[10px] uppercase font-semibold bg-slate-50 text-slate-600 px-2 py-1 rounded-md inline-block">
                      {job.postedBy.profession}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-600 leading-relaxed bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Client Bio</span>
                    {job.postedBy.bio ? job.postedBy.bio : "No biographical details provided."}
                  </div>

                  <div className="text-[10px] text-slate-400 font-medium pl-1">
                    Member since {new Date(job.postedBy.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Apply / Withdraw Actions Sidebar Deck */}
                {!isJobOwner && (
                  <div className="hidden lg:block">
                    <hr className="border-slate-100 mb-6" />
                    {!isApplied ? (
                      <Button
                        className="w-full rounded-2xl bg-primary h-12 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-lg active:scale-[0.98] transition-all"
                        onClick={openApplyModal}
                      >
                        Apply Now
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 border border-indigo-100">
                          <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span className="text-xs font-semibold text-indigo-700 font-medium">Application Active</span>
                        </div>
                        <Button
                          className="w-full rounded-2xl bg-rose-600 hover:bg-rose-700 h-12 text-sm font-semibold text-white shadow-lg shadow-rose-950/10 active:scale-[0.98] transition-all disabled:opacity-75"
                          onClick={handleWithdraw}
                          disabled={isWithdrawing}
                        >
                          {isWithdrawing ? "Withdrawing..." : "Withdraw Bid & Cancel"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </aside>

          </div>
        </div>
      )}

      {/* Dynamic Overlay Dialog Modal - only shows right after a fresh submission */}
      <AnimatePresence>
        {justApplied && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
              <div className="h-20 w-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm">
                <CheckCircle2 className="h-10 w-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Application Sent!</h2>
              <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                Your application has been successfully submitted. We've notified the job poster and started a chat for you.
              </p>
              <div className="flex w-full gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl border-slate-200 h-12 font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                  onClick={() => setJustApplied(false)}
                >
                  Dismiss
                </Button>
                <Button
                  className="flex-1 rounded-2xl bg-indigo-600 h-12 font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                  onClick={() => navigate('/chat')}
                >
                  View Chat
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Sticky Footer Actions Deck */}
      <AnimatePresence>
        {job && !isLoading && !error && !isJobOwner && !showApplyModal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-[60px] md:bottom-0 left-0 right-0 z-40 px-4 py-4 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 lg:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.04)]"
          >
            {!isApplied ? (
              <Button
                className="w-full rounded-2xl bg-primary h-12 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-lg active:scale-[0.98] transition-all"
                onClick={openApplyModal}
              >
                Apply Now
              </Button>
            ) : (
              <Button
                className="w-full rounded-2xl bg-rose-600 hover:bg-rose-700 h-12 text-sm font-semibold text-white shadow-lg active:scale-[0.98] transition-all"
                onClick={handleWithdraw}
                disabled={isWithdrawing}
              >
                {isWithdrawing ? "Withdrawing..." : "Withdraw Bid & Cancel"}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apply Dialog Modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="sm:max-w-[500px] p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Apply for this position</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Enter your bid amount and why you're the right fit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 mt-4">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Bid Amount <span className="text-rose-500">*</span>
              </span>
              <div className="relative">
                <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={applyBidAmount}
                  onChange={(e) => setApplyBidAmount(e.target.value)}
                  placeholder="5,000"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Cover Letter <span className="text-rose-500">*</span>
              </span>
              <textarea
                value={applyCoverLetter}
                onChange={(e) => setApplyCoverLetter(e.target.value)}
                rows={4}
                placeholder="Tell the project owner why you are the right fit..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Terms &amp; Conditions (Optional)
              </span>
              <textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={3}
                placeholder="Any specific terms you'd like to propose..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-slate-200 h-11 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
              onClick={() => setShowApplyModal(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-indigo-600 h-11 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md transition-all disabled:opacity-70"
              onClick={handleApply}
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Job Dialog */}
      {job && showShareDialog && (
        <ShareJobDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          jobId={job.id}
          jobTitle={job.title}
          companyName={job.company}
        />
      )}

      {/* Authentication Required Dialog Modal */}
      <Dialog open={showAuthPromptModal} onOpenChange={setShowAuthPromptModal}>
        <DialogContent className="sm:max-w-[440px] p-6 rounded-[2rem] border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xl">
          <DialogHeader className="space-y-1">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#00A4EF]/10 text-[#00A4EF] mb-2 animate-bounce">
              <User className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-center text-slate-900">Authentication Required</DialogTitle>
            <DialogDescription className="text-sm text-center text-slate-500">
              You must log in or create a free account to apply for jobs and submit bids.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button
              className="w-full rounded-2xl bg-[#00A4EF] h-12 text-sm font-semibold text-white hover:bg-[#0087d1] shadow-md transition-all active:scale-[0.98]"
              onClick={() => {
                setShowAuthPromptModal(false);
                navigate(`/login?redirect=/jobs/${jobId}`);
              }}
            >
              Sign In to Your Account
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-2xl border-slate-200 h-12 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]"
              onClick={() => {
                setShowAuthPromptModal(false);
                navigate(`/register?redirect=/jobs/${jobId}`);
              }}
            >
              Create a Free Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobDetailsPage;