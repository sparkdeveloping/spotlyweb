"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { portals } from "@/data/portals";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/cn";

export function LoginApp({ initialPortal = "customer" }) {
  const [portalId, setPortalId] = useState(portals[initialPortal] ? initialPortal : "customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const portal = portals[portalId];

  async function signIn(event) {
    event.preventDefault();
    setLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    setLoading(false);
    toast(`Signed into ${portal.name} demo workspace.`, { title: "Welcome back" });
    window.location.href = portal.href;
  }

  const style = { "--accent": portal.accent, "--accent-strong": portal.accentStrong, "--accent-soft": portal.accentSoft };

  return (
    <main style={style} className="portal-gradient flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-6xl">
        <Link href="/" className="mx-auto mb-7 flex w-fit items-center gap-3"><Image src="/brand/spotly.png" alt="Spotly" width={48} height={48} className="h-12 w-12 rounded-2xl object-cover" /><span className="text-xl font-bold">Spotly</span></Link>
        <Card elevated className="grid overflow-hidden lg:grid-cols-[.9fr_1.1fr]">
          <div className="relative hidden min-h-[680px] overflow-hidden bg-gradient-to-br from-[var(--accent-strong)] via-[var(--accent)] to-violet-500 p-10 text-white lg:flex lg:flex-col">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-black/10 blur-2xl" />
            <div className="relative"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">One platform · four apps</p><h1 className="mt-5 text-5xl font-bold leading-[1.03] tracking-[-0.045em]">The right Spotly workspace for every role.</h1><p className="mt-5 max-w-md text-base leading-7 text-white/75">Customers discover. Businesses operate. Drivers deliver. Admin teams keep the marketplace safe and reliable.</p></div>
            <div className="relative mt-auto space-y-3">{["Shared family design system", "Role-specific navigation and permissions", "Production-ready Firebase connection layer"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[var(--accent)]"><Check className="h-4 w-4" /></span><span className="text-sm font-semibold">{item}</span></div>)}</div>
          </div>
          <div className="p-5 sm:p-8 lg:p-10">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Secure access</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.035em]">Sign in to Spotly</h2><p className="mt-2 text-sm leading-6 text-secondary">Choose a workspace, then use your assigned account.</p></div>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.values(portals).map((item) => <button key={item.id} onClick={() => setPortalId(item.id)} className={cn("relative rounded-2xl border p-3 text-center transition", portalId === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "surface hover:bg-[var(--surface-2)]")}><Image src={item.logo} alt="" width={52} height={52} className="mx-auto h-13 w-13 rounded-2xl object-cover" /><span className="mt-2 block text-xs font-semibold">{item.label}</span>{portalId === item.id && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-white"><Check className="h-3 w-3" /></span>}</button>)}</div>
            <AnimatePresence mode="wait"><motion.form key={portalId} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} onSubmit={signIn} className="mt-7 space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-semibold">Email address</span><div className="surface flex h-[52px] items-center gap-3 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-[var(--accent)]/30"><Mail className="h-5 w-5 text-tertiary" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder={portalId === "customer" ? "you@example.com" : `${portalId}@spotly.app`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div></label>
              <label className="block"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Password</span><button type="button" className="text-xs font-semibold text-[var(--accent)]">Forgot password?</button></div><div className="surface flex h-[52px] items-center gap-3 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-[var(--accent)]/30"><LockKeyhole className="h-5 w-5 text-tertiary" /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} placeholder="Enter your password" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="text-tertiary">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label>
              <label className="flex items-center gap-3 text-sm text-secondary"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" />Keep me signed in on this device</label>
              <Button type="submit" loading={loading} className="w-full">Continue to {portal.name}<ArrowRight className="h-4 w-4" /></Button>
            </motion.form></AnimatePresence>
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--surface-2)] p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" /><p className="text-xs leading-5 text-secondary">This generated project runs in demo mode without credentials. Add Firebase environment values to connect real authentication and data. Admin production access should enforce MFA and role claims.</p></div>
          </div>
        </Card>
      </div>
    </main>
  );
}
