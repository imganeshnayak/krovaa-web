import { useNavigate } from "react-router-dom";
import { Users, IndianRupee, ArrowUpRight, Activity, Zap, CheckCircle2, Briefcase, MapPin, Clock, Edit3, Trash2, ShieldCheck, Share2, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { ProjectListing } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CollabSaveButton } from "./CollabSaveButton";

interface ProjectAuctionCardProps {
  project: ProjectListing;
  onApplyClick: (p: ProjectListing) => void;
  onFundClick: (p: ProjectListing) => void;
  onReviewClick: (p: ProjectListing) => void;
  onEditClick?: (p: ProjectListing) => void;
  onDeleteClick?: (p: ProjectListing) => void;
  onShareClick?: (p: ProjectListing) => void;
}

export default function ProjectAuctionCard({
  project,
  onApplyClick,
  onFundClick,
  onReviewClick,
  onEditClick,
  onDeleteClick,
  onShareClick
}: ProjectAuctionCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCreator = user?.id === project.creatorId;

  const formattedBudget = Number(project.baseBudget).toLocaleString('en-IN');

  const getStatusBadge = () => {
    switch (project.status) {
      case 'AUCTION_ACTIVE':
        return (
          <Badge variant="outline" className="bg-amber-50/60 text-amber-700 border-amber-200/80 gap-1.5 font-bold tracking-wider text-[10px] uppercase shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
            </span>
            Bidding Live
          </Badge>
        );
      case 'FUNDING_PENDING':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-bold tracking-wider text-[10px] uppercase shrink-0">
            <Zap className="h-3 w-3 fill-current" />
            Squad Assembled
          </Badge>
        );
      case 'ACTIVE_WORKSPACE':
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-bold tracking-wider text-[10px] uppercase shrink-0">
            <Activity className="h-3 w-3" />
            Funded & Live
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 gap-1 font-bold tracking-wider text-[10px] uppercase shrink-0">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <article onClick={() => navigate(`/blueprint/${project.id}`)} className="group cursor-pointer flex flex-col justify-between rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md relative overflow-hidden">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 truncate">
                <Avatar className="w-4 h-4">
                  <AvatarImage src={project.creator.avatarUrl} />
                  <AvatarFallback className="text-[8px] font-bold bg-slate-100 text-slate-600">
                    {project.creator.displayName?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{project.company || project.creator.displayName}</span>
                {isCreator && <span className="lowercase font-medium opacity-70">(you)</span>}
              </div>
              <h2 className="mt-1 text-base font-bold text-slate-950 tracking-tight line-clamp-1 group-hover:text-[#00A4EF] transition-colors">
                {project.title}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onShareClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareClick(project);
                  }}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-[#00A4EF] transition-colors"
                  title="Share blueprint"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              )}
              <CollabSaveButton
                projectId={project.id}
                isSaved={(project as any).hasSaved}
                className="rounded-full border-0 shadow-none hover:bg-slate-100 text-slate-400 hover:text-[#00A4EF] transition-colors"
              />
              {getStatusBadge()}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-500 line-clamp-3 font-normal min-h-[54px]">
            {project.description}
          </p>

          <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-[11px] font-medium text-slate-600 pt-2 border-t border-slate-50">
            {project.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-600" />
                <span className="truncate max-w-[80px]">{project.location}</span>
              </div>
            )}
            {project.duration && (
              <div className="flex items-center gap-1 text-[#0066CC] bg-[#E8F4FF] px-2 py-0.5 rounded-md">
                <Clock className="h-3.5 w-3.5 text-[#00A4EF]" />
                <span>{project.duration}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-md ml-auto">
              <IndianRupee className="h-3.5 w-3.5" />
              <span>{formattedBudget}</span>
            </div>
          </div>

          {/* Operational Data Zone */}
          <div className="flex flex-col justify-end">
            {project.status === 'AUCTION_ACTIVE' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Available Roles</p>
                <div className="flex flex-wrap gap-1.5 max-h-[64px] overflow-y-auto pr-1">
                  {project.seats?.map(seat => (
                    <div key={seat.id} className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-md px-2 py-1">
                      <span className="text-[11px] font-semibold text-slate-700">{seat.roleName}</span>
                      <Badge variant="secondary" className="text-[9px] font-bold px-1 py-0 bg-white border text-slate-500 shrink-0">
                        {seat.bidCount || 0}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {project.status === 'FUNDING_PENDING' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Selected Team</p>
                <div className="flex flex-wrap gap-1.5 max-h-[32px] overflow-hidden">
                  {project.seats?.map(seat => seat.user && (
                    <Tooltip key={seat.id}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 bg-sky-50/60 border border-sky-100 rounded-md px-1.5 py-0.5 cursor-help">
                          <Avatar className="w-3.5 h-3.5">
                            <AvatarImage src={seat.user.avatarUrl} />
                            <AvatarFallback className="text-[6px]">{seat.user.displayName.substring(0, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-bold text-slate-800 max-w-[60px] truncate">{seat.user.displayName}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs p-2">
                        <p className="font-bold">{seat.user.displayName}</p>
                        <p className="text-slate-400 text-[10px]">{seat.roleName}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-[11px] mt-1">
                  <span className="font-semibold text-slate-500">Contract Lock Value</span>
                  <span className="font-bold text-slate-900 flex items-center"><IndianRupee className="w-3 h-3 text-slate-400 mr-0.5" />{formattedBudget}</span>
                </div>
              </div>
            )}

            {project.status === 'ACTIVE_WORKSPACE' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[10px]">
                  <p className="font-bold uppercase text-slate-400 tracking-wider">Milestone Progress</p>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded-sm border border-emerald-100">
                    {project.milestones?.filter(m => m.isReleased).length || 0} / {project.milestones?.length || 0}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${((project.milestones?.filter(m => m.isReleased).length || 0) / (project.milestones?.length || 1)) * 100}%` }}
                  />
                </div>
                <div className="flex -space-x-1.5 overflow-hidden pt-0.5">
                  {project.seats?.filter(s => s.user).map(seat => (
                    <Avatar key={seat.id} className="inline-block h-5 w-5 ring-2 ring-white" title={`${seat.user!.displayName} (${seat.roleName})`}>
                      <AvatarImage src={seat.user!.avatarUrl} />
                      <AvatarFallback className="text-[7px] font-bold bg-slate-200">{seat.user!.displayName.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            {isCreator && (onEditClick || onDeleteClick) && (
              <>
                {onEditClick && (
                  <button onClick={(e) => { e.stopPropagation(); onEditClick(project); }} className="hover:text-slate-900 p-1 rounded-full hover:bg-slate-100 transition-colors" title="Edit Post">
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                {onDeleteClick && (
                  <button onClick={(e) => { e.stopPropagation(); onDeleteClick(project); }} className="hover:text-rose-600 p-1 rounded-full hover:bg-rose-50 transition-colors" title="Delete Post">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            {!isCreator && project.seats && project.seats.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <Users className="h-3.5 w-3.5 text-slate-600" />
                <span>{project.seats.length} Role{project.seats.length === 1 ? "" : "s"}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {project.status === 'AUCTION_ACTIVE' && isCreator && (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); onReviewClick(project); }} className="bg-slate-900 text-white hover:bg-slate-800 font-bold h-8 text-xs px-4 shadow-xs rounded-xl">
                Review Bids
              </Button>
            )}
            {project.status === 'AUCTION_ACTIVE' && !isCreator && (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/blueprint/${project.id}`); }} className="text-[#00A4EF] hover:bg-[#00A4EF]/10 font-bold h-8 text-xs px-4 rounded-xl">
                View & Apply
              </Button>
            )}
            {project.status === 'FUNDING_PENDING' && isCreator && (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); onFundClick(project); }} className="bg-sky-500 text-white hover:bg-sky-600 font-bold h-8 text-xs px-4 shadow-xs gap-1 rounded-xl">
                Fund & Launch
              </Button>
            )}
            {project.status === 'ACTIVE_WORKSPACE' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); navigate(`/collab/${project.id}`); }}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 font-bold text-xs px-3 gap-0.5 rounded-xl"
              >
                Enter Space
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Button>
            )}
          </div>
        </div>
      </article>
    </TooltipProvider>
  );
}