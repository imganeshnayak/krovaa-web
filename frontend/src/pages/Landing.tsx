import { Link, useNavigate } from "react-router-dom";
import { themeColors } from "@/lib/themeColors";
import {
  MessageSquare, Shield, Share2, IndianRupee,
  ArrowRight, Send, CheckCircle2, Zap,
  Star, Users, TrendingUp, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useRef } from "react";
import Logo from "@/components/Logo";

/* ─── Data ─── */
const slides = [
  {
    tag: "Real-Time Chat",
    headline: "Every deal starts\nwith a conversation.",
    body: "WhatsApp-style messaging with text, images, documents & voice notes — no email chains, no missed context.",
    icon: MessageSquare,
    accent: "#00A4EF",
  },
  {
    tag: "Payment Management",
    headline: "Get paid on\nyour terms.",
    body: "Milestone-based payment releases give both sides full control. Transparent records for every transaction.",
    icon: IndianRupee,
    accent: "#0FB881",
  },
  {
    tag: "Profile & Sharing",
    headline: "Your brand,\none link away.",
    body: "Share your professional profile via link or QR code. Let clients come to you — fully set up in minutes.",
    icon: Share2,
    accent: "#FF6B35",
  },
  {
    tag: "Transparent Deals",
    headline: "Work that speaks\nfor itself.",
    body: "Full audit trail of messages, deliverables, and payments. Both parties always know where things stand.",
    icon: Shield,
    accent: "#00A4EF",
  },
];

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

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-[#E0E0E0] backdrop-blur-2xl bg-white/80 h-20 flex items-center">
        <div className="w-full flex items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center group shrink-0 -ml-2 sm:-ml-0">
            <Logo size="lg" className="scale-110 origin-left" />
          </Link>

          <div className="hidden md:flex gap-8 text-sm font-medium text-[#1C1C1C60]">
            <a href="#how" className="hover:text-[#00A4EF] transition-colors">How it works</a>
            <a href="#carousel" className="hover:text-[#00A4EF] transition-colors">Features</a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block">
              <Button variant="ghost" className="text-[#1C1C1C60] hover:text-[#1C1C1C] hover:bg-[#F5F5F5] text-sm">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button style={{
                background: "#00A4EF",
                boxShadow: "0 4px 12px rgba(0, 164, 239, 0.2)"
              }} className="text-white text-sm transition-all hover:scale-[1.02] hover:shadow-lg">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-28 pb-20 md:pt-40 md:pb-28 px-6">
        <div className="max-w-5xl mx-auto text-center">

          <div style={{
            border: "1px solid #00A4EF30",
            background: "#E6F6FE",
            color: "#00A4EF"
          }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-10">
            <Zap className="h-3 w-3 fill-current" />
            Built for modern freelancers
          </div>

          <h1
            style={{ fontFamily: "'Inter', sans-serif", lineHeight: 1.02 }}
            className="text-5xl sm:text-6xl md:text-[6rem] font-extrabold tracking-tight mb-8 text-[#1C1C1C]"
          >
            Chat.{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-transparent bg-clip-text" style={{
                backgroundImage: `linear-gradient(to right, #00A4EF, #007BB5)`
              }}>
                Pay.
              </span>
              <span className="absolute bottom-1 left-0 right-0 h-[4px] rounded-full" style={{
                background: "#00A4EF"
              }} />
            </span>
            {" "}Deliver.
          </h1>

          <p className="text-lg md:text-xl text-[#1C1C1C60] mb-12 max-w-xl mx-auto leading-relaxed font-light">
            The platform where{" "}
            <span className="text-[#1C1C1C] font-normal">conversations become contracts</span>
            {" "}— and work actually gets done.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/register">
              <Button
                size="lg"
                style={{
                  background: "#00A4EF",
                  boxShadow: "0 4px 12px rgba(0, 164, 239, 0.2)"
                }}
                className="h-12 px-10 text-white text-base transition-all hover:scale-[1.03]"
              >
                Start for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="ghost"
                className="h-12 px-8 text-base border text-[#1C1C1C60] hover:text-[#1C1C1C] transition-all"
                style={{
                  borderColor: "#E0E0E0"
                }}
              >
                Sign In
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#1C1C1C40]">
            {["No credit card required", "Free forever plan", "Cancel anytime"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 style={{ color: "#0FB881" }} className="h-4 w-4 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

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

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 px-6 bg-[#FAFAFA]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p style={{ color: "#00A4EF" }} className="text-xs font-semibold tracking-widest uppercase mb-3">How It Works</p>
            <h2 style={{ fontFamily: "'Inter', sans-serif" }} className="text-3xl md:text-4xl font-bold text-[#1C1C1C]">
              Three steps to your next deal
            </h2>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="hidden md:block absolute top-8 left-[20%] right-[20%] h-px" style={{
              background: `linear-gradient(to right, transparent, #E0E0E0, transparent)`
            }} />
            {[
              { step: "01", title: "Create & Share", desc: "Set up your profile and share it with potential clients via link or QR code." },
              { step: "02", title: "Chat & Agree", desc: "Discuss the project in real-time and lock in the terms directly in chat." },
              { step: "03", title: "Deliver & Get Paid", desc: "Complete milestones, release funds, and build your reputation." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 z-10 relative" style={{
                  border: "1px solid #E0E0E0",
                  background: "#FFFFFF"
                }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", color: "#00A4EF" }} className="font-extrabold text-lg">{step}</span>
                </div>
                <h3 className="text-base font-bold mb-2 text-[#1C1C1C]">{title}</h3>
                <p className="text-sm text-[#1C1C1C60] leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAROUSEL ── */}
      <section id="carousel" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#00A4EF] mb-3">Features & Voices</p>
            <h2 style={{ fontFamily: "'Inter', sans-serif" }} className="text-3xl md:text-4xl font-bold text-[#1C1C1C]">
              Everything you need. Nothing you don't.
            </h2>
          </div>

          {/* Main carousel */}
          <div
            className="relative select-none group/carousel"
            onMouseDown={onDragStart} onMouseUp={onDragEnd}
            onTouchStart={onDragStart} onTouchEnd={onDragEnd}
          >
            {/* Slide track */}
            <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white relative shadow-sm">
              <div
                className="flex transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
                style={{ transform: `translateX(-${current * 100}%)` }}
              >
                {slides.map((s, idx) => {
                  const SIcon = s.icon;
                  return (
                    <div key={idx} className="w-full shrink-0 relative min-h-[360px] md:min-h-[300px]">
                      {/* Glow */}
                      <div
                        className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none opacity-5"
                        style={{ background: s.accent }}
                      />
                      {/* Top accent bar */}
                      <div className="h-[3px] w-full" style={{ background: s.accent }} />

                      <div className="relative z-10 p-10 md:p-14 flex flex-col md:flex-row gap-10 items-start">
                        <div className="flex-1">
                          <div
                            className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full border mb-6"
                            style={{ color: s.accent, borderColor: `${s.accent}40`, background: `${s.accent}10` }}
                          >
                            <SIcon className="h-3 w-3" />
                            {s.tag}
                          </div>
                          <h3
                            style={{ fontFamily: "'Inter', sans-serif", whiteSpace: "pre-line" }}
                            className="text-3xl md:text-4xl font-extrabold leading-tight mb-5 text-[#1C1C1C]"
                          >
                            {s.headline}
                          </h3>
                          <p className="text-[#1C1C1C60] text-base leading-relaxed max-w-md font-light">{s.body}</p>
                        </div>

                        <div className="shrink-0 flex items-center justify-center">
                          <div
                            className="w-24 h-24 md:w-32 md:h-32 rounded-lg flex items-center justify-center"
                            style={{ background: `${s.accent}10`, border: `1px solid ${s.accent}20` }}
                          >
                            <SIcon
                              className="w-12 h-12 md:w-16 md:h-16"
                              style={{ color: s.accent, opacity: 0.9 }}
                              strokeWidth={1.2}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Manual navigation arrows - visible on hover */}
              <button
                onClick={() => go(-1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 border border-[#E0E0E0] flex items-center justify-center text-[#1C1C1C40] hover:text-[#00A4EF] transition-all opacity-0 group-hover/carousel:opacity-100 shadow-sm z-20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={() => go(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 border border-[#E0E0E0] flex items-center justify-center text-[#1C1C1C40] hover:text-[#00A4EF] transition-all opacity-0 group-hover/carousel:opacity-100 shadow-sm z-20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 h-1 bg-[#E0E0E0] w-full z-10">
                <div
                  key={current}
                  className="h-full transition-all"
                  style={{ background: "#00A4EF" }}
                />
              </div>
            </div>

            {/* Manual Navigation Dots */}
            <div className="flex justify-center gap-2 mt-8">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrent(i); startAuto(); }}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === current ? "w-8" : "w-1.5 bg-[#E0E0E0] hover:bg-[#BDBDBD]"
                    }`}
                  style={{ background: i === current ? "#00A4EF" : undefined }}
                />
              ))}
            </div>
          </div>
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
              Free to start
            </div>

            <h2 style={{ fontFamily: "'Inter', sans-serif" }} className="text-3xl md:text-5xl font-extrabold mb-5 tracking-tight text-white">
              Ready to close your next deal?
            </h2>
            <p className="text-white/80 mb-10 text-base max-w-md mx-auto leading-relaxed font-light">
              Join thousands of freelancers using Krovaa to work faster, communicate clearly, and get paid on time.
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
                  Create Your Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-base border-white text-white hover:bg-white/10 transition-all bg-transparent"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#E0E0E0] pt-14 pb-8 bg-[#FAFAFA]">
        <div className="w-full px-4 md:px-8">
          <div className="flex flex-col gap-6 mb-12 items-center text-center">
            <Link to="/" className="flex flex-col items-center group shrink-0">
              <Logo size="lg" variant="image" className="scale-125 origin-center" />
            </Link>

            <p className="text-sm text-[#1C1C1C60] leading-relaxed max-w-xs font-light">
              Chat-first deal management for the modern gig economy.
            </p>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center md:items-center gap-4 pt-8 border-t border-[#E0E0E0] text-center md:text-left">
            <p className="text-xs text-[#1C1C1C40]">© 2026 Krovaa &nbsp;·&nbsp; <a href="mailto:support@krovaa.com" className="hover:text-[#00A4EF] transition-colors">support@krovaa.com</a></p>
            <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-3 text-xs text-[#1C1C1C40]">
              <Link to="/privacy" className="hover:text-[#00A4EF] transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-[#00A4EF] transition-colors">Terms of Service</Link>
              <Link to="/refund" className="hover:text-[#00A4EF] transition-colors">Refund Policy</Link>
              <Link to="/cookie-policy" className="hover:text-[#00A4EF] transition-colors">Cookie Policy</Link>
              <button
                onClick={() => { localStorage.removeItem("cookie_consent"); window.location.reload(); }}
                className="hover:text-[#00A4EF] transition-colors"
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
