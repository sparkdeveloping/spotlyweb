"use client";
import { useEffect,useMemo,useState } from "react";
import Link from "next/link";
import { ArrowLeft,Globe2,MapPin,RefreshCw,ShieldCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { AdminAccess } from "@/components/admin-legacy-sections";
const title={eat:"Eat — assisted shopping",shop:"Shop — assisted purchase",book:"Book — appointment requests"};
export function AssistCoverageManager(){
 const [data,setData]=useState({countries:[],services:["eat","shop","book"],coverage:{}}),[country,setCountry]=useState("ZW"),[city,setCity]=useState(""),[area,setArea]=useState(""),[service,setService]=useState("eat"),[enabled,setEnabled]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 async function load(){
  setBusy(true);setError("");
  try{setData(await authenticatedFetch("/api/admin/assist-coverage"));}
  catch(err){setError(err.message);}finally{setBusy(false);}
 }
 useEffect(()=>{load();},[]);
 const known=data.countries.find(c=>c.code===country),coverage=data.coverage||{};
 const entries=(coverage.regions||[]).filter(r=>r.country===country);
 const globalEnabled=coverage.countries?.[country]?.enabled!==false;
 const availability=s=>coverage.countries?.[country]?.services?.[s] === true || (country==="ZW" && coverage.countries?.[country]?.services?.[s]!==false);
 async function update(payload){
  setBusy(true);setError("");setMessage("");
  try{
   const result=await authenticatedFetch("/api/admin/assist-coverage",{method:"PATCH",body:JSON.stringify({country,...payload})});
   setData(d=>({...d,coverage:result.coverage}));setMessage("Coverage settings updated and audited.");
  }catch(err){setError(err.message);}finally{setBusy(false);}
 }
 return <AuthGate portal="admin" title="Sign in to Spotly Admin"><AdminAccess><PortalShell portalId="admin" activeSection="marketplace"><main className="mx-auto max-w-[1150px] px-5 py-9">
 <Link href="/assist" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]"><ArrowLeft className="h-4 w-4"/>Assist Operations</Link>
 <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]"><Globe2 className="h-4 w-4"/>Spotly Africa</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">Country & service coverage</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">An unset switch is eligible by default in Zimbabwe. Malawi begins with Ride only; Assist, Eat, Shop and Book must be explicitly enabled there. Only independently reviewed, serviceable locations can actually fulfill requests; no checkout or dispatch is unlocked here.</p></div><button type="button" onClick={load} className="rounded-xl border p-3" aria-label="Refresh"><RefreshCw className="h-4 w-4"/></button></div>
 {error&&<p role="alert" className="mt-5 rounded-xl border p-4 text-sm text-[var(--danger)]">{error}</p>}
 {message&&<p role="status" className="mt-5 rounded-xl border p-4 text-sm text-[var(--success)]">{message}</p>}
 <section className="mt-7 grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
  <div className="rounded-2xl border bg-[var(--surface)] p-5"><h2 className="font-semibold">Select a country</h2><div className="mt-4 space-y-2">{data.countries.map(entry=><button key={entry.code} onClick={()=>{setCountry(entry.code);setCity("");setArea("");}} className={`block w-full rounded-xl border p-4 text-left text-sm ${entry.code===country?"border-[var(--accent)] bg-[var(--accent-soft)]":""}`}><span className="block font-semibold">{entry.name}</span><span className="mt-1 block text-xs text-[var(--text-2)]">{entry.code} · {entry.currency} · {entry.timezone}</span></button>)}</div><label className="mt-4 block text-xs font-semibold">Other African country (ISO-2)<input maxLength={2} value={known?"":country} onChange={e=>setCountry(e.target.value.toUpperCase().replace(/[^A-Z]/g,""))} placeholder="ZM, BW, ZA…" className="mt-2 w-full rounded-xl border bg-transparent px-4 py-2.5 text-sm"/></label></div>
  <div className="space-y-5">
   <section className="rounded-2xl border bg-[var(--surface)] p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[var(--accent)]"/><h2 className="font-semibold">{known?.name||country} · Country gate</h2></div><p className="mt-2 text-xs text-[var(--text-2)]">Independent from merchant order/payment activation.</p><label className="mt-5 flex items-center justify-between gap-3 text-sm"><span className="font-semibold">Country eligible for assisted requests</span><input type="checkbox" checked={globalEnabled} disabled={busy||country.length!==2} onChange={e=>update({countryEnabled:e.target.checked})} className="h-5 w-5"/></label><div className="mt-5 space-y-3 border-t pt-4">{data.services.map(s=><label key={s} className="flex items-center justify-between gap-3 text-sm"><span>{title[s]}</span><input type="checkbox" checked={availability(s)} disabled={busy||country.length!==2} onChange={e=>update({service:s,serviceEnabled:e.target.checked})} className="h-5 w-5"/></label>)}</div></section>
   <section className="rounded-2xl border bg-[var(--surface)] p-5"><h2 className="font-semibold">Override one city or area</h2><p className="mt-2 text-xs leading-5 text-[var(--text-2)]">Leave fields blank for a country-wide service rule. City and area exceptions override country defaults when matched.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">City<select value={city} onChange={e=>setCity(e.target.value)} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm"><option value="">All cities</option>{(known?.cities||[]).map(c=><option key={c} value={c}>{c}</option>)}</select></label><label className="text-xs font-semibold">Area<input value={area} onChange={e=>setArea(e.target.value)} maxLength={100} placeholder="Optional suburb or zone" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm"/></label><label className="text-xs font-semibold">Service<select value={service} onChange={e=>setService(e.target.value)} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm">{data.services.map(s=><option key={s} value={s}>{title[s]}</option>)}</select></label><label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Allow requests here</label></div><button disabled={busy||country.length!==2} onClick={()=>update({rules:[{country,city,area,service,enabled}]})} className="mt-5 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy?"Saving…":"Save geographic override"}</button><h3 className="mt-7 font-semibold">Overrides for this country</h3><div className="mt-3 space-y-2">{entries.map((r,i)=><div key={i} className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-3 text-xs"><span>{r.city||"Entire country"}{r.area?" · "+r.area:""} · {r.service}</span><strong>{r.enabled?"Allowed":"Paused"}</strong></div>)}{!entries.length&&<p className="text-sm text-[var(--text-2)]">No exceptions. Country settings apply.</p>}</div></section>
  </div>
 </section>
 </main></PortalShell></AdminAccess></AuthGate>;
}
