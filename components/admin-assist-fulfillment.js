"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ClipboardCheck,ShieldCheck} from "lucide-react";
import {AuthGate} from "@/components/auth-gate";
import {AdminAccess} from "@/components/admin-legacy-sections";
import {PortalShell} from "@/components/portal-shell";
import {authenticatedFetch} from "@/lib/api-client";
import {getFirebaseClient,getFirebaseAppCheckToken} from "@/lib/firebase";
const field="mt-1 block w-full rounded-xl border bg-[var(--surface)] px-3 py-3 text-sm";
export function AssistFulfillmentAdmin(){
 const [data,setData]=useState({jobs:[],requests:[],refunds:[],shoppingIssues:[],floatTransfers:[],closures:[]}),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [form,setForm]=useState({requestId:"",driverId:"",amount:"",transferReference:"",transferEvidenceUrl:"",note:""});
 const [refundForm,setRefundForm]=useState({id:"",externalReference:"",evidenceUrl:"",note:""});
 const [floatForm,setFloatForm]=useState({id:"",returnAmount:"",returnReference:"",evidenceUrl:"",note:""});
 const load=async()=>{
  const operations=await authenticatedFetch("/api/admin/assist-fulfillment");
  const [finance,closure]=await Promise.all([
   authenticatedFetch("/api/admin/assist-refunds").catch(()=>({refunds:operations.refunds||[]})),
   authenticatedFetch("/api/admin/assist-finance-close").catch(()=>({floatTransfers:[],closures:[]}))
  ]);
  setData({...operations,refunds:finance.refunds||operations.refunds||[],
   floatTransfers:closure.floatTransfers||[],closures:closure.closures||[]});
 };
 async function reconcileRefund(record,action){
  setBusy(true);setError("");setNotice("");
  try{
   const selected=refundForm.id===record.id?refundForm:{id:record.id,externalReference:"",evidenceUrl:"",note:""};
   const response=await authenticatedFetch("/api/admin/assist-refunds",{method:"POST",body:JSON.stringify({
    requestId:record.requestId,refundType:record.id.startsWith("balance_")?"balance":"manual",
    action,externalReference:selected.externalReference||undefined,evidenceUrl:selected.evidenceUrl||undefined,
    note:selected.note||""
   })});
   setNotice(response.refunded?"External evidence reconciled by separate Finance reviewer. Verify actual customer receipt.":"External refund evidence submitted; requires another Finance reviewer.");
   await load();
  }catch(e){setError(e.message||"Refund reconciliation failed.");}
  finally{setBusy(false);}
 }
 async function closeFinance(record,action){
  setBusy(true);setError("");setNotice("");
  try{
   const s=floatForm.id===record.id?floatForm:{id:record.id,returnAmount:"",returnReference:"",evidenceUrl:"",note:""};
   const response=await authenticatedFetch("/api/admin/assist-finance-close",{method:"POST",body:JSON.stringify({
    requestId:record.requestId,action,returnAmount:s.returnAmount===""?undefined:Number(s.returnAmount),
    returnReference:s.returnReference||undefined,evidenceUrl:s.evidenceUrl||undefined,note:s.note
   })});
   setNotice(response.status==="externally_reconciled"?"Financial closure recorded with balanced funds, verified purchase and externally reconciled refunds.":"Purchasing float externally reconciled; separate Finance closeout review is still required.");
   await load();
  }catch(e){setError(e.message||"Could not reconcile this purchasing float.");}
  finally{setBusy(false);}
 }
 async function downloadReceipt(job){
  setBusy(true);setError("");
  try{
   const user=getFirebaseClient()?.auth?.currentUser;
   if(!user)throw new Error("Sign in to review this receipt.");
   const [token,appCheck]=await Promise.all([user.getIdToken(),getFirebaseAppCheckToken()]);
   const response=await fetch("/api/admin/assist-fulfillment/receipt?requestId="+encodeURIComponent(job.id),{
    headers:{"Authorization":"Bearer "+token,...(appCheck?{"X-Firebase-AppCheck":appCheck}:{})}
   });
   if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||"Receipt download failed.");}
   const blob=await response.blob(),url=URL.createObjectURL(blob);
   const link=document.createElement("a");link.href=url;link.download="spotly-receipt-"+job.id+"."+(blob.type==="application/pdf"?"pdf":"jpg");
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(e){setError(e.message||"Unable to retrieve receipt.");}
  finally{setBusy(false);}
 }
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function act(action,overrides={}){setBusy(true);setError("");setNotice("");try{const result=await authenticatedFetch("/api/admin/assist-fulfillment",{method:"POST",body:JSON.stringify({
  action,requestId:overrides.requestId||form.requestId,driverId:form.driverId,
  amount:form.amount?Number(form.amount):undefined,transferReference:form.transferReference,
  transferEvidenceUrl:form.transferEvidenceUrl,note:form.note})});setNotice(result.state+" — payment and refund state have not been fabricated.");await load();}
 catch(e){setError(e.message);}finally{setBusy(false);}}
 return <AuthGate portal="admin" title="Spotly Admin sign in" sameOriginLogin><AdminAccess><PortalShell portalId="admin" activeSection="marketplace"><main className="mx-auto max-w-[1100px] px-5 py-10">
  <Link href="/admin/assist" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4"/>Assist Operations</Link>
  <div className="mt-7 flex gap-4"><ClipboardCheck className="h-7 w-7 text-[var(--accent)]"/><div><h1 className="text-3xl font-semibold">Independent purchase fulfilment</h1><p className="mt-2 text-sm text-[var(--text-2)]">Funded requests only. External shopper float must be attested by Finance, and a different operator assigns the Driver. Merchant kiosks and settlements remain separate.</p></div></div>
  {error&&<p role="alert" className="mt-5 rounded-xl border p-4 text-sm text-[var(--danger)]">{error}</p>}
  {notice&&<p role="status" className="mt-5 rounded-xl border p-4 text-sm text-[var(--success)]">{notice}</p>}
  <section className="mt-7 rounded-2xl border bg-[var(--surface)] p-6"><h2 className="text-xl font-semibold">Finance and assignment controls</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
  {Object.entries({requestId:"Funded customer request ID",driverId:"Approved Driver UID",amount:"Externally confirmed shopper float (USD)",transferReference:"External transfer reference",transferEvidenceUrl:"Evidence URL (HTTPS)",note:"Verification and operational notes"}).map(([key,label])=><label key={key} className="text-xs font-semibold">{label}<input className={field} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))} /></label>)}</div>
  <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy} onClick={()=>act("record_float")} className="rounded-xl border px-4 py-3 text-sm font-semibold">Finance: record confirmed float</button><button disabled={busy} onClick={()=>act("assign")} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Assign vetted shopper</button><button disabled={busy} onClick={()=>act("request_refund")} className="rounded-xl border px-4 py-3 text-sm font-semibold">Request provider refund</button></div>
  <p className="mt-3 flex gap-2 text-xs text-[var(--text-2)]"><ShieldCheck className="h-4 w-4"/>A refund request is not proof that Paynow has returned money. Do not mark customers refunded until independently confirmed.</p></section>
  <section className="mt-7 rounded-2xl border p-5"><h2 className="text-xl font-semibold">Paused shopper incidents</h2>
   <p className="mt-1 text-sm text-[var(--text-2)]">Do not resume spending or dispatch until Operations has verified the issue, existing float and customer instructions.</p>
   <div className="mt-3 space-y-3">{(data.shoppingIssues||[]).map(issue=><article key={issue.id} className="rounded-xl border p-4">
    <p className="font-semibold">{issue.requestId}</p><p className="mt-1 text-sm">{issue.note}</p>
    <p className="mt-1 text-xs text-[var(--text-2)]">Driver {issue.driverId} · paused from {issue.previousState}</p>
    <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>act("resolve_incident",{requestId:issue.requestId})} className="rounded-xl border px-4 py-2 text-sm font-semibold">Authorize resumption</button>
    <button disabled={busy} onClick={()=>act("terminate_incident",{requestId:issue.requestId})} className="rounded-xl border px-4 py-2 text-sm font-semibold">Terminate and refer to Finance</button></div>
   </article>)}{!data.shoppingIssues?.length&&<p className="text-sm text-[var(--text-2)]">No open shopper incidents.</p>}</div>
  </section>
  <section className="mt-7 rounded-2xl border p-5"><h2 className="text-xl font-semibold">Funded customer requests</h2>
   <p className="mt-1 text-xs text-[var(--text-2)]">Real customer records, including cases awaiting a vetted shopper. Selecting one fills the secure Finance and assignment form.</p>
   <div className="mt-4 space-y-2">{(data.requests||[]).map(r=><button key={r.id} type="button" onClick={()=>setForm(v=>({...v,requestId:r.id}))} className="block w-full rounded-xl border p-3 text-left text-sm">
    <span className="font-semibold">{r.storeName}</span><span className="ml-2 text-xs text-[var(--text-2)]">{r.state.replaceAll("_"," ")} · {r.paymentStatus.replaceAll("_"," ")}</span>
    <span className="mt-1 block text-xs text-[var(--text-2)]">{r.id} · USD {Number(r.total||0).toFixed(2)}</span>
   </button>)}{!data.requests?.length&&<p className="text-sm text-[var(--text-2)]">No active independently funded requests.</p>}</div>
  </section>
  <section className="mt-7"><h2 className="text-xl font-semibold">Shopper jobs</h2><div className="mt-3 space-y-3">{(data.jobs||[]).map(j=><article key={j.id} className="rounded-xl border bg-[var(--surface)] p-5"><div className="flex justify-between gap-3"><div><p className="font-semibold">{j.storeName}</p><p className="mt-1 text-xs text-[var(--text-2)]">{j.id} · Shopper {j.driverId}</p></div><p className="text-sm font-semibold">{j.state}</p></div><p className="mt-2 text-xs text-[var(--text-2)]">Authorized USD {Number(j.authorizedSpend||0).toFixed(2)} · Actual {j.actualSpend==null?"not reconciled":Number(j.actualSpend).toFixed(2)}</p>{j.state==="receipt_submitted"&&<div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>downloadReceipt(j)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Download private receipt</button><button disabled={busy} onClick={()=>act("approve_receipt",{requestId:j.id})} className="rounded-xl border px-4 py-2 text-sm font-semibold">Approve after verification</button></div>}</article>)}
  {!data.jobs?.length&&<p className="rounded-xl border p-6 text-sm text-[var(--text-2)]">No independently funded shopper jobs yet.</p>}</div></section>
  <section className="mt-7 rounded-xl border p-5"><h2 className="text-xl font-semibold">Refund and provider reconciliation</h2>
   <p className="mt-2 text-sm text-[var(--text-2)]">The Paynow payment SDK has no verified merchant refund-execution method. These controls document refunds executed externally by an authorized provider or bank. A different Finance reviewer must confirm the evidence. Do not mark an unexecuted refund complete.</p>
   <div className="mt-4 space-y-3">{(data.refunds||[]).map(r=><article key={r.id} className="rounded-xl border p-4">
    <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{r.id}</p><p className="mt-1 text-xs">{r.requestId} · USD {Number(r.amount).toFixed(2)}</p></div><span className="text-xs font-semibold">{r.status?.replaceAll("_"," ")}</span></div>
    {r.status==="awaiting_provider_execution"&&<div className="mt-3 space-y-2">
     <button type="button" className="rounded-lg border px-3 py-2 text-xs font-semibold" onClick={()=>setRefundForm(v=>({...v,id:r.id}))}>Record external refund evidence</button>
     {refundForm.id===r.id&&<div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs">Provider or bank refund reference<input className={field} value={refundForm.externalReference} onChange={e=>setRefundForm(v=>({...v,externalReference:e.target.value}))}/></label>
      <label className="text-xs">Evidence URL (HTTPS, private)<input className={field} value={refundForm.evidenceUrl} onChange={e=>setRefundForm(v=>({...v,evidenceUrl:e.target.value}))}/></label>
      <label className="text-xs sm:col-span-2">Detailed execution notes<input className={field} value={refundForm.note} onChange={e=>setRefundForm(v=>({...v,note:e.target.value}))}/></label>
      <button type="button" disabled={busy} onClick={()=>reconcileRefund(r,"submit_external_evidence")} className="rounded-xl border px-3 py-2 text-sm font-semibold">Submit external evidence</button>
     </div>}
    </div>}
    {r.status==="external_evidence_submitted"&&<div className="mt-3">
     <p className="mb-2 text-xs text-[var(--text-2)]">Reference: {r.externalReference}. Execution recorded by {r.executedBy}. A separate Finance reviewer must verify the provider evidence independently.</p>
     <button disabled={busy} onClick={()=>reconcileRefund(r,"confirm_external_refund")} className="rounded-xl border px-3 py-2 text-sm font-semibold">Independently reconcile refund</button>
    </div>}
    {r.status==="reconciled_external"&&<p className="mt-3 text-xs text-[var(--text-2)]">Externally attested by Finance · Reviewer {r.confirmedBy}. Confirmation does not initiate another transfer.</p>}
   </article>)}{!data.refunds?.length&&<p className="text-sm text-[var(--text-2)]">No independent refund requests.</p>}</div>
  </section>
  <section className="mt-7 rounded-2xl border p-5"><h2 className="text-xl font-semibold">Purchasing float and final closeout</h2>
   <p className="mt-2 text-sm text-[var(--text-2)]">Finance must reconcile unused purchasing float against the approved receipt, confirm every customer refund and authorize final independent purchase closure. These records do not initiate money transfers.</p>
   <div className="mt-4 space-y-3">{(data.floatTransfers||[]).map(x=><article key={x.id} className="rounded-xl border p-4">
    <p className="font-semibold">{x.requestId}</p><p className="mt-1 text-xs text-[var(--text-2)]">USD {Number(x.amount||0).toFixed(2)} transferred · {x.status.replaceAll("_"," ")}</p>
    <button className="mt-3 rounded-lg border px-3 py-2 text-xs font-semibold" onClick={()=>setFloatForm(v=>({...v,id:x.id}))}>Review float reconciliation</button>
    {floatForm.id===x.id&&<div className="mt-3 grid gap-3 sm:grid-cols-2">
     {x.status==="externally_confirmed"&&<>
      <label className="text-xs">Unused float returned (USD)<input className={field} type="number" step="0.01" min="0" value={floatForm.returnAmount} onChange={e=>setFloatForm(v=>({...v,returnAmount:e.target.value}))}/></label>
      <label className="text-xs">Return reference<input className={field} value={floatForm.returnReference} onChange={e=>setFloatForm(v=>({...v,returnReference:e.target.value}))}/></label>
      <label className="text-xs sm:col-span-2">Private HTTPS evidence link<input className={field} value={floatForm.evidenceUrl} onChange={e=>setFloatForm(v=>({...v,evidenceUrl:e.target.value}))}/></label>
     </>}
     <label className="text-xs sm:col-span-2">Independent review notes<input className={field} value={floatForm.note} onChange={e=>setFloatForm(v=>({...v,note:e.target.value}))}/></label>
     {x.status==="externally_confirmed"&&<button disabled={busy} onClick={()=>closeFinance(x,"reconcile_float")} className="rounded-xl border px-3 py-2 text-sm font-semibold">Reconcile returned float</button>}
     {x.status==="externally_reconciled"&&!data.closures?.some(z=>z.requestId===x.requestId)&&<button disabled={busy} onClick={()=>closeFinance(x,"close_purchase")} className="rounded-xl border px-3 py-2 text-sm font-semibold">Finalize independent purchase ledger</button>}
    </div>}
   </article>)}{!data.floatTransfers?.length&&<p className="text-sm text-[var(--text-2)]">No external purchasing floats recorded.</p>}</div>
   <p className="mt-4 text-xs text-[var(--text-2)]">{data.closures?.length||0} financially closed purchases. Actual customer credits must be independently verified.</p>
  </section>
 </main></PortalShell></AdminAccess></AuthGate>;
}
