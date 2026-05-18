import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { themeColors } from "@/lib/themeColors";
import {
  Mail, CheckCircle2, Loader2, Eye, EyeOff,
  User, AtSign, ArrowRight, ChevronLeft, RotateCcw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { validatePassword } from "@/lib/passwordValidation";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { toast } from "sonner";
import Logo from "@/components/Logo";

type Step = "form" | "otp";

/* ── Minimal labelled input ── */
const Field = ({
  label, icon: Icon, error: _e, className = "", ...props
}: { label: string; icon: React.ElementType; error?: string; [k: string]: any }) => (
  <div className="group">
    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase mb-2 ml-0.5" style={{ color: "#1C1C1C60" }}>
      {label}
    </label>
    <div className="relative">
      <Icon className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors duration-200" style={{ color: "#1C1C1C30" }} />
      <input
        className={`w-full bg-transparent border-0 outline-none pl-6 pb-2.5 pt-1 text-sm text-[#1C1C1C] placeholder:text-[#1C1C1C40] transition-colors duration-200 ${className}`}
        style={{ borderBottom: "1px solid #E0E0E0" }}
        onFocus={e => (e.currentTarget.style.borderBottomColor = "#00A4EF")}
        onBlur={e  => (e.currentTarget.style.borderBottomColor = "#E0E0E0")}
        {...props}
      />
    </div>
  </div>
);

const SelectField = ({
  label, icon: Icon, options, value, onChange, className = "", ...props
}: { label: string; icon: React.ElementType; options: string[]; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; className?: string; [k: string]: any }) => (
  <div className="group">
    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase mb-2 ml-0.5" style={{ color: "#1C1C1C60" }}>
      {label}
    </label>
    <div className="relative">
      <Icon className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors duration-200" style={{ color: "#1C1C1C30" }} />
      <select
        className={`w-full bg-transparent border-0 outline-none pl-6 pb-2.5 pt-1 text-sm text-[#1C1C1C] appearance-none cursor-pointer transition-colors duration-200 ${className}`}
        style={{ borderBottom: "1px solid #E0E0E0" }}
        onFocus={e => (e.currentTarget.style.borderBottomColor = "#00A4EF")}
        onBlur={e  => (e.currentTarget.style.borderBottomColor = "#E0E0E0")}
        value={value}
        onChange={onChange}
        {...props}
      >
        <option value="" style={{ background: "#FFFFFF", color: "#1C1C1C60" }}>Select your {label.toLowerCase()}...</option>
        {options.map(p => (
          <option key={p} value={p} style={{ background: "#FFFFFF", color: "#1C1C1C" }}>{p}</option>
        ))}
      </select>
    </div>
  </div>
);

/* ── Checkbox ── */
const Check = ({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onChange} className="flex items-start gap-3 text-left group">
    <div
      className="w-4 h-4 mt-0.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-all duration-200"
      style={{
        background: checked ? "#00A4EF" : "transparent",
        borderColor: checked ? "#00A4EF" : "#E0E0E0",
      }}
    >
      {checked && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
    </div>
    <span className="text-[11px] leading-relaxed" style={{ color: "#1C1C1C60" }}>{children}</span>
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
      style={{ fontFamily: "'Inter', sans-serif", background: "#F5F5F5" }}
      className="min-h-screen text-[#1C1C1C] flex overflow-hidden"
    >
      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex flex-col relative w-[42%] flex-shrink-0 overflow-hidden">

        {/* Gradient background */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #00A4EF, #007BB5)" }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: `linear-gradient(to right, #FFFFFF 1px, transparent 1px), linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)`,
          backgroundSize: "48px 48px"
        }} />
        {/* Glow orbs */}
        <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] rounded-full blur-[120px]" style={{ background: "#FFFFFF15" }} />
        <div className="absolute bottom-[-10%] right-[-20%] w-[400px] h-[400px] rounded-full blur-[100px]" style={{ background: "#FFFFFF20" }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-14 text-white">
          <Link to="/" className="flex items-center group w-fit">
            <Logo size="lg" className="scale-125 origin-left" />
          </Link>

          <div className="mt-auto mb-auto">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase mb-8"
              style={{ border: "1px solid #FFFFFF40", background: "#FFFFFF12", color: "#FFFFFF" }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#FFFFFF" }} />
              {step === "form" ? "Step 1 of 2" : "Step 2 of 2"}
            </div>

            <h2 style={{ fontFamily: "'Inter', sans-serif" }} className="text-5xl font-extrabold leading-[1.05] tracking-tight mb-6">
              {step === "form" ? (
                <>Your work,<br /><span style={{ color: "#E6F6FE" }}>your rules.</span></>
              ) : (
                <>Almost<br /><span style={{ color: "#E6F6FE" }}>there.</span></>
              )}
            </h2>
            <p className="text-sm leading-relaxed max-w-xs font-light" style={{ color: "#FFFFFFCC" }}>
              {step === "form"
                ? "Set up your account and start closing deals in minutes. No friction, no nonsense."
                : "Enter the 6-digit code we sent to your inbox to complete your registration."}
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">

        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none lg:left-[42%]">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px]" style={{ background: "#00A4EF05" }} />
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-between px-8 pt-8 pb-4">
          <Link to="/" className="flex items-center">
            <Logo size="md" theme="dark" />
          </Link>
          <div className="text-xs" style={{ color: "#1C1C1C40" }}>
            Step {step === "form" ? "1" : "2"} of 2
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12 relative z-10">
          <div className="w-full max-w-md bg-white p-10 rounded-lg shadow-sm border border-[#E0E0E0]"
               style={{ animation: mounted ? "slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both" : "none" }}>

            {/* ── FORM STEP ── */}
            {step === "form" && (
              <div
                key="form"
                style={{ animation: mounted ? "slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both" : "none" }}
              >
                <div className="mb-10">
                  <h1 style={{ fontFamily: "'Inter', sans-serif" }} className="text-3xl font-extrabold tracking-tight text-[#1C1C1C] mb-1.5">
                    Create account
                  </h1>
                  <p className="text-sm font-light" style={{ color: "#1C1C1C60" }}>
                    Already a member?{" "}
                    <Link
                      to="/login"
                      className="font-medium transition-colors"
                      style={{ color: "#00A4EF" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#007BB5")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#00A4EF")}
                    >
                      Sign in
                    </Link>
                  </p>
                </div>


                {/* Error */}
                {error && (
                  <div className="mb-6 px-4 py-3 rounded-lg text-xs flex items-center gap-2"
                    style={{ background: "#E74C3C12", border: "1px solid #E74C3C30", color: "#E74C3C" }}>
                    <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#E74C3C" }} />
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
                      <label className="block text-[9px] font-bold tracking-[0.25em] uppercase mb-2 ml-0.5" style={{ color: "#1C1C1C60" }}>
                        Password
                      </label>
                      <div className="relative">
                        <svg viewBox="0 0 16 16" className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 fill-current transition-colors" style={{ color: "#1C1C1C30" }}>
                          <path d="M8 1a3 3 0 0 0-3 3v1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2V4a3 3 0 0 0-3-3zm0 1.5A1.5 1.5 0 0 1 9.5 4v1h-3V4A1.5 1.5 0 0 1 8 2.5z" />
                        </svg>
                        <input
                          type={showPassword ? "text" : "password"}
                          className="w-full bg-transparent border-0 outline-none pl-6 pr-8 pb-2.5 pt-1 text-sm text-[#1C1C1C] placeholder:text-[#1C1C1C40] transition-colors duration-200"
                          style={{ borderBottom: "1px solid #E0E0E0" }}
                          onFocus={e => (e.currentTarget.style.borderBottomColor = "#00A4EF")}
                          onBlur={e  => (e.currentTarget.style.borderBottomColor = "#E0E0E0")}
                          placeholder="Min. 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(s => !s)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 transition-colors pb-2"
                          style={{ color: "#1C1C1C40" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#1C1C1C80")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#1C1C1C40")}
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
                      <Link to="/terms" target="_blank" className="transition-colors" style={{ color: "#00A4EF" }}>
                        Terms of Service
                      </Link>
                    </Check>
                    <Check checked={agreeToPrivacy} onChange={() => setAgreeToPrivacy(s => !s)}>
                      I accept the{" "}
                      <Link to="/privacy" target="_blank" className="transition-colors" style={{ color: "#00A4EF" }}>
                        Privacy Policy
                      </Link>
                    </Check>
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingOtp || !agreeToTerms || !agreeToPrivacy}
                    className="w-full h-12 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
                    style={{
                      background: (isSendingOtp || !agreeToTerms || !agreeToPrivacy) ? "#E0E0E0" : "#00A4EF",
                      color: (isSendingOtp || !agreeToTerms || !agreeToPrivacy) ? "#9E9E9E" : "#FFFFFF",
                      boxShadow: (isSendingOtp || !agreeToTerms || !agreeToPrivacy) ? "none" : "0 4px 12px rgba(0, 164, 239, 0.2)",
                      cursor: (isSendingOtp || !agreeToTerms || !agreeToPrivacy) ? "not-allowed" : "pointer",
                    }}
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
                  className="flex items-center gap-1.5 text-xs transition-colors mb-10 group"
                  style={{ color: "#1C1C1C40" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#1C1C1C80")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#1C1C1C40")}
                >
                  <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  Back
                </button>

                {/* Icon */}
                <div className="mb-8">
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center mb-6 relative"
                    style={{ background: "#E6F6FE", border: "1px solid #00A4EF30" }}
                  >
                    <Mail className="w-7 h-7" strokeWidth={1.5} style={{ color: "#00A4EF" }} />
                    <span
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                      style={{ background: "#00A4EF", color: "#FFFFFF", boxShadow: "0 2px 6px rgba(0, 164, 239, 0.3)" }}
                    >
                      1
                    </span>
                  </div>
                  <h1 style={{ fontFamily: "'Inter', sans-serif" }} className="text-3xl font-extrabold tracking-tight mb-2 text-[#1C1C1C]">
                    Check your inbox
                  </h1>
                  <p className="text-sm font-light leading-relaxed" style={{ color: "#1C1C1C60" }}>
                    We sent a 6-digit code to{" "}
                    <span className="font-medium" style={{ color: "#1C1C1C" }}>{email}</span>
                  </p>
                </div>

                {error && (
                  <div className="mb-6 px-4 py-3 rounded-lg text-xs flex items-center gap-2"
                    style={{ background: "#E74C3C12", border: "1px solid #E74C3C30", color: "#E74C3C" }}>
                    <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#E74C3C" }} />
                    {error}
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-8">
                  {/* OTP input */}
                  <div>
                    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase mb-4" style={{ color: "#1C1C1C60" }}>
                      Verification Code
                    </label>
                    <input
                      className="w-full h-20 bg-transparent rounded-lg text-center text-4xl font-bold tracking-[0.6em] text-[#1C1C1C] transition-colors duration-200 placeholder:text-[#1C1C1C15] placeholder:tracking-[0.3em] outline-none"
                      style={{ border: "1px solid #E0E0E0" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#00A4EF")}
                      onBlur={e  => (e.currentTarget.style.borderColor = "#E0E0E0")}
                      placeholder="······"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      autoFocus
                      required
                    />
                    {/* Progress dots */}
                    <div className="flex gap-2 justify-center mt-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                          style={{ background: i < otp.length ? "#00A4EF" : "#E0E0E0" }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={otp.length !== 6 || isLoading}
                    className="w-full h-12 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                    style={{
                      background: (otp.length !== 6 || isLoading) ? "#E0E0E0" : "#00A4EF",
                      color: (otp.length !== 6 || isLoading) ? "#9E9E9E" : "#FFFFFF",
                      boxShadow: (otp.length !== 6 || isLoading) ? "none" : "0 4px 12px rgba(0, 164, 239, 0.2)",
                      cursor: (otp.length !== 6 || isLoading) ? "not-allowed" : "pointer",
                    }}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Verify &amp; Join</>
                    )}
                  </button>

                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isSendingOtp}
                      className="text-xs transition-colors flex items-center gap-1.5 disabled:opacity-30"
                      style={{ color: "#1C1C1C40" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#00A4EF")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#1C1C1C40")}
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
        <div className="text-center pb-8 text-[10px] tracking-widest uppercase" style={{ color: "#1C1C1C40" }}>
          © 2026 Krovaa &nbsp;·&nbsp;{" "}
          <a
            href="mailto:support@krovaa.com"
            className="transition-colors"
            style={{ color: "#1C1C1C40" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#00A4EF")}
            onMouseLeave={e => (e.currentTarget.style.color = "#1C1C1C40")}
          >
            support@krovaa.com
          </a>
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
