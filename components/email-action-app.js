"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { applyActionCode, checkActionCode, confirmPasswordReset } from "firebase/auth";
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, LockKeyhole, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { getFirebaseClient } from "@/lib/firebase";
import { EMAIL_ACTION_MODES, emailActionErrorMessage, emailActionReturnUrl } from "@/lib/auth-email-actions";

export function EmailActionApp() {
  const params = useSearchParams();
  const mode = params.get("mode") || "";
  const code = params.get("oobCode") || "";
  const continueUrl = params.get("continueUrl");
  const config = EMAIL_ACTION_MODES[mode] || null;
  const returnUrl = emailActionReturnUrl(mode, continueUrl);
  const [phase, setPhase] = useState("checking");
  const [retry, setRetry] = useState(0);
  const [detail, setDetail] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;
    setPhase("checking");
    setDetail("");
    setAccountEmail("");
    if (!config || !code || code.length > 4096) {
      setPhase("invalid");
      setDetail("This email action link is missing or invalid. Request a fresh link from Spotly.");
      return undefined;
    }
    const auth = getFirebaseClient()?.auth;
    if (!auth) {
      setPhase("invalid");
      setDetail("Email verification is currently unavailable. Please try again later.");
      return undefined;
    }
    checkActionCode(auth, code).then((info) => {
      if (!active) return;
      // Never allow a code for password reset or address recovery to run as verification.
      if (info.operation !== config.operation) {
        setPhase("invalid");
        setDetail("This link is for a different account action. Open the original email again.");
        return;
      }
      setAccountEmail(info.data?.email || info.data?.previousEmail || "");
      setPhase("ready");
    }).catch((error) => {
      if (!active) return;
      setPhase("invalid");
      setDetail(emailActionErrorMessage(error));
    });
    return () => { active = false; };
  }, [mode, code, retry, config]);

  async function complete(event) {
    event?.preventDefault();
    if (phase !== "ready" || !config || !code) return;
    if (mode === "resetPassword") {
      if (password.length < 8) {
        setDetail("Use at least eight characters for your new password.");
        return;
      }
      if (password !== confirmPassword) {
        setDetail("The passwords do not match.");
        return;
      }
    }
    setDetail("");
    setPhase("submitting");
    try {
      const auth = getFirebaseClient()?.auth;
      if (!auth) throw new Error("auth-unavailable");
      if (mode === "resetPassword") {
        await confirmPasswordReset(auth, code, password);
        setPassword("");
        setConfirmPassword("");
      } else {
        await applyActionCode(auth, code);
        if (mode === "verifyEmail" && auth.currentUser) {
          // Refresh the current browser session when available. The action link
          // also works in a separate browser with no authenticated session.
          await auth.currentUser.reload().catch(() => null);
          await auth.currentUser.getIdToken(true).catch(() => null);
        }
      }
      setPhase("success");
    } catch (error) {
      setPhase(["auth/expired-action-code", "auth/invalid-action-code"].includes(error?.code) ? "invalid" : "ready");
      setDetail(emailActionErrorMessage(error));
    }
  }

  const successText = mode === "verifyEmail"
    ? "Your email has been verified. You can now return to Spotly and continue where you left off."
    : mode === "resetPassword"
      ? "Your Spotly password has been updated. Sign in with your new password."
      : "Your previous email address has been restored. Review your account security when you sign in.";
  const Icon = phase === "success" ? CheckCircle2 : mode === "resetPassword" ? KeyRound : mode === "recoverEmail" ? LockKeyhole : MailCheck;

  return <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--grouped)] text-[var(--text)]">
    <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-48 h-[500px] w-[500px] rounded-full bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] blur-[85px]" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 -right-40 h-[500px] w-[500px] rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] blur-[90px]" />
    <header className="relative z-10 border-b border-[var(--border-subtle)] bg-[var(--surface)]/80">
      <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="https://spotlyafrica.com" className="flex items-center gap-3" aria-label="Spotly home">
          <Image src="/brand/spotly.svg" alt="" width={40} height={40} className="h-10 w-10" priority />
          <span className="text-lg font-semibold tracking-[-.04em]">Spotly</span>
        </Link>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-secondary"><ShieldCheck className="h-4 w-4" />Secure account</span>
      </div>
    </header>
    <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
      <div className="w-full max-w-[520px]">
        <div className="mb-6 text-center"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent)]">Your Spotly account</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">One secure next step.</h1></div>
        <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-elevated">
          <div className="h-1.5 bg-[var(--accent)]" aria-hidden="true" />
          <div className="px-6 pb-7 pt-8 sm:px-9 sm:pb-9 sm:pt-10">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-7 w-7" /></span>
            <h2 className="mt-6 text-2xl font-semibold tracking-[-.035em]">{phase === "success" ? "All set" : config?.title || "Account link unavailable"}</h2>
            <p className="mt-2 text-sm leading-6 text-secondary">{phase === "success" ? successText : config?.description || "Return to Spotly to request a valid account link."}</p>
            {phase === "ready" && accountEmail && <p className="mt-4 break-all rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm text-secondary">Account: <strong className="text-[var(--text)]">{accountEmail}</strong></p>}

            {phase === "checking" && <div role="status" className="mt-7 flex items-center gap-2 text-sm text-secondary"><RefreshCw className="h-4 w-4 animate-spin" />Checking your secure link…</div>}

            {(phase === "invalid" || (phase === "ready" && detail)) && <div role="alert" className="mt-6 flex gap-3 rounded-xl border border-[color-mix(in_srgb,var(--danger)_30%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{detail}</span></div>}

            {phase === "ready" && mode === "resetPassword" ? <form onSubmit={complete} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} className="field-control mt-2 w-full" placeholder="At least 8 characters" /></label>
              <label className="block text-sm font-semibold">Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="field-control mt-2 w-full" placeholder="Repeat your password" /></label>
              <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:opacity-90">Update password<ArrowRight className="h-4 w-4" /></button>
            </form> : null}

            {phase === "ready" && mode !== "resetPassword" && <button type="button" onClick={complete} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:opacity-90">{config.action}<ArrowRight className="h-4 w-4" /></button>}
            {phase === "submitting" && <p role="status" className="mt-7 flex items-center gap-2 text-sm text-secondary"><RefreshCw className="h-4 w-4 animate-spin" />Securely completing your request…</p>}

            {phase === "success" && <Link href={returnUrl} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:opacity-90">Return to Spotly<ArrowRight className="h-4 w-4" /></Link>}
            {phase === "invalid" && <div className="mt-6 flex flex-wrap gap-3"><Link href={returnUrl} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]">Back to Spotly</Link><button type="button" className="flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold" onClick={() => setRetry((current) => current + 1)}>Try again</button></div>}
          </div>
          <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-2)] px-6 py-4 text-center text-xs text-secondary sm:px-9">A secure Spotly account action powered by Firebase Authentication.</div>
        </section>
        <p className="mt-5 text-center text-xs leading-5 text-tertiary">Only open verification or password links you requested. Spotly will never ask for your password by email.</p>
      </div>
    </main>
  </div>;
}
