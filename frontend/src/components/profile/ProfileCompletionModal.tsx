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
  Hash,
  GraduationCap,
  Users,
  Target,
  Search,
  Handshake,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/lib/api";
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
  { id: "freelancer",  label: "Freelancer",   icon: Users,       color: "text-pink-400",   bg: "bg-pink-400/10",   border: "border-pink-400/20"   },
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

// ─── Inline Calendar Component ────────────────────────────────────────────────

interface InlineDatePickerProps {
  value: string;           // "YYYY-MM-DD" or ""
  onChange: (val: string) => void;
}

function InlineDatePicker({ value, onChange }: InlineDatePickerProps) {
  const today = new Date();

  const parseSelected = (): Date | null => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const selected = parseSelected();

  const initYear  = selected ? selected.getFullYear()  : today.getFullYear() - 22;
  const initMonth = selected ? selected.getMonth()      : today.getMonth();

  const [viewYear,  setViewYear]  = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);

  // Build year options: 1940 → today
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
    const iso = d.toISOString().split("T")[0];
    onChange(iso);
  };

  const calcAge = (d: Date) => {
    let age = today.getFullYear() - d.getFullYear();
    const md = today.getMonth() - d.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < d.getDate())) age--;
    return age >= 0 ? age : null;
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

  const isFuture = (day: number) =>
    new Date(viewYear, viewMonth, day) > today;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-4 space-y-3 shadow-sm">

      {/* ── Header: prev / month+year dropdowns / next ── */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={prevMonth}
          className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex gap-2 flex-1 justify-center">
          {/* Month selector */}
          <div className="relative">
            <select
              value={viewMonth}
              onChange={e => setViewMonth(Number(e.target.value))}
              aria-label="Select month"
              className="appearance-none bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-semibold px-3 pr-7 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all hover:border-slate-300"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i} className="bg-white">{m}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          </div>

          {/* Year selector */}
          <div className="relative">
            <select
              value={viewYear}
              onChange={e => setViewYear(Number(e.target.value))}
              aria-label="Select year"
              className="appearance-none bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-semibold px-3 pr-7 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all hover:border-slate-300 w-[72px]"
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-white">{y}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          </div>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          disabled={viewYear * 12 + viewMonth >= today.getFullYear() * 12 + today.getMonth()}
          className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all disabled:opacity-25 disabled:pointer-events-none"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Weekday labels ── */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold tracking-widest text-slate-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* ── Day grid ── */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((cell, idx) => {
          const muted   = cell.type !== "cur";
          const future  = !muted && isFuture(cell.day);
          const sel     = !muted && isSelected(cell.day);
          const todayMark = !muted && isToday(cell.day);

          return (
            <button
              key={idx}
              type="button"
              disabled={muted || future}
              onClick={() => !muted && !future && selectDay(cell.day)}
              className={cn(
                "relative mx-auto flex items-center justify-center w-8 h-8 rounded-xl text-[12px] font-medium transition-all duration-150",
                muted   && "text-slate-700 cursor-default",
                future  && "text-slate-700 cursor-default",
                !muted && !future && !sel && !todayMark &&
                  "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                todayMark && !sel &&
                  "text-blue-600 font-bold",
                sel &&
                  "bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/30",
              )}
            >
              {cell.day}
              {/* Today dot */}
              {todayMark && !sel && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Selected date display strip ── */}
      <div className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 border transition-all duration-300",
        selected
          ? "bg-blue-600/10 border-blue-500/30"
          : "bg-slate-50 border-slate-200"
      )}>
        <CalendarIcon className={cn("w-4 h-4 shrink-0", selected ? "text-blue-400" : "text-slate-500")} />
        <div className="flex-1 min-w-0">
          {selected ? (
            <p className="text-[13px] font-semibold text-slate-900 truncate">
              {formatDisplay(selected)}
            </p>
          ) : (
            <p className="text-[12px] text-slate-500">Select your date of birth</p>
          )}
        </div>
        {selected && (() => {
          const age = calcAge(selected);
          return age !== null ? (
            <span className="shrink-0 text-[11px] font-bold text-blue-400 bg-blue-500/15 border border-blue-500/20 rounded-lg px-2 py-0.5">
              {age} yrs
            </span>
          ) : null;
        })()}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function ProfileCompletionModal() {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceClose, setForceClose] = useState(false);

  const [formData, setFormData] = useState({
    displayName:      user?.displayName || "",
    phoneNumber:      "",
    city:             "",
    pincode:          "",
    bio:              "",
    category:         "",
    profession:       "",
    customProfession: "",
    gender:           "",
    dateOfBirth:      "",
    userGoal:         "",
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
      }));
    }
  }, [user]);

  const hasProfession = !!(user?.profession && user.profession.trim() !== "");
  if (!user || hasProfession || forceClose) return null;

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const md = today.getMonth() - birthDate.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 0 ? age : null;
  };

  const handleSubmit = async () => {
    let finalProfession = formData.profession;
    if (formData.category === "freelancer") finalProfession = "Freelancer";
    if (formData.category === "student")    finalProfession = "Student";
    if (formData.category === "client")     finalProfession = "Client";
    if (formData.category === "other")      finalProfession = formData.customProfession || "Other";
    if (formData.profession === "Other")    finalProfession = formData.customProfession || "Other";

    if (!finalProfession) { toast.error("Please select a profession"); return; }

    const age = formData.dateOfBirth ? calculateAge(formData.dateOfBirth) : null;
    if (formData.dateOfBirth && age === null) { toast.error("Please enter a valid date of birth."); return; }

    setIsSubmitting(true);
    try {
      await updateUserProfile(user.id, {
        displayName:  formData.displayName,
        phoneNumber:  formData.phoneNumber,
        city:         formData.city,
        pincode:      formData.pincode,
        bio:          formData.bio,
        profession:   formData.category === "none" ? "None" : finalProfession,
        gender:       formData.gender,
        age,
        userGoal:     formData.userGoal,
      });
      toast.success("Profile completed! Welcome aboard.");
      setForceClose(true);
      setTimeout(() => refreshUser(), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
      setIsSubmitting(false);
    }
  };

  // ── Step renderers ─────────────────────────────────────────────────────────

  const renderStepGoal = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-4">
        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">
          I want to...
        </label>
        <div className="grid grid-cols-1 gap-3">
          {/* Offer services */}
          <button
            type="button"
            onClick={() => setFormData({ ...formData, userGoal: "OFFER_SERVICE" })}
            className={cn(
              "flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 text-left group",
              formData.userGoal === "OFFER_SERVICE"
                ? "bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
            )}
          >
            <div className={cn(
              "p-3 rounded-xl transition-colors",
              formData.userGoal === "OFFER_SERVICE"
                ? "bg-blue-500 text-white"
                : "bg-slate-100 text-slate-600 group-hover:text-slate-900"
            )}>
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <p className={cn("text-sm font-bold", formData.userGoal === "OFFER_SERVICE" ? "text-slate-900" : "text-slate-700")}>
                Offer my services
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">I'm here to work and earn</p>
            </div>
            {formData.userGoal === "OFFER_SERVICE" && <CheckCircle2 className="w-4 h-4 text-blue-500 ml-auto" />}
          </button>

          {/* Hire professionals */}
          <button
            type="button"
            onClick={() => setFormData({ ...formData, userGoal: "HIRE_PROFESSIONALS" })}
            className={cn(
              "flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 text-left group",
              formData.userGoal === "HIRE_PROFESSIONALS"
                ? "bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/50"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
            )}
          >
            <div className={cn(
              "p-3 rounded-xl transition-colors",
              formData.userGoal === "HIRE_PROFESSIONALS"
                ? "bg-purple-500 text-white"
                : "bg-slate-100 text-slate-600 group-hover:text-slate-900"
            )}>
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className={cn("text-sm font-bold", formData.userGoal === "HIRE_PROFESSIONALS" ? "text-slate-900" : "text-slate-700")}>
                Hire professionals
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">I'm looking for talent for my projects</p>
            </div>
            {formData.userGoal === "HIRE_PROFESSIONALS" && <CheckCircle2 className="w-4 h-4 text-purple-500 ml-auto" />}
          </button>
        </div>
      </div>
      <Button
        onClick={handleNext}
        disabled={!formData.userGoal}
        className="w-full h-11 bg-brand-blue text-white hover:bg-brand-blue-dark font-bold mt-4"
      >
        Continue <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-1 gap-4">
        {/* Display name */}
        <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
          <UserIcon className="w-3 h-3" /> Display Name
        </label>
        <Input
          value={formData.displayName}
          onChange={e => setFormData({ ...formData, displayName: e.target.value })}
          className="bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/50 h-11"
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
            <Phone className="w-3 h-3" /> Phone Number
          </label>
          <Input
            value={formData.phoneNumber}
            onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
            className="bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/50 h-11"
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      {/* Gender */}
      <div className="space-y-1.5">
        <label htmlFor="gender" className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
          Gender
        </label>
        <div className="relative">
          <select
            id="gender"
            aria-label="Gender"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl outline-none px-3 py-2 text-sm text-slate-900 appearance-none focus:ring-2 focus:ring-blue-500/50"
            value={formData.gender}
            onChange={e => setFormData({ ...formData, gender: e.target.value })}
          >
            <option value="" disabled className="text-slate-400">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* ── Improved inline date picker ── */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1 flex items-center gap-1.5">
          <CalendarIcon className="w-3 h-3" /> Date of Birth
        </label>
        <InlineDatePicker
          value={formData.dateOfBirth}
          onChange={val => setFormData({ ...formData, dateOfBirth: val })}
        />
      </div>

      <Button
        onClick={handleNext}
        disabled={
          !formData.displayName ||
          !formData.phoneNumber ||
          !formData.gender ||
          !formData.dateOfBirth ||
          calculateAge(formData.dateOfBirth) === null
        }
        className="w-full h-11 bg-brand-blue text-white hover:bg-brand-blue-dark font-bold mt-2"
      >
        Continue <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );

  const renderStep2 = () => {
    const hasSubCategories = formData.category && SUB_PROFESSIONS[formData.category];

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Category grid */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">
            Choose Category
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFormData({ ...formData, category: cat.id, profession: "", customProfession: "" })}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left",
                  formData.category === cat.id
                    ? `${cat.bg} ${cat.border} ring-1 ring-offset-2 ring-offset-zinc-950`
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                )}
              >
                <div className={cn("p-2 rounded-lg", cat.bg, cat.color)}>
                  <cat.icon className="w-4 h-4" />
                </div>
                <span className={cn("text-xs font-medium", formData.category === cat.id ? "text-slate-900" : "text-slate-700")}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sub-profession pills */}
        {hasSubCategories && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">
              Select Profession
            </label>
            <div className="flex flex-wrap gap-2">
              {SUB_PROFESSIONS[formData.category].map(prof => (
                <button
                  key={prof}
                  type="button"
                  onClick={() => setFormData({ ...formData, profession: prof })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border",
                    formData.profession === prof
                      ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/10"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
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
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                )}
              >
                Other...
              </button>
            </div>
          </div>
        )}

        {/* Custom profession input */}
        {(formData.category === "other" || formData.profession === "Other") && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">
              Specify Profession
            </label>
            <Input
              value={formData.customProfession}
              onChange={e => setFormData({ ...formData, customProfession: e.target.value })}
              className="bg-slate-50 border-slate-200 text-slate-900 h-11"
              placeholder="Type your skill..."
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <Button variant="ghost" onClick={handleBack} className="flex-1 h-11 text-slate-600 hover:text-slate-900 hover:bg-slate-100">
            <ArrowLeft className="mr-2 w-4 h-4" /> Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={
              !formData.category ||
              (
                formData.category !== "none" &&
                formData.category !== "freelancer" &&
                formData.category !== "student" &&
                formData.category !== "other" &&
                !formData.profession
              ) ||
              (formData.category === "other" && !formData.customProfession) ||
              (formData.profession === "Other" && !formData.customProfession)
            }
            className="flex-[2] h-11 bg-brand-blue text-white hover:bg-brand-blue-dark font-bold"
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
        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 ml-1">
          Bio (Optional)
        </label>
        <Textarea
          value={formData.bio}
          onChange={e => setFormData({ ...formData, bio: e.target.value })}
          className="bg-slate-50 border-slate-200 text-slate-900 min-h-[120px] focus:ring-blue-500/50 resize-none placeholder:text-slate-400"
          placeholder="I'm a passionate developer focusing on..."
        />
        <p className="text-[10px] text-slate-500 mt-1">Tell people what makes you special.</p>
      </div>

      <div className="flex gap-3 mt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="flex-1 h-11 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          disabled={isSubmitting}
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button
          onClick={handleSubmit}
          className="flex-[2] h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-900/20"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

  // ── Step icon & copy map ───────────────────────────────────────────────────
  const stepMeta = [
    { icon: <Handshake className="w-6 h-6" />, title: "Start Your Journey",     desc: "What brings you to Krovaa today?"            },
    { icon: <UserIcon   className="w-6 h-6" />, title: "Personalize Presence",   desc: "Help us get to know you better."             },
    { icon: <Briefcase  className="w-6 h-6" />, title: "Professional Identity",  desc: "Tell us about your skills and expertise."    },
    { icon: <CheckCircle2 className="w-6 h-6"/>, title: "Final Touches",         desc: "A little bit about yourself goes a long way." },
  ];

  const meta = stepMeta[step - 1];

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[520px] w-[calc(100%-32px)] max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border/50 text-foreground p-0 shadow-2xl shadow-black/10 rounded-3xl z-[100]"
        hideCloseButton
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-200 z-50">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 mb-4">
              {meta.icon}
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900 tracking-tight">
                {meta.title}
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-sm mt-1">
                {meta.desc}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Step content */}
          <div className="mt-2">
            {step === 1 && renderStepGoal()}
            {step === 2 && renderStep1()}
            {step === 3 && renderStep2()}
            {step === 4 && renderStep3()}
          </div>

          {/* Step dots */}
          <div className="mt-8 flex justify-center gap-1.5">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  step === s ? "w-6 bg-blue-500" : "w-1.5 bg-slate-300"
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}