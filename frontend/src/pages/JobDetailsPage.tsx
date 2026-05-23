import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, MessageSquare, User, Trash2, Plus, ArrowUp, ArrowDown, Edit2, Save, X } from "lucide-react";
import { getJob, JobDetails, applyJob, sendMessage, updateJobTerms } from "../lib/api";
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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showBidDialog, setShowBidDialog] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [isApplied, setIsApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBidding, setIsBidding] = useState(false);

  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [editingTerms, setEditingTerms] = useState<string[]>([]);
  const [isSavingTerms, setIsSavingTerms] = useState(false);

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

  const startEditingTerms = () => {
    if (job) {
      const initialTerms = Array.isArray(job.terms)
        ? job.terms
        : typeof job.terms === 'string' && job.terms
          ? [job.terms]
          : [];
      setEditingTerms(initialTerms.length > 0 ? initialTerms : [""]);
      setIsEditingTerms(true);
    }
  };

  const handleTermChange = (index: number, value: string) => {
    const newTerms = [...editingTerms];
    newTerms[index] = value;
    setEditingTerms(newTerms);
  };

  const addTerm = () => {
    setEditingTerms([...editingTerms, ""]);
  };

  const removeTerm = (index: number) => {
    const newTerms = editingTerms.filter((_, i) => i !== index);
    setEditingTerms(newTerms.length > 0 ? newTerms : [""]);
  };

  const moveTermUp = (index: number) => {
    if (index === 0) return;
    const newTerms = [...editingTerms];
    const temp = newTerms[index];
    newTerms[index] = newTerms[index - 1];
    newTerms[index - 1] = temp;
    setEditingTerms(newTerms);
  };

  const moveTermDown = (index: number) => {
    if (index === editingTerms.length - 1) return;
    const newTerms = [...editingTerms];
    const temp = newTerms[index];
    newTerms[index] = newTerms[index + 1];
    newTerms[index + 1] = temp;
    setEditingTerms(newTerms);
  };

  const saveTerms = async () => {
    if (!job) return;
    setIsSavingTerms(true);
    try {
      const filteredTerms = editingTerms.map(t => t.trim()).filter(Boolean);
      await updateJobTerms(job.id, filteredTerms);
      setJob(prev => prev ? { ...prev, terms: filteredTerms } : null);
      setIsEditingTerms(false);
      toast.success("Terms & Conditions updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save terms.");
    } finally {
      setIsSavingTerms(false);
    }
  };

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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-950">Terms & Conditions</h2>
              {job.isOwner && !isEditingTerms && (
                <button
                  type="button"
                  onClick={startEditingTerms}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Edit2 className="h-3 w-3" /> Edit Terms
                </button>
              )}
            </div>

            <div className="mt-4">
              {job.isOwner && isEditingTerms ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {editingTerms.map((term, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          value={term}
                          onChange={(e) => handleTermChange(index, e.target.value)}
                          placeholder={`Term #${index + 1} (e.g. Must complete task before deadline)`}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-2 focus:ring-[#00A4EF]/20"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveTermUp(index)}
                            disabled={index === 0}
                            className="p-2 text-slate-400 hover:text-slate-700 transition disabled:opacity-30 disabled:hover:text-slate-400"
                            title="Move Up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTermDown(index)}
                            disabled={index === editingTerms.length - 1}
                            className="p-2 text-slate-400 hover:text-slate-700 transition disabled:opacity-30 disabled:hover:text-slate-400"
                            title="Move Down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTerm(index)}
                            className="p-2 text-slate-400 hover:text-rose-600 transition"
                            title="Remove Term"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={addTerm}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#00A4EF] hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Add Term
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => setIsEditingTerms(false)}
                        className="rounded-full px-4 py-2 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={saveTerms}
                        disabled={isSavingTerms}
                        className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs flex items-center gap-1"
                      >
                        <Save className="h-3.5 w-3.5" /> Save Terms
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {job.terms && (Array.isArray(job.terms) ? job.terms : [job.terms]).length > 0 ? (
                    <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
                      {(Array.isArray(job.terms) ? job.terms : [job.terms]).map((term, index) => (
                        <li key={index}>{term}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <p className="text-sm text-slate-500 mb-3">No terms and conditions provided.</p>
                      {job.isOwner && (
                        <button
                          type="button"
                          onClick={startEditingTerms}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-semibold text-white transition shadow-md"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Terms
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                  <p className="text-center text-sm font-bold text-slate-900 mb-2">
                    Are you sure you want to apply?
                  </p>
                  
                  {/* Show all Terms & Conditions clearly */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left max-h-40 overflow-y-auto w-full">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-[0.1em] mb-2">Job Terms & Conditions</p>
                    {job.terms && (Array.isArray(job.terms) ? job.terms : [job.terms]).length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        {(Array.isArray(job.terms) ? job.terms : [job.terms]).map((term, index) => (
                          <li key={index}>{term}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">No terms and conditions provided.</p>
                    )}
                  </div>

                  {/* Checkbox */}
                  <label className="flex items-start gap-2.5 text-sm text-slate-700 select-none cursor-pointer mt-1 text-left w-full">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(event) => setAgreedToTerms(event.target.checked)}
                      className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="leading-tight">I agree to the Terms & Conditions</span>
                  </label>

                  <div className="flex gap-3 w-full mt-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-2xl border-slate-200 h-12 text-base font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
                      onClick={() => setShowConfirmation(false)}
                    >
                      Close
                    </Button>
                    <Button
                      disabled={isSubmitting}
                      className={`flex-1 rounded-2xl h-12 text-base font-semibold text-white shadow-lg transition-all active:scale-[0.98] ${
                        !agreedToTerms 
                          ? "bg-slate-300 hover:bg-slate-300 text-slate-500 cursor-not-allowed shadow-none" 
                          : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                      }`}
                      onClick={async () => {
                        if (!job) return;
                        if (!agreedToTerms) {
                          toast.error("Please accept the Terms & Conditions.");
                          return;
                        }
                        setIsSubmitting(true);
                        try {
                          const termsString = Array.isArray(job.terms) 
                            ? job.terms.join('\n') 
                            : typeof job.terms === 'string' 
                              ? job.terms 
                              : '';
                          await applyJob(job.id, termsString);
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
