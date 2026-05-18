import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { themeColors } from "@/lib/themeColors";
import { Mail, Loader2, Eye, EyeOff, ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";

/* ── Underline field ── */
const Field = ({
  label, icon: Icon, className = "", ...props
}: { label: string; icon: React.ElementType; className?: string; [k: string]: any }) => (
  <div className="group">
    <label className="block text-[9px] font-bold tracking-[0.25em] uppercase mb-2 ml-0.5" style={{ color: "#1C1C1C60" }}>
      {label}
    </label>
    <div className="relative">
      <Icon
        className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors duration-200"
        style={{ color: "#1C1C1C30" }}
      />
      <input
        className={`w-full bg-transparent border-0 outline-none pl-6 pb-2.5 pt-1 text-sm text-[#1C1C1C] transition-colors duration-200 ${className}`}
        style={{
          borderBottom: "1px solid #E0E0E0",
        }}
        onFocus={e => (e.currentTarget.style.borderBottomColor = "#00A4EF")}
        onBlur={e  => (e.currentTarget.style.borderBottomColor = "#E0E0E0")}
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
      navigate(loggedInUser.role === "admin" ? "/admin" : "/chat", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
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
      style={{ fontFamily: "'Inter', sans-serif", background: "#F5F5F5" }}
      className="min-h-screen text-[#1C1C1C] flex overflow-hidden"
    >

      {/* ── LEFT PANEL — brand ── */}
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
          {/* Logo */}
          <Link to="/" className="flex items-center group w-fit">
            <Logo size="lg" className="scale-125 origin-left" />
          </Link>

          {/* Statement */}
          <div className="mt-auto mb-auto">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase mb-8"
              style={{ border: "1px solid #FFFFFF40", background: "#FFFFFF12", color: "#FFFFFF" }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#FFFFFF" }} />
              Welcome back
            </div>

            <h2 style={{ fontFamily: "'Inter', sans-serif" }} className="text-5xl font-extrabold leading-[1.05] tracking-tight mb-6">
              Pick up<br />
              <span style={{ color: "#E6F6FE" }}>where you left off.</span>
            </h2>
            <p className="text-sm leading-relaxed max-w-xs font-light" style={{ color: "#FFFFFFCC" }}>
              Your conversations, deals, and clients are waiting. Sign in to continue.
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
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12 relative z-10">
          <div
            className="w-full max-w-md bg-white p-10 rounded-lg shadow-sm border border-[#E0E0E0]"
            style={{ animation: mounted ? "slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both" : "none" }}
          >
            <div className="mb-10">
              <h1 style={{ fontFamily: "'Inter', sans-serif" }} className="text-3xl font-extrabold tracking-tight text-[#1C1C1C] mb-1.5">
                Sign in
              </h1>
              <p className="text-sm font-light" style={{ color: "#1C1C1C60" }}>
                New here?{" "}
                <Link to="/register" className="font-medium transition-colors" style={{ color: "#00A4EF" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#007BB5")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#00A4EF")}
                >
                  Create an account
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
                  <label className="text-[9px] font-bold tracking-[0.25em] uppercase ml-0.5" style={{ color: "#1C1C1C60" }}>
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-[10px] transition-colors"
                    style={{ color: "#1C1C1C40" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#00A4EF")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#1C1C1C40")}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="group relative">
                  <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors duration-200" style={{ color: "#1C1C1C30" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-transparent border-0 outline-none pl-6 pr-8 pb-2.5 pt-1 text-sm text-[#1C1C1C] placeholder:text-[#1C1C1C40] transition-colors duration-200"
                    style={{ borderBottom: "1px solid #E0E0E0" }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = "#00A4EF")}
                    onBlur={e  => (e.currentTarget.style.borderBottomColor = "#E0E0E0")}
                    placeholder="••••••••"
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
                style={{
                  background: isLoading ? "#E0E0E0" : "#00A4EF",
                  color: isLoading ? "#9E9E9E" : "#FFFFFF",
                  boxShadow: isLoading ? "none" : "0 4px 12px rgba(0, 164, 239, 0.2)",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
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
        <div className="text-center pb-8 text-[10px] tracking-widest uppercase" style={{ color: "#1C1C1C40" }}>
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
