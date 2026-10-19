"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, ShoppingBasket, RefreshCw } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
const complete = new Set(["completed", "cancelled", "declined", "expired"]);

const formatMoney = (value, currency = "USD") => new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(value || 0));

function ShoppingCheckoutCard({ request, onUpdated, paidCheckoutAvailable }) {
  const quote = request.confirmedQuote;
  const [address, setAddress] = useState(request.deliveryAddress || "");
  const [suburb, setSuburb] = useState("");
  const [landmark, setLandmark] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [preference, setPreference] = useState("contact_me");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const validQuote = quote && Date.parse(quote.expiresAt) > Date.now();
  async function locate() {
    if (!navigator.geolocation) { setError("Location services aren't supported on this device."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position)=>{
      setLat(String(position.coords.latitude));setLng(String(position.coords.longitude));setLocating(false);
    }, ()=>{setLocating(false);setError("Allow location access or enter the coordinates of the delivery point.");},
    {enableHighAccuracy:true,timeout:12000,maximumAge:30000});
  }
  async function pay(orderId) {
    const response=await authenticatedFetch("/api/payments/paynow/initiate",{
      method:"POST",body:JSON.stringify({orderId,channel:"web",client:"web"})
    });
    if(response.redirectUrl) window.location.assign(response.redirectUrl);
    else setNotice(response.instructions || "Your payment request was submitted. Check Spotly Activity for its status.");
  }
  async function checkout() {
    if(!approved||!validQuote)return;
    if(!address.trim()||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))||lat===""||lng===""){
      setError("Enter your delivery address and confirm the location pin first.");return;
    }
    setBusy(true);setError("");
    try{
      const reply=await authenticatedFetch("/api/customer/assist/shopping/checkout",{
        method:"POST",body:JSON.stringify({
          requestId:request.id,
          delivery:{lat:Number(lat),lng:Number(lng),address:address.trim(),suburb,landmark,instructions:""},
          substitutionPreference:preference
        })
      });
      await onUpdated();
      await pay(reply.orderId);
    }catch(err){setError(err.message||"We could not prepare your secure payment.");}
    finally{setBusy(false);}
  }
  return <div className="mt-5 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] p-4">
    {!quote ? <p className="text-sm">Spotly is checking the current prices and availability of your requested items.</p> :
      <>
        <h3 className="font-semibold">Spotly checked your shopping prices</h3>
        <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">This is an independent counter purchase, not an order placed with a partner merchant. Prices and stock can still change at the store. You approve a spending limit rather than an unlimited charge.</p>
        <div className="mt-4 space-y-2 rounded-xl bg-[var(--surface)] p-4 text-sm">
          {(quote.items||[]).map((item)=><div key={item.itemId} className="flex justify-between gap-4"><span>{item.quantity} × {item.name}</span><strong>{formatMoney(item.lineTotal,quote.currency)}</strong></div>)}
          <div className="border-t pt-3 flex justify-between"><span>Merchandise</span><strong>{formatMoney(quote.merchandiseSubtotal,quote.currency)}</strong></div>
          <div className="flex justify-between"><span>Shopper service fee</span><span>{formatMoney(quote.shoppingFee,quote.currency)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>{formatMoney(quote.deliveryFee,quote.currency)}</span></div>
          <div className="flex justify-between"><span>Temporary shopping reserve</span><span>{formatMoney(quote.reserveAmount,quote.currency)}</span></div>
          <div className="border-t pt-3 flex justify-between font-semibold"><span>Maximum authorized payment</span><strong>{formatMoney(quote.totalAuthorized,quote.currency)}</strong></div>
        </div>
        {!validQuote ? <p className="mt-4 text-sm font-semibold text-[var(--danger)]">This quote expired. Spotly needs to confirm prices again before accepting payment.</p> :
          request.orderId ? <div className="mt-4 rounded-xl bg-[var(--surface)] p-4"><p className="text-sm">Payment status: <strong>{request.paymentStatus||"awaiting payment"}</strong>. Your shopper cannot purchase until the payment provider confirms the funds.</p>{request.paymentStatus!=="paid" && <button type="button" onClick={async()=>{setBusy(true);try{await pay(request.orderId)}catch(e){setError(e.message)}finally{setBusy(false)}}} disabled={busy} className="mt-3 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Resume Paynow payment</button>}</div> :
          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold">Confirm your delivery location</p>
            <label className="block text-xs font-semibold">Address<textarea rows={2} value={address} onChange={(e)=>setAddress(e.target.value)} className="mt-1 w-full rounded-xl border bg-[var(--surface)] p-3 text-sm" placeholder="Street, suburb, city"/></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Suburb<input className="mt-1 w-full rounded-xl border bg-[var(--surface)] p-3 text-sm" value={suburb} onChange={(e)=>setSuburb(e.target.value)}/></label><label className="text-xs font-semibold">Landmark (optional)<input className="mt-1 w-full rounded-xl border bg-[var(--surface)] p-3 text-sm" value={landmark} onChange={(e)=>setLandmark(e.target.value)}/></label></div>
            <button type="button" onClick={locate} disabled={locating} className="rounded-xl border bg-[var(--surface)] px-4 py-2.5 text-xs font-semibold">{locating?"Locating…":"Use my precise delivery location"}</button>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Latitude<input inputMode="decimal" className="mt-1 w-full rounded-xl border bg-[var(--surface)] p-3 text-sm" value={lat} onChange={(e)=>setLat(e.target.value)}/></label><label className="text-xs font-semibold">Longitude<input inputMode="decimal" className="mt-1 w-full rounded-xl border bg-[var(--surface)] p-3 text-sm" value={lng} onChange={(e)=>setLng(e.target.value)}/></label></div>
            <p className="text-xs leading-5 text-[var(--text-2)]">The coordinates must be your actual delivery point. Use your phone's location, or a precisely confirmed map pin.</p>
            <label className="block text-xs font-semibold">If something is unavailable<select className="mt-1 w-full rounded-xl border bg-[var(--surface)] p-3 text-sm" value={preference} onChange={(e)=>setPreference(e.target.value)}><option value="contact_me">Ask me before replacing it</option><option value="no_substitutions">Remove unavailable items</option><option value="best_match">Allow a similar replacement within my spending limit</option></select></label>
            <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={approved} onChange={(e)=>setApproved(e.target.checked)}/>I agree to the stated maximum payment. Spotly will return unused funds under its refund process; no shopper may exceed the authorized amount.</label>
            {!paidCheckoutAvailable && <p className="rounded-xl border bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--text-2)]">Your price request is available, but paid purchases are not yet active in this area. Spotly is preparing a secure way to fund shoppers before collecting money.</p>}
            <button type="button" disabled={!paidCheckoutAvailable||!approved||busy||quote.currency!=="USD"} onClick={checkout} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?"Preparing checkout…":"Approve quote & pay securely"}</button>
            {quote.currency!=="USD" && <p className="text-xs text-[var(--text-2)]">Digital payment for this currency is not yet enabled. Spotly won't charge you.</p>}
          </div>}
        {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
        {error&&<p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      </>}
  </div>;
}

export function AssistActivityApp() {
  const [bookings, setBookings] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [paidCheckoutAvailable, setPaidCheckoutAvailable] = useState(false);
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
      setBookings(b.bookings || []); setShopping(s.requests || []); setPaidCheckoutAvailable(s.paidCheckoutAvailable === true);
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
          <p className="mt-4 text-sm text-[var(--text-2)]">Initial estimated total: <strong>{formatMoney(request.estimate?.totalEstimate,request.estimate?.currency || "USD")}</strong>.</p><ShoppingCheckoutCard request={request} onUpdated={refresh} paidCheckoutAvailable={paidCheckoutAvailable}/>
        </article>)}
        {!loading && !bookings.length && !shopping.length && <div className="rounded-2xl border bg-[var(--surface)] px-6 py-14 text-center"><h2 className="text-lg font-semibold">No assisted requests yet</h2><p className="mt-2 text-sm text-[var(--text-2)]">Requests for independent purchases or bookings will appear here.</p><Link href="/shop" className="mt-5 inline-block text-sm font-semibold text-[var(--accent)]">Explore Spotly</Link></div>}
      </div>
    </div>
  </main>;
}
