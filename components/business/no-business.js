"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  WandSparkles
} from "lucide-react";
import { Button, Card, EmptyState, StatusBadge } from "@/components/ui";
import { subscribeClaims } from "@/lib/firebase-services";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

export function NoBusinessView({ user }) {
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("invitation") || "";
  const [claims, setClaims] = useState([]);
  const [accepting, setAccepting] = useState(false);
  const { toast } = useToast();
  const claimHref = spotlyPortalUrl("business", "/get-started");
  const addHref = spotlyPortalUrl("business", "/get-started?new=1");

  useEffect(() => subscribeClaims(setClaims, { applicantId: user.uid, limit: 30, onError: () => {} }), [user.uid]);

  async function acceptInvitation() {
    setAccepting(true);
    try {
      await authenticatedFetch("/api/business-invitations/accept", { method: "POST", body: JSON.stringify({ invitationId }) });
      await user.getIdToken(true);
      toast("Your business access is ready.", { title: "Invitation accepted" });
      window.setTimeout(() => window.location.assign("/"), 650);
    } catch (error) {
      toast(error.message || "The invitation could not be accepted.", { type: "error", title: "Could not accept invitation" });
    } finally { setAccepting(false); }
  }

  return <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:py-12">
    {invitationId && <Card className="mb-5 flex flex-col gap-4 border-business/25 bg-business-soft p-5 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-business shadow-sm"><CheckCircle2 className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><h2 className="font-bold">A business invited this account</h2><p className="mt-1 text-sm leading-6 text-secondary">Accept to open only the business and locations your team assigned to you.</p></div>
      <Button onClick={acceptInvitation} loading={accepting}>Accept invitation</Button>
    </Card>}

    <section className="overflow-hidden rounded-2xl border bg-[var(--surface)]">
      <div className="grid lg:grid-cols-[1.05fr_.95fr]">
        <div className="p-7 sm:p-9 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-business-soft px-3 py-1.5 text-xs font-bold text-business"><Sparkles className="h-4 w-4" />Start from what Spotly already knows</div>
          <h1 className="mt-5 max-w-2xl text-3xl font-bold tracking-[-.04em] sm:text-4xl">Find your business before you build it again.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-secondary">Search the Zimbabwe business directory first. If Spotly already has the name, category or location, keep the useful parts and verify what is yours.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg"><Link href={claimHref}><Search className="h-5 w-5" />Find my business</Link></Button><Button asChild size="lg" variant="outline"><Link href={addHref}>My business is not listed</Link></Button></div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-secondary"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Keep existing public details</span><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Correct what changed</span><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Prepare while we verify</span></div>
        </div>
        <div className="relative min-h-[330px] overflow-hidden bg-[#071b13] p-6 text-white sm:p-8">
          <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl" aria-hidden="true" />
          <p className="relative text-xs font-bold uppercase tracking-[.14em] text-emerald-300">Example: we found your listing</p>
          <div className="relative mt-5 rounded-2xl bg-[var(--surface)] p-5 text-[var(--text)] shadow-elevated">
            <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><Store className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="font-bold">Your business name</p><p className="mt-1 text-sm text-secondary">Retail · Harare</p></div><span className="rounded-full bg-grouped px-2.5 py-1 text-[11px] font-bold text-secondary">Listed</span></div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-tertiary">Name</p><p className="mt-1 font-semibold">Already known</p></div><div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-tertiary">Location</p><p className="mt-1 font-semibold">Already known</p></div><div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-tertiary">Category</p><p className="mt-1 font-semibold">Confirm</p></div><div className="rounded-xl bg-business-soft p-3"><p className="text-business">Ownership</p><p className="mt-1 font-semibold">Verify you</p></div></div>
          </div>
          <p className="relative mt-5 text-sm leading-6 text-white/65">You should spend your time confirming the business and setting up what customers can do — not retyping information Spotly already has.</p>
        </div>
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-3">
      {[{ icon: Search, title: "1. Search first", text: "Use the business name, city, category, phone or another recognizable detail." }, { icon: ShieldCheck, title: "2. Confirm authority", text: "Tell Spotly who you are and provide proof that protects the business from unauthorized changes." }, { icon: WandSparkles, title: "3. Start preparing", text: "Set up customer-facing details and offerings while ownership verification is underway." }].map((item) => <Card key={item.title} className="p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-business-soft text-business"><item.icon className="h-5 w-5" /></span><h2 className="mt-5 text-lg font-bold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-secondary">{item.text}</p></Card>)}
    </section>

    <section className="mt-6 overflow-hidden rounded-2xl border bg-[var(--surface)]">
      <div className="border-b px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-business-soft text-business"><FileCheck2 className="h-4 w-4" /></span><div><h2 className="font-bold">Your applications</h2><p className="mt-0.5 text-sm text-secondary">Ownership reviews, requests for information and approved access stay visible here.</p></div></div></div>
      {claims.length ? <div className="divide-y">{claims.map((claim) => <Link href={spotlyPortalUrl("business", "/claim-status/" + claim.id)} key={claim.id} className="flex items-center gap-4 p-5 transition hover:bg-grouped sm:px-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-business-soft text-business"><Building2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{claim.businessName || `Application ${claim.id.slice(0, 8).toUpperCase()}`}</p><p className="mt-1 text-xs text-secondary">{claim.claimType === "new_business" ? "New business" : "Existing listing claim"}</p></div><StatusBadge status={(claim.status || "submitted").replaceAll("_", " ")} /><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div> : <EmptyState icon={FileCheck2} title="No business application yet" description="Start with search. If the business is already listed, claiming it is usually faster than creating a duplicate." action={<Button asChild size="sm"><Link href={claimHref}>Find my business</Link></Button>} />}
    </section>
  </div>;
}
