import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Paperclip, Plus, ArrowUpRight, MapPin, Briefcase, IndianRupee, Search, Filter, List } from "lucide-react";
import { getJobs, Job } from "../lib/api";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [visibleJobs, setVisibleJobs] = useState<Job[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const normalizedLocation = locationFilter.trim().toLowerCase();

    return jobs.filter((job) => {
      const notOwn = !user || !job.postedById || job.postedById !== user.id;

      const matchesSearch = !normalizedQuery
        || job.title.toLowerCase().includes(normalizedQuery)
        || job.company.toLowerCase().includes(normalizedQuery)
        || job.description.toLowerCase().includes(normalizedQuery);

      const matchesMode = selectedMode === "all"
        || job.mode.toLowerCase() === selectedMode;

      const matchesLocation = !normalizedLocation
        || job.location.toLowerCase().includes(normalizedLocation);

      return notOwn && matchesSearch && matchesMode && matchesLocation;
    });
  }, [jobs, locationFilter, searchQuery, selectedMode, user]);

  const modes = useMemo(() => {
    const allModes = new Set(jobs.map((job) => job.mode.toLowerCase()));
    return ["all", ...Array.from(allModes)];
  }, [jobs]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE)), [filteredJobs.length]);
  const hasMore = currentPage < totalPages;

  useEffect(() => {
    setVisibleJobs(filteredJobs.slice(0, currentPage * PAGE_SIZE));
  }, [currentPage, filteredJobs]);

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
  }, [searchQuery, selectedMode, locationFilter]);

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
      { rootMargin: "200px" },
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="max-w-6xl mx-auto px-4 pb-28 pt-6 sm:px-6">
      
      {/* Premium Dashboard Header Banner */}
      <div className="mb-8 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-2 text-[#00A4EF]">
          <Compass className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">Explore Matrix</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Job Listings</h1>
          <button
            type="button"
            onClick={() => navigate("/my-listings")}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-[#00A4EF] active:scale-[0.97]"
          >
            <List className="h-4 w-4" />
            My Listings
          </button>
        </div>

        {/* Clean, Non-Splitting Responsive Filter Panel Wrapper */}
        <div className="mt-6 p-2 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-inner grid gap-2 grid-cols-1 md:flex md:items-center">
          
          {/* Main Keyword Engine Input */}
          <div className="relative flex-1 flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles, companies, or keywords..."
              className="h-11 w-full rounded-xl pl-10 pr-4 text-sm text-slate-800 bg-transparent outline-none transition focus:ring-2 focus:ring-[#00A4EF]/10"
            />
          </div>

          {/* Subordinate Option Selectors Box */}
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center shrink-0">
            {/* Quick Context Location Box */}
            <div className="relative md:w-44 flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm">
              <MapPin className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Location..."
                className="h-11 w-full rounded-xl pl-10 pr-4 text-sm text-slate-800 bg-transparent outline-none"
              />
            </div>

            {/* Workplace Alignment Dropdown Field */}
            <div className="relative md:w-40 flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm">
              <Filter className="absolute left-3.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="h-11 w-full rounded-xl pl-10 pr-8 text-xs font-bold tracking-wide text-slate-600 bg-transparent uppercase outline-none appearance-none cursor-pointer"
                aria-label="Filter by mode"
              >
                {modes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === "all" ? "All Modes" : mode}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

        </div>
      </div>

      {/* Dynamic Data Stream Grid */}
      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-12 text-center text-sm text-slate-500 animate-pulse">
          Loading synchronized jobs infrastructure...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          Failed to compute listings sequence: {error}
        </div>
      ) : visibleJobs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/30 p-12 text-center text-sm text-slate-500">
          No live job clusters match current parameter combinations.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleJobs.map((job) => (
            <article 
              key={job.id} 
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="group cursor-pointer flex flex-col justify-between rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{job.company}</p>
                    <h2 className="mt-1 text-base font-bold text-slate-950 tracking-tight line-clamp-1 group-hover:text-[#00A4EF] transition-colors">
                      {job.title}
                    </h2>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                    {formatPostedAgo(job.createdAt)}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-500 line-clamp-3 font-normal min-h-[54px]">
                  {job.description}
                </p>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-[11px] font-medium text-slate-600 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate max-w-[80px]">{job.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#0066CC] bg-[#E8F4FF] px-2 py-0.5 rounded-md">
                    <Briefcase className="h-3.5 w-3.5 text-[#00A4EF]" />
                    <span>{job.mode}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-md ml-auto">
                    <IndianRupee className="h-3.5 w-3.5" />
                    <span>{job.budget}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                {job.attachments && job.attachments.length > 0 ? (
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                    <span>{job.attachments.length} Asset{job.attachments.length === 1 ? "" : "s"}</span>
                  </div>
                ) : (
                  <div className="text-[10px] font-medium text-slate-400 italic">No attachments</div>
                )}
                
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00A4EF] transition-transform group-hover:translate-x-1">
                  View Details
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Infinite Scroll Sensor Boundary */}
      <div ref={loaderRef} className="mt-8 h-4" aria-hidden="true" />
      
      {/* Scroll Metric Updates */}
      {isLoadingMore && !isLoading && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-center text-xs font-medium text-slate-400 animate-pulse">
          Syncing trailing page registers...
        </div>
      )}
      {!hasMore && !isLoading && visibleJobs.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-center text-xs font-semibold text-slate-400 tracking-wide">
          End of listing continuum reached.
        </div>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => navigate("/post-job")}
        aria-label="Post a job"
        className="fixed bottom-24 right-6 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#00A4EF] text-white shadow-[0_12px_30px_rgba(0,164,239,0.3)] transition-all duration-200 hover:bg-[#0087d1] hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#00A4EF]/50"
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </button>
    </div>
  );
};

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
  </svg>
);

export default ExplorePage;