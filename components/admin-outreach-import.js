"use client";
import { useRef, useState } from "react";
import { FileUp, LockKeyhole, CheckCircle2, AlertTriangle } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { FIELD_ARCHIVE_KEY } from "@/lib/outreach-history-policy.mjs";

/** Admin-only historical import. The private source file is never bundled in website assets or Git. */
export function AdminOutreachImport({onImported}) {
  const input=useRef(null);
  const [data,setData]=useState(null),[running,setRunning]=useState(false),[progress,setProgress]=useState(null),[error,setError]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  async function selectFile(event){
    const file=event.target.files?.[0];event.target.value="";setError("");setData(null);setProgress(null);setConfirmed(false);
    if(!file)return;
    try{
      if(file.size>4_000_000)throw Error("The private import must be under 4 MB.");
      const incoming=JSON.parse(await file.text());
      if(incoming.archiveKey!==FIELD_ARCHIVE_KEY||!incoming.creditedAgent?.email||!Array.isArray(incoming.rows)||!incoming.rows.length||incoming.rows.length>500)throw Error("This is not a supported Spotly field-outreach evidence file.");
      if(new Set(incoming.rows.map(row=>row.sourceId)).size!==incoming.rows.length)throw Error("The source contains repeated conversation IDs.");
      setData(incoming);
    }catch(e){setError(e.message||"The private file could not be read.");}
  }
  async function doImport(){
    if(!data||!confirmed||running)return;
    setRunning(true);setError("");
    let completed=0,created=0,messages=0,previous=0;
    try{
      for(let i=0;i<data.rows.length;i+=4){
        const batch=data.rows.slice(i,i+4);
        const result=await authenticatedFetch("/api/admin/outreach-history",{method:"POST",body:JSON.stringify({
          action:"import_historical_outreach",archiveKey:FIELD_ARCHIVE_KEY,
          creditedAgent:data.creditedAgent,rows:batch,confirmPrivateImport:true
        })});
        completed+=batch.length;created+=result.prospectsCreated;messages+=result.messagesCreated;previous+=result.alreadyPresent;
        setProgress({completed,total:data.rows.length,created,messages,previous});
      }
      onImported?.();
    }catch(e){setError(`${e.message||"Import stopped"}. You can safely select the same file and retry; existing IDs are preserved.`);}
    finally{setRunning(false);}
  }
  return <section className="nxt-panel" aria-label="Private outreach evidence import">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2"><LockKeyhole size={17}/> Historical outreach import</h3>
      <p className="nxt-mini">Administrator-only. Reconcile historical conversations without creating verified merchants or transferring business ownership.</p></div>
      <button className="nxt-button nxt-secondary" type="button" onClick={()=>input.current?.click()} disabled={running}><FileUp size={16}/> Choose private JSON</button>
      <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="Select private Spotly outreach evidence file" onChange={selectFile}/>
    </div>
    {error&&<p role="alert" className="nxt-note nxt-warning"><AlertTriangle size={16} className="inline-block"/> {error}</p>}
    {data&&<div className="mt-4 flex flex-col gap-3">
      <div className="nxt-note">{data.rows.length} conversation records credited to <strong>{data.creditedAgent.name} ({data.creditedAgent.email})</strong>. Each message remains labelled as historical and unverified. Existing CRM records will not be overwritten. Possible duplicate organizations remain separate for manual review.</div>
      <label className="nxt-checkbox"><input type="checkbox" checked={confirmed} disabled={running} onChange={e=>setConfirmed(e.target.checked)}/> I have approval to import this private business correspondence into Spotly Admin, have reviewed contact restrictions, and understand this does not verify registrations.</label>
      <div><button className="nxt-button" type="button" disabled={!confirmed||running||progress?.completed===data.rows.length} onClick={doImport}>{running?"Importing safely…":"Import historical records"}</button></div>
    </div>}
    {progress&&<div role="status" className="nxt-note mt-3 flex items-center gap-2"><CheckCircle2 size={16}/>{progress.completed}/{progress.total} threads processed · {progress.created} new prospects · {progress.messages} message records · {progress.previous} already present</div>}
  </section>;
}
