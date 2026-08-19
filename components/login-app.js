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
  staff: "/staff",
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { toast } = useToast();
  const { user, authReady, createAccount, signIn, resetPassword } = useAuth();
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
        if (!acceptedTerms) throw new Error("Confirm that you agree to the Spotly terms and privacy notice.");
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

  const title = mode === "signup" ? "Create your Spotly account" : mode === "reset" ? "Reset your password" : "Sign in to Spotly";
  const description = mode === "signup" ? "Create one account for orders, pickup updates, and any workspaces you are later invited to use." : mode === "reset" ? "Enter the email used for your Spotly account." : portal === "business" ? "Sign in to continue managing your business and locations." : portal === "staff" ? "Sign in to open your assigned work." : portal === "driver" ? "Sign in to continue your driver shift." : portal === "admin" ? "Sign in to open authorized platform operations." : "Sign in to see saved businesses, baskets, and pickup updates.";

  return <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(102,87,217,.15),transparent_32%),linear-gradient(var(--background),var(--grouped))] px-4 py-8 text-ink"><div className="mx-auto max-w-6xl"><div className="mb-7 flex items-center justify-between"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.svg" alt="Spotly" width={46} height={46} /><span className="text-xl font-semibold tracking-[-.03em]">Spotly</span></Link><Link href="/support" className="text-sm font-semibold text-secondary hover:text-ink">Need help?</Link></div><Card elevated className="grid overflow-hidden lg:grid-cols-[.95fr_1.05fr]"><div className="relative hidden min-h-[680px] overflow-hidden bg-[#17152a] p-10 text-white lg:flex lg:flex-col"><div><Image src="/brand/spotly-wordmark.svg" alt="Spotly" width={150} height={44} className="brightness-0 invert" /><p className="mt-10 text-sm font-semibold text-white/65">{portal === "business" ? "Spotly Business" : portal === "staff" ? "Spotly Staff" : portal === "driver" ? "Spotly Driver" : portal === "admin" ? "Spotly Admin" : "Your Spotly account"}</p><h1 className="mt-4 max-w-md text-5xl font-semibold leading-[1.03] tracking-[-.05em]">Pick up where you left off.</h1><p className="mt-5 max-w-md leading-7 text-white/70">{portal === "business" ? "Review today’s work, update availability, and keep every location clear." : portal === "staff" ? "See your shift, assigned work, learning, and support in one place." : portal === "driver" ? "Restore your current job and continue from the correct step." : portal === "admin" ? "Open urgent work, operating queues, and platform diagnostics." : "Find nearby businesses, save what matters, and follow every pickup."}</p></div><div className="mt-auto space-y-3">{["Your progress stays connected to this account", "Sensitive actions always require your sign-in", "Help is available when access does not look right"].map((item) => <div key={item} className="flex items-center gap-3 border-t border-white/15 py-4"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)] text-violet"><Check className="h-4 w-4" /></span><span className="text-sm font-semibold">{item}</span></div>)}</div></div><div className="p-5 sm:p-8 lg:p-10"><p className="text-xs font-bold uppercase tracking-[.17em] text-violet">Secure access</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.03em]">{title}</h2><p className="mt-2 text-sm leading-6 text-secondary">{description}</p>
          {user && !user.isAnonymous ? <div className="mt-7"><div className="rounded-2xl bg-violet-soft p-5"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface)] text-violet"><UserRound className="h-5 w-5" /></span><div><p className="font-semibold">{user.displayName || user.email}</p><p className="mt-1 text-xs text-secondary">Signed in</p></div></div></div><p className="mt-5 text-sm leading-6 text-secondary">Continue to the workspace you requested. Additional sign-in methods can be managed from Account.</p><Button className="mt-5 w-full" onClick={() => router.push(next)}>Open Spotly<ArrowRight className="h-4 w-4" /></Button></div> : <>
          <div className="mt-7 flex rounded-2xl bg-grouped p-1">{[["signin", "Sign in"], ["signup", "Create account"]].map(([value, label]) => <button key={value} onClick={() => { setMode(value); setResetSent(false); }} className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === value ? "bg-[var(--surface)] text-violet-strong shadow-sm" : "text-secondary"}`}>{label}</button>)}</div>
          <AnimatePresence mode="wait"><motion.form key={mode} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} onSubmit={submit} className="mt-6 space-y-4">{mode === "signup" && <Field label="Full name" icon={UserRound}><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required autoComplete="name" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Your full name" /></Field>}<Field label="Email address" icon={Mail}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="you@example.com" /></Field>{mode !== "reset" && <Field label="Password" icon={LockKeyhole}><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} /><button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)} className="text-tertiary">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></Field>}{mode === "signup" && <><div className="grid grid-cols-2 gap-2 text-xs"><span className={password.length >= 8 ? "text-success" : "text-tertiary"}>• At least 8 characters</span><span className={/[A-Za-z]/.test(password) && /\d/.test(password) ? "text-success" : "text-tertiary"}>• Letters and a number</span></div><label className="flex items-start gap-3 rounded-xl border p-3"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 h-4 w-4" /><span className="text-xs leading-5 text-secondary">I agree to <Link href="/terms" className="font-semibold text-violet">Spotly’s terms</Link> and acknowledge the <Link href="/privacy" className="font-semibold text-violet">privacy notice</Link>.</span></label></>}{mode === "reset" && resetSent ? <div className="rounded-2xl bg-[var(--success-soft)] p-4 text-sm leading-6 text-[var(--on-success-soft)]">A password reset link has been requested for <strong>{email}</strong>.</div> : <Button type="submit" loading={loading} className="w-full">{mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}<ArrowRight className="h-4 w-4" /></Button>}{mode === "signin" && <button type="button" onClick={() => setMode("reset")} className="mx-auto block text-sm font-semibold text-violet">Forgot your password?</button>}{mode === "reset" && <button type="button" onClick={() => setMode("signin")} className="mx-auto block text-sm font-semibold text-violet">Back to sign in</button>}</motion.form></AnimatePresence>
          <div className="mt-6 flex items-start gap-3 rounded-xl bg-grouped p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" /><p className="text-xs leading-5 text-secondary">Never share your password, one-time code, or payment PIN with anyone—including Spotly Support.</p></div></>}
        </div></Card></div></main>;
}
