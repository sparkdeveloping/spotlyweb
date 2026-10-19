"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, Info, MapPin, PhoneCall, ShieldCheck, ArrowLeft, ArrowRight } from "lucide-react";
import { authenticatedFetch, publicApiFetch } from "@/lib/api-client";
import { spotlyLoginUrl } from "@/lib/spotly-domains";

const field = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm outline-offset-2 focus:outline-[var(--accent)]";

export function AssistBookingApp({ businessId }) {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ serviceName: "", date: "", time: "14:00", flexibility: "nearby",
    alternativeWindow: "", contactName: "", contactPhone: "", notes: "" });
  const requestId = useRef(null);

  useEffect(() => {
    let active = true;
    publicApiFetch("/api/public/assist/business?businessId=" + encodeURIComponent(businessId))
      .then((response) => { if (active) setBusiness(response.business); })
      .catch((err) => { if (active) setError(err.message || "This business is not accepting assisted booking requests."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId]);

  async function submit(event) {
    event.preventDefault();
    if (!business) return;
    setBusy(true); setError("");
    if (!requestId.current) requestId.current = crypto.randomUUID().replaceAll("-", "");
    try {
      const response = await authenticatedFetch("/api/customer/assist/bookings", {
        method: "POST", body: JSON.stringify({ ...form, businessId: business.id, requestId: requestId.current })
      });
      setDone(response);
    } catch (err) { setError(err.message || "This booking request could not be saved."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[var(--background)] pb-24 text-[var(--text)]">
    <div className="mx-auto max-w-[960px] px-5 pt-8 sm:px-8">
      <Link href="/book" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]"><ArrowLeft className="h-4 w-4"/>Spotly Book</Link>
      <section className="relative mt-6 overflow-hidden rounded-[28px] bg-[#191338] px-7 py-10 text-white sm:px-11 sm:py-12">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[#6657d9]/50 blur-[80px]" aria-hidden="true"/>
        <div className="relative max-w-xl"><p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"><CalendarClock className="h-4 w-4"/>Spotly Assist</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Your preferred time. We'll check.</h1>
          <p className="mt-4 text-base leading-7 text-white/75">Request a time at a local business, and Spotly will contact them to confirm it or offer you another option.</p>
        </div>
      </section>
      <div className="mt-6 rounded-xl border bg-[var(--surface)] p-5">
        <div className="flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"/><div><p className="font-semibold">Assisted, not automatically confirmed</p><p className="mt-1 text-sm leading-6 text-[var(--text-2)]">This business is not necessarily partnered with Spotly. Your preferred time is a request. We'll contact the business before confirming a booking. We won't charge you for an unconfirmed appointment.</p></div></div>
      </div>
      {loading ? <p className="mt-12 text-center text-sm text-[var(--text-2)]">Checking this location…</p>
      : done ? <section className="mt-7 rounded-2xl border bg-[var(--surface)] p-8">
          <CheckCircle2 className="h-11 w-11 text-[var(--success)]"/>
          <h2 className="mt-5 text-2xl font-semibold">Your request is on its way</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-2)]">Spotly will contact {business?.name || "this business"} about your preferred time. Nothing is confirmed or charged yet. If they suggest another time, you can accept or decline it.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/assist/activity" className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">Track this request<ArrowRight className="h-4 w-4"/></Link><Link href="/book" className="rounded-xl border px-5 py-3 text-sm font-semibold">Discover more</Link></div>
        </section>
      : business ? <section className="mt-7 rounded-2xl border bg-[var(--surface)] p-6 sm:p-8">
          <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><CalendarClock className="h-6 w-6"/></span><div><h2 className="text-xl font-semibold">{business.name}</h2><p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--text-2)]"><MapPin className="h-4 w-4"/>{[business.area, business.city, business.country].filter(Boolean).join(", ")}</p><p className="mt-1 text-xs text-[var(--text-3)]">{business.category}</p></div></div>
          <div className="mt-7 border-t pt-6">
            <h3 className="text-lg font-semibold">Tell us when and what you need</h3>
            <form onSubmit={submit} className="mt-5 space-y-5">
              <label className="block text-sm font-semibold">Service or appointment<input className={field} required minLength={2} maxLength={160} value={form.serviceName} onChange={(e) => setForm((v) => ({ ...v, serviceName: e.target.value }))} placeholder="e.g. Hair styling, manicure, consultation"/></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">Preferred date<input className={field} required type="date" min={new Date().toISOString().slice(0,10)} value={form.date} onChange={(e) => setForm((v) => ({ ...v, date: e.target.value }))}/></label>
                <label className="block text-sm font-semibold">Preferred time<input className={field} required type="time" value={form.time} onChange={(e) => setForm((v) => ({ ...v, time: e.target.value }))}/></label>
              </div>
              <fieldset className="rounded-xl border p-4"><legend className="px-2 text-sm font-semibold">If that time is unavailable</legend><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:gap-6">
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="flexibility" checked={form.flexibility === "nearby"} onChange={() => setForm((v) => ({ ...v, flexibility: "nearby" }))}/>Suggest a nearby time</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="flexibility" checked={form.flexibility === "exact"} onChange={() => setForm((v) => ({ ...v, flexibility: "exact" }))}/>Only this time</label>
              </div>{form.flexibility === "nearby" && <input className={field} maxLength={200} value={form.alternativeWindow} onChange={(e) => setForm((v) => ({ ...v, alternativeWindow: e.target.value }))} placeholder="Optional: afternoons work best"/>}</fieldset>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Your name<input className={field} required minLength={2} maxLength={120} value={form.contactName} onChange={(e) => setForm((v) => ({ ...v, contactName: e.target.value }))}/></label><label className="block text-sm font-semibold">Phone number<input className={field} required minLength={7} maxLength={40} placeholder="+263 or +265" value={form.contactPhone} onChange={(e) => setForm((v) => ({ ...v, contactPhone: e.target.value }))}/></label></div>
              <label className="block text-sm font-semibold">Optional message<textarea className={field} rows={3} maxLength={500} value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} placeholder="Specific stylist, preferences, requirements…"/></label>
              <div className="flex items-start gap-3 rounded-xl bg-[var(--surface-2)] p-4"><PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"/><p className="text-sm leading-6 text-[var(--text-2)]">A Spotly team member will check with the business. If another time is offered, you can review it in Activity. No reservation is made until the business confirms.</p></div>
              {error && <p role="alert" className="text-sm font-medium text-[var(--danger)]">{error} {error.toLowerCase().includes("sign in") && <Link href={spotlyLoginUrl("customer", { next: "/assist/book?business=" + encodeURIComponent(business.id) })} className="font-semibold underline">Sign in</Link>}</p>}
              <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] font-semibold text-white disabled:opacity-50">{busy ? "Sending request…" : "Ask Spotly to check availability"}<ArrowRight className="h-4 w-4"/></button>
            </form>
          </div>
        </section>
      : <section className="mt-8 rounded-2xl border bg-[var(--surface)] p-7"><ShieldCheck className="h-8 w-8"/><h2 className="mt-3 text-xl font-semibold">Assist booking unavailable</h2><p role="alert" className="mt-2 text-sm text-[var(--text-2)]">{error || "This business isn't accepting assisted booking requests yet."}</p><Link href="/book" className="mt-5 inline-flex gap-1.5 text-sm font-semibold text-[var(--accent)]">Explore other services<ArrowRight className="h-4 w-4"/></Link></section>}
    </div>
  </main>;
}
