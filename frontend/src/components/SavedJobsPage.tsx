import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSavedJobs, unsaveJob, getSavedCollabProjects, unsaveCollabProject } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IndianRupee, Briefcase, MapPin, Clock, Bookmark, BookmarkCheck, BookmarkX, AlertTriangle, ArrowLeft, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProjectAuctionCard from './collab/ProjectAuctionCard';

export function SavedJobsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savedJobs, setSavedJobs] = useState<Array<any>>([]);
  const [savedCollabs, setSavedCollabs] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'collabs'>('jobs');

  useEffect(() => {
    loadSavedJobs();
  }, [user?.id]);

  const loadSavedJobs = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [jobsData, collabsData] = await Promise.all([
        getSavedJobs(),
        getSavedCollabProjects()
      ]);
      setSavedJobs(jobsData);
      setSavedCollabs(collabsData);
    } catch (err: any) {
      setError('Failed to load saved jobs');
      console.error('Load saved jobs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (jobId: number) => {
    try {
      await unsaveJob(jobId);
      // Remove from local state
      setSavedJobs(prev => prev.filter(job => job.id !== jobId));
    } catch (err: any) {
      console.error('Unsave job error:', err);
      // Show error toast or notification
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center">
        <div className="animate-pulse rounded-xl bg-slate-200 p-8">
          <div className="space-y-4 text-center">
            <BookmarkCheck className="w-8 h-8 mx-auto text-[#00A4EF]/50" />
            <h3 className="text-lg font-bold text-slate-900">Loading saved jobs...</h3>
            <p className="text-sm text-slate-500">Please wait while we fetch your saved jobs.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8">
          <div className="space-y-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-500" />
            <h3 className="text-lg font-bold text-rose-900">Something went wrong</h3>
            <p className="text-sm text-slate-600">{error}</p>
            <Button onClick={loadSavedJobs} variant="outline">Try again</Button>
          </div>
        </div>
      </div>
    );
  }

  const hasNoItems = activeTab === 'jobs' ? savedJobs.length === 0 : savedCollabs.length === 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate(-1)} variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Saved Jobs</h1>
        </div>
       
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${
            activeTab === 'jobs' ? 'text-[#00A4EF]' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Standard Jobs
          {activeTab === 'jobs' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#00A4EF] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('collabs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${
            activeTab === 'collabs' ? 'text-[#00A4EF]' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Collab Blueprints
          {activeTab === 'collabs' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#00A4EF] rounded-t-full" />
          )}
        </button>
      </div>

      {/* Content */}
      {hasNoItems ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center">
          <div className="text-center py-12">
            <Bookmark className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-bold text-slate-900">No saved {activeTab === 'jobs' ? 'jobs' : 'blueprints'} yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
              Save {activeTab === 'jobs' ? 'jobs' : 'collab blueprints'} you're interested in to find them easily here.
            </p>
            <Button
              onClick={() => navigate('/explore')}
              variant="default"
              className="mt-6 bg-[#00A4EF] text-white rounded-xl"
            >
              Explore Now
            </Button>
          </div>
        </div>
      ) : activeTab === 'jobs' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {savedJobs.map((job) => (
          <div key={job.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="p-6 space-y-4">
              {/* Job Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{job.title}</h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {job.skills && job.skills.length > 0 && (
                      <>
                        {job.skills.slice(0, 3).map((skill: string, index: number) => (
                          <span
                            key={index}
                            className="text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200/60 px-2.5 py-1 rounded-lg"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 3 && (
                          <span className="text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200/60 px-2.5 py-1 rounded-lg">
                            +{job.skills.length - 3} more
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-50">
                    <Briefcase className="w-5 h-5 text-slate-500" />
                  </div>
                  <Button
                    onClick={() => handleUnsave(job.id)}
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <BookmarkX className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Job Details */}
              <div className="space-y-3">
                {/* Metadata Row */}
                <div className="grid gap-4 grid-cols-[1fr_1fr_1fr] text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4" />
                    <span>{job.budget}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{job.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{job.mode}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-slate-600 line-clamp-3">{job.description}</p>

                {/* Terms and Footer */}
                {job.terms && job.terms.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Terms & Conditions
                    </h4>
                    <div className="text-slate-600 text-sm leading-relaxed">
                      {job.terms.map((term: string, index: number) => (
                        <div key={index} className="mb-1">
                          • {term}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs text-slate-500">
                    Saved on {new Date(job.savedAt).toLocaleDateString()}
                  </span>
                  <Button
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    variant="outline"
                    size="sm"
                  >
                    View Job
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {savedCollabs.map((project) => (
            <ProjectAuctionCard
              key={project.id}
              project={project}
              onApplyClick={() => navigate(`/blueprint/${project.id}`)}
              onReviewClick={(p) => navigate(`/collab/${p.id}/review`)}
              onFundClick={() => navigate(`/collab/${project.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}