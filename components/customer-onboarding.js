"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, LocateFixed, MapPin, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui";
import { MARKETPLACE_SERVICES } from "@/components/marketplace-home";
import { ServiceArtwork, ServiceGlyph } from "@/components/service-artwork";
import { cn } from "@/lib/cn";

const interestOptions = [
  { id: "eat", label: "Food & drink" },
  { id: "shop", label: "Shopping" },
  { id: "wellness", label: "Beauty & wellness" },
  { id: "activities", label: "Things to do" },
  { id: "events", label: "Events" },
  { id: "ride", label: "Getting around" },
  { id: "send", label: "Sending things" },
  { id: "groceries", label: "Groceries" }
];

export function CustomerOnboarding({ open, cities = ["Harare"], initialCity = "Harare", signedIn = false, onClose, onComplete, onLocate, locating = false }) {
  const [step, setStep] = useState(0);
  const [city, setCity] = useState(initialCity);
  const [interests, setInterests] = useState([]);
  const [home, setHome] = useState("");
  const [work, setWork] = useState("");
  const totalSteps = signedIn ? 4 : 5;
  const progress = useMemo(() => ((step + 1) / totalSteps) * 100, [step, totalSteps]);
  if (!open) return null;
  function toggleInterest(id) { setInterests((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function finish(signIn = false) {
    await onComplete?.({ city, interests, home, work, onboardingVersion: 7 });
    if (signIn && typeof window !== "undefined") window.location.assign("/login?next=%2F");
  }
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[var(--overlay)] p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Set up Spotly">
    <motion.div initial={{ opacity: 0, y: 28, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative flex max-h-[94vh] w-full max-w-[880px] flex-col overflow-hidden rounded-t-[24px] bg-[var(--surface)] shadow-elevated sm:rounded-[24px]">
      <div className="h-1 bg-[var(--surface-2)]"><motion.div className="h-full bg-[var(--accent)]" animate={{ width: `${progress}%` }} /></div>
      <div className="flex items-center justify-between px-5 pt-4 sm:px-7"><div className="text-xs font-semibold text-[var(--text-3)]">Set up Spotly · {step + 1} of {totalSteps}</div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-[12px] text-[var(--text-2)] hover:bg-[var(--surface-hover)]" aria-label="Skip setup"><X className="h-5 w-5" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3 sm:px-8 sm:pb-7">
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 ? <motion.section key="intro" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="grid items-center gap-7 py-4 lg:grid-cols-[1fr_330px]">
            <div><p className="text-sm font-semibold text-[var(--accent)]">Welcome to Spotly</p><h1 className="mt-2 text-[38px] font-semibold leading-[1.02] tracking-[-.055em] sm:text-[50px]">Your city, in one place.</h1><p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--text-2)]">Order food, shop nearby, book services, find events, request rides and send things with businesses and Drivers around you.</p><div className="mt-6 flex flex-wrap gap-2">{MARKETPLACE_SERVICES.map((service) => <span key={service.key} className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold"><ServiceGlyph service={service.key} className="h-4 w-4 text-[var(--accent)]" />{service.label}</span>)}</div></div>
            <div className="relative mx-auto h-[290px] w-full max-w-[330px] overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,var(--accent-soft),var(--surface-2))]"><ServiceArtwork service="ride" className="absolute -right-3 top-2 opacity-75" /><ServiceArtwork service="eat" className="absolute -left-6 bottom-2 scale-[.88] opacity-80" /><ServiceArtwork service="send" compact className="absolute bottom-10 right-14 opacity-75" /></div>
          </motion.section> : null}
          {step === 1 ? <motion.section key="location" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="mx-auto max-w-2xl py-4"><span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[var(--accent-soft)] text-[var(--accent)]"><MapPin className="h-6 w-6" /></span><h1 className="mt-5 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Where do you usually use Spotly?</h1><p className="mt-3 text-sm leading-6 text-[var(--text-2)]">Your city helps us show what is actually available. You can change it any time.</p><div className="mt-6 grid gap-2 sm:grid-cols-2">{cities.map((value) => <button key={value} type="button" onClick={() => setCity(value)} className={cn("flex min-h-14 items-center justify-between rounded-[16px] border px-4 text-left font-semibold transition", city === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]")}><span>{value}</span>{city === value ? <Check className="h-5 w-5" /> : null}</button>)}</div><Button variant="outline" className="mt-4 w-full" onClick={onLocate} loading={locating}><LocateFixed className="h-4 w-4" />Use my location</Button><p className="mt-2 text-xs leading-5 text-[var(--text-3)]">Spotly asks the browser for location only after you choose this option.</p></motion.section> : null}
          {step === 2 ? <motion.section key="interests" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="mx-auto max-w-3xl py-4"><h1 className="text-3xl font-semibold tracking-[-.045em] sm:text-4xl">What would you like Spotly to help with?</h1><p className="mt-3 text-sm leading-6 text-[var(--text-2)]">Pick as many as you like. This changes recommendations, not what you can access.</p><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{interestOptions.map((item) => { const active = interests.includes(item.id); const service = ["eat","shop","events","ride","send"].includes(item.id) ? item.id : item.id === "wellness" ? "book" : item.id === "activities" ? "events" : "shop"; return <button key={item.id} type="button" onClick={() => toggleInterest(item.id)} className={cn("relative min-h-28 overflow-hidden rounded-[16px] border p-3 text-left transition", active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]")}><ServiceGlyph service={service} className={cn("h-5 w-5", active ? "text-[var(--accent)]" : "text-[var(--text-2)]")} /><span className="mt-7 block text-sm font-semibold">{item.label}</span>{active ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]"><Check className="h-3.5 w-3.5" /></span> : null}</button>; })}</div></motion.section> : null}
          {step === 3 ? <motion.section key="places" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="mx-auto max-w-2xl py-4"><h1 className="text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Make everyday trips quicker.</h1><p className="mt-3 text-sm leading-6 text-[var(--text-2)]">Home and Work are optional. They become useful for Ride, Send and nearby recommendations.</p><div className="mt-6 grid gap-4"><label className="text-sm font-semibold">Home<input value={home} onChange={(event) => setHome(event.target.value)} className="field-control mt-2" placeholder="Address, building or landmark" /></label><label className="text-sm font-semibold">Work<input value={work} onChange={(event) => setWork(event.target.value)} className="field-control mt-2" placeholder="Address, building or landmark" /></label></div><div className="mt-6 rounded-[16px] bg-[var(--surface-2)] p-4 text-sm leading-6 text-[var(--text-2)]">Spotly can continue learning through useful prompts later. You do not need to configure everything now.</div></motion.section> : null}
          {!signedIn && step === 4 ? <motion.section key="account" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="mx-auto max-w-2xl py-4"><span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[var(--accent-soft)] text-[var(--accent)]"><UserRound className="h-6 w-6" /></span><h1 className="mt-5 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Keep your Spotly with you.</h1><p className="mt-3 text-sm leading-7 text-[var(--text-2)]">An account keeps Saved, Activity, preferences, bookings, rides and orders available across your devices. You can also keep exploring first.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><Button onClick={() => finish(true)}>Finish & sign in<ArrowRight className="h-4 w-4" /></Button><Button variant="outline" onClick={() => finish(false)}>Continue exploring</Button></div><p className="mt-3 text-xs leading-5 text-[var(--text-3)]">Spotly does not require an account just to understand what is around you.</p></motion.section> : null}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-5 py-4 sm:px-7"><Button variant="ghost" onClick={() => step ? setStep(step - 1) : onClose()}><ArrowLeft className="h-4 w-4" />{step ? "Back" : "Explore first"}</Button>{step < totalSteps - 1 ? <Button onClick={() => setStep(step + 1)}>Continue<ArrowRight className="h-4 w-4" /></Button> : signedIn ? <Button onClick={() => finish(false)}>Finish setup<Check className="h-4 w-4" /></Button> : <span className="text-xs font-medium text-[var(--text-3)]">Choose how to continue above</span>}</div>
    </motion.div>
  </div>;
}
