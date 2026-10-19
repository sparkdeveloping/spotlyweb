"use client";
import { useEffect,useRef,useState } from "react";
import Link from "next/link";
import { ArrowLeft,CalendarDays,CheckCircle2,Clock3,Info } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { spotlyLoginUrl } from "@/lib/spotly-domains";
const stamp=value=>value?new Date(value).toLocaleString("en-ZW",{dateStyle:"medium",timeStyle:"short"}):"";
export function AssistBookingApp(){
 const [id,setId]=useState(""),[record,setRecord]=useState(null),[requests,setRequests]=useState([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const [form,setForm]=useState({serviceName:"",requestedDate:"",requestedTime:"14:00",flexibility:"nearby",phone:"",notes:""});
 const requestId=useRef(null);
 async function refresh(){
  try{
   const result=await authenticatedFetch("/api/customer/assist-bookings");
   setRequests(result.bookings||[]);
  }catch(e){setError(e.message);}
 }
 useEffect(()=>{setId(new URLSearchParams(window.location.search).get("business")||"");refresh().finally(()=>setLoading(false));},[]);
 async function submit(e){
  e.preventDefault();setSaving(true);setError("");
  if(!requestId.current)requestId.current=crypto.randomUUID().replaceAll("-","");
  try{
   const input={requestId:requestId.current,businessId:id,serviceName:form.serviceName,requestedAt:new Date(form.requestedDate+"T"+form.requestedTime+":00").toISOString(),flexibility:form.flexibility,phone:form.phone,notes:form.notes};
   const result=await authenticatedFetch("/api/customer/assist-bookings",{method:"POST",body:JSON.stringify(input)});
   setRecord(result);requestId.current=null;await refresh();
  }catch(err){setError(err.message);}finally{setSaving(false);}
 }
 async function respond(id,decision){
  setSaving(true);setError("");
  try{await authenticatedFetch("/api/customer/assist-bookings/respond",{method:"POST",body:JSON.stringify({id,decision})});await refresh();}
  catch(err){setError(err.message);}finally{setSaving(false);}
 }
 return <main className="mx-auto max-w-[950px] px-5 py-10"><Link href="/book" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]"><ArrowLeft className="h-4 w-4"/>Explore services</Link>
  <section className="mt-6 overflow-hidden rounded-3xl bg-[#201947] px-7 py-9 text-white sm:p-11"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"><CalendarDays className="h-4 w-4"/>Spotly Assist</div><h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">Tell us when. We'll check.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-white/80">Request a preferred appointment time. Spotly contacts the business and confirms availability before your booking becomes final.</p></section>
  <section className="mt-6 rounded-2xl border bg-[var(--surface)] p-5 sm:p-7"><div className="flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"/><p className="text-sm leading-6 text-[var(--text-2)]">Spotly Assist is an independent arranging service, not a guarantee that the business partners with Spotly. No appointment is confirmed or payment collected when you submit this request. We may contact you with another available time.</p></div></section>
  {!id?<p className="mt-6 rounded-xl border p-5 text-sm">Choose a service provider from Spotly Book to request help.</p>:<form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border bg-[var(--surface)] p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Your preferred appointment</h2>
    <label className="block text-sm font-semibold">What would you like to book?<input required minLength={2} maxLength={160} value={form.serviceName} onChange={e=>setForm(s=>({...s,serviceName:e.target.value}))} className="mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-sm" placeholder="Hair styling, massage, consultation…"/></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Preferred date<input required type="date" min={new Date().toISOString().slice(0,10)} value={form.requestedDate} onChange={e=>setForm(s=>({...s,requestedDate:e.target.value}))} className="mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-sm"/></label><label className="block text-sm font-semibold">Preferred time<input required type="time" value={form.requestedTime} onChange={e=>setForm(s=>({...s,requestedTime:e.target.value}))} className="mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-sm"/></label></div>
    <label className="block text-sm font-semibold">If that time isn't available<select value={form.flexibility} onChange={e=>setForm(s=>({...s,flexibility:e.target.value}))} className="mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-sm"><option value="nearby">Suggest another nearby time</option><option value="any_time_that_day">Any available time that day</option><option value="exact">Only this exact time</option></select></label>
    <label className="block text-sm font-semibold">Contact phone<input required type="tel" minLength={7} value={form.phone} onChange={e=>setForm(s=>({...s,phone:e.target.value}))} className="mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-sm" placeholder="+263 …"/></label>
    <label className="block text-sm font-semibold">Additional details (optional)<textarea maxLength={600} rows={2} value={form.notes} onChange={e=>setForm(s=>({...s,notes:e.target.value}))} className="mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-sm"/></label>
    {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error} {error.toLowerCase().includes("sign in")&&<Link className="underline" href={spotlyLoginUrl("customer",{next:window.location.pathname+window.location.search})}>Sign in</Link>}</p>}
    {record&&<p role="status" className="flex items-center gap-2 text-sm text-[var(--success)]"><CheckCircle2 className="h-4 w-4"/>Request received. The business has not confirmed it yet.</p>}
    <button disabled={saving} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-50">{saving?"Saving…":"Request appointment check"}</button>
  </form>}
  <section className="mt-9"><h2 className="text-xl font-semibold">Your assisted bookings</h2>{loading?<p className="mt-4 text-sm text-[var(--text-2)]">Loading requests…</p>:<div className="mt-4 space-y-3">{requests.length===0&&<p className="rounded-xl border p-5 text-sm text-[var(--text-2)]">No assisted booking requests yet.</p>}{requests.map(r=><div key={r.id} className="rounded-xl border bg-[var(--surface)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{r.businessName} · {r.serviceName}</h3><span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold">{r.state.replaceAll("_"," ")}</span></div><p className="mt-2 text-sm text-[var(--text-2)]"><Clock3 className="mr-1 inline h-4 w-4"/>{stamp(r.requestedAt)}</p>{r.customerMessage&&<p className="mt-2 text-sm text-[var(--text-2)]">{r.customerMessage}</p>}{r.state==="alternative_offered"&&r.alternativeAt&&<div className="mt-4 rounded-xl bg-[var(--surface-2)] p-4"><p className="font-semibold">Alternative: {stamp(r.alternativeAt)}</p><div className="mt-3 flex gap-2"><button type="button" disabled={saving} onClick={()=>respond(r.id,"accept_alternative")} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Accept</button><button type="button" disabled={saving} onClick={()=>respond(r.id,"decline_alternative")} className="rounded-xl border px-4 py-2 text-sm font-semibold">Try another time</button></div></div>}{!["confirmed","cancelled","declined"].includes(r.state)&&<button type="button" disabled={saving} onClick={()=>respond(r.id,"cancel")} className="mt-3 text-xs font-semibold text-[var(--text-2)] underline">Cancel request</button>}</div>)}</div>}</section>
 </main>;
}
