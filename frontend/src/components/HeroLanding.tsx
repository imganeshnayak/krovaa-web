import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const statVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export default function HeroLanding() {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 px-6 md:px-8">
      {/* Background Glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-gradient-to-tr from-[#00A4EF] to-[#007BB5] opacity-5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Main Content - Grid Layout for Perfect Alignment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 lg:gap-12 xl:gap-16 items-start md:items-center">
          {/* Left Section - Text Content */}
          <div className="flex flex-col justify-start pt-4 md:pt-0">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-6 bg-white/10 text-[#00A4EF] border border-white/10 w-fit">
                <CheckCircle2 className="w-3 h-3" />
                Built for freelance teams
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[1.1] text-[#0A0E27] mb-8">
                Chat.
                <span className="mx-2 bg-clip-text text-transparent bg-gradient-to-r from-[#00A4EF] via-[#0097db] to-[#007BB5]">Pay.</span>
                Deliver.
              </h1>

              <p className="text-lg md:text-xl text-slate-600 max-w-xl mb-12 leading-relaxed font-light">The platform where conversations become contracts — and work actually gets done. Real-time chat, milestone payments, and clear deliverables.</p>

              <div className="flex flex-wrap gap-4 mb-12">
                <Link to="/register">
                  <button className="inline-flex items-center gap-2 bg-[#00A4EF] hover:bg-[#0097db] text-white px-5 py-3 rounded-lg font-semibold shadow-lg transition-transform transform hover:-translate-y-0.5">
                    Start for free
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link to="/login">
                  <button className="inline-flex items-center gap-2 border border-slate-200 px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-50 transition">Sign in</button>
                </Link>
              </div>

              <motion.div className="flex flex-wrap gap-6 sm:gap-8 text-sm text-slate-500" initial="hidden" animate="show" transition={{ staggerChildren: 0.08 }}>
                <motion.div variants={statVariants} className="inline-flex items-center gap-2">
                  <span className="font-semibold text-slate-800">100k+</span>
                  <span className="hidden sm:inline">freelancers</span>
                  <span className="sm:hidden">users</span>
                </motion.div>
                <motion.div variants={statVariants} className="inline-flex items-center gap-2">
                  <span className="font-semibold text-slate-800">4.9</span>
                  <span className="hidden sm:inline">avg. rating</span>
                  <span className="sm:hidden">rating</span>
                </motion.div>
                <motion.div variants={statVariants} className="inline-flex items-center gap-2">
                  <span className="font-semibold text-slate-800">$120M+</span>
                  <span className="hidden sm:inline">processed</span>
                  <span className="sm:hidden">paid</span>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>

          {/* Right Section - Card Content - Responsive Sizing */}
          <div className="flex-1 min-w-0 flex justify-center lg:justify-end w-full">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 8 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              transition={{ type: 'spring', stiffness: 120, damping: 18 }} 
              className="relative w-full max-w-sm lg:max-w-md"
            >
              {/* Glassmorphic Card */}
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

              {/* Floating Glow Effect - Positioned to Not Overlap */}
              <motion.div 
                animate={{ y: [0, -8, 0] }} 
                transition={{ repeat: Infinity, duration: 4 }} 
                className="absolute -right-12 -top-12 w-48 h-48 rounded-2xl bg-gradient-to-tr from-[#00A4EF] to-[#0FB881] opacity-10 blur-3xl pointer-events-none"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
