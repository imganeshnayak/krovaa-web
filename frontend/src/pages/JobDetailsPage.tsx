import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getJob, JobDetails } from "../lib/api";

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
  const [job, setJob] = useState<JobDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load job details.");
      } finally {
        setIsLoading(false);
      }
    };

    loadJob();
  }, [jobId]);

  return (
    <div className="px-4 pb-28 pt-4 sm:px-6">
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
        </div>
      )}
    </div>
  );
};

export default JobDetailsPage;
