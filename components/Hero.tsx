"use client";

import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck, CheckCircle2, MapPin, type LucideIcon } from "lucide-react";
import { DeviceMock } from "./DeviceMock";

const trustItems: { Icon: LucideIcon; label: string }[] = [
  { Icon: CheckCircle2, label: "Production-style UX" },
  { Icon: MapPin, label: "Zimbabwe-first data" },
  { Icon: CalendarCheck, label: "Launch partner demos" }
];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-heroGlow pb-24 pt-32 lg:pb-32 lg:pt-40">
      <div className="absolute inset-0 -z-10 bg-grid blueprint-grid opacity-70" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center gap-2 rounded-full border border-spotly-100 bg-white px-4 py-2 text-sm font-bold text-spotly-700 shadow-sm"
          >
            <CalendarCheck className="h-4 w-4" /> Launching 2026
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08 }}
            className="mt-7 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-ink sm:text-6xl lg:text-7xl"
          >
            Discover, book, order, and plan everything in one spot.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.16 }}
            className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slateSoft"
          >
            Spotly is a clean lifestyle marketplace for Zimbabwe: food, groceries, events, healthcare, gifts, beauty, wellness, activities, and staycations built around clear discovery and working booking flows.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.24 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <a href="#product" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-spotly-700 px-6 py-4 text-base font-black text-white shadow-green transition hover:bg-spotly-800">
              View product direction <ArrowRight className="h-5 w-5" />
            </a>
            <a href="#partners" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-6 py-4 text-base font-black text-ink shadow-sm transition hover:border-spotly-200 hover:text-spotly-700">
              Partner pipeline
            </a>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.65, delay: 0.34 }}
            className="mt-8 grid max-w-2xl gap-3 text-sm font-bold text-slateSoft sm:grid-cols-3"
          >
            {trustItems.map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-2 rounded-2xl border border-line bg-white/80 px-4 py-3">
                <Icon className="h-4 w-4 text-spotly-700" />
                {label}
              </div>
            ))}
          </motion.div>
        </div>
        <DeviceMock />
      </div>
    </section>
  );
}
