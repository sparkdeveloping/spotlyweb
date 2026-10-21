"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MailWarning, RefreshCw, Send } from "lucide-react";
import { useAuth } from "@/components/firebase-provider";
import { needsEmailVerification } from "@/lib/email-verification";

export function EmailVerificationBanner() {
  const { user, authReady, sendVerificationEmail, refreshEmailVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown(false), 60000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  if (!authReady || !needsEmailVerification(user)) return null;

  async function resend() {
    setSending(true);
    setNotice("");
    setError("");
    try {
      const result = await sendVerificationEmail();
      if (result.alreadyVerified) {
        await refreshEmailVerification();
        return;
      }
      setCooldown(true);
      setNotice("Verification email requested. Check your inbox and spam folder, then open the link.");
    } catch (reason) {
      setError(reason.message || "Verification email could not be sent. Try again later.");
    } finally {
      setSending(false);
    }
  }

  async function checkAgain() {
    setChecking(true);
    setNotice("");
    setError("");
    try {
      const verified = await refreshEmailVerification();
      if (!verified) setNotice("Still waiting for email verification. Open the link in your inbox, then check again.");
    } catch (reason) {
      setError(reason.message || "Could not check your verification status. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return <section aria-label="Email verification needed" className="border-b border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[var(--accent-soft)] px-4 py-3 sm:px-6">
    <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center">
      <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)] sm:flex"><MailWarning className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text)]">Verify your email address</p>
        <p className="mt-0.5 break-words text-xs leading-5 text-[var(--text-2)]">
          <strong>{user.email}</strong> is not verified yet. Check your inbox to finish setup and access invitation-only features such as Ride Lab.
        </p>
        {notice && <p role="status" className="mt-1.5 text-xs font-medium text-[var(--text)]">{notice}</p>}
        {error && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <button type="button" onClick={resend} disabled={sending || checking || cooldown} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[10px] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--on-accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          <Send className="h-3.5 w-3.5" />{sending ? "Sending…" : cooldown ? "Email requested" : "Resend verification email"}
        </button>
        <button type="button" onClick={checkAgain} disabled={checking || sending} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--surface-2)] disabled:opacity-50">
          {checking ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{checking ? "Checking…" : "I've verified"}
        </button>
      </div>
    </div>
  </section>;
}
