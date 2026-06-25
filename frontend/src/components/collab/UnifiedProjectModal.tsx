import { useState, useMemo, useRef } from "react";
import {
  X, Plus, Trash2, IndianRupee, Briefcase, MapPin, Clock,
  Calendar, FileText, Paperclip, ChevronRight, ChevronLeft,
  Layers, Users, Target, CheckCircle2, AlertCircle, Sparkles, Tag
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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

const STEPS = [
  { id: 1, label: "Basics", icon: Layers, description: "Project overview & budget" },
  { id: 2, label: "Details", icon: Briefcase, description: "Work setup & skills" },
  { id: 3, label: "Team", icon: Users, description: "Roles & seat allocation" },
  { id: 4, label: "Milestones", icon: Target, description: "Payment milestones" },
];

const SKILL_SUGGESTIONS = ["React", "Node.js", "Python", "TypeScript", "AWS", "UI/UX", "Flutter", "MongoDB", "PostgreSQL", "Docker", "GraphQL", "Next.js"];

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
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [baseBudget, setBaseBudget] = useState("");

  // Step 2
  const [company, setCompany] = useState("");
  const [workMode, setWorkMode] = useState("Remote");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [deadline, setDeadline] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [terms, setTerms] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<(string | null)[]>([]);

  // Step 3
  const [seats, setSeats] = useState<SeatDef[]>([
    { id: "1", roleName: "", amount: 1, seatBudget: "" }
  ]);

  // Step 4
  const [milestones, setMilestones] = useState<MilestoneDef[]>([
    { id: "1", title: "Final Delivery", amount: "" }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedBudget = parseFloat(baseBudget) || 0;

  const totalSeatBudget = useMemo(() =>
    seats.reduce((sum, s) => sum + (Number(s.amount) || 0) * (Number(s.seatBudget) || 0), 0),
    [seats]
  );

  const totalMilestoneAmount = useMemo(() =>
    milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0),
    [milestones]
  );

  const seatBudgetValid = parsedBudget > 0 && Math.abs(totalSeatBudget - parsedBudget) < 0.01;
  const milestonesValid = parsedBudget > 0 && Math.abs(totalMilestoneAmount - parsedBudget) < 0.01;

  const stepValid = useMemo(() => {
    if (currentStep === 1) return title.trim() !== "" && description.trim() !== "" && parsedBudget > 0;
    if (currentStep === 2) return true;
    if (currentStep === 3) return seats.every(s => s.roleName.trim() !== "" && Number(s.amount) > 0 && Number(s.seatBudget) > 0) && seatBudgetValid;
    if (currentStep === 4) return milestones.every(m => m.title.trim() !== "" && Number(m.amount) > 0) && milestonesValid;
    return false;
  }, [currentStep, title, description, parsedBudget, seats, seatBudgetValid, milestones, milestonesValid]);

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const updatedFiles = [...attachments, ...newFiles].slice(0, 10);
      setAttachments(updatedFiles);
      const previews = newFiles.map(file =>
        file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      );
      setAttachmentPreviews([...attachmentPreviews, ...previews].slice(0, 10));
    }
  };

  const removeAttachment = (index: number) => {
    const updated = [...attachments];
    updated.splice(index, 1);
    setAttachments(updated);
    const updatedP = [...attachmentPreviews];
    if (updatedP[index]) URL.revokeObjectURL(updatedP[index] as string);
    updatedP.splice(index, 1);
    setAttachmentPreviews(updatedP);
  };

  const addSkillTag = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skillTags.includes(trimmed)) {
      setSkillTags([...skillTags, trimmed]);
    }
    setSkillInput("");
  };

  const removeSkillTag = (tag: string) => setSkillTags(skillTags.filter(t => t !== tag));

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkillTag(skillInput);
    }
    if (e.key === "Backspace" && skillInput === "" && skillTags.length > 0) {
      removeSkillTag(skillTags[skillTags.length - 1]);
    }
  };

  const handleAddSeat = () =>
    setSeats([...seats, { id: Math.random().toString(), roleName: "", amount: 1, seatBudget: "" }]);

  const handleRemoveSeat = (id: string) => setSeats(seats.filter(s => s.id !== id));

  const handleUpdateSeat = (id: string, field: keyof SeatDef, value: any) =>
    setSeats(seats.map(s => s.id === id ? { ...s, [field]: value } : s));

  const handleAddMilestone = () =>
    setMilestones([...milestones, { id: Math.random().toString(), title: "", amount: "" }]);

  const handleRemoveMilestone = (id: string) => setMilestones(milestones.filter(m => m.id !== id));

  const handleUpdateMilestone = (id: string, field: keyof MilestoneDef, value: any) =>
    setMilestones(milestones.map(m => m.id === id ? { ...m, [field]: value } : m));

  const handleSubmit = async () => {
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
        skills: skillTags,
        terms: terms.split('\n').map(t => t.trim()).filter(Boolean),
        attachments
      });
      toast({ title: "🚀 Blueprint Deployed!", description: "Your collab project is now live in the auction hub." });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast({ title: "Deployment Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    onClose();
  };

  const BudgetBar = ({ total, label, valid }: { total: number; label: string; valid: boolean }) => {
    const pct = parsedBudget > 0 ? Math.min((total / parsedBudget) * 100, 100) : 0;
    const over = parsedBudget > 0 && total > parsedBudget;
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-slate-500">{label}</span>
          <span className={valid ? "text-emerald-600" : over ? "text-rose-500" : "text-amber-500"}>
            ₹{total.toLocaleString()} / ₹{parsedBudget.toLocaleString()}
            {valid && " ✓"}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${valid ? "bg-emerald-500" : over ? "bg-rose-500" : "bg-amber-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden border-0 shadow-2xl" style={{
        maxWidth: "660px",
        background: "linear-gradient(135deg, #0f0c29, #1a1545, #24243e)",
        borderRadius: "20px",
      }}>
        {/* Gradient header */}
        <div className="relative px-7 pt-7 pb-5" style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))",
          borderBottom: "1px solid rgba(255,255,255,0.07)"
        }}>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl" style={{ background: "linear-gradient(135deg, #8b5cf6, #3b82f6)" }}>
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Post a Collab Job</h2>
              <p className="text-xs text-white/50">Build your dream squad with a funded blueprint</p>
            </div>
          </div>

          {/* Step Progress */}
          <div className="flex items-center gap-0">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isDone = step.id < currentStep;
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => isDone && setCurrentStep(step.id)}
                    className={`flex flex-col items-center gap-1.5 flex-1 group ${isDone ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isDone ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400" :
                      isActive ? "border text-white shadow-lg shadow-purple-500/30" :
                      "bg-white/5 border border-white/10 text-white/30"
                    }`} style={isActive ? { background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", border: "none" } : {}}>
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={`text-[10px] font-semibold tracking-wide ${isActive ? "text-white" : isDone ? "text-emerald-400" : "text-white/30"}`}>
                      {step.label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className={`h-px w-6 mx-1 mb-4 transition-all duration-300 ${step.id < currentStep ? "bg-emerald-500/40" : "bg-white/10"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-7 py-6 space-y-5" style={{ maxHeight: "420px", color: "white" }}>

          {/* ── STEP 1: Basics ── */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <FormField label="Project Title" required>
                <StyledInput
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Full-Stack Mobile App MVP"
                />
              </FormField>

              <FormField label="Project Description" required hint="Describe what you're building and what kind of collaborators you need.">
                <StyledTextarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detail the project scope, goals, and what success looks like..."
                  rows={4}
                />
              </FormField>

              <FormField label="Target Budget" required hint="Total escrow amount that will be distributed across roles & milestones.">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 font-bold text-sm">₹</span>
                  <StyledInput
                    type="number"
                    value={baseBudget}
                    onChange={e => setBaseBudget(e.target.value)}
                    placeholder="0.00"
                    className="pl-9 font-mono text-lg"
                  />
                </div>
              </FormField>
            </div>
          )}

          {/* ── STEP 2: Details ── */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Company Name" hint="Optional">
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <StyledInput value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Acme Corp" className="pl-10" />
                  </div>
                </FormField>

                <FormField label="Work Mode">
                  <StyledSelect value={workMode} onChange={e => setWorkMode(e.target.value)}>
                    <option value="Remote">🌐 Remote</option>
                    <option value="Hybrid">🏠 Hybrid</option>
                    <option value="Onsite">🏢 On-site</option>
                  </StyledSelect>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Location" hint={workMode === "Remote" ? "Not applicable for Remote" : undefined}>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <StyledInput
                      value={workMode === "Remote" ? "Remote" : location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder={workMode === "Remote" ? "Remote" : "e.g. Bangalore, India"}
                      disabled={workMode === "Remote"}
                      className="pl-10"
                    />
                  </div>
                </FormField>

                <FormField label="Duration">
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <StyledInput value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 3 Months" className="pl-10" />
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Application Deadline">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <StyledInput type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="pl-10" />
                  </div>
                </FormField>

                <div />
              </div>

              {/* Skill Tags */}
              <FormField label="Required Skills" hint="Press Enter or comma to add a skill">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 min-h-[52px] flex flex-wrap gap-2">
                  {skillTags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-purple-300 bg-purple-500/20 border border-purple-500/30">
                      {tag}
                      <button onClick={() => removeSkillTag(tag)} className="text-purple-400 hover:text-rose-400 transition-colors ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    placeholder={skillTags.length === 0 ? "Type a skill and press Enter..." : "Add more..."}
                    className="bg-transparent outline-none text-sm text-white placeholder:text-white/30 min-w-[120px] flex-1"
                  />
                </div>
                {/* Suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SKILL_SUGGESTIONS.filter(s => !skillTags.includes(s)).slice(0, 8).map(s => (
                    <button key={s} onClick={() => addSkillTag(s)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white/40 border border-white/10 hover:text-purple-300 hover:border-purple-500/40 hover:bg-purple-500/10 transition-all">
                      + {s}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Terms & Conditions" hint="Enter each term on a new line">
                <StyledTextarea value={terms} onChange={e => setTerms(e.target.value)} placeholder="e.g. IP rights belong to the funder&#10;NDA required&#10;Weekly check-ins mandatory" rows={3} />
              </FormField>

              {/* Attachments */}
              <FormField label="Reference Documents" hint="Max 10 files · PDFs, Docs, Images up to 20MB">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-xl p-5 text-center cursor-pointer hover:border-purple-500/40 hover:bg-purple-500/5 transition-all group"
                >
                  <input ref={fileInputRef} type="file" multiple onChange={handleAttachmentChange} className="hidden" />
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-purple-500/20 transition-colors">
                      <FileText className="h-5 w-5 text-white/30 group-hover:text-purple-400 transition-colors" />
                    </div>
                    <p className="text-sm font-medium text-white/50 group-hover:text-white/70 transition-colors">Click to attach files</p>
                    <p className="text-[11px] text-white/25">or drag and drop here</p>
                  </div>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/5 border border-white/10 group relative">
                        <div className="h-8 w-8 shrink-0 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
                          {attachmentPreviews[idx] ? (
                            <img src={attachmentPreviews[idx] as string} alt="preview" className="h-full w-full object-cover" />
                          ) : (
                            <Paperclip className="h-3.5 w-3.5 text-white/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-white/70 truncate">{file.name}</p>
                          <p className="text-[10px] text-white/30">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button onClick={() => removeAttachment(idx)} className="p-1 rounded-full text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </FormField>
            </div>
          )}

          {/* ── STEP 3: Team / Seats ── */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <BudgetBar total={totalSeatBudget} label="Role Budget Allocated" valid={seatBudgetValid} />

              <div className="space-y-3">
                {seats.map((seat, idx) => (
                  <div key={seat.id} className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Role #{idx + 1}</span>
                      {seats.length > 1 && (
                        <button onClick={() => handleRemoveSeat(seat.id)} className="p-1 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <StyledInput
                      placeholder="Role title (e.g. UI Designer, Backend Dev)"
                      value={seat.roleName}
                      onChange={e => handleUpdateSeat(seat.id, "roleName", e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="No. of Seats">
                        <StyledInput
                          type="number"
                          min="1"
                          value={seat.amount}
                          onChange={e => handleUpdateSeat(seat.id, "amount", e.target.value === "" ? "" : parseInt(e.target.value))}
                          placeholder="1"
                        />
                      </FormField>
                      <FormField label="Budget per Seat (₹)">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-sm font-bold">₹</span>
                          <StyledInput
                            type="number"
                            value={seat.seatBudget}
                            onChange={e => handleUpdateSeat(seat.id, "seatBudget", e.target.value === "" ? "" : parseFloat(e.target.value))}
                            placeholder="0.00"
                            className="pl-8 font-mono"
                          />
                        </div>
                      </FormField>
                    </div>
                    {Number(seat.amount) > 0 && Number(seat.seatBudget) > 0 && (
                      <div className="text-xs text-white/40 font-mono bg-white/5 rounded-lg px-3 py-2">
                        Subtotal: ₹{((Number(seat.amount) || 0) * (Number(seat.seatBudget) || 0)).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSeat}
                className="w-full py-3 rounded-xl border-2 border-dashed border-white/10 text-white/40 text-sm font-medium hover:border-purple-500/40 hover:text-purple-400 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add Another Role
              </button>

              {!seatBudgetValid && parsedBudget > 0 && totalSeatBudget > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Role budgets must total exactly ₹{parsedBudget.toLocaleString()}. Currently ₹{totalSeatBudget.toLocaleString()}.
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: Milestones ── */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <BudgetBar total={totalMilestoneAmount} label="Milestone Payments Scheduled" valid={milestonesValid} />

              <div className="space-y-3">
                {milestones.map((ms, idx) => (
                  <div key={ms.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-white/10 bg-white/5">
                    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", color: "white" }}>
                      {idx + 1}
                    </div>
                    <StyledInput
                      placeholder="Milestone title (e.g. Design Handoff)"
                      value={ms.title}
                      onChange={e => handleUpdateMilestone(ms.id, "title", e.target.value)}
                      className="flex-1"
                    />
                    <div className="w-36 relative shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-sm font-bold">₹</span>
                      <StyledInput
                        type="number"
                        value={ms.amount}
                        onChange={e => handleUpdateMilestone(ms.id, "amount", e.target.value === "" ? "" : parseFloat(e.target.value))}
                        placeholder="0.00"
                        className="pl-8 font-mono"
                      />
                    </div>
                    {milestones.length > 1 && (
                      <button onClick={() => handleRemoveMilestone(ms.id)} className="shrink-0 p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddMilestone}
                className="w-full py-3 rounded-xl border-2 border-dashed border-white/10 text-white/40 text-sm font-medium hover:border-purple-500/40 hover:text-purple-400 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add Milestone Stage
              </button>

              {!milestonesValid && parsedBudget > 0 && totalMilestoneAmount > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Milestone amounts must total exactly ₹{parsedBudget.toLocaleString()}. Currently ₹{totalMilestoneAmount.toLocaleString()}.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-7 py-4 flex items-center justify-between" style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(0,0,0,0.2)"
        }}>
          <div className="text-xs text-white/30 font-medium">
            Step {currentStep} of {STEPS.length}
          </div>

          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <Button
                variant="ghost"
                onClick={() => setCurrentStep(s => s - 1)}
                className="text-white/50 hover:text-white hover:bg-white/10 gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}

            {currentStep < STEPS.length ? (
              <Button
                onClick={() => setCurrentStep(s => s + 1)}
                disabled={!stepValid}
                className="gap-1.5 font-bold px-6"
                style={{
                  background: stepValid ? "linear-gradient(135deg, #8b5cf6, #3b82f6)" : undefined,
                  opacity: stepValid ? 1 : 0.4,
                  color: "white",
                  border: "none"
                }}
              >
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!stepValid || isSubmitting}
                className="gap-1.5 font-bold px-8"
                style={{
                  background: (stepValid && !isSubmitting) ? "linear-gradient(135deg, #10b981, #3b82f6)" : undefined,
                  opacity: (stepValid && !isSubmitting) ? 1 : 0.4,
                  color: "white",
                  border: "none"
                }}
              >
                {isSubmitting ? (
                  <><span className="animate-spin mr-1">⏳</span> Deploying...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Deploy Blueprint</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Small reusable styled sub-components ──

function FormField({ label, required, hint, children }: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-1.5">
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{label}</label>
        {required && <span className="text-rose-400 text-xs">*</span>}
        {hint && <span className="text-[10px] text-white/25 ml-auto">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function StyledInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-11 px-4 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all
        bg-white/5 border border-white/10
        focus:border-purple-500/60 focus:bg-purple-500/5 focus:ring-1 focus:ring-purple-500/30
        disabled:opacity-40 disabled:cursor-not-allowed
        ${className}`}
    />
  );
}

function StyledTextarea({ className = "", rows = 3, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { rows?: number }) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={`w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all resize-none
        bg-white/5 border border-white/10
        focus:border-purple-500/60 focus:bg-purple-500/5 focus:ring-1 focus:ring-purple-500/30
        ${className}`}
    />
  );
}

function StyledSelect({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full h-11 px-4 rounded-xl text-sm text-white outline-none transition-all appearance-none cursor-pointer
        bg-white/5 border border-white/10
        focus:border-purple-500/60 focus:bg-purple-500/5
        ${className}`}
      style={{ colorScheme: "dark" }}
    >
      {children}
    </select>
  );
}
