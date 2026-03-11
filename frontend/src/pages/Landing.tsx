import { Link, useNavigate } from "react-router-dom";
import {
  MessageSquare, Shield, Share2, IndianRupee,
  ArrowRight, Send, CheckCircle2, Zap,
  Star, Users, TrendingUp, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useRef } from "react";

/* ─── Google Font import (Syne + DM Sans) injected once ─── */
if (typeof document !== "undefined" && !document.getElementById("krovaa-fonts")) {
  const link = document.createElement("link");
  link.id = "krovaa-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap";
  document.head.appendChild(link);
}

/* ─── Data ─── */
const slides = [
  {
    tag: "Real-Time Chat",
    headline: "Every deal starts\nwith a conversation.",
    body: "WhatsApp-style messaging with text, images, documents & voice notes — no email chains, no missed context.",
    icon: MessageSquare,
    accent: "#2563EB",
  },
  {
    tag: "Payment Management",
    headline: "Get paid on\nyour terms.",
    body: "Milestone-based payment releases give both sides full control. Transparent records for every transaction.",
    icon: IndianRupee,
    accent: "#1D4ED8",
  },
  {
    tag: "Profile & Sharing",
    headline: "Your brand,\none link away.",
    body: "Share your professional profile via link or QR code. Let clients come to you — fully set up in minutes.",
    icon: Share2,
    accent: "#3B82F6",
  },
  {
    tag: "Transparent Deals",
    headline: "Work that speaks\nfor itself.",
    body: "Full audit trail of messages, deliverables, and payments. Both parties always know where things stand.",
    icon: Shield,
    accent: "#60A5FA",
  },
];

const stats = [];

/* ─── Component ─── */
const Landing = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const autoRef = useRef(null);


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

  const go = (dir) => {
    setCurrent((c) => (c + dir + slides.length) % slides.length);
    startAuto();
  };

  /* drag / swipe */
  const onDragStart = (e) => {
    dragStart.current = e.clientX ?? e.touches?.[0]?.clientX;
    setDragging(true);
  };
  const onDragEnd = (e) => {
    if (!dragging) return;
    const end = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const diff = dragStart.current - end;
    if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
    setDragging(false);
  };



  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(0);


  if (isLoading || user) return null;

  const slide = slides[current];
  const SlideIcon = slide.icon;

  return (
    <div
      style={{ fontFamily: "'Rubik', sans-serif" }}
      className="min-h-screen bg-[#050810] text-white selection:bg-blue-600 selection:text-white overflow-x-hidden"
    >

      {/* ── Ambient glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-blue-700/10 blur-[130px]" />
        <div className="absolute top-[60%] -right-32 w-[400px] h-[400px] rounded-full bg-blue-900/15 blur-[120px]" />
        {/* grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      {/* ── NAV ── */}

      <nav className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-2xl bg-[#050810]/80">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center group">
            <img src="/krovaa-logo.svg?v=2" alt="Krovaa Logo" className="h-16 w-auto" />
          </Link>


          <div className="hidden md:flex gap-8 text-sm font-medium text-white/40">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#carousel" className="hover:text-white transition-colors">Features</a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block">
              <Button variant="ghost" className="text-white/50 hover:text-white hover:bg-white/5 text-sm">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button className="bg-blue-600 hover:bg-blue-500 text-white text-sm shadow-lg shadow-blue-900/40 transition-all hover:shadow-blue-600/40 hover:scale-[1.02]">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-28 pb-20 md:pt-40 md:pb-28 px-6">
        <div className="max-w-5xl mx-auto text-center">

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-semibold text-blue-400 tracking-widest uppercase mb-10">
            <Zap className="h-3 w-3 fill-current" />
            Built for modern freelancers
          </div>

          <h1
            style={{ fontFamily: "'Rubik', sans-serif", lineHeight: 1.02 }}
            className="text-5xl sm:text-6xl md:text-[6rem] font-extrabold tracking-tight mb-8"
          >
            Chat.{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400">
                Pay.
              </span>
              <span className="absolute bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full" />
            </span>
            {" "}Deliver.
          </h1>

          <p className="text-lg md:text-xl text-white/40 mb-12 max-w-xl mx-auto leading-relaxed font-light">
            The platform where{" "}
            <span className="text-white/80 font-normal">conversations become contracts</span>
            {" "}— and work actually gets done.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/register">
              <Button
                size="lg"
                className="h-12 px-10 bg-blue-600 hover:bg-blue-500 text-white text-base shadow-2xl shadow-blue-900/50 transition-all hover:scale-[1.03] hover:shadow-blue-600/50"
              >
                Start for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="ghost"
                className="h-12 px-8 text-base border border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 text-white/60 hover:text-white transition-all"
              >
                Sign In
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/30">
            {["No credit card required", "Free forever plan", "Cancel anytime"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LOGO MARQUEE ── */}
      <div className="relative py-10 overflow-hidden border-y border-white/5 bg-white/[0.01]">
        <div className="flex w-[200%] animate-marquee">
          {[...slides, ...slides].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-4 px-12 shrink-0 group">
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-blue-600/10 transition-colors">
                  <Icon className="h-5 w-5 text-white/20 group-hover:text-blue-400 transition-colors" />
                </div>
                <span className="text-sm font-medium text-white/20 group-hover:text-white/60 transition-colors uppercase tracking-widest whitespace-nowrap">
                  {item.tag}
                </span>
              </div>
            );
          })}
        </div>
      </div>


      {/* ── STATS REMOVED ── */}

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase text-blue-400 mb-3">How It Works</p>
            <h2 style={{ fontFamily: "'Rubik', sans-serif" }} className="text-3xl md:text-4xl font-bold">
              Three steps to your next deal
            </h2>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="hidden md:block absolute top-8 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-blue-600/40 to-transparent" />
            {[
              { step: "01", title: "Create & Share", desc: "Set up your profile and share it with potential clients via link or QR code." },
              { step: "02", title: "Chat & Agree", desc: "Discuss the project in real-time and lock in the terms directly in chat." },
              { step: "03", title: "Deliver & Get Paid", desc: "Complete milestones, release funds, and build your reputation." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full border border-blue-600/40 bg-blue-600/10 flex items-center justify-center mb-6 z-10 relative">
                  <span style={{ fontFamily: "'Rubik', sans-serif" }} className="text-blue-400 font-extrabold text-lg">{step}</span>
                </div>
                <h3 className="text-base font-bold mb-2 text-white">{title}</h3>
                <p className="text-sm text-white/35 leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAROUSEL ── */}
      <section id="carousel" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-blue-400 mb-3">Features & Voices</p>
            <h2 style={{ fontFamily: "'Rubik', sans-serif" }} className="text-3xl md:text-4xl font-bold">
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
            <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#0a0f1e] relative">
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
                        className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none opacity-20"
                        style={{ background: s.accent }}
                      />
                      {/* Top accent bar */}
                      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)` }} />

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
                            style={{ fontFamily: "'Rubik', sans-serif", whiteSpace: "pre-line" }}
                            className="text-3xl md:text-4xl font-extrabold leading-tight mb-5 text-white"
                          >
                            {s.headline}
                          </h3>
                          <p className="text-white/40 text-base leading-relaxed max-w-md font-light">{s.body}</p>
                        </div>

                        <div className="shrink-0 flex items-center justify-center">
                          <div
                            className="w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center"
                            style={{ background: `${s.accent}15`, border: `1px solid ${s.accent}30` }}
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
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#050810]/60 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-blue-600 transition-all opacity-0 group-hover/carousel:opacity-100 backdrop-blur-md z-20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={() => go(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#050810]/60 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-blue-600 transition-all opacity-0 group-hover/carousel:opacity-100 backdrop-blur-md z-20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full z-10">
                <div
                  key={current}
                  className="h-full bg-blue-500 animate-progress"
                />
              </div>
            </div>

            {/* Manual Navigation Dots */}
            <div className="flex justify-center gap-2 mt-8">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrent(i); startAuto(); }}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === current ? "w-8 bg-blue-500" : "w-1.5 bg-white/10 hover:bg-white/20"
                    }`}
                />
              ))}
            </div>
          </div>


        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-28">
        <div className="max-w-4xl mx-auto rounded-3xl border border-blue-500/20 bg-[#070c1a] relative overflow-hidden text-center p-10 md:p-20">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-blue-700/10 blur-[100px] pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-semibold text-blue-400 tracking-widest uppercase mb-8">
              <Zap className="h-3 w-3 fill-current" />
              Free to start
            </div>

            <h2 style={{ fontFamily: "'Rubik', sans-serif" }} className="text-3xl md:text-5xl font-extrabold mb-5 tracking-tight">
              Ready to close your next deal?
            </h2>
            <p className="text-white/35 mb-10 text-base max-w-md mx-auto leading-relaxed font-light">
              Join thousands of freelancers using Krovaa to work faster, communicate clearly, and get paid on time.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button
                  size="lg"
                  className="h-12 px-10 text-base bg-blue-600 hover:bg-blue-500 text-white shadow-2xl shadow-blue-900/50 hover:shadow-blue-600/40 hover:scale-[1.03] transition-all"
                >
                  Create Your Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-base border-white/10 text-white/60 hover:text-white hover:bg-white/5 hover:border-blue-500/30 transition-all bg-transparent"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-6 pt-14 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <Link to="/" className="col-span-full flex flex-col items-center text-center gap-4 group">
              <div className="flex items-center">
                <span style={{ fontFamily: "'Rubik', sans-serif" }} className="text-2xl font-bold text-white group-hover:text-blue-500 transition-colors">Krovaa</span>
              </div>

              <p className="text-sm text-white/25 leading-relaxed max-w-xs font-light">
                Chat-first deal management for the modern gig economy.
              </p>
            </Link>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-white/5">
            <p className="text-xs text-white/20">© 2026 Krovaa &nbsp;·&nbsp; <a href="mailto:support@krovaa.com" className="hover:text-white transition-colors">support@krovaa.com</a></p>
            <div className="flex gap-6 text-xs text-white/20">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link to="/refund" className="hover:text-white transition-colors">Refund Policy</Link>
              <Link to="/cookie-policy" className="hover:text-white transition-colors">Cookie Policy</Link>
              <button
                onClick={() => { localStorage.removeItem("cookie_consent"); window.location.reload(); }}
                className="hover:text-white transition-colors"
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
