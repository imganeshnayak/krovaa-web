import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Briefcase, 
  MapPin, 
  Phone, 
  User as UserIcon, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  ChevronRight,
  Code,
  Palette,
  Hammer,
  GanttChart,
  UserCircle,
  HelpCircle,
  Hash
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "tech", label: "Tech", icon: Code, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
  { id: "creative", label: "Creative", icon: Palette, color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
  { id: "engineering", label: "Engineering", icon: Hammer, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
  { id: "professional", label: "Professional", icon: GanttChart, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  { id: "client", label: "I am a Client", icon: UserCircle, color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20" },
  { id: "other", label: "Other", icon: HelpCircle, color: "text-zinc-400", bg: "bg-zinc-400/10", border: "border-zinc-400/20" },
];

const SUB_PROFESSIONS: Record<string, string[]> = {
  tech: ["Software Developer", "Web Developer", "Data Scientist", "AI / ML Engineer", "Cybersecurity Analyst", "DevOps Engineer", "Mobile App Developer"],
  creative: ["UI/UX Designer", "Graphic Designer", "Content Creator", "Video Editor", "Photographer", "Videographer", "Artist / Illustrator", "Musician"],
  engineering: ["Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Architect", "Structural Engineer"],
  professional: ["Product Manager", "Digital Marketer", "Doctor", "Nurse", "Pharmacist", "Lawyer", "Chartered Accountant", "Teacher / Educator", "Consultant"],
};

export function ProfileCompletionModal() {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceClose, setForceClose] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    displayName: user?.displayName || "",
    phoneNumber: "",
    city: "",
    pincode: "",
    bio: "",
    category: "",
    profession: "",
    customProfession: "",
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, displayName: user.displayName || "" }));
    }
  }, [user]);

  // Only show if user is logged in and doesn't have a profession
  if (!user || user.profession || forceClose) return null;

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    let finalProfession = formData.profession;
    if (formData.category === "client") finalProfession = "Client";
    if (formData.category === "other") finalProfession = formData.customProfession || "Other";
    if (formData.profession === "Other") finalProfession = formData.customProfession || "Other";

    if (!finalProfession) {
      toast.error("Please select a profession");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUserProfile(user.id, {
        displayName: formData.displayName,
        phoneNumber: formData.phoneNumber,
        city: formData.city,
        pincode: formData.pincode,
        bio: formData.bio,
        profession: finalProfession,
      });
      
      toast.success("Profile completed! Welcome aboard.");
      setForceClose(true);
      // Wait a tiny bit then refresh to ensure context is updated
      setTimeout(() => refreshUser(), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 ml-1 flex items-center gap-1.5">
            <UserIcon className="w-3 h-3" /> Display Name
          </label>
          <Input 
            value={formData.displayName}
            onChange={e => setFormData({ ...formData, displayName: e.target.value })}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:ring-blue-500/50 h-11"
            placeholder="John Doe"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 ml-1 flex items-center gap-1.5">
            <Phone className="w-3 h-3" /> Phone Number
          </label>
          <Input 
            value={formData.phoneNumber}
            onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:ring-blue-500/50 h-11"
            placeholder="+91 98765 43210"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 ml-1 flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> City
          </label>
          <Input 
            value={formData.city}
            onChange={e => setFormData({ ...formData, city: e.target.value })}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:ring-blue-500/50 h-11"
            placeholder="Mumbai"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 ml-1 flex items-center gap-1.5">
            <Hash className="w-3 h-3" /> Pincode
          </label>
          <Input 
            value={formData.pincode}
            onChange={e => setFormData({ ...formData, pincode: e.target.value })}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:ring-blue-500/50 h-11"
            placeholder="400001"
          />
        </div>
      </div>
      <Button 
        onClick={handleNext} 
        disabled={!formData.displayName || !formData.phoneNumber || !formData.city}
        className="w-full h-11 bg-zinc-100 hover:bg-white text-zinc-950 font-bold mt-2"
      >
        Continue <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );

  const renderStep2 = () => {
    const isCategorySelected = formData.category !== "";
    const hasSubCategories = formData.category && SUB_PROFESSIONS[formData.category];

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="space-y-3">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 ml-1">
            Choose Category
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFormData({ ...formData, category: cat.id, profession: "", customProfession: "" })}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left",
                  formData.category === cat.id 
                    ? `${cat.bg} ${cat.border} ring-1 ring-offset-2 ring-offset-zinc-950 ring-${cat.id}-400/50` 
                    : "bg-zinc-900/30 border-zinc-800/50 hover:bg-zinc-900/60 hover:border-zinc-700"
                )}
              >
                <div className={cn("p-2 rounded-lg", cat.bg, cat.color)}>
                  <cat.icon className="w-4 h-4" />
                </div>
                <span className={cn("text-xs font-medium", formData.category === cat.id ? "text-white" : "text-zinc-400")}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {hasSubCategories && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 ml-1">
              Select Profession
            </label>
            <div className="flex flex-wrap gap-2">
              {SUB_PROFESSIONS[formData.category].map((prof) => (
                <button
                  key={prof}
                  type="button"
                  onClick={() => setFormData({ ...formData, profession: prof })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border",
                    formData.profession === prof
                      ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  )}
                >
                  {prof}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, profession: "Other" })}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border",
                  formData.profession === "Other"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                )}
              >
                Other...
              </button>
            </div>
          </div>
        )}

        {(formData.category === "other" || formData.profession === "Other") && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 ml-1">
              Specify Profession
            </label>
            <Input 
              value={formData.customProfession}
              onChange={e => setFormData({ ...formData, customProfession: e.target.value })}
              className="bg-zinc-900/50 border-zinc-800 text-zinc-200 h-11"
              placeholder="Type your skill..."
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <Button variant="ghost" onClick={handleBack} className="flex-1 h-11 text-zinc-400 hover:text-white hover:bg-zinc-900">
            <ArrowLeft className="mr-2 w-4 h-4" /> Back
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={!formData.category || (formData.category !== 'client' && formData.category !== 'other' && !formData.profession) || (formData.category === 'other' && !formData.customProfession) || (formData.profession === 'Other' && !formData.customProfession)}
            className="flex-[2] h-11 bg-zinc-100 hover:bg-white text-zinc-950 font-bold"
          >
            Continue <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 ml-1">
          Bio (Optional)
        </label>
        <Textarea 
          value={formData.bio}
          onChange={e => setFormData({ ...formData, bio: e.target.value })}
          className="bg-zinc-900/50 border-zinc-800 text-zinc-200 min-h-[120px] focus:ring-blue-500/50 resize-none placeholder:text-zinc-700"
          placeholder="I'm a passionate developer focusing on..."
        />
        <p className="text-[10px] text-zinc-600 mt-1">Tell people what makes you special.</p>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={handleBack} className="flex-1 h-11 text-zinc-400 hover:text-white hover:bg-zinc-900" disabled={isSubmitting}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button 
          onClick={handleSubmit} 
          className="flex-[2] h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-900/20"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Completing...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Finish Setup
            </div>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[480px] bg-zinc-950 border-zinc-900 text-white p-0 overflow-hidden shadow-2xl shadow-black/50" hideCloseButton>
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900 z-50">
          <div 
            className="h-full bg-blue-500 transition-all duration-500 ease-out" 
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-8">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mb-4 animate-bounce-slow">
              {step === 1 && <UserIcon className="w-6 h-6" />}
              {step === 2 && <Briefcase className="w-6 h-6" />}
              {step === 3 && <CheckCircle2 className="w-6 h-6" />}
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white tracking-tight">
                {step === 1 && "Personalize Presence"}
                {step === 2 && "What's your Skill?"}
                {step === 3 && "Almost there!"}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 mt-2 text-sm">
                {step === 1 && "Complete basic details to help users find you."}
                {step === 2 && "Categorise your core expertise to get better deals."}
                {step === 3 && "Add a short bio to complete your profile identity."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          <div className="mt-8 flex justify-center gap-1.5">
            {[1, 2, 3].map(s => (
              <div 
                key={s} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  step === s ? "w-6 bg-blue-500" : "bg-zinc-800"
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
