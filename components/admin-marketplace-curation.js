"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Database, MapPinned, PackageSearch, RefreshCw, ShieldCheck, Store, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageSkeleton } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";

function Metric({icon:Icon,label,value,hint}){return <Card className="p-5"><span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--admin-soft)] text-[var(--admin)]"><Icon className="h-5 w-5"/></span><p className="mt-4 text-2xl font-semibold tracking-[-.04em]">{Number(value||0).toLocaleString()}</p><p className="mt-1 text-sm font-semibold">{label}</p><p className="mt-1 text-xs leading-5 text-secondary">{hint}</p></Card>;}
function SourceCard({name,description,count,badge,children}){return <Card className="p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-2)] text-[var(--accent)]"><Database className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{name}</h3><Badge tone="success">{badge}</Badge></div><p className="mt-2 text-sm leading-6 text-secondary">{description}</p>{count!=null?<p className="mt-3 text-sm font-semibold">{Number(count).toLocaleString()} bundled records</p>:null}{children}</div></div></Card>;}

export function AdminMarketplaceCuration(){
 const[status,setStatus]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState("");
 const [syncProgress,setSyncProgress]=useState(""),cancelSyncRef=useRef(false);const{toast}=useToast();
 const load=useCallback(async()=>{setLoading(true);try{setStatus(await authenticatedFetch("/api/admin/curation"));}catch(error){toast(error.message,{type:"error",title:"Curation status unavailable"});}finally{setLoading(false);}},[toast]);
 useEffect(()=>{load();},[load]);
 async function sync(action){
   cancelSyncRef.current=false;
   setBusy(action);setSyncProgress("Starting sync…");
   const totals={places:{created:0,updated:0,preserved:0},products:{created:0,updated:0,preserved:0}};
   let cursor={action,phase:"places",offset:0};
   try{
     do{
       const result=await authenticatedFetch("/api/admin/curation",{method:"POST",body:JSON.stringify(cursor)});
       for(const kind of ["places","products"]){
         const chunk=result[kind];if(!chunk)continue;
         for(const field of ["created","updated","preserved"])totals[kind][field]+=Number(chunk[field]||0);
       }
       setSyncProgress(`${result.progress.stage==="places"?"Places":"Products"}: ${result.progress.processed.toLocaleString()} of ${result.progress.total.toLocaleString()} processed`);
       cursor=result.progress.next;
     }while(cursor&&!cancelSyncRef.current);
     const finished=!cursor;
     toast(finished
       ? `Sync complete. ${totals.places.created} places and ${totals.products.created} products created; previously verified or claimed records preserved.`
       : "Sync paused safely between batches. You can start again; existing IDs are preserved.",
       {title:finished?"Marketplace data synced":"Sync paused",duration:7000});
     await load();
   }catch(error){
     toast(`Sync stopped after ${syncProgress||"a partial batch"}. ${error.message}. Previously committed batches remain saved; retry is idempotent.`,
       {type:"error",title:"Sync interrupted",duration:9000});
   }finally{setBusy("");setSyncProgress("");}
 }
 if(loading&&!status)return <PageSkeleton cards={4} rows={3}/>;
 if(!status)return <EmptyState icon={TriangleAlert} title="Curation status unavailable" description="Retry the server-authoritative marketplace data status." action={<Button onClick={load}>Retry</Button>}/>;
 const placeMeta=status.sources?.places||{},productMeta=status.sources?.products||{};
 return <div className="space-y-6">
  <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold text-[var(--admin)]">Curated marketplace</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.04em]">Build the city before every merchant joins.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Open-data places are discovery-only until claimed and commerce verified. Canonical products are identities only; price, stock, pickup and delivery require a real merchant offer.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4"/>Refresh</Button><Button disabled={Boolean(busy)} onClick={()=>sync("sync_all")} loading={busy==="sync_all"}><Database className="h-4 w-4"/>Sync approved open data</Button>{busy?<Button variant="outline" onClick={()=>{cancelSyncRef.current=true;}}>Stop after current batch</Button>:null}</div></div></div>
  {busy&&syncProgress?<p role="status" aria-live="polite" className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm">{syncProgress}. You can pause safely between batches.</p>:null}
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={MapPinned} label="Open place records" value={placeMeta.recordCount} hint="Harare, Bulawayo, Mutare and Gweru"/><Metric icon={Store} label="Curated places in Firestore" value={status.firestore?.curatedPlaces} hint="Safe to override after a verified claim"/><Metric icon={PackageSearch} label="Canonical products" value={productMeta.recordCount} hint="Not store inventory or prices"/><Metric icon={ShieldCheck} label="Master products in Firestore" value={status.firestore?.masterProducts} hint="Merchant offers stay separate"/></div>
  <div className="grid gap-4 lg:grid-cols-2"><SourceCard name="OpenStreetMap" badge="ODbL approved" count={placeMeta.recordCount} description="Named commercial and service places. Every record retains its OSM element, attribution and ODbL provenance."><div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={()=>sync("sync_places")} loading={busy==="sync_places"}>Sync places</Button><a className="inline-flex items-center text-xs font-semibold text-[var(--accent)]" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">License & attribution</a></div></SourceCard><SourceCard name="Spotly + Open Food Facts" badge="Rights tracked" count={productMeta.recordCount} description="Spotly-created grocery references plus eligible Open Food Facts product identities. Open Food Facts images are intentionally not imported."><div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={()=>sync("sync_products")} loading={busy==="sync_products"}>Sync products</Button><a className="inline-flex items-center text-xs font-semibold text-[var(--accent)]" href="https://world.openfoodfacts.org/terms-of-use" target="_blank" rel="noreferrer">Data terms</a></div></SourceCard></div>
  <Card className="overflow-hidden"><div className="border-b border-[var(--border-subtle)] p-5"><h3 className="font-semibold">Commerce safety policy</h3><p className="mt-1 text-sm text-secondary">These are enforced by server data, not only hidden buttons.</p></div><div className="grid gap-px bg-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-4">{[["Unclaimed pickup","Disabled"],["Unclaimed cash","Disabled"],["Store stock claims","Merchant offer required"],["Rights-unclear sources","Excluded from default import"]].map(([label,value])=><div key={label} className="bg-[var(--surface)] p-5"><p className="text-xs font-semibold text-tertiary">{label.toUpperCase()}</p><p className="mt-2 font-semibold">{value}</p></div>)}</div></Card>
  <div className="rounded-[16px] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--on-warning-soft)]"><div className="flex gap-3"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0"/><p><strong>Not imported by default:</strong> Google Maps bulk data, retailer catalogue scraping, social-directory scraping and the older `provisional_review_required` research set. Those remain out until reusable-data rights are confirmed.</p></div></div>
 </div>;
}
