import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import landingContent from '../../content/landing.json';

export default function HeroLanding() {
  const { hero } = landingContent;

  return (
    <section className="relative overflow-hidden pt-12 md:pt-16 pb-20 md:pb-24 px-4 sm:px-6 md:px-8 w-full">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-full max-w-[700px] h-[400px] rounded-full bg-gradient-to-tr from-[#00A4EF] to-[#007BB5] opacity-5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-10 lg:gap-12 xl:gap-16 items-start md:items-center">
          
          {/* Left Text Block */}
          <div className="flex flex-col justify-start pt-2 md:pt-0 animate-fade-in-up w-full">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold tracking-widest uppercase mb-6 bg-slate-100 text-[#00A4EF] border border-slate-200/60 w-fit">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              {hero.tagline}
            </div>

            {/* ── FIXED RESPONSIVE HEADING ── */}
            <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-[1.15] text-[#0A0E27] mb-6 md:mb-8 break-words text-balance">
              <span className="inline-block">{hero.title}</span>
              <span className="inline-block mx-1.5 sm:mx-2 bg-clip-text text-transparent bg-gradient-to-r from-[#00A4EF] via-[#0097db] to-[#007BB5]">
                {hero.highlightTitle}
              </span>
              {/* Forces 'Deliver.' onto a clean line on mobile devices */}
              <span className="block sm:inline mt-1 sm:mt-0">{hero.subtitle}</span>
            </h1>

            <p className="text-base md:text-lg lg:text-xl text-slate-600 max-w-xl mb-8 md:mb-12 leading-relaxed font-light px-0.5 text-balance">
              {hero.description}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-10 md:mb-12 items-stretch sm:items-center max-w-xs sm:max-w-none">
              <Link to="/register" className="w-full sm:w-auto">
                <button className="inline-flex items-center justify-center gap-2 bg-[#00A4EF] hover:bg-[#0097db] text-white px-5 py-3 rounded-lg font-semibold shadow-lg transition-transform transform active:scale-95 sm:hover:-translate-y-0.5 w-full sm:w-auto text-sm md:text-base">
                  {hero.ctaPrimary}
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <button className="inline-flex items-center justify-center gap-2 border border-slate-200 px-5 py-3 rounded-lg text-slate-700 hover:bg-slate-50 transition w-full sm:w-auto text-sm md:text-base">
                  {hero.ctaSecondary}
                </button>
              </Link>
            </div>

            {/* Stats Meta Row */}
            <div className="flex flex-wrap gap-4 sm:gap-8 text-xs sm:text-sm text-slate-500 border-t border-slate-100 pt-6 md:pt-0 md:border-0">
              <div className="inline-flex items-center gap-1.5">
                <span className="font-bold text-slate-800">{hero.stats.users}</span>
                <span className="hidden sm:inline text-slate-500">{hero.stats.usersLabel}</span>
                <span className="sm:hidden text-slate-400">users</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <span className="font-bold text-slate-800">{hero.stats.rating}</span>
                <span className="hidden sm:inline text-slate-500">{hero.stats.ratingLabel}</span>
                <span className="sm:hidden text-slate-400">rating</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <span className="font-bold text-slate-800">{hero.stats.processed}</span>
                <span className="hidden sm:inline text-slate-500">{hero.stats.processedLabel}</span>
                <span className="sm:hidden text-slate-400">paid</span>
              </div>
            </div>
          </div>

          {/* Right Card Graphic Block */}
          <div className="flex justify-center md:justify-end w-full animate-fade-in-up-delay mt-6 md:mt-0">
            <div className="relative w-full max-w-sm px-2 sm:px-0">
              <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/50 shadow-xl md:shadow-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[11px] sm:text-xs text-slate-500 font-medium tracking-wide">Project • Payment</div>
                  <div className="text-[11px] sm:text-xs text-slate-400">2:14 PM</div>
                </div>
                <div className="space-y-3">
                  <div className="p-3 sm:p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">Design files attached</div>
                    <div className="text-xs text-slate-400 mt-0.5">Alice sent 3 files • 2 MB</div>
                  </div>
                  <div className="p-3 sm:p-4 bg-gradient-to-r from-white to-slate-50 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-900">Milestone payment</div>
                      <div className="text-sm font-bold text-[#00A4EF]">$1,200</div>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Release when approved</div>
                  </div>
                </div>
              </div>

              {/* Decorative Ambient Background Glow Blur */}
              <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full bg-gradient-to-tr from-[#00A4EF] to-[#0FB881] opacity-10 blur-2xl pointer-events-none hidden sm:block" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}