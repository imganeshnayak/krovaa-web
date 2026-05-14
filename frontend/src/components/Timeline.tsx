import { motion } from 'framer-motion';

export default function Timeline() {
  const steps = [
    { num: '01', title: 'Create & Share', desc: 'Set up your profile and share it with a link or QR code.' },
    { num: '02', title: 'Chat & Agree', desc: 'Discuss the project in real-time and lock terms in chat.' },
    { num: '03', title: 'Deliver & Get Paid', desc: 'Complete milestones, release funds, and build your reputation.' },
  ];

  return (
    <section id="how" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#00A4EF] mb-2">How It Works</p>
          <h2 className="text-3xl font-bold">Three steps to your next deal</h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <div className="absolute md:top-10 md:left-10 md:right-10 hidden md:block">
            <div className="h-px bg-gradient-to-r from-transparent via-[#E6E6E6] to-transparent" />
          </div>

          {steps.map((s, idx) => (
            <motion.div key={s.num} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.12 }} className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 text-[#00A4EF] font-extrabold bg-white border border-[#ECEFF1]">{s.num}</div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-slate-600 max-w-xs">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
