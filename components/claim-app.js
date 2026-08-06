"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  FileCheck2,
  MapPin,
  Search,
  ShieldCheck,
  Store,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, ProgressBar, SearchField } from "@/components/ui";
import { FullScreenTask } from "@/components/business/shared";
import { useToast } from "@/components/providers";
import { useAuth } from "@/components/firebase-provider";
import {
  getBranchesForBusiness,
  getBusiness,
  searchBusinesses,
  track,
  uploadFile
} from "@/lib/firebase-services";
import { authenticatedFetch } from "@/lib/api-client";
import { businessCategories, zimbabweCities } from "@/data/business-config";
import { BUSINESS_ARCHETYPES, capabilitiesFor, inferBusinessType } from "@/data/business-archetypes";

const steps = [
  [1, "Find business"],
  [2, "Your authority"],
  [3, "Business & location"],
  [4, "Evidence & review"]
];

const CLAIM_DRAFT_KEY = "spotly-business-claim-draft-v2";

function Step({ number, title, active, complete }) {
  return <div className={`flex items-center gap-2.5 ${active || complete ? "text-ink" : "text-tertiary"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${complete ? "bg-success text-white" : active ? "bg-violet text-white" : "bg-grouped"}`}>{complete ? <Check className="h-4 w-4" /> : number}</span><span className="hidden text-sm font-semibold md:block">{title}</span></div>;
}

function BusinessSearch({ onSelect, initialName = "" }) {
  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const term = query.trim().toLowerCase();
      if (term.length < 2) { setResults([]); return; }
      setLoading(true);
      try { setResults(await searchBusinesses(term, 20)); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return <div><SearchField value={query} onChange={setQuery} placeholder="Business or brand name" className="h-14" />{query.length >= 2 && <div className="mt-4 overflow-hidden rounded-2xl border bg-white">{loading ? <div className="p-5 text-sm text-secondary">Searching business brands…</div> : results.length ? results.map((business) => <button key={business.id} type="button" onClick={() => onSelect(business)} className="flex w-full items-center gap-3 border-b px-4 py-4 text-left last:border-0 hover:bg-violet-soft/50"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet"><Store className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{business.brandName || business.name}</span><span className="mt-1 block truncate text-sm text-secondary">{business.category} · {business.branchCount || business.branchIds?.length || 1} location{(business.branchCount || business.branchIds?.length || 1) === 1 ? "" : "s"} · {business.claimStatus === "claimed" ? "Already claimed" : "Available to claim"}</span></span><ChevronRight className="h-5 w-5 text-tertiary" /></button>) : <div className="p-5"><p className="font-semibold">No matching business brand was found.</p><p className="mt-2 text-sm leading-6 text-secondary">Add the business brand first. The first location will be created separately so customers and staff are not confused.</p><Button type="button" className="mt-4" onClick={() => onSelect({ id: null, name: query, isNew: true })}>Add “{query}”</Button></div>}</div>}</div>;
}

function BranchChoice({ branches, selectedIds, setSelectedIds, role }) {
  const branchLimited = ["branch_manager", "authorized_staff"].includes(role);
  function toggle(id) {
    if (branchLimited) setSelectedIds([id]);
    else setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  return <div className="grid gap-3 sm:grid-cols-2">{branches.map((branch) => { const selected = selectedIds.includes(branch.id); return <button type="button" key={branch.id} onClick={() => toggle(branch.id)} className={`flex items-start gap-3 rounded-2xl border p-4 text-left ${selected ? "border-violet bg-violet-soft" : "bg-white hover:border-violet/30"}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-violet text-white" : "bg-grouped text-secondary"}`}><MapPin className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-bold">{branch.branchName || branch.name || branch.displayName}</span><span className="mt-1 block text-sm text-secondary">{branch.city || "Zimbabwe"}{branch.address ? ` · ${branch.address}` : ""}</span></span><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-violet bg-violet text-white" : ""}`}>{selected && <Check className="h-3.5 w-3.5" />}</span></button>; })}</div>;
}

export function ClaimApp({ initialBusinessId, newBusiness = false, initialName = "" }) {
  const [step, setStep] = useState(initialBusinessId ? 2 : 1);
  const [selected, setSelected] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState([]);
  const [mode, setMode] = useState(newBusiness ? "new" : "claim");
  const [form, setForm] = useState({ name: initialName, organizationName: "", legalName: "", category: "Groceries", businessType: "grocery_retail", city: "Harare", branchName: "Main location", address: "", phone: "", email: "", website: "", instagram: "", applicantName: "", roleAtBusiness: "owner", notes: "" });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [complete, setComplete] = useState(null);
  const [task, setTask] = useState({ open: false, state: "processing", active: 0, title: "Submitting your claim", description: "Spotly is checking the business, locations, and evidence." });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!initialBusinessId) return;
    let active = true;
    (async () => {
      try {
        const business = await getBusiness(initialBusinessId);
        if (!active || !business) return;
        const locations = await getBranchesForBusiness(business.id);
        setSelected(business);
        setBranches(locations);
        setSelectedBranchIds(locations.length === 1 ? [locations[0].id] : []);
        setForm((current) => ({ ...current, name: business.brandName || business.name, category: business.category || "Other", businessType: business.businessType || inferBusinessType(business), email: business.email || "", phone: business.phone || "", website: business.website || "" }));
        setStep(2);
      } catch {}
    })();
    return () => { active = false; };
  }, [initialBusinessId]);

  useEffect(() => { if (user) setForm((current) => ({ ...current, applicantName: current.applicantName || user.displayName || "", email: current.email || user.email || "", phone: current.phone || user.phoneNumber || "" })); }, [user]);

  useEffect(() => {
    if (initialBusinessId) { setDraftReady(true); return; }
    try {
      const saved = JSON.parse(window.localStorage.getItem(CLAIM_DRAFT_KEY) || "null");
      if (saved) {
        setStep(Math.max(1, Math.min(4, Number(saved.step) || 1)));
        setMode(saved.mode || (newBusiness ? "new" : "claim"));
        setSelected(saved.selected || null);
        setBranches(saved.branches || []);
        setSelectedBranchIds(saved.selectedBranchIds || []);
        setForm((current) => ({ ...current, ...(saved.form || {}), ...(initialName && !saved.form?.name ? { name: initialName } : {}) }));
        setLastSaved(saved.savedAt || null);
      }
    } catch {}
    setDraftReady(true);
  }, [initialBusinessId, initialName, newBusiness]);

  useEffect(() => {
    if (!draftReady || complete) return;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(CLAIM_DRAFT_KEY, JSON.stringify({ step, mode, selected, branches, selectedBranchIds, form, savedAt }));
      setLastSaved(savedAt);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [branches, complete, draftReady, form, mode, selected, selectedBranchIds, step]);

  function addEvidence(fileList) {
    const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
    const next = Array.from(fileList || []).filter((file) => {
      if (file.size > 10 * 1024 * 1024) { toast(`${file.name} is larger than 10 MB.`, { type: "error", title: "File too large" }); return false; }
      if (file.type && !allowed.has(file.type)) { toast(`${file.name} is not a supported document type.`, { type: "error", title: "Unsupported file" }); return false; }
      return true;
    });
    setFiles((current) => [...current, ...next]);
  }

  const progress = complete ? 100 : step * 25;
  const archetype = BUSINESS_ARCHETYPES[form.businessType] || BUSINESS_ARCHETYPES.directory_profile;
  const selectedBranches = useMemo(() => branches.filter((branch) => selectedBranchIds.includes(branch.id)), [branches, selectedBranchIds]);

  async function selectBusiness(business) {
    if (business.isNew) {
      setMode("new");
      setSelected(null);
      setBranches([]);
      setSelectedBranchIds([]);
      setForm((current) => ({ ...current, name: business.name }));
    } else {
      setMode("claim");
      setSelected(business);
      const locations = await getBranchesForBusiness(business.id);
      setBranches(locations);
      setSelectedBranchIds(locations.length === 1 ? [locations[0].id] : []);
      setForm((current) => ({ ...current, name: business.brandName || business.name, category: business.category || "Other", businessType: business.businessType || inferBusinessType(business), email: business.email || current.email, phone: business.phone || current.phone, website: business.website || "" }));
    }
    setStep(2);
    track("business_claim_brand_selected", { business_id: business.id || "new" });
  }

  async function submit() {
    if (!user) {
      window.location.href = `/login?portal=business&next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    if (mode === "claim" && !selectedBranchIds.length) return toast("Choose at least one location connected to your authority.", { type: "error", title: "Location required" });
    setLoading(true);
    setTask({ open: true, state: "processing", active: 0, title: "Submitting your business claim", description: "Spotly is saving the business, locations, evidence, and verification trail." });
    try {
      const businessId = selected?.id || `owner-${crypto.randomUUID()}`;
      const organizationId = selected?.organizationId || null;
      const evidence = [];
      setTask((value) => ({ ...value, active: 1 }));
      for (const file of files) {
        const url = await uploadFile(`verification/${businessId}/${user.uid}/${Date.now()}-${file.name}`, file, { businessId, applicantId: user.uid });
        evidence.push({ name: file.name, type: file.type, url, size: file.size });
      }
      setTask((value) => ({ ...value, active: 2 }));
      const result = await authenticatedFetch("/api/business-claims/submit", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          organizationId,
          branchIds: mode === "claim" ? selectedBranchIds : [],
          applicantName: form.applicantName || user.displayName || user.email,
          phone: form.phone,
          email: form.email || user.email,
          roleAtBusiness: form.roleAtBusiness,
          notes: form.notes,
          evidence,
          provisionalBusiness: mode === "new" ? {
            id: businessId,
            name: form.name,
            brandName: form.name,
            organizationName: form.organizationName || form.name,
            legalName: form.legalName,
            branchName: form.branchName || "Main location",
            category: form.category,
            businessType: form.businessType,
            capabilities: capabilitiesFor(form.businessType),
            city: form.city,
            country: "ZW",
            address: form.address,
            phone: form.phone,
            email: form.email,
            website: form.website,
            instagram: form.instagram,
            description: `${form.name} was submitted by an authorized representative and remains private until verification is complete.`,
            source: { type: "owner_created", imported: false }
          } : selected?.source?.imported ? { ...selected, selectedBranchIds } : null
        })
      });
      setTask((value) => ({ ...value, active: 3 }));
      setComplete({ claimId: result.claimId, businessId, newBusiness: mode === "new", autoApproved: Boolean(result.autoApproved) });
      window.localStorage.removeItem(CLAIM_DRAFT_KEY);
      setTask({ open: true, state: "success", active: 4, title: result.autoApproved ? "Your workspace is ready" : "Claim submitted successfully", description: result.autoApproved ? "You can continue with guided business setup." : "We saved your request and selected locations. We will contact you if more information is needed." });
    } catch (error) {
      setTask({ open: true, state: "error", active: 0, title: "The claim was not submitted", description: error.message || "Review the details and try again." });
    } finally { setLoading(false); }
  }

  function closeTask() {
    const success = task.state === "success";
    setTask((value) => ({ ...value, open: false }));
    if (success) window.location.assign("/business");
  }

  return <main className="min-h-screen bg-grouped px-4 py-8 text-ink sm:px-6 lg:py-12" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}><div className="mx-auto max-w-6xl"><div className="mb-6 flex items-center justify-between"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-violet"><ArrowLeft className="h-4 w-4" />Back to Spotly</Link><Link href="/support" className="text-sm font-semibold text-secondary">Need help?</Link></div><Card className="overflow-hidden"><div className="border-b bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet">Business setup</p><h1 className="mt-2 text-3xl font-black tracking-tight">Claim or add a business</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Choose the business, explain your relationship, then confirm the exact location or locations you represent.</p>{lastSaved && <p className="mt-2 text-xs text-tertiary">Saved {new Intl.DateTimeFormat("en-ZW", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSaved))}</p>}</div><div className="flex items-center gap-3">{steps.map(([number, title]) => <Step key={number} number={number} title={title} active={step === number} complete={step > number || Boolean(complete)} />)}</div></div><ProgressBar value={progress} className="mt-6" /></div>
    <div className="min-h-[520px] p-5 sm:p-7 lg:p-9">
      {step === 1 && <div className="mx-auto max-w-3xl"><div className="text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-soft text-violet"><Search className="h-6 w-6" /></span><h2 className="mt-5 text-2xl font-black">Find the business brand</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-secondary">Search for the brand customers recognize. You will choose the relevant branch, venue, or location on the next step.</p></div><div className="mt-7"><BusinessSearch onSelect={selectBusiness} initialName={form.name} /></div></div>}
      {step === 3 && <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet">Business and location</p><h2 className="mt-2 text-2xl font-black">{mode === "new" ? "Create the brand and its first location" : `Which ${selected?.brandName || selected?.name} location do you represent?`}</h2><p className="mt-2 text-sm leading-6 text-secondary">The brand remains one business. Locations are branches underneath it.</p></div>{mode === "new" ? <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Business or brand name</span><input className="surface h-12 w-full rounded-xl px-4" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="mb-2 block text-sm font-bold">Legal name <span className="font-normal text-secondary">(optional)</span></span><input className="surface h-12 w-full rounded-xl px-4" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></label></div><div><span className="mb-2 block text-sm font-bold">Business type</span><div className="grid gap-3 sm:grid-cols-2">{Object.values(BUSINESS_ARCHETYPES).map((type) => { const Icon = type.icon; const active = form.businessType === type.id; return <button type="button" key={type.id} onClick={() => setForm({ ...form, businessType: type.id, category: type.categoryHints[0] })} className={`flex items-start gap-3 rounded-2xl border p-4 text-left ${active ? "border-violet bg-violet-soft" : ""}`}><Icon className="mt-0.5 h-5 w-5 text-violet" /><span><span className="font-bold">{type.label}</span><span className="mt-1 block text-xs leading-5 text-secondary">{type.description}</span></span></button>; })}</div></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Primary category</span><select className="surface h-12 w-full rounded-xl px-4" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{businessCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="mb-2 block text-sm font-bold">First location name</span><input className="surface h-12 w-full rounded-xl px-4" value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} placeholder="Main location" /></label><label><span className="mb-2 block text-sm font-bold">City or town</span><select className="surface h-12 w-full rounded-xl px-4" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })}>{zimbabweCities.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="mb-2 block text-sm font-bold">Address</span><input className="surface h-12 w-full rounded-xl px-4" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label></div></div> : <><div className="rounded-2xl bg-violet-soft p-5"><div className="flex items-start gap-4"><Building2 className="mt-1 h-6 w-6 text-violet" /><div><h3 className="text-lg font-black">{selected?.brandName || selected?.name}</h3><p className="mt-1 text-sm text-secondary">{selected?.category} · {branches.length} known location{branches.length === 1 ? "" : "s"}</p></div></div></div><BranchChoice branches={branches} selectedIds={selectedBranchIds} setSelectedIds={setSelectedBranchIds} role={form.roleAtBusiness} /></>}</div>}
      {step === 2 && <div className="mx-auto max-w-3xl space-y-6"><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet">Your authority</p><h2 className="mt-2 text-2xl font-black">Who are you in relation to this business?</h2><p className="mt-2 text-sm leading-6 text-secondary">This determines whether access is brand-wide or limited to selected locations.</p></div><div className="grid gap-3 sm:grid-cols-2">{[
        ["owner", "Owner or director", "Usually receives brand-wide access after approval."],
        ["franchisee", "Franchisee", "Access can be limited to the franchise locations selected."],
        ["branch_manager", "Location manager", "Receives access only to one selected location."],
        ["authorized_staff", "Authorized staff", "Receives only the responsibilities approved by Spotly or the owner."]
      ].map(([value, label, description]) => <button type="button" key={value} onClick={() => { setForm({ ...form, roleAtBusiness: value }); if (["branch_manager", "authorized_staff"].includes(value) && selectedBranchIds.length > 1) setSelectedBranchIds(selectedBranchIds.slice(0, 1)); }} className={`rounded-2xl border p-4 text-left ${form.roleAtBusiness === value ? "border-violet bg-violet-soft" : ""}`}><p className="font-bold">{label}</p><p className="mt-1 text-xs leading-5 text-secondary">{description}</p></button>)}</div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Your name</span><input className="surface h-12 w-full rounded-xl px-4" value={form.applicantName} onChange={(event) => setForm({ ...form, applicantName: event.target.value })} /></label><label><span className="mb-2 block text-sm font-bold">Phone</span><input className="surface h-12 w-full rounded-xl px-4" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+263" /></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold">Business email</span><input type="email" className="surface h-12 w-full rounded-xl px-4" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div></div>}
      {step === 4 && <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet">Evidence and review</p><h2 className="mt-2 text-2xl font-black">Add useful proof and check the request</h2><p className="mt-2 text-sm leading-6 text-secondary">Add the strongest information you have. We may contact the business, location, or head office while reviewing your request.</p></div><div className="grid gap-5 lg:grid-cols-[1fr_340px]"><div className="space-y-5"><label className="block cursor-pointer rounded-2xl border-2 border-dashed p-7 text-center hover:border-violet/40"><UploadCloud className="mx-auto h-7 w-7 text-violet" /><p className="mt-3 font-bold">Upload ownership or authority evidence</p><p className="mt-2 text-xs leading-5 text-secondary">PDF, JPG, PNG, DOC or DOCX up to 10 MB each. These files are reviewed only for this request.</p><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="sr-only" onChange={(event) => addEvidence(event.target.files)} /></label>{files.length > 0 && <div className="space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-grouped p-3"><FileCheck2 className="h-4 w-4 text-violet" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{file.name}</span><button onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-bold text-danger">Remove</button></div>)}</div>}<label><span className="mb-2 block text-sm font-bold">Anything the reviewer should know?</span><textarea className="surface min-h-28 w-full rounded-xl p-4" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Explain your authority, the selected locations, or any outdated listing information." /></label></div><Card className="p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[.14em] text-tertiary">Claim summary</p><button type="button" onClick={() => setStep(2)} className="text-xs font-semibold text-violet">Edit</button></div><h3 className="mt-3 text-xl font-black">{form.name}</h3><p className="mt-1 text-sm text-secondary">{archetype.label}</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-secondary">Authority</span><span className="font-bold capitalize">{form.roleAtBusiness.replaceAll("_", " ")}</span></div><div className="flex justify-between gap-3"><span className="text-secondary">Locations</span><span className="text-right font-bold">{mode === "new" ? form.branchName : selectedBranches.map((item) => item.branchName || item.name || item.displayName).join(", ") || "Not selected"}</span></div><div className="flex justify-between gap-3"><span className="text-secondary">Evidence</span><span className="font-bold">{files.length} file{files.length === 1 ? "" : "s"}</span></div></div><div className="mt-5 rounded-2xl bg-grouped p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-violet" /><p className="text-xs leading-5 text-secondary">Approval grants access to the business brand and only the locations appropriate for the selected authority.</p></div></div></Card></div></div>}
    </div><div className="flex flex-col-reverse gap-3 border-t bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div className="flex items-center gap-2">{step > 1 ? <Button variant="ghost" onClick={() => setStep((current) => current - 1)}><ArrowLeft className="h-4 w-4" />Back</Button> : <span />}<Button asChild variant="ghost"><Link href="/account">Save and exit</Link></Button></div>{step < 4 ? <Button onClick={() => setStep((current) => current + 1)} disabled={(step === 2 && (!form.applicantName.trim() || !form.email.trim())) || (step === 3 && mode === "claim" && !selectedBranchIds.length) || (step === 3 && mode === "new" && (!form.name.trim() || !form.branchName.trim()))}>Continue<ArrowRight className="h-4 w-4" /></Button> : <Button onClick={submit} loading={loading}>{user ? "Submit for review" : "Sign in to submit"}<BadgeCheck className="h-4 w-4" /></Button>}</div></Card></div><FullScreenTask open={task.open} state={task.state} title={task.title} description={task.description} steps={["Confirm the business brand", "Attach selected locations", "Save evidence and audit history", "Notify the right people"]} activeStep={task.active} onDone={closeTask} doneLabel={task.state === "success" ? "Open Spotly Business" : "Return to claim"} /></main>;
}
