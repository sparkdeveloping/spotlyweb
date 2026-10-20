"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {CalendarDays,ShoppingBasket,Clock3,ShieldCheck} from "lucide-react";
import {authenticatedFetch} from "@/lib/api-client";
const fmt=value=>{const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleString("en-ZW",{dateStyle:"medium",timeStyle:"short"}):"—";};
export function AssistActivitySection({filter="all",onCountChange}){
 const [bookings,setBookings]=useState([]),[shopping,setShopping]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState("");
 const refresh=async()=>{const [b,s]=await Promise.all([authenticatedFetch("/api/customer/assist-bookings"),authenticatedFetch("/api/customer/independent-shopping/requests")]);setBookings(b.bookings||[]);setShopping(s.requests||[]);};
 useEffect(()=>{let alive=true;Promise.all([authenticatedFetch("/api/customer/assist-bookings"),authenticatedFetch("/api/customer/independent-shopping/requests")]).then(([b,s])=>{if(alive){setBookings(b.bookings||[]);setShopping(s.requests||[]);}}).catch(e=>{if(alive)setError(e.message||"Unable to load Assist activity.");}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false};},[]);
 const records=[...(["all","assist","bookings"].includes(filter)?bookings.map(x=>({...x,kind:"booking"})):[]),...(["all","assist","orders"].includes(filter)?shopping.map(x=>({...x,kind:"shopping"})):[])].sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
 useEffect(()=>onCountChange?.(records.length),[records.length,onCountChange]);
 async function decideSubstitution(r,itemId,decision){setBusy(r.id+itemId);setError("");try{await authenticatedFetch("/api/customer/independent-shopping/substitution",{method:"POST",body:JSON.stringify({requestId:r.id,itemId,decision})});await refresh();}catch(e){setError(e.message);}finally{setBusy("");}}
 async function act(r,decision){setBusy(r.id+decision);setError("");try{await authenticatedFetch(r.kind==="booking"?"/api/customer/assist-bookings/respond":"/api/customer/independent-shopping/requests/respond",{method:"POST",body:JSON.stringify({id:r.id,decision})});await refresh();}catch(e){setError(e.message||"Could not save your decision.");}finally{setBusy("");}}
 if(!["all","assist","bookings","orders"].includes(filter)||(!loading&&!error&&!records.length))return null;
 return <section className="mt-7"><h2 className="text-lg font-semibold">Spotly Assist requests</h2><p className="mt-1 text-xs text-[var(--text-3)]">Independent price checks and booking enquiries. No payment is collected here.</p>
 {loading&&<p className="mt-3 rounded-xl border p-4 text-sm text-[var(--text-2)]">Loading requests…</p>}
 {error&&<p role="alert" className="mt-3 rounded-xl border p-4 text-sm text-[var(--danger)]">{error}</p>}
 <div className="mt-4 grid gap-4 md:grid-cols-2">{records.map(r=>{
 const book=r.kind==="booking",quote=r.finalQuote,until=Date.parse(quote?.expiresAt||""),valid=!book&&r.state==="quote_offered"&&Number.isFinite(until)&&until>Date.now();
 const alt=book&&r.state==="alternative_offered"&&r.alternativeAt;
 const href=book?"/assist/book?business="+encodeURIComponent(r.businessId||""):"/shop-for-me?store="+encodeURIComponent(r.storeId||"");
 return <article key={r.kind+r.id} className="rounded-2xl border bg-[var(--surface)] p-5">
 <div className="flex items-start gap-3"><span className="rounded-xl bg-[var(--surface-2)] p-2.5 text-[var(--accent)]">{book?<CalendarDays className="h-5 w-5"/>:<ShoppingBasket className="h-5 w-5"/>}</span><div className="min-w-0 flex-1"><p className="font-semibold">{book?r.businessName:r.storeName}</p><p className="mt-1 text-xs text-[var(--text-2)]">{book?r.serviceName:"Independent shopping request"}</p></div><span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-xs font-semibold capitalize">{String(r.state||"pending").replaceAll("_"," ")}</span></div>
 {r.createdAt&&<p className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--text-3)]"><Clock3 className="h-3.5 w-3.5"/>{fmt(r.createdAt)}</p>}
 {alt&&<p className="mt-3 rounded-xl bg-[var(--surface-2)] p-3 text-sm">Alternative: {fmt(r.alternativeAt)}</p>}
 {!book&&r.customerMessage&&<p className="mt-3 text-sm text-[var(--text-2)]">{r.customerMessage}</p>}
 {quote&&<div className="mt-3 rounded-xl bg-[var(--surface-2)] p-3 text-sm"><p className="font-semibold">{quote.currency||"USD"} {Number(quote.total||0).toFixed(2)}</p><p className="mt-1 text-xs text-[var(--text-2)]">{valid?"Expires "+fmt(quote.expiresAt):r.state==="quote_offered"?"This quote has expired.":"No payment collected."}</p></div>}
 {alt&&<div className="mt-3 flex gap-2"><button disabled={!!busy} onClick={()=>act(r,"accept_alternative")} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Accept time</button><button disabled={!!busy} onClick={()=>act(r,"decline_alternative")} className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-40">Decline</button></div>}
 {valid&&<div className="mt-3 flex gap-2"><button disabled={!!busy} onClick={()=>act(r,"accept_quote")} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Accept quote (no payment)</button><button disabled={!!busy} onClick={()=>act(r,"decline_quote")} className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-40">Decline</button></div>}
 {r.deliveryPin&&<p className="mt-3 rounded-lg bg-[var(--surface-2)] p-3 text-sm">Delivery handoff PIN: <strong className="font-mono text-lg tracking-widest">{r.deliveryPin}</strong>. Share only when the shopper arrives with your purchase.</p>}
 {(r.pendingSubstitutions||[]).map(x=><div key={x.itemId} className="mt-3 rounded-xl border p-3 text-sm"><p className="font-semibold">Replace item with {x.replacementName}?</p><p className="mt-1 text-xs">{x.quantity} × USD {Number(x.unitPrice).toFixed(2)}</p><div className="mt-2 flex gap-2"><button disabled={!!busy} onClick={()=>decideSubstitution(r,x.itemId,"approve")} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">Approve</button><button disabled={!!busy} onClick={()=>decideSubstitution(r,x.itemId,"reject")} className="rounded-lg border px-3 py-2 text-xs">Remove</button></div></div>)}
 {r.state==="quote_accepted_awaiting_payment"&&<p className="mt-3 flex items-center gap-1 text-xs text-[var(--text-2)]"><ShieldCheck className="h-4 w-4"/>Quote accepted. No purchase or dispatch yet.</p>}
 <Link href={href} className="mt-4 inline-block text-xs font-semibold text-[var(--accent)]">Manage request →</Link>
 </article>})}</div></section>;
}
