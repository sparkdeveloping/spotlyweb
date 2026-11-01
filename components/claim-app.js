"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronRight, FileCheck2, MapPin, ShieldCheck, Store, Trash2, UploadCloud, Plus, SearchCheck, LockKeyhole, Info, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Card, ProgressBar, SearchField } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useAuth } from "@/components/firebase-provider";
import { deleteClaimDraft, deleteClaimEvidence, getPublicBranchesForBusiness, getBusiness, getClaimDraft, saveClaimDraft, searchBusinesses, track, uploadClaimEvidence } from "@/lib/firebase-services";
import { authenticatedFetch, publicApiFetch } from "@/lib/api-client";
import { businessCategories, zimbabweCities } from "@/data/business-config";
import { BUSINESS_ARCHETYPES, capabilitiesFor, inferBusinessType } from "@/data/business-archetypes";
import { migrateLegacyState, readState, removeState, writeState } from "@/lib/browser-state";
import { spotlyPortalUrl, spotlyLoginUrl } from "@/lib/spotly-domains";
import { restoreGuestClaim, preserveGuestClaim, forgetGuestClaim, stageClaimFile, stagedClaimFiles, clearStagedClaimFile, clearAllStagedClaimFiles, isClaimableExistingBranch } from "@/lib/claim-onboarding-continuity";

const DRAFT_KEY = "spotly-business-claim-draft";
const STEPS = [
  { id: "business", label: "Find the business" },
  { id: "relationship", label: "Your relationship" },
  { id: "parent", label: "Organization" },
  { id: "scope", label: "Access" },
  { id: "locations", label: "Locations" },
  { id: "operations", label: "Business type" },
  { id: "public", label: "Customer details" },
  { id: "evidence", label: "Verification" },
  { id: "review", label: "Review" },
  { id: "submit", label: "Send to Spotly" }
];

const PHASES = [
  { id: "business", label: "Business", description: "Find the right listing", steps: ["business"] },
  { id: "you", label: "You", description: "Confirm your authority", steps: ["relationship", "parent", "scope"] },
  { id: "details", label: "Details", description: "Check how the business works", steps: ["locations", "operations", "public"] },
  { id: "verify", label: "Verify", description: "Protect and submit access", steps: ["evidence", "review", "submit"] }
];

const EMPTY_FORM = {
  name: "", organizationName: "", legalName: "", category: "Groceries", businessType: "grocery_retail", city: "Harare", branchName: "Main location", address: "", phone: "", email: "", website: "", instagram: "", description: "", applicantName: "", roleAtBusiness: "owner", parentMode: "none", parentName: "", parentContactName: "", parentContactEmail: "", accessScope: "brand", financeAccess: false, notes: ""
};

function BusinessSearch({ onSelect, initialName = "" }) {
  const listId = useId();
  const searchSequence = useRef(0);
  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(Boolean(initialName.trim()));
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalized = query.trim();
  useEffect(() => {
    const sequence = ++searchSequence.current;
    if (normalized.length < 2) { setResults([]); setError(""); setSearched(false); setLoading(false); return; }
    setLoading(true); setError(""); setSearched(false);
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchBusinesses(normalized, 20, { locations: true });
        if (sequence !== searchSequence.current) return;
        setResults(found); setSearched(true); setActiveIndex(-1);
      } catch {
        if (sequence !== searchSequence.current) return;
        setResults([]); setError("We couldn't check listings right now. Try again, or add your business if you know it is not already listed.");
      } finally { if (sequence === searchSequence.current) setLoading(false); }
    }, 280);
    return () => { window.clearTimeout(timer); ++searchSequence.current; };
  }, [normalized]);
  const createNew = () => { if (normalized.length >= 2) onSelect({ id: null, name: normalized, isNew: true }); };
  function onKeyDown(event) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((value) => Math.min(value + 1, results.length)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((value) => Math.max(value - 1, 0)); }
    if (event.key === "Enter" && open && activeIndex >= 0 && normalized.length >= 2) {
      event.preventDefault();
      if (activeIndex < results.length) onSelect(results[activeIndex]); else createNew();
    }
  }
  return <div className="space-y-4">
    <div className="relative">
      <SearchField value={query} onChange={(value) => { setQuery(value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} placeholder="Search a business or brand name" label="Business name" className="h-14" inputProps={{ role: "combobox", "aria-expanded": open && results.length > 0, "aria-controls": listId, "aria-autocomplete": "list" }} />
      <span className="sr-only" aria-live="polite">{loading ? "Searching for existing businesses" : searched ? `${results.length} businesses found` : error}</span>
    </div>
    {normalized.length < 2 ? <div className="rounded-2xl border border-dashed p-5 text-sm leading-6 text-secondary">Enter at least two characters. You can claim an existing listing or create one if it isn't here yet.</div> : <>
      {loading && <div className="flex items-center gap-3 rounded-xl border p-4 text-sm text-secondary"><LoaderCircle className="h-4 w-4 animate-spin" />Checking Spotly listings…</div>}
      {error && <div role="alert" className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--on-warning-soft)]">{error}</div>}
      {!loading && !error && searched && <div className="space-y-2" id={listId} role="listbox" aria-label="Existing businesses">
        {results.length > 0 ? <><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-widest text-tertiary">Existing listings</p><p className="text-xs text-secondary">{results.length} result{results.length === 1 ? "" : "s"}</p></div>
          {results.map((business, index) => <button key={business.id} type="button" role="option" aria-selected={activeIndex === index} onClick={() => onSelect(business)} className="group flex w-full items-center gap-3 rounded-xl border bg-[var(--surface)] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-business/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-business"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><Store className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{business.brandName || business.name}</span><span className="mt-1 block truncate text-xs text-secondary">{[business.category, business.city].filter(Boolean).join(" · ") || "Business listing"}</span></span><span className="text-xs font-semibold text-business">Claim</span><ChevronRight className="h-4 w-4 text-business" /></button>)}
        </> : <div className="flex items-start gap-3 rounded-xl border border-business/25 bg-business-soft p-4"><SearchCheck className="mt-0.5 h-5 w-5 shrink-0 text-business" /><div><p className="font-semibold text-[var(--text)]">No business found with that name</p><p className="mt-1 text-sm leading-6 text-secondary">That's fine. You can add “{normalized}” to Spotly and submit the new listing for verification.</p></div></div>}
      </div>}
      <div className="rounded-2xl border border-business/25 bg-[var(--surface)] p-4 sm:p-5"><p className="text-sm font-bold">Not seeing your business?</p><p className="mt-1 text-sm leading-6 text-secondary">{results.some((item) => (item.brandName || item.name || "").trim().toLowerCase() === normalized.toLowerCase()) ? "A listing with this name appears above. Claim that listing unless it belongs to a different business." : "Create the listing using this name. Spotly will verify your connection to the business before granting access."}</p><button type="button" onClick={createNew} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-business px-4 py-3 text-sm font-bold text-[var(--on-accent)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-business"><Plus className="h-4 w-4" />Add “{normalized}” as a new business <ArrowRight className="h-4 w-4" /></button></div>
    </>}
  </div>;
}
function Choice({ active, onClick, title, description, icon: Icon }) {
  return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left ${active?"border-business bg-business-soft ring-2 ring-business/10":"bg-[var(--surface)] hover:border-business/30"}`}>{Icon&&<Icon className="h-5 w-5 text-business" />}<p className={Icon?"mt-3 font-semibold":"font-semibold"}>{title}</p><p className="mt-1 text-sm leading-6 text-secondary">{description}</p></button>;
}

function Field({ label, children, className="" }) { return <label className={className}><span className="mb-2 block text-sm font-semibold">{label}</span>{children}</label>; }

export function ClaimApp({ initialBusinessId = "", inviteToken = "", newBusiness = false, initialName = "", initialDraftId = "", businessJourney = false }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [draftId, setDraftId] = useState(() => initialDraftId || `claim_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`);
  const uploadLock = useRef(false);
  const [restoringFiles, setRestoringFiles] = useState(false);
  const [navigationBusy, setNavigationBusy] = useState(false);
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
  const phaseIndex = Math.max(0, PHASES.findIndex((item) => item.steps.includes(step.id)));
  const phase = PHASES[phaseIndex];
  const archetype = BUSINESS_ARCHETYPES[form.businessType] || BUSINESS_ARCHETYPES.directory_profile;
  const selectedBranches = useMemo(() => branches.filter((branch)=>selectedBranchIds.includes(branch.id)),[branches,selectedBranchIds]);

  const snapshot = useCallback(() => ({ id:draftId||undefined, stepIndex, mode, selected, branches, selectedBranchIds, form, evidence, savedAt:new Date().toISOString() }), [branches, draftId, evidence, form, mode, selected, selectedBranchIds, stepIndex]);
  const applyDraft = useCallback((saved) => {
    if(!saved)return;
    setDraftId(saved.id||initialDraftId||`claim_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`); setStepIndex(Math.max(0,Math.min(STEPS.length-1,Number(saved.stepIndex)||0))); setMode(saved.mode||"claim"); setSelected(saved.selected||null); setBranches(saved.branches||[]); setSelectedBranchIds(saved.selectedBranchIds||[]); setForm((current)=>({...current,...(saved.form||{})})); setEvidence(saved.evidence||[]); setLastSaved(saved.savedAt||saved.updatedAt?.toDate?.()?.toISOString?.()||"");
  }, [initialDraftId]);

  useEffect(()=>{let active=true;(async()=>{
    try {
      if(user?.uid&&initialDraftId){const saved=await getClaimDraft(user.uid,initialDraftId);if(active&&saved)applyDraft(saved);if(active)setReady(true);return;}
      // Guest applications cannot be indexed by the newly created Firebase UID. Restore
      // their dedicated hand-off record first, then migrate into the account's own draft.
      const transferred = restoreGuestClaim(window.localStorage);
      const local = transferred || migrateLegacyState("spotly-business-claim-draft-v2",user) || readState(DRAFT_KEY,user,null);
      if(active&&local)applyDraft(local);
      if(initialBusinessId&&!local){const invited=inviteToken ? await publicApiFetch(`/api/public/claim-invite?token=${encodeURIComponent(inviteToken)}`) : null;const business=invited?.business || await getBusiness(initialBusinessId);if(active&&business){const locations=(invited ? invited.branches : await getPublicBranchesForBusiness(business.id)).filter(isClaimableExistingBranch);setSelected(business);setMode("claim");setBranches(locations);setSelectedBranchIds(locations.length===1?[locations[0].id]:[]);setForm((current)=>({...current,name:business.brandName||business.name,organizationName:business.organizationName||"",city:business.city||current.city,address:business.address||current.address,branchName:business.area||current.branchName,category:business.category||"Other",businessType:business.businessType||inferBusinessType(business),email:business.email||current.email,phone:business.phone||current.phone,website:business.website||"",description:business.description||""}));setStepIndex(1);}}
    } catch { setError("The saved claim could not be restored."); }
    finally { if(active)setReady(true); }
  })();return()=>{active=false;};},[applyDraft,initialBusinessId,initialDraftId,inviteToken,user]);

  useEffect(()=>{if(user)setForm((current)=>({...current,applicantName:current.applicantName||user.displayName||"",email:current.email||user.email||"",phone:current.phone||user.phoneNumber||""}));},[user]);

  const persistDraft = useCallback(async ({ quiet = false } = {}) => {
    const data = snapshot();
    writeState(DRAFT_KEY, user, data);
    if (!user?.uid || user.isAnonymous) preserveGuestClaim(window.localStorage, data);
    setLastSaved(data.savedAt);
    if (!user?.uid || user.isAnonymous) { setSaveState("local"); setSaveMessage("Saved on this device"); return data.id; }
    setSaveState("saving"); setSaveMessage("Saving…");
    try { const id = await saveClaimDraft(user.uid, data); setDraftId(id); forgetGuestClaim(window.localStorage); setSaveState("account"); setSaveMessage("Saved to your account"); return id; }
    catch (saveError) { setSaveState("failed"); setSaveMessage("Could not save to your account"); if (!quiet) setError(saveError.message || "The draft could not be saved to your account."); return null; }
  }, [snapshot, user]);

  // Keep the hand-off snapshot synchronous so clicking a link before the debounce
  // cannot silently lose the newest field or step change.
  useEffect(() => {
    if (!ready) return;
    writeState(DRAFT_KEY, user, snapshot());
    if (!user?.uid || user.isAnonymous) preserveGuestClaim(window.localStorage, snapshot());
  }, [ready, snapshot, user]);
  useEffect(()=>{if(!ready||submitting)return;const timer=window.setTimeout(()=>{persistDraft({ quiet: true });},800);return()=>window.clearTimeout(timer);},[persistDraft,ready,submitting]);

  // Documents chosen as a guest are stored as Blob objects in IndexedDB, not
  // Firebase Storage or localStorage. Upload automatically after account creation.
  useEffect(() => {
    if (!ready || !draftId || uploadLock.current || (user?.uid && !user.isAnonymous)) return;
    let cancelled = false;
    async function restoreEvidence() {
      try {
        const staged = await stagedClaimFiles(draftId);
        if (cancelled || !staged.length) return;
        setEvidence((current) => [...current.filter((file) => !file.staged), ...staged.map(({ id, name, type, size }) => ({ id, name, type, size, staged: true }))]);
      } catch { /* Browser does not support IndexedDB; normal authenticated upload remains usable. */ }
    }
    restoreEvidence();
    return () => { cancelled = true; };
  }, [ready, draftId, user?.uid, user?.isAnonymous]);
  useEffect(() => {
    if (!ready || !user?.uid || user.isAnonymous || !draftId || uploadLock.current) return;
    let stopped = false;
    async function transferEvidence() {
      uploadLock.current = true;
      setRestoringFiles(true);
      try {
        const pending = await stagedClaimFiles(draftId);
        if (!pending.length || stopped) return;
        await saveClaimDraft(user.uid, snapshot());
        for (const entry of pending) {
          if (stopped) break;
          setUploading((current) => ({ ...current, [entry.id]: 1 }));
          try {
            const uploaded = await uploadClaimEvidence(user.uid, draftId, entry.file, (progress) => setUploading((current) => ({ ...current, [entry.id]: progress })));
            setEvidence((current) => [...current.filter((file) => file.id !== entry.id), uploaded]);
            await clearStagedClaimFile(entry.id);
          } catch (uploadError) {
            setError(`We restored your application, but ${entry.name} could not be uploaded. Please retry from the evidence step. ${uploadError.message || ""}`);
          } finally {
            setUploading((current) => { const next = { ...current }; delete next[entry.id]; return next; });
          }
        }
      } catch (uploadError) { if (!stopped) setError(uploadError.message || "Your saved documents need to be uploaded again."); }
      finally { uploadLock.current = false; setRestoringFiles(false); }
    }
    transferEvidence();
    return () => { stopped = true; };
  // Run once per restored account and draft, not on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.uid, draftId]);

  async function selectBusiness(business){setError("");if(business.isNew){setMode("new");setSelected(null);setBranches([]);setSelectedBranchIds([]);setForm((current)=>({...current,name:business.name}));}else{setMode("claim");setSelected(business);let locations=[];try{locations=(await getPublicBranchesForBusiness(business.id)).filter(isClaimableExistingBranch);}catch{setError("We couldn't load locations right now. You may continue with the business-level application.");}setBranches(locations);setSelectedBranchIds(locations.length===1?[locations[0].id]:[]);setForm((current)=>({...current,name:business.brandName||business.name,organizationName:business.organizationName||"",city:business.city||current.city,address:business.address||current.address,branchName:business.area||current.branchName,category:business.category||"Other",businessType:business.businessType||inferBusinessType(business),email:business.email||current.email,phone:business.phone||current.phone,website:business.website||"",description:business.description||""}));}setStepIndex(1);track("business_claim_brand_selected",{business_id:business.id||"new"});}
  function toggleBranch(id){const limited=["branch_manager","authorized_staff"].includes(form.roleAtBusiness)||form.accessScope==="selected_locations";setSelectedBranchIds((current)=>limited?[id]:current.includes(id)?current.filter((item)=>item!==id):[...current,id]);}
  function validation(index=stepIndex){
    if(index===0&&mode==="new"&&form.name.trim().length<2)return "Enter a business name to create its listing.";
    if(index===0&&mode==="claim"&&!selected)return "Choose an existing business, or use the green button to add a new one.";
    if(index===1&&(!form.applicantName.trim()||!form.email.trim()))return "Enter your name and an email address we can use to verify this request.";
    if(index===2&&form.parentMode==="existing"&&!form.parentName.trim())return "Enter the parent organization name.";
    if(index===3&&!form.accessScope)return "Choose the access you are requesting.";
    if(index===4&&mode==="claim"&&branches.length>0&&!selectedBranchIds.length)return "Choose at least one location.";
    if(index===4&&mode==="new"&&(!form.branchName.trim()||!form.city.trim()))return "Enter a location name and city. You can add an exact street address later.";
    if(index===5&&!form.businessType)return "Choose how the business operates.";
    if(index===6&&(!form.name.trim()||!form.category.trim()))return "Complete the public business details.";
    if(index===7&&user?.uid&&!user.isAnonymous&&evidence.length===0)return "Add at least one useful ownership or authority document.";
    return "";
  }
  function next(){const message=validation();if(message){setError(message);return;}setError("");setStepIndex((value)=>Math.min(STEPS.length-1,value+1));}
  function accountLink() { return spotlyLoginUrl(businessJourney ? "business" : "customer", { next: businessJourney ? "/get-started" : "/claim", mode: "signup" }); }
  async function goToRequests() {
    if (navigationBusy) return;
    setNavigationBusy(true);
    try {
      const id = await persistDraft();
      if (!id) return;
      if (user?.uid && !user.isAnonymous) window.location.assign(businessJourney ? spotlyPortalUrl("business", "/claims") : "/claim/drafts");
      else { setSaveMessage("Application saved. Create your account to access your requests."); window.location.assign(accountLink()); }
    } finally { setNavigationBusy(false); }
  }
  async function saveAndExit(){setSaving(true);try{await goToRequests();}finally{setSaving(false);}}
  async function addEvidence(fileList) {
    const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
    const files = Array.from(fileList || []);
    setError("");
    for (const file of files) {
      if (file.size === 0 || file.size > 10 * 1024 * 1024) { toast(`${file.name} must be between 1 byte and 10 MB.`, { type: "error" }); continue; }
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if ((!file.type || !allowed.has(file.type)) && !["pdf", "jpg", "jpeg", "png", "doc", "docx"].includes(extension)) { toast(`${file.name} is not supported.`, { type: "error" }); continue; }
      if (evidence.length >= 20) { setError("You can attach up to 20 documents per request."); break; }
      if (!user?.uid || user.isAnonymous) {
        try {
          const pending = await stageClaimFile(draftId, file);
          setEvidence((current) => [...current, pending]);
          preserveGuestClaim(window.localStorage, snapshot());
          toast(`${file.name} is saved temporarily on this device. It will upload after you secure your account.`, { title: "Document attached" });
        } catch (stageError) { setError(stageError.message || "Could not save this file locally. You can upload after signing in."); }
        continue;
      }
      try {
        await saveClaimDraft(user.uid, snapshot());
        const progressKey = `${file.name}-${Date.now()}`;
        setUploading((current) => ({ ...current, [progressKey]: 1 }));
        try {
          const uploaded = await uploadClaimEvidence(user.uid, draftId, file, (progress) => setUploading((current) => ({ ...current, [progressKey]: progress })));
          setEvidence((current) => [...current, uploaded]);
        } finally { setUploading((current) => { const next = { ...current }; delete next[progressKey]; return next; }); }
      } catch (uploadError) { toast(uploadError.message || `Could not upload ${file.name}.`, { type: "error" }); }
    }
  }
  async function removeEvidence(item) {
    setEvidence((current) => current.filter((entry) => item.id ? entry.id !== item.id : entry.url !== item.url));
    if (item.staged && item.id) {
      try { await clearStagedClaimFile(item.id); } catch { toast("Could not remove the locally saved file.", { type: "error" }); }
    }
    if (item.path) {
      try { await deleteClaimEvidence(item.path); toast(`${item.name} was removed.`, { title: "Evidence removed" }); }
      catch { setEvidence((current) => [...current, item]); toast(`Could not remove ${item.name}. Try again.`, { type: "error", title: "Removal failed" }); }
    }
  }

  async function submit(){
    for(let index=0;index<=7;index+=1){const message=validation(index);if(message){setStepIndex(index);setError(message);return;}}
    if(!user?.uid || user.isAnonymous){preserveGuestClaim(window.localStorage,snapshot());window.location.href=accountLink();return;}
    if(restoringFiles||Object.keys(uploading).length||evidence.some((file)=>file.staged)){setStepIndex(7);setError("Please wait for your evidence to finish uploading before submitting.");return;}
    if(evidence.length===0){setStepIndex(7);setError("Attach at least one document to verify your authority.");return;}
    setSubmitting(true);setError("");
    try{
      const businessId=selected?.id||`owner-${draftId}`;
      const curated = mode === "claim" && selected?.curated === true && selected?.source?.type === "openstreetmap";
      const response=await authenticatedFetch("/api/business-claims/submit",{method:"POST",body:JSON.stringify({businessId,organizationId:selected?.organizationId||null,branchIds:mode==="claim"?selectedBranchIds:[],applicantName:form.applicantName,phone:form.phone,email:form.email,roleAtBusiness:form.roleAtBusiness,notes:[form.notes,`Requested scope: ${form.accessScope}`,form.financeAccess?"Finance access requested":"",form.parentMode!=="none"?`Parent organization: ${form.parentName||form.parentMode}`:"No parent organization reported"].filter(Boolean).join("\n"),evidence,provisionalBusiness:(mode==="new"||curated)?{id:businessId,name:form.name,brandName:form.name,category:form.category,businessType:form.businessType,capabilities:capabilitiesFor(form.businessType),operatingModel:form.parentMode==="none"?"single_location":"parent_governed",city:form.city,country:"ZW",website:form.website,description:form.description,organizationName:form.organizationName||form.parentName||form.name,legalName:form.legalName,branchName:form.branchName,address:form.address,phone:form.phone,email:form.email,instagram:form.instagram,source:curated?selected.source:{type:"owner_created",imported:false}}:null})});
      removeState(DRAFT_KEY,user);forgetGuestClaim(window.localStorage);await clearAllStagedClaimFiles(draftId).catch(()=>{});if(draftId)await deleteClaimDraft(user.uid,draftId).catch(()=>{});if (businessJourney) window.location.assign(spotlyPortalUrl("business", `/claim-status/${response.claimId}`)); else router.push(`/claim/status/${response.claimId}`);
    }catch(submissionError){
      const message = submissionError.message || "The claim could not be submitted.";
      if (/selected locations no longer belong/i.test(message) && selected?.id) {
        setStepIndex(4);
        try {
          const refreshed = (await getPublicBranchesForBusiness(selected.id)).filter(isClaimableExistingBranch);
          setBranches(refreshed);
          setSelectedBranchIds((current) => current.filter((id) => refreshed.some((location) => location.id === id)));
          setError("The business's locations were updated. Please review the available locations and continue; the rest of your application is still saved.");
        } catch { setError(message); }
      } else setError(message);
    }
    finally{setSubmitting(false);}
  }

  if(!ready)return <main className="min-h-screen bg-grouped px-4 py-20"><div className="mx-auto max-w-3xl text-center text-secondary">Restoring your claim…</div></main>;
  const stepContent = {
    business:<div className="space-y-6"><div><span className="inline-flex items-center gap-2 rounded-full bg-business-soft px-3 py-1.5 text-xs font-bold text-business"><Store className="h-3.5 w-3.5" /> Your business starts here</span><h2 className="mt-4 text-2xl font-semibold tracking-tight">Is your business already on Spotly?</h2><p className="mt-2 text-sm leading-6 text-secondary">Look for your business first to avoid duplicate listings. If we don't find it, there's a clear option to create it.</p></div>{newBusiness&&<div className="rounded-2xl border-2 border-business/30 bg-business-soft/40 p-5"><h3 className="text-lg font-bold">Add your business</h3><p className="mt-1 text-sm leading-6 text-secondary">Enter its name to begin. You'll add the location and other details in the next steps.</p><input aria-label="New business name" className="field-control mt-4 w-full" placeholder="Your business name" value={form.name} onChange={(event)=>setForm((current)=>({...current,name:event.target.value}))}/><button type="button" disabled={form.name.trim().length<2} onClick={()=>selectBusiness({isNew:true,name:form.name.trim()})} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-business px-4 text-sm font-bold text-[var(--on-accent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4"/>Create “{form.name.trim()||"my business"}” <ArrowRight className="h-4 w-4"/></button></div>}<BusinessSearch onSelect={selectBusiness} initialName={form.name} /></div>,
    relationship:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Tell us about you</h2><p className="mt-2 text-sm leading-6 text-secondary">Your role tells Spotly what proof and access questions are actually relevant. You will only receive access after verification.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["owner","Owner or director","Request brand or organization ownership."],["franchisee","Franchisee","Request access to authorized franchise locations."],["branch_manager","Location manager","Request operational access to one location."],["authorized_staff","Authorized staff","Request limited access approved by the business."]].map(([value,title,description])=><Choice key={value} active={form.roleAtBusiness===value} onClick={()=>setForm({...form,roleAtBusiness:value})} title={title} description={description} />)}</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Your name"><input className="field-control w-full" value={form.applicantName} onChange={(event)=>setForm({...form,applicantName:event.target.value})} /></Field><Field label="Phone"><input className="field-control w-full" value={form.phone} onChange={(event)=>setForm({...form,phone:event.target.value})} placeholder="+263" /></Field><Field label="Email for verification (business or personal)" className="sm:col-span-2"><input type="email" className="field-control w-full" value={form.email} onChange={(event)=>setForm({...form,email:event.target.value})} /></Field></div></div>,
    parent:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Is another organization in control?</h2><p className="mt-2 text-sm leading-6 text-secondary">For an independent business, choose “No parent company” and move on. We only need head-office detail when it exists.</p></div><div className="grid gap-3 sm:grid-cols-3">{[["none","No parent company","The business is independently controlled."],["existing","A parent company exists","Head office or another legal entity governs the brand."],["unknown","I am not sure","Spotly should investigate the relationship."]].map(([value,title,description])=><Choice key={value} active={form.parentMode===value} onClick={()=>setForm({...form,parentMode:value})} title={title} description={description} />)}</div>{form.parentMode!=="none"&&<div className="grid gap-4 sm:grid-cols-2"><Field label="Parent organization name"><input className="field-control w-full" value={form.parentName} onChange={(event)=>setForm({...form,parentName:event.target.value})} /></Field><Field label="Head-office contact email"><input type="email" className="field-control w-full" value={form.parentContactEmail} onChange={(event)=>setForm({...form,parentContactEmail:event.target.value})} /></Field><Field label="Head-office contact name" className="sm:col-span-2"><input className="field-control w-full" value={form.parentContactName} onChange={(event)=>setForm({...form,parentContactName:event.target.value})} /></Field></div>}<div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--on-warning-soft)]">If another verified owner controls the business, Spotly will open an ownership review rather than replacing access silently.</div></div>,
    scope:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">What do you need to manage?</h2><p className="mt-2 text-sm leading-6 text-secondary">Choose the smallest useful scope. Spotly will confirm the final access after ownership or authority is verified.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["organization","Organization-wide","Multiple brands and locations under the legal entity."],["brand","Brand-wide","The selected brand and its authorized locations."],["selected_locations","Selected locations","Only locations you choose in the next step."],["listing_correction","Listing correction only","Suggest public-detail corrections without operational access."]].map(([value,title,description])=><Choice key={value} active={form.accessScope===value} onClick={()=>setForm({...form,accessScope:value})} title={title} description={description} />)}</div><label className="flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={form.financeAccess} onChange={(event)=>setForm({...form,financeAccess:event.target.checked})} className="mt-1" /><span><span className="block font-semibold">Request finance visibility</span><span className="mt-1 block text-sm text-secondary">Finance access is reviewed separately and may require stronger evidence.</span></span></label></div>,
    locations:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Confirm where the business operates</h2><p className="mt-2 text-sm leading-6 text-secondary">Keep the locations Spotly already knows, or add the first location if this is a new business.</p></div>{mode==="new"?<div className="grid gap-4 sm:grid-cols-2"><Field label="First location name"><input className="field-control w-full" value={form.branchName} onChange={(event)=>setForm({...form,branchName:event.target.value})} /></Field><Field label="City or town"><select className="field-control w-full" value={form.city} onChange={(event)=>setForm({...form,city:event.target.value})}>{zimbabweCities.map((item)=><option key={item}>{item}</option>)}</select></Field><Field label="Street address (optional)" className="sm:col-span-2"><input className="field-control w-full" placeholder="Street, neighbourhood or landmark — you can add this later" value={form.address} onChange={(event)=>setForm({...form,address:event.target.value})} /></Field></div>:branches.length?<div className="grid gap-3 sm:grid-cols-2">{branches.map((branch)=>{const active=selectedBranchIds.includes(branch.id);return <Choice key={branch.id} active={active} onClick={()=>toggleBranch(branch.id)} icon={MapPin} title={branch.branchName||branch.name||"Location"} description={[branch.address,branch.city].filter(Boolean).join(" · ")||"Address not provided"} />;})}</div>:<div className="flex items-start gap-3 rounded-xl border border-business/25 bg-business-soft p-4 text-sm leading-6"><Info className="mt-0.5 h-5 w-5 shrink-0 text-business"/><div><p className="font-semibold">No verified locations are listed yet</p><p className="mt-1 text-secondary">You can continue with the business-level claim. Spotly will confirm the correct locations during verification. You do not need to select a placeholder location.</p></div></div>}</div>,
    operations:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">What kind of workspace should Spotly build?</h2><p className="mt-2 text-sm leading-6 text-secondary">Choose what best matches how customers use the business. This changes the words, tools and daily priorities you see.</p></div><div className="grid gap-3 sm:grid-cols-2">{Object.values(BUSINESS_ARCHETYPES).map((type)=><Choice key={type.id} active={form.businessType===type.id} onClick={()=>setForm({...form,businessType:type.id,category:type.categoryHints[0]})} icon={type.icon} title={type.label} description={type.description} />)}</div></div>,
    public:<div className="space-y-6"><div><h2 className="text-2xl font-semibold">Check how customers will see the business</h2><p className="mt-2 text-sm leading-6 text-secondary">Keep what is correct and change only what needs updating. Nothing becomes merchant-controlled commerce until the business is approved.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Business or brand name"><input className="field-control w-full" value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})} /></Field><Field label="Legal name"><input className="field-control w-full" value={form.legalName} onChange={(event)=>setForm({...form,legalName:event.target.value})} /></Field><Field label="Primary category"><select className="field-control w-full" value={form.category} onChange={(event)=>setForm({...form,category:event.target.value})}>{businessCategories.map((item)=><option key={item}>{item}</option>)}</select></Field><Field label="Website"><input className="field-control w-full" value={form.website} onChange={(event)=>setForm({...form,website:event.target.value})} /></Field><Field label="Public description" className="sm:col-span-2"><textarea className="field-control min-h-28 w-full py-3" value={form.description} onChange={(event)=>setForm({...form,description:event.target.value})} /></Field></div></div>,
    evidence:<div className="space-y-6"><div><span className="inline-flex items-center gap-2 rounded-full bg-business-soft px-3 py-1.5 text-xs font-bold text-business"><ShieldCheck className="h-3.5 w-3.5"/> Business verification</span><h2 className="mt-4 text-2xl font-semibold">Help us confirm you can manage this business</h2><p className="mt-2 text-sm leading-6 text-secondary">A business registration certificate, company email, employment letter, franchise authorization or other credible proof can work. Only the verification team can review submitted evidence.</p></div>{(!user?.uid||user.isAnonymous)&&<div className="flex items-start gap-3 rounded-2xl border border-business/25 bg-business-soft p-4 text-sm leading-6"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-business"/><div><p className="font-semibold">You can attach documents before creating an account</p><p className="mt-1 text-secondary">They are stored temporarily in this browser. At the final step, create or sign in to your Spotly account. We'll restore this application and upload the documents securely.</p></div></div>}
      <label className="group block cursor-pointer rounded-2xl border-2 border-dashed border-business/30 bg-[var(--surface)] p-8 text-center transition duration-200 hover:border-business hover:bg-business-soft/20 focus-within:ring-2 focus-within:ring-business"><UploadCloud className="mx-auto h-8 w-8 text-business transition group-hover:-translate-y-1"/><p className="mt-3 font-bold">{user?.uid&&!user.isAnonymous?"Choose evidence to upload":"Attach verification documents"}</p><p className="mt-2 text-xs leading-5 text-secondary">PDF, JPG, PNG, DOC or DOCX · Up to 10 MB per file</p><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="sr-only" onChange={(event)=>{addEvidence(event.target.files);event.target.value="";}} /></label>
      {restoringFiles&&<div role="status" className="flex items-center gap-2 rounded-xl border border-business/25 bg-business-soft p-3 text-sm font-semibold text-business"><LoaderCircle className="h-4 w-4 animate-spin"/>Uploading documents from your saved application…</div>}
      {Object.entries(uploading).map(([key,value])=><div key={key} className="rounded-xl border p-3"><div className="flex justify-between text-sm"><span className="truncate font-semibold">Uploading securely</span><span>{value}%</span></div><ProgressBar value={value} className="mt-2" /></div>)}
      {evidence.length>0&&<div className="space-y-2"><p className="text-xs font-bold uppercase tracking-widest text-tertiary">Attached documents ({evidence.length})</p>{evidence.map((item,index)=><div key={item.id||item.url||index} className="flex items-center gap-3 rounded-xl border bg-[var(--surface)] p-3"><FileCheck2 className="h-5 w-5 shrink-0 text-business"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="mt-0.5 block text-xs text-secondary">{item.staged?"Saved on device · Uploads after sign-in":"Uploaded securely"}</span></span><button type="button" onClick={()=>removeEvidence(item)} className="rounded-lg p-2 text-danger transition hover:bg-[var(--danger-soft)]" aria-label={`Remove ${item.name}`}><Trash2 className="h-4 w-4" /></button></div>)}</div>}
      <Field label="Anything the reviewer should know? (optional)"><textarea className="field-control min-h-28 w-full py-3" value={form.notes} onChange={(event)=>setForm({...form,notes:event.target.value})} placeholder="Any helpful context about your authority or the business"/></Field>
    </div>,
    review:<div className="space-y-5"><div><h2 className="text-2xl font-semibold">Review before sending</h2><p className="mt-2 text-sm text-secondary">This is the information Spotly will use to verify access. You can edit any section first.</p></div>{[[0,"Business",form.name||"Not selected"],[1,"Relationship",form.roleAtBusiness.replaceAll("_"," ")],[2,"Parent organization",form.parentMode==="none"?"No parent organization":form.parentName||"Needs investigation"],[3,"Requested access",form.accessScope.replaceAll("_"," ")],[4,"Locations",mode==="new"?`${form.branchName}, ${form.city}`:selectedBranches.map((item)=>item.branchName||item.name).join(", ")||"Not selected"],[5,"Operating model",archetype.label],[6,"Public details",`${form.category} · ${form.website||"No website"}`],[7,"Evidence",`${evidence.length} uploaded file${evidence.length===1?"":"s"}`]].map(([index,label,value])=><Card key={label} variant="bordered" className="flex items-center gap-4 p-4"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-tertiary">{label}</p><p className="mt-1 truncate font-semibold capitalize">{value}</p></div><Button size="sm" variant="ghost" onClick={()=>setStepIndex(index)}>Edit</Button></Card>)}</div>,
    submit:<div className="space-y-6 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-business-soft text-business"><ShieldCheck className="h-8 w-8" /></span><div><h2 className="text-3xl font-semibold">Ready to send to Spotly</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-secondary">After you submit, ownership verification continues in the background. When access is approved, Spotly Business guides you through customer setup and launch instead of dropping you into an empty dashboard.</p></div><Button size="lg" loading={submitting} onClick={submit}>{user?.uid&&!user.isAnonymous?"Submit for review":"Secure account & keep my application"}<BadgeCheck className="h-5 w-5" /></Button></div>
  }[step.id];

  return <main data-workspace="business" className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link href={spotlyPortalUrl("business")} className="text-sm font-semibold text-business">← Spotly Business</Link><h1 className="mt-3 text-3xl font-semibold tracking-[-.03em]">Claim or add a business</h1><p className="mt-2 text-sm text-secondary">Phase {phaseIndex + 1} of {PHASES.length}: <span className="font-semibold text-[var(--text)]">{phase.label}</span> · {step.label}</p></div><div className="flex items-center gap-3"><span className={`text-xs ${saveState === "failed" ? "text-[var(--danger)]" : "text-secondary"}`}>{saveMessage || (lastSaved ? `Saved ${new Date(lastSaved).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}` : "Not saved yet")}</span>{saveState === "failed" && <Button size="sm" variant="ghost" onClick={()=>persistDraft()}>Retry</Button>}<Button variant="outline" loading={saving||navigationBusy} onClick={saveAndExit}>Save and exit</Button></div></div><ProgressBar value={progress} className="mt-5" /><div className="mt-4 grid grid-cols-4 gap-2 lg:hidden">{PHASES.map((item,index)=><div key={item.id} className={`rounded-xl border px-2 py-2 text-center text-[11px] font-semibold ${index===phaseIndex?"border-business bg-business-soft text-business":index<phaseIndex?"border-success/25 bg-[var(--success-soft)] text-success":"text-tertiary"}`}>{item.label}</div>)}</div><div className="mt-6 grid gap-6 lg:grid-cols-[230px_1fr]"><aside className="hidden lg:block"><p className="mb-3 px-2 text-xs font-bold uppercase tracking-[.14em] text-tertiary">Your setup</p><ol className="space-y-2">{PHASES.map((item,index)=>{const done=index<phaseIndex;const current=index===phaseIndex;const firstIndex=STEPS.findIndex((candidate)=>item.steps.includes(candidate.id));return <li key={item.id}><button type="button" onClick={()=>done&&setStepIndex(firstIndex)} disabled={index>phaseIndex} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ${current?"bg-business-soft":done?"hover:bg-[var(--surface-hover)]":"opacity-55"}`}><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${done?"bg-success text-[var(--on-success)]":current?"bg-business text-[var(--on-accent)]":"bg-grouped text-tertiary"}`}>{done?<Check className="h-4 w-4" />:index+1}</span><span className="min-w-0"><span className={`block text-sm font-bold ${current?"text-business":""}`}>{item.label}</span><span className="mt-1 block text-xs leading-5 text-secondary">{current?step.label:item.description}</span></span></button></li>;})}</ol><div className="mt-4 rounded-xl border bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">{saveState === "failed" ? "Account save needs attention" : "Your application is saved"}</p><p className="mt-1 text-xs leading-5 text-secondary">You can leave and continue this request later.</p></div><Button variant="outline" className="mt-3 w-full" loading={navigationBusy} onClick={goToRequests}>My business requests <ArrowRight className="h-4 w-4"/></Button></aside><Card variant="bordered" className="overflow-hidden"><div className="p-5 sm:p-8">{error&&<div role="alert" className="mb-5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{error}</div>}{stepContent}</div><div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-[var(--surface)] p-5"><Button variant="ghost" disabled={stepIndex===0} onClick={()=>{setError("");setStepIndex((value)=>Math.max(0,value-1));}}><ArrowLeft className="h-4 w-4" />Back</Button>{stepIndex>0&&stepIndex<STEPS.length-1?<Button onClick={next} disabled={restoringFiles||Object.keys(uploading).length>0}>Continue to {STEPS[stepIndex + 1].label}<ArrowRight className="h-4 w-4" /></Button>:stepIndex===0?<span className="text-xs text-secondary">Choose a listing or create a business above</span>:null}</div></Card></div></div></main>;
}
