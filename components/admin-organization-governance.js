"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  GitBranch,
  MapPin,
  Network,
  ShieldCheck,
  Store,
  WalletCards
} from "lucide-react";
import { Badge, Button, Card, EmptyState, MetricCard, PageHeader, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";

const policyFields = [
  ["Business identity", "centrally_controlled"],
  ["Location details", "branch_suggests"],
  ["Catalogue", "branch_auto_approved"],
  ["Prices", "branch_suggests"],
  ["Inventory", "branch_controls"],
  ["Promotions", "centrally_controlled"],
  ["Opening hours", "branch_controls"],
  ["Staff invitations", "branch_suggests"],
  ["Refund authority", "centrally_controlled"],
  ["Financial visibility", "centrally_controlled"]
];

function groupOrganizations(businesses) {
  const groups = new Map();
  businesses.forEach((business) => {
    const key = business.organizationId || `standalone:${business.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: business.organizationName || business.legalName || business.parentCompanyName || (business.organizationId ? "Organization record" : `${business.name} organization`),
        ownerIds: business.ownerIds || [],
        businesses: [],
        status: business.organizationStatus || (business.organizationId ? "active" : "needs_structure")
      });
    }
    groups.get(key).businesses.push(business);
  });
  return [...groups.values()];
}

export function AdminOrganizationGovernance({ businesses = [], claims = [], tasks = [] }) {
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const organizations = useMemo(() => groupOrganizations(businesses), [businesses]);
  const visible = organizations.filter((organization) => {
    const text = [organization.name, organization.id, ...organization.businesses.map((business) => business.name)].join(" ").toLowerCase();
    const matchesFilter = filter === "all" || organization.status === filter || (filter === "needs_structure" && organization.id.startsWith("standalone:"));
    return matchesFilter && text.includes(queryText.toLowerCase());
  });
  const structured = organizations.filter((organization) => !organization.id.startsWith("standalone:")).length;
  const branchClaims = claims.filter((claim) => claim.parentApprovalRequired || claim.claimType === "location_access");
  const parentTasks = tasks.filter((task) => task.type === "parent_approval" || task.type === "ownership_conflict");

  return <div className="space-y-6"><PageHeader title="Organizations and governance" description="Legal entities, customer-facing brands, operating locations, ownership, parent approvals, delegated authority, and financial visibility." /><div className="metric-grid"><MetricCard label="Organizations" value={String(organizations.length)} hint={`${structured} with explicit organization IDs`} icon={Building2} /><MetricCard label="Business brands" value={String(businesses.length)} hint="Customer-facing identities" icon={Store} /><MetricCard label="Parent approvals" value={String(branchClaims.length)} hint="Location access or delegated authority" icon={FileCheck2} tone={branchClaims.length ? "warning" : "success"} /><MetricCard label="Ownership conflicts" value={String(parentTasks.length)} hint="Require platform intervention" icon={AlertTriangle} tone={parentTasks.length ? "danger" : "success"} /></div><div className="rounded-2xl border bg-admin-soft p-4 text-sm leading-6 text-admin"><strong>Required hierarchy:</strong> Organization → Brand → Location. A branch is never treated as an independent parent business. Location access can require both parent-company and Spotly approval.</div><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search organization, brand, or identifier" /><Tabs value={filter} onChange={setFilter} tabs={[{ value: "all", label: "All" }, { value: "active", label: "Structured" }, { value: "needs_structure", label: "Needs structure" }]} /></div><div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><SectionCard title="Organization register" description="Select an organization to inspect brands and policy inheritance"><div>{visible.map((organization) => <button key={organization.id} onClick={() => setSelected(organization)} className={`flex w-full items-center gap-4 border-b p-5 text-left transition last:border-b-0 ${selected?.id === organization.id ? "bg-admin-soft" : "hover:bg-grouped"}`}><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-admin-soft text-admin"><Network className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{organization.name}</p><StatusBadge status={organization.status.replaceAll("_", " ")} /></div><p className="mt-1 text-sm text-secondary">{organization.businesses.length} brand{organization.businesses.length === 1 ? "" : "s"} · {organization.ownerIds.length} recorded owner{organization.ownerIds.length === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-tertiary">{organization.id}</p></div><ChevronRight className="h-4 w-4 text-tertiary" /></button>)}{!visible.length && <EmptyState icon={Building2} title="No organizations match this view" description="Organization records will group brands and locations under the correct legal or controlling entity." />}</div></SectionCard><SectionCard title={selected ? selected.name : "Governance inspector"} description={selected ? "Brands, locations, and inherited operating rules" : "Choose an organization from the register"}><div className="p-5">{selected ? <><div className="space-y-3">{selected.businesses.map((business) => <Card key={business.id} className="bg-grouped p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{business.brandName || business.name}</p><p className="mt-1 text-xs text-secondary">{business.category || "Business"} · {business.city || "Zimbabwe"}</p></div><Badge tone="neutral">{business.branchCount || business.branchIds?.length || 0} locations</Badge></div><div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={business.claimStatus || "unclaimed"} /><StatusBadge status={business.verificationStatus || "unverified"} /><StatusBadge status={business.status || "provisional"} /></div></Card>)}</div><div className="mt-5 rounded-2xl bg-grouped p-4"><div className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-admin" /><p className="font-semibold">Field-level governance</p></div><p className="mt-2 text-sm leading-6 text-secondary">Each field is centrally controlled, branch-suggested, auto-approved, or branch-controlled. Edits to controlled fields create change requests.</p><Button className="mt-4 w-full" variant="outline">Open policy editor</Button></div></> : <EmptyState icon={ShieldCheck} title="Select an organization" description="The inspector will show its brands, locations, parent approvals, inherited policies, ownership, and financial visibility." />}</div></SectionCard></div><SectionCard title="Default governance policy matrix" description="A starting template; each organization can override it with effective dates"><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Operational area</th><th className="px-5 py-3">Default authority</th><th className="px-5 py-3">Branch behavior</th><th className="px-5 py-3">Audit result</th></tr></thead><tbody>{policyFields.map(([field, mode]) => <tr key={field} className="border-t"><td className="px-5 py-4 font-semibold">{field}</td><td className="px-5 py-4"><Badge tone={mode === "centrally_controlled" ? "warning" : mode === "branch_controls" ? "success" : "neutral"}>{mode.replaceAll("_", " ")}</Badge></td><td className="px-5 py-4 text-secondary">{mode === "centrally_controlled" ? "Cannot change locally" : mode === "branch_suggests" ? "Creates approval request" : mode === "branch_auto_approved" ? "Applies and records change" : "Changes immediately within scope"}</td><td className="px-5 py-4 text-secondary">{mode === "branch_controls" ? "Direct change event" : "Policy and decision trace"}</td></tr>)}</tbody></table></div></SectionCard><div className="grid gap-4 lg:grid-cols-3"><Card className="p-5"><MapPin className="h-6 w-6 text-admin" /><h3 className="mt-4 font-bold">Location access</h3><p className="mt-2 text-sm leading-6 text-secondary">A claimant requests access to a specific location while the parent organization retains brand and policy control.</p></Card><Card className="p-5"><WalletCards className="h-6 w-6 text-admin" /><h3 className="mt-4 font-bold">Financial visibility</h3><p className="mt-2 text-sm leading-6 text-secondary">Parent policy decides whether branch staff see revenue, fees, settlement totals, refunds, or payout controls.</p></Card><Card className="p-5"><CheckCircle2 className="h-6 w-6 text-admin" /><h3 className="mt-4 font-bold">Dual approval</h3><p className="mt-2 text-sm leading-6 text-secondary">Parent and Spotly decisions are recorded separately, with needs-information, delegation, rejection, and conflict outcomes.</p></Card></div></div>;
}
