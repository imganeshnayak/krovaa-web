import { useState, useEffect } from "react";
import { X, IndianRupee, CheckCircle2, AlertCircle, ArrowLeft, Send, Sparkles, Layers, Award, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectListing, GroupSeat, submitSeatBid } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Label } from "@/components/ui/label";

interface SeatBidDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectListing | null;
  onBidSuccess: () => void;
  initialSeat?: GroupSeat | null;
}

export default function SeatBidDrawer({ isOpen, onClose, project, onBidSuccess, initialSeat }: SeatBidDrawerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isDesktop = useMediaQuery("(min-width: 768px)");
  
  const [selectedSeat, setSelectedSeat] = useState<GroupSeat | null>(initialSeat || null);
  const [bidAmount, setBidAmount] = useState("");
  const [proposalPitch, setProposalPitch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedSeat(initialSeat || null);
      if (initialSeat && project) {
        const allocatedBudget = project.baseBudget * (initialSeat.splitPercent / 100);
        setBidAmount(Math.round(allocatedBudget).toString());
      } else {
        setBidAmount("");
      }
    }
  }, [isOpen, initialSeat, project]);

  if (!project) return null;

  const handleApplyClick = (seat: GroupSeat) => {
    const allocatedBudget = project.baseBudget * (seat.splitPercent / 100);
    setBidAmount(Math.round(allocatedBudget).toString());
    setSelectedSeat(seat);
  };

  const handleSubmitBid = async () => {
    if (!selectedSeat) return;
    
    setIsSubmitting(true);
    try {
      await submitSeatBid(project.id, selectedSeat.id, {
        bidAmount: parseFloat(bidAmount),
        proposalPitch
      });
      toast({ title: "Proposal Dispatched", description: "Your bid has been added to the review dashboard." });
      setSelectedSeat(null);
      setBidAmount("");
      setProposalPitch("");
      onBidSuccess();
      onClose();
    } catch (err) {
      toast({ title: "Submission Failed", description: err instanceof Error ? err.message : "Network transaction drop.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedSeat(null);
    onClose();
  };

  const parsedBid = parseFloat(bidAmount) || 0;
  const targetMaximumBudget = Math.round(project.baseBudget * ((selectedSeat?.splitPercent || 0) / 100));
  const isOverbudget = parsedBid > targetMaximumBudget;

  const renderMainContent = () => (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/40">
      {selectedSeat ? (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Apply Form Header */}
          <div className="p-5 bg-white border-b border-slate-100 flex items-center gap-4 shrink-0">
            <button 
              onClick={() => setSelectedSeat(null)} 
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Award className="w-5 h-5 text-[#00A4EF]" />
                Apply as {selectedSeat.roleName}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Application for {project.title}</p>
            </div>
          </div>

          <ScrollArea className="flex-1 p-5 md:p-6 bg-slate-50/50">
            <div className="space-y-6 pb-6">
              
              {/* Proportional Split Info */}
              <div className="bg-white border border-[#00A4EF]/20 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#00A4EF]" />
                <div className="space-y-1">
                  <span className="text-xs text-[#00A4EF] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Milestone Proportional Share
                  </span>
                  <p className="text-sm text-slate-600 font-medium">This position claims a locked weight split of every fund release.</p>
                </div>
                <Badge variant="secondary" className="font-mono text-sm font-bold px-4 py-2 bg-[#00A4EF]/10 text-[#00A4EF] border border-[#00A4EF]/20">
                  {selectedSeat.splitPercent}% Split
                </Badge>
              </div>

              {/* Bid Amount Input */}
              <div className="space-y-2.5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-slate-800 tracking-tight text-sm">Proposed Fee Value</Label>
                  <span className="text-slate-500 text-xs font-medium bg-slate-100 px-2 py-1 rounded-md">
                    Suggested limit: <strong className="font-mono text-slate-800">₹{targetMaximumBudget.toLocaleString('en-IN')}</strong>
                  </span>
                </div>
                <div className="relative group">
                  <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#00A4EF] transition-colors" />
                  <Input 
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="pl-9 font-mono text-base h-12 border-slate-200 rounded-xl focus-visible:ring-[#00A4EF]/20 focus-visible:border-[#00A4EF] transition-all bg-slate-50 focus:bg-white"
                  />
                </div>
                {isOverbudget && (
                  <div className="flex items-start gap-2 text-amber-700 text-xs font-medium bg-amber-50 border border-amber-200 p-3 rounded-xl animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>Your quote exceeds the client's allocated pool. This could reduce your competitive matching score for this role.</span>
                  </div>
                )}
              </div>

              {/* Proposal Pitch Input */}
              <div className="space-y-2.5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <Label className="font-bold text-slate-800 tracking-tight text-sm">Professional Core Pitch</Label>
                <Textarea 
                  value={proposalPitch}
                  onChange={(e) => setProposalPitch(e.target.value)}
                  className="min-h-[180px] text-sm leading-relaxed border-slate-200 resize-none p-4 rounded-xl focus-visible:ring-[#00A4EF]/20 focus-visible:border-[#00A4EF] transition-all bg-slate-50 focus:bg-white"
                  placeholder="Outline engineering proficiencies, deployment timelines, and specific architectural achievements relevant to this position allocation..."
                />
              </div>
            </div>
          </ScrollArea>

          {/* Action Row */}
          <div className="p-4 md:p-6 bg-white border-t border-slate-100 flex gap-3 shrink-0 justify-end shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
            <Button variant="ghost" className="h-11 font-bold text-slate-500 rounded-xl px-6 hover:bg-slate-100" onClick={() => setSelectedSeat(null)}>
              Cancel
            </Button>
            <Button 
              className="bg-[#00A4EF] text-white hover:bg-[#0087d1] font-bold h-11 px-8 rounded-xl shadow-md gap-2 transition-all hover:shadow-lg disabled:opacity-50" 
              onClick={handleSubmitBid} 
              disabled={isSubmitting || !bidAmount || !proposalPitch.trim()}
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "Dispatching..." : "Submit Proposal"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Roles List Header */}
          <div className="p-6 md:p-8 bg-white border-b border-slate-100 shrink-0">
            <Badge className="bg-[#00A4EF]/10 text-[#00A4EF] hover:bg-[#00A4EF]/20 border-[#00A4EF]/20 mb-3 px-2.5 py-0.5">
              Role Selection
            </Badge>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">{project.title}</h2>
            <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed max-w-xl">{project.description}</p>
          </div>

          <ScrollArea className="flex-1 p-6 md:p-8 bg-slate-50/50">
            <div className="space-y-4 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Operational Positions Available</span>
              </div>
              
              {project.seats.map(seat => {
                const isMyBid = seat.bids?.some(b => b.userId === user?.id);
                const isOccupied = seat.status === 'OCCUPIED';

                return (
                  <div 
                    key={seat.id} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all ${
                      isOccupied 
                        ? 'opacity-60 border-slate-200 bg-slate-100 grayscale-[0.5]' 
                        : 'bg-white border-slate-200/80 hover:border-[#00A4EF]/40 hover:shadow-md cursor-pointer group'
                    }`}
                    onClick={() => {
                      if (!isOccupied && !isMyBid) handleApplyClick(seat);
                    }}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5 mb-4 sm:mb-0 pr-4">
                      <h4 className="text-base font-bold text-slate-900 tracking-tight truncate group-hover:text-[#00A4EF] transition-colors">
                        {seat.roleName}
                      </h4>
                      <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                        <span className="text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          ₹{Math.round(project.baseBudget * (seat.splitPercent / 100)).toLocaleString('en-IN')}
                        </span>
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> {seat.bidCount || 0} proposals
                        </span>
                      </div>
                    </div>
                    
                    <div className="shrink-0 flex sm:block justify-end">
                      {isOccupied ? (
                        <Badge variant="secondary" className="text-xs font-bold text-slate-500 bg-slate-200/80 px-3 py-1 rounded-lg border-transparent">
                          Position Filled
                        </Badge>
                      ) : isMyBid ? (
                        <Badge variant="outline" className="text-xs font-bold text-emerald-700 bg-emerald-50 border-emerald-200 gap-1.5 px-3 py-1 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Bid
                        </Badge>
                      ) : (
                        <Button 
                          className="bg-[#00A4EF] text-white hover:bg-[#0087d1] font-bold h-9 text-xs px-6 rounded-xl shadow-sm transition-colors w-full sm:w-auto group-hover:bg-[#0087d1]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyClick(seat);
                          }}
                        >
                          Apply Now
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-[600px] h-[80vh] p-0 overflow-hidden rounded-3xl border-slate-200 bg-white shadow-2xl flex flex-col">
          {renderMainContent()}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DrawerContent className="bg-slate-50 border-t border-slate-200 h-[85vh] flex flex-col overflow-hidden rounded-t-[2rem]">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-300/50 mt-4 mb-2 shrink-0" />
        <div className="flex-1 overflow-hidden">
          {renderMainContent()}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
