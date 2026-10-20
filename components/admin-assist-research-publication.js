"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Building2, CheckCircle2, ChevronRight, ClipboardCheck, ExternalLink, Globe2, Link2, LoaderCircle, ShieldCheck, Store, Undo2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";

const freshLocation = (loc) => ({
  decision:loc.publicationReview?.decision || "new_business",
  businessId:loc.publicationReview?.businessId || "",
  branchId:loc.publicationReview?.branchId || "",
  verifiedAddress:loc.publicationReview?.verifiedAddress || (loc.address||""),
  contactMethod:loc.publicationReview?.contactMethod || "phone",
  addressVerified:loc.publicationReview?.addressVerified === true,
  operatingVerified:loc.publicationReview?.operatingVerified === true,
  sourceRightsReviewed:loc.publicationReview?.sourceRightsReviewed === true,
  duplicatesReviewed:loc.publicationReview?.duplicatesReviewed === true,
  notes:loc.publicationReview?.notes || ""
});
const freshPrice = (p) => ({
  decision:p.review?.decision || "verified",
  checkedPrice:String(p.review?.verifiedPrice ?? p.onlineReferencePrice),
  method:p.review?.method || "not_verified",
  factualDataRightsReviewed:p.review?.factualDataRightsReviewed === true,
  notes:p.review?.notes || ""
});
const field = "mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/30";
const checkedText = (date) => { try { return date?new Date(date).toLocaleDateString("en-ZW"):"Not checked"; } catch { return "Not checked"; } };
const canReview = (form) => form.decision === "reject" ||
  (form.decision === "new_business"
    ? form.addressVerified && form.operatingVerified && form.sourceRightsReviewed && form.duplicatesReviewed && form.verifiedAddress.trim().length >= 8
    : form.sourceRightsReviewed && form.duplicatesReviewed && form.businessId.trim().length >= 4);

export function AssistResearchPublication({batchId,duplicateReport=null}) {
  const [data,setData] = useState(null);
  const [selectedId,setSelectedId] = useState("");
  const [tab,setTab] = useState("locations");
  const [locationForm,setLocationForm] = useState(null);
  const [priceForm,setPriceForm] = useState(null);
  const [priceId,setPriceId] = useState("");
  const [busy,setBusy] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [filter,setFilter] = useState("");
  const [withdrawReason,setWithdrawReason] = useState("");
  const [publishConfirmation,setPublishConfirmation] = useState(false);

  async function refresh(preserve = true) {
    setError("");
    try{
      const payload=await authenticatedFetch("/api/admin/assist-research/publication?batchId="+encodeURIComponent(batchId));
      setData(payload);
      const location=payload.locations.find(x=>x.id === (preserve ? selectedId : "")) || payload.locations[0];
      if(location) {
        setSelectedId(location.id);
        setLocationForm(freshLocation(location));
      }
      const price=payload.prices.find(x=>x.id === (preserve ? priceId : "")) || payload.prices[0];
      if(price){setPriceId(price.id);setPriceForm(freshPrice(price));}
    }catch(err){setError(err.message || "Could not load restaurant publication review.");}
  }
  useEffect(()=>{
    let active=true;setData(null);setBusy("");setError("");setNotice("");
    authenticatedFetch("/api/admin/assist-research/publication?batchId="+encodeURIComponent(batchId))
      .then(payload=>{
        if(!active)return;setData(payload);
        const loc=payload.locations[0],price=payload.prices[0];
        if(loc){setSelectedId(loc.id);setLocationForm(freshLocation(loc));}
        if(price){setPriceId(price.id);setPriceForm(freshPrice(price));}
      }).catch(err=>{if(active)setError(err.message);});
    return()=>{active=false;};
  },[batchId]);
  const location=data?.locations.find(x=>x.id===selectedId);
  const price=data?.prices.find(x=>x.id===priceId);
  const suggested=(duplicateReport?.results || []).find(item=>item.id===selectedId)?.existingCandidates || [];
  const selectable=suggested.filter(item=>item.type!=="curated" && item.businessId && item.rank!=="brand_only");
  const locations=useMemo(()=> (data?.locations||[]).filter(x =>
    !filter || [x.name,x.brandName,x.city,x.area,x.publicationState].join(" ").toLowerCase().includes(filter.toLowerCase())
  ),[data,filter]);
  async function saveLocation(){
    if(!location || !locationForm)return;
    setBusy("location");setError("");setNotice("");
    try {
      await authenticatedFetch("/api/admin/assist-research/publication",{
        method:"PATCH",body:JSON.stringify({action:"review_location",batchId,locationId:location.id,...locationForm})
      });
      setNotice("Location review recorded with an audit entry. Nothing has been published.");
      await refresh();
    }catch(err){setError(err.message);}finally{setBusy("");}
  }
  async function publish(){
    if(!location || !publishConfirmation)return;
    setBusy("publish");setError("");setNotice("");
    try{
      const result=await authenticatedFetch("/api/admin/assist-research/publication",{
        method:"POST",body:JSON.stringify({batchId,locationId:location.id})
      });
      setNotice(result.state==="linked_existing"
        ? "Research was linked to the existing business without changing the merchant profile or catalogue."
        : "An unclaimed discovery listing was published. No shopping, checkout or Driver dispatch was activated.");
      setPublishConfirmation(false);
      await refresh();
    }catch(err){setError(err.message);}finally{setBusy("");}
  }
  async function withdraw(){
    if(!location || withdrawReason.trim().length<8)return;
    setBusy("withdraw");setError("");setNotice("");
    try{
      await authenticatedFetch("/api/admin/assist-research/publication",{
        method:"DELETE",body:JSON.stringify({batchId,locationId:location.id,reason:withdrawReason})
      });
      setNotice("Unclaimed directory listing withdrawn. History and source research are retained.");
      setWithdrawReason("");await refresh();
    }catch(err){setError(err.message);}finally{setBusy("");}
  }
  async function savePrice(){
    if(!price || !priceForm)return;
    setBusy("price");setError("");setNotice("");
    try{
      await authenticatedFetch("/api/admin/assist-research/publication",{
        method:"PATCH",body:JSON.stringify({
          action:"review_price",batchId,priceId:price.id,...priceForm,
          checkedPrice:priceForm.decision==="verified" ? Number(priceForm.checkedPrice):undefined
        })
      });
      setNotice("Price review saved privately. No merchant product or public menu item was created.");
      await refresh();
    }catch(err){setError(err.message);}finally{setBusy("");}
  }
  return <section className="mt-7 overflow-hidden rounded-2xl border bg-[var(--surface)]">
    <div className="border-b p-5 sm:p-7">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-[var(--accent-soft)] p-2.5 text-[var(--accent)]"><ClipboardCheck className="h-5 w-5"/></div>
        <div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Review before publication</p><h2 className="mt-1 text-2xl font-semibold">Approve & publish</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Validate each restaurant location and independent price record. Linking existing businesses does not modify them. New locations can publish as <strong>unclaimed, discovery-only</strong> listings after verification.</p>
        </div>
      </div>
      {data&&<div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Locations",data.summary.locationCount],["Reviewed",data.summary.reviewedLocations],["Published",data.summary.publishedLocations],["Prices reviewed",data.summary.reviewedPrices]].map(([label,count])=>
          <div key={label} className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-xl font-semibold">{count}</p><p className="mt-1 text-xs text-[var(--text-2)]">{label}</p></div>)}
      </div>}
      <div className="mt-5 flex flex-wrap gap-2">{[["locations","Review restaurants"],["prices","Review prices"]].map(([id,label])=><button type="button" key={id} onClick={()=>setTab(id)} className={"rounded-full px-4 py-2 text-sm font-semibold "+(tab===id?"bg-[var(--accent)] text-white":"border")}>{label}</button>)}</div>
      {error&&<p role="alert" className="mt-4 rounded-xl border p-3 text-sm text-[var(--danger)]">{error}</p>}
      {notice&&<p role="status" className="mt-4 rounded-xl border p-3 text-sm text-[var(--success)]">{notice}</p>}
    </div>
    {!data?<div className="flex items-center gap-3 p-8 text-sm"><LoaderCircle className="h-4 w-4 animate-spin"/>Loading research records…</div>:
      tab==="locations"?<div className="grid lg:grid-cols-[.9fr_1.5fr]">
        <div className="border-b p-4 lg:border-b-0 lg:border-r">
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search restaurant or city" className={field}/>
          <div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto">
            {locations.map(loc=><button type="button" key={loc.id} onClick={()=>{setSelectedId(loc.id);setLocationForm(freshLocation(loc));setError("");setNotice("");setPublishConfirmation(false);}} className={"w-full rounded-xl border p-3 text-left transition "+(selectedId===loc.id?"border-[var(--accent)] bg-[var(--accent-soft)]":"hover:border-[var(--accent)]/60")}>
              <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{loc.name}</p><p className="mt-1 text-xs text-[var(--text-2)]">{loc.city} · {loc.area}</p></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-3)]"/></div>
              <p className="mt-2 text-xs font-medium text-[var(--text-2)]">{loc.publicationState.replaceAll("_"," ")}</p>
            </button>)}
          </div>
        </div>
        <div className="min-w-0 p-5 sm:p-7">
          {location&&locationForm&&<div className="space-y-5">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Restaurant location</p><h3 className="mt-1 text-xl font-semibold">{location.name}</h3><p className="mt-2 text-sm text-[var(--text-2)]">{location.address || "Physical address missing"} · {location.city}</p><a href={location.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">Review original source <ExternalLink className="h-3 w-3"/></a></div>
            {["published","linked_existing","withdrawn"].includes(location.publicationState)?<div className="rounded-xl bg-[var(--surface-2)] p-4"><div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-5 w-5 text-[var(--accent)]"/>{location.publicationState.replaceAll("_"," ")}</div><p className="mt-2 text-xs text-[var(--text-2)]">Business ID: {location.linkedBusinessId || "—"} · Branch ID: {location.linkedBranchId || "—"}</p></div>:<>
              <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Publication decision<select value={locationForm.decision} onChange={e=>setLocationForm(s=>({...s,decision:e.target.value}))} className={field}><option value="new_business">Create new unclaimed listing</option><option value="link_existing">Link to existing Spotly business</option><option value="reject">Reject research location</option></select></label>
              <label className="text-xs font-semibold">How was the location checked?<select value={locationForm.contactMethod} onChange={e=>setLocationForm(s=>({...s,contactMethod:e.target.value}))} className={field}><option value="phone">Telephone</option><option value="in_person">In person</option><option value="business_confirmed">Confirmed by business</option><option value="independent_field_research">Independent field research</option></select></label></div>
              {locationForm.decision==="new_business"&&<label className="block text-xs font-semibold">Verified physical street address<input value={locationForm.verifiedAddress} onChange={e=>setLocationForm(s=>({...s,verifiedAddress:e.target.value}))} className={field} placeholder="Confirmed street and business entrance"/></label>}
              {locationForm.decision==="link_existing"&&<div className="space-y-3">{selectable.length>0&&<label className="block text-xs font-semibold">Choose an identified business or branch<select className={field} value="" onChange={e=>{const match=selectable.find(item=>item.type+"|"+item.id===e.target.value);if(match)setLocationForm(s=>({...s,businessId:match.businessId,branchId:match.type==="branch"?match.id:""}));}}><option value="">Select verified candidate…</option>{selectable.map(match=><option key={match.type+"_"+match.id} value={match.type+"|"+match.id}>{match.name} · {match.type} · {match.rank}</option>)}</select></label>}{suggested.some(x=>x.type==="curated")&&<p className="rounded-xl border p-3 text-xs text-[var(--text-2)]">This location may already exist in Spotly’s generated directory. Those records need separate canonical migration and cannot be linked as Firestore merchants here.</p>}<div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Existing Spotly business ID<input value={locationForm.businessId} onChange={e=>setLocationForm(s=>({...s,businessId:e.target.value}))} className={field} placeholder="Choose from duplicate review"/></label><label className="text-xs font-semibold">Branch ID (optional)<input value={locationForm.branchId} onChange={e=>setLocationForm(s=>({...s,branchId:e.target.value}))} className={field}/></label></div></div>}
              <div className="space-y-3 rounded-xl bg-[var(--surface-2)] p-4">{[
                ["addressVerified","I confirmed the exact physical address"],
                ["operatingVerified","This location is currently operating"],
                ["sourceRightsReviewed","I reviewed the factual source and usage rights"],
                ["duplicatesReviewed","I checked existing Spotly business and branch matches"]
              ].map(([key,label])=><label key={key} className="flex items-start gap-3 text-sm"><input type="checkbox" checked={locationForm[key]} onChange={e=>setLocationForm(s=>({...s,[key]:e.target.checked}))} className="mt-1 h-4 w-4"/>{label}</label>)}</div>
              <label className="block text-xs font-semibold">Review evidence / call notes<textarea rows={3} value={locationForm.notes} onChange={e=>setLocationForm(s=>({...s,notes:e.target.value}))} className={field} placeholder="What did you independently verify? Date, who you spoke to, duplicate determination and source review."/></label>
              <button type="button" disabled={!!busy||!canReview(locationForm)||locationForm.notes.trim().length<8} onClick={saveLocation} className="w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy==="location"?"Saving…":"Save verified review"}</button>
              {location.publicationState==="reviewed"&&<div className="border-t pt-5"><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={publishConfirmation} onChange={e=>setPublishConfirmation(e.target.checked)} className="mt-1 h-4 w-4"/>I understand this will {location.publicationReview?.decision==="link_existing"?"record a link without modifying the merchant":"publish a discovery-only unclaimed profile with no order or checkout capability"}.</label><button type="button" disabled={!!busy||!publishConfirmation} onClick={publish} className="mt-4 w-full rounded-xl border border-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-40">{busy==="publish"?"Processing…":location.publicationReview?.decision==="link_existing"?"Confirm existing business link":"Approve & publish listing"}</button></div>}
            </>}
            {location.publicationState==="published"&&<div className="border-t pt-5"><label className="block text-xs font-semibold">Withdraw reason<input value={withdrawReason} onChange={e=>setWithdrawReason(e.target.value)} className={field} placeholder="Required audit reason"/></label><button type="button" disabled={!!busy||withdrawReason.trim().length<8} onClick={withdraw} className="mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-40"><Undo2 className="h-4 w-4"/>Withdraw this unclaimed listing</button></div>}
            <div className="flex gap-2 rounded-xl border p-4 text-xs leading-5 text-[var(--text-2)]"><ShieldCheck className="h-4 w-4 shrink-0"/>No merchant commission, product catalogue, food ordering, shopping payment or Driver dispatch is activated from this action.</div>
          </div>}
        </div>
      </div>:<div className="grid lg:grid-cols-[.9fr_1.5fr]">
        <div className="max-h-[750px] overflow-y-auto border-b p-4 lg:border-b-0 lg:border-r">
          <p className="mb-4 text-sm text-[var(--text-2)]">Online reference prices remain private. Independently reconfirm prices before marking them verified.</p>
          {data.prices.map(p=><button key={p.id} type="button" onClick={()=>{setPriceId(p.id);setPriceForm(freshPrice(p));setError("");setNotice("");}} className={"mb-2 block w-full rounded-xl border p-3 text-left "+(priceId===p.id?"border-[var(--accent)] bg-[var(--accent-soft)]":"")}>
            <p className="text-xs font-semibold">{p.brand}</p><p className="mt-1 text-sm">{p.itemName}</p>
            <div className="mt-1 flex justify-between gap-2 text-xs text-[var(--text-2)]"><span>{p.currency} {Number(p.onlineReferencePrice).toFixed(2)}</span><span>{p.review?.decision||"Unverified"}</span></div>
          </button>)}
        </div>
        <div className="min-w-0 p-5 sm:p-7">{price&&priceForm&&<div className="space-y-5">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">{price.brand} · Online reference</p><h3 className="mt-2 text-2xl font-semibold">{price.itemName}</h3><p className="mt-2 text-sm">Published reference: {price.currency} {Number(price.onlineReferencePrice).toFixed(2)}</p><p className="mt-1 text-xs text-[var(--text-2)]">Observed {checkedText(price.observedAt)}</p><a target="_blank" rel="noopener noreferrer" href={price.sourceUrl} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">View original price source <ExternalLink className="h-3 w-3"/></a></div>
          <label className="block text-xs font-semibold">Price review outcome<select value={priceForm.decision} onChange={e=>setPriceForm(s=>({...s,decision:e.target.value}))} className={field}><option value="verified">Independently verified reference</option><option value="rejected">Reject / outdated</option></select></label>
          {priceForm.decision==="verified"&&<><label className="block text-xs font-semibold">Actual independently checked price ({price.currency})<input type="number" min="0" step="0.01" value={priceForm.checkedPrice} onChange={e=>setPriceForm(s=>({...s,checkedPrice:e.target.value}))} className={field}/></label><label className="block text-xs font-semibold">Verification method<select value={priceForm.method} onChange={e=>setPriceForm(s=>({...s,method:e.target.value}))} className={field}><option value="not_verified">Not verified</option><option value="in_person">Checked in person</option><option value="phone">Confirmed by phone</option><option value="business_confirmed">Confirmed by business</option></select></label></>}
          <label className="flex items-start gap-3 rounded-xl bg-[var(--surface-2)] p-4 text-sm"><input type="checkbox" checked={priceForm.factualDataRightsReviewed} onChange={e=>setPriceForm(s=>({...s,factualDataRightsReviewed:e.target.checked}))} className="mt-1 h-4 w-4"/>I reviewed the factual data and source rights; this does not authorize copying menu images or creative descriptions.</label>
          <label className="block text-xs font-semibold">Price verification notes<textarea rows={3} value={priceForm.notes} onChange={e=>setPriceForm(s=>({...s,notes:e.target.value}))} className={field} placeholder="Who confirmed the price and when?"/></label>
          <button type="button" disabled={!!busy||priceForm.notes.trim().length<8||(priceForm.decision==="verified"&&(priceForm.method==="not_verified"||!priceForm.factualDataRightsReviewed||priceForm.checkedPrice===""))} onClick={savePrice} className="w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy==="price"?"Saving…":"Save private item review"}</button>
          <div className="flex gap-2 rounded-xl border p-4 text-xs leading-5 text-[var(--text-2)]"><ShieldCheck className="h-4 w-4 shrink-0"/>This is a price-review record only. No public menu or orderable product is generated.</div>
        </div>}</div>
      </div>}
  </section>;
}
