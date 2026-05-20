import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, MessageSquare, User } from "lucide-react";
import { getJob, JobDetails, applyJob, sendMessage } from "../lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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
  const [job, setJob] = useState<JobDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [showBidDialog, setShowBidDialog] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [isApplied, setIsApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBidding, setIsBidding] = useState(false);

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
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load job details.");
      } finally {
        setIsLoading(false);
      }
    };

    loadJob();
  }, [jobId]);

  const handleSendBid = async () => {
    if (!job || !user) return;
    if (!bidAmount.trim() || !bidMessage.trim()) {
      toast.error("Please add a bid amount and message.");
      return;
    }

    setIsBidding(true);
    try {
      const chatId = `chat_${user.id}_${job.postedBy.id}_${Date.now()}`;
      const content = `Hi, I'd like to bid ₹${bidAmount.trim()} for your project \"${job.title}\".\n\n${bidMessage.trim()}`;

      await sendMessage({
        receiver_id: job.postedBy.id,
        chat_id: chatId,
        content,
      });

      toast.success("Bid sent successfully. The project owner will review it shortly.");
      setShowBidDialog(false);
      setBidAmount("");
      setBidMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send bid.");
    } finally {
      setIsBidding(false);
    }
  };

  return (
    <div className="px-4 pb-48 pt-4 sm:px-6 relative">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to listings
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
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
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{job.company}</p>
                  <h1 className="mt-2 text-3xl font-semibold text-slate-950">{job.title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>{job.location}</span>
                  <span>•</span>
                  <span>{job.mode}</span>
                  <span>•</span>
                  <span>{job.budget}</span>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Posted</p>
                  <p className="mt-2">{formatPostedAt(job.createdAt)}</p>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Posted by</p>
                <p className="mt-3 text-sm text-slate-900">{job.postedBy.displayName || job.postedBy.username}</p>
                {job.postedBy.profession && <p className="mt-1 text-sm text-slate-600">{job.postedBy.profession}</p>}
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">Joined</p>
                <p className="mt-1 text-sm text-slate-600">{new Date(job.postedBy.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
              <p>{job.description}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Candidate details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</p>
                <p className="mt-2 text-sm text-slate-900">{job.postedBy.displayName || job.postedBy.username}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Username</p>
                <p className="mt-2 text-sm text-slate-900">@{job.postedBy.username}</p>
              </div>
              {job.postedBy.profession && (
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profession</p>
                  <p className="mt-2 text-sm text-slate-900">{job.postedBy.profession}</p>
                </div>
              )}
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Location</p>
                <p className="mt-2 text-sm text-slate-900">{job.postedBy.city || "Not specified"}</p>
              </div>
            </div>

            {job.postedBy.bio && (
              <div className="mt-6 rounded-3xl bg-slate-50 p-6 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">About candidate</p>
                <p className="mt-2">{job.postedBy.bio}</p>
              </div>
            )}
          </section>

          {job.isOwner && job.applications && (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-950">Applicants ({job.applications.length})</h2>
              </div>

              {job.applications.length === 0 ? (
                <div className="text-center py-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                  <p className="text-sm text-slate-500 font-medium">No applications yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {job.applications.map((app: any) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                          {app.user.avatarUrl ? (
                            <img src={app.user.avatarUrl} alt={app.user.displayName} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {app.user.displayName || app.user.username}
                          </p>
                          <p className="text-xs text-slate-500">@{app.user.username}</p>
                          {app.user.profession && (
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-indigo-500 mt-1">
                              {app.user.profession}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl h-9 px-4 border-slate-200 hover:bg-white hover:text-indigo-600 hover:border-indigo-200 transition-all"
                          onClick={() => navigate(`/chat`)} // Simple redirect to messages for now
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Message
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* We will render the success modal as a fixed overlay instead of inline */}
        </div>
      )}

      {/* Success Modal Dialogue */}
      <AnimatePresence>
        {isApplied && (
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
                  onClick={() => setIsApplied(false)} // allows them to dismiss the modal and stay on page
                >
                  Close
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

      {job && !isLoading && !error && !job.isOwner && !isApplied && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 py-4 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] sm:px-6">
          <div className="mx-auto max-w-2xl">
            <AnimatePresence mode="wait">
              {!showConfirmation && !showBidDialog ? (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl border-slate-200 h-12 text-base font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
                    onClick={() => navigate(-1)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl border-slate-200 h-12 text-base font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
                    onClick={() => setShowBidDialog(true)}
                  >
                    Bid Project
                  </Button>
                  <Button
                    className="flex-1 rounded-2xl bg-slate-950 h-12 text-base font-semibold text-white hover:bg-slate-800 shadow-lg shadow-slate-200 active:scale-[0.98] transition-all"
                    onClick={() => setShowConfirmation(true)}
                  >
                    Apply
                  </Button>
                </motion.div>
              ) : showBidDialog ? (
                <motion.div
                  key="bid"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">Bid on this project</p>
                    <p className="text-xs text-slate-500">Send the project owner a bid amount and message.</p>
                  </div>
                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-semibold">Bid amount</span>
                      <input
                        type="text"
                        value={bidAmount}
                        onChange={(event) => setBidAmount(event.target.value)}
                        placeholder="₹ 5,000"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-semibold">Message</span>
                      <textarea
                        value={bidMessage}
                        onChange={(event) => setBidMessage(event.target.value)}
                        rows={4}
                        placeholder="Tell the project owner why you are the right fit."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-2xl border-slate-200 h-12 text-base font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
                      onClick={() => setShowBidDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isBidding}
                      className="flex-1 rounded-2xl bg-indigo-600 h-12 text-base font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all disabled:opacity-70"
                      onClick={handleSendBid}
                    >
                      {isBidding ? "Sending bid..." : "Send Bid"}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="confirmation"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-4"
                >
                  <p className="text-center text-sm font-bold text-slate-900">
                    Are you sure you want to apply?
                  </p>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-semibold">Terms and Conditions</span>
                    <textarea
                      value={termsAndConditions}
                      onChange={(event) => setTermsAndConditions(event.target.value)}
                      rows={3}
                      placeholder="Enter any terms and conditions for this application..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-2xl border-slate-200 h-12 text-base font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
                      onClick={() => setShowConfirmation(false)}
                    >
                      Close
                    </Button>
                    <Button
                      disabled={isSubmitting}
                      className="flex-1 rounded-2xl bg-indigo-600 h-12 text-base font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all disabled:opacity-70"
                      onClick={async () => {
                        if (!job) return;
                        setIsSubmitting(true);
                        try {
                          await applyJob(job.id, termsAndConditions);
                          setIsApplied(true);
                          toast.success("Application submitted and message sent to poster!");
                          // Keep isApplied true so it stays in the success state
                          setShowConfirmation(false);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to submit application");
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                    >
                      {isSubmitting ? "Applying..." : "Apply"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetailsPage;
