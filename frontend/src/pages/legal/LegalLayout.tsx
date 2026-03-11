import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface LegalLayoutProps {
  children: React.ReactNode;
  title: string;
  lastUpdated: string;
}

const LegalLayout = ({ children, title, lastUpdated }: LegalLayoutProps) => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${title} | Krovaa`;
  }, [title]);

  return (
    <div className="min-h-screen bg-[#050810] text-white selection:bg-blue-600 selection:text-white pb-20">
      {/* Background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-gradient-to-b from-blue-600/5 to-transparent" />
        <div className="absolute top-[20%] -right-20 w-[400px] h-[400px] rounded-full bg-blue-900/10 blur-[130px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#050810]/60 h-20 flex items-center">
        <div className="w-full px-4 md:px-8 flex items-center justify-between">
          <Link to="/" className="flex items-center group shrink-0 -ml-2 sm:-ml-0">
            <img src="/krovaa-logo.svg?v=3" alt="Krovaa Logo" className="h-16 w-auto scale-125 origin-left" />
          </Link>
          <Link 
            to="/" 
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors uppercase tracking-widest font-semibold"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="relative max-w-3xl mx-auto px-6 pt-16 md:pt-24">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">{title}</h1>
          <p className="text-sm text-white/30 tracking-wide uppercase font-medium">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-invert max-w-none prose-p:text-white/60 prose-p:leading-relaxed prose-p:font-light prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight prose-li:text-white/60 prose-li:font-light prose-strong:text-white prose-strong:font-semibold">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 pt-10 border-t border-white/5 text-center">
        <p className="text-xs text-white/20 uppercase tracking-[0.2em]">© 2026 Krovaa · support@krovaa.com</p>
      </footer>

      <style>{`
        .prose h2 {
          font-size: 1.5rem;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 0.5rem;
        }
        .prose p {
          margin-bottom: 1.25rem;
        }
        .prose ul {
          margin-bottom: 1.5rem;
          padding-left: 1.25rem;
        }
        .prose li {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
};

export default LegalLayout;
