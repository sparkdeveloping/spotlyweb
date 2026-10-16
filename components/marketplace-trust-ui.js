"use client";
import Link from "next/link";
import { BadgeCheck, CircleCheck, Info, ShieldCheck, Store, UserRoundCheck } from "lucide-react";
import { Badge, Button } from "@/components/ui";

const STATES = {
  listed: { label: "Listed on Spotly", tone: "neutral", icon: Store, detail: "Spotly has a discovery listing for this business. The business has not claimed this profile yet." },
  claim_pending: { label: "Claim pending", tone: "warning", icon: UserRoundCheck, detail: "Someone has asked to manage this business. Spotly is verifying their authority before business controls are unlocked." },
  claimed: { label: "Owner claimed", tone: "info", icon: UserRoundCheck, detail: "The business controls its Spotly profile. Commerce features can remain unavailable until operational verification is complete." },
  verified: { label: "Spotly verified", tone: "success", icon: BadgeCheck, detail: "Spotly has verified this business or its ownership details." },
  commerce_verified: { label: "Commerce verified", tone: "success", icon: ShieldCheck, detail: "Spotly has enabled merchant-operated commerce features for this business." },
};

function stateFor(business = {}) {
  if (business.commerceVerified === true) return "commerce_verified";
  return STATES[business.trustState] ? business.trustState : (["approved", "verified"].includes(business.verificationStatus) ? "verified" : "listed");
}

export function MarketplaceTrustBadge({ business, compact = false }) {
  const state = stateFor(business); const meta = STATES[state]; const Icon = meta.icon;
  return <Badge tone={meta.tone}><Icon className="mr-1 h-3.5 w-3.5" />{compact && state === "commerce_verified" ? "Verified" : meta.label}</Badge>;
}

export function MarketplaceTrustNotice({ business, className = "" }) {
  if (!business) return null;
  const state = stateFor(business); const meta = STATES[state]; const unclaimed = state === "listed"; const source = business.source || {};
  return <div className={`rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 sm:p-5 ${className}`}>
    <div className="flex gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--accent)]"><Info className="h-4.5 w-4.5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{meta.label}</p>{business.commerceVerified === true ? <Badge tone="success"><CircleCheck className="mr-1 h-3.5 w-3.5" />Ordering enabled</Badge> : <Badge tone="neutral">Discovery only</Badge>}</div><p className="mt-1 text-sm leading-6 text-secondary">{meta.detail}{!business.commerceVerified ? " Spotly does not show merchant pickup, live stock, cash or booking controls until commerce verification is complete." : ""}</p>{source.type === "openstreetmap" ? <p className="mt-2 text-xs leading-5 text-tertiary">Listing data: <a className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline" href={source.url || "https://www.openstreetmap.org/copyright"} target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · ODbL 1.0.</p> : null}{unclaimed && business.discoveryCapabilities?.claim !== false ? <div className="mt-4"><Button asChild size="sm" variant="outline"><Link href={`/claim?business=${encodeURIComponent(business.id)}`}>Own this business? Claim it</Link></Button></div> : null}</div></div>
  </div>;
}
