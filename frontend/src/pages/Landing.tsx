import { Link, useNavigate } from "react-router-dom";
import {
  MessageSquare, Shield, Share2, IndianRupee,
  ArrowRight, Zap, Mail, Github, Linkedin, Twitter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import React, { Suspense, useEffect, useState, useRef } from "react";
import Logo from "@/components/Logo";
import HeroLanding from "@/components/HeroLanding";
import Navbar from "@/components/Navbar";
import landingContent from "../../content/landing.json";

const Timeline = React.lazy(() => import("@/components/Timeline"));
const FeaturesCarousel = React.lazy(() => import("@/components/FeaturesCarousel"));

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

  const startAuto = () => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000);
  };

  useEffect(() => {
    startAuto();
    return () => clearInterval(autoRef.current);
  }, []);

  const go = (dir: number) => {
    setCurrent((c) => (c + dir + slides.length) % slides.length);
    startAuto();
  };

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

  if (user) return null;

  return (
    <div className="min-h-screen bg-white text-[#1C1C1C] selection:bg-[#00A4EF] selection:text-white overflow-x-hidden font-rubik">

      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[130px] bg-[#00A4EF08]" />
        <div className="absolute top-[60%] -right-32 w-[400px] h-[400px] rounded-full blur-[120px] bg-[#0FB88108]" />
        <div className="absolute inset-0 opacity-[0.02] bg-grid-pattern" />
      </div>

      <Navbar />
      <HeroLanding />

      {/* LOGO MARQUEE - Fixed for mobile */}
      <div className="relative py-8 md:py-10 overflow-hidden border-y border-[#E0E0E0] bg-[#F5F5F5]">
        <div className="flex w-[200%] animate-marquee">
          {[...slides, ...slides].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx} 
                className="flex items-center gap-3 px-5 md:px-12 shrink-0 group"
              >
                <div className="p-2 rounded-lg bg-white border border-[#E0E0E0]">
                  <Icon className="h-5 w-5 text-[#1C1C1C40]" />
                </div>
                <span className="text-[13px] md:text-sm font-medium text-[#1C1C1C60] group-hover:text-[#1C1C1C] 
                               uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                  {item.tag}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-gray-500">Loading timeline...</div>}>
        <Timeline />
      </Suspense>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-20 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#00A4EF] mb-2">Features & Voices</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight md:leading-none px-2 text-balance">
              Everything you need. Nothing you don't.
            </h2>
          </div>

          <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-gray-500">Loading features...</div>}>
            <FeaturesCarousel items={slides} />
          </Suspense>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 md:px-6 py-20 md:py-28">
        <div className="rounded-2xl relative overflow-hidden text-center p-8 md:p-20 bg-cta-gradient">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[2px] bg-cta-line" />

          <div className="relative z-10 text-white">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs font-semibold tracking-widest uppercase mb-8 border border-white/40 bg-white/10">
              <Zap className="h-3 w-3" />
              {landingContent.cta.tag}
            </div>

            <h2 className="text-4xl md:text-5xl font-extrabold mb-5 leading-[1.05] tracking-tighter px-2 text-balance">
              {landingContent.cta.title}
            </h2>
            
            <p className="text-white/80 mb-10 text-base max-w-md mx-auto leading-relaxed font-light px-2">
              {landingContent.cta.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-12 px-8 md:px-10 text-base font-semibold transition-all hover:scale-[1.03] bg-white text-[#00A4EF] shadow-[0_4px_12px_rgba(0,164,239,0.2)] w-full sm:w-auto"
                >
                  {landingContent.cta.ctaPrimary}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-base border-white text-white hover:bg-white/10 transition-all bg-transparent w-full sm:w-auto"
                >
                  {landingContent.cta.ctaSecondary}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Mobile Optimized */}
      <footer className="border-t-2 border-[#E0E0E0] bg-gradient-to-b from-[#FFFFFF] to-[#FAFAFA]">
        <div className="w-full px-4 md:px-8 py-12 md:py-14">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-6 mb-10">
              {/* Brand */}
              <div className="col-span-1 md:col-span-5">
                <Link to="/" className="flex items-center gap-2 mb-4">
                  <Logo size="md" theme="dark" />
                </Link>
                <p className="text-sm md:text-xs text-[#1C1C1C70] leading-relaxed font-light mb-6 max-w-sm break-words">
                  {landingContent.footer.tagline}
                </p>

                <div className="flex gap-2">
                  {[
                    { icon: Mail, href: "mailto:support@krovaa.com", label: "Email" },
                    { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
                    { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
                    { icon: Github, href: "https://github.com", label: "GitHub" },
                  ].map(({ icon: Icon, href, label }) => (
                    <a
                      key={label}
                      href={href}
                      className="p-3 rounded-xl bg-[#F0F0F0] hover:bg-[#00A4EF] text-[#454545] hover:text-white transition-all"
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Links */}
              <div className="col-span-1 md:col-span-7 grid grid-cols-2 gap-8 md:gap-6">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0E27] mb-3 uppercase tracking-widest">Company</h3>
                  <ul className="space-y-2 text-sm md:text-xs text-[#1C1C1C70]">
                    <li><a href="#" className="hover:text-[#00A4EF]">About Us</a></li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#0A0E27] mb-3 uppercase tracking-widest">Legal</h3>
                  <ul className="space-y-2 text-sm md:text-xs text-[#1C1C1C70]">
                    {landingContent.footer.legal.map((link) => (
                      <li key={link}>
                        <Link
                          to={link === "Privacy Policy" ? "/privacy" : link === "Terms of Service" ? "/terms" : "/cookie-policy"}
                          className="hover:text-[#00A4EF] transition-colors"
                        >
                          {link}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-[#E0E0E0] to-transparent my-8" />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#1C1C1C50]">
              <p className="font-medium">© {landingContent.footer.copyright}</p>
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

      {/* Keyframes */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 35s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Landing;