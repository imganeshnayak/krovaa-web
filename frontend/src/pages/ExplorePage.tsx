import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Compass, Paperclip, Plus, ArrowUpRight, MapPin, Briefcase, IndianRupee, Search, Filter, List, Share2, Bookmark, Users, LayoutGrid, ChevronDown } from "lucide-react";
import { getJobs, Job } from "../lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ShareJobDialog from "../components/ShareJobDialog";
import { listCollabProjects, ProjectListing } from "@/lib/api";
import ProjectAuctionCard from "@/components/collab/ProjectAuctionCard";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (tabParam === "jobs" || tabParam === "collab") ? tabParam : "collab";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [visibleJobs, setVisibleJobs] = useState<Job[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [sharingJob, setSharingJob] = useState<Job | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Collab Engine State
  const [activeTab, setActiveTab] = useState<"jobs" | "collab">(initialTab);

  useEffect(() => {
    if (tabParam === "jobs" || tabParam === "collab") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [collabProjects, setCollabProjects] = useState<ProjectListing[]>([]);
  const [isCollabLoading, setIsCollabLoading] = useState(false);
  const [sharingCollab, setSharingCollab] = useState<ProjectListing | null>(null);
  
  // Custom FAB state
  const [isFabOpen, setIsFabOpen] = useState(false);

  const filteredCollabProjects = useMemo(() => {
    return collabProjects.filter(project => !user || project.creatorId !== user.id);
  }, [collabProjects, user]);

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
  }, [searchQuery, selectedMode, locationFilter, activeTab]);

  const loadCollabProjects = async () => {
    setIsCollabLoading(true);
    try {
      const data = await listCollabProjects();
      setCollabProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCollabLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "collab") loadCollabProjects();
  }, [activeTab]);

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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Compass className="h-6 w-6 text-[#00A4EF] shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight whitespace-nowrap">Explore</h1>
          </div>
          <button 
            onClick={() => navigate('/my-listings')} 
            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shrink-0"
            title="My Listings"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Panel */}
        <div className="mt-6 p-2 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-inner flex flex-col md:flex-row md:items-center gap-2">
          
          {/* Tab Toggle — dropdown */}
          <div className="relative flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm shrink-0">
            <List className="absolute left-3.5 h-3.5 w-3.5 text-slate-600 pointer-events-none" />
            <select
              value={activeTab}
              onChange={(e) => {
                const newTab = e.target.value as "jobs" | "collab";
                setActiveTab(newTab);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("tab", newTab);
                  return next;
                });
              }}
              className="h-11 w-full rounded-xl pl-10 pr-8 text-xs font-bold tracking-wide text-slate-600 bg-transparent uppercase outline-none appearance-none cursor-pointer"
              aria-label="Job type"
            >
              <option value="jobs">Standard Jobs</option>
              <option value="collab">Group Jobs</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 h-3.5 w-3.5 text-slate-600" />
          </div>

          {/* Right side filters — right aligned */}
          <div className="flex flex-1 flex-col md:flex-row md:items-center gap-2 md:ml-auto">
            {/* Search */}
            <div className="relative flex-1 flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm">
              <Search className="absolute left-3.5 h-4 w-4 text-slate-600 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles, companies, or keywords..."
                className="h-11 w-full rounded-xl pl-10 pr-4 text-sm text-slate-800 bg-transparent outline-none transition focus:ring-2 focus:ring-[#00A4EF]/10"
              />
            </div>

            {/* Location + Mode */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1 md:w-44 flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm">
                <MapPin className="absolute left-3.5 h-4 w-4 text-slate-600 pointer-events-none" />
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Location..."
                  className="h-11 w-full rounded-xl pl-10 pr-4 text-sm text-slate-800 bg-transparent outline-none"
                />
              </div>

              <div className="relative flex-1 md:w-40 flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm">
                <Filter className="absolute left-3.5 h-3.5 w-3.5 text-slate-600 pointer-events-none" />
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
                <ChevronDown className="pointer-events-none absolute right-3.5 h-3.5 w-3.5 text-slate-600" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Dynamic Data Stream Grid */}
      {activeTab === "jobs" ? (
        isLoading ? (
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
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 truncate">{job.company}</p>
                    <h2 className="mt-1 text-base font-bold text-slate-950 tracking-tight line-clamp-1 group-hover:text-[#00A4EF] transition-colors">
                      {job.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSharingJob(job);
                      }}
                      className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-[#00A4EF] transition-colors"
                      title="Share job"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="shrink-0 text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                      {formatPostedAgo(job.createdAt)}
                    </span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-500 line-clamp-3 font-normal min-h-[54px]">
                  {job.description}
                </p>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-[11px] font-medium text-slate-600 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-600" />
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
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <Paperclip className="h-3.5 w-3.5 text-slate-600" />
                    <span>{job.attachments.length} Asset{job.attachments.length === 1 ? "" : "s"}</span>
                  </div>
                ) : (
                  <div className="text-[10px] font-medium text-slate-600 italic">No attachments</div>
                )}
                
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00A4EF] transition-transform group-hover:translate-x-1">
                  View Details
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </article>
          ))}
          </div>
        )
      ) : (
        // COLLAB HUB RENDERING
        isCollabLoading ? (
           <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-12 text-center text-sm text-slate-500 animate-pulse">
             Loading collab matrix...
           </div>
        ) : filteredCollabProjects.length === 0 ? (
           <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/30 p-12 text-center text-sm text-slate-500">
             No active collab projects available right now.
           </div>
        ) : (
           <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
             {filteredCollabProjects.map(project => (
               <ProjectAuctionCard 
                 key={project.id} 
                 project={project} 
                 onApplyClick={() => navigate(`/blueprint/${project.id}`)}
                 onReviewClick={(p) => navigate(`/collab/${p.id}/review`)}
                 onFundClick={() => navigate(`/collab/${project.id}`)}
                 onShareClick={setSharingCollab}
               />
             ))}
           </div>
        )
      )}



      {/* Infinite Scroll Sensor Boundary */}
      <div ref={loaderRef} className="mt-8 h-4" aria-hidden="true" />
      
      {/* Scroll Metric Updates */}
      {isLoadingMore && !isLoading && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-center text-xs font-medium text-slate-600 animate-pulse">
          Syncing trailing page registers...
        </div>
      )}
      {!hasMore && !isLoading && visibleJobs.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-center text-xs font-semibold text-slate-600 tracking-wide">
          End of listing continuum reached.
        </div>
      )}

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-6 z-[60] flex flex-col items-end gap-3">
          {isFabOpen && (
             <div className="flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-5 fade-in duration-200">
               <button
                 onClick={() => { setIsFabOpen(false); navigate("/post-job"); }}
                 className="bg-white text-slate-900 border border-slate-200 shadow-lg rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-end gap-3 hover:bg-slate-50 transition-colors"
               >
                 Standard Job <Briefcase className="h-4 w-4 text-slate-400" />
               </button>
               <button
                 onClick={() => { setIsFabOpen(false); navigate("/post-collab"); }}
                 className="bg-slate-900 text-white shadow-lg rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-end gap-3 hover:bg-slate-800 transition-colors"
               >
                 Collab Blueprint <Users className="h-4 w-4 text-slate-400" />
               </button>
             </div>
          )}
          <button
            type="button"
            onClick={() => setIsFabOpen(!isFabOpen)}
            aria-label="Create new"
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#00A4EF] text-white shadow-[0_12px_30px_rgba(0,164,239,0.3)] transition-all duration-200 hover:bg-[#0087d1] hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#00A4EF]/50"
          >
            <Plus className={`h-6 w-6 stroke-[2.5] transition-transform duration-200 ${isFabOpen ? 'rotate-45' : ''}`} />
          </button>
        </div>

      {sharingJob && (
        <ShareJobDialog
          isOpen={!!sharingJob}
          onClose={() => setSharingJob(null)}
          jobId={sharingJob.id}
          jobTitle={sharingJob.title}
          companyName={sharingJob.company}
          type="job"
        />
      )}

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
};

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
  </svg>
);

export default ExplorePage;