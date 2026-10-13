"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { CustomerShell } from "@/components/customer-shell";
import { useAuth } from "@/components/firebase-provider";
import { authenticatedFetch } from "@/lib/api-client";

export function PaymentReturnApp() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const { user, profile, authReady } = useAuth();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  async function check() {
    if (!orderId || !user) return;
    setChecking(true);
    setError("");
    try {
      const next = await authenticatedFetch("/api/payments/paynow/status", { method: "POST", body: JSON.stringify({ orderId }) });
      setResult(next);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (authReady && user && orderId) check();
    else if (authReady) setChecking(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, orderId, user?.uid]);

  const paid = result?.paid || result?.state === "paid";
  const transactionLabel = result?.transactionType === "ticket" ? "ticket" : result?.transactionType === "appointment" ? "appointment" : result?.transactionType === "booking" ? "booking" : result?.fulfilment === "delivery" ? "delivery order" : "order";
  const locationLabel = profile?.preferences?.preferredCity || "Harare";
  return (
    <CustomerShell current="activity" user={user} profile={profile} locationLabel={locationLabel}>
      <section className="mx-auto flex min-h-[calc(100vh-220px)] max-w-3xl items-center justify-center py-8 sm:py-14">
        <div className="w-full text-center">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] ${paid ? "bg-[var(--success-soft)] text-[var(--success)]" : checking ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"}`}>
            {checking ? <LoaderCircle className="h-9 w-9 animate-spin" /> : paid ? <CheckCircle2 className="h-10 w-10" /> : <CircleAlert className="h-10 w-10" />}
          </div>
          <p className="mt-6 text-sm font-semibold text-[var(--accent)]">Payment</p>
          <h1 className="mt-2 text-[34px] font-semibold tracking-[-.05em] sm:text-[44px]">{checking ? "Checking your payment" : paid ? "Payment confirmed" : "Payment is still settling"}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--text-2)]">{error || (paid ? `Your ${transactionLabel} payment is confirmed. Activity now has the latest status${result?.businessName ? ` from ${result.businessName}` : ""}.` : "Some Paynow payments take a moment to settle. Check the status again before attempting another payment so you do not pay twice.")}</p>
          {orderId ? <div className="mx-auto mt-6 max-w-md border-y border-[var(--border-subtle)] py-4"><p className="text-xs font-semibold text-[var(--text-3)]">Reference</p><p className="mt-1 truncate font-mono text-xs text-[var(--text-2)]">{orderId}</p></div> : null}
          {!user && authReady ? <Button asChild className="mt-7"><Link href={`/login?next=${encodeURIComponent(`/payment/return?orderId=${orderId}`)}`}>Sign in to check payment</Link></Button> : <div className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:flex-row"><Button variant="outline" className="flex-1" onClick={check} disabled={checking}><RefreshCw className="h-4 w-4" />Check again</Button><Button asChild className="flex-1"><Link href={`/?view=activity&order=${encodeURIComponent(orderId)}`}>Open Activity</Link></Button></div>}
          <p className="mx-auto mt-5 max-w-md text-xs leading-5 text-[var(--text-3)]">You can safely leave this page. Spotly keeps payment and fulfilment status in Activity.</p>
        </div>
      </section>
    </CustomerShell>
  );
}
