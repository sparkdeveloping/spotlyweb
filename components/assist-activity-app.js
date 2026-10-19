"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, ShoppingBasket, RefreshCw } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
const complete = new Set(["completed", "cancelled", "declined", "expired"]);

export function AssistActivityApp() {
  const [bookings, setBookings] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    setLoading(true); setError("");
    try {
      const [b, s] = await Promise.all([
        authenticatedFetch("/api/customer/assist/bookings"),
        authenticatedFetch("/api/customer/independent-shopping/requests")
      ]);
      setBookings(b.bookings || []); setShopping(s.requests || []);
    } catch (err) { setError(err.message || "Could not load your requests."); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  async function decision(id, value) {
    setBusy(id); setError("");
    try {
      await authenticatedFetch("/api/customer/assist/bookings/decision", { method: "POST", body: JSON.stringify({ id, decision: value }) });
      await refresh();
    } catch (err) { setError(err.message || "Couldn't save your response."); }
    finally { setBusy(""); }
  }
  return <main className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--text)] sm:px-8">
    <div className="mx-auto max-w-[900px]">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]"><ArrowLeft className="h-4 w-4"/>Spotly</Link>
      <div className="mt-7 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Spotly Assist</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your requests</h1><p className="mt-2 text-sm text-[var(--text-2)]">Track shopping price checks, booking confirmations and proposed times.</p></div><button onClick={refresh} type="button" aria-label="Refresh" className="rounded-xl border bg-[var(--surface)] p-3"><RefreshCw className="h-4 w-4"/></button></div>
      {error && <p role="alert" className="mt-6 rounded-xl border p-4 text-sm text-[var(--danger)]">{error}</p>}
      {loading && <p className="mt-10 text-sm text-[var(--text-2)]">Refreshing your requests…</p>}
      <div className="mt-7 space-y-4">
        {bookings.map((booking) => <article key={booking.id} className="rounded-2xl border bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><CalendarDays className="h-5 w-5"/></span><div><h2 className="font-semibold">{booking.businessName}</h2><p className="mt-1 text-sm text-[var(--text-2)]">{booking.serviceName}</p></div></div><span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold">{String(booking.state || "").replaceAll("_"," ")}</span></div>
          <p className="mt-4 flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-[var(--accent)]"/>Requested {booking.requestedDate} at {booking.requestedTime}</p>
          {booking.confirmedDate && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--success)]"><CheckCircle2 className="h-4 w-4"/>Confirmed {booking.confirmedDate} at {booking.confirmedTime}</p>}
          {booking.state === "awaiting_customer" && booking.proposedDate && <div className="mt-5 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] p-4">
            <p className="text-sm font-semibold">The business suggested another time</p><p className="mt-2 text-sm">{booking.proposedDate} at {booking.proposedTime}</p>
            <p className="mt-2 text-xs text-[var(--text-2)]">Accepting means Spotly will reconfirm with the business. It does not guarantee the appointment.</p>
            <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy === booking.id} onClick={() => decision(booking.id, "accept_alternative")} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Accept this time</button><button disabled={busy === booking.id} onClick={() => decision(booking.id, "decline_alternative")} className="rounded-xl border bg-[var(--surface)] px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Ask for another</button></div>
          </div>}
          {booking.updateMessage && <p className="mt-4 text-sm leading-6 text-[var(--text-2)]">{booking.updateMessage}</p>}
          {!complete.has(booking.state) && booking.state !== "confirmed" && <button disabled={busy === booking.id} onClick={() => decision(booking.id, "cancel")} type="button" className="mt-5 text-xs font-semibold text-[var(--danger)] disabled:opacity-40">Cancel request</button>}
        </article>)}
        {shopping.map((request) => <article key={request.id} className="rounded-2xl border bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><ShoppingBasket className="h-5 w-5"/></span><div><h2 className="font-semibold">{request.storeName}</h2><p className="mt-1 text-xs text-[var(--text-2)]">Independent shopping price check</p></div></div><span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold">{String(request.state || "").replaceAll("_"," ")}</span></div>
          <p className="mt-4 text-sm text-[var(--text-2)]">Merchandise and service estimate: <strong>{new Intl.NumberFormat("en", { style: "currency", currency: request.estimate?.currency || "USD" }).format(Number(request.estimate?.totalEstimate || 0))}</strong>. This is not a paid order. Spotly will verify prices and availability.</p>
        </article>)}
        {!loading && !bookings.length && !shopping.length && <div className="rounded-2xl border bg-[var(--surface)] px-6 py-14 text-center"><h2 className="text-lg font-semibold">No assisted requests yet</h2><p className="mt-2 text-sm text-[var(--text-2)]">Requests for independent purchases or bookings will appear here.</p><Link href="/shop" className="mt-5 inline-block text-sm font-semibold text-[var(--accent)]">Explore Spotly</Link></div>}
      </div>
    </div>
  </main>;
}
