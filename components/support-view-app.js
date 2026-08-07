"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Building2, Clock3, FileCheck2, Package, ReceiptText, ShieldCheck, Store } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, Card, EmptyState, MetricCard, SectionCard, StatusBadge } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";

export function SupportViewApp({ businessId }) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const roles = profile?.roles || [];
  const allowed = roles.some((role) => ["super_admin", "admin", "platform_admin", "operations_manager", "support_manager", "support_agent", "business_success_manager"].includes(role));

  async function openView(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await authenticatedFetch("/api/admin/support-view", { method: "POST", body: JSON.stringify({ businessId, reason }) });
      setContext(result);
      toast("The audited 30-minute support view is open.", { title: "Support view opened" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not open support view" });
    } finally {
      setLoading(false);
    }
  }

  return <AuthGate portal="admin" title="Sign in to Spotly Admin"><main className="min-h-screen bg-grouped text-ink">
    <header className="border-b bg-[var(--surface)]"><div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"><Link href="/admin/businesses" className="inline-flex items-center gap-2 text-sm font-bold text-admin"><ArrowLeft className="h-4 w-4" />Back to businesses</Link><Badge tone="warning"><ShieldCheck className="h-3.5 w-3.5" />Audited administrator view</Badge></div></header>
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {!allowed ? <Card elevated className="mx-auto max-w-xl p-8"><EmptyState icon={ShieldCheck} title="This role cannot open support view" description="A super administrator can grant a support or operations role from People & access." /></Card> : !context ? <Card elevated className="mx-auto max-w-2xl p-7"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-admin-soft text-admin"><Building2 className="h-7 w-7" /></span><h1 className="mt-6 text-3xl font-semibold tracking-[-.04em]">Open business support view</h1><p className="mt-3 leading-7 text-secondary">This provides a read-only operational snapshot without impersonating the owner. The business, administrator, reason, and timestamp are written to the audit log.</p><div className="mt-5 rounded-2xl border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--on-warning-soft)]"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>Use only for a legitimate support, verification, or operational task. Do not copy sensitive information outside approved Spotly systems.</p></div></div><form onSubmit={openView} className="mt-6"><label className="block"><span className="mb-2 block text-sm font-bold">Reason for access</span><textarea required minLength={8} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="surface min-h-28 w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-admin/20" placeholder="Example: Investigating branch catalogue setup reported in support conversation…" /></label><Button type="submit" loading={loading} className="mt-4 w-full">Open audited support view</Button></form></Card> : <div className="space-y-6">
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-[var(--on-warning-soft)]"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><ShieldCheck className="h-5 w-5 shrink-0" /><div className="min-w-0 flex-1"><p className="font-bold">Support view active — read only</p><p className="mt-1 text-sm">Reason: {context.session.reason}</p></div><div className="flex items-center gap-2 text-xs font-bold"><Clock3 className="h-4 w-4" />Expires {new Date(context.session.expiresAt).toLocaleTimeString()}</div></div></div>
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-admin">Business support context</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.045em]">{context.business.name}</h1><p className="mt-2 text-secondary">{context.business.category} · {context.business.city || "Zimbabwe"} · {user?.email}</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Branches" value={context.branches.length} icon={Store} /><MetricCard label="Products" value={context.products.length} icon={Package} /><MetricCard label="Orders loaded" value={context.orders.length} icon={ReceiptText} /><MetricCard label="Claims" value={context.claims.length} icon={FileCheck2} /></div>
        <div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Business record"><div className="grid gap-3 p-5 text-sm">{[["Status", context.business.status], ["Claim", context.business.claimStatus], ["Verification", context.business.verificationStatus], ["Public", context.business.public ? "Yes" : "No"], ["Organization", context.business.organizationId || "Not assigned"]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 rounded-xl bg-grouped p-3"><span className="text-secondary">{label}</span><span className="font-bold">{value || "Not configured"}</span></div>)}</div></SectionCard><SectionCard title="Finance preferences"><div className="grid gap-3 p-5 text-sm">{context.finance ? [["Currencies", context.finance.acceptedCurrencies?.join(", ")], ["Methods", context.finance.paymentMethods?.join(", ")], ["Recipient", context.finance.paymentRecipient], ["Payout cadence", context.finance.payoutCadence]].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 rounded-xl bg-grouped p-3"><span className="text-secondary">{label}</span><span className="max-w-[65%] text-right font-bold">{value || "Not configured"}</span></div>) : <EmptyState icon={ReceiptText} title="Finance settings not completed" description="Guide the owner to Business → Finance, or ask an authorized finance administrator to configure defaults." />}</div></SectionCard></div>
        <SectionCard title="Recent order context" description="Sensitive payment credentials are not exposed in support view."><div className="divide-y">{context.orders.length ? context.orders.slice(0, 12).map((order) => <div key={order.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-bold">{order.number || order.id}</p><p className="mt-1 text-xs text-secondary">{order.customerName || order.customerEmail || "Customer"} · {order.branchName || "Branch"}</p></div><StatusBadge status={(order.status || "unknown").replaceAll("_", " ")} /><p className="text-sm font-semibold">{formatCurrency(order.totals?.total || 0, order.currency || "USD")}</p></div>) : <EmptyState icon={ReceiptText} title="No orders in this business" description="This can be expected before the private grocery-pickup pilot begins." />}</div></SectionCard>
      </div>}
    </div>
  </main></AuthGate>;
}
