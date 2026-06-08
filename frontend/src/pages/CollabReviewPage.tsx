import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ProjectListing, getCollabProject, acceptSeatBid } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { IndianRupee, Star, CheckCircle2, Users, AlertCircle, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function CollabReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [project, setProject] = useState<ProjectListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState<number | null>(null);

  const loadProject = async () => {
    try {
      const data = await getCollabProject(Number(id));
      setProject(data);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load project.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 animate-pulse font-bold">
        Loading Review Board...
      </div>
    );
  }

  if (!project) {
    return <div className="p-8 text-center text-slate-500">Project not found.</div>;
  }

  const handleAcceptBid = async (seatId: number, bidId: number) => {
    setIsAccepting(bidId);
    try {
      await acceptSeatBid(project.id, seatId, bidId);
      toast({ title: "Bid Accepted", description: "Worker has been successfully assigned to the squad." });
      loadProject();
    } catch (err) {
      toast({ 
        title: "Action failed", 
        description: err instanceof Error ? err.message : "An unexpected error occurred.", 
        variant: "destructive" 
      });
    } finally {
      setIsAccepting(null);
    }
  };

  const totalSeats = project.seats.length;
  const filledSeats = project.seats.filter(s => s.status === 'OCCUPIED').length;
  const allSeatsFilled = filledSeats === totalSeats;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-28 pt-6 sm:px-6">
      
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-900 h-8 gap-1.5 px-2 text-xs font-semibold group mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="p-6 md:p-8 bg-slate-50/50 border-b border-slate-100 shrink-0">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bid Review Board</h1>
            <p className="text-slate-500 text-sm">
              Review submissions and assemble your team roster for <span className="font-semibold text-slate-800">{project.title}</span>
            </p>
          </div>

          {/* Quick Stats Metric Bar */}
          <div className="flex items-center gap-6 mt-6 pt-5 border-t border-slate-200 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Squad Assembly Status: <strong className="text-slate-900">{filledSeats} / {totalSeats} Filled</strong></span>
            </div>
          </div>
        </div>

        {/* Board Main Area */}
        <div className="p-6 md:p-8 space-y-8 bg-white">
          {project.seats.map(seat => {
            const acceptedBid = seat.bids.find(b => b.status === 'ACCEPTED');
            const isOccupied = seat.status === 'OCCUPIED';
            
            return (
              <div key={seat.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                
                {/* Seat Header Banner */}
                <div className="flex items-center justify-between p-5 bg-slate-50 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">{seat.roleName}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Allocation: {seat.splitPercent}% milestone split</p>
                  </div>
                  
                  <Badge variant={isOccupied ? "success" : "secondary"} className="gap-1.5 font-semibold text-xs px-3 py-1">
                    {isOccupied ? (
                      <> <CheckCircle2 className="w-4 h-4" /> Filled </>
                    ) : (
                      <>Waiting for Selection</>
                    )}
                  </Badge>
                </div>

                <div className="p-6">
                  {/* Handled State: Role Settled */}
                  {acceptedBid && (
                    <div className="bg-emerald-50/40 border border-emerald-100/80 rounded-2xl p-5 flex flex-col md:flex-row md:items-start gap-5">
                      <div 
                        className="cursor-pointer group shrink-0"
                        onClick={() => navigate(`/${acceptedBid.user.username}`)}
                      >
                        <Avatar className="w-14 h-14 border border-emerald-200 group-hover:ring-2 ring-emerald-400 ring-offset-2 transition-all">
                          <AvatarImage src={acceptedBid.user.avatarUrl} />
                          <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-lg">
                            {acceptedBid.user.displayName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 
                          className="font-bold text-slate-900 text-base cursor-pointer hover:underline inline-block"
                          onClick={() => navigate(`/${acceptedBid.user.username}`)}
                        >
                          {acceptedBid.user.displayName}
                        </h4>
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed italic bg-white p-3 rounded-xl border border-emerald-50">"{acceptedBid.proposalPitch}"</p>
                      </div>
                      <div className="text-left md:text-right shrink-0 mt-4 md:mt-0 self-center">
                        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Locked Bid</p>
                        <p className="font-extrabold text-slate-900 flex items-center justify-start md:justify-end text-xl mt-1">
                          <IndianRupee className="w-5 h-5 mr-0.5 text-slate-500" />{acceptedBid.bidAmount.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Handled State: Open Candidates */}
                  {!acceptedBid && seat.bids.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {seat.bids.map(bid => {
                        const isCurrentlyProcessing = isAccepting === bid.id;
                        const isAnyBidProcessing = isAccepting !== null;

                        return (
                          <div key={bid.id} className="group border border-slate-200 rounded-2xl p-5 hover:border-slate-400 transition-all bg-white flex flex-col justify-between shadow-sm hover:shadow-md">
                            <div>
                              <div className="flex items-start gap-4">
                                <Avatar 
                                  className="w-12 h-12 border border-slate-100 shadow-sm cursor-pointer hover:ring-2 ring-[#00A4EF]/50 ring-offset-2 transition-all shrink-0"
                                  onClick={() => navigate(`/${bid.user.username}`)}
                                >
                                  <AvatarImage src={bid.user.avatarUrl} />
                                  <AvatarFallback className="bg-slate-100 text-slate-700 font-bold text-sm">
                                    {bid.user.displayName.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h4 
                                    className="font-bold text-slate-900 text-base truncate cursor-pointer hover:text-[#00A4EF] transition-colors inline-block"
                                    onClick={() => navigate(`/${bid.user.username}`)}
                                  >
                                    {bid.user.displayName}
                                  </h4>
                                  <br />
                                  <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-500 font-semibold bg-amber-50 inline-flex px-2 py-0.5 rounded-md border border-amber-100">
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    {bid.userRatingAtTime > 0 ? bid.userRatingAtTime.toFixed(1) : 'New Contractor'}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                "{bid.proposalPitch}"
                              </div>
                            </div>

                            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Proposed Quote</span>
                                <div className="flex items-center text-slate-950 font-extrabold text-lg mt-0.5">
                                  <IndianRupee className="w-4 h-4 text-slate-500 mr-0.5" />
                                  {bid.bidAmount.toLocaleString('en-IN')}
                                </div>
                              </div>
                              <Button 
                                className="bg-slate-900 text-white hover:bg-slate-800 font-semibold px-6 shadow-sm"
                                onClick={() => handleAcceptBid(seat.id, bid.id)}
                                disabled={isAnyBidProcessing}
                              >
                                {isCurrentlyProcessing ? "Processing..." : "Select Candidate"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Handled State: Vacant / No bids */}
                  {!acceptedBid && seat.bids.length === 0 && (
                    <div className="text-center py-10 text-sm text-slate-500 font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-200 shadow-sm">
                        <AlertCircle className="w-5 h-5 text-slate-400" />
                      </div>
                      <span>No proposals submission detected for this operational role yet.</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Contextual Completion Banner */}
        {allSeatsFilled && project.status === 'AUCTION_ACTIVE' && (
          <div className="p-6 border-t border-emerald-200 bg-emerald-50/80 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4">
            <div className="flex items-center gap-3 text-emerald-800">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight block">Roster Assembly Finalized</span>
                <p className="text-xs text-emerald-700 font-medium mt-0.5">The system is updating your project lifecycle states synchronously.</p>
              </div>
            </div>
            <Button 
               className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-sm w-full sm:w-auto"
               onClick={() => navigate(-1)}
            >
              Return to Listings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
