import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Job, postJob } from "../lib/api";

const PostJobPage = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [mode, setMode] = useState("Remote");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<Job | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const job = await postJob({ title, company, location, budget, mode, description });
      setCreatedJob(job);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 pb-6 pt-4 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </button>
          <h1 className="text-2xl font-semibold text-slate-950">Post a job</h1>
          <p className="text-sm text-slate-500">Create a new job listing for others to discover.</p>
        </div>
      </div>

      <div className="space-y-6">
        {submitted ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-slate-900 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle className="h-6 w-6" />
              <div>
                <p className="font-semibold">Job posted successfully.</p>
                <p className="text-sm text-slate-600">Your listing has been saved to the backend.</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm text-slate-700">
              <p><strong>Title:</strong> {createdJob?.title || title}</p>
              <p><strong>Company:</strong> {createdJob?.company || company}</p>
              <p><strong>Location:</strong> {createdJob?.location || location}</p>
              <p><strong>Mode:</strong> {createdJob?.mode || mode}</p>
              <p><strong>Budget:</strong> {createdJob?.budget || budget}</p>
              <p><strong>Description:</strong> {createdJob?.description || description}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {error && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            )}
            <label className="space-y-2 text-sm text-slate-700">
              <span>Job title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Product designer for marketplace app"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-2 focus:ring-[#00A4EF]/20"
                required
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span>Company</span>
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="e.g. Krovaa Labs"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-2 focus:ring-[#00A4EF]/20"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Location</span>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="e.g. Remote"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-2 focus:ring-[#00A4EF]/20"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Budget</span>
                <input
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="e.g. $1,500 - $2,000"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-2 focus:ring-[#00A4EF]/20"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Mode</span>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-2 focus:ring-[#00A4EF]/20"
                  required
                >
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Onsite">Onsite</option>
                </select>
              </label>
            </div>

            <label className="space-y-2 text-sm text-slate-700">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Write a short summary of the job, responsibilities, and requirements."
                className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-2 focus:ring-[#00A4EF]/20"
                required
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-full bg-[#00A4EF] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0087d1] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? 'Posting...' : 'Submit job listing'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default PostJobPage;
