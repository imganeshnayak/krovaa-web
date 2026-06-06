import { useState, useMemo } from "react";
import { X, Plus, Trash2, Users, User as UserIcon, IndianRupee, Briefcase, MapPin, Clock, Calendar, CheckCircle, FileText, Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCollabProject } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface SeatDef {
  id: string;
  roleName: string;
  amount: number | "";
  seatBudget: number | "";
}

interface MilestoneDef {
  id: string;
  title: string;
  amount: number | "";
}

export default function UnifiedProjectModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const [mode] = useState<"GROUP">("GROUP");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [baseBudget, setBaseBudget] = useState("");

  const [seats, setSeats] = useState<SeatDef[]>([
    { id: "1", roleName: "", amount: 1, seatBudget: "" }
  ]);
  const [milestones, setMilestones] = useState<MilestoneDef[]>([
    { id: "1", title: "Final Delivery", amount: "" }
  ]);

  const [company, setCompany] = useState("");
  const [workMode, setWorkMode] = useState("Remote");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [deadline, setDeadline] = useState("");
  const [skills, setSkills] = useState("");
  const [terms, setTerms] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<(string | null)[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const updatedFiles = [...attachments, ...newFiles].slice(0, 10);
      setAttachments(updatedFiles);

      const previews = newFiles.map(file => {
        if (file.type.startsWith('image/')) {
          return URL.createObjectURL(file);
        }
        return null;
      });
      setAttachmentPreviews([...attachmentPreviews, ...previews].slice(0, 10));
    }
  };

  const removeAttachment = (index: number) => {
    const updatedFiles = [...attachments];
    updatedFiles.splice(index, 1);
    setAttachments(updatedFiles);

    const updatedPreviews = [...attachmentPreviews];
    if (updatedPreviews[index]) {
      URL.revokeObjectURL(updatedPreviews[index] as string);
    }
    updatedPreviews.splice(index, 1);
    setAttachmentPreviews(updatedPreviews);
  };

  // Validation Math
  const parsedBudget = parseFloat(baseBudget) || 0;

  const totalSeatBudget = useMemo(() => {
    return seats.reduce((sum, seat) => {
      const amt = Number(seat.amount) || 0;
      const budget = Number(seat.seatBudget) || 0;
      return sum + (amt * budget);
    }, 0);
  }, [seats]);

  const totalMilestoneAmount = useMemo(() => {
    return milestones.reduce((sum, ms) => sum + (Number(ms.amount) || 0), 0);
  }, [milestones]);

  const isMathValid = useMemo(() => {
    const isSplitValid = Math.abs(totalSeatBudget - parsedBudget) < 0.01;
    const isMilestonesValid = Math.abs(totalMilestoneAmount - parsedBudget) < 0.01;
    
    return parsedBudget > 0 && isSplitValid && isMilestonesValid;
  }, [parsedBudget, totalSeatBudget, totalMilestoneAmount]);

  const isValid = title.trim() !== "" 
    && description.trim() !== ""
    && seats.every(s => s.roleName.trim() !== "" && Number(s.amount) > 0 && Number(s.seatBudget) > 0)
    && milestones.every(m => m.title.trim() !== "" && Number(m.amount) > 0)
    && isMathValid 
    && !isSubmitting;

  const getValidationError = () => {
    if (title.trim() === "") return "Project title is required.";
    if (description.trim() === "") return "Project description is required.";
    if (!seats.every(s => s.roleName.trim() !== "" && Number(s.amount) > 0 && Number(s.seatBudget) > 0)) return "All roles must have a name, seat count, and budget.";
    if (!milestones.every(m => m.title.trim() !== "" && Number(m.amount) > 0)) return "All milestones must have a title and amount.";
    if (parsedBudget <= 0) return "Target budget must be greater than 0.";
    if (Math.abs(totalSeatBudget - parsedBudget) >= 0.01) return "Total role budgets must equal the target budget exactly.";
    if (Math.abs(totalMilestoneAmount - parsedBudget) >= 0.01) return "Total milestone amounts must equal the target budget exactly.";
    return null;
  };

  const handleAddSeat = () => {
    setSeats([...seats, { id: Math.random().toString(), roleName: "", amount: 1, seatBudget: "" }]);
  };

  const handleRemoveSeat = (id: string) => {
    setSeats(seats.filter(s => s.id !== id));
  };

  const handleUpdateSeat = (id: string, field: keyof SeatDef, value: any) => {
    setSeats(seats.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleAddMilestone = () => {
    setMilestones([...milestones, { id: Math.random().toString(), title: "", amount: 0 }]);
  };

  const handleRemoveMilestone = (id: string) => {
    setMilestones(milestones.filter(m => m.id !== id));
  };

  const handleUpdateMilestone = (id: string, field: keyof MilestoneDef, value: any) => {
    setMilestones(milestones.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      await createCollabProject({
        title,
        description,
        baseBudget: parsedBudget,
        mode: 'GROUP',
        seats: seats.map(s => ({ 
          roleName: s.roleName, 
          splitPercent: ((Number(s.seatBudget) || 0) / parsedBudget) * 100, 
          amount: Number(s.amount) || 1 
        })),
        milestones: milestones.map(m => ({ title: m.title, amount: Number(m.amount) || 0 })),
        company,
        location: workMode === "Remote" ? "Remote" : location,
        duration,
        deadline,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        terms: terms.split('\n').map(t => t.trim()).filter(Boolean),
        attachments
      });

      toast({ title: "Blueprint Deployed", description: "Your project is now live in the auction hub." });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast({ title: "Deployment Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-white p-0 overflow-hidden border border-slate-200">
        <div className="flex flex-col h-full max-h-[85vh]">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 pb-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">Create Squad Blueprint</DialogTitle>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase">Project Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g., Full-Stack Mobile App MVP"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase">Scope Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the project requirements..."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase">Target Budget (Max)</Label>
                <div className="relative mt-1.5">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="number"
                    value={baseBudget}
                    onChange={(e) => setBaseBudget(e.target.value)}
                    placeholder="0.00"
                    className="pl-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase">Company Name (Optional)</Label>
                  <div className="relative mt-1.5">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase">Work Mode</Label>
                  <select
                    value={workMode}
                    onChange={(e) => setWorkMode(e.target.value)}
                    className="w-full mt-1.5 flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Onsite">On-site</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase">Location</Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={workMode === "Remote" ? "Remote" : location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder={workMode === "Remote" ? "Remote" : "e.g. Bangalore, India"}
                      disabled={workMode === "Remote"}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase">Project Duration</Label>
                  <div className="relative mt-1.5">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="e.g. 3 Months"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase">Application Deadline</Label>
                  <div className="relative mt-1.5">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase">Required Skills</Label>
                  <Input
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="e.g. React, Node, AWS (comma separated)"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase">Terms & Conditions</Label>
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Enter each term on a new line..."
                  className="mt-1.5 min-h-[80px]"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase">Reference Documents (Max 10)</Label>
                <div className="mt-1.5 border-2 border-dashed border-slate-200 rounded-lg p-6 hover:bg-slate-50 transition-colors text-center relative">
                  <input
                    type="file"
                    multiple
                    onChange={handleAttachmentChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-slate-100 rounded-full text-slate-600">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      Click or drag files here
                    </div>
                    <div className="text-xs text-slate-500">
                      Supports PDFs, Docs, Images up to 20MB
                    </div>
                  </div>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {attachments.map((file, index) => (
                      <div key={index} className="relative group rounded-md border border-slate-200 bg-white p-2 flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 bg-slate-100 rounded flex items-center justify-center overflow-hidden">
                          {attachmentPreviews[index] ? (
                            <img src={attachmentPreviews[index] as string} alt="preview" className="h-full w-full object-cover" />
                          ) : (
                            <Paperclip className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-900 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="absolute -top-2 -right-2 p-1 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            <div className="space-y-8 pt-4 border-t border-slate-100">
                {/* Seats Array */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-xs font-bold text-slate-900 uppercase">Role Seats</Label>
                    <span className={`text-xs font-mono font-bold ${Math.abs(totalSeatBudget - parsedBudget) < 0.01 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      Total: ₹{totalSeatBudget.toFixed(2)} / ₹{parsedBudget.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {seats.map((seat) => (
                      <div key={seat.id} className="flex items-center gap-2">
                        <Input
                          placeholder="Role (e.g. UI Designer)"
                          value={seat.roleName}
                          onChange={(e) => handleUpdateSeat(seat.id, "roleName", e.target.value)}
                          className="flex-1"
                        />
                        <div className="w-20 relative">
                          <Input
                            type="number"
                            min="1"
                            value={seat.amount}
                            onChange={(e) => handleUpdateSeat(seat.id, "amount", e.target.value === "" ? "" : parseInt(e.target.value))}
                            className="pr-6 font-mono text-sm"
                            title="Number of seats for this role"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">x</span>
                        </div>
                        <div className="w-28 relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="number"
                            value={seat.seatBudget}
                            onChange={(e) => handleUpdateSeat(seat.id, "seatBudget", e.target.value === "" ? "" : parseFloat(e.target.value))}
                            className="pl-8 pr-2 font-mono text-sm"
                            title="Budget per seat"
                            placeholder="0.00"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSeat(seat.id)}
                          className="shrink-0 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddSeat} className="mt-3 w-full border-dashed text-slate-500">
                    <Plus className="h-4 w-4 mr-1" /> Add Role Requirement
                  </Button>
                </div>

                {/* Milestones Array */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-xs font-bold text-slate-900 uppercase">Milestones</Label>
                    <span className={`text-xs font-mono font-bold ${Math.abs(totalMilestoneAmount - parsedBudget) < 0.01 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      Total: ₹{totalMilestoneAmount.toFixed(2)} / ₹{parsedBudget.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {milestones.map((ms) => (
                      <div key={ms.id} className="flex items-center gap-2">
                        <Input
                          placeholder="Milestone Title"
                          value={ms.title}
                          onChange={(e) => handleUpdateMilestone(ms.id, "title", e.target.value)}
                          className="flex-1"
                        />
                        <div className="w-32 relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="number"
                            value={ms.amount}
                            onChange={(e) => handleUpdateMilestone(ms.id, "amount", e.target.value === "" ? "" : parseFloat(e.target.value))}
                            className="pl-8 font-mono text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMilestone(ms.id)}
                          className="shrink-0 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddMilestone} className="mt-3 w-full border-dashed text-slate-500">
                    <Plus className="h-4 w-4 mr-1" /> Add Milestone Stage
                  </Button>
                </div>
              </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
            <div className="text-[11px] font-semibold text-rose-500 leading-tight flex-1">
              {!isValid && getValidationError()}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="ghost" onClick={onClose} className="text-slate-600 font-bold">Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid} className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 shadow-sm">
                {isSubmitting ? "Deploying..." : "Deploy Blueprint"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}




