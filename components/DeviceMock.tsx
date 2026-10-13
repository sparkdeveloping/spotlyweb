"use client";

import { motion } from "framer-motion";
import { Bell, CalendarDays, Heart, Home, MapPin, Search, ShoppingBasket, Sparkles, UserRound, Utensils } from "lucide-react";

const categoryIcons = [
  { label: "Food", Icon: Utensils },
  { label: "Groceries", Icon: ShoppingBasket },
  { label: "Events", Icon: CalendarDays },
  { label: "Activities", Icon: Sparkles }
];

export function DeviceMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[390px] rounded-[2.4rem] border border-white bg-white p-3 phone-shadow"
    >
      <div className="overflow-hidden rounded-[2rem] border border-line bg-[#fbfbf8]">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div>
            <p className="text-sm font-bold text-slateSoft">Good morning 👋</p>
            <p className="text-xl font-extrabold tracking-tight text-ink">Bulawayo, Zimbabwe</p>
          </div>
          <div className="relative rounded-2xl border border-line bg-white p-3 shadow-sm">
            <Bell className="h-5 w-5 text-ink" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-spotly-600" />
          </div>
        </div>
        <div className="mx-5 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-4 text-slateSoft shadow-sm">
          <Search className="h-5 w-5" />
          <span className="text-sm font-semibold">Search restaurants, events...</span>
        </div>
        <div className="grid grid-cols-4 gap-3 px-5 py-6">
          {categoryIcons.map(({ label, Icon }) => (
            <div key={label} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-spotly-50 text-spotly-700 ring-1 ring-spotly-100">
                <Icon className="h-6 w-6" />
              </div>
              <p className="mt-2 text-xs font-bold text-slateSoft">{label}</p>
            </div>
          ))}
        </div>
        <div className="mx-5 overflow-hidden rounded-card bg-ink shadow-card">
          <div className="h-40 bg-gradient-to-br from-spotly-950 via-spotly-800 to-emerald-500" />
          <div className="p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-spotly-300">Featured</p>
            <h3 className="mt-2 text-2xl font-black">Namaste Harare</h3>
            <p className="mt-1 text-sm text-white/72">Contemporary dining with a Zim soul</p>
          </div>
        </div>
        <div className="px-5 py-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="text-xl font-black text-ink">Popular near you</h3>
              <p className="text-sm font-semibold text-slateSoft">Top rated spots in your city</p>
            </div>
            <span className="text-sm font-black text-spotly-700">See all</span>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {["Food Lovers", "Vertex Spa"].map((title, index) => (
              <div key={title} className="min-w-[170px] overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                <div className={index === 0 ? "h-24 bg-orange-100" : "h-24 bg-emerald-100"} />
                <div className="p-3">
                  <p className="font-black text-ink">{title}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slateSoft">
                    <MapPin className="h-3.5 w-3.5" /> 1.2 km
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-5 mb-5 flex justify-around rounded-full border border-line bg-white/90 px-4 py-3 shadow-soft">
          {[Home, Search, CalendarDays, Heart, UserRound].map((Icon, index) => (
            <div key={index} className={index === 0 ? "rounded-full bg-spotly-50 p-2 text-spotly-700" : "p-2 text-ink"}>
              <Icon className="h-5 w-5" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
