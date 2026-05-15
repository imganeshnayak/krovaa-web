import { Link, useNavigate } from "react-router-dom";
import { themeColors } from "@/lib/themeColors";
import {
  MessageSquare, Shield, Share2, IndianRupee,
  ArrowRight, Send, CheckCircle2, Zap,
  Star, Users, TrendingUp, ChevronLeft, ChevronRight,
  Mail, Github, Linkedin, Twitter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useRef } from "react";
import Logo from "@/components/Logo";
import HeroLanding from "@/components/HeroLanding";
import FeatureCard from "@/components/FeatureCard";
import Timeline from "@/components/Timeline";
import Navbar from "@/components/Navbar";
import FeaturesCarousel from "@/components/FeaturesCarousel";
import landingContent from "../../content/landing.json";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Shield,
  Share2,
  IndianRupee,
};

const slides = landingContent.features.map((f) => ({
  tag: f.tag,
  headline: f.headline,
  body: f.body,
  icon: iconMap[f.icon] || MessageSquare,
  accent: f.accent,
}));

/* ─── Component ─── */
const Landing = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const autoRef = useRef<any>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(0);

  useEffect(() => {
    if (!isLoading && user) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      user.role === "admin" ? navigate("/admin") : navigate("/chat");
    }
  }, [user, isLoading, navigate]);

  /* auto-advance */
  const startAuto = () => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000);
  };
  useEffect(() => { startAuto(); return () => clearInterval(autoRef.current); }, []);

  const go = (dir: number) => {
    setCurrent((c) => (c + dir + slides.length) % slides.length);
    startAuto();
  };

  /* drag / swipe */
  const onDragStart = (e: any) => {
    dragStart.current = e.clientX ?? e.touches?.[0]?.clientX;
    setDragging(true);
  };
  const onDragEnd = (e: any) => {
    if (!dragging) return;
    const end = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const diff = dragStart.current - end;
    if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
    setDragging(false);
  };

  if (isLoading || user) return null;

  const slide = slides[current];
  const SlideIcon = slide.icon;

  return (
    <div
      style={{ fontFamily: "'Inter', sans-serif", background: "#FFFFFF" }}
      className="min-h-screen text-[#1C1C1C] selection:bg-[#00A4EF] selection:text-white overflow-x-hidden"
    >

      {/* ── Ambient glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[130px]" style={{ background: "#00A4EF08" }} />
        <div className="absolute top-[60%] -right-32 w-[400px] h-[400px] rounded-full blur-[120px]" style={{ background: "#0FB88108" }} />
        {/* grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              `linear-gradient(to right, #00A4EF 1px, transparent 1px), linear-gradient(to bottom, #00A4EF 1px, transparent 1px)`,
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      <Navbar />

      <HeroLanding />

      {/* ── LOGO MARQUEE ── */}
      <div className="relative py-10 overflow-hidden border-y border-[#E0E0E0] bg-[#F5F5F5]">
        <div className="flex w-[200%] animate-marquee">
          {[...slides, ...slides].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-4 px-12 shrink-0 group">
                <div className="p-2 rounded-lg bg-white transition-colors" style={{ border: "1px solid #E0E0E0" }}>
                  <Icon className="h-5 w-5 text-[#1C1C1C40] transition-colors" />
                </div>
                <span className="text-sm font-medium text-[#1C1C1C40] group-hover:text-[#1C1C1C] transition-colors uppercase tracking-widest whitespace-nowrap">
                  {item.tag}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Timeline />

      <section id="features" className="py-20 px-6 group">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#00A4EF] mb-2">Features & Voices</p>
            <h2 className="text-3xl md:text-4xl font-bold">Everything you need. Nothing you don't.</h2>
          </div>

          <FeaturesCarousel items={slides} />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-28">
        <div className="rounded-lg relative overflow-hidden text-center p-10 md:p-20" style={{
          background: "linear-gradient(135deg, #00A4EF, #007BB5)"
        }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[2px]" style={{
            background: `linear-gradient(to right, transparent, #FFFFFF50, transparent)`
          }} />

          <div className="relative z-10 text-white">
            <div style={{
              border: "1px solid #FFFFFF40",
              background: "#FFFFFF12",
              color: "#FFFFFF"
            }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase mb-8">
              <Zap className="h-3 w-3 fill-current" />
              {landingContent.cta.tag}
            </div>

            <h2 style={{ fontFamily: "'Inter', sans-serif" }} className="text-3xl md:text-5xl font-extrabold mb-5 tracking-tight text-white">
              {landingContent.cta.title}
            </h2>
            <p className="text-white/80 mb-10 text-base max-w-md mx-auto leading-relaxed font-light">
              {landingContent.cta.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button
                  size="lg"
                  style={{
                    background: "#FFFFFF",
                    color: "#00A4EF",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
                  }}
                  className="h-12 px-10 text-base font-semibold transition-all hover:scale-[1.03]"
                >
                  {landingContent.cta.ctaPrimary}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-base border-white text-white hover:bg-white/10 transition-all bg-transparent"
                >
                  {landingContent.cta.ctaSecondary}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-[#E0E0E0] bg-gradient-to-b from-[#FFFFFF] to-[#FAFAFA]">
        <div className="w-full px-4 md:px-8 py-12 md:py-14">
          {/* Footer Content Grid */}
          <div className="max-w-6xl mx-auto">
            {/* Main Footer Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-6 mb-10">
              {/* Brand Section - Left */}
              <div className="col-span-1 md:col-span-5">
                <Link to="/" className="flex items-center gap-2 mb-3">
                  <Logo size="md" theme="dark" />
                </Link>
                <p className="text-xs text-[#1C1C1C70] leading-relaxed font-light mb-4 max-w-sm">
                  {landingContent.footer.tagline}
                </p>
                {/* Social Links */}
                <div className="flex gap-2">
                  <a href="mailto:support@krovaa.com" className="p-2 rounded-lg bg-[#F0F0F0] hover:bg-[#00A4EF] text-[#1C1C1C80] hover:text-white transition-all duration-200" title="Email">
                    <Mail className="h-4 w-4" />
                  </a>
                  <a href="https://twitter.com" className="p-2 rounded-lg bg-[#F0F0F0] hover:bg-[#00A4EF] text-[#1C1C1C80] hover:text-white transition-all duration-200" title="Twitter">
                    <Twitter className="h-4 w-4" />
                  </a>
                  <a href="https://linkedin.com" className="p-2 rounded-lg bg-[#F0F0F0] hover:bg-[#00A4EF] text-[#1C1C1C80] hover:text-white transition-all duration-200" title="LinkedIn">
                    <Linkedin className="h-4 w-4" />
                  </a>
                  <a href="https://github.com" className="p-2 rounded-lg bg-[#F0F0F0] hover:bg-[#00A4EF] text-[#1C1C1C80] hover:text-white transition-all duration-200" title="GitHub">
                    <Github className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Company Links - Center */}
              <div className="col-span-1 md:col-span-3 md:pl-4">
                <h3 className="text-xs font-bold text-[#0A0E27] mb-3 uppercase tracking-widest">Company</h3>
                <ul className="space-y-2 text-xs text-[#1C1C1C70]">
                  <li><a href="#" className="hover:text-[#00A4EF] transition-colors font-medium">About Us</a></li>
                </ul>
              </div>

              {/* Legal Links - Right */}
              <div className="col-span-1 md:col-span-4 md:pl-4">
                <h3 className="text-xs font-bold text-[#0A0E27] mb-3 uppercase tracking-widest">Legal</h3>
                <ul className="space-y-2 text-xs text-[#1C1C1C70]">
                  {landingContent.footer.legal.map((link) => (
                    <li key={link}>
                      <Link 
                        to={link === "Privacy Policy" ? "/privacy" : link === "Terms of Service" ? "/terms" : "/cookie-policy"} 
                        className="hover:text-[#00A4EF] transition-colors font-medium"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-[#E0E0E0] to-transparent my-8" />

            {/* Footer Bottom */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#1C1C1C50]">
              <p className="font-medium">© {landingContent.footer.copyright}</p>
              <button
                onClick={() => { localStorage.removeItem("cookie_consent"); window.location.reload(); }}
                className="hover:text-[#00A4EF] transition-colors font-medium"
              >
                Cookie Settings
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ── keyframes ── */}
      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-progress {
          animation: progress 5s linear forwards;
        }
      `}</style>

    </div >
  );
};

export default Landing;
