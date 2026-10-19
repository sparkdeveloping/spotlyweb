"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, DatabaseZap,FileCheck2,ShieldCheck,UploadCloud } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { AdminAccess } from "@/components/admin-legacy-sections";
export function AssistImportManager(){
 const [country,setCountry]=useState("ZW"),[source,setSource]=useState("staff_in_person"),[reference,setReference]=useState(""),[rows,setRows]=useState(""),[rights,setRights]=useState(false),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 function parse(){
   const data=rows.trim().split("\n").map(s=>s.trim()).filter(Boolean).map((line,n)=>{
      const parts=line.split("|").map(s=>s.trim());if(parts.length<4||parts.length>7)throw new Error("Line "+(n+1)+": use name | city | area | address | category | phone | optional country");
      return {name:parts[0],city:parts[1],area:parts[2],address:parts[3],category:parts[4]||"Directory profile",phone:parts[5]||"",country:parts[6]||country};
   });
   if(!data.length||data.length>50)throw new Error("Import 1 to 50 businesses per batch.");
   return data;
 }
 async function run(mode){
   setBusy(true);setError("");setSuccess("");
   try{
      if(!rights)throw new Error("Confirm that you have rights to record and use the factual listing data.");
      const records=parse();
      const result=await authenticatedFetch("/api/admin/assist-import",{method:"POST",body:JSON.stringify({mode,source,sourceReference:reference,rightsConfirmed:true,rows:records})});
      if(mode==="preview"){setPreview({rows:records,results:result});}
      else {setSuccess(result.created+" new businesses added to Firestore. Import reference: "+result.batchId);setPreview(null);}
   }catch(err){setError(err.message);}finally{setBusy(false);}
 }
 return <AuthGate portal="admin" title="Sign in to Spotly Admin"><AdminAccess><PortalShell portalId="admin" activeSection="marketplace"><main className="mx-auto max-w-[1100px] px-5 py-10">
   <Link href="/assist" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]"><ArrowLeft className="h-4 w-4"/>Assist Operations</Link>
   <div className="mt-6 flex items-center gap-3"><span className="rounded-xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]"><DatabaseZap className="h-6 w-6"/></span><div><h1 className="text-3xl font-semibold tracking-tight">Business data import</h1><p className="mt-1 text-sm text-[var(--text-2)]">Review first. Import only into Firestore; existing merchant records are never replaced.</p></div></div>
   <section className="mt-7 rounded-2xl border bg-[var(--surface)] p-5 sm:p-8"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Default country<select value={country} onChange={e=>{setCountry(e.target.value);setPreview(null);}} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5"><option value="ZW">Zimbabwe</option><option value="MW">Malawi</option></select></label><label className="text-sm font-semibold">Information source<select value={source} onChange={e=>{setSource(e.target.value);setPreview(null);}} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5"><option value="staff_in_person">Staff verified on location</option><option value="staff_phone">Staff verified by phone</option><option value="licensed_dataset">Licensed or permitted data source</option></select></label></div>
    <label className="mt-5 block text-sm font-semibold">Evidence reference / source<input required maxLength={300} value={reference} onChange={e=>{setReference(e.target.value);setPreview(null);}} placeholder="Date, collector, field notes or licensed dataset" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5"/></label>
    <label className="mt-5 block text-sm font-semibold">Business records<textarea rows={10} value={rows} onChange={e=>{setRows(e.target.value);setPreview(null);}} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3 font-mono text-sm" placeholder={"Restaurant name | Harare | Avondale | 123 Example Road | Restaurant | +263...\nSalon name | Lilongwe | Area 2 | Example Street | Hair salon | +265... | MW"}/></label>
    <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">Format: <strong>name | city | area | address | category | phone | optional country</strong>. One record per line, up to 50. Avoid copyrighted menu descriptions, logos and restaurant photographs.</p>
    <label className="mt-5 flex items-start gap-3 rounded-xl bg-[var(--surface-2)] p-4 text-sm"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)} className="mt-1 h-4 w-4"/>I have verified that the factual listing information was collected independently or is licensed for this use, and I will retain the evidence.</label>
    {error&&<p role="alert" className="mt-4 rounded-xl border p-3 text-sm text-[var(--danger)]">{error}</p>}
    {success&&<p role="status" className="mt-4 rounded-xl border p-3 text-sm text-[var(--success)]">{success}</p>}
    <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy||!rows.trim()||!rights} type="button" onClick={()=>run("preview")} className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold disabled:opacity-40"><FileCheck2 className="h-4 w-4"/>{busy?"Checking…":"Preview and find duplicates"}</button>{preview&&preview.results.duplicateCount===0&&<button disabled={busy} type="button" onClick={()=>run("commit")} className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><UploadCloud className="h-4 w-4"/>Approve Firestore import</button>}</div>
   </section>
   {preview&&<section className="mt-6 rounded-2xl border bg-[var(--surface)] p-6"><h2 className="text-xl font-semibold">Preview: {preview.results.newCount} new · {preview.results.duplicateCount} possible duplicates</h2><p className="mt-2 text-sm text-[var(--text-2)]">Review every record. Duplicates cannot be committed in this batch.</p><div className="mt-4 divide-y">{preview.results.records.map((r,i)=><div key={i} className="flex items-start justify-between gap-3 py-3 text-sm"><div><p className="font-semibold">{r.name}</p><p className="mt-1 text-xs text-[var(--text-2)]">{r.city}, {r.country} · {r.address}</p></div><span className={r.outcome==="new"?"text-[var(--success)]":"text-[var(--danger)]"}>{r.outcome.replaceAll("_"," ")}</span></div>)}</div></section>}
   <div className="mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm text-[var(--text-2)]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"/><p>All imported profiles start as provisional and unclaimed. Neither merchant commerce, payment acceptance nor Driver dispatch is automatically enabled. Owners can claim through Spotly's normal verification process.</p></div>
 </main></PortalShell></AdminAccess></AuthGate>;
}
