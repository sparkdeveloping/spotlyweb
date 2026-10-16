"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  KeyRound,
  MailCheck,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Store,
  UserRoundCheck
} from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, SearchField, StatusBadge } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";
import { NotificationCenter } from "@/components/notification-center";
import { businessHref } from "@/lib/business-routing";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

export const businessAccountNavigation = [
  { id: "portfolio", label: "Portfolio", icon: Building2, href: "/" },
  { id: "notifications", label: "Notifications", icon: Bell, href: "/notifications" },
  { id: "claims", label: "Claims & applications", icon: FileCheck2, href: "/claims" },
  { id: "invitations", label: "Invitations", icon: MailCheck, href: "/invitations" },
  { id: "access", label: "Your access", icon: KeyRound, href: "/access" }
];

function formatDate(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function humanStatus(value = "") {
  return String(value || "").replaceAll("_", " ");
}

function claimStatusLabel(value = "") {
  const current = String(value || "").toLowerCase();
  if (["submitted", "under_review", "parent_approval_required", "claim_pending", "claimed_pending_verification", "pending"].includes(current)) return "Waiting on Spotly";
  if (["information_requested", "changes_requested", "claim_needs_information", "needs_information"].includes(current)) return "Your action";
  if (["approved", "claimed", "verified"].includes(current)) return "Business access approved";
  if (["rejected", "declined"].includes(current)) return "Business access rejected";
  if (current === "draft") return "Draft";
  if (["closed", "withdrawn"].includes(current)) return "Closed";
  return humanStatus(current || "submitted");
}

function scopeLabel(item) {
  if (item.businessWide) return "All locations";
  const count = item.branchIds?.length || item.accessibleLocationCount || 0;
  return count ? `${count} assigned ${count === 1 ? "location" : "locations"}` : "Business access";
}

function PortfolioBusinessCard({ item }) {
  const openHref = item.defaultHref || businessHref("/launch", { businessId: item.id });
  const live = item.lifecycleStage === "live";
  const waiting = item.lifecycleStage === "review";
  return <Card variant="bordered" className="group flex h-full flex-col p-5">
    <div className="flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-business-soft text-business">
        {item.logo ? <Image unoptimized src={item.logo} alt="" width={48} height={48} className="h-full w-full object-cover" /> : <Store className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold">{item.name}</h2><Badge tone={live ? "success" : waiting ? "info" : "accent"}>{item.lifecycleLabel || (live ? "Live" : "Preparing")}</Badge></div>
        <p className="mt-1 text-sm text-secondary">{item.roleLabel} · {scopeLabel(item)}</p>
        {(item.organizationName || item.city) && <p className="mt-1 truncate text-xs text-tertiary">{[item.organizationName, item.city].filter(Boolean).join(" · ")}</p>}
      </div>
    </div>
    {!live && <div className="mt-5"><div className="flex items-center justify-between text-xs"><span className="font-semibold">Your launch setup</span><span className="text-secondary">{item.merchantProgress || 0}%</span></div><ProgressBar value={item.merchantProgress || 0} label={`${item.name} launch setup progress`} className="mt-2" /></div>}
    <div className="mt-5 flex-1 space-y-2">
      {item.attention?.length ? item.attention.slice(0, 2).map((attention) => <Link key={attention.href} href={attention.href} className="flex items-start gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-sm hover:bg-[var(--surface-hover)]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span className="min-w-0 flex-1">{attention.label}</span><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" /></Link>) : <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${live ? "bg-[var(--success-soft)] text-[var(--on-success-soft)]" : waiting ? "bg-[var(--info-soft)] text-[var(--on-info-soft)]" : "bg-[var(--surface-2)] text-secondary"}`}><Check className="h-4 w-4" />{live ? "No account-level issue" : waiting ? "No action needed while Spotly reviews" : "Continue from the launch checklist"}</div>}
    </div>
    <Button asChild variant={live ? "primary" : "outline"} className="mt-5 w-full"><Link href={openHref}>{item.lifecycleActionLabel || (live ? "Open business" : "Continue preparation")}<ArrowRight className="h-4 w-4" /></Link></Button>
  </Card>;
}

function AccountActions() {
  return <div className="grid gap-3 sm:grid-cols-3">
    <Button asChild><Link href={spotlyPortalUrl("customer", "/claim")}><Search className="h-4 w-4" />Claim existing business</Link></Button>
    <Button asChild variant="outline"><Link href={spotlyPortalUrl("customer", "/claim?new=1")}><Plus className="h-4 w-4" />Add business not listed</Link></Button>
    <Button asChild variant="outline"><Link href="/invitations"><MailCheck className="h-4 w-4" />Review invitations</Link></Button>
  </div>;
}

function PortfolioView({ data, search, setSearch }) {
  const businesses = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data.businesses || [];
    return (data.businesses || []).filter((item) => `${item.name} ${item.organizationName || ""} ${item.city || ""} ${item.roleLabel || ""}`.toLowerCase().includes(needle));
  }, [data.businesses, search]);

  return <div className="space-y-6">
    <PageHeader eyebrow="Spotly Business" title="Your business portfolio" description="Every business, claim, invitation, and access relationship attached to this account lives here. Open a business only when you need its day-to-day tools." />
    <AccountActions />
    {(data.attention || []).length > 0 && <Card variant="bordered" className="overflow-hidden"><div className="border-b p-5"><h2 className="text-lg font-semibold">Needs your attention</h2><p className="mt-1 text-sm text-secondary">The most important cross-business actions, not another metrics dashboard.</p></div><div className="divide-y">{data.attention.slice(0, 12).map((item) => <Link href={item.href} key={item.id} className="flex items-center gap-4 p-4 hover:bg-[var(--surface-2)]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-warning"><CircleAlert className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.businessName || "Spotly Business"}</span><span className="mt-1 block text-sm text-secondary">{item.title}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div></Card>}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold">Your businesses</h2><p className="mt-1 text-sm text-secondary">Own, manage, or operate each business from the access assigned to you.</p></div>{(data.businesses || []).length > 4 && <div className="w-full sm:max-w-sm"><SearchField value={search} onChange={setSearch} placeholder="Search businesses, organization, role…" /></div>}</div>
    {businesses.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{businesses.map((item) => <PortfolioBusinessCard key={item.id} item={item} />)}</div> : <EmptyState icon={Building2} title={search ? "No businesses match your search" : "No active business access yet"} description={search ? "Try another business name, organization, city, or role." : "Claims and invitations stay available here while Spotly verifies your first business."} action={!search && <Button asChild><Link href={spotlyPortalUrl("customer", "/claim")}>Start a business claim</Link></Button>} />}
    {(data.claims || []).length > 0 && <Card variant="bordered" className="overflow-hidden"><div className="flex items-center justify-between gap-4 border-b p-5"><div><h2 className="font-semibold">Business access applications</h2><p className="mt-1 text-sm text-secondary">Claims stay visible even after access to other businesses is approved.</p></div><Button asChild variant="outline" size="sm"><Link href="/claims">View all</Link></Button></div><div className="divide-y">{data.claims.slice(0, 4).map((claim) => <Link key={claim.id} href={spotlyPortalUrl("customer", `/claim/status/${claim.id}`)} className="flex items-center gap-4 p-4 hover:bg-[var(--surface-2)]"><FileCheck2 className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{claim.businessName}</span><span className="mt-1 block text-xs text-secondary">Updated {formatDate(claim.updatedAt)}</span></span><StatusBadge status={claimStatusLabel(claim.status)} /><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div></Card>}
  </div>;
}


function BusinessNotificationsView({ data }) {
  const businessOptions = (data.businesses || []).map((item) => ({ id: item.id, name: item.name }));
  return <NotificationCenter
    workspace="business"
    title="Business notifications"
    description="Reviews, location decisions, orders, Money and support activity across every business this account can access."
    businessOptions={businessOptions}
    showModuleFilters
  />;
}

function ClaimsView({ data }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const claims = useMemo(() => (data.claims || []).filter((item) => {
    const statusMatch = filter === "all" || (filter === "needs_action" && item.needsAction) || (filter === "drafts" && item.status === "draft") || (filter === "review" && ["submitted", "under_review", "parent_approval_required", "claim_pending", "claimed_pending_verification", "pending"].includes(item.status)) || (filter === "approved" && item.status === "approved") || (filter === "closed" && item.closed);
    const queryMatch = !query.trim() || `${item.businessName} ${item.id} ${item.claimType}`.toLowerCase().includes(query.trim().toLowerCase());
    return statusMatch && queryMatch;
  }), [data.claims, filter, query]);
  const filters = [{ id: "all", label: "All" }, { id: "needs_action", label: "Needs action" }, { id: "drafts", label: "Drafts" }, { id: "review", label: "Waiting on Spotly" }, { id: "approved", label: "Access approved" }, { id: "closed", label: "Closed" }];
  return <div className="space-y-6"><PageHeader eyebrow="Business account" title="Claims & applications" description="Track every business you are claiming, correcting, or requesting access to—even while you already manage other businesses." action={<Button asChild><Link href={spotlyPortalUrl("customer", "/claim")}><Plus className="h-4 w-4" />Start a claim</Link></Button>} /><Card variant="bordered" className="p-4"><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={query} onChange={setQuery} placeholder="Search business or claim reference" /><div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${filter === item.id ? "border-business bg-business-soft text-[var(--on-business-soft)]" : "hover:bg-[var(--surface-2)]"}`}>{item.label}</button>)}</div></div></Card>{claims.length ? <div className="space-y-3">{claims.map((claim) => <Card key={claim.id} variant="bordered" className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><FileCheck2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{claim.businessName}</h2><StatusBadge status={claimStatusLabel(claim.status)} /></div><p className="mt-1 text-sm text-secondary">{humanStatus(claim.claimType)} · Updated {formatDate(claim.updatedAt)}</p>{claim.nextAction && <p className="mt-2 text-sm text-warning">{claim.nextAction}</p>}</div><Button asChild variant={claim.needsAction ? "primary" : "outline"}><Link href={spotlyPortalUrl("customer", `/claim/status/${claim.id}`)}>{claim.needsAction ? "Review required action" : "View status"}<ArrowRight className="h-4 w-4" /></Link></Button></div></Card>)}</div> : <EmptyState icon={FileCheck2} title="No claims in this view" description="Claims never disappear just because another business is already active." />}</div>;
}

function InvitationsView({ data, refresh }) {
  const [busy, setBusy] = useState("");
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const highlighted = searchParams.get("invitation") || "";
  async function act(id, action) {
    setBusy(`${action}:${id}`);
    try {
      await authenticatedFetch(`/api/business-invitations/${action}`, { method: "POST", body: JSON.stringify({ invitationId: id }) });
      toast(action === "accept" ? "Business access added." : "Invitation declined.", { title: action === "accept" ? "Invitation accepted" : "Invitation updated" });
      await refresh();
    } catch (error) { toast(error.message, { type: "error", title: "Could not update invitation" }); }
    finally { setBusy(""); }
  }
  return <div className="space-y-6"><PageHeader eyebrow="Business account" title="Invitations" description="Review every business and location that has invited this account. Access grants remain server-controlled." />{(data.invitations || []).length ? <div className="space-y-3">{data.invitations.map((item) => <Card key={item.id} variant="bordered" className={`p-5 ${highlighted === item.id ? "ring-2 ring-business/30" : ""}`}><div className="flex flex-col gap-5 lg:flex-row lg:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><MailCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="font-semibold">{item.businessName}</h2><p className="mt-1 text-sm text-secondary">{item.roleLabel}{item.branchIds?.length ? ` · ${item.branchIds.length} assigned ${item.branchIds.length === 1 ? "location" : "locations"}` : " · Business-wide or role-defined access"}</p><p className="mt-2 text-xs text-tertiary">Received {formatDate(item.createdAt)}{item.expiresAt ? ` · Expires ${formatDate(item.expiresAt)}` : ""}</p></div><div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => act(item.id, "accept")} loading={busy === `accept:${item.id}`}>Accept</Button><Button variant="outline" onClick={() => act(item.id, "decline")} loading={busy === `decline:${item.id}`}>Decline</Button></div></div></Card>)}</div> : <EmptyState icon={MailCheck} title="No pending invitations" description="New business and location invitations will always be available here." />}</div>;
}

function AccessView({ data }) {
  return <div className="space-y-6"><PageHeader eyebrow="Business account" title="Your access" description="Understand exactly which businesses and locations this account can operate. Team management remains inside each business." />{(data.businesses || []).length ? <div className="space-y-3">{data.businesses.map((item) => <Card key={item.id} variant="bordered" className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><ShieldCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.name}</h2><Badge tone={item.businessWide ? "success" : "neutral"}>{item.roleLabel}</Badge></div><p className="mt-1 text-sm text-secondary">{item.businessWide ? "All business locations" : scopeLabel(item)}{item.organizationName ? ` · ${item.organizationName}` : ""}</p><p className="mt-2 text-xs leading-5 text-tertiary">{item.permissions?.length ? `${item.permissions.length} effective permission ${item.permissions.length === 1 ? "grant" : "grants"}. Business-specific Team controls determine who else can access this business.` : "Access is defined by your assigned business role."}</p></div><Button asChild variant="outline"><Link href={item.defaultHref || businessHref("/launch", { businessId: item.id })}>{item.lifecycleActionLabel || "Open business"}</Link></Button></div></Card>)}</div> : <EmptyState icon={UserRoundCheck} title="No active business access" description="Approved claims and accepted invitations will appear here." />}</div>;
}

function BusinessAccountContent({ section }) {
  const [data, setData] = useState({ businesses: [], claims: [], invitations: [], attention: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await authenticatedFetch("/api/business/portfolio"); setData({ businesses: result.businesses || [], claims: result.claims || [], invitations: result.invitations || [], attention: result.attention || [] }); }
    catch (reason) { setError(reason.message || "Your business portfolio could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  if (loading) return <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><div className="surface min-h-72 animate-pulse rounded-2xl" /></div>;
  if (error) return <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8"><Card variant="bordered" className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><CircleAlert className="h-8 w-8 text-danger" /><h1 className="mt-4 text-xl font-semibold">Your business account could not load</h1><p className="mt-2 max-w-lg text-sm leading-6 text-secondary">{error}</p><Button className="mt-5" onClick={refresh}>Try again</Button></Card></div>;
  const View = section === "notifications" ? BusinessNotificationsView : section === "claims" ? ClaimsView : section === "invitations" ? InvitationsView : section === "access" ? AccessView : PortfolioView;
  return <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><View data={data} refresh={refresh} search={search} setSearch={setSearch} /></div>;
}

export function BusinessAccount({ section = "portfolio" }) {
  return <BusinessAccountContent section={section} />;
}
