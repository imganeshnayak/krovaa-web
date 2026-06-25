import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Briefcase,
  Phone,
  User as UserIcon,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Code,
  Palette,
  Hammer,
  GanttChart,
  UserCircle,
  HelpCircle,
  GraduationCap,
  Users,
  Target,
  Handshake,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Store,
  AtSign,
  MapPin,
  Landmark
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const CATEGORIES = [
  { id: "tech",         label: "Tech",         icon: Code,        color: "text-blue-400",   bg: "bg-blue-400/10",   border: "border-blue-400/20"   },
  { id: "creative",    label: "Creative",     icon: Palette,     color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
  { id: "engineering", label: "Engineering",  icon: Hammer,      color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
  { id: "professional",label: "Professional", icon: GanttChart,  color: "text-emerald-400",bg: "bg-emerald-400/10",border: "border-emerald-400/20" },
  { id: "freelancer",  label: "Freelancer",   icon: Users,        color: "text-pink-400",   bg: "bg-pink-400/10",   border: "border-pink-400/20"   },
  { id: "student",     label: "Student",      icon: GraduationCap,color:"text-cyan-400",   bg: "bg-cyan-400/10",   border: "border-cyan-400/20"   },
  { id: "none",        label: "None",         icon: UserCircle,  color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20" },
  { id: "other",       label: "Other",        icon: HelpCircle,  color: "text-slate-400",   bg: "bg-slate-400/10",   border: "border-slate-400/20"   },
];

const SUB_PROFESSIONS: Record<string, string[]> = {
  tech:         ["Software Developer","Web Developer","Data Scientist","AI / ML Engineer","Cybersecurity Analyst","DevOps Engineer","Mobile App Developer"],
  creative:     ["UI/UX Designer","Graphic Designer","3D Designer","2D Designer","Content Creator","Video Editor","Photographer","Videographer","Artist / Illustrator","Musician"],
  engineering:  ["Civil Engineer","Mechanical Engineer","Electrical Engineer","Architect","Structural Engineer"],
  professional: ["Product Manager","Digital Marketer","Doctor","Nurse","Pharmacist","Lawyer","Chartered Accountant","Teacher / Educator","Consultant"],
};

const calculateAge = (dob: string) => {
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const md = today.getMonth() - birthDate.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : null;
};

// ─── Inline Calendar Component ────────────────────────────────────────────────

interface InlineDatePickerProps {
  value: string;
  onChange: (val: string) => void;
}

function InlineDatePicker({ value, onChange }: InlineDatePickerProps) {
  const today = new Date();

  const parseSelected = (): Date | null => {
    if (!value) return null;
    const parts = value.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  };

  const selected = parseSelected();

  const initYear  = selected ? selected.getFullYear()  : today.getFullYear() - 22;
  const initMonth = selected ? selected.getMonth()      : today.getMonth();

  const [viewYear,  setViewYear]  = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);

  const years: number[] = [];
  for (let y = 1940; y <= today.getFullYear(); y++) years.push(y);

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth     = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev      = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; type: "prev" | "cur" | "next" }[] = [];
  for (let i = 0; i < firstDayOfMonth; i++)
    cells.push({ day: daysInPrev - firstDayOfMonth + 1 + i, type: "prev" });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, type: "cur" });
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7)
    for (let i = 1; i <= remaining; i++) cells.push({ day: i, type: "next" });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    const limit = today.getFullYear() * 12 + today.getMonth();
    const cur   = viewYear * 12 + viewMonth;
    if (cur >= limit) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (d > today) return;
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    onChange(`${yyyy}-${mm}-${dd}`);
  };

  const formatDisplay = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const isSelected = (day: number) =>
    selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth()    === viewMonth &&
    selected.getDate()     === day;

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth()    === viewMonth &&
    today.getDate()     === day;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={prevMonth}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex gap-1.5 flex-1 justify-center">
          <div className="relative">
            <select
              value={viewMonth}
              onChange={e => setViewMonth(Number(e.target.value))}
              aria-label="Select month"
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-[11px] font-semibold px-2 pr-6 py-1 cursor-pointer focus:outline-none transition-all hover:border-slate-300"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i} className="bg-white">{m}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          </div>

          <div className="relative">
            <select
              value={viewYear}
              onChange={e => setViewYear(Number(e.target.value))}
              aria-label="Select year"
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-[11px] font-semibold px-2 pr-6 py-1 cursor-pointer focus:outline-none transition-all hover:border-slate-300 w-[64px]"
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-white">{y}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          </div>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          disabled={viewYear * 12 + viewMonth >= today.getFullYear() * 12 + today.getMonth()}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all disabled:opacity-25 disabled:pointer-events-none"
          aria-label="Next month"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-bold tracking-wider text-slate-500 py-0.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((cell, idx) => {
          const muted   = cell.type !== "cur";
          const future  = !muted && (new Date(viewYear, viewMonth, cell.day) > today);
          const sel     = !muted && isSelected(cell.day);
          const todayMark = !muted && isToday(cell.day);

          return (
            <button
              key={idx}
              type="button"
              disabled={muted || future}
              onClick={() => !muted && !future && selectDay(cell.day)}
              className={cn(
                "relative mx-auto flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-medium transition-all duration-150",
                (muted || future) && "text-slate-300 cursor-default",
                !muted && !future && !sel && !todayMark && "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                todayMark && !sel && "text-blue-600 font-bold",
                sel && "bg-blue-600 text-white font-bold shadow-md shadow-blue-900/10 ring-2 ring-blue-500/20",
              )}
            >
              {cell.day}
              {todayMark && !sel && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 border transition-all duration-300", selected ? "bg-blue-600/5 border-blue-500/20" : "bg-slate-50 border-slate-200")}>
        <CalendarIcon className={cn("w-3.5 h-3.5 shrink-0", selected ? "text-blue-500" : "text-slate-400")} />
        <div className="flex-1 min-w-0">
          {selected ? (
            <p className="text-xs font-semibold text-slate-900 truncate">{formatDisplay(selected)}</p>
          ) : (
            <p className="text-[11px] text-slate-400">Select your date of birth</p>
          )}
        </div>
        {selected && (() => {
          const age = calculateAge(value);
          return age !== null ? (
            <span className="shrink-0 text-[10px] font-bold text-blue-600 bg-blue-500/10 border border-blue-500/10 rounded-md px-1.5 py-0.5">{age} yrs</span>
          ) : null;
        })()}
      </div>
    </div>
  );
}

// ─── Extracted Sub-Step Form Components ───────────────────────────────────────────

interface StepProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

const StepGoal = ({ formData, setFormData }: StepProps) => (
  <div className="space-y-4">
    <div className="space-y-3">
      <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">I want to...</label>
      <div className="grid grid-cols-1 gap-2.5">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, userGoal: "OFFER_SERVICE" })}
          className={cn("flex items-center gap-3.5 p-4 rounded-xl border transition-all duration-300 text-left group", formData.userGoal === "OFFER_SERVICE" ? "bg-blue-500/5 border-blue-500/40 ring-1 ring-blue-500/40" : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300")}
        >
          <div className={cn("p-2.5 rounded-lg transition-colors", formData.userGoal === "OFFER_SERVICE" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 group-hover:text-slate-900")}>
            <Handshake className="w-4 h-4" />
          </div>
          <div>
            <p className={cn("text-xs font-bold", formData.userGoal === "OFFER_SERVICE" ? "text-slate-900" : "text-slate-700")}>Offer my services</p>
            <p className="text-[10px] text-slate-500 mt-0.5">I'm here to work and earn</p>
          </div>
          {formData.userGoal === "OFFER_SERVICE" && <CheckCircle2 className="w-4 h-4 text-blue-600 ml-auto" />}
        </button>

        <button
          type="button"
          onClick={() => setFormData({ ...formData, userGoal: "HIRE_PROFESSIONALS" })}
          className={cn("flex items-center gap-3.5 p-4 rounded-xl border transition-all duration-300 text-left group", formData.userGoal === "HIRE_PROFESSIONALS" ? "bg-purple-500/5 border-purple-500/40 ring-1 ring-purple-500/40" : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300")}
        >
          <div className={cn("p-2.5 rounded-lg transition-colors", formData.userGoal === "HIRE_PROFESSIONALS" ? "bg-purple-500 text-white" : "bg-slate-100 text-slate-600 group-hover:text-slate-900")}>
            <Target className="w-4 h-4" />
          </div>
          <div>
            <p className={cn("text-xs font-bold", formData.userGoal === "HIRE_PROFESSIONALS" ? "text-slate-900" : "text-slate-700")}>Hire professionals</p>
            <p className="text-[10px] text-slate-500 mt-0.5">I'm looking for talent for my projects</p>
          </div>
          {formData.userGoal === "HIRE_PROFESSIONALS" && <CheckCircle2 className="w-4 h-4 text-purple-500 ml-auto" />}
        </button>

        <button
          type="button"
          onClick={() => setFormData({ ...formData, userGoal: "RUN_BUSINESS" })}
          className={cn("flex items-center gap-3.5 p-4 rounded-xl border transition-all duration-300 text-left group", formData.userGoal === "RUN_BUSINESS" ? "bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/40" : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300")}
        >
          <div className={cn("p-2.5 rounded-lg transition-colors", formData.userGoal === "RUN_BUSINESS" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 group-hover:text-slate-900")}>
            <Store className="w-4 h-4" />
          </div>
          <div>
            <p className={cn("text-xs font-bold", formData.userGoal === "RUN_BUSINESS" ? "text-slate-900" : "text-slate-700")}>My Business</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Sell the products</p>
          </div>
          {formData.userGoal === "RUN_BUSINESS" && <CheckCircle2 className="w-4 h-4 text-amber-500 ml-auto" />}
        </button>
      </div>
    </div>
  </div>
);

const StepBusiness = ({ formData, setFormData }: StepProps) => (
  <div className="space-y-4">
    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
      <p className="text-[10px] font-semibold text-amber-600">🏷️ Business Account</p>
      <p className="text-[10px] mt-0.5 text-amber-600/80">Add your business details to set up your marketplace profile.</p>
    </div>
    <div className="space-y-1">
      <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
        <AtSign className="w-3 h-3" /> Business Name *
      </label>
      <Input value={formData.businessName || ""} onChange={e => setFormData({ ...formData, businessName: e.target.value })} className="bg-slate-50 border-slate-200 text-slate-900 h-10 rounded-xl text-xs focus-visible:ring-amber-500/50" placeholder="e.g. Acme Studios" />
    </div>
    <div className="space-y-1">
      <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
        <Store className="w-3 h-3" /> Business Type
      </label>
      <div className="relative">
        <select
          className="w-full bg-slate-50 border border-slate-200 rounded-xl outline-none px-3 h-10 text-xs text-slate-900 appearance-none focus:ring-2 focus:ring-amber-500/50 transition-all"
          value={formData.businessType || ""}
          onChange={e => setFormData({ ...formData, businessType: e.target.value })}
        >
          <option value="" disabled>Select business type...</option>
          <option value="Agency">Agency</option>
          <option value="Startup">Startup</option>
          <option value="Enterprise">Enterprise</option>
          <option value="Freelance Studio">Freelance Studio</option>
          <option value="E-commerce">E-commerce</option>
          <option value="Other">Other</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      </div>
    </div>
  </div>
);

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand",
  "Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
  "Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const StepBusinessAddress = ({ formData, setFormData }: StepProps) => (
  <div className="space-y-4">
    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
      <p className="text-[10px] font-semibold text-amber-600">📍 Pickup Address</p>
      <p className="text-[10px] mt-0.5 text-amber-600/80">Add the address where buyers can pick up orders from your business.</p>
    </div>
    <div className="space-y-1">
      <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
        <MapPin className="w-3 h-3" /> Street Address *
      </label>
      <Input
        value={formData.businessAddress || ""}
        onChange={e => setFormData({ ...formData, businessAddress: e.target.value })}
        className="bg-slate-50 border-slate-200 text-slate-900 h-10 rounded-xl text-xs focus-visible:ring-amber-500/50"
        placeholder="e.g. 123 Main Street, Shop No. 4B"
      />
    </div>
    <div className="space-y-1">
      <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
        <Landmark className="w-3 h-3" /> Landmark (Optional)
      </label>
      <Input
        value={formData.businessLandmark || ""}
        onChange={e => setFormData({ ...formData, businessLandmark: e.target.value })}
        className="bg-slate-50 border-slate-200 text-slate-900 h-10 rounded-xl text-xs focus-visible:ring-amber-500/50"
        placeholder="e.g. Near City Mall, Opposite Bank"
      />
    </div>
    <div className="space-y-1">
      <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
        <MapPin className="w-3 h-3" /> City *
      </label>
      <Input
        value={formData.businessCity || ""}
        onChange={e => setFormData({ ...formData, businessCity: e.target.value })}
        className="bg-slate-50 border-slate-200 text-slate-900 h-10 rounded-xl text-xs focus-visible:ring-amber-500/50"
        placeholder="e.g. Mumbai"
      />
    </div>
    <div className="space-y-1">
      <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
        <MapPin className="w-3 h-3" /> State *
      </label>
      <div className="relative">
        <select
          className="w-full bg-slate-50 border border-slate-200 rounded-xl outline-none px-3 h-10 text-xs text-slate-900 appearance-none focus:ring-2 focus:ring-amber-500/50 transition-all"
          value={formData.businessState || ""}
          onChange={e => setFormData({ ...formData, businessState: e.target.value })}
        >
          <option value="" disabled>Select state...</option>
          {INDIAN_STATES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      </div>
    </div>
    <div className="space-y-1">
      <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
        <MapPin className="w-3 h-3" /> Pincode *
      </label>
      <Input
        type="text"
        inputMode="numeric"
        value={formData.businessPincode || ""}
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, "");
          if (raw.length <= 6) setFormData({ ...formData, businessPincode: raw });
        }}
        className="bg-slate-50 border-slate-200 text-slate-900 h-10 rounded-xl text-xs focus-visible:ring-amber-500/50"
        placeholder="6-digit pincode"
        maxLength={6}
      />
    </div>
  </div>
);

const StepPersonalInfo = ({ formData, setFormData }: StepProps) => {
  const handlePhoneInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = event.target.value.replace(/\D/g, "");
    if (rawVal.length <= 10) {
      setFormData({ ...formData, phoneNumber: rawVal });
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="space-y-1">
        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
          <UserIcon className="w-3 h-3" /> Display Name
        </label>
        <Input value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} className="bg-slate-50 border-slate-200 text-slate-900 h-10 rounded-xl text-xs focus-visible:ring-blue-500/50" />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
          <Phone className="w-3 h-3" /> Phone Number (India)
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3 text-xs font-semibold text-slate-400 select-none pointer-events-none">+91</span>
          <Input 
            type="text"
            inputMode="numeric"
            value={formData.phoneNumber} 
            onChange={handlePhoneInput} 
            className="bg-slate-50 border-slate-200 text-slate-900 h-10 rounded-xl pl-11 text-xs focus-visible:ring-blue-500/50" 
            placeholder="98765 43210" 
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="gender" className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">Gender</label>
        <div className="relative">
          <select
            id="gender"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl outline-none px-3 h-10 text-xs text-slate-900 appearance-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            value={formData.gender}
            onChange={e => setFormData({ ...formData, gender: e.target.value })}
          >
            <option value="" disabled>Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
          <CalendarIcon className="w-3 h-3" /> Date of Birth
        </label>
        <InlineDatePicker value={formData.dateOfBirth} onChange={val => setFormData({ ...formData, dateOfBirth: val })} />
      </div>
    </div>
  );
};

const StepProfession = ({ formData, setFormData }: StepProps) => {
  const hasSubCategories = formData.category && SUB_PROFESSIONS[formData.category];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">Choose Category</label>
        <div className="grid grid-cols-2 gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFormData({ ...formData, category: cat.id, profession: "", customProfession: "" })}
              className={cn("flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-200 text-left", formData.category === cat.id ? `${cat.bg} ${cat.border} ring-2 ring-blue-500/10` : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300")}
            >
              <div className={cn("p-1.5 rounded-lg shrink-0", cat.bg, cat.color)}>
                <cat.icon className="w-3.5 h-3.5" />
              </div>
              <span className={cn("text-[11px] font-semibold truncate", formData.category === cat.id ? "text-slate-900" : "text-slate-700")}>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {hasSubCategories && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">Select Profession</label>
          <div className="flex flex-wrap gap-1.5">
            {SUB_PROFESSIONS[formData.category].map(prof => (
              <button
                key={prof}
                type="button"
                onClick={() => setFormData({ ...formData, profession: prof })}
                className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border", formData.profession === prof ? "bg-blue-600 border-blue-500 text-white shadow-sm" : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300")}
              >
                {prof}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, profession: "Other" })}
              className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border", formData.profession === "Other" ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300")}
            >
              Other...
            </button>
          </div>
        </div>
      )}

      {(formData.category === "other" || formData.profession === "Other") && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">Specify Profession</label>
          <Input value={formData.customProfession} onChange={e => setFormData({ ...formData, customProfession: e.target.value })} className="bg-slate-50 border-slate-200 text-slate-900 h-10 rounded-xl text-xs" placeholder="Type your skill..." />
        </div>
      )}
    </div>
  );
};

const StepBio = ({ formData, setFormData }: StepProps) => (
  <div className="space-y-4">
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">Bio (Optional)</label>
      <Textarea value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} className="bg-slate-50 border-slate-200 text-slate-900 min-h-[100px] max-h-[140px] resize-none placeholder:text-slate-400 rounded-xl p-3 text-xs leading-relaxed focus-visible:ring-blue-500/50" placeholder="I'm a passionate developer focusing on..." />
      <p className="text-[10px] text-slate-400 mt-1">Tell people what makes your journey unique.</p>
    </div>
  </div>
);

// ─── Main Orchestrator Modal ───────────────────────────────────────────────────

export function ProfileCompletionModal() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceClose, setForceClose] = useState(false);

  const [formData, setFormData] = useState({
    displayName: user?.displayName || "",
    phoneNumber: "",
    city: "",
    pincode: "",
    bio: "",
    category: "",
    profession: "",
    customProfession: "",
    gender: "",
    dateOfBirth: "",
    userGoal: "",
    businessName: "",
    businessType: "",
    businessAddress: "",
    businessCity: "",
    businessState: "",
    businessPincode: "",
    businessLandmark: "",
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        displayName:  user.displayName  || "",
        phoneNumber:  user.phoneNumber  || "",
        city:         user.city         || "",
        pincode:      user.pincode      || "",
        gender:       user.gender       || "",
        dateOfBirth:  "",
        userGoal:     user.userGoal     || "",
        bio:          user.bio          || "",
        businessName: user.businessName || "",
        businessType: user.businessType || "",
        businessAddress:  user.businessAddress  || "",
        businessCity:     user.businessCity     || "",
        businessState:    user.businessState    || "",
        businessPincode:  user.businessPincode  || "",
        businessLandmark: user.businessLandmark || "",
      }));
    }
  }, [user]);

  const isBusiness = formData.userGoal === "RUN_BUSINESS";
  const totalSteps = isBusiness ? 5 : 4;

  useEffect(() => {
    if (step > totalSteps) setStep(totalSteps);
  }, [totalSteps, step]);

  const hasProfession = !!(user?.profession && user.profession.trim() !== "");
  if (!user || hasProfession || forceClose) return null;

  const handleNext = () => setStep(s => Math.min(s + 1, totalSteps));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const isIndianPhoneValid = /^[6-9]\d{9}$/.test(formData.phoneNumber);

  const isStepDisabled = () => {
    if (step === 1) return !formData.userGoal;
    if (step === 2) {
      return !formData.displayName || !isIndianPhoneValid || !formData.gender || !formData.dateOfBirth || calculateAge(formData.dateOfBirth) === null;
    }
    if (step === 3) {
      if (formData.userGoal === "RUN_BUSINESS") {
        return !formData.businessName || !formData.businessName.trim() || !formData.businessType;
      }
      return !formData.category || (formData.category !== "none" && formData.category !== "freelancer" && formData.category !== "student" && formData.category !== "other" && !formData.profession) || (formData.category === "other" && !formData.customProfession) || (formData.profession === "Other" && !formData.customProfession);
    }
    if (step === 4 && isBusiness) {
      return !formData.businessAddress?.trim() || !formData.businessCity?.trim() || !formData.businessState || !formData.businessPincode || !/^\d{6}$/.test(formData.businessPincode);
    }
    return false;
  };

  const handleSubmit = async () => {
    let finalProfession = formData.profession;
    if (formData.category === "freelancer") finalProfession = "Freelancer";
    if (formData.category === "student")    finalProfession = "Student";
    if (formData.category === "client")     finalProfession = "Client";
    if (formData.category === "other" || formData.profession === "Other") finalProfession = formData.customProfession || "Other";

    if (!finalProfession && formData.category !== "none" && formData.userGoal !== "RUN_BUSINESS") { 
      toast.error("Please specify your profession profile entry."); 
      return; 
    }

    const age = formData.dateOfBirth ? calculateAge(formData.dateOfBirth) : null;
    if (formData.dateOfBirth && age === null) { 
      toast.error("Please enter a valid date of birth."); 
      return; 
    }

    if (formData.userGoal === "RUN_BUSINESS") {
      finalProfession = "Business Owner";
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await updateUserProfile(user.id, {
        displayName:  formData.displayName,
        phoneNumber:  formData.phoneNumber.startsWith("+91") ? formData.phoneNumber : `+91${formData.phoneNumber}`,
        city:         formData.city,
        pincode:      formData.pincode,
        bio:          formData.bio,
        profession:   formData.category === "none" ? "None" : finalProfession,
        gender:       formData.gender,
        age,
        userGoal:     formData.userGoal,
        accountType:  formData.userGoal === "RUN_BUSINESS" ? "business" : "individual",
        businessName: formData.userGoal === "RUN_BUSINESS" ? formData.businessName.trim() : undefined,
        businessType: formData.userGoal === "RUN_BUSINESS" ? formData.businessType : undefined,
        businessAddress:  formData.userGoal === "RUN_BUSINESS" ? formData.businessAddress.trim() : undefined,
        businessCity:     formData.userGoal === "RUN_BUSINESS" ? formData.businessCity.trim() : undefined,
        businessState:    formData.userGoal === "RUN_BUSINESS" ? formData.businessState : undefined,
        businessPincode:  formData.userGoal === "RUN_BUSINESS" ? formData.businessPincode : undefined,
        businessLandmark: formData.userGoal === "RUN_BUSINESS" ? formData.businessLandmark.trim() || undefined : undefined,
      });

      queryClient.setQueryData(['profile', user.id], (existing: any) => {
        if (!existing) return existing;
        return {
          ...existing,
          user: {
            ...existing.user,
            ...updatedUser,
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });

      toast.success("Profile completed configuration sequence!");
      setForceClose(true);
      setTimeout(() => refreshUser(), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update framework profiles.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepMeta = [
    { icon: <Handshake className="w-4 h-4" />,     title: "Start Your Journey",   desc: "What brings you to Krovaa today?" },
    { icon: <UserIcon className="w-4 h-4" />,      title: "Personal Presence",    desc: "Help us get to know you better." },
    isBusiness
      ? { icon: <Store className="w-4 h-4" />,       title: "Business Details",     desc: "Tell us about your business." }
      : { icon: <Briefcase className="w-4 h-4" />,   title: "Identity Alignment",   desc: "Tell us about your skills and expertise." },
    ...(isBusiness
      ? [{ icon: <MapPin className="w-4 h-4" />,     title: "Pickup Address",       desc: "Where can buyers pick up orders?" }]
      : []),
    { icon: <CheckCircle2 className="w-4 h-4" />,  title: "Final Details",        desc: "A small blueprint overview goes a long way." },
  ];

  const meta = stepMeta[step - 1];

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[460px] w-[calc(100%-24px)] max-h-[88vh] flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl border border-slate-200 p-0 shadow-2xl rounded-2xl z-[100]" 
        hideCloseButton
      >
        {/* Top Fixed Progress Bar */}
        <div className="w-full h-1 bg-slate-100 shrink-0">
          <div className="h-full bg-blue-600 transition-all duration-300 ease-out" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>

        {/* Top Fixed Header Context */}
        <div className="p-5 pb-3 border-b border-slate-100 flex flex-col items-center text-center shrink-0">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 mb-2 shadow-sm">
            {meta.icon}
          </div>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 tracking-tight text-center">{meta.title}</DialogTitle>
            <DialogDescription className="text-slate-500 text-[11px] mt-0.5 text-center">{meta.desc}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 structural-scrolling">
          {step === 1 && <StepGoal formData={formData} setFormData={setFormData} />}
          {step === 2 && <StepPersonalInfo formData={formData} setFormData={setFormData} />}
          {step === 3 && (isBusiness ? <StepBusiness formData={formData} setFormData={setFormData} /> : <StepProfession formData={formData} setFormData={setFormData} />)}
          {step === 4 && isBusiness && <StepBusinessAddress formData={formData} setFormData={setFormData} />}
          {step === totalSteps && <StepBio formData={formData} setFormData={setFormData} />}
        </div>

        {/* Bottom Fixed Navigation Actions Area */}
        <div className="p-4 border-t border-slate-100 bg-white/50 backdrop-blur-sm shrink-0 flex flex-col gap-3">
          <div className="flex gap-2 w-full">
            {step > 1 && (
              <Button 
                variant="ghost" 
                onClick={handleBack} 
                className="flex-1 h-10 text-slate-600 hover:bg-slate-100 rounded-xl text-xs" 
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-1.5 w-3.5 h-3.5" /> Back
              </Button>
            )}
            
            {step < totalSteps ? (
              <Button
                onClick={handleNext}
                disabled={isStepDisabled()}
                className="flex-[2] h-10 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-xl text-xs"
              >
                Continue <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                className="flex-[2] h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all rounded-xl text-xs" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Completing...
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Finish Setup
                  </div>
                )}
              </Button>
            )}
          </div>

          {/* Stepper Dots Indicators */}
          <div className="flex justify-center gap-1">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
              <div key={s} className={cn("h-1 rounded-full transition-all duration-300", step === s ? "w-4 bg-blue-600" : "w-1 bg-slate-200")} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}