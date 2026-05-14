import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Plus } from "lucide-react";

const allJobs = [
  {
    id: "1",
    title: "UI/UX Designer for Mobile App",
    company: "Krovaa Creative",
    location: "Remote",
    budget: "₹95,000 - ₹1,35,000",
    mode: "Remote",
    description: "Design intuitive app screens, user journeys, and high-impact marketing visuals for a service marketplace targeting Indian consumers.",
  },
  {
    id: "2",
    title: "Frontend Developer (React / TypeScript)",
    company: "Krovaa Labs",
    location: "Bangalore",
    budget: "₹1,60,000 - ₹2,10,000",
    mode: "Hybrid",
    description: "Build scalable React interfaces, integrate with REST APIs, and ship polished desktop and mobile experiences for a B2B marketplace.",
  },
  {
    id: "3",
    title: "Content Writer for SaaS Product",
    company: "Krovaa Media",
    location: "Remote",
    budget: "₹55,000 - ₹75,000",
    mode: "Remote",
    description: "Create audience-first blog posts, email campaigns, and help center content for a fintech SaaS targeting small businesses.",
  },
  {
    id: "4",
    title: "Marketing Specialist",
    company: "Krovaa Growth",
    location: "Mumbai",
    budget: "₹85,000 - ₹1,10,000",
    mode: "Remote",
    description: "Plan and execute digital growth campaigns, manage influencer outreach, and improve funnel metrics for an Indian marketplace brand.",
  },
  {
    id: "5",
    title: "Customer Success Lead",
    company: "Krovaa Support",
    location: "Hyderabad",
    budget: "₹1,30,000 - ₹1,70,000",
    mode: "Onsite",
    description: "Own onboarding and retention for enterprise clients, resolve escalations, and help deliver premium service outcomes.",
  },
  {
    id: "6",
    title: "Backend Engineer",
    company: "Krovaa Tech",
    location: "Pune",
    budget: "₹1,80,000 - ₹2,20,000",
    mode: "Hybrid",
    description: "Develop secure backend APIs, optimize database access, and support real-time workflows for a payments-enabled marketplace.",
  },
  {
    id: "7",
    title: "Growth Product Manager",
    company: "Krovaa Labs",
    location: "Remote",
    budget: "₹1,75,000 - ₹2,10,000",
    mode: "Remote",
    description: "Run rapid experiments, analyze metrics and launch new features that drive retention and revenue growth in the Indian market.",
  },
  {
    id: "8",
    title: "Paid Media Specialist",
    company: "Krovaa Growth",
    location: "Remote",
    budget: "₹1,00,000 - ₹1,35,000",
    mode: "Remote",
    description: "Launch paid social and search campaigns, optimize ad spend, and improve CAC across tier-1 and tier-2 city audiences.",
  },
  {
    id: "9",
    title: "Technical Writer",
    company: "Krovaa Media",
    location: "Hyderabad",
    budget: "₹70,000 - ₹95,000",
    mode: "Hybrid",
    description: "Write developer guides, onboarding documentation, and release notes that make product features easy to adopt.",
  },
  {
    id: "10",
    title: "QA Engineer",
    company: "Krovaa Tech",
    location: "Bangalore",
    budget: "₹1,20,000 - ₹1,55,000",
    mode: "Onsite",
    description: "Design test plans for backend services, automate regression checks, and help keep the platform stable across product releases.",
  },
  {
    id: "11",
    title: "Community Manager",
    company: "Krovaa Support",
    location: "Remote",
    budget: "₹75,000 - ₹95,000",
    mode: "Remote",
    description: "Grow and engage communities, run online events, and build strong brand loyalty across Indian social channels.",
  },
  {
    id: "12",
    title: "Data Analyst",
    company: "Krovaa Labs",
    location: "Mumbai",
    budget: "₹1,65,000 - ₹1,95,000",
    mode: "Hybrid",
    description: "Analyze user behavior and surface insights that improve product decisions and drive marketplace growth.",
  },
];

const PAGE_SIZE = 6;

const ExplorePage = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleJobs, setVisibleJobs] = useState(allJobs.slice(0, PAGE_SIZE));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const totalPages = useMemo(() => Math.ceil(allJobs.length / PAGE_SIZE), []);
  const hasMore = currentPage < totalPages;

  useEffect(() => {
    setVisibleJobs(allJobs.slice(0, currentPage * PAGE_SIZE));
  }, [currentPage]);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleJobs.map((job) => (
          <article key={job.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{job.company}</p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-950">{job.title}</h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{job.location}</span>
                  <span className="rounded-full bg-[#E8F4FF] px-3 py-1 text-[#0066CC]">{job.mode}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">INR</span>
                <span className="rounded-full bg-[#FEF3C7] px-3 py-1 text-[#B45309]">{job.budget}</span>
              </div>
              <p className="text-sm leading-7 text-slate-600">{job.description}</p>
            </div>
          </article>
        ))}
      </div>

      <div ref={loaderRef} className="mt-6 h-6" aria-hidden="true" />
      {isLoadingMore && (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          Loading more jobs...
        </div>
      )}
      {!hasMore && (
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
