"use client";

import {useEffect,useState} from "react";
import {ShoppingBasket,ReceiptText,ShieldCheck,RefreshCw} from "lucide-react";
import {authenticatedFetch} from "@/lib/api-client";

const money=value=>"USD "+Number(value||0).toFixed(2);
const title=value=>String(value||"").replaceAll("_"," ");
const inputClass="mt-1 w-full rounded-lg border bg-[var(--surface)] px-3 py-2 text-sm";
const buttonClass="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40";

export function DriverAssistShopping({mode="jobs"}){
 const [jobs,setJobs]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [notice,setNotice]=useState(""),[busy,setBusy]=useState(""),[drafts,setDrafts]=useState({});
 const [files,setFiles]=useState({}),[pins,setPins]=useState({});
 const load=async()=>{const result=await authenticatedFetch("/api/driver/assist-shopping");setJobs(result.jobs||[]);};
 useEffect(()=>{let live=true;authenticatedFetch("/api/driver/assist-shopping").then(r=>{if(live)setJobs(r.jobs||[]);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 const setDraft=(key,field,value)=>setDrafts(current=>({...current,[key]:{...(current[key]||{}),[field]:value}}));
 async function act(job,action,item){
  setBusy(job.id+action+(item?.itemId||""));setError("");setNotice("");
  try{
   const body={requestId:job.id,action:action==="item_unavailable"?"item":action};
   if(item){
    const d=drafts[job.id+":"+item.itemId]||{};
    body.itemId=item.itemId;
    if(action==="item"||action==="item_unavailable"){
     body.itemStatus=action==="item_unavailable"?"unavailable":"found";
     body.actualQuantity=body.itemStatus==="unavailable"?0:Number(d.quantity||item.quantity);
     body.actualUnitPrice=body.itemStatus==="unavailable"?0:Number(d.price);
    }else{
     body.replacementName=d.replacementName||"";
     body.actualQuantity=Number(d.quantity||item.quantity);
     body.actualUnitPrice=Number(d.price);
     body.note=d.note||"";
    }
   }
   if(action==="complete")body.pin=pins[job.id]||"";
   await authenticatedFetch("/api/driver/assist-shopping",{method:"POST",body:JSON.stringify(body)});
   await load();
   setNotice("Shopping job updated: "+title(action)+".");
  }catch(e){setError(e.message||"Could not update the shopping job.");}
  finally{setBusy("");}
 }
 async function uploadReceipt(job){
  const file=files[job.id];if(!file){setError("Select the actual store receipt first.");return;}
  setBusy(job.id+"upload");setError("");setNotice("");
  try{
   const body=new FormData();body.append("requestId",job.id);body.append("receipt",file);
   await authenticatedFetch("/api/driver/assist-shopping/receipt",{method:"POST",body});
   await authenticatedFetch("/api/driver/assist-shopping",{method:"POST",body:JSON.stringify({requestId:job.id,action:"receipt"})});
   await load();setNotice("Receipt submitted for independent Operations review. Do not start delivery yet.");
  }catch(e){setError(e.message||"Receipt submission failed.");}
  finally{setBusy("");}
 }
 const visible=jobs.filter(j=>mode==="active"
  ? ["accepted","shopping","receipt_submitted","collected","en_route"].includes(j.state)
  : !["delivered","rejected"].includes(j.state));
 if(loading)return <div className="my-5 rounded-2xl border p-5 text-sm text-[var(--text-2)]">Checking independent shopping work…</div>;
 if(!visible.length&&!error)return null;
 return <section aria-label="Independent shopping assignments" className="my-6 space-y-4">
  <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ShoppingBasket className="h-5 w-5 text-[var(--accent)]"/><h2 className="text-lg font-semibold">Spotly Assist · Independent shopping</h2></div><button className={buttonClass} disabled={!!busy} onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw className="h-4 w-4"/></button></div>
  <p className="text-xs text-[var(--text-2)]">These are separately funded third-party purchases, not merchant delivery orders. Never shop before accepting the assignment and checking your authorized funds.</p>
  {error&&<p role="alert" className="rounded-xl border p-3 text-sm text-[var(--danger)]">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border p-3 text-sm">{notice}</p>}
  {visible.map(job=><article key={job.id} className="rounded-2xl border bg-[var(--surface)] p-5">
   <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{job.storeName||"Independent purchase"}</h3><p className="mt-1 text-xs text-[var(--text-2)]">{job.storeAddress||"Store address must be confirmed by Operations"}</p><p className="mt-1 text-xs text-[var(--text-2)]">Customer delivery: {job.deliveryAddress||"Ask Operations for delivery details"}</p></div><span className="text-xs font-semibold capitalize">{title(job.state)}</span></div>
   <p className="mt-3 flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4"/> Authorized merchandise {money(job.authorizedSpend)} · no extra spending permitted</p>
   {job.state==="assigned"&&<div className="mt-4 flex gap-2"><button disabled={!!busy} className={buttonClass} onClick={()=>act(job,"accept")}>Accept assignment</button><button disabled={!!busy} className={buttonClass} onClick={()=>act(job,"reject")}>Decline</button></div>}
   {job.state==="accepted"&&<button disabled={!!busy} className={buttonClass+" mt-4"} onClick={()=>act(job,"start")}>Start in-store shopping</button>}
   {job.state==="shopping"&&<div className="mt-5 space-y-4">
    {(job.items||[]).map(item=>{const key=job.id+":"+item.itemId;const d=drafts[key]||{};return <div key={item.itemId} className="rounded-xl border p-3">
     <p className="font-semibold">{item.name} · requested {item.quantity}</p><p className="text-xs text-[var(--text-2)]">Current: {title(item.status)}</p>
     {item.status==="substitution_pending"?<p className="mt-2 text-sm">Waiting for the customer's replacement decision. Do not purchase the replacement yet.</p>:<div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs">Actual quantity<input className={inputClass} type="number" min="1" max={item.quantity} value={d.quantity??item.quantity} onChange={e=>setDraft(key,"quantity",e.target.value)}/></label>
      <label className="text-xs">Actual or proposed unit price (USD)<input className={inputClass} type="number" min="0" step="0.01" value={d.price??""} onChange={e=>setDraft(key,"price",e.target.value)}/></label>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
       <button className={buttonClass} disabled={!!busy||d.price===undefined||d.price===""} onClick={()=>act(job,"item",item)}>Mark found</button>
       <button className={buttonClass} disabled={!!busy} onClick={()=>act(job,"item_unavailable",item)}>Unavailable</button>
      </div>
      <label className="text-xs sm:col-span-2">Replacement name<input className={inputClass} value={d.replacementName??""} onChange={e=>setDraft(key,"replacementName",e.target.value)}/></label>
      <label className="text-xs sm:col-span-2">Reason for proposed replacement<input className={inputClass} value={d.note??""} onChange={e=>setDraft(key,"note",e.target.value)}/></label>
      <button className={buttonClass+" sm:col-span-2"} disabled={!!busy||d.price===undefined||d.price===""||!d.replacementName||!d.note} onClick={()=>act(job,"propose_substitution",item)}>Ask customer to approve replacement</button>
     </div>}
    </div>})}
    <div className="rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><ReceiptText className="h-4 w-4"/> Store receipt</p><p className="mt-1 text-xs text-[var(--text-2)]">Complete every item outcome before submitting. Upload the actual receipt (PDF or image, maximum 5 MB).</p>
     <input aria-label="Actual store receipt" className="mt-3 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setFiles(v=>({...v,[job.id]:e.target.files?.[0]||null}))}/>
     <button disabled={!!busy||!files[job.id]} className={buttonClass+" mt-3"} onClick={()=>uploadReceipt(job)}>Submit receipt for review</button>
    </div>
   </div>}
   {job.state==="receipt_submitted"&&<p className="mt-4 text-sm text-[var(--text-2)]">Receipt submitted. Wait for Operations to verify the purchase before delivery.</p>}
   {job.state==="collected"&&<button disabled={!!busy} className={buttonClass+" mt-4"} onClick={()=>act(job,"en_route")}>Begin delivery</button>}
   {job.state==="en_route"&&<div className="mt-4 space-y-2"><label className="block text-xs">Six-digit PIN from the customer at handoff<input className={inputClass} inputMode="numeric" maxLength={6} autoComplete="off" value={pins[job.id]||""} onChange={e=>setPins(v=>({...v,[job.id]:e.target.value.replace(/[^0-9]/g,"").slice(0,6)}))}/></label><button disabled={!!busy||(pins[job.id]||"").length!==6} className={buttonClass} onClick={()=>act(job,"complete")}>Confirm verified delivery</button></div>}
  </article>)}
 </section>;
}
