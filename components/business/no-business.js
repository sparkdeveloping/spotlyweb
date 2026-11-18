"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, FileCheck2, Search, ShieldCheck } from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/ui";
import { subscribeClaims } from "@/lib/firebase-services";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

export function NoBusinessView({ user }) {
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("invitation") || "";
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const { toast } = useToast();
  const startHref = spotlyPortalUrl("business", "/get-started");

  useEffect(() => {
    setClaimsLoading(true);
    setClaimsError(false);
    return subscribeClaims((records) => { setClaims(records); setClaimsLoading(false); }, {
      applicantId: user.uid,
      limit: 30,
      onError: () => { setClaimsLoading(false); setClaimsError(true); }
    });
  }, [user.uid, reloadKey]);

  async function acceptInvitation() {
    setAccepting(true);
    try {
      await authenticatedFetch("/api/business-invitations/accept", { method: "POST", body: JSON.stringify({ invitationId }) });
      await user.getIdToken(true);
      toast("Your business access is ready.", { title: "Invitation accepted" });
      window.setTimeout(() => window.location.assign("/"), 650);
    } catch (error) {
      toast("The invitation couldn't be accepted just now. Try again, or ask the business to resend it.", { type: "error", title: "Could not accept invitation" });
    } finally { setAccepting(false); }
  }

  return <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
    {invitationId && <Card className="mb-6 flex flex-col gap-4 border-business/25 bg-business-soft p-5 sm:flex-row sm:items-center">
      <ShieldCheck className="h-6 w-6 shrink-0 text-business" />
      <div className="min-w-0 flex-1"><h2 className="font-semibold">You have a business invitation</h2><p className="mt-1 text-sm leading-6 text-secondary">Accept to access only the business and locations your team has assigned.</p></div>
      <Button onClick={acceptInvitation} loading={accepting}>Accept invitation</Button>
    </Card>}

    <section className="rounded-3xl border bg-[var(--surface)] px-6 py-12 sm:px-12 sm:py-16">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-business-soft text-business"><Building2 className="h-7 w-7" /></span>
      <h1 className="mt-8 max-w-xl text-4xl font-semibold tracking-[-.05em] sm:text-5xl">Your business starts here.</h1>
      <p className="mt-5 max-w-lg text-base leading-8 text-secondary">Tell Spotly about your business first. You can continue with ownership verification when you are ready. Your business remains inactive until the required approvals are complete.</p>
      <div className="mt-8"><Button asChild size="lg"><Link href={startHref}><Search className="h-5 w-5" />Get started<ArrowRight className="h-5 w-5" /></Link></Button></div>
      <p className="mt-5 max-w-lg text-sm leading-6 text-secondary">Already have an application? You can resume it below, or continue verification directly. Nothing goes live before the required checks are complete.</p>
    </section>

    <section className="mt-8 overflow-hidden rounded-3xl border bg-[var(--surface)]">
      <div className="flex items-center gap-3 border-b px-5 py-5 sm:px-7"><FileCheck2 className="h-5 w-5 text-business" /><div><h2 className="font-semibold">Your requests</h2><p className="mt-1 text-sm text-secondary">Follow verification and any additional information needed.</p></div></div>
      {claimsError ? <div role="alert" className="px-6 py-8"><p className="text-sm font-medium">We couldn't load your applications.</p><p className="mt-2 text-sm text-secondary">Your requests are still saved. Please reconnect and try again.</p><Button className="mt-4" size="sm" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>Retry</Button></div> : claimsLoading ? <div role="status" className="px-6 py-8 text-sm text-secondary">Loading your applications…</div> : claims.length ? <div className="divide-y">{claims.map((claim) => <Link href={spotlyPortalUrl("business", "/claim-status/" + claim.id)} key={claim.id} className="flex items-center gap-4 p-5 transition hover:bg-grouped sm:px-7"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><Building2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{claim.businessName || `Application ${claim.id.slice(0, 8).toUpperCase()}`}</p><p className="mt-1 text-xs text-secondary">{claim.claimType === "new_business" ? "New business" : "Existing listing"}</p></div><StatusBadge status={(claim.status || "submitted").replaceAll("_", " ")} /><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div> : <div className="px-6 py-8 text-sm text-secondary">No applications yet. When you send one, its status will appear here.</div>}
    </section>
  </main>;
}
