"use client";

import { motion } from "framer-motion";
import { navigation } from "@/data/site";
import { SpotlyLogo } from "./SpotlyLogo";

export function NavBar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed left-0 right-0 top-0 z-50 border-b border-white/50 bg-paper/86 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <a href="#top" aria-label="Spotly home">
          <SpotlyLogo />
        </a>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slateSoft md:flex">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} className="transition hover:text-spotly-700">
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href="#launch"
          className="rounded-full bg-spotly-700 px-5 py-3 text-sm font-bold text-white shadow-green transition hover:bg-spotly-800"
        >
          Launch 2026
        </a>
      </div>
    </motion.header>
  );
}
