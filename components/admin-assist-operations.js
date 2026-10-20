"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { ArrowLeft,RefreshCw,CalendarDays,ClipboardCheck,Power,Store } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { AdminAccess } from "@/components/admin-legacy-sections";
import { authenticatedFetch } from "@/lib/api-client";
const fmt = value => new Date(value).toLocaleString("en-ZW",{dateStyle:"medium",timeStyle:"short"});
const STATES=["requested","assigned","contacting_business","alternative_offered","alternative_accepted","alternative_declined","confirmed","declined","cancelled"];
export function AssistOperations(){
 const [tab,setTab]=useState("bookings"),[bookings,setBookings]=useState([]),[stores,setStores]=useState([]),[requests,setRequests]=useState([]),[busy,setBusy]=useState(""),[error,setError]=useState(""),[status,setStatus]=useState("");
 const [time,setTime]=useState(""),[note,setNote]=useState("");
 const [shoppingOpen,setShoppingOpen]=useState(""),[shopForm,setShopForm]=useState({merchandiseTotal:"",shoppingFee:"0",deliveryFee:"0",note:"",expiresInMinutes:"30"});
 const [businessId,setBusinessId]=useState(""),[accepting,setAccepting]=useState(true);
 const [businessSearch,setBusinessSearch]=useState(""),[businessOptions,setBusinessOptions]=useState([]),[searching,setSearching]=useState(false);
 async function load(){
  setError("");
  try{
    const [b,s,r]=await Promise.all([
      authenticatedFetch("/api/admin/assist-bookings"),
      authenticatedFetch("/api/admin/independent-shopping"),
      authenticatedFetch("/api/admin/independent-shopping/requests")
    ]);
    setBookings(b.bookings||[]);setStores(s.stores||[]);setRequests(r.requests||[]);
  }catch(e){setError(e.message);}
 }
 useEffect(()=>{load();},[]);
 async function act(id,action){
  setBusy(id+action);setError("");setStatus("");
  try{
   const alternativeAt=action==="offer_alternative"&&time?new Date(time).toISOString():undefined;
   await authenticatedFetch("/api/admin/assist-bookings",{method:"POST",body:JSON.stringify({bookingId:id,action,alternativeAt,operatorNote:note})});
   setStatus("Booking action saved.");setTime("");setNote("");await load();
  }catch(e){setError(e.message);}finally{setBusy("");}
 }
 async function shoppingAction(id,action){
   setBusy(id+action);setError("");setStatus("");
   try{
     const payload={
       id,action, note:shopForm.note,
       ...(action==="offer_quote"?{
         merchandiseTotal:Number(shopForm.merchandiseTotal),
         shoppingFee:Number(shopForm.shoppingFee),
         deliveryFee:Number(shopForm.deliveryFee),
         expiresInMinutes:Number(shopForm.expiresInMinutes)
       }:{})
     };
     await authenticatedFetch("/api/admin/assist-shopping/actions",{method:"POST",body:JSON.stringify(payload)});
     setStatus("Shopping request updated. Customer payment and dispatch remain blocked.");
     setShoppingOpen("");await load();
   }catch(err){setError(err.message);}finally{setBusy("");}
 }
 async function findBusinesses(){
   setSearching(true);setError("");
   try{
      const q=encodeURIComponent(businessSearch.trim());
      const response=await authenticatedFetch("/api/admin/assist-availability?q="+q);
      setBusinessOptions(response.businesses||[]);
   }catch(err){setError(err.message);}finally{setSearching(false);}
 }
 async function setAvailability(){
   setBusy("availability");setError("");setStatus("");
   try{
    await authenticatedFetch("/api/admin/assist-availability",{method:"POST",body:JSON.stringify({businessId,accepting})});
    setStatus("Business availability was updated and audited.");setBusinessId("");
   }catch(e){setError(e.message);}finally{setBusy("");}
 }
 return <AuthGate portal="admin" title="Sign in to Spotly Admin"><AdminAccess><PortalShell portalId="admin" activeSection="marketplace">
  <main className="mx-auto max-w-[1250px] px-5 py-9">
   <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]"><ArrowLeft className="h-4 w-4"/>Marketplace</Link>
   <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Spotly V9</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Assist Operations</h1><p className="mt-2 text-sm text-[var(--text-2)]">Assisted requests, booking confirmations and independent listing controls.</p></div><button type="button" onClick={load} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4"/>Refresh</button></div>
   <div className="mt-4 flex flex-wrap gap-2"><Link href="/admin/assist-coverage" className="rounded-xl border px-4 py-2 text-sm font-semibold">Country & service coverage</Link><Link href="/admin/assist-import" className="rounded-xl border px-4 py-2 text-sm font-semibold">Import businesses to Firestore</Link><Link href="/admin/assist-research" className="rounded-xl border px-4 py-2 text-sm font-semibold">Stage sourced restaurant research</Link><Link href="/admin/independent-shopping" className="rounded-xl border px-4 py-2 text-sm font-semibold">Manage menus & prices</Link><Link href="/admin/assist-menu-launch" className="rounded-xl border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">Activate verified restaurant menu</Link></div><div className="mt-7 grid gap-3 sm:grid-cols-3">{[[bookings.filter(x=>!["confirmed","cancelled","declined"].includes(x.state)).length,"Open bookings",CalendarDays],[requests.filter(x=>x.state==="pending_manual_quote").length,"Price checks",ClipboardCheck],[stores.length,"Assisted locations",Store]].map(([count,label,Icon])=><div key={label} className="rounded-2xl border bg-[var(--surface)] p-5"><Icon className="h-5 w-5 text-[var(--accent)]"/><p className="mt-3 text-2xl font-semibold">{count}</p><p className="mt-1 text-xs text-[var(--text-2)]">{label}</p></div>)}</div>
   <div className="mt-7 flex flex-wrap gap-2">{[["bookings","Booking requests"],["shopping","Shopping requests"],["locations","Locations"],["availability","Availability"]].map(([id,label])=><button type="button" key={id} onClick={()=>setTab(id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab===id?"bg-[var(--accent)] text-white":"border bg-[var(--surface)]"}`}>{label}</button>)}</div>
   {error&&<p role="alert" className="mt-5 rounded-xl border p-4 text-sm text-[var(--danger)]">{error}</p>}
   {status&&<p role="status" className="mt-5 rounded-xl border p-4 text-sm text-[var(--success)]">{status}</p>}
   {tab==="bookings"&&<section className="mt-6 space-y-4">{bookings.length===0?<p className="rounded-2xl border p-8 text-sm text-[var(--text-2)]">No assisted bookings have been requested yet.</p>:bookings.map(b=><article key={b.id} className="rounded-2xl border bg-[var(--surface)] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{b.businessName} · {b.serviceName}</p><p className="mt-1 text-sm text-[var(--text-2)]">Requested {fmt(b.requestedAt)} · {b.city||b.country||""}</p><p className="mt-1 text-xs text-[var(--text-2)]">Customer telephone: {b.phone}</p></div><span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold">{String(b.state).replaceAll("_"," ")}</span></div>
    {b.alternativeAt&&<p className="mt-3 text-sm">Suggested alternative: {fmt(b.alternativeAt)}</p>}
    {b.notes&&<p className="mt-3 text-xs text-[var(--text-2)]">{b.notes}</p>}
    {![ "confirmed","declined","cancelled"].includes(b.state)&&<div className="mt-5 space-y-3 border-t pt-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Alternative date/time<input type="datetime-local" value={time} onChange={e=>setTime(e.target.value)} className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2"/></label><label className="text-xs font-semibold">Call note / confirmation reference<input value={note} onChange={e=>setNote(e.target.value)} placeholder="What did the business confirm?" className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2"/></label></div><div className="flex flex-wrap gap-2">{[["contacted","Mark contacted"],["offer_alternative","Offer alternative"],["confirm","Confirm booking"],["decline","Cannot arrange"]].map(([action,label])=><button type="button" key={action} disabled={!!busy} onClick={()=>act(b.id,action)} className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-40">{label}</button>)}</div><p className="text-xs text-[var(--text-2)]">Confirm only after the business explicitly accepts. Alternatives require customer approval before confirming.</p></div>}
   </article>)}</section>}
   {tab==="shopping"&&<section className="mt-6 space-y-3"><p className="text-sm text-[var(--text-2)]">Verify the actual restaurant price, fees and availability before offering a final quote. Customer payment and shopper dispatch are not activated.</p>{requests.length===0&&<p className="rounded-xl border p-6 text-sm text-[var(--text-2)]">No shopping requests.</p>}{requests.map(r=><article key={r.id} className="rounded-xl border bg-[var(--surface)] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{r.storeName} · {r.contactName}</p><p className="mt-1 text-sm text-[var(--text-2)]">{r.contactPhone} · {r.deliveryAddress}</p></div><span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold">{r.state.replaceAll("_"," ")}</span></div><p className="mt-3 text-sm">Original estimate: {r.estimate?.currency||"USD"} {Number(r.estimate?.totalEstimate||0).toFixed(2)}</p>{r.finalQuote&&<p className="mt-1 text-sm font-semibold">Final quote: {r.finalQuote.currency} {Number(r.finalQuote.total).toFixed(2)} · Expires {fmt(r.finalQuote.expiresAt)}</p>}
  {["pending_manual_quote","contacting_store","quote_offered"].includes(r.state)&&<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={()=>{setShoppingOpen(r.id);setShopForm({merchandiseTotal:String(r.estimate?.merchandiseEstimate||""),shoppingFee:String(r.estimate?.shoppingFeeEstimate||0),deliveryFee:String(r.estimate?.deliveryFeeEstimate||0),note:"",expiresInMinutes:"30"});}} className="rounded-xl border px-4 py-2 text-xs font-semibold">Confirm price or update request</button></div>}
  {shoppingOpen===r.id&&<div className="mt-4 space-y-3 rounded-xl bg-[var(--surface-2)] p-4"><p className="font-semibold">Store-confirmed final quote</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["merchandiseTotal","Merchandise"],["shoppingFee","Shopping fee"],["deliveryFee","Delivery fee"]].map(([id,label])=><label key={id} className="text-xs font-semibold">{label}<input type="number" min="0" step="0.01" value={shopForm[id]} onChange={e=>setShopForm(v=>({...v,[id]:e.target.value}))} className="mt-1 w-full rounded-xl border bg-[var(--surface)] px-3 py-2"/></label>)}</div><label className="block text-xs font-semibold">Call note / store confirmation<input value={shopForm.note} onChange={e=>setShopForm(v=>({...v,note:e.target.value}))} maxLength={800} className="mt-2 w-full rounded-xl border bg-[var(--surface)] px-3 py-2"/></label><div className="flex flex-wrap gap-2"><button type="button" disabled={!!busy||!shopForm.note.trim()} onClick={()=>shoppingAction(r.id,"offer_quote")} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white">Send final quote</button><button type="button" disabled={!!busy} onClick={()=>shoppingAction(r.id,"contacted")} className="rounded-xl border px-4 py-2 text-xs font-semibold">Contacted store</button><button type="button" disabled={!!busy} onClick={()=>shoppingAction(r.id,"cannot_fulfil")} className="rounded-xl border px-4 py-2 text-xs font-semibold">Can't fulfil</button><button type="button" onClick={()=>setShoppingOpen("")} className="rounded-xl border px-4 py-2 text-xs font-semibold">Close</button></div></div>}
 </article>)}</section>}
   {tab==="locations"&&<section className="mt-6 rounded-2xl border bg-[var(--surface)] p-6"><p className="font-semibold">Independent listings</p><p className="mt-2 text-sm text-[var(--text-2)]">Maintain independently checked prices in the dedicated curator. Each listing remains separate from verified merchant finances.</p><Link href="/admin/independent-shopping" className="mt-4 inline-block rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">Open listing curator</Link></section>}
   {tab==="availability"&&<section className="mt-6 max-w-2xl rounded-2xl border bg-[var(--surface)] p-6"><Power className="h-6 w-6 text-[var(--accent)]"/><h2 className="mt-4 text-xl font-semibold">Can this location accept Assist requests?</h2><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Yes by default. Turn it off when the business asks to opt out, is unavailable, or cannot be served. This doesn't bypass actual booking, payment or Driver capacity checks.</p><label className="mt-5 block text-xs font-semibold">Find business by name or city<input value={businessSearch} onChange={e=>setBusinessSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();findBusinesses();}}} placeholder="Search business names or cities" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2"/></label><button type="button" onClick={findBusinesses} disabled={searching} className="mt-2 rounded-xl border px-4 py-2 text-sm font-semibold">{searching?"Searching…":"Find businesses"}</button><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{businessOptions.map(b=><button key={b.id} type="button" onClick={()=>{setBusinessId(b.id);setAccepting(b.accepting);}} className={`w-full rounded-xl border p-3 text-left text-sm ${businessId===b.id?"border-[var(--accent)] bg-[var(--accent-soft)]":"bg-[var(--surface)]"}`}><span className="block font-semibold">{b.name}</span><span className="mt-1 block text-xs text-[var(--text-2)]">{b.city} · {b.country} · {b.accepting?"Accepting requests":"Paused"}</span></button>)}</div><label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" disabled={!businessId} checked={accepting} onChange={e=>setAccepting(e.target.checked)}/> Accept assisted requests</label><button type="button" disabled={!businessId.trim()||!!busy} onClick={setAvailability} className="mt-5 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save location availability</button><p className="mt-3 text-xs text-[var(--text-3)]">{businessId?"Selected business: "+businessId:"Select a business above to modify its availability."}</p></section>}
  </main>
 </PortalShell></AdminAccess></AuthGate>;
}
