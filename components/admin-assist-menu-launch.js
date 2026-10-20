"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ShieldCheck,Utensils,ExternalLink} from "lucide-react";
import {AuthGate} from "@/components/auth-gate";
import {AdminAccess} from "@/components/admin-legacy-sections";
import {PortalShell} from "@/components/portal-shell";
import {authenticatedFetch} from "@/lib/api-client";
const field="mt-2 w-full rounded-xl border bg-[var(--surface)] px-3 py-3 text-sm";
export function AssistMenuLaunch(){
 const [batches,setBatches]=useState([]),[batchId,setBatchId]=useState("");
 const [locations,setLocations]=useState([]),[locationId,setLocationId]=useState("");
 const [detail,setDetail]=useState(null),[selected,setSelected]=useState([]);
 const [opsReady,setOpsReady]=useState(false),[rightsReady,setRightsReady]=useState(false);
 const [busy,setBusy]=useState(""),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const [preflight,setPreflight]=useState(null);
 const [menuPriceId,setMenuPriceId]=useState(""),[newPrice,setNewPrice]=useState(""),[priceMethod,setPriceMethod]=useState("phone"),[priceEvidence,setPriceEvidence]=useState(""),[priceRight,setPriceRight]=useState(false),[confirmedBranch,setConfirmedBranch]=useState(false);
 const [brandFilter,setBrandFilter]=useState("");
 useEffect(()=>{
   authenticatedFetch("/api/admin/assist-research").then(data=>{
     const items=(data.batches||[]).filter(x=>x.country==="ZW");
     setBatches(items);if(items[0])setBatchId(items[0].id);
   }).catch(e=>setError(e.message||"Unable to load research batches."));
 },[]);
 useEffect(()=>{
   if(!batchId)return;
   let active=true;setLocations([]);setLocationId("");setDetail(null);
   authenticatedFetch("/api/admin/assist-research/activate-menu?batchId="+encodeURIComponent(batchId))
     .then(d=>{if(active)setLocations(d.locations||[]);}).catch(e=>{if(active)setError(e.message);});
   return()=>{active=false};
 },[batchId]);
 useEffect(()=>{
   if(!batchId||!locationId)return;
   let active=true;setError("");setNotice("");setDetail(null);setPreflight(null);setSelected([]);setOpsReady(false);setRightsReady(false);setMenuPriceId("");setNewPrice("");setPriceEvidence("");setConfirmedBranch(false);setPriceRight(false);
   authenticatedFetch("/api/admin/assist-research/activate-menu?batchId="+encodeURIComponent(batchId)+"&locationId="+encodeURIComponent(locationId))
     .then(d=>{if(active)setDetail(d);}).catch(e=>{if(active)setError(e.message);});
   return()=>{active=false};
 },[batchId,locationId]);
 async function checkPilot(){
   setBusy("preflight");setError("");setPreflight(null);
   try{
     const d=await authenticatedFetch("/api/admin/assist-research/pilot-preflight?batchId="+encodeURIComponent(batchId)+"&locationId="+encodeURIComponent(locationId));
     setPreflight(d);
   }catch(e){setError(e.message||"Could not inspect pilot readiness.");}
   finally{setBusy("");}
 }
 async function confirmBranchPrice(){
   if(!menuPriceId||newPrice===""||!confirmedBranch||!priceRight||priceEvidence.trim().length<8)return;
   setBusy("price");setError("");setNotice("");
   try{
     await authenticatedFetch("/api/admin/assist-research/location-prices",{
       method:"POST",body:JSON.stringify({batchId,locationId,priceId:menuPriceId,
         method:priceMethod,verifiedPrice:Number(newPrice),notes:priceEvidence,
         sourceRightsReviewed:true,confirmedForThisLocation:true})
     });
     const response=await authenticatedFetch("/api/admin/assist-research/activate-menu?batchId="+encodeURIComponent(batchId)+"&locationId="+encodeURIComponent(locationId));
     setDetail(response);setMenuPriceId("");setNewPrice("");setPriceEvidence("");setConfirmedBranch(false);setPriceRight(false);setPreflight(null);
     setNotice("Current price saved for this specific branch only. No public menu or customer request was activated.");
   }catch(e){setError(e.message||"Could not verify this location's price.");}
   finally{setBusy("");}
 }
 async function execute(action){
   setBusy(action);setError("");setNotice("");
   try{
     await authenticatedFetch("/api/admin/assist-research/activate-menu",{
       method:"POST",body:JSON.stringify({batchId,locationId,action,
         priceIds:action==="enable"?selected:[],
         operationalAttested:opsReady,agreementConfirmed:rightsReady})
     });
     setNotice(action==="pause"?"Spotly Assist requests paused.":"Verified menu activated for customer price-check requests. No payments or dispatch activated.");
     const d=await authenticatedFetch("/api/admin/assist-research/activate-menu?batchId="+encodeURIComponent(batchId)+"&locationId="+encodeURIComponent(locationId));
     setDetail(d);setPreflight(null);
   }catch(e){setError(e.message);}finally{setBusy("");}
 }
 const eligibleLocations=locations.filter(x=>["approved","published"].includes(x.publicationState));
 const allBrands=[...new Set(locations.map(x=>x.brandName||x.name))].sort();
 const displayedLocations=locations.filter(x=>!brandFilter||(x.brandName||x.name)===brandFilter);
 const eligible=(detail?.prices||[]).filter(x=>x.verified);
 return <AuthGate portal="admin" title="Spotly Admin sign in" sameOriginLogin><AdminAccess><PortalShell portalId="admin" activeSection="marketplace">
  <main className="mx-auto max-w-[1100px] px-5 py-9">
   <Link href="/admin/assist" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4"/>Assist Operations</Link>
   <div className="mt-7 flex items-start gap-4"><span className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]"><Utensils className="h-6 w-6"/></span><div>
    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Zimbabwe · Independent shopping</p>
    <h1 className="mt-2 text-3xl font-semibold">Multi-brand restaurant launch queue</h1>
    <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Prepare all imported brands and branches individually. Approval keeps businesses private; a separate discovery launch and independently verified branch menu are required before customer requests. Nothing launches automatically.</p>
   </div></div>
   <section className="mt-7 rounded-2xl border bg-[var(--surface)] p-6">
    <div className="grid gap-4 sm:grid-cols-2">
     <label className="text-xs font-semibold">Staged research batch<select className={field} value={batchId} onChange={e=>setBatchId(e.target.value)}><option value="">Choose batch</option>{batches.map(b=><option key={b.id} value={b.id}>{b.id} · {b.locationCount} locations</option>)}</select></label>
     <label className="text-xs font-semibold">Approved restaurant for menu preparation<select className={field} value={locationId} onChange={e=>setLocationId(e.target.value)}><option value="">Choose branch</option>{eligibleLocations.map(l=><option key={l.id} value={l.id}>{l.name} · {l.city} ({l.publicationState})</option>)}</select></label>
    </div>
    {batchId&&!eligibleLocations.length&&<p className="mt-4 rounded-xl border p-4 text-sm text-[var(--text-2)]">The imported locations are still in research. Review and approve individual restaurants privately before preparing their menus.</p>}
    {batchId&&<div className="mt-6 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
       <div><h2 className="text-lg font-semibold">All researched restaurants ({locations.length})</h2><p className="mt-1 text-xs text-[var(--text-2)]">{allBrands.length} brands · {locations.filter(x=>x.publicationState==="approved").length} privately approved · {locations.filter(x=>x.publicationState==="published").length} marked published · {locations.filter(x=>!["approved","published","rejected","linked_existing"].includes(x.publicationState)).length} awaiting approval</p></div>
       <label className="text-xs font-semibold">Filter by brand<select className={field} value={brandFilter} onChange={e=>setBrandFilter(e.target.value)}><option value="">All brands</option>{allBrands.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
      </div>
      <div className="mt-4 max-h-[400px] space-y-2 overflow-y-auto">{displayedLocations.map(loc=><div key={loc.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-2)] p-3">
       <div><p className="text-sm font-semibold">{loc.name}</p><p className="mt-1 text-xs text-[var(--text-2)]">{loc.city} · {loc.brandName||"Independent"} · {loc.publicationState.replaceAll("_"," ")}</p></div>
       {["approved","published"].includes(loc.publicationState)?<button type="button" onClick={()=>setLocationId(loc.id)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Prepare menu</button>:<Link href="/admin/assist-research" className="text-xs font-semibold text-[var(--accent)]">Review</Link>}
      </div>)}</div>
    </div>}
    {error&&<p role="alert" className="mt-5 rounded-xl border p-4 text-sm text-[var(--danger)]">{error}</p>}
    {notice&&<p role="status" className="mt-5 rounded-xl border p-4 text-sm text-[var(--success)]">{notice}</p>}
    {detail&&<div className="mt-7 border-t pt-6">
     <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">{detail.restaurant}</h2><p className="mt-2 text-xs text-[var(--text-2)]">Business: {detail.businessId} · Branch: {detail.branchId}</p></div><span className="rounded-full bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold">{detail.existingStore?.status||"Not activated"}</span></div>
     {!detail.canActivate&&<p className="mt-5 rounded-xl border p-4 text-sm text-[var(--danger)]">{detail.reason}</p>}
     <div className="mt-5"><button type="button" onClick={checkPilot} disabled={!!busy} className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-40">{busy==="preflight"?"Running checks…":"Run read-only pilot checks"}</button></div>
     {preflight&&<div className="mt-4 rounded-xl border bg-[var(--surface-2)] p-4"><h3 className="font-semibold">Pilot readiness · {preflight.checks.filter(x=>x.pass).length}/{preflight.checks.length} checks passed</h3><p className="mt-2 text-xs text-[var(--text-2)]">{preflight.independentlyVerifiedPrices} verified prices out of {preflight.totalPriceReferences} researched menu items. This test makes no Firestore changes.</p><div className="mt-4 space-y-3">{preflight.checks.map(x=><div key={x.id} className="flex gap-3 text-sm"><span aria-label={x.pass?"Passed":"Blocked"} className={x.pass?"font-semibold text-[var(--success)]":"font-semibold text-[var(--danger)]"}>{x.pass?"PASS":"BLOCK"}</span><div><p className="font-medium">{x.label}</p>{!x.pass&&<p className="mt-1 text-xs text-[var(--text-2)]">{x.detail}</p>}</div></div>)}</div></div>}
     <div className="mt-5 flex gap-3 rounded-xl bg-[var(--surface-2)] p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-[var(--accent)]"/><p className="text-sm text-[var(--text-2)]">Only menu prices independently checked within the last 14 days qualify. Each customer still receives a final price quote before any transaction.</p></div>
     <div className="mt-6 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">Verified menu ({eligible.length})</h3><button type="button" className="text-xs font-semibold text-[var(--accent)]" onClick={()=>setSelected(eligible.map(x=>x.id))}>Select all verified</button></div>
     <div className="mt-3 max-h-[440px] space-y-2 overflow-y-auto">{(detail.prices||[]).map(p=><label key={p.id} className={"flex items-start gap-3 rounded-xl border p-4 "+(!p.verified?"opacity-60":"")}>
       <input className="mt-1 h-4 w-4" type="checkbox" disabled={!p.verified||!detail.canActivate} checked={selected.includes(p.id)} onChange={e=>setSelected(curr=>e.target.checked?[...curr,p.id]:curr.filter(x=>x!==p.id))}/>
       <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{p.name}</p><p className="mt-1 text-xs text-[var(--text-2)]">{p.verified?("Verified "+p.currency+" "+Number(p.verifiedPrice).toFixed(2)+" · "+String(p.checkedAt||"").slice(0,10)):"Online price reference only · independent verification required"}</p></div>
       <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={"Price source for "+p.name}><ExternalLink className="h-4 w-4 text-[var(--accent)]"/></a>
     </label>)}{!detail.prices?.length&&<p className="text-sm text-[var(--text-2)]">No research menu items matched this restaurant brand.</p>}</div>
     <div className="mt-6 rounded-xl border p-5">
       <h3 className="text-lg font-semibold">Verify one item for this branch</h3>
       <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">This is independent location-level verification. An online menu price or a check at another branch is not sufficient.</p>
       <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Research item<select className={field} value={menuPriceId} onChange={e=>{setMenuPriceId(e.target.value);setNewPrice("");setPriceEvidence("");setPriceRight(false);setConfirmedBranch(false);}}><option value="">Choose menu reference</option>{(detail.prices||[]).map(p=><option key={p.id} value={p.id}>{p.name} {p.verified?"(verified here)":""}</option>)}</select></label>
        <label className="text-xs font-semibold">Actual confirmed price (USD)<input className={field} type="number" min="0" max="100000" step=".01" value={newPrice} onChange={e=>setNewPrice(e.target.value)} placeholder="Enter independently checked price"/></label>
        <label className="text-xs font-semibold">How was it checked?<select className={field} value={priceMethod} onChange={e=>setPriceMethod(e.target.value)}><option value="phone">Confirmed by phone</option><option value="in_person">Confirmed in person</option><option value="business_confirmed">Confirmed directly by the business</option></select></label>
        <label className="text-xs font-semibold">Verification evidence<input className={field} value={priceEvidence} onChange={e=>setPriceEvidence(e.target.value)} placeholder="Date, contact, item and verification details"/></label>
       </div>
       <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmedBranch} onChange={e=>setConfirmedBranch(e.target.checked)}/>I verified the price for this exact restaurant location, not merely another outlet of the same brand.</label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={priceRight} onChange={e=>setPriceRight(e.target.checked)}/>I independently reviewed factual item information and source-use rights.</label>
       </div>
       <button type="button" className="mt-5 rounded-xl border border-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-40" disabled={!!busy||!menuPriceId||newPrice===""||!Number.isFinite(Number(newPrice))||Number(newPrice)<0||priceEvidence.trim().length<8||!confirmedBranch||!priceRight} onClick={confirmBranchPrice}>{busy==="price"?"Verifying…":"Save location-specific price verification"}</button>
     </div>
     <div className="mt-5 space-y-3 rounded-xl border p-5">
       <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={opsReady} onChange={e=>setOpsReady(e.target.checked)} className="mt-1"/>I confirmed local Spotly shopper capacity and independent purchasing enquiries can be handled at this location.</label>
       <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={rightsReady} onChange={e=>setRightsReady(e.target.checked)} className="mt-1"/>I reviewed sourcing rights, and the selected factual items and prices have been independently verified.</label>
     </div>
     <div className="mt-5 flex flex-wrap gap-3">
       <button type="button" disabled={!!busy||!detail.canActivate||!opsReady||!rightsReady||!selected.length} onClick={()=>execute("enable")} className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy==="enable"?"Activating…":"Enable price-check requests"}</button>
       {detail.existingStore&&<button type="button" disabled={!!busy} onClick={()=>execute("pause")} className="rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-40">{busy==="pause"?"Pausing…":"Pause requests"}</button>}
       {detail.existingStore?.status==="published"&&<Link href={"/shop-for-me?store="+encodeURIComponent(detail.existingStore.id)} className="rounded-xl border px-5 py-3 text-sm font-semibold">Preview customer menu</Link>}
     </div>
     <p className="mt-4 text-xs leading-5 text-[var(--text-2)]">Spotly Assist enquiries are separate from merchant ordering. The menu cannot collect payments or dispatch shoppers from this screen.</p>
    </div>}
   </section>
  </main>
 </PortalShell></AdminAccess></AuthGate>;
}
