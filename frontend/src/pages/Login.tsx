import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Loader2, Eye, EyeOff, ArrowRight, ChevronLeft, Lock } from "lucide-react";
import TelegramLogin from "@/components/TelegramLogin";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/* ── Font injection ── */
if (typeof document !== "undefined" && !document.getElementById("krovaa-login-fonts")) {
  const l = document.createElement("link");
  l.id = "krovaa-login-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap";
  document.head.appendChild(l);
}

/* ── Underline field (matches Register) ── */
const Field = ({
  label, icon: Icon, className = "", ...props
}: { label: string; icon: React.ElementType; className?: string;[k: string]: any }) => (
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

const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); document.title = "Sign In — Krovaa"; }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const loggedInUser = await login(email.trim().toLowerCase(), password);
      loggedInUser.role === "admin" ? navigate("/admin", { replace: true }) : navigate("/chat", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      // Normalize credential errors to a clear, friendly message
      if (
        msg.toLowerCase().includes("invalid credentials") ||
        msg.toLowerCase().includes("invalid email") ||
        msg.toLowerCase().includes("invalid password") ||
        msg.toLowerCase().includes("user not found") ||
        msg.toLowerCase().includes("wrong password")
      ) {
        const friendly = "Invalid credentials. Please check your email and password.";
        setError(friendly);
        toast({ title: "Invalid credentials", description: friendly, variant: "destructive" });
      } else {
        setError(msg);
        toast({ title: "Login failed", description: msg, variant: "destructive" });
      }
    }
  };

  return (
    <div
      style={{ fontFamily: "'Rubik', sans-serif" }}
      className="min-h-screen bg-[#050810] text-white flex overflow-hidden"
    >

      {/* ── LEFT PANEL — brand ── */}
      <div className="hidden lg:flex flex-col relative w-[42%] flex-shrink-0 overflow-hidden">
        {/* Backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#070d1f] via-[#050810] to-[#020408]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />
        <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] rounded-full bg-blue-700/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[400px] h-[400px] rounded-full bg-blue-900/20 blur-[100px]" />
        {/* Right border */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-blue-500/20 to-transparent" />

        {/* Watermark */}
        <div
          className="absolute bottom-32 -left-16 text-[200px] font-extrabold tracking-tighter select-none pointer-events-none opacity-[0.025]"
          style={{ fontFamily: "'Rubik', sans-serif", transform: "rotate(-90deg) translateX(20%)", transformOrigin: "left bottom", color: "#3b82f6", lineHeight: 1 }}
        >
          KROVAA
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group w-fit">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 group-hover:bg-blue-500 transition-colors">
              <svg viewBox="0 0 16 16" className="w-4 h-4 fill-white"><path d="M2 2h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-4 3V3a1 1 0 0 1 1-1z" /></svg>
            </div>
            <span style={{ fontFamily: "'Rubik', sans-serif" }} className="text-lg font-bold tracking-tight">Krovaa</span>
          </Link>

          {/* Statement */}
          <div className="mt-auto mb-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/25 bg-blue-500/8 text-[10px] font-bold text-blue-400 tracking-[0.2em] uppercase mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Welcome back
            </div>

            <h2 style={{ fontFamily: "'Rubik', sans-serif" }} className="text-5xl font-extrabold leading-[1.05] tracking-tight mb-6">
              Pick up<br />
              <span className="text-blue-400">where you left off.</span>
            </h2>
            <p className="text-white/30 text-sm leading-relaxed max-w-xs font-light">
              Your conversations, deals, and clients are waiting. Sign in to continue.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-8">
            {[["12K+", "Freelancers"], ["4.9★", "Rating"], ["$4.2M", "Transacted"]].map(([v, l]) => (
              <div key={l}>
                <p style={{ fontFamily: "'Rubik', sans-serif" }} className="text-xl font-extrabold text-white">{v}</p>
                <p className="text-[10px] text-white/25 tracking-widest uppercase mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">

        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none lg:left-[42%]">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-900/8 blur-[120px]" />
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-between px-8 pt-8 pb-4">
          <Link to="/" style={{ fontFamily: "'Rubik', sans-serif" }} className="text-xl font-bold">Krovaa</Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12 relative z-10">
          <div
            className="w-full max-w-md"
            style={{ animation: mounted ? "slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both" : "none" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-10">
              <div>
                <h1 style={{ fontFamily: "'Rubik', sans-serif" }} className="text-3xl font-extrabold tracking-tight text-white mb-1.5">
                  Sign in
                </h1>
                <p className="text-white/30 text-sm font-light">
                  New here?{" "}
                  <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    Create an account
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

            <form onSubmit={handleSubmit} className="space-y-8">
              <Field
                label="Email Address"
                icon={Mail}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                required
              />

              {/* Password with forgot link */}
              <div>
                <div className="flex items-end justify-between mb-2">
                  <label className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 ml-0.5">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-[10px] text-white/20 hover:text-blue-400 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="group relative">
                  <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-blue-400 transition-colors duration-200" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-transparent border-0 border-b border-white/10 focus:border-blue-500/60 outline-none pl-6 pr-8 pb-2.5 pt-1 text-sm text-white placeholder:text-white/15 transition-colors duration-200"
                    placeholder="••••••••"
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-blue-900/30 hover:shadow-blue-700/40 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                ) : (
                  <>Sign in <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-8 text-[10px] text-white/10 tracking-widest uppercase">
          © 2026 Krovaa &nbsp;·&nbsp; support@krovaa.com
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

export default Login;
