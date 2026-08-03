"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/components/firebase-provider";
import { authenticatedFetch } from "@/lib/api-client";

export function PaymentReturnApp() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const { user, authReady } = useAuth();
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
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafe] px-4 py-16 text-[#17171f]">
      <div className="w-full max-w-xl rounded-[30px] border border-gray-200 bg-white p-7 text-center shadow-[0_24px_80px_rgba(80,61,170,.12)] sm:p-10">
        {checking ? <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-violet-600" /> : paid ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /> : <CircleAlert className="mx-auto h-14 w-14 text-amber-500" />}
        <h1 className="mt-6 text-3xl font-bold tracking-[-.04em]">{checking ? "Checking your payment" : paid ? "Payment confirmed" : "Payment is not confirmed yet"}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600">{error || (paid ? "The order has been updated and the business can begin preparing it for pickup." : "Some Paynow transactions take a moment to settle. Refresh the status before attempting another payment.")}</p>
        {orderId && <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500">Order {orderId}</p>}
        {!user && authReady ? <Button asChild className="mt-7 w-full"><Link href={`/login?next=${encodeURIComponent(`/payment/return?orderId=${orderId}`)}`}>Sign in to check payment</Link></Button> : <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button variant="outline" className="flex-1" onClick={check} disabled={checking}><RefreshCw className="h-4 w-4" />Check again</Button><Button asChild className="flex-1"><Link href="/marketplace">Back to orders</Link></Button></div>}
      </div>
    </main>
  );
}
