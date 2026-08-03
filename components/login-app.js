"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useAuth } from "@/components/firebase-provider";

const destinations = {
  customer: "/account",
  business: "/business",
  admin: "/admin",
  driver: "/driver"
};

function Field({ label, icon: Icon, children }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><div className="surface flex h-[52px] items-center gap-3 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-violet/30"><Icon className="h-5 w-5 text-tertiary" />{children}</div></label>;
}

export function LoginApp({ initialPortal = "customer" }) {
  const [mode, setMode] = useState("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { toast } = useToast();
  const { user, authReady, createAccount, signIn, resetPassword, linkProvider } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const portal = destinations[initialPortal] ? initialPortal : "customer";
  const next = searchParams.get("next") || destinations[portal];

  useEffect(() => {
    if (authReady && user && !user.isAnonymous && mode !== "link") router.replace(next);
  }, [authReady, user, mode, next, router]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await createAccount({ email, password, displayName });
        toast("Your Spotly account is ready. We also sent an email verification link.", { title: "Welcome to Spotly" });
      } else if (mode === "reset") {
        await resetPassword(email);
        setResetSent(true);
        toast("Check your inbox for the password reset link.", { title: "Reset email sent" });
        return;
      } else {
        await signIn({ email, password });
        toast("You are securely signed in.", { title: "Welcome back" });
      }
      router.push(next);
    } catch (error) {
      toast(error.message, { type: "error", title: "Sign-in issue" });
    } finally {
      setLoading(false);
    }
  }

  async function link(providerId) {
    setLoading(true);
    try {
      await linkProvider(providerId);
      toast(`${providerId === "google.com" ? "Google" : "Apple"} is now linked to your Spotly account.`, { title: "Account linked" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not link account" });
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "signup" ? "Create your Spotly account" : mode === "reset" ? "Reset your password" : "Sign in to Spotly";
  const description = mode === "signup" ? "Email and password create your primary Spotly identity. Google, Apple, and phone can be linked afterward." : mode === "reset" ? "Enter the email used for your Spotly account." : "One identity across customer, business, and permitted admin experiences.";

  return <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(102,87,217,.15),transparent_32%),linear-gradient(#fff,#f8f7ff)] px-4 py-8 text-ink" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}><div className="mx-auto max-w-6xl"><div className="mb-7 flex items-center justify-between"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.png" alt="Spotly" width={46} height={46} className="rounded-2xl" /><span className="text-xl font-black tracking-[-.04em]">Spotly</span></Link><Link href="/support" className="text-sm font-semibold text-secondary hover:text-ink">Need help?</Link></div><Card elevated className="grid overflow-hidden lg:grid-cols-[.95fr_1.05fr]"><div className="relative hidden min-h-[680px] overflow-hidden bg-gradient-to-br from-violet-strong via-violet to-fuchsia-500 p-10 text-white lg:flex lg:flex-col"><div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" /><div className="relative"><p className="text-xs font-bold uppercase tracking-[.2em] text-white/65">One shared identity</p><h1 className="mt-5 max-w-md text-5xl font-black leading-[1.02] tracking-[-.055em]">Start with email. Link everything else safely.</h1><p className="mt-5 max-w-md leading-7 text-white/70">This avoids duplicate profiles and keeps business access, verification, support history, and customer activity connected to one account.</p></div><div className="relative mt-auto space-y-3">{["Email and password remain your recovery foundation", "Google, Apple, and phone link to the same account", "Role-based access keeps every portal intentional"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-violet"><Check className="h-4 w-4" /></span><span className="text-sm font-semibold">{item}</span></div>)}</div></div><div className="p-5 sm:p-8 lg:p-10"><p className="text-xs font-bold uppercase tracking-[.17em] text-violet">Secure access</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">{title}</h2><p className="mt-2 text-sm leading-6 text-secondary">{description}</p>
          {user && !user.isAnonymous ? <div className="mt-7"><div className="rounded-2xl bg-violet-soft p-5"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-violet"><UserRound className="h-5 w-5" /></span><div><p className="font-semibold">{user.displayName || user.email}</p><p className="mt-1 text-xs text-secondary">Primary Spotly account</p></div></div></div><h3 className="mt-6 font-bold">Link another sign-in method</h3><p className="mt-2 text-sm leading-6 text-secondary">These methods do not create separate Spotly accounts. They attach to your existing email-and-password identity.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={() => link("google.com")} loading={loading}>Link Google</Button><Button variant="outline" onClick={() => link("apple.com")} loading={loading}>Link Apple</Button></div><Button className="mt-5 w-full" onClick={() => router.push(next)}>Continue<ArrowRight className="h-4 w-4" /></Button></div> : <>
          <div className="mt-7 flex rounded-2xl bg-grouped p-1">{[["signin", "Sign in"], ["signup", "Create account"]].map(([value, label]) => <button key={value} onClick={() => { setMode(value); setResetSent(false); }} className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === value ? "bg-white text-violet-strong shadow-sm" : "text-secondary"}`}>{label}</button>)}</div>
          <AnimatePresence mode="wait"><motion.form key={mode} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} onSubmit={submit} className="mt-6 space-y-4">{mode === "signup" && <Field label="Full name" icon={UserRound}><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required autoComplete="name" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Your full name" /></Field>}<Field label="Email address" icon={Mail}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="you@example.com" /></Field>{mode !== "reset" && <Field label="Password" icon={LockKeyhole}><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} /><button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)} className="text-tertiary">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></Field>}{mode === "reset" && resetSent ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">A password reset link has been requested for <strong>{email}</strong>.</div> : <Button type="submit" loading={loading} className="w-full">{mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}<ArrowRight className="h-4 w-4" /></Button>}{mode === "signin" && <button type="button" onClick={() => setMode("reset")} className="mx-auto block text-sm font-semibold text-violet">Forgot your password?</button>}{mode === "reset" && <button type="button" onClick={() => setMode("signin")} className="mx-auto block text-sm font-semibold text-violet">Back to sign in</button>}</motion.form></AnimatePresence>
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-grouped p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" /><p className="text-xs leading-5 text-secondary">Google, Apple, and phone are intentionally offered after primary account creation. This prevents accidental duplicate identities across Spotly portals.</p></div></>}
        </div></Card></div></main>;
}
