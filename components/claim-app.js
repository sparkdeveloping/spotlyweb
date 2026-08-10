"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronRight, FileCheck2, MapPin, ShieldCheck, Store, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Card, ProgressBar, SearchField } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useAuth } from "@/components/firebase-provider";
import { deleteClaimDraft, deleteClaimEvidence, getPublicBranchesForBusiness, getBusiness, getClaimDraft, saveClaimDraft, searchBusinesses, track, uploadClaimEvidence } from "@/lib/firebase-services";
import { authenticatedFetch } from "@/lib/api-client";
import { businessCategories, zimbabweCities } from "@/data/business-config";
import { BUSINESS_ARCHETYPES, capabilitiesFor, inferBusinessType } from "@/data/business-archetypes";
import { migrateLegacyState, readState, removeState, writeState } from "@/lib/browser-state";

const DRAFT_KEY = "spotly-business-claim-draft";
const STEPS = [
  { id: "business", label: "Find or create the business" },
  { id: "relationship", label: "Confirm your relationship" },
  { id: "parent", label: "Confirm the parent organization" },
  { id: "scope", label: "Choose requested access" },
  { id: "locations", label: "Confirm locations" },
  { id: "operations", label: "Describe how the business operates" },
  { id: "public", label: "Confirm public details" },
  { id: "evidence", label: "Add supporting evidence" },
  { id: "review", label: "Review" },
  { id: "submit", label: "Submit and track" }
];

const EMPTY_FORM = {
  name: "", organizationName: "", legalName: "", category: "Groceries", businessType: "grocery_retail", city: "Harare", branchName: "Main location", address: "", phone: "", email: "", website: "", instagram: "", description: "", applicantName: "", roleAtBusiness: "owner", parentMode: "none", parentName: "", parentContactName: "", parentContactEmail: "", accessScope: "brand", financeAccess: false, notes: ""
};

function BusinessSearch({ onSelect }) {
  const listId = useId();
  const rootRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => {
    function outside(event) { if (!rootRef.current?.contains(event.target)) setOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const term = query.trim();
      if (term.length < 2) { setResults([]); setError(""); setOpen(false); return; }
      setLoading(true); setError(""); setOpen(true); setActiveIndex(-1);
      try { setResults(await searchBusinesses(term, 20)); }
      catch { setResults([]); setError("Business search is temporarily unavailable."); }
      finally { setLoading(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  function choose(item) { setOpen(false); onSelect(item); }
  function onKeyDown(event) {
    if (event.key === "Escape") { setOpen(false); return; }
    const options = results.length + 1;
    if (!open || !options) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((value) => (value + 1) % options); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((value) => (value - 1 + options) % options); }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(activeIndex < results.length ? results[activeIndex] : { id: null, name: query, isNew: true });
    }
  }
  return <div ref={rootRef} className="relative"><SearchField value={query} onChange={setQuery} onFocus={() => query.trim().length >= 2 && setOpen(true)} onKeyDown={onKeyDown} placeholder="Business or brand name" label="Find or add a business" className="h-14" inputProps={{ role: "combobox", "aria-expanded": open, "aria-controls": listId, "aria-autocomplete": "list", "aria-activedescendant": activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined }} /><span className="sr-only" aria-live="polite">{loading ? "Searching businesses" : error || (open ? `${results.length} businesses found` : "")}</span>{open && <div id={listId} role="listbox" className="absolute inset-x-0 top-[calc(100%+8px)] z-20 mt-2 overflow-hidden rounded-xl border bg-[var(--surface)] shadow-elevated">{loading ? <div className="p-5 text-sm text-secondary">Searching businesses…</div> : error ? <div role="alert" className="p-5 text-sm text-[var(--danger)]">{error}</div> : <>{results.map((business, index) => <button id={`${listId}-${index}`} role="option" aria-selected={activeIndex === index} key={business.id} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(business)} className={`flex w-full items-center gap-3 border-b px-4 py-4 text-left last:border-0 ${activeIndex === index ? "bg-[var(--surface-selected)]" : "hover:bg-[var(--surface-hover)]"}`}><Store className="h-5 w-5 text-violet" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{business.brandName || business.name}</span><span className="mt-1 block truncate text-sm text-secondary">{[business.category, business.city].filter(Boolean).join(" · ")}</span></span><ChevronRight className="h-5 w-5 text-tertiary" /></button>)}<button id={`${listId}-${results.length}`} role="option" aria-selected={activeIndex === results.length} type="button" onMouseEnter={() => setActiveIndex(results.length)} onClick={() => choose({ id: null, name: query, isNew: true })} className={`w-full p-5 text-left ${activeIndex === results.length ? "bg-[var(--surface-selected)]" : "hover:bg-[var(--surface-hover)]"}`}><p className="font-semibold">Add “{query}” as a new business</p><p className="mt-1 text-sm text-secondary">Use this when the business is not already listed.</p></button></>}</div>}</div>;
}
function Choice({ active, onClick, title, description, icon: Icon }) {
  return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left ${active?"border-violet bg-violet-soft ring-2 ring-violet/10":"bg-[var(--surface)] hover:border-violet/30"}`}>{Icon&&<Icon className="h-5 w-5 text-violet" />}<p className={Icon?"mt-3 font-semibold":"font-semibold"}>{title}</p><p className="mt-1 text-sm leading-6 text-secondary">{description}</p></button>;
}

function Field({ label, children, className="" }) { return <label className={className}><span className="mb-2 block text-sm font-semibold">{label}</span>{children}</label>; }

export function ClaimApp({ initialBusinessId, newBusiness = false, initialName = "", initialDraftId = "" }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [draftId, setDraftId] = useState(initialDraftId || "");
  const [mode, setMode] = useState(newBusiness ? "new" : "claim");
  const [selected, setSelected] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, name: initialName });
  const [evidence, setEvidence] = useState([]);
  const [uploading, setUploading] = useState({});
  const [ready, setReady] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [saveState, setSaveState] = useState("local");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const step = STEPS[stepIndex];
  const archetype = BUSINESS_ARCHETYPES[form.businessType] || BUSINESS_ARCHETYPES.directory_profile;
  const selectedBranches = useMemo(() => branches.filter((branch)=>selectedBranchIds.includes(branch.id)),[branches,selectedBranchIds]);

  const snapshot = useCallback(() => ({ id:draftId||undefined, stepIndex, mode, selected, branches, selectedBranchIds, form, evidence, savedAt:new Date().toISOString() }), [branches, draftId, evidence, form, mode, selected, selectedBranchIds, stepIndex]);
  const applyDraft = useCallback((saved) => {
    if(!saved)return;
    setDraftId(saved.id||initialDraftId||""); setStepIndex(Math.max(0,Math.min(STEPS.length-1,Number(saved.stepIndex)||0))); setMode(saved.mode||mode); setSelected(saved.selected||null); setBranches(saved.branches||[]); setSelectedBranchIds(saved.selectedBranchIds||[]); setForm((current)=>({...current,...(saved.form||{})})); setEvidence(saved.evidence||[]); setLastSaved(saved.savedAt||saved.updatedAt?.toDate?.()?.toISOString?.()||"");
  }, [initialDraftId, mode]);

  useEffect(()=>{let active=true;(async()=>{
    try {
      if(user?.uid&&initialDraftId){const saved=await getClaimDraft(user.uid,initialDraftId);if(active&&saved)applyDraft(saved);setReady(true);return;}
      const local=migrateLegacyState("spotly-business-claim-draft-v2",user)||readState(DRAFT_KEY,user,null);
      if(local)applyDraft(local);
      if(initialBusinessId&&!local){const business=await getBusiness(initialBusinessId);if(active&&business){const locations=await getPublicBranchesForBusiness(business.id);setSelected(business);setMode("claim");setBranches(locations);setSelectedBranchIds(locations.length===1?[locations[0].id]:[]);setForm((current)=>({...current,name:business.brandName||business.name,organizationName:business.organizationName||"",category:business.category||"Other",businessType:business.businessType||inferBusinessType(business),email:business.email||current.email,phone:business.phone||current.phone,website:business.website||"",description:business.description||""}));setStepIndex(1);}}
    } catch { setError("The saved claim could not be restored."); }
    finally { if(active)setReady(true); }
  })();return()=>{active=false;};},[applyDraft,initialBusinessId,initialDraftId,user]);

  useEffect(()=>{if(user)setForm((current)=>({...current,applicantName:current.applicantName||user.displayName||"",email:current.email||user.email||"",phone:current.phone||user.phoneNumber||""}));},[user]);

  const persistDraft = useCallback(async ({ quiet = false } = {}) => {
    const data = snapshot();
    writeState(DRAFT_KEY, user, data);
    setLastSaved(data.savedAt);
    if (!user?.uid) { setSaveState("local"); setSaveMessage("Saved on this device"); return data.id; }
    setSaveState("saving"); setSaveMessage("Saving…");
    try { const id = await saveClaimDraft(user.uid, data); setDraftId(id); setSaveState("account"); setSaveMessage("Saved to your account"); return id; }
    catch (saveError) { setSaveState("failed"); setSaveMessage("Could not save to your account"); if (!quiet) setError(saveError.message || "The draft could not be saved to your account."); return null; }
  }, [snapshot, user]);

  useEffect(()=>{if(!ready||submitting)return;const timer=window.setTimeout(()=>{persistDraft({ quiet: true });},650);return()=>window.clearTimeout(timer);},[persistDraft,ready,submitting]);

  async function selectBusiness(business){setError("");if(business.isNew){setMode("new");setSelected(null);setBranches([]);setSelectedBranchIds([]);setForm((current)=>({...current,name:business.name}));}else{setMode("claim");setSelected(business);const locations=await getPublicBranchesForBusiness(business.id);setBranches(locations);setSelectedBranchIds(locations.length===1?[locations[0].id]:[]);setForm((current)=>({...current,name:business.brandName||business.name,organizationName:business.organizationName||"",category:business.category||"Other",businessType:business.businessType||inferBusinessType(business),email:business.email||current.email,phone:business.phone||current.phone,website:business.website||"",description:business.description||""}));}setStepIndex(1);track("business_claim_brand_selected",{business_id:business.id||"new"});}
  function toggleBranch(id){const limited=["branch_manager","authorized_staff"].includes(form.roleAtBusiness)||form.accessScope==="selected_locations";setSelectedBranchIds((current)=>limited?[id]:current.includes(id)?current.filter((item)=>item!==id):[...current,id]);}
  function validation(index=stepIndex){
    if(index===0&&!selected&&mode!=="new"&&!form.name.trim())return "Find or create the business.";
    if(index===1&&(!form.applicantName.trim()||!form.email.trim()))return "Enter your name and business email.";
    if(index===2&&form.parentMode==="existing"&&!form.parentName.trim())return "Enter the parent organization name.";
    if(index===3&&!form.accessScope)return "Choose the access you are requesting.";
    if(index===4&&mode==="claim"&&!selectedBranchIds.length)return "Choose at least one location.";
    if(index===4&&mode==="new"&&(!form.branchName.trim()||!form.city.trim()||!form.address.trim()))return "Complete the first location details.";
    if(index===5&&!form.businessType)return "Choose how the business operates.";
    if(index===6&&(!form.name.trim()||!form.category.trim()))return "Complete the public business details.";
    if(index===7&&user?.uid&&evidence.length===0)return "Add at least one useful ownership or authority document.";
    return "";
  }
  function next(){const message=validation();if(message){setError(message);return;}setError("");setStepIndex((value)=>Math.min(STEPS.length-1,value+1));}
  async function saveAndExit(){setSaving(true);try{const id=await persistDraft();if(user?.uid&&id)router.push("/claim/drafts");else if(!user?.uid)router.push(`/login?portal=business&next=${encodeURIComponent("/claim")}`);}finally{setSaving(false);}}
  async function addEvidence(fileList){
    const allowed=new Set(["application/pdf","image/png","image/jpeg","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
    if(!user?.uid){setError("Sign in before uploading evidence so it can be saved securely with the draft.");return;}
    let id=draftId;if(!id){id=await saveClaimDraft(user.uid,snapshot());setDraftId(id);}
    for(const file of Array.from(fileList||[])){
      if(file.size>10*1024*1024){toast(`${file.name} is larger than 10 MB.`,{type:"error"});continue;}
      if(file.type&&!allowed.has(file.type)){toast(`${file.name} is not supported.`,{type:"error"});continue;}
      setUploading((current)=>({...current,[file.name]:1}));
      try{const uploaded=await uploadClaimEvidence(user.uid,id,file,(progressValue)=>setUploading((current)=>({...current,[file.name]:progressValue})));setEvidence((current)=>[...current,uploaded]);}
      catch(uploadError){toast(uploadError.message||`Could not upload ${file.name}.`,{type:"error"});}
      finally{setUploading((current)=>{const next={...current};delete next[file.name];return next;});}
    }
  }
  async function removeEvidence(item) {
    setEvidence((current) => current.filter((entry) => entry.url !== item.url));
    if (item.path) {
      try { await deleteClaimEvidence(item.path); toast(`${item.name} was removed.`, { title: "Evidence removed" }); }
      catch { setEvidence((current) => [...current, item]); toast(`Could not remove ${item.name}. Try again.`, { type: "error", title: "Removal failed" }); }
    }
  }

  async function submit(){
    for(let index=0;index<=7;index+=1){const message=validation(index);if(message){setStepIndex(index);setError(message);return;}}
    if(!user?.uid){writeState(DRAFT_KEY,user,snapshot());window.location.href=`/login?portal=business&next=${encodeURIComponent("/claim")}`;return;}
    setSubmitting(true);setError("");
    try{
      const businessId=selected?.id||`owner-${crypto.randomUUID()}`;
      const response=await authenticatedFetch("/api/business-claims/submit",{method:"POST",body:JSON.stringify({businessId,organizationId:selected?.organizationId||null,branchIds:mode==="claim"?selectedBranchIds:[],applicantName:form.applicantName,phone:form.phone,email:form.email,roleAtBusiness:form.roleAtBusiness,notes:[form.notes,`Requested scope: ${form.accessScope}`,form.financeAccess?"Finance access requested":"",form.parentMode!=="none"?`Parent organization: ${form.parentName||form.parentMode}`:"No parent organization reported"].filter(Boolean).join("\n"),evidence,provisionalBusiness:mode==="new"?{id:businessId,name:form.name,brandName:form.name,category:form.category,businessType:form.businessType,capabilities:capabilitiesFor(form.businessType),operatingModel:form.parentMode==="none"?"single_location":"parent_governed",city:form.city,country:"ZW",website:form.website,description:form.description,organizationName:form.organizationName||form.parentName||form.name,legalName:form.legalName,branchName:form.branchName,address:form.address,phone:form.phone,email:form.email,instagram:form.instagram,source:{type:"owner_created",imported:false}}:null})});
      removeState(DRAFT_KEY,user);if(draftId)await deleteClaimDraft(user.uid,draftId).catch(()=>{});router.push(`/claim/status/${response.claimId}`);
    }catch(submissionError){setError(submissionError.message||"The claim could not be submitted.");}
    finally{setSubmitting(false);}
  }

  if(!ready)return <main className="min-h-screen bg-grouped px-4 py-20"><div className="mx-auto max-w-3xl text-center text-secondary">Restoring your claim…</div></main>;
  const stepContent = {
    business:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Find or create the business</h2><p className="mt-2 text-sm leading-6 text-secondary">Start with the customer-facing brand. Locations remain underneath it.</p></div><BusinessSearch onSelect={selectBusiness} initialName={form.name} /></div>,
    relationship:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Confirm your relationship</h2><p className="mt-2 text-sm leading-6 text-secondary">This helps Spotly request the right evidence and access scope.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["owner","Owner or director","Request brand or organization ownership."],["franchisee","Franchisee","Request access to authorized franchise locations."],["branch_manager","Location manager","Request operational access to one location."],["authorized_staff","Authorized staff","Request limited access approved by the business."]].map(([value,title,description])=><Choice key={value} active={form.roleAtBusiness===value} onClick={()=>setForm({...form,roleAtBusiness:value})} title={title} description={description} />)}</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Your name"><input className="field-control w-full" value={form.applicantName} onChange={(event)=>setForm({...form,applicantName:event.target.value})} /></Field><Field label="Phone"><input className="field-control w-full" value={form.phone} onChange={(event)=>setForm({...form,phone:event.target.value})} placeholder="+263" /></Field><Field label="Business email" className="sm:col-span-2"><input type="email" className="field-control w-full" value={form.email} onChange={(event)=>setForm({...form,email:event.target.value})} /></Field></div></div>,
    parent:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Confirm the parent organization</h2><p className="mt-2 text-sm leading-6 text-secondary">Tell us whether head office or another company controls the brand.</p></div><div className="grid gap-3 sm:grid-cols-3">{[["none","No parent company","The business is independently controlled."],["existing","A parent company exists","Head office or another legal entity governs the brand."],["unknown","I am not sure","Spotly should investigate the relationship."]].map(([value,title,description])=><Choice key={value} active={form.parentMode===value} onClick={()=>setForm({...form,parentMode:value})} title={title} description={description} />)}</div>{form.parentMode!=="none"&&<div className="grid gap-4 sm:grid-cols-2"><Field label="Parent organization name"><input className="field-control w-full" value={form.parentName} onChange={(event)=>setForm({...form,parentName:event.target.value})} /></Field><Field label="Head-office contact email"><input type="email" className="field-control w-full" value={form.parentContactEmail} onChange={(event)=>setForm({...form,parentContactEmail:event.target.value})} /></Field><Field label="Head-office contact name" className="sm:col-span-2"><input className="field-control w-full" value={form.parentContactName} onChange={(event)=>setForm({...form,parentContactName:event.target.value})} /></Field></div>}<div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--on-warning-soft)]">If another verified owner controls the business, Spotly will open an ownership review rather than replacing access silently.</div></div>,
    scope:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Choose requested access</h2><p className="mt-2 text-sm leading-6 text-secondary">Request only what you need. Final access depends on verification and business governance.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["organization","Organization-wide","Multiple brands and locations under the legal entity."],["brand","Brand-wide","The selected brand and its authorized locations."],["selected_locations","Selected locations","Only locations you choose in the next step."],["listing_correction","Listing correction only","Suggest public-detail corrections without operational access."]].map(([value,title,description])=><Choice key={value} active={form.accessScope===value} onClick={()=>setForm({...form,accessScope:value})} title={title} description={description} />)}</div><label className="flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={form.financeAccess} onChange={(event)=>setForm({...form,financeAccess:event.target.checked})} className="mt-1" /><span><span className="block font-semibold">Request finance visibility</span><span className="mt-1 block text-sm text-secondary">Finance access is reviewed separately and may require stronger evidence.</span></span></label></div>,
    locations:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Confirm locations</h2><p className="mt-2 text-sm leading-6 text-secondary">Customers and staff must always know the exact operating location.</p></div>{mode==="new"?<div className="grid gap-4 sm:grid-cols-2"><Field label="First location name"><input className="field-control w-full" value={form.branchName} onChange={(event)=>setForm({...form,branchName:event.target.value})} /></Field><Field label="City or town"><select className="field-control w-full" value={form.city} onChange={(event)=>setForm({...form,city:event.target.value})}>{zimbabweCities.map((item)=><option key={item}>{item}</option>)}</select></Field><Field label="Address" className="sm:col-span-2"><input className="field-control w-full" value={form.address} onChange={(event)=>setForm({...form,address:event.target.value})} /></Field></div>:branches.length?<div className="grid gap-3 sm:grid-cols-2">{branches.map((branch)=>{const active=selectedBranchIds.includes(branch.id);return <Choice key={branch.id} active={active} onClick={()=>toggleBranch(branch.id)} icon={MapPin} title={branch.branchName||branch.name||"Location"} description={[branch.address,branch.city].filter(Boolean).join(" · ")||"Address not provided"} />;})}</div>:<div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]">This listing has no selectable location. Submit a support request or add the business as new.</div>}</div>,
    operations:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">How does the business operate?</h2><p className="mt-2 text-sm leading-6 text-secondary">Spotly will shape the workspace around this answer.</p></div><div className="grid gap-3 sm:grid-cols-2">{Object.values(BUSINESS_ARCHETYPES).map((type)=><Choice key={type.id} active={form.businessType===type.id} onClick={()=>setForm({...form,businessType:type.id,category:type.categoryHints[0]})} icon={type.icon} title={type.label} description={type.description} />)}</div></div>,
    public:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Confirm public business details</h2><p className="mt-2 text-sm leading-6 text-secondary">These details will not become public until the listing is approved.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Business or brand name"><input className="field-control w-full" value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})} /></Field><Field label="Legal name"><input className="field-control w-full" value={form.legalName} onChange={(event)=>setForm({...form,legalName:event.target.value})} /></Field><Field label="Primary category"><select className="field-control w-full" value={form.category} onChange={(event)=>setForm({...form,category:event.target.value})}>{businessCategories.map((item)=><option key={item}>{item}</option>)}</select></Field><Field label="Website"><input className="field-control w-full" value={form.website} onChange={(event)=>setForm({...form,website:event.target.value})} /></Field><Field label="Public description" className="sm:col-span-2"><textarea className="field-control min-h-28 w-full py-3" value={form.description} onChange={(event)=>setForm({...form,description:event.target.value})} /></Field></div></div>,
    evidence:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Add supporting evidence</h2><p className="mt-2 text-sm leading-6 text-secondary">Upload ownership, employment or authority documents. Files are saved to this draft and survive Save and exit.</p></div>{!user?.uid&&<div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]">Sign in before uploading evidence. Your form will be restored after sign-in.</div>}<label className="block cursor-pointer rounded-xl border-2 border-dashed p-7 text-center hover:border-violet/40"><UploadCloud className="mx-auto h-7 w-7 text-violet" /><p className="mt-3 font-semibold">Upload evidence</p><p className="mt-2 text-xs text-secondary">PDF, JPG, PNG, DOC or DOCX. Maximum 10 MB each.</p><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="sr-only" disabled={!user?.uid} onChange={(event)=>addEvidence(event.target.files)} /></label>{Object.entries(uploading).map(([name,value])=><div key={name} className="rounded-xl border p-3"><div className="flex justify-between text-sm"><span className="truncate font-semibold">{name}</span><span>{value}%</span></div><ProgressBar value={value} className="mt-2" /></div>)}{evidence.length>0&&<div className="space-y-2">{evidence.map((item,index)=><div key={item.url} className="flex items-center gap-3 rounded-xl border p-3"><FileCheck2 className="h-4 w-4 text-success" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span><button type="button" onClick={()=>removeEvidence(item)} className="rounded-lg p-2 text-danger" aria-label={`Remove ${item.name}`}><Trash2 className="h-4 w-4" /></button></div>)}</div>}<Field label="Anything the reviewer should know?"><textarea className="field-control min-h-28 w-full py-3" value={form.notes} onChange={(event)=>setForm({...form,notes:event.target.value})} /></Field></div>,
    review:<div className="space-y-5"><div><h2 className="text-2xl font-semibold">Review the request</h2><p className="mt-2 text-sm text-secondary">Edit any section before submitting.</p></div>{[[0,"Business",form.name||"Not selected"],[1,"Relationship",form.roleAtBusiness.replaceAll("_"," ")],[2,"Parent organization",form.parentMode==="none"?"No parent organization":form.parentName||"Needs investigation"],[3,"Requested access",form.accessScope.replaceAll("_"," ")],[4,"Locations",mode==="new"?`${form.branchName}, ${form.city}`:selectedBranches.map((item)=>item.branchName||item.name).join(", ")||"Not selected"],[5,"Operating model",archetype.label],[6,"Public details",`${form.category} · ${form.website||"No website"}`],[7,"Evidence",`${evidence.length} uploaded file${evidence.length===1?"":"s"}`]].map(([index,label,value])=><Card key={label} variant="bordered" className="flex items-center gap-4 p-4"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-tertiary">{label}</p><p className="mt-1 truncate font-semibold capitalize">{value}</p></div><Button size="sm" variant="ghost" onClick={()=>setStepIndex(index)}>Edit</Button></Card>)}</div>,
    submit:<div className="space-y-6 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-violet-soft text-violet"><ShieldCheck className="h-8 w-8" /></span><div><h2 className="text-3xl font-semibold">Ready for review</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-secondary">Spotly will review the relationship, selected locations and evidence. Parent approval or more information may be requested before access is granted.</p></div><Button size="lg" loading={submitting} onClick={submit}>{user?.uid?"Submit for review":"Sign in to submit"}<BadgeCheck className="h-5 w-5" /></Button></div>
  }[step.id];

  return <main className="min-h-screen bg-grouped px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/" className="text-sm font-semibold text-violet">← Spotly home</Link><h1 className="mt-3 text-3xl font-semibold">Claim or add a business</h1><p className="mt-2 text-sm text-secondary">Step {stepIndex+1} of {STEPS.length}: {step.label}</p></div><div className="flex items-center gap-3"><span className={`text-xs ${saveState === "failed" ? "text-[var(--danger)]" : "text-secondary"}`}>{saveMessage || (lastSaved ? `Saved ${new Date(lastSaved).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}` : "Not saved yet")}</span>{saveState === "failed" && <Button size="sm" variant="ghost" onClick={()=>persistDraft()}>Retry</Button>}<Button variant="outline" loading={saving} onClick={saveAndExit}>Save and exit</Button></div></div><ProgressBar value={progress} className="mt-5" /><div className="mt-6 grid gap-6 lg:grid-cols-[230px_1fr]"><aside className="hidden lg:block"><ol className="space-y-1">{STEPS.map((item,index)=><li key={item.id}><button type="button" onClick={()=>index<stepIndex&&setStepIndex(index)} disabled={index>stepIndex} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm ${index===stepIndex?"bg-violet-soft text-violet-strong":index<stepIndex?"hover:bg-[var(--surface-hover)]":"text-tertiary"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${index<stepIndex?"bg-success text-[var(--on-success)]":index===stepIndex?"bg-violet text-[var(--on-accent)]":"bg-[var(--surface)]"}`}>{index<stepIndex?<Check className="h-4 w-4" />:index+1}</span><span className="font-medium">{item.label}</span></button></li>)}</ol><Button asChild variant="ghost" className="mt-4 w-full"><Link href="/claim/drafts">View saved drafts</Link></Button></aside><Card variant="bordered" className="overflow-hidden"><div className="p-5 sm:p-8">{error&&<div role="alert" className="mb-5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{error}</div>}{stepContent}</div><div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-[var(--surface)] p-5"><Button variant="ghost" disabled={stepIndex===0} onClick={()=>{setError("");setStepIndex((value)=>Math.max(0,value-1));}}><ArrowLeft className="h-4 w-4" />Back</Button>{stepIndex<STEPS.length-1?<Button onClick={next}>Continue<ArrowRight className="h-4 w-4" /></Button>:null}</div></Card></div></div></main>;
}
