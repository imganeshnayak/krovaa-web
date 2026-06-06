import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getCommunityJobs, 
  postCommunityJob, 
  getCommunityJobDetail, 
  submitCommunityBid, 
  acceptCommunityBid, 
  withdrawCommunityBid,
  rateCommunityJob,
  CommunityJob,
  CommunityBid
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobSaveButton } from '@/components/JobSaveButton';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, Clock, IndianRupee, Users, Plus, CheckCircle, XCircle, Star } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

interface JobsTabProps {
  communityId: number;
  isMember: boolean;
}

export function JobsTab({ communityId, isMember }: JobsTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<CommunityJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<CommunityJob | null>(null);
  const [jobDetails, setJobDetails] = useState<(CommunityJob & { bids: CommunityBid[] }) | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [biddingJob, setBiddingJob] = useState<CommunityJob | null>(null);

  // New Job Form State
  const [newJob, setNewJob] = useState({ title: '', description: '', budget: '', deadline: '', skills: '' });
  
  // Bid Form State
  const [bidData, setBidData] = useState({ 
    isGroup: false, 
    coverLetter: '', 
    bidAmount: '', 
    estimatedDays: '',
    members: [] as { userId: number, paymentPercent: number, role: string }[]
  });

  // Rating Form State
  const [ratingData, setRatingData] = useState<{ reviewedId: number, rating: number, feedback: string } | null>(null);

  useEffect(() => {
    loadJobs();
  }, [communityId]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const data = await getCommunityJobs(communityId);
      setJobs(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.title || !newJob.budget) return;
    try {
      await postCommunityJob(communityId, {
        title: newJob.title,
        description: newJob.description,
        budget: Number(newJob.budget),
        deadline: newJob.deadline || undefined,
        skills: newJob.skills ? newJob.skills.split(',').map(s => s.trim()) : []
      });
      toast({ title: 'Job Posted', description: 'Your job is now visible to the community.' });
      setShowPostModal(false);
      setNewJob({ title: '', description: '', budget: '', deadline: '', skills: '' });
      loadJobs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const viewJobDetails = async (job: CommunityJob) => {
    setSelectedJob(job);
    try {
      const data = await getCommunityJobDetail(communityId, job.id);
      setJobDetails(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biddingJob || !bidData.bidAmount) return;
    try {
      await submitCommunityBid(communityId, biddingJob.id, {
        isGroup: bidData.isGroup,
        coverLetter: bidData.coverLetter,
        bidAmount: Number(bidData.bidAmount),
        estimatedDays: bidData.estimatedDays ? Number(bidData.estimatedDays) : undefined,
        members: bidData.isGroup ? bidData.members : undefined
      });
      toast({ title: 'Bid Submitted', description: 'Your bid has been sent to the client.' });
      setShowBidModal(false);
      setBidData({ isGroup: false, coverLetter: '', bidAmount: '', estimatedDays: '', members: [] });
      loadJobs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleAcceptBid = async (jobId: number, bidId: number) => {
    try {
      await acceptCommunityBid(communityId, jobId, bidId);
      toast({ title: 'Bid Accepted', description: 'Escrow deal has been created successfully!' });
      setSelectedJob(null);
      loadJobs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !ratingData) return;
    try {
      await rateCommunityJob(communityId, selectedJob.id, {
        reviewedId: ratingData.reviewedId,
        rating: ratingData.rating,
        feedback: ratingData.feedback
      });
      toast({ title: 'Rating Submitted', description: 'Thank you for your feedback.' });
      setRatingData(null);
      // Refresh job details
      viewJobDetails(selectedJob);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading jobs...</div>;

  return (
    <div className="bg-white rounded-[2rem] border border-[#E0E0E0] shadow-sm min-h-[500px]">
      <div className="p-6 border-b border-[#E0E0E0] flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-[#1C1C1C]">Agency Board</h2>
          <p className="text-sm text-slate-500">Post jobs and hire talent from this community.</p>
        </div>
        {isMember && (
          <Button onClick={() => setShowPostModal(true)} className="bg-[#00A4EF] hover:bg-[#007BB5] text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Post a Job
          </Button>
        )}
      </div>

      <div className="p-6">
        {jobs.length === 0 ? (
          <div className="text-center py-12 text-[#1C1C1C]/40">
            <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No jobs posted yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map(job => (
              <div key={job.id} onClick={() => viewJobDetails(job)} className="p-5 rounded-xl border border-[#E0E0E0] hover:border-[#00A4EF]/50 cursor-pointer transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-[#1C1C1C]">{job.title}</h3>
                    <div className="flex gap-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center"><IndianRupee className="w-3 h-3 mr-1" /> ₹{job.budget}</span>
                      {job.deadline && <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {new Date(job.deadline).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <Badge variant={job.status === 'open' ? 'default' : 'secondary'} className={job.status === 'open' ? 'bg-[#00A4EF]' : ''}>
                    {job.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2 mb-4">{job.description}</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6"><AvatarImage src={job.client?.avatarUrl} /><AvatarFallback>{job.client?.displayName?.[0]}</AvatarFallback></Avatar>
                    <span className="text-xs font-medium text-slate-700">{job.client?.displayName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#00A4EF]">{job._count?.bids || 0} proposals</span>
                    <JobSaveButton jobId={job.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Post Job Modal */}
      <Dialog open={showPostModal} onOpenChange={setShowPostModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Post a Job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePostJob} className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-bold text-slate-500">Job Title</label>
              <Input required value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} placeholder="e.g. Build a React Native App" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Description</label>
              <Textarea required value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})} placeholder="Describe what you need..." className="min-h-[100px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Budget (₹)</label>
                <Input required type="number" value={newJob.budget} onChange={e => setNewJob({...newJob, budget: e.target.value})} placeholder="5000" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Deadline (Optional)</label>
                <Input type="date" value={newJob.deadline} onChange={e => setNewJob({...newJob, deadline: e.target.value})} />
              </div>
            </div>
            <Button type="submit" className="w-full bg-[#00A4EF] text-white">Post Job</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Job Details & Bids Modal */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedJob.title}</DialogTitle>
                <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                  <span className="flex items-center"><IndianRupee className="w-4 h-4 mr-1" /> Budget: ₹{selectedJob.budget}</span>
                  <Badge variant={selectedJob.status === 'open' ? 'default' : 'secondary'}>{selectedJob.status.toUpperCase()}</Badge>
                </div>
              </DialogHeader>
              
              <div className="py-4 border-b border-slate-100">
                <h4 className="font-bold text-sm mb-2 text-slate-700">Description</h4>
                <p className="text-slate-600 whitespace-pre-wrap text-sm">{selectedJob.description}</p>
              </div>

              {selectedJob.status === 'open' && selectedJob.clientId !== user?.id && isMember && (
                <div className="py-4">
                  <Button onClick={() => { setShowBidModal(true); setBiddingJob(selectedJob); }} className="bg-[#00A4EF] text-white w-full">
                    Submit a Proposal
                  </Button>
                </div>
              )}

              {selectedJob.status === 'in_progress' && selectedJob.escrowDealId && (
                <div className="py-4 bg-green-50 rounded-xl p-4 text-center mt-4">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-green-800">Deal is in progress</p>
                  <Button onClick={() => navigate('/escrow')} variant="outline" className="mt-4 bg-white">Go to Escrow Deals</Button>
                </div>
              )}

              {/* Bids List */}
              {jobDetails?.bids && jobDetails.bids.length > 0 && (
                <div className="py-4">
                  <h4 className="font-bold text-lg mb-4 text-[#1C1C1C]">
                    {selectedJob.status === 'completed' ? 'Winning Proposal' : `Proposals (${jobDetails.bids.length})`}
                  </h4>
                  <div className="space-y-4">
                    {jobDetails.bids.filter(b => selectedJob.status !== 'completed' || b.status === 'accepted').map(bid => (
                      <div key={bid.id} className="border border-[#E0E0E0] rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            <Avatar><AvatarImage src={bid.leader?.avatarUrl} /><AvatarFallback>{bid.leader?.displayName?.[0]}</AvatarFallback></Avatar>
                            <div>
                              <p className="font-bold text-[#1C1C1C]">{bid.leader?.displayName}</p>
                              {bid.isGroup && <Badge variant="secondary" className="text-[10px]">Team Bid ({bid.members.length} members)</Badge>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-[#00A4EF]">₹{bid.bidAmount}</p>
                            <p className="text-xs text-slate-500">{bid.estimatedDays} days</p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mt-3">{bid.coverLetter}</p>
                        
                        {bid.isGroup && (
                          <div className="mt-4 bg-slate-50 p-3 rounded-lg text-xs border border-slate-200">
                            <p className="font-bold mb-2">Team Split:</p>
                            {bid.members.map(m => (
                              <div key={m.id} className="flex justify-between mb-1 items-center">
                                <span>{m.user?.displayName} ({m.role || 'Member'})</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-bold">{m.paymentPercent}%</span>
                                  {selectedJob.status === 'completed' && selectedJob.clientId === user?.id && (
                                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setRatingData({ reviewedId: m.userId, rating: 5, feedback: '' })}>Rate</Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {!bid.isGroup && selectedJob.status === 'completed' && selectedJob.clientId === user?.id && (
                          <div className="mt-4">
                            <Button size="sm" variant="outline" onClick={() => setRatingData({ reviewedId: bid.leaderId, rating: 5, feedback: '' })}>Rate {bid.leader?.displayName}</Button>
                          </div>
                        )}

                        {selectedJob.clientId === user?.id && selectedJob.status === 'open' && (
                          <Button onClick={() => handleAcceptBid(selectedJob.id, bid.id)} className="w-full mt-4 bg-[#1C1C1C] hover:bg-black text-white">
                            Accept & Fund Escrow (₹{bid.bidAmount})
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Rating Form */}
              {ratingData && (
                <div className="py-4 border-t border-[#E0E0E0] mt-4">
                  <h4 className="font-bold text-sm mb-2 text-[#1C1C1C]">Rate Freelancer / Team Member</h4>
                  <form onSubmit={handleRateSubmit} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-500 w-20">Rating (1-5)</label>
                      <Input type="number" min="1" max="5" value={ratingData.rating} onChange={e => setRatingData({...ratingData, rating: Number(e.target.value)})} className="w-24" required />
                      <Star className="w-5 h-5 text-yellow-400 fill-current" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Feedback</label>
                      <Textarea value={ratingData.feedback} onChange={e => setRatingData({...ratingData, feedback: e.target.value})} placeholder="How was their work?" required />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="bg-[#00A4EF] text-white flex-1">Submit Rating</Button>
                      <Button type="button" variant="outline" onClick={() => setRatingData(null)}>Cancel</Button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bid Modal */}
      <Dialog open={showBidModal} onOpenChange={setShowBidModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Proposal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBidSubmit} className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-bold text-slate-500">Your Bid (₹)</label>
              <Input required type="number" value={bidData.bidAmount} onChange={e => setBidData({...bidData, bidAmount: e.target.value})} placeholder="e.g. 5000" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Delivery in (Days)</label>
              <Input type="number" value={bidData.estimatedDays} onChange={e => setBidData({...bidData, estimatedDays: e.target.value})} placeholder="e.g. 7" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Cover Letter</label>
              <Textarea required value={bidData.coverLetter} onChange={e => setBidData({...bidData, coverLetter: e.target.value})} placeholder="Why are you the best fit?" />
            </div>
            
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input type="checkbox" id="isGroup" checked={bidData.isGroup} onChange={e => setBidData({...bidData, isGroup: e.target.checked})} className="rounded text-[#00A4EF]" />
              <label htmlFor="isGroup" className="text-sm font-bold text-slate-700">Submit as a Team / Group</label>
            </div>

            {bidData.isGroup && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 mb-2">Note: To build a team bid, add member IDs and their percentage cut. Total must be 100%.</p>
                {/* For brevity in the prototype, we assume the user adds their own cut directly via a simple text input or we just handle it automatically. In a full app, this would be a complex selector. */}
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="text-sm w-1/2">You (Leader) %:</span>
                    <Input type="number" placeholder="e.g. 60" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm w-1/2">Co-worker ID:</span>
                    <Input type="number" placeholder="User ID" />
                    <Input type="number" placeholder="%" className="w-20" />
                  </div>
                  <p className="text-[10px] text-red-500">UI for selecting community members would go here.</p>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full bg-[#00A4EF] text-white">Submit Proposal</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
