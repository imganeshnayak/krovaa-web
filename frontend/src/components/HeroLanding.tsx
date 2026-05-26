import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import landingContent from '../../content/landing.json';

export default function HeroLanding() {
  const { hero } = landingContent;

  return (
    <section className="relative overflow-hidden pt-16 pb-24 px-6 md:px-8">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-gradient-to-tr from-[#00A4EF] to-[#007BB5] opacity-5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 lg:gap-12 xl:gap-16 items-start md:items-center">
          <div className="flex flex-col justify-start pt-4 md:pt-0 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-6 bg-white/10 text-[#00A4EF] border border-white/10 w-fit">
              <CheckCircle2 className="w-3 h-3" />
              {hero.tagline}
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[1.1] text-[#0A0E27] mb-8">
              {hero.title}
              <span className="mx-2 bg-clip-text text-transparent bg-gradient-to-r from-[#00A4EF] via-[#0097db] to-[#007BB5]">
                {hero.highlightTitle}
              </span>
              {hero.subtitle}
            </h1>

            <p className="text-lg md:text-xl text-slate-600 max-w-xl mb-12 leading-relaxed font-light">
              {hero.description}
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <Link to="/register">
                <button className="inline-flex items-center gap-2 bg-[#00A4EF] hover:bg-[#0097db] text-white px-5 py-3 rounded-lg font-semibold shadow-lg transition-transform transform hover:-translate-y-0.5">
                  {hero.ctaPrimary}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link to="/login">
                <button className="inline-flex items-center gap-2 border border-slate-200 px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-50 transition">
                  {hero.ctaSecondary}
                </button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 sm:gap-8 text-sm text-slate-500">
              <div className="inline-flex items-center gap-2">
                <span className="font-semibold text-slate-800">{hero.stats.users}</span>
                <span className="hidden sm:inline">{hero.stats.usersLabel}</span>
                <span className="sm:hidden">users</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="font-semibold text-slate-800">{hero.stats.rating}</span>
                <span className="hidden sm:inline">{hero.stats.ratingLabel}</span>
                <span className="sm:hidden">rating</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="font-semibold text-slate-800">{hero.stats.processed}</span>
                <span className="hidden sm:inline">{hero.stats.processedLabel}</span>
                <span className="sm:hidden">paid</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center md:justify-end w-full animate-fade-in-up-delay">
            <div className="relative w-full max-w-sm">
              <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/20 shadow-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs text-slate-600 font-medium">Project • Payment</div>
                  <div className="text-xs text-slate-500">2:14 PM</div>
                </div>
                <div className="space-y-3">
                  <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">Design files attached</div>
                    <div className="text-xs text-slate-500">Alice sent 3 files • 2 MB</div>
                  </div>
                  <div className="p-3 sm:p-4 bg-gradient-to-r from-white to-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-900">Milestone payment</div>
                      <div className="text-sm font-semibold text-[#00A4EF]">$1,200</div>
                    </div>
                    <div className="text-xs text-slate-500">Release when approved</div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-12 -top-12 w-48 h-48 rounded-2xl bg-gradient-to-tr from-[#00A4EF] to-[#0FB881] opacity-10 blur-3xl pointer-events-none animate-float" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
