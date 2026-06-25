import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ProjectListing, releaseCollabMilestone } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, IndianRupee, Milestone, ShieldAlert } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function WorkspaceDrawer({
  isOpen,
  onClose,
  project,
  onUpdate
}: {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectListing | null;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isReleasing, setIsReleasing] = useState<number | null>(null);

  if (!project) return null;

  const isCreator = user?.id === project.creatorId;

  const handleRelease = async (milestoneId: number) => {
    if (!window.confirm("Are you sure you want to release this milestone? Funds will be irrevocably transferred to the team according to their split percentage.")) return;
    
    setIsReleasing(milestoneId);
    try {
      await releaseCollabMilestone(project.id, milestoneId);
      toast({ title: "Milestone Released", description: "Funds have been distributed to the team." });
      onUpdate();
    } catch (err: any) {
      toast({ title: "Failed to release", description: err.message, variant: "destructive" });
    } finally {
      setIsReleasing(null);
    }
  };

  const completedCount = project.milestones.filter(m => m.isReleased).length;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-white border-t border-slate-200 h-[85vh]">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-200 mt-4 mb-2" />
        
        <DrawerHeader className="px-6 text-left shrink-0">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
                <Milestone className="w-5 h-5 text-white" />
             </div>
             <div>
               <DrawerTitle className="text-xl font-bold text-slate-900">Project Milestones</DrawerTitle>
               <DrawerDescription className="text-xs text-slate-500 font-medium">
                 {completedCount} of {project.milestones.length} completed
               </DrawerDescription>
             </div>
           </div>
           
           <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
             <div 
               className="bg-[#00A4EF] h-full rounded-full transition-all duration-500" 
               style={{ width: `${(completedCount / project.milestones.length) * 100}%`}}
             />
           </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-6">
           <div className="space-y-4 pb-6 mt-2">
             {project.milestones.map((ms, index) => (
               <div key={ms.id} className={`p-4 rounded-2xl border ${ms.isReleased ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                 <div className="flex justify-between items-start">
                   <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phase {index + 1}</span>
                      <h4 className={`text-base font-bold mt-1 ${ms.isReleased ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>
                        {ms.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-3 text-sm font-bold text-slate-700">
                         <IndianRupee className="w-4 h-4 text-slate-400" />
                         {ms.amount.toFixed(2)}
                      </div>
                   </div>
                   
                   <div>
                     {ms.isReleased ? (
                        <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" /> Paid
                        </div>
                     ) : isCreator ? (
                        <Button 
                          onClick={() => handleRelease(ms.id)}
                          disabled={isReleasing !== null || project.status !== 'ACTIVE_WORKSPACE'}
                          className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm text-xs h-9 px-4 rounded-xl"
                        >
                          {isReleasing === ms.id ? "Processing..." : "Release Funds"}
                        </Button>
                     ) : (
                        <div className="bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                          Locked in Escrow
                        </div>
                     )}
                   </div>
                 </div>

                 {/* Role payout preview (just for context) */}
                 {!ms.isReleased && (
                   <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                      {project.seats.filter(s=>s.status === 'OCCUPIED').map(seat => (
                         <div key={seat.id} className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 font-medium truncate pr-2">{seat.roleName} ({seat.splitPercent}%)</span>
                            <span className="text-slate-900 font-bold">₹{(ms.amount * (seat.splitPercent / 100)).toFixed(2)}</span>
                         </div>
                      ))}
                   </div>
                 )}
               </div>
             ))}
           </div>
        </ScrollArea>

        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 text-center flex justify-center">
           <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
             <ShieldAlert className="w-3.5 h-3.5" />
             Once released, milestone funds are split mathematically across the squad.
           </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
