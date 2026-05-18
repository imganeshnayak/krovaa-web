import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Plus } from "lucide-react";
import { getJobs, Job } from "../lib/api";

const PAGE_SIZE = 6;

const formatPostedAgo = (createdAt: string) => {
  const createdDate = new Date(createdAt);
  const diffMinutes = Math.round((Date.now() - createdDate.getTime()) / 60000);

  if (diffMinutes < 60) {
    return `${diffMinutes} mins ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hrs ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return createdDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const ExplorePage = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [visibleJobs, setVisibleJobs] = useState<Job[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(jobs.length / PAGE_SIZE)), [jobs.length]);
  const hasMore = currentPage < totalPages;

  useEffect(() => {
    setVisibleJobs(jobs.slice(0, currentPage * PAGE_SIZE));
  }, [currentPage, jobs]);

  useEffect(() => {
    const loadJobs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const jobsData = await getJobs();
        setJobs(jobsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load job listings.');
      } finally {
        setIsLoading(false);
      }
    };

    loadJobs();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [jobs.length]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    window.requestAnimationFrame(() => {
      setCurrentPage((page) => Math.min(totalPages, page + 1));
      setIsLoadingMore(false);
    });
  }, [hasMore, isLoadingMore, totalPages]);

  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      {
        rootMargin: "200px",
      },
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="px-4 pb-28 pt-4 sm:px-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[#00A4EF]">
          <Compass className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-[0.18em]">Explore</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Job listings</h1>
        <p className="mt-1 text-sm text-slate-500">Browse available jobs and post your own listing instantly.</p>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          Loading jobs...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700">
          Failed to load jobs: {error}
        </div>
      ) : visibleJobs.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          No job listings yet. Post one to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleJobs.map((job) => (
            <article key={job.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md">
              <div className="flex h-full flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{job.company}</p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">{job.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{job.description}</p>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                    {formatPostedAgo(job.createdAt)}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{job.location}</span>
                    <span className="rounded-full bg-[#E8F4FF] px-3 py-1 text-xs font-semibold text-[#0066CC]">{job.mode}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">INR</span>
                    <span className="rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-semibold text-[#B45309]">{job.budget}</span>
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="inline-flex items-center justify-center rounded-full bg-[#00A4EF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0087d1]"
                  >
                    View Details
                  </button>
                  <p className="text-xs text-slate-500">Clean job summary for quick review</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div ref={loaderRef} className="mt-6 h-6" aria-hidden="true" />
      {isLoadingMore && !isLoading && (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          Loading more jobs...
        </div>
      )}
      {!hasMore && !isLoading && visibleJobs.length > 0 && (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          You have reached the end of the job listings.
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/post-job")}
        aria-label="Post a job"
        className="fixed bottom-24 right-6 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#00A4EF] text-white shadow-[0_12px_30px_rgba(0,164,239,0.25)] transition hover:bg-[#0087d1] focus:outline-none focus:ring-2 focus:ring-[#00A4EF]/50"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
};

export default ExplorePage;
