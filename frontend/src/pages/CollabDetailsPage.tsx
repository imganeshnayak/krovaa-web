import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileText, MessageSquare, Paperclip, User, Calendar, MapPin, Briefcase, IndianRupee, Clock, Code2, Share2, Users, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch, ProjectListing } from "@/lib/api";
import ShareJobDialog from "../components/ShareJobDialog";
import { CollabSaveButton } from "../components/collab/CollabSaveButton";
import SeatBidDrawer from "../components/collab/SeatBidDrawer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const formatPostedAt = (createdAt: string) => {
  return new Date(createdAt).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const CollabDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showAuthPromptModal, setShowAuthPromptModal] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<any | null>(null);

  const isCreator = Boolean(user && project && project.creatorId === user.id);

  const loadProject = async () => {
    if (!id) {
      setError("Invalid project selected.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<ProjectListing>(`/api/collab/${id}`);
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id, user]);

  const handleSeatClick = (seat: any) => {
    if (!user) {
      setShowAuthPromptModal(true);
      return;
    }
    setSelectedSeat(seat);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pb-48 pt-6 sm:px-6 relative">
      {/* Navigation Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to blueprints
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-12 text-center text-sm text-slate-500 animate-pulse">
          Loading blueprint details...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          {error}
        </div>
      ) : !project ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          Blueprint details not found.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
            
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                      Collaboration Blueprint
                    </span>
                    <div className="flex gap-2 items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowShareDialog(true)}
                        className="rounded-xl border-slate-200 text-xs font-semibold gap-1.5 hover:text-[#00A4EF] hover:border-[#00A4EF]/30"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </Button>
                      <CollabSaveButton projectId={project.id} isSaved={(project as any).hasSaved} className="rounded-xl border-slate-200" />
                    </div>
                  </div>
                  <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{project.title}</h1>
                  
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-slate-600 mt-4">
                    {project.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span>{project.location}</span>
                      </div>
                    )}
                    {project.duration && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{project.duration}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <IndianRupee className="h-4 w-4 text-slate-500" />
                      <span>{Number(project.baseBudget).toLocaleString('en-IN')} Total Budget</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Project Specifications</h3>
                  <div className="text-sm leading-7 text-slate-600 whitespace-pre-wrap font-normal">
                    {project.description}
                  </div>
                </div>

                {project.terms && Array.isArray(project.terms) && project.terms.length > 0 && (
                  <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Terms & Conditions</h3>
                    <div className="text-sm leading-7 text-slate-600 whitespace-pre-wrap font-normal">
                      {project.terms.join('\n')}
                    </div>
                  </div>
                )}
                
                {project.attachments && project.attachments.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Paperclip className="h-4 w-4 text-slate-500" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Project Reference Documentation ({project.attachments.length})</h2>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {project.attachments.map((attachment: any) => {
                        const isImage = attachment.fileType?.startsWith("image/");
                        return (
                          <a
                            key={attachment.id}
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
                          >
                            {isImage ? (
                              <img src={attachment.fileUrl} alt={attachment.fileName} className="h-32 w-full object-cover border-b border-slate-100" />
                            ) : (
                              <div className="flex h-32 items-center justify-center bg-slate-100 text-slate-400 border-b border-slate-100">
                                <FileText className="h-8 w-8 text-slate-400" />
                              </div>
                            )}
                            <div className="p-3 bg-white">
                              <p className="truncate text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {attachment.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{attachment.fileType}</p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-6">
              
              {/* Creator Card */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">Project Visionary</p>
                <a href={`/profile/${encodeURIComponent(project.creator?.username ?? '')}`} className="flex items-center gap-3 group">
                  <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {project.creator?.avatarUrl ? (
                      <img src={project.creator.avatarUrl} alt={project.creator.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {project.company || project.creator?.displayName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">@{project.creator?.username}</p>
                  </div>
                </a>
                
                <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-600">Posted on {formatPostedAt(project.createdAt)}</span>
                </div>
              </div>

              {/* Roles Available */}
              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-500" />
                        Available Roles
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">Join the Squad</p>
                    </div>
                    <span className="bg-indigo-100 text-indigo-700 font-bold text-xs px-2 py-1 rounded-lg">
                      {project.seats?.length || 0} Seats
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col p-2 gap-1.5 max-h-[300px] overflow-y-auto">
                  {project.seats?.map((seat: any) => {
                    const isOccupied = seat.status === 'OCCUPIED';
                    const hasMyBid = seat.bids?.some((b: any) => b.userId === user?.id);
                    
                    return (
                      <div 
                        key={seat.id} 
                        onClick={() => !isOccupied && !isCreator && handleSeatClick(seat)}
                        className={`rounded-xl p-3 border text-left transition-all relative overflow-hidden ${
                          isOccupied 
                            ? 'bg-slate-50 border-slate-100 opacity-75 cursor-not-allowed' 
                            : isCreator
                              ? 'bg-white border-slate-200 cursor-default'
                              : hasMyBid
                                ? 'bg-indigo-50/50 border-indigo-200 hover:border-indigo-300 cursor-pointer'
                                : 'bg-white border-slate-200 hover:border-[#00A4EF]/50 hover:shadow-sm cursor-pointer hover:bg-slate-50'
                        }`}
                      >
                        {hasMyBid && !isOccupied && (
                          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                            Applied
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-bold text-slate-900">{seat.roleName}</h4>
                          {!isOccupied && (
                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center">
                              <IndianRupee className="h-3 w-3 mr-0.5 text-slate-400" />
                              {Math.round((seat.splitPercent / 100) * project.baseBudget).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3 min-h-[32px]">
                          {seat.description}
                        </p>
                        
                        {isOccupied ? (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/50">
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={seat.user?.avatarUrl} />
                              <AvatarFallback className="text-[8px]">{seat.user?.displayName?.substring(0,2)}</AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] font-semibold text-slate-600 flex-1 truncate">{seat.user?.displayName} occupied this role</span>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {seat.bidCount || 0} Bids
                            </span>
                            {!isCreator && (
                              <span className={`text-[10px] font-bold flex items-center ${hasMyBid ? 'text-indigo-600' : 'text-[#00A4EF]'}`}>
                                {hasMyBid ? 'View Your Bid' : 'Apply for Seat'} <ArrowUpRight className="h-3 w-3 ml-0.5" />
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Share Job Dialog */}
      {project && showShareDialog && (
        <ShareJobDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          jobId={project.id}
          jobTitle={project.title}
          companyName={project.company || "Project Owner"}
          type="collab"
        />
      )}

      {/* Seat Bid Drawer */}
      {project && selectedSeat && (
        <SeatBidDrawer
          project={project}
          initialSeat={selectedSeat}
          isOpen={!!selectedSeat}
          onClose={() => setSelectedSeat(null)}
          onBidSuccess={() => loadProject()}
        />
      )}

      {/* Authentication Required Dialog Modal */}
      <Dialog open={showAuthPromptModal} onOpenChange={setShowAuthPromptModal}>
        <DialogContent className="sm:max-w-[440px] p-6 rounded-[2rem] border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xl">
          <DialogHeader className="space-y-1">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#00A4EF]/10 text-[#00A4EF] mb-2 animate-bounce">
              <User className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-center text-slate-900">Authentication Required</DialogTitle>
            <DialogDescription className="text-sm text-center text-slate-500">
              You must log in or create a free account to join a squad and submit bids.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button
              className="w-full rounded-2xl bg-[#00A4EF] h-12 text-sm font-semibold text-white hover:bg-[#0087d1] shadow-md transition-all active:scale-[0.98]"
              onClick={() => {
                setShowAuthPromptModal(false);
                navigate(`/login?redirect=/blueprint/${id}`);
              }}
            >
              Sign In to Your Account
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-2xl border-slate-200 h-12 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]"
              onClick={() => {
                setShowAuthPromptModal(false);
                navigate(`/register?redirect=/blueprint/${id}`);
              }}
            >
              Create a Free Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollabDetailsPage;
