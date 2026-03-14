import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail, CheckCircle2, Loader2, Eye, EyeOff,
  User, AtSign, ArrowRight, ChevronLeft, RotateCcw, Briefcase
} from "lucide-react";
import TelegramLogin from "@/components/TelegramLogin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { validatePassword } from "@/lib/passwordValidation";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { toast } from "sonner";
import Logo from "@/components/Logo";

/* ── Font injection ── */
if (typeof document !== "undefined" && !document.getElementById("krovaa-reg-fonts")) {
  const l = document.createElement("link");
  l.id = "krovaa-reg-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap";
  document.head.appendChild(l);
}

type Step = "form" | "otp";

/* ── Minimal labelled input ── */
const Field = ({
  label, icon: Icon, error: _e, className = "", ...props
}: { label: string; icon: React.ElementType; error?: string;[k: string]: any }) => (
  <div className="group">
    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2 ml-0.5">
      {label}
    </label>
    <div className="relative">
      <Icon className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-blue-400 transition-colors duration-200" />
      <input
        className={`w-full bg-transparent border-0 border-b border-white/10 focus:border-blue-500/60 outline-none pl-6 pb-2.5 pt-1 text-sm text-white placeholder:text-white/15 transition-colors duration-200 ${className}`}
        {...props}
      />
    </div>
  </div>
);

const SelectField = ({
  label, icon: Icon, options, value, onChange, className = "", ...props
}: { label: string; icon: React.ElementType; options: string[]; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; className?: string;[k: string]: any }) => (
  <div className="group">
    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2 ml-0.5">
      {label}
    </label>
    <div className="relative">
      <Icon className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-blue-400 transition-colors duration-200" />
      <select
        className={`w-full bg-transparent border-0 border-b border-white/10 focus:border-blue-500/60 outline-none pl-6 pb-2.5 pt-1 text-sm text-white appearance-none cursor-pointer transition-colors duration-200 ${className}`}
        value={value}
        onChange={onChange}
        {...props}
      >
        <option value="" className="bg-[#0a0f1e] text-white/40">Select your {label.toLowerCase()}...</option>
        {options.map(p => (
          <option key={p} value={p} className="bg-[#0a0f1e] text-white">{p}</option>
        ))}
      </select>
    </div>
  </div>
);

/* ── Checkbox ── */
const Check = ({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onChange} className="flex items-start gap-3 text-left group">
    <div className={`w-4 h-4 mt-0.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-all duration-200 ${checked ? "bg-blue-600 border-blue-600" : "border-white/15 bg-transparent group-hover:border-white/30"}`}>
      {checked && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
    </div>
    <span className="text-[11px] text-white/30 leading-relaxed">{children}</span>
  </button>
);

const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading, user } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); document.title = "Join Krovaa"; }, []);
  useEffect(() => { if (user) navigate("/chat"); }, [user]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const chk = validatePassword(password);
    if (!chk.isValid) { setError(chk.message || "Stronger password required"); return; }
    setIsSendingOtp(true);
    try {
      await apiFetch("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ email, username }) });
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally { setIsSendingOtp(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(username.trim(), email.trim().toLowerCase(), password, displayName.trim(), otp);
      localStorage.setItem('show_welcome_banner', 'true');
      toast.success(`Welcome to Krovaa, ${displayName || username}!`);
      navigate("/chat", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const handleResendOtp = async () => {
    setError(""); setIsSendingOtp(true);
    try { await apiFetch("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ email }) }); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to resend"); }
    finally { setIsSendingOtp(false); }
  };

  return (
    <div
      style={{ fontFamily: "'Rubik', sans-serif" }}
      className="min-h-screen bg-[#050810] text-white flex overflow-hidden"
    >
      {/* ── LEFT PANEL — brand statement ── */}
      <div className="hidden lg:flex flex-col relative w-[42%] flex-shrink-0 overflow-hidden">

        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#070d1f] via-[#050810] to-[#020408]" />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />
        {/* Glow orbs */}
        <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] rounded-full bg-blue-700/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[400px] h-[400px] rounded-full bg-blue-900/20 blur-[100px]" />
        {/* Vertical accent line */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-blue-500/20 to-transparent" />

        {/* Decorative rotated text */}
        <div
          className="absolute bottom-32 -left-16 text-[200px] font-extrabold tracking-tighter select-none pointer-events-none opacity-[0.025]"
          style={{ fontFamily: "'Rubik', sans-serif", transform: "rotate(-90deg) translateX(20%)", transformOrigin: "left bottom", color: "#3b82f6", lineHeight: 1 }}
        >
          KROVAA
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-14">
          {/* Logo */}
          <Link to="/" className="flex items-center group w-fit">
            <Logo size="lg" className="scale-125 origin-left" />
          </Link>

          {/* Main statement */}
          <div className="mt-auto mb-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/25 bg-blue-500/8 text-[10px] font-bold text-blue-400 tracking-[0.2em] uppercase mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {step === "form" ? "Step 1 of 2" : "Step 2 of 2"}
            </div>

            <h2 style={{ fontFamily: "'Rubik', sans-serif" }} className="text-5xl font-extrabold leading-[1.05] tracking-tight mb-6">
              {step === "form" ? (
                <>Your work,<br /><span className="text-blue-400">your rules.</span></>
              ) : (
                <>Almost<br /><span className="text-blue-400">there.</span></>
              )}
            </h2>
            <p className="text-white/30 text-sm leading-relaxed max-w-xs font-light">
              {step === "form"
                ? "Set up your account and start closing deals in minutes. No friction, no nonsense."
                : "Enter the 6-digit code we sent to your inbox to complete your registration."}
            </p>
          </div>


        </div>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">

        {/* Subtle ambient */}
        <div className="fixed inset-0 pointer-events-none lg:left-[42%]">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-900/8 blur-[120px]" />
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-between px-8 pt-8 pb-4">
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>
          <div className="text-xs text-white/30">
            Step {step === "form" ? "1" : "2"} of 2
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12 relative z-10">
          <div className="w-full max-w-md">

            {/* ── FORM STEP ── */}
            {step === "form" && (
              <div
                key="form"
                style={{ animation: mounted ? "slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both" : "none" }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-10">
                  <div>
                    <h1 style={{ fontFamily: "'Rubik', sans-serif" }} className="text-3xl font-extrabold tracking-tight text-white mb-1.5">
                      Create account
                    </h1>
                    <p className="text-white/30 text-sm font-light">
                      Already a member?{" "}
                      <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        Sign in
                      </Link>
                    </p>
                  </div>
                  <div className="scale-90 origin-top-right -mt-1">
                    <TelegramLogin />
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] text-white/15 tracking-widest uppercase">or with email</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSendOtp} className="space-y-7">
                  <div className="grid grid-cols-2 gap-6">
                    <Field
                      label="Username"
                      icon={AtSign}
                      type="text"
                      placeholder="your_handle"
                      value={username}
                      onChange={(e: any) => setUsername(e.target.value)}
                      required
                    />
                    <Field
                      label="Display Name"
                      icon={User}
                      type="text"
                      placeholder="Full name"
                      value={displayName}
                      onChange={(e: any) => setDisplayName(e.target.value)}
                    />
                  </div>

                  <Field
                    label="Email Address"
                    icon={Mail}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e: any) => setEmail(e.target.value)}
                    required
                  />



                  <div>
                    <div className="group">
                      <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-2 ml-0.5">
                        Password
                      </label>
                      <div className="relative">
                        <svg viewBox="0 0 16 16" className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-blue-400 transition-colors fill-current">
                          <path d="M8 1a3 3 0 0 0-3 3v1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2V4a3 3 0 0 0-3-3zm0 1.5A1.5 1.5 0 0 1 9.5 4v1h-3V4A1.5 1.5 0 0 1 8 2.5z" />
                        </svg>
                        <input
                          type={showPassword ? "text" : "password"}
                          className="w-full bg-transparent border-0 border-b border-white/10 focus:border-blue-500/60 outline-none pl-6 pr-8 pb-2.5 pt-1 text-sm text-white placeholder:text-white/15 transition-colors duration-200"
                          placeholder="Min. 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(s => !s)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-white/15 hover:text-white/50 transition-colors pb-2"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <PasswordStrength password={password} />
                    </div>
                  </div>

                  {/* Agreements */}
                  <div className="space-y-3 pt-1">
                    <Check checked={agreeToTerms} onChange={() => setAgreeToTerms(s => !s)}>
                      I agree to the{" "}
                      <Link to="/terms" target="_blank" className="text-blue-400 hover:text-blue-300 transition-colors">
                        Terms of Service
                      </Link>
                    </Check>
                    <Check checked={agreeToPrivacy} onChange={() => setAgreeToPrivacy(s => !s)}>
                      I accept the{" "}
                      <Link to="/privacy" target="_blank" className="text-blue-400 hover:text-blue-300 transition-colors">
                        Privacy Policy
                      </Link>
                    </Check>
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingOtp || !agreeToTerms || !agreeToPrivacy}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-blue-900/30 hover:shadow-blue-700/40 flex items-center justify-center gap-2 mt-2"
                  >
                    {isSendingOtp ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending code...</>
                    ) : (
                      <>Continue <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ── OTP STEP ── */}
            {step === "otp" && (
              <div
                key="otp"
                style={{ animation: "slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
              >
                {/* Back */}
                <button
                  onClick={() => { setStep("form"); setOtp(""); setError(""); }}
                  className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 transition-colors mb-10 group"
                >
                  <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  Back
                </button>

                {/* Icon */}
                <div className="mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-6 relative">
                    <Mail className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 rounded-full text-[10px] font-bold flex items-center justify-center shadow-lg shadow-blue-900/50">
                      1
                    </span>
                  </div>
                  <h1 style={{ fontFamily: "'Rubik', sans-serif" }} className="text-3xl font-extrabold tracking-tight mb-2">
                    Check your inbox
                  </h1>
                  <p className="text-sm text-white/30 font-light leading-relaxed">
                    We sent a 6-digit code to{" "}
                    <span className="text-white/60 font-medium">{email}</span>
                  </p>
                </div>

                {error && (
                  <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-8">
                  {/* Big OTP input */}
                  <div>
                    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mb-4">
                      Verification Code
                    </label>
                    <input
                      className="w-full h-20 bg-white/[0.03] border border-white/8 hover:border-white/12 focus:border-blue-500/50 outline-none rounded-2xl text-center text-4xl font-bold tracking-[0.6em] text-white transition-colors duration-200 placeholder:text-white/10 placeholder:tracking-[0.3em]"
                      placeholder="······"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      autoFocus
                      required
                      style={{ fontFamily: "'Rubik', sans-serif" }}
                    />
                    {/* Progress dots */}
                    <div className="flex gap-2 justify-center mt-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                          style={{ background: i < otp.length ? "#3b82f6" : "rgba(255,255,255,0.08)" }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={otp.length !== 6 || isLoading}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-blue-900/30 hover:shadow-blue-700/40 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Verify & Join</>
                    )}
                  </button>

                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isSendingOtp}
                      className="text-xs text-white/25 hover:text-blue-400 transition-colors flex items-center gap-1.5 disabled:opacity-30"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {isSendingOtp ? "Sending..." : "Resend code"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-8 text-[10px] text-white/10 tracking-widest uppercase">
          © 2026 Krovaa &nbsp;·&nbsp; <a href="mailto:support@krovaa.com" className="hover:text-blue-400 transition-colors">support@krovaa.com</a>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Register;
