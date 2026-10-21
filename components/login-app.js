"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useAuth } from "@/components/firebase-provider";
import { safeSpotlyDestination, spotlyPortalUrl } from "@/lib/spotly-domains";
import { ServiceArtwork, ServiceGlyph } from "@/components/service-artwork";

const destinations = {
  customer: spotlyPortalUrl("customer", "/account"),
  business: spotlyPortalUrl("business"),
  admin: spotlyPortalUrl("admin"),
  staff: spotlyPortalUrl("staff"),
  driver: spotlyPortalUrl("driver")
};

function Field({ label, icon: Icon, children }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><div className="flex h-[52px] items-center gap-3 rounded-[12px] border border-[var(--control-border)] bg-[var(--control-bg)] px-4 transition focus-within:border-[var(--focus)] focus-within:ring-2 focus-within:ring-[var(--focus-soft)]"><Icon className="h-5 w-5 text-tertiary" />{children}</div></label>;
}

export function LoginApp({ initialPortal = "customer", initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "signin");
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
  const next = safeSpotlyDestination(searchParams.get("next"), destinations[portal]);

  useEffect(() => {
    if (!loading && authReady && user && !user.isAnonymous && mode !== "link") {
      if (/^https?:/i.test(next)) window.location.replace(next);
      else router.replace(next);
    }
  }, [authReady, loading, user, mode, next, router]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!acceptedTerms) throw new Error("Confirm that you agree to the Spotly terms and privacy notice.");
        const signup = await createAccount({ email, password, displayName });
        toast(signup.verificationEmailSent
          ? "Account created. Check your email for a verification link. You can resend it from your Spotly workspace."
          : "Account created, but we could not send the verification email. Use Resend verification email in your Spotly workspace.",
          { title: "Verify your email", type: signup.verificationEmailSent ? "success" : "info", duration: 10000 });
      } else if (mode === "reset") {
        await resetPassword(email);
        setResetSent(true);
        toast("Check your inbox for the password reset link.", { title: "Reset email sent" });
        return;
      } else {
        await signIn({ email, password });
        toast("You are securely signed in.", { title: "Welcome back" });
      }
      if (/^https?:/i.test(next)) window.location.replace(next);
      else router.replace(next);
    } catch (error) {
      toast(error.message, { type: "error", title: "Sign-in issue" });
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "signup" ? (portal === "driver" ? "Create your account to start driving" : portal === "business" ? "Create your Spotly account" : "Create your Spotly account") : mode === "reset" ? "Reset your password" : "Sign in to Spotly";
  const description = mode === "signup"
    ? portal === "driver"
      ? "Create one Spotly account, then continue directly into your Driver application."
      : portal === "business"
        ? "Create one Spotly account, then continue the business claim or setup you started."
        : "Create one account for orders, pickup updates, and invited workspaces. We will ask you to verify your email after signup."
    : mode === "reset"
      ? "Enter the email used for your Spotly account."
      : portal === "business"
        ? "Sign in to continue managing your business and locations."
        : portal === "staff"
          ? "Sign in to open your assigned work."
          : portal === "driver"
            ? "Sign in to continue your Driver application or active work."
            : portal === "admin"
              ? "Sign in to open authorized platform operations."
              : "Sign in to see saved businesses, baskets, and pickup updates.";

  const portalLabel = portal === "business" ? "Spotly Business" : portal === "staff" ? "Spotly Staff" : portal === "driver" ? "Spotly Driver" : portal === "admin" ? "Spotly Admin" : "Spotly";
  const portalIntro = portal === "business" ? "Run today’s work, catalogue, team and locations from one clear workspace." : portal === "staff" ? "See your assigned work, priorities and support without digging through an admin system." : portal === "driver" ? "Know whether you are online, what work is available, what comes next and what you have earned." : portal === "admin" ? "Open the queues, exceptions and operating controls that need attention." : "Your saved places, orders, bookings, rides and activity stay connected to one account.";

  return <main className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <header className="border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8"><Link href={spotlyPortalUrl("customer")} className="flex items-center gap-2.5"><Image src="/brand/spotly.svg" alt="" width={38} height={38} /><span className="text-[17px] font-semibold tracking-[-.03em]">Spotly</span></Link><span className="hidden rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] sm:inline-flex">{portalLabel}</span><Link href={spotlyPortalUrl("customer", "/support")} className="ml-auto rounded-[12px] px-3 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-hover)]">Need help?</Link></div>
    </header>

    <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1240px] lg:grid-cols-[1fr_520px]">
      <section className="relative hidden overflow-hidden border-r border-[var(--border-subtle)] px-8 py-12 lg:flex lg:flex-col lg:justify-between xl:px-12">
        <div className="relative z-10 max-w-xl"><p className="text-sm font-semibold text-[var(--accent)]">{portalLabel}</p><h1 className="mt-4 text-[52px] font-semibold leading-[1] tracking-[-.06em]">One account. The right next step.</h1><p className="mt-5 max-w-lg text-base leading-7 text-[var(--text-2)]">{portalIntro}</p></div>
        <div className="relative z-10 mt-12 max-w-xl">
          <div className="grid grid-cols-3 gap-2">{[["eat","Eat"],["shop","Shop"],["book","Book"],["events","Events"],["ride","Ride"],["send","Send"]].map(([service,label]) => <div key={service} className="flex items-center gap-2 rounded-[16px] border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] p-3 backdrop-blur"><span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-[var(--accent)]"><ServiceGlyph service={service} className="h-4 w-4" /></span><span className="text-xs font-semibold">{label}</span></div>)}</div>
          <div className="mt-6 border-y border-[var(--border-subtle)] py-4 text-sm leading-6 text-[var(--text-2)]"><span className="font-semibold text-[var(--text)]">Secure continuity:</span> sign in once and Spotly restores the account, workspace and activity you are allowed to use.</div>
        </div>
        <ServiceArtwork service={portal === "driver" ? "ride" : portal === "business" ? "shop" : "send"} className="absolute -right-16 top-16 h-72 w-72 opacity-[.08]" />
      </section>

      <section className="flex items-center px-4 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm font-semibold text-[var(--accent)]">Secure access</p><h2 className="mt-2 text-[34px] font-semibold tracking-[-.05em]">{title}</h2><p className="mt-3 text-sm leading-6 text-[var(--text-2)]">{description}</p>
          {user && !user.isAnonymous ? <div className="mt-8"><div className="flex items-center gap-3 border-y border-[var(--border-subtle)] py-4"><span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-[var(--accent)]"><UserRound className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{user.displayName || user.email}</p><p className="mt-1 text-xs text-[var(--text-3)]">Already signed in</p></div><Check className="h-5 w-5 text-[var(--success)]" /></div><p className="mt-5 text-sm leading-6 text-[var(--text-2)]">Continue to the workspace you requested. Spotly will still apply that workspace’s access rules.</p><Button className="mt-5 w-full" onClick={() => /^https?:/i.test(next) ? window.location.assign(next) : router.push(next)}>Continue<ArrowRight className="h-4 w-4" /></Button></div> : <>
            <div className="mt-7 grid grid-cols-2 rounded-[12px] bg-[var(--surface-2)] p-1">{[["signin", "Sign in"], ["signup", "Create account"]].map(([value, label]) => <button type="button" key={value} onClick={() => { setMode(value); setResetSent(false); }} className={`rounded-[10px] px-4 py-2.5 text-sm font-semibold transition ${mode === value ? "bg-[var(--surface)] text-[var(--accent-strong)] shadow-sm" : "text-[var(--text-2)] hover:text-[var(--text)]"}`}>{label}</button>)}</div>
            <AnimatePresence mode="wait"><motion.form key={mode} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: .2 }} onSubmit={submit} className="mt-6 space-y-4">
              {mode === "signup" ? <Field label="Full name" icon={UserRound}><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required autoComplete="name" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Your full name" /></Field> : null}
              <Field label="Email address" icon={Mail}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="you@example.com" /></Field>
              {mode !== "reset" ? <Field label="Password" icon={LockKeyhole}><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} /><button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)} className="rounded-[10px] p-1 text-[var(--text-3)] hover:bg-[var(--surface-hover)]">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></Field> : null}
              {mode === "signup" ? <><div className="grid grid-cols-2 gap-2 text-xs"><span className={password.length >= 8 ? "text-[var(--success)]" : "text-[var(--text-3)]"}>• At least 8 characters</span><span className={/[A-Za-z]/.test(password) && /\d/.test(password) ? "text-[var(--success)]" : "text-[var(--text-3)]"}>• Letters and a number</span></div><label className="flex items-start gap-3 border-y border-[var(--border-subtle)] py-3"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 h-4 w-4" /><span className="text-xs leading-5 text-[var(--text-2)]">I agree to <Link href={spotlyPortalUrl("customer", "/terms")} className="font-semibold text-[var(--accent)]">Spotly’s terms</Link> and acknowledge the <Link href={spotlyPortalUrl("customer", "/privacy")} className="font-semibold text-[var(--accent)]">privacy notice</Link>.</span></label></> : null}
              {mode === "reset" && resetSent ? <div className="rounded-[16px] bg-[var(--success-soft)] p-4 text-sm leading-6 text-[var(--on-success-soft)]">Check your inbox for the password reset link. You can return here once the password has changed.</div> : null}
              <Button type="submit" loading={loading} className="w-full">{mode === "signup" ? "Create account" : mode === "reset" ? "Send reset email" : "Sign in"}<ArrowRight className="h-4 w-4" /></Button>
              {mode === "signin" ? <button type="button" onClick={() => { setMode("reset"); setResetSent(false); }} className="w-full rounded-[10px] py-2 text-center text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)]">Forgot your password?</button> : mode === "reset" ? <button type="button" onClick={() => setMode("signin")} className="w-full rounded-[10px] py-2 text-center text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)]">Back to sign in</button> : null}
            </motion.form></AnimatePresence>
          </>}
          <div className="mt-8 flex items-start gap-3 border-t border-[var(--border-subtle)] pt-5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" /><p className="text-xs leading-5 text-[var(--text-3)]">Spotly never grants Business, Driver, Staff or Admin access just because you can sign in. Workspace permissions are verified separately.</p></div>
        </div>
      </section>
    </div>
  </main>;

}
