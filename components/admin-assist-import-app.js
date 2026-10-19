"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Database, FileUp, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/firebase-provider";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { AdminAccess } from "@/components/admin-legacy-sections";
import { canAccessAdminSection } from "@/lib/admin-access";
import { authenticatedFetch } from "@/lib/api-client";

const columns = ["externalId","name","country","city","area","address","phone","category","kind","item_name","item_price","unit","price_checked_at","price_check_method"];
const example = `externalId,name,country,city,area,address,phone,category,kind,item_name,item_price,unit,price_checked_at,price_check_method
example-001,Example Place,ZW,Harare,Avondale,"Example Road, Avondale",+263000000000,Restaurant,restaurant,,,,`;
function parseCSV(csv) {
  const table = []; let row=[], cell="", quoted=false;
  for(let i=0;i<csv.length;i++){
    const c=csv[i];
    if(c==='"'){ if(quoted && csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted; }
    else if(c===","&&!quoted){row.push(cell.trim());cell="";}
    else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&csv[i+1]==="\n")i++;row.push(cell.trim());if(row.some(Boolean))table.push(row);row=[];cell="";}
    else cell+=c;
  }
  row.push(cell.trim());if(row.some(Boolean))table.push(row);
  if(quoted)throw new Error("One of the quoted CSV fields is not closed.");
  return table;
}
function parseImport(csv) {
  const rows = parseCSV(csv);
  if(rows.length<2)throw new Error("Add a header row and at least one business.");
  const keys = rows[0].map((v)=>v.trim());
  for(const key of ["externalId","name","country","city","address","kind"]){if(!keys.includes(key))throw new Error(`Missing column: ${key}`);}
  const groups = new Map();
  rows.slice(1).forEach((values,index)=>{
    const o=Object.fromEntries(keys.map((key,i)=>[key,values[i]||""]));
    if(!o.externalId)throw new Error(`Row ${index+2} needs an externalId.`);
    if(!groups.has(o.externalId))groups.set(o.externalId,{
      externalId:o.externalId,name:o.name,country:o.country.toUpperCase(),city:o.city,area:o.area,
      address:o.address,phone:o.phone,category:o.category||"Restaurant",kind:o.kind,items:[],priceCheckMethod:o.price_check_method||undefined
    });
    const group=groups.get(o.externalId);
    if(o.item_name){
      if(!o.item_price.trim() || !Number.isFinite(Number(o.item_price)))throw new Error(`Row ${index+2} needs a valid price.`);
      if(!o.price_checked_at)throw new Error(`Row ${index+2} needs the date/time when the price was checked.`);
      group.items.push({name:o.item_name,price:Number(o.item_price),unit:o.unit||"",checkedAt:o.price_checked_at});
      if(!group.priceCheckMethod)group.priceCheckMethod=o.price_check_method||undefined;
    }
  });
  return [...groups.values()];
}
export function AdminAssistImportApp() {
  const {profile}=useAuth();
  const allowed=canAccessAdminSection(profile,"marketplace");
  const [sourceId,setSourceId]=useState("");
  const [rights,setRights]=useState("independently_researched");
  const [license,setLicense]=useState("");
  const [csv,setCsv]=useState("");
  const [review,setReview]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [done,setDone]=useState(null);
  const rows=useMemo(()=>{try{return parseImport(csv);}catch{return null;}},[csv]);
  async function submit(mode) {
    setBusy(true);setError("");
    try{
      const parsed=parseImport(csv);
      if(parsed.length>60)throw new Error("Import no more than 60 businesses per batch.");
      if(mode==="commit" && (!review || !window.confirm("Import reviewed, non-duplicate businesses into Firestore? This will not overwrite claimed merchants.")))return;
      const result=await authenticatedFetch("/api/admin/assist/import",{
        method:"POST",body:JSON.stringify({sourceId,sourceRights:rights,sourceLicense:license,rows:parsed,mode})
      });
      if(mode==="preview"){setReview(result);setDone(null);}
      else {setDone(result);setReview(null);}
    }catch(err){setError(err.message||"Could not validate this import.");}
    finally{setBusy(false);}
  }
  return <AuthGate portal="admin" title="Sign in to Spotly Admin"><AdminAccess><PortalShell portalId="admin" activeSection="marketplace">
    <main className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8">
      <Link href="/assist" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]"><ArrowLeft className="h-4 w-4"/>Spotly Assist operations</Link>
      <div className="mt-7 flex items-center gap-3"><span className="rounded-xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]"><Database className="h-6 w-6"/></span><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Spotly V9 · Firestore</p><h1 className="mt-1 text-3xl font-semibold">Business data import</h1></div></div>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-2)]">Import independently collected business records and optional original factual menu prices into Firestore. Every batch is reviewed before committing; existing claimed businesses and apparent duplicates are protected. Zimbabwe and Malawi are supported, with other African countries permitted by ISO code.</p>
      <div className="mt-7 rounded-xl bg-[var(--surface-2)] p-4 text-sm"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"/><p>Do not upload copyright menu photographs, logos, proprietary descriptions or restricted-site exports. Source rights must be verified. Published prices need a real, recent independent check; missing prices remain discovery-only.</p></div></div>
      {!allowed?<p className="mt-7 rounded-xl border p-6">This section requires marketplace administration access.</p>:
      <div className="mt-7 grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
        <div className="space-y-5"><section className="rounded-2xl border bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">1. Identify your data source</h2><div className="mt-4 space-y-4">
          <label className="block text-xs font-semibold">Import source ID<input className="mt-2 w-full rounded-xl border p-3 text-sm" value={sourceId} onChange={(e)=>{setSourceId(e.target.value);setReview(null);}} placeholder="field-research-2026-10"/></label>
          <label className="block text-xs font-semibold">Data rights<select className="mt-2 w-full rounded-xl border p-3 text-sm" value={rights} onChange={(e)=>{setRights(e.target.value);setReview(null);}}><option value="independently_researched">Independently researched original facts</option><option value="business_authorized">Provided/approved by the business</option><option value="licensed_data">Licensed data (confirm terms)</option></select></label>
          <label className="block text-xs font-semibold">Licence and attribution notes<input className="mt-2 w-full rounded-xl border p-3 text-sm" value={license} onChange={(e)=>{setLicense(e.target.value);setReview(null);}} placeholder="Required for licensed sources"/></label>
        </div></section>
        <section className="rounded-2xl border bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">2. Upload your CSV</h2><p className="mt-2 text-xs leading-5 text-[var(--text-2)]">Use a separate row for each menu item, repeating the business identifier. Leave item columns blank for directory-only places. An ISO date/time with offset is required for priced items.</p>
          <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-4 text-sm font-semibold"><FileUp className="h-5 w-5"/>Choose CSV file<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async(e)=>{const f=e.target.files?.[0];if(f){setCsv(await f.text());setReview(null);setDone(null);}}}/></label>
          <button type="button" onClick={()=>{setCsv(example);setReview(null);}} className="mt-3 text-xs font-semibold text-[var(--accent)]">Load format example</button>
          <p className="mt-3 text-xs text-[var(--text-3)]">{rows ? `${rows.length} businesses parsed` : "Upload a CSV to preview the records."}</p>
        </section></div>
        <div className="rounded-2xl border bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">3. Review before importing</h2><textarea className="mt-4 h-[300px] w-full resize-y rounded-xl border bg-[var(--surface-2)] p-3 font-mono text-xs" spellCheck={false} value={csv} onChange={(e)=>{setCsv(e.target.value);setReview(null);setDone(null);}} placeholder="Paste a CSV file here, or choose a file…"/>
          {error&&<p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
          {done&&<div role="status" className="mt-3 rounded-xl bg-[var(--success-soft)] p-4 text-sm"><CheckCircle2 className="inline h-4 w-4"/> Imported {done.committed} businesses into Firestore; skipped {done.skipped}. Import batch: {done.batchId}</div>}
          {review&&<div className="mt-4 max-h-[260px] overflow-auto rounded-xl border"><table className="w-full text-left text-xs"><thead><tr className="bg-[var(--surface-2)]"><th className="p-2">Business</th><th className="p-2">Location</th><th className="p-2">Result</th></tr></thead><tbody>{review.report?.map((row)=><tr key={row.externalId} className="border-t"><td className="p-2 font-semibold">{row.name}</td><td className="p-2">{row.city}, {row.country}</td><td className="p-2">{row.verdict}{row.possibleDuplicateId&&<span className="block text-[var(--text-3)]">Review {row.possibleDuplicateId}</span>}</td></tr>)}</tbody></table></div>}
          <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy||!rows||!sourceId.trim()} onClick={()=>submit("preview")} className="rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-40">{busy?"Checking…":"Preview & check duplicates"}</button><button type="button" disabled={busy||!review||!sourceId.trim()} onClick={()=>submit("commit")} className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Approve & import to Firestore</button></div>
        </div>
      </div>}
    </main>
  </PortalShell></AdminAccess></AuthGate>;
}
