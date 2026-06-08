import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, Plus, Trash2, IndianRupee, Briefcase, MapPin, Clock,
  Calendar, FileText, Paperclip, ChevronRight, ChevronLeft,
  Layers, Users, Target, CheckCircle2, AlertCircle, ArrowLeft, Code2, Building
} from "lucide-react";
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

const SKILL_SUGGESTIONS = [
  "React", "Node.js", "Python", "TypeScript", "AWS", "UI/UX",
  "Flutter", "MongoDB", "PostgreSQL", "Docker", "GraphQL", "Next.js"
];

export default function PostCollabPage() {
  const navigate = useNavigate();
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
    if (currentStep === 3)
      return seats.every(s => s.roleName.trim() !== "" && Number(s.amount) > 0 && Number(s.seatBudget) > 0) && seatBudgetValid;
    if (currentStep === 4)
      return milestones.every(m => m.title.trim() !== "" && Number(m.amount) > 0) && milestonesValid;
    return false;
  }, [currentStep, title, description, parsedBudget, seats, seatBudgetValid, milestones, milestonesValid]);

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const updatedFiles = [...attachments, ...newFiles].slice(0, 10);
      setAttachments(updatedFiles);
      const previews = newFiles.map(file =>
        file.type.startsWith("image/") ? URL.createObjectURL(file) : null
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
    if (trimmed && !skillTags.includes(trimmed)) setSkillTags([...skillTags, trimmed]);
    setSkillInput("");
  };

  const removeSkillTag = (tag: string) => setSkillTags(skillTags.filter(t => t !== tag));

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkillTag(skillInput); }
    if (e.key === "Backspace" && skillInput === "" && skillTags.length > 0)
      removeSkillTag(skillTags[skillTags.length - 1]);
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
        mode: "GROUP",
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
        terms: terms.split("\n").map(t => t.trim()).filter(Boolean),
        attachments
      });
      toast({ title: "Blueprint Deployed!", description: "Your collab project is now live in the auction hub." });
      navigate("/explore");
    } catch (err) {
      toast({ title: "Deployment Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const BudgetBar = ({ total, label, valid }: { total: number; label: string; valid: boolean }) => {
    const over = parsedBudget > 0 && total > parsedBudget;
    const pct = parsedBudget > 0 ? Math.min((total / parsedBudget) * 100, 100) : 0;
    return (
      <div className="space-y-1.5 mb-5">
        <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>{label}</span>
          <span className={valid ? "text-emerald-600" : over ? "text-rose-500" : "text-amber-500"}>
            ₹{total.toLocaleString()} / ₹{parsedBudget.toLocaleString()}{valid && " ✓"}
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${valid ? "bg-emerald-500" : over ? "bg-rose-500" : "bg-amber-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-28 pt-6 sm:px-6">
      {/* Page Header */}
      <div className="mb-8 border-b border-slate-100 pb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group mb-3"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to jobs
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">Post a Collab Job</h1>
        <p className="text-sm text-slate-500 mt-1">Build your dream squad with a funded blueprint.</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Step Progress Bar */}
        <div className="flex items-center gap-0 mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isDone = step.id < currentStep;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => isDone && setCurrentStep(step.id)}
                  className={`flex flex-col items-center gap-2 flex-1 ${isDone ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border ${
                      isDone
                        ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                        : isActive
                          ? "bg-[#00A4EF] border-[#00A4EF] text-white shadow-md shadow-[#00A4EF]/20"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="text-center">
                    <p className={`text-[10px] font-bold tracking-wider uppercase ${
                      isActive ? "text-slate-900" : isDone ? "text-emerald-600" : "text-slate-400"
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-[9px] text-slate-500 hidden sm:block mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </button>
                {idx < STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-2 mb-6 transition-all duration-500 ${
                    step.id < currentStep ? "bg-emerald-200" : "bg-slate-100"
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content Container */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          {/* Section heading */}
          <div className="mb-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {(() => {
                const ActiveIcon = STEPS[currentStep - 1].icon;
                return <ActiveIcon className="h-5 w-5 text-[#00A4EF]" />;
              })()}
              {STEPS[currentStep - 1].label}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {STEPS[currentStep - 1].description}
            </p>
          </div>

          <div className="h-px bg-slate-100 w-full mb-6"></div>

          {/* ── STEP 1 ── */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <FormField label="Project Title" required>
                <StyledInput value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Full-Stack Mobile App MVP" />
              </FormField>
              <FormField label="Scope Description" required hint="What are you building? Who do you need?">
                <StyledTextarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the project scope, goals, and what success looks like..." rows={6} />
              </FormField>
              <FormField label="Target Budget" required hint="Total escrow distributed across roles & milestones">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sm text-slate-400">₹</span>
                  <StyledInput type="number" value={baseBudget} onChange={e => setBaseBudget(e.target.value)}
                    placeholder="0.00" className="pl-9 font-mono text-lg" />
                </div>
              </FormField>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Company Name" hint="Optional">
                  <div className="relative">
                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <StyledInput value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Acme Corp" className="pl-10" />
                  </div>
                </FormField>
                <FormField label="Work Mode">
                  <StyledSelect value={workMode} onChange={e => setWorkMode(e.target.value)}>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Onsite">Onsite</option>
                  </StyledSelect>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Location" hint={workMode === "Remote" ? "N/A for Remote" : undefined}>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <StyledInput
                      value={workMode === "Remote" ? "Remote" : location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder={workMode === "Remote" ? "Remote" : "e.g. Bangalore"}
                      disabled={workMode === "Remote"}
                      className="pl-10 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </FormField>
                <FormField label="Duration">
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <StyledInput value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 3 Months" className="pl-10" />
                  </div>
                </FormField>
              </div>

              <FormField label="Application Deadline">
                <div className="relative max-w-xs">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <StyledInput type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="pl-10" />
                </div>
              </FormField>

              <FormField label="Required Skills" hint="Press Enter or comma to add">
                <div className="rounded-xl p-3 min-h-[52px] flex flex-wrap gap-2 border border-slate-200 bg-slate-50/50">
                  {skillTags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#00A4EF]/10 text-[#00A4EF] border border-[#00A4EF]/20">
                      {tag}
                      <button onClick={() => removeSkillTag(tag)} className="ml-0.5 hover:text-rose-500 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    placeholder={skillTags.length === 0 ? "Type a skill and press Enter..." : "Add more..."}
                    className="bg-transparent outline-none text-sm text-slate-900 flex-1 min-w-[150px] placeholder:text-slate-400"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SKILL_SUGGESTIONS.filter(s => !skillTags.includes(s)).slice(0, 10).map(s => (
                    <button key={s} onClick={() => addSkillTag(s)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all text-slate-500 border border-slate-200 bg-white hover:bg-[#00A4EF]/5 hover:text-[#00A4EF] hover:border-[#00A4EF]/30"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Terms & Conditions" hint="One term per line">
                <StyledTextarea value={terms} onChange={e => setTerms(e.target.value)}
                  placeholder={"e.g. IP rights belong to the funder\nNDA required\nWeekly check-ins mandatory"}
                  rows={4} />
              </FormField>

              <FormField label="Reference Documents" hint="Max 10 files · PDFs, Docs, Images up to 20MB">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center cursor-pointer transition hover:border-[#00A4EF] hover:bg-[#F3FAFF] group"
                >
                  <input ref={fileInputRef} type="file" multiple onChange={handleAttachmentChange} className="hidden" />
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm group-hover:scale-105 transition-transform">
                      <FileText className="h-5 w-5 text-slate-400 group-hover:text-[#00A4EF]" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mt-1">Click to attach files</p>
                    <p className="text-[10px] text-slate-400">or drag and drop</p>
                  </div>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50/30 p-4">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 border border-slate-100">
                          {attachmentPreviews[idx]
                            ? <img src={attachmentPreviews[idx] as string} alt="preview" className="h-full w-full object-cover" />
                            : <Paperclip className="h-4 w-4 text-slate-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{file.name}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button onClick={() => removeAttachment(idx)} className="p-1.5 rounded-full border border-slate-100 text-slate-400 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </FormField>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <BudgetBar total={totalSeatBudget} label="Role Budget Allocated" valid={seatBudgetValid} />

              <div className="space-y-4">
                {seats.map((seat, idx) => (
                  <div key={seat.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4 shadow-sm relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-[#00A4EF]/10 text-[#00A4EF] flex items-center justify-center">
                          {idx + 1}
                        </div>
                        Role Profile
                      </span>
                      {seats.length > 1 && (
                        <button onClick={() => handleRemoveSeat(seat.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    <StyledInput
                      placeholder="Role title (e.g. UI Designer, Backend Dev)"
                      value={seat.roleName}
                      onChange={e => handleUpdateSeat(seat.id, "roleName", e.target.value)}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Seats">
                        <StyledInput type="number" min="1" value={seat.amount}
                          onChange={e => handleUpdateSeat(seat.id, "amount", e.target.value === "" ? "" : parseInt(e.target.value))}
                          placeholder="1" />
                      </FormField>
                      <FormField label="Budget / Seat (₹)">
                        <div className="relative">
                          <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <StyledInput type="number" value={seat.seatBudget}
                            onChange={e => handleUpdateSeat(seat.id, "seatBudget", e.target.value === "" ? "" : parseFloat(e.target.value))}
                            placeholder="0.00" className="pl-9 font-mono" />
                        </div>
                      </FormField>
                    </div>
                    {Number(seat.amount) > 0 && Number(seat.seatBudget) > 0 && (
                      <div className="text-xs font-mono rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-slate-600 flex justify-between items-center shadow-sm">
                        <span>Role Subtotal</span>
                        <span className="font-semibold text-slate-900">₹{((Number(seat.amount) || 0) * (Number(seat.seatBudget) || 0)).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={handleAddSeat}
                className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all border-2 border-dashed border-slate-200 text-slate-500 hover:border-[#00A4EF] hover:bg-[#F3FAFF] hover:text-[#00A4EF]">
                <Plus className="h-4 w-4" /> Add Another Role
              </button>

              {!seatBudgetValid && parsedBudget > 0 && totalSeatBudget > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                  <p className="text-xs font-medium text-amber-700 leading-relaxed">
                    Role budgets must total exactly ₹{parsedBudget.toLocaleString()}.<br/>
                    Currently allocated: <span className="font-bold">₹{totalSeatBudget.toLocaleString()}</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4 ── */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <BudgetBar total={totalMilestoneAmount} label="Milestone Payments Scheduled" valid={milestonesValid} />

              <div className="space-y-3">
                {milestones.map((ms, idx) => (
                  <div key={ms.id} className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/50 shadow-sm">
                    <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold bg-white text-[#00A4EF] border border-slate-200 shadow-sm">
                      {idx + 1}
                    </div>
                    <StyledInput
                      placeholder="Milestone title (e.g. Design Handoff)"
                      value={ms.title}
                      onChange={e => handleUpdateMilestone(ms.id, "title", e.target.value)}
                      className="flex-1 bg-white"
                    />
                    <div className="w-32 sm:w-40 shrink-0 relative">
                      <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <StyledInput type="number" value={ms.amount}
                        onChange={e => handleUpdateMilestone(ms.id, "amount", e.target.value === "" ? "" : parseFloat(e.target.value))}
                        placeholder="0.00" className="pl-9 font-mono bg-white" />
                    </div>
                    {milestones.length > 1 && (
                      <button onClick={() => handleRemoveMilestone(ms.id)} className="shrink-0 p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={handleAddMilestone}
                className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all border-2 border-dashed border-slate-200 text-slate-500 hover:border-[#00A4EF] hover:bg-[#F3FAFF] hover:text-[#00A4EF]">
                <Plus className="h-4 w-4" /> Add Milestone Stage
              </button>

              {!milestonesValid && parsedBudget > 0 && totalMilestoneAmount > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                  <p className="text-xs font-medium text-amber-700 leading-relaxed">
                    Milestone amounts must total exactly ₹{parsedBudget.toLocaleString()}.<br/>
                    Currently scheduled: <span className="font-bold">₹{totalMilestoneAmount.toLocaleString()}</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between gap-4">
            <div>
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(s => s - 1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              )}
            </div>

            <div>
              {currentStep < STEPS.length ? (
                <button
                  onClick={() => setCurrentStep(s => s + 1)}
                  disabled={!stepValid}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-[#00A4EF] hover:bg-[#0087d1] shadow-lg shadow-[#00A4EF]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!stepValid || isSubmitting}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-[#00A4EF] hover:bg-[#0087d1] shadow-lg shadow-[#00A4EF]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><span className="animate-spin">⏳</span> Deploying...</>
                  ) : (
                    <>Deploy Blueprint</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable styled sub-components ──

function FormField({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </label>
        {required && <span className="text-xs text-rose-500">*</span>}
        {hint && <span className="text-[10px] ml-auto text-slate-400 normal-case">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function StyledInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10 placeholder:text-slate-400 ${className}`}
    />
  );
}

function StyledTextarea({ className = "", rows = 3, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { rows?: number }) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={`w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10 resize-none placeholder:text-slate-400 leading-relaxed ${className}`}
    />
  );
}

function StyledSelect({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10 appearance-none cursor-pointer ${className}`}
    >
      {children}
    </select>
  );
}
