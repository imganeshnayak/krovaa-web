import React, { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

import Logo from "@/components/Logo";

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
    <div className="min-h-screen bg-white text-[#1C1C1C] pb-20">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#E0E0E0] bg-white h-20 flex items-center">
        <div className="w-full px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/" className="flex items-center mr-4">
              <ChevronLeft className="h-6 w-6 text-[#1C1C1C]" />
            </Link>
            <Link to="/" className="flex items-center group shrink-0 -ml-2 sm:-ml-0">
              <Logo size="lg" className="scale-125 origin-left" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="relative max-w-3xl mx-auto px-6 pt-16 md:pt-24">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">{title}</h1>
          <p className="text-sm text-[#1C1C1C]/30 tracking-wide uppercase font-medium">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose max-w-none prose-p:text-[#1C1C1C]/60 prose-p:leading-relaxed prose-p:font-light prose-headings:text-[#1C1C1C] prose-headings:font-bold prose-headings:tracking-tight prose-li:text-[#1C1C1C]/60 prose-li:font-light prose-strong:text-[#1C1C1C] prose-strong:font-semibold">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 pt-10 border-t-2 border-[#E0E0E0] bg-gradient-to-b from-[#FFFFFF] to-[#FAFAFA] text-center">
        <p className="text-xs text-[#1C1C1C50]">© 2026 Krovaa · support@krovaa.com</p>
      </footer>

      <style>{`
        .prose h2 {
          font-size: 1.5rem;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(0,0,0,0.05);
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
