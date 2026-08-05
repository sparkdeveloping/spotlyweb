"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, FileCheck2, Search, Sparkles } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { subscribeClaims } from "@/lib/firebase-services";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";

export function NoBusinessView({ user }) {
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("invitation") || "";
  const [claims, setClaims] = useState([]);
  const [accepting, setAccepting] = useState(false);
  const { toast } = useToast();
  useEffect(() => subscribeClaims(setClaims, { applicantId: user.uid, limit: 30, onError: () => {} }), [user.uid]);
  async function acceptInvitation() {
    setAccepting(true);
    try {
      await authenticatedFetch("/api/business-invitations/accept", { method: "POST", body: JSON.stringify({ invitationId }) });
      await user.getIdToken(true);
      toast("Your business access is ready.", { title: "Invitation accepted" });
      window.setTimeout(() => window.location.assign("/business"), 650);
    } catch (error) { toast(error.message || "The invitation could not be accepted.", { type: "error", title: "Could not accept invitation" }); }
    finally { setAccepting(false); }
  }
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10"><PageHeader eyebrow="Spotly Business" title="Set up your business without starting from zero" description="Search the Zimbabwe business directory first. Confirm what Spotly already knows, correct anything inaccurate, and submit ownership verification." /><div className="mt-7 space-y-5">{invitationId && <Card className="flex flex-col gap-4 border-business/25 bg-business-soft p-5 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-business shadow-sm"><CheckCircle2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="font-bold">A business invited this account</h2><p className="mt-1 text-sm leading-6 text-secondary">Accept the invitation to create your branch-scoped team membership and open the business workspace.</p></div><Button onClick={acceptInvitation} loading={accepting}>Accept invitation</Button></Card>}<div className="grid gap-5 lg:grid-cols-[1.12fr_.88fr]"><Card className="overflow-hidden"><div className="bg-gradient-to-br from-emerald-950 via-business to-emerald-600 p-7 text-white sm:p-9"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><Building2 className="h-7 w-7" /></span><h2 className="mt-6 max-w-xl text-3xl font-black tracking-tight">Most of the setup should already be done for you.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-white/80">Spotly can begin with an existing provisional listing, branch details, category, contact information, and public sources. You verify the final 10%.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button asChild className="bg-white text-business hover:bg-white/90"><Link href="/claim"><Search className="h-4 w-4" />Find my business</Link></Button><Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20"><Link href="/claim?new=1">Add a business not listed</Link></Button></div></div><div className="grid gap-0 border-t sm:grid-cols-3">{[{ icon: Search, title: "Search first", text: "Name, city, category, phone, or social handle." }, { icon: CheckCircle2, title: "Confirm details", text: "Keep correct fields and edit only what changed." }, { icon: Sparkles, title: "Keep building", text: "Prepare branches and products while verification runs." }].map((item) => <div key={item.title} className="border-b p-5 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><item.icon className="h-5 w-5 text-business" /><h3 className="mt-3 font-bold">{item.title}</h3><p className="mt-2 text-xs leading-5 text-secondary">{item.text}</p></div>)}</div></Card><SectionCard title="Your applications" description="Every status change and request for information appears here.">{claims.length ? <div className="divide-y">{claims.map((claim) => <Link href="/claim" key={claim.id} className="flex items-center gap-4 p-5 hover:bg-grouped"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-business-soft text-business"><FileCheck2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{claim.businessName || `Application ${claim.id.slice(0, 8).toUpperCase()}`}</p><p className="mt-1 text-xs text-secondary">{claim.claimType === "new_business" ? "New business" : "Existing listing claim"}</p></div><StatusBadge status={(claim.status || "submitted").replaceAll("_", " ")} /><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div> : <EmptyState icon={FileCheck2} title="No application started" description="Search the existing directory before creating a new record. This avoids duplicates and shortens setup." action={<Button asChild size="sm"><Link href="/claim">Start business setup</Link></Button>} />}</SectionCard></div></div></div>;
}
