"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {AuthGate} from "@/components/auth-gate";
import {useAuth} from "@/components/firebase-provider";
import {AdminAccess} from "@/components/admin-legacy-sections";
import {PortalShell} from "@/components/portal-shell";
import {authenticatedFetch} from "@/lib/api-client";
import {ArrowLeft,RefreshCw,MessageCircle,Building2} from "lucide-react";
const states=["new","seen","contacted","qualified","verification_invited","closed"];
function Records(){const {user}=useAuth();const [query,setQuery]=useState(""),[items,setItems]=useState([]),[cursor,setCursor]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[pending,setPending]=useState(null),[filter,setFilter]=useState("all"),[notes,setNotes]=useState({}),[history,setHistory]=useState({}),[openHistory,setOpenHistory]=useState("");
 const load=useCallback(async (after="")=>{setLoading(true);setError("");try{const payload=await authenticatedFetch("/api/public/business-registrations?limit=40"+(after?"&cursor="+encodeURIComponent(after):""));setItems(old=>after?[...old,...payload.registrations]:payload.registrations);setCursor(payload.nextCursor||null);}catch(e){setError(e.message||"Could not load registrations.");}finally{setLoading(false);}},[]);
 useEffect(()=>{load();},[load]);
 async function change(id,update){setPending(id);setError("");try{
   const result=await authenticatedFetch("/api/public/business-registrations",{method:"PATCH",body:JSON.stringify({id,...update})});
   setItems(xs=>xs.map(x=>x.id===id?{...x,status:result.status||x.status,assignedTo:result.assignedTo??x.assignedTo}:x));
   if(update.note)setNotes(n=>({...n,[id]:""}));
   if(openHistory===id)await loadHistory(id);
 }catch(e){setError(e.message||"Update failed.");}finally{setPending(null);}}
 async function loadHistory(id){setError("");try{const result=await authenticatedFetch("/api/public/business-registrations?history="+encodeURIComponent(id));setHistory(old=>({...old,[id]:result.history||[]}));}
 catch(e){setError(e.message||"Follow-up history could not load.");}}
 async function toggleHistory(id){if(openHistory===id){setOpenHistory("");return;}setOpenHistory(id);await loadHistory(id);}
 const visible=items.filter(x=>{
   if(filter!=="all"&&x.status!==filter)return false;
   const search=query.trim().toLowerCase();
   return !search||[x.businessName,x.applicantName,x.country,x.city,x.category,x.email,x.phone].some(v=>String(v||"").toLowerCase().includes(search));
 });
 return <div className="mx-auto max-w-6xl p-5 sm:p-9"><Link href="/business-register" className="inline-flex items-center gap-2 text-sm text-secondary"><ArrowLeft className="h-4 w-4"/>Business register</Link><div className="mt-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">Business acquisition</p><h1 className="mt-2 text-3xl font-bold">Registrations</h1><p className="mt-2 text-sm text-secondary">Prospective businesses waiting for follow-up. A lead is not an approved merchant.</p></div><button className="inline-flex items-center gap-2 rounded-xl border px-4 py-2" onClick={()=>load()} disabled={loading}><RefreshCw className="h-4 w-4"/>Refresh</button></div>
 <label className="mt-5 block max-w-md text-sm font-semibold">Search registrations
   <input className="field-control mt-2 w-full" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Business, name, city or contact"/>
 </label>
 <div className="mt-6 flex flex-wrap gap-2">{["all",...states].map(s=><button key={s} onClick={()=>setFilter(s)} className={"rounded-full border px-3 py-1.5 text-xs font-semibold "+(filter===s?"bg-[var(--accent)] text-[var(--on-accent)]":"")}>{s.replaceAll("_"," ")}</button>)}</div>
 {error?<p role="alert" className="mt-4 rounded-xl border p-3 text-sm text-danger">{error}</p>:null}
 <div className="mt-5 grid gap-3">{visible.map(x=><article key={x.id} className="rounded-[20px] border bg-[var(--surface)] p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">{x.businessName}</h2><p className="mt-1 text-sm text-secondary">{x.city}, {x.country} · {x.category}</p><p className="mt-2 text-sm">{x.applicantName} · {x.roleAtBusiness}</p><p className="mt-1 text-sm text-secondary">{x.contactPreference}: {x.phone}{x.email?" · "+x.email:""}</p></div><div className="flex flex-col items-start gap-2"><span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold">{x.status.replaceAll("_"," ")}</span><span className="text-xs text-secondary">{x.createdAt?new Date(x.createdAt).toLocaleDateString():"New"}</span></div></div>
 <div className="mt-4 flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-secondary">Update stage <select disabled={pending===x.id} value={x.status} onChange={e=>change(x.id,{status:e.target.value})} className="ml-2 rounded-lg border bg-[var(--surface)] p-2 text-sm">{states.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label><div className="ml-auto flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--accent)]">
    {x.contactPreference==="whatsapp"&&x.phone?<a href={"https://wa.me/"+x.phone.replace(/\D/g,"")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"><MessageCircle className="h-4 w-4"/>WhatsApp</a>:null}
    {x.phone?<a href={"tel:"+x.phone.replace(/[^+\d]/g,"")} className="underline">Call</a>:null}
    {x.email?<a href={"mailto:"+x.email} className="underline">Email</a>:null}
    <Link href="/work" className="underline">Admin work</Link>
  </div></div>
  <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs font-semibold text-secondary">{x.assignedTo ? (x.assignedTo===user?.uid ? "Assigned to you" : "Assigned to another team member") : "Not yet assigned"}</p>
      <div className="flex flex-wrap gap-2">
        {!x.assignedTo ? <button disabled={pending===x.id} onClick={()=>change(x.id,{assignmentAction:"claim"})} className="rounded-lg border px-3 py-2 text-xs font-semibold">Take follow-up</button> : x.assignedTo===user?.uid ? <button disabled={pending===x.id} onClick={()=>change(x.id,{assignmentAction:"release"})} className="rounded-lg border px-3 py-2 text-xs font-semibold">Release</button> : null}
        <button onClick={()=>toggleHistory(x.id)} className="rounded-lg border px-3 py-2 text-xs font-semibold" aria-expanded={openHistory===x.id}> {openHistory===x.id?"Hide history":"View history"} </button>
      </div>
    </div>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-xs font-semibold text-secondary">Private follow-up note
        <textarea className="field-control mt-1 w-full" rows={2} maxLength={1500} placeholder="Record the outcome of a call or next action. Avoid unnecessary personal details." value={notes[x.id]||""} onChange={e=>setNotes(old=>({...old,[x.id]:e.target.value}))}/>
      </label>
      <button disabled={pending===x.id||!(notes[x.id]||"").trim()} onClick={()=>change(x.id,{note:(notes[x.id]||"").trim()})} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold">Save note</button>
    </div>
    {x.linkedClaimId && <p className="mt-3 text-xs text-secondary">Verified application linked · <Link className="font-semibold underline" href={"/queues/business-claims?status=open"}>Open verification queue</Link></p>}
    {openHistory===x.id && <div className="mt-4 border-t pt-3"><h3 className="text-sm font-semibold">Follow-up activity</h3>{(history[x.id]||[]).length ? <ul className="mt-2 space-y-3">{history[x.id].map(event=><li className="border-l-2 border-business pl-3 text-xs" key={event.id}><span className="font-semibold capitalize">{event.action.replaceAll("_"," ")}</span> · {event.createdAt?new Date(event.createdAt).toLocaleString():"Recorded"}{event.from!==event.to&&<p className="mt-1 text-secondary">{event.from} → {event.to}</p>}{event.note&&<p className="mt-1 whitespace-pre-wrap text-secondary">{event.note}</p>}</li>)}</ul> : <p className="mt-2 text-xs text-secondary">No follow-up events recorded yet.</p>}</div>}
  </div>
 </article>)}{!loading&&visible.length===0?<p className="rounded-xl border p-7 text-sm text-secondary">No registrations in this stage.</p>:null}</div>
 {cursor?<button disabled={loading} className="mt-6 rounded-xl border px-5 py-3 font-semibold" onClick={()=>load(cursor)}>Load more</button>:null}{loading?<p role="status" className="mt-5 text-sm text-secondary">Checking registrations…</p>:null}
 <p className="mt-6 text-xs text-secondary">Staff access is permission checked on every request. Do not export applicant contact details to personal devices.</p></div>;
}
export function AdminBusinessRegistrations(){return <AuthGate portal="admin" title="Sign in to manage registrations"><AdminAccess><PortalShell portalId="admin" activeSection="work" footer={false}><Records/></PortalShell></AdminAccess></AuthGate>;}
