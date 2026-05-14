import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export default function FeatureCard({ Icon, tag, title, body, accent }: { Icon: LucideIcon, tag: string, title: string, body: string, accent?: string }) {
  return (
    <motion.div whileHover={{ y: -6 }} className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition p-6 border border-[#F0F2F5]">
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: `${accent}10`, border: `1px solid ${accent}20` }}>
            <Icon className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{tag}</div>
        </div>
      </div>

      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </motion.div>
  );
}
