"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ShoppingBasket,ReceiptText,ShieldCheck,ArrowLeft} from "lucide-react";
import {AuthGate} from "@/components/auth-gate";
import {PortalShell} from "@/components/portal-shell";
import {authenticatedFetch} from "@/lib/api-client";
export function AssistShoppingWorkspace(){
 const [jobs,setJobs]=useState([]),[error,setError]=useState(""),[busy,setBusy]=useState("");
 const [values,setValues]=useState({}),[files,setFiles]=useState({});
 const load=async()=>{const x=await authenticatedFetch("/api/driver/assist-shopping");setJobs(x.jobs||[]);};
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 function change(id,key,value){setValues(s=>({...s,[id]:{...(s[id]||{}),[key]:value}}));}
 async function update(id,action,extra={}){setBusy(id+action);setError("");try{await authenticatedFetch("/api/driver/assist-shopping",{method:"POST",body:JSON.stringify({requestId:id,action,...extra})});await load();}catch(e){setError(e.message);}finally{setBusy("");}}
 async function upload(id){setBusy(id+"upload");setError("");try{const f=files[id];if(!f)throw Error("Choose your receipt photo or PDF first.");const data=new FormData();data.set("requestId",id);data.set("receipt",f);await authenticatedFetch("/api/driver/assist-shopping/receipt",{method:"POST",body:data});await load();}catch(e){setError(e.message);}finally{setBusy("");}}
 return <AuthGate portal="driver" title="Driver sign in"><PortalShell portalId="driver" activeSection="jobs"><main className="mx-auto max-w-[900px] px-5 py-9">
 <Link href="/driver/jobs" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4"/>Driver Jobs</Link>
 <div className="mt-6 flex items-start gap-4"><ShoppingBasket className="h-8 w-8 text-[var(--accent)]"/><div><h1 className="text-3xl font-semibold">Independent Shop & Deliver</h1><p className="mt-2 text-sm text-[var(--text-2)]">Assigned, customer-funded purchases only. Never spend your own money or proceed without authorized float.</p></div></div>
 {error&&<p role="alert" className="mt-5 rounded-xl border p-4 text-sm text-[var(--danger)]">{error}</p>}
 <div className="mt-7 space-y-4">{jobs.length===0&&<p className="rounded-xl border p-6 text-sm">No independent shopping assignments right now.</p>}
 {jobs.map(job=><section key={job.id} className="rounded-2xl border bg-[var(--surface)] p-6">
 <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">{job.storeName}</h2><p className="mt-1 text-sm text-[var(--text-2)]">Authorized merchandise: USD {Number(job.authorizedSpend).toFixed(2)}</p></div><span className="rounded-full bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold">{job.state}</span></div>
 {job.state==="assigned"&&<button disabled={!!busy} onClick={()=>update(job.id,"start")} className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Start shopping</button>}
 {job.state==="shopping"&&<>
 <div className="mt-5 space-y-3">{(job.items||[]).map(item=><div key={item.itemId} className="rounded-xl border p-4"><p className="font-semibold">{item.quantity}× {item.name}</p><p className="mt-1 text-xs text-[var(--text-2)]">Status: {item.status}</p>
 <div className="mt-3 flex flex-wrap gap-2"><input type="number" min="1" max={item.quantity} placeholder="Actual quantity" className="w-28 rounded-lg border px-2 py-2 text-sm" value={values[job.id+item.itemId]?.quantity||""} onChange={e=>change(job.id+item.itemId,"quantity",e.target.value)}/><input type="number" min="0" step=".01" placeholder="Shelf price" className="w-32 rounded-lg border px-2 py-2 text-sm" value={values[job.id+item.itemId]?.price||""} onChange={e=>change(job.id+item.itemId,"price",e.target.value)}/>
 <button disabled={!!busy||!values[job.id+item.itemId]?.quantity||values[job.id+item.itemId]?.price===undefined} className="rounded-lg border px-3 py-2 text-xs font-semibold" onClick={()=>update(job.id,"item",{itemId:item.itemId,itemStatus:"found",actualQuantity:Number(values[job.id+item.itemId]?.quantity),actualUnitPrice:Number(values[job.id+item.itemId]?.price)})}>Confirm found</button><button disabled={!!busy} onClick={()=>update(job.id,"item",{itemId:item.itemId,itemStatus:"unavailable"})} className="rounded-lg border px-3 py-2 text-xs font-semibold">Unavailable</button></div></div>)}</div>
 <div className="mt-5 rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><ReceiptText className="h-4 w-4"/>Receipt evidence</p><p className="mt-1 text-xs text-[var(--text-2)]">Upload the actual shop receipt before submitting for operator review.</p><input className="mt-3 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setFiles(v=>({...v,[job.id]:e.target.files?.[0]||null}))}/><div className="mt-4 flex gap-2"><button disabled={!!busy||!files[job.id]} onClick={()=>upload(job.id)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Upload receipt</button><button disabled={!!busy} onClick={()=>update(job.id,"receipt")} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">Submit for review</button></div></div>
 </>}
 {job.state==="collected"&&<button disabled={!!busy} onClick={()=>update(job.id,"en_route")} className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Start delivery</button>}
 {job.state==="en_route"&&<div className="mt-5 flex flex-wrap gap-2"><input type="text" maxLength={6} placeholder="Customer handoff PIN" className="rounded-lg border px-3 py-2 text-sm" value={values[job.id]?.pin||""} onChange={e=>change(job.id,"pin",e.target.value)}/><button disabled={!!busy||!/^[0-9]{6}$/.test(values[job.id]?.pin||"")} onClick={()=>update(job.id,"complete",{pin:values[job.id]?.pin})} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white">Confirm delivery</button></div>}
 {job.state==="delivered"&&<p className="mt-4 flex gap-2 text-sm"><ShieldCheck className="h-4 w-4"/>Delivery completed with customer handoff PIN.</p>}
 </section>)}</div></main></PortalShell></AuthGate>;
}
