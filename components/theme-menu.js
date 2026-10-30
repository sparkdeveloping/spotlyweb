"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers";

const options = [
  { value: "system", label: "System", icon: Laptop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon }
];

/** Uses the existing browser/shared-cookie preference; no account mutation. */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trigger = useRef(null);
  const id = useId();
  const Icon = options.find(option => option.value === theme)?.icon || Laptop;

  useEffect(() => {
    if (!open) return;
    function outside(event) { if (!ref.current?.contains(event.target)) setOpen(false); }
    function escape(event) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div ref={ref} className="relative shrink-0">
    <button ref={trigger} type="button" aria-label="Appearance" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)} className="surface flex h-11 w-11 items-center justify-center rounded-[14px] hover:bg-[var(--surface-2)]"><Icon className="h-5 w-5" aria-hidden="true" /></button>
    <AnimatePresence>{open ? <motion.div id={id} role="group" aria-label="Choose appearance" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="surface absolute right-0 top-[calc(100%+8px)] z-50 w-44 rounded-[18px] p-2 shadow-elevated">
      {options.map(option => { const OptionIcon = option.icon; return <button key={option.value} type="button" aria-pressed={theme === option.value} onClick={() => { setTheme(option.value); setOpen(false); trigger.current?.focus(); }} className="flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm hover:bg-[var(--surface-2)]"><OptionIcon className="h-4 w-4" aria-hidden="true" /><span className="flex-1 text-left font-medium">{option.label}</span>{theme === option.value ? <Check className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" /> : null}</button>; })}
    </motion.div> : null}</AnimatePresence>
  </div>;
}
