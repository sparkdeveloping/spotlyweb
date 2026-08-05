"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  HelpCircle,
  Search,
  ShieldCheck,
  Store,
  UploadCloud,
  UserRound
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, ProgressBar, SearchField } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useAuth } from "@/components/firebase-provider";
import {
  getBusiness,
  searchBusinesses,
  track,
  uploadFile
} from "@/lib/firebase-services";
import { authenticatedFetch } from "@/lib/api-client";

const categories = ["Groceries", "Restaurants", "Beauty", "Wellness", "Events", "Activities", "Accommodation", "Professional Services", "Retail", "Health", "Education", "Other"];
const cities = ["Harare", "Bulawayo", "Mutare", "Gweru", "Masvingo", "Kwekwe", "Victoria Falls", "Chitungwiza", "Kadoma", "Chinhoyi", "Marondera", "Other"];

function Step({ number, title, active, complete }) {
  return <div className={`flex items-center gap-3 ${active || complete ? "text-ink" : "text-tertiary"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${complete ? "bg-success text-white" : active ? "bg-violet text-white" : "bg-grouped"}`}>{complete ? <Check className="h-4 w-4" /> : number}</span><span className="hidden text-sm font-semibold sm:block">{title}</span></div>;
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
      try {
        const remote = await searchBusinesses(term, 16);
        setResults(remote);
      } catch {
        setResults([]);
      } finally { setLoading(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return <div><SearchField value={query} onChange={setQuery} placeholder="Business name, branch, category, or city" className="h-14" />{query.length >= 2 && <div className="mt-4 overflow-hidden rounded-2xl border bg-white">{loading ? <div className="p-5 text-sm text-secondary">Searching Spotly listings…</div> : results.length ? results.map((business) => <button key={business.id} type="button" onClick={() => onSelect(business)} className="flex w-full items-center gap-3 border-b px-4 py-4 text-left last:border-0 hover:bg-violet-soft/50"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet"><Store className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{business.name}</span><span className="mt-1 block truncate text-sm text-secondary">{business.category} · {business.city} · {business.claimStatus === "claimed" ? "Claimed" : "Available to claim"}</span></span><ChevronRight className="h-5 w-5 text-tertiary" /></button>) : <div className="p-5"><p className="font-semibold">No matching business was found.</p><p className="mt-2 text-sm leading-6 text-secondary">Continue by adding the business. We will still check for possible duplicates during review.</p><Button type="button" className="mt-4" onClick={() => onSelect({ id: null, name: query, isNew: true })}>Add “{query}”</Button></div>}</div>}</div>;
}

export function ClaimApp({ initialBusinessId, newBusiness = false, initialName = "" }) {
  const [step, setStep] = useState(initialBusinessId || newBusiness ? 2 : 1);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState(newBusiness ? "new" : "claim");
  const [form, setForm] = useState({ name: initialName, organizationName: "", legalName: "", category: "Groceries", city: "Harare", address: "", phone: "", email: "", website: "", instagram: "", applicantName: "", roleAtBusiness: "owner", notes: "" });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!initialBusinessId) return;
    let active = true;
    (async () => {
      let business = null;
      try { business = await getBusiness(initialBusinessId); } catch {}
      if (active && business) {
        setSelected(business);
        setForm((current) => ({ ...current, name: business.brandName || business.name, category: business.category || "Groceries", city: business.city || "Harare", address: business.address || "", phone: business.phone || "", email: business.email || "", website: business.website || "" }));
        setStep(2);
      }
    })();
    return () => { active = false; };
  }, [initialBusinessId]);

  useEffect(() => { if (user) setForm((current) => ({ ...current, applicantName: current.applicantName || user.displayName || "", email: current.email || user.email || "", phone: current.phone || user.phoneNumber || "" })); }, [user]);

  const progress = complete ? 100 : step === 1 ? 20 : step === 2 ? 45 : step === 3 ? 70 : 90;

  function selectBusiness(business) {
    if (business.isNew) {
      setMode("new");
      setSelected(null);
      setForm((current) => ({ ...current, name: business.name }));
    } else {
      setMode("claim");
      setSelected(business);
      setForm((current) => ({ ...current, name: business.brandName || business.name, category: business.category || "Groceries", city: business.city || "Harare", address: business.address || "", phone: business.phone || "", email: business.email || "", website: business.website || "" }));
    }
    setStep(2);
    track("business_claim_listing_selected", { business_id: business.id || "new" });
  }

  async function submit() {
    if (!user) {
      window.location.href = `/login?portal=business&next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setLoading(true);
    try {
      const businessId = selected?.id || `owner-${crypto.randomUUID()}`;
      const organizationId = selected?.organizationId || null;
      const evidence = [];
      for (const file of files) {
        const url = await uploadFile(`verification/${businessId}/${user.uid}/${Date.now()}-${file.name}`, file, { businessId, applicantId: user.uid });
        evidence.push({ name: file.name, type: file.type, url, size: file.size });
      }
      const result = await authenticatedFetch("/api/business-claims/submit", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          organizationId,
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
            organizationName: form.organizationName,
            legalName: form.legalName,
            branchName: `${form.name} — ${form.city || "Main branch"}`,
            category: form.category,
            city: form.city,
            country: "ZW",
            address: form.address,
            phone: form.phone,
            email: form.email,
            website: form.website,
            instagram: form.instagram,
            description: `${form.name} was submitted by an authorized representative and remains private until verification is complete.`,
            source: { type: "owner_created", imported: false }
          } : selected?.source?.imported ? selected : null
        })
      });
      setComplete({ claimId: result.claimId, businessId, newBusiness: mode === "new", autoApproved: Boolean(result.autoApproved) });
      toast(result.autoApproved ? "Your verified business workspace is ready." : "Your business claim is now in the verification queue.", { title: result.autoApproved ? "Ownership approved" : "Claim submitted" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not submit claim" });
    } finally { setLoading(false); }
  }

  if (complete) return <main className="min-h-screen bg-grouped px-4 py-10 text-ink" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}><div className="mx-auto max-w-2xl"><Card elevated className="p-7 text-center sm:p-10"><span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-emerald-50 text-success"><CheckCircle2 className="h-9 w-9" /></span><p className="mt-6 text-xs font-bold uppercase tracking-[.17em] text-success">{complete.autoApproved ? "Approved successfully" : "Submitted successfully"}</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">{complete.autoApproved ? "Your business workspace is ready." : "Your claim has a clear next step."}</h1><p className="mx-auto mt-4 max-w-lg leading-7 text-secondary">{complete.autoApproved ? "Your evidence and account passed Spotly’s configured low-risk verification policy. Continue with branches, catalog, staff, finance, and pickup readiness." : "Spotly administration can now review the information and evidence. Any request for more detail will appear in your business portal and support inbox."}</p><div className="mt-7 rounded-2xl bg-grouped p-5 text-left"><div className="flex items-center justify-between gap-4"><span className="text-sm text-secondary">Claim reference</span><code className="text-sm font-bold">{complete.claimId}</code></div><div className="mt-4 flex items-center justify-between gap-4"><span className="text-sm text-secondary">Current status</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${complete.autoApproved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{complete.autoApproved ? "Approved" : "Awaiting review"}</span></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2"><Link href="/business"><Button className="w-full">Open business portal<ArrowRight className="h-4 w-4" /></Button></Link><Link href="/support"><Button variant="outline" className="w-full">Contact support</Button></Link></div></Card></div></main>;

  return <main className="min-h-screen bg-grouped text-ink" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}><header className="border-b bg-white"><div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.png" alt="Spotly" width={42} height={42} className="rounded-[14px]" /><span className="font-black">Spotly Business</span></Link><Link href="/support" className="flex items-center gap-2 text-sm font-semibold text-secondary"><HelpCircle className="h-4 w-4" />Get help</Link></div></header><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-secondary"><ArrowLeft className="h-4 w-4" />Back to Spotly</Link><h1 className="mt-4 text-4xl font-black tracking-[-.045em]">List or claim your business</h1><p className="mt-3 max-w-2xl leading-7 text-secondary">Search first so existing information can be confirmed rather than re-entered. Your progress is structured around what Spotly needs to verify ownership.</p></div><div className="w-full max-w-md"><div className="flex items-center justify-between text-xs font-semibold text-secondary"><span>Application progress</span><span>{progress}%</span></div><ProgressBar value={progress} className="mt-2" /></div></div><div className="mt-8 flex items-center justify-between rounded-2xl border bg-white p-3 sm:px-5">{[[1, "Find business"], [2, "Confirm details"], [3, "Ownership"], [4, "Review"]].map(([number, title]) => <Step key={number} number={number} title={title} active={step === number} complete={step > number} />)}</div>
      <Card elevated className="mt-6 overflow-hidden"><div className="border-b bg-white px-5 py-5 sm:px-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-violet">Step {step} of 4</p><h2 className="mt-2 text-2xl font-black">{step === 1 ? "Find the closest business match" : step === 2 ? "Confirm the business details" : step === 3 ? "Show your connection to the business" : "Review before submission"}</h2></div><div className="p-5 sm:p-7">{step === 1 && <BusinessSearch onSelect={selectBusiness} initialName={initialName} />}
        {step === 2 && <div className="space-y-5">{selected && <div className="flex items-start gap-4 rounded-2xl bg-violet-soft p-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-violet"><Store className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">Existing provisional listing selected</p><p className="mt-1 text-sm leading-6 text-secondary">Review every field. Provisional information may be incomplete or outdated.</p></div><button onClick={() => { setSelected(null); setStep(1); }} className="text-sm font-semibold text-violet">Change</button></div>}<div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Public business name</span><input required className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="mb-2 block text-sm font-semibold">Organization or parent company</span><input className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} placeholder="Optional" /></label><label><span className="mb-2 block text-sm font-semibold">Legal name</span><input className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} placeholder="Can be completed later" /></label><label><span className="mb-2 block text-sm font-semibold">Category</span><select className="surface h-12 w-full rounded-xl px-4" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="mb-2 block text-sm font-semibold">City</span><select className="surface h-12 w-full rounded-xl px-4" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })}>{cities.map((item) => <option key={item}>{item}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Branch address</span><input className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Street, suburb, city" /></label><label><span className="mb-2 block text-sm font-semibold">Business phone</span><input className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+263" /></label><label><span className="mb-2 block text-sm font-semibold">Business email</span><input type="email" className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label><span className="mb-2 block text-sm font-semibold">Website</span><input className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label><label><span className="mb-2 block text-sm font-semibold">Instagram</span><input className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.instagram} onChange={(event) => setForm({ ...form, instagram: event.target.value })} placeholder="@business" /></label></div></div>}
        {step === 3 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Your full name</span><input required className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.applicantName} onChange={(event) => setForm({ ...form, applicantName: event.target.value })} /></label><label><span className="mb-2 block text-sm font-semibold">Your role</span><select className="surface h-12 w-full rounded-xl px-4" value={form.roleAtBusiness} onChange={(event) => setForm({ ...form, roleAtBusiness: event.target.value })}><option value="owner">Owner or director</option><option value="authorized_manager">Authorized manager</option><option value="marketing">Marketing or digital representative</option><option value="franchisee">Franchisee</option><option value="other">Other authorized person</option></select></label></div><div className="rounded-2xl border border-dashed p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft text-violet"><UploadCloud className="h-5 w-5" /></span><div className="flex-1"><p className="font-semibold">Ownership or authority evidence</p><p className="mt-1 text-sm leading-6 text-secondary">Company registration, owner identification, proof of address, authorization letter, or another relevant record. Administration can request more detail later.</p><input type="file" multiple onChange={(event) => setFiles([...event.target.files])} className="mt-4 block w-full text-sm" accept="image/*,.pdf" /></div></div>{files.length > 0 && <div className="mt-4 space-y-2">{files.map((file) => <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-xl bg-grouped px-3 py-2 text-sm"><FileCheck2 className="h-4 w-4 text-success" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="text-xs text-tertiary">{Math.ceil(file.size / 1024)} KB</span></div>)}</div>}</div><label className="block"><span className="mb-2 block text-sm font-semibold">Anything the reviewer should know?</span><textarea className="surface min-h-28 w-full rounded-xl p-4 outline-none" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Explain your relationship to the business, branch structure, or any information that may look different from the listing." /></label><div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-blue-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm leading-6">Low-risk claims may become eligible for accelerated review if administration enables it. Spotly still records every decision and can request additional evidence.</p></div></div>}
        {step === 4 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Card className="p-5"><Building2 className="h-5 w-5 text-violet" /><p className="mt-3 text-xs font-bold uppercase tracking-[.14em] text-tertiary">Business</p><p className="mt-2 text-lg font-bold">{form.name}</p><p className="mt-1 text-sm text-secondary">{form.category} · {form.city}</p></Card><Card className="p-5"><UserRound className="h-5 w-5 text-violet" /><p className="mt-3 text-xs font-bold uppercase tracking-[.14em] text-tertiary">Applicant</p><p className="mt-2 text-lg font-bold">{form.applicantName || user?.displayName || "Sign in required"}</p><p className="mt-1 text-sm text-secondary">{form.roleAtBusiness.replaceAll("_", " ")}</p></Card></div><div className="rounded-2xl bg-grouped p-5"><h3 className="font-bold">What happens after submission</h3><div className="mt-4 space-y-4">{[[1, "Spotly records the application and evidence"], [2, "A reviewer checks ownership, duplicates, and listing details"], [3, "You receive approval or a clear request for information"], [4, "Approved owners continue onboarding branches, catalogues, staff, and pickup settings"]].map(([number, text]) => <div key={number} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sm font-bold text-violet shadow-sm">{number}</span><span className="text-sm font-medium">{text}</span></div>)}</div></div>{!user && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Create or sign in to your primary email-and-password account before submission. Your progress on this page remains visible while you do so.</div>}</div>}
      </div><div className="flex flex-col-reverse gap-3 border-t bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">{step > 1 ? <Button variant="ghost" onClick={() => setStep((current) => current - 1)}><ArrowLeft className="h-4 w-4" />Back</Button> : <span />}{step < 4 ? <Button onClick={() => setStep((current) => current + 1)} disabled={step === 2 && !form.name.trim()}>Continue<ArrowRight className="h-4 w-4" /></Button> : <Button onClick={submit} loading={loading}>{user ? "Submit for verification" : "Sign in to submit"}<BadgeCheck className="h-4 w-4" /></Button>}</div></Card></div></main>;
}
