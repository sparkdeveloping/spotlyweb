"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, Building2, CalendarDays, ChevronLeft, ChevronRight, FilterX, Layers3, RefreshCw, Search, ShieldCheck, Store, UserRoundSearch } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AdminAccess } from "@/components/admin-legacy-sections";
import { PortalShell } from "@/components/portal-shell";
import { authenticatedFetch } from "@/lib/api-client";
import { Badge, Button, Card, EmptyState, NativeSelect } from "@/components/ui";

const OPTIONS={
  ownership:[["","Any ownership"],["claimed","Claimed"],["claim_pending","Claim awaiting review"],["unclaimed","Unclaimed"]],
  verification:[["","Any verification"],["approved","Verified"],["pending","Pending"],["unverified","Unverified"],["rejected","Rejected"]],
  publication:[["","Any visibility"],["visible","Public directory"],["hidden","Not public"],["suspended","Suspended"]],
  commerce:[["","Any commerce"],["merchant_live","Active merchants"],["independent_assist","Independent Assist"],["not_enabled","No checkout"]],
  attention:[["","All next steps"],["ownership","Review ownership"],["identity","Verify identity"],["launch","Launch review"],["unclaimed","Invite an owner"],["assist","Independent Assist"],["suspended","Suspensions"],["live","Operational"]],
  sort:[["createdAt","Date added"],["updatedAt","Last updated"],["name","Business name"],["id","Record ID"]],
  direction:[["desc","Newest / Z–A"],["asc","Oldest / A–Z"]]
};
const EMPTY={q:"",city:"",source:"",ownership:"",verification:"",publication:"",commerce:"",attention:"",from:"",to:"",sort:"createdAt",direction:"desc"};
const STATE_LABEL={
  claim_pending:"Claim pending",claimed:"Claimed",unclaimed:"Unclaimed",
  merchant_live:"Merchant live",independent_assist:"Spotly Assist · independent",not_enabled:"No active checkout",
  visible:"Visible directory",hidden:"Hidden",suspended:"Suspended",
  launch:"Launch review",ownership:"Ownership review",identity:"Identity check",assist:"Independent Assist",
  approved:"Verified",unverified:"Not verified",pending:"Awaiting review",live:"Active"
};
const fmtDate=x=>x?new Date(x).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}):"Unknown";
function Tone({value,children}){
  const tone=["merchant_live","approved","live","claimed"].includes(value)?"success":
    ["suspended","rejected"].includes(value)?"danger":
    ["claim_pending","pending","ownership","identity","launch"].includes(value)?"warning":"neutral";
  return <Badge tone={tone}>{children||STATE_LABEL[value]||String(value||"Unknown").replaceAll("_"," ")}</Badge>;
}
function Labeled({label,children}){return <label className="block min-w-0 space-y-1.5 text-xs font-semibold text-secondary"><span>{label}</span>{children}</label>;}
function Select({label,value,options,onChange}){
  return <Labeled label={label}><NativeSelect value={value} onChange={e=>onChange(e.target.value)} className="w-full min-w-0 text-sm">{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</NativeSelect></Labeled>;
}
function downloadCSV(rows){
  const cols=["id","name","category","city","status","claimStatus","verificationStatus","createdBy","sourceType","createdAt","updatedAt"];
  const cell=value=>'"'+String(value??"").replaceAll('"','""').replace(/^[=+@-]/,"'")+'"';
  const csv=[cols.join(","),...rows.map(row=>cols.map(k=>cell(row[k])).join(","))].join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download="spotly-business-register-"+new Date().toISOString().slice(0,10)+".csv";
  link.click();URL.revokeObjectURL(url);
}
function BusinessDetail({row,people,onClose}){
  if(!row)return null;
  const creator=people?.[row.createdBy];
  const owners=(row.ownerIds||[]).map(id=>people?.[id]||{uid:id,email:"",name:""});
  return <div className="fixed inset-0 z-[95] flex justify-end">
    <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close business details"/>
    <section role="dialog" aria-modal="true" aria-label="Business relationships" className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[var(--surface)] p-5 shadow-2xl sm:p-7">
      <div className="flex justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Business record</p><h2 className="mt-2 text-2xl font-semibold">{row.name}</h2><p className="mt-2 break-all font-mono text-xs text-secondary">{row.id}</p></div><button type="button" onClick={onClose} className="h-10 rounded-xl border px-3 text-sm font-semibold">Close</button></div>
      <div className="mt-6 grid grid-cols-2 gap-3">{[["Ownership",row.readiness.ownership],["Verification",row.readiness.verification],["Visibility",row.readiness.publication],["Commerce",row.readiness.commerce]].map(([k,v])=><div key={k} className="rounded-xl border p-3"><p className="mb-2 text-xs text-secondary">{k}</p><Tone value={v}/></div>)}</div>
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4"><p className="font-semibold">What should happen next?</p><p className="mt-2 text-sm leading-6 text-secondary">{row.readiness.next}</p></div>
      <h3 className="mt-7 font-semibold">Who added this record?</h3>
      <div className="mt-2 rounded-xl border p-4 text-sm"><p>{creator?.name||creator?.email||"Creator not resolved"}</p><p className="mt-1 break-all text-xs text-secondary">{creator?.email||row.createdBy||"Creator field unavailable"}</p><p className="mt-2 text-xs text-secondary">Created by is an audit identity, not proof of business ownership.</p></div>
      <h3 className="mt-6 font-semibold">Approved owner IDs ({owners.length})</h3>
      <div className="mt-2 space-y-2">{owners.length?owners.map(person=><div key={person.uid} className="rounded-xl border p-3 text-sm"><p className="font-semibold">{person.name||person.email||"Owner record"}</p><p className="break-all text-xs text-secondary">{person.email||person.uid}</p></div>):<p className="rounded-xl bg-[var(--surface-2)] p-3 text-sm text-secondary">No approved owners recorded. This does not mean there is no pending claim.</p>}</div>
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">{[["Added",fmtDate(row.createdAt)],["Updated",fmtDate(row.updatedAt)],["Source",row.sourceType],["Branches",row.branchCount],["Organization",row.organizationId||"Unlinked"],["Location",row.city||"Unknown"]].map(([k,v])=><div key={k}><p className="text-xs text-secondary">{k}</p><p className="mt-1 break-all font-semibold">{v}</p></div>)}</div>
      <div className="mt-8 flex flex-wrap gap-2"><Link href={"/support-view/"+encodeURIComponent(row.id)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--on-accent)]">Open business support view <ArrowRight className="h-4 w-4"/></Link><Link href="/work" className="rounded-xl border px-4 py-3 text-sm font-semibold">Review queues</Link></div>
    </section>
  </div>;
}
export function AdminBusinessRegisterBody() {
  const [filters,setFilters]=useState(EMPTY),[applied,setApplied]=useState(EMPTY);
  const [lookup,setLookup]=useState(""),[lookupEmail,setLookupEmail]=useState("");
  const [mode,setMode]=useState("list"),[response,setResponse]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [pages,setPages]=useState([]),[selected,setSelected]=useState(null);
  const [revision,setRevision]=useState(0);
  const requestIdRef=useRef(0);
  const resultRows=response?.rows||[];
  const people=response?.people||{};
  const fetchPage=useCallback(async()=>{
    const token=++requestIdRef.current;
    setLoading(true);setError("");
    try{
      const params=new URLSearchParams();
      const query=mode==="account"?{mode:"account",email:lookupEmail}:{mode:"list",...applied,cursor:pages.at(-1)||"",limit:"40"};
      for(const [key,value] of Object.entries(query)) if(value!==""&&value!=null)params.set(key,String(value));
      const data=await authenticatedFetch("/api/admin/business-register?"+params.toString(),{cache:"no-store"});
      if(token===requestIdRef.current)setResponse(data);
    }catch(err){if(token===requestIdRef.current){setError(err.message||"Business records could not be loaded.");setResponse(null);}}
    finally{if(token===requestIdRef.current)setLoading(false);}
  },[mode,lookupEmail,applied,pages,revision]);
  useEffect(()=>{fetchPage();return()=>{requestIdRef.current+=1;};},[fetchPage]);
  function apply(event){event?.preventDefault?.();setMode("list");setPages([]);setApplied({...filters});}
  function accountSearch(event){event?.preventDefault?.();if(!lookup.trim())return;setPages([]);setLookupEmail(lookup.trim().toLowerCase());setMode("account");}
  function reset(){setMode("list");setFilters(EMPTY);setApplied(EMPTY);setLookup("");setPages([]);setRevision(n=>n+1);}
  const summary=useMemo(()=>({pending:resultRows.filter(row=>["ownership","identity","launch"].includes(row.readiness.attention)).length,independent:resultRows.filter(row=>row.readiness.assist).length,created:resultRows.filter(row=>row.relationships?.includes("created")).length}),[resultRows]);
  return <>
    <main className="mx-auto max-w-[1540px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[var(--accent)]">Marketplace operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Business control centre</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Search business brands, see who created or claimed them, distinguish directory visibility from merchant approval, and navigate to the correct review. No status changes are performed from this register.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setRevision(x=>x+1)}><RefreshCw className="h-4 w-4"/>Refresh</Button><Link href="/marketplace" className="rounded-xl border px-4 py-3 text-sm font-semibold">Marketplace overview</Link></div></div>
      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(250px,1fr)]">
        <Card className="p-5"><div className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-[var(--accent)]"/><h2 className="font-semibold">What these states mean</h2></div><p className="mt-2 text-sm leading-6 text-secondary">A business can be visible in the directory without a verified owner. A verified owner does not automatically enable checkout. Spotly Assist is independent shopping, not merchant approval. Review decisions still happen in their dedicated, audited queues.</p></Card>
        <Card className="p-5"><p className="font-semibold">Find businesses added by one account</p><p className="mt-1 text-xs leading-5 text-secondary">Search an exact registered email. Results distinguish records the person created, currently owns and only claimed.</p><form onSubmit={accountSearch} className="mt-3 flex flex-wrap gap-2"><input type="email" required value={lookup} onChange={e=>setLookup(e.target.value)} placeholder="Account email" className="field-control min-w-0 flex-1 text-sm"/><Button type="submit"><UserRoundSearch className="h-4 w-4"/>Find</Button></form></Card>
      </div>
      <form onSubmit={apply} className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Search and filters</h2><Button type="button" size="sm" variant="ghost" onClick={reset}><FilterX className="h-4 w-4"/>Reset all</Button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Labeled label="Name, category, ID or creator"><input className="field-control w-full text-sm" value={filters.q} onChange={e=>setFilters(f=>({...f,q:e.target.value}))} placeholder="Search businesses…"/></Labeled>
          <Labeled label="City"><input className="field-control w-full text-sm" value={filters.city} onChange={e=>setFilters(f=>({...f,city:e.target.value}))} placeholder="Any city"/></Labeled>
          <Select label="Ownership" value={filters.ownership} options={OPTIONS.ownership} onChange={v=>setFilters(f=>({...f,ownership:v}))}/>
          <Select label="Verification" value={filters.verification} options={OPTIONS.verification} onChange={v=>setFilters(f=>({...f,verification:v}))}/>
          <Select label="Publication" value={filters.publication} options={OPTIONS.publication} onChange={v=>setFilters(f=>({...f,publication:v}))}/>
          <Select label="Orderability" value={filters.commerce} options={OPTIONS.commerce} onChange={v=>setFilters(f=>({...f,commerce:v}))}/>
          <Select label="Needs attention" value={filters.attention} options={OPTIONS.attention} onChange={v=>setFilters(f=>({...f,attention:v}))}/>
          <Labeled label="Source type"><input className="field-control w-full text-sm" value={filters.source} onChange={e=>setFilters(f=>({...f,source:e.target.value}))} placeholder="e.g. owner_created"/></Labeled>
          <Labeled label="Created from (UTC)"><input type="date" value={filters.from} className="field-control w-full text-sm" onChange={e=>setFilters(f=>({...f,from:e.target.value}))}/></Labeled>
          <Labeled label="Created through (UTC)"><input type="date" value={filters.to} className="field-control w-full text-sm" onChange={e=>setFilters(f=>({...f,to:e.target.value}))}/></Labeled>
          <Select label="Sort by" value={filters.sort} options={OPTIONS.sort} onChange={v=>setFilters(f=>({...f,sort:v}))}/>
          <Select label="Direction" value={filters.direction} options={OPTIONS.direction} onChange={v=>setFilters(f=>({...f,direction:v}))}/>
        </div>
        <div className="mt-4 flex justify-end"><Button type="submit"><Search className="h-4 w-4"/>Apply filters</Button></div>
      </form>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{mode==="account"?"Account relationships": "Business register"}{loading?<span className="ml-2 text-sm font-normal text-secondary">Loading…</span>:null}</h2><p className="mt-1 text-xs text-secondary">{mode==="account"?(response?.account?response.account.name+" · "+response.account.email:response?.note||"Account lookup"):"Results are paginated and server-filtered. Counts below cover this result page, not the entire database."}</p></div><div className="flex flex-wrap gap-2"><Tone value="claim_pending">{summary.pending} reviews in view</Tone><Tone value="independent_assist">{summary.independent} Assist in view</Tone><Button variant="outline" size="sm" disabled={!resultRows.length} onClick={()=>downloadCSV(resultRows)}><ArrowDownToLine className="h-4 w-4"/>Export visible results</Button></div></div>
      {error?<div role="alert" className="mt-4 rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm text-danger">{error}</div>:null}
      <Card className="mt-4 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs text-secondary"><tr>{["Business","Ownership / origin","Verification","Directory & commerce","Next step","Created",""].map(x=><th key={x} className="px-4 py-3 font-semibold">{x}</th>)}</tr></thead><tbody>{resultRows.map(row=><tr key={row.id} className="border-t border-[var(--border-subtle)] align-top hover:bg-[var(--surface-2)]/60"><td className="max-w-[230px] px-4 py-4"><button onClick={()=>setSelected(row)} className="text-left font-semibold text-[var(--accent)] hover:underline">{row.name}</button><p className="mt-1 text-xs text-secondary">{row.category} · {row.city||"City unknown"}</p><p className="mt-2 break-all text-[10px] text-tertiary">{row.id}</p></td><td className="px-4 py-4"><Tone value={row.readiness.ownership}/><p className="mt-2 max-w-[185px] truncate text-xs text-secondary">{people[row.createdBy]?.email||people[row.createdBy]?.name||row.createdBy||"Creator unknown"}</p>{row.relationships?<p className="mt-2 text-xs font-semibold">Account: {row.relationships.join(" + ")}</p>:null}</td><td className="px-4 py-4"><Tone value={row.readiness.verification}/></td><td className="px-4 py-4"><Tone value={row.readiness.publication}/><div className="mt-2"><Tone value={row.readiness.commerce}/></div></td><td className="max-w-[220px] px-4 py-4"><p className="text-xs leading-5">{row.readiness.next}</p></td><td className="whitespace-nowrap px-4 py-4 text-xs text-secondary">{fmtDate(row.createdAt)}</td><td className="px-4 py-4"><Button size="sm" variant="outline" onClick={()=>setSelected(row)}>Inspect <ChevronRight className="h-4 w-4"/></Button></td></tr>)}</tbody></table></div>
        {!loading&&!resultRows.length?<EmptyState icon={Building2} title="No matching business records on this query" description={mode==="account"?"Check the account email. The account may have submitted claims without being an approved owner, or the business may be in a pending intake workflow.":"Adjust your filters, try Record ID sorting to include older records, or navigate to the next page."}/>:null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] p-4"><p className="text-xs leading-5 text-secondary">{mode==="account"?(response?.claims?.length||0)+" related claim submissions (not automatic ownership)":resultRows.length+" matching records this page · "+(response?.scanned||0)+" scanned"}{response?.incomplete?" · Account results capped at 100 per relationship":""}</p>{mode==="list"&&<div className="flex gap-2"><Button size="sm" variant="outline" disabled={!pages.length||loading} onClick={()=>setPages(p=>p.slice(0,-1))}><ChevronLeft className="h-4 w-4"/>Previous</Button><Button size="sm" disabled={!response?.hasMore||!response?.nextCursor||loading} onClick={()=>setPages(p=>[...p,response.nextCursor])}>Next page <ChevronRight className="h-4 w-4"/></Button></div>}</div></Card>
      {mode==="account"&&response?.claims?.length?<Card className="mt-5 p-5"><h3 className="font-semibold">Claims submitted by this account</h3><p className="mt-1 text-xs leading-5 text-secondary">Claims are requests for review, not verified ownership or merchant approval.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{response.claims.map(claim=><div key={claim.id} className="rounded-xl border p-3 text-sm"><p className="font-semibold">{claim.businessName||claim.businessId||"Business claim"}</p><p className="mt-1 text-xs text-secondary">{claim.status} · {fmtDate(claim.createdAt)}</p><Link href="/work" className="mt-2 inline-block text-xs font-semibold text-[var(--accent)]">Open claims review →</Link></div>)}</div></Card>:null}
      <div className="mt-6 flex flex-wrap gap-3 text-sm"><Link href="/work" className="inline-flex items-center gap-2 text-[var(--accent)]"><ShieldCheck className="h-4 w-4"/>Review claims and launch decisions <ArrowRight className="h-4 w-4"/></Link><Link href="/admin/assist-research" className="inline-flex items-center gap-2 text-[var(--accent)]"><Store className="h-4 w-4"/>Independent Assist source research <ArrowRight className="h-4 w-4"/></Link></div>
    </main>
    {selected&&<BusinessDetail row={selected} people={people} onClose={()=>setSelected(null)}/>}
  </>;
}
export function AdminBusinessRegister(){
  return <AuthGate portal="admin" title="Sign in to Spotly Admin"><AdminAccess><PortalShell portalId="admin" activeSection="marketplace"><AdminBusinessRegisterBody/></PortalShell></AdminAccess></AuthGate>;
}
