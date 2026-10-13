"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgePercent, CalendarDays, Check, Gift, Plus, Store, Trash2, XCircle } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { Badge, Button, Card, EmptyState, Modal, SectionCard, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/providers";

const emptyCampaign = {
  name: "",
  description: "",
  code: "",
  type: "percentage",
  value: 10,
  currency: "USD",
  minimumSpend: 0,
  usageLimit: 0,
  audience: "all_customers",
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: "",
  businessIds: [],
  active: true
};

function money(value, currency) {
  try { return new Intl.NumberFormat("en-ZW", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `${currency || "USD"} ${Number(value || 0).toFixed(2)}`; }
}

export function AdminGrowthCampaigns({ businesses = [] }) {
  const [campaigns, setCampaigns] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCampaign);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const [campaignResponse, rewardResponse] = await Promise.all([
        authenticatedFetch("/api/admin/growth/promotions"),
        authenticatedFetch("/api/admin/growth/referrals")
      ]);
      setCampaigns(campaignResponse.promotions || []);
      setRewards(rewardResponse.rewards || []);
    } catch (error) {
      toast(error.message || "Spotly campaigns could not be loaded.", { type: "error", title: "Campaigns unavailable" });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const businessMap = useMemo(() => new Map(businesses.map((business) => [business.id, business])), [businesses]);

  function edit(campaign = null) {
    setEditing(campaign);
    setForm(campaign ? { ...emptyCampaign, ...campaign, businessIds: campaign.businessIds || [] } : { ...emptyCampaign });
    setOpen(true);
  }

  function toggleBusiness(id) {
    setForm((current) => ({ ...current, businessIds: current.businessIds.includes(id) ? current.businessIds.filter((value) => value !== id) : [...current.businessIds, id] }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await authenticatedFetch("/api/admin/growth/promotions", { method: "POST", body: JSON.stringify({ ...form, id: editing?.id || "", value: Number(form.value || 0), minimumSpend: Number(form.minimumSpend || 0), usageLimit: Number(form.usageLimit || 0) }) });
      toast(editing ? "Spotly campaign updated." : "Spotly campaign created.", { title: "Growth campaign saved" });
      setOpen(false);
      await load();
    } catch (error) {
      toast(error.message || "The campaign could not be saved.", { type: "error", title: "Could not save campaign" });
    } finally { setBusy(false); }
  }

  async function remove(campaign) {
    if (!window.confirm(`Delete “${campaign.name}”? Existing order records will keep their applied discount.`)) return;
    setBusy(true);
    try {
      await authenticatedFetch("/api/admin/growth/promotions", { method: "DELETE", body: JSON.stringify({ id: campaign.id }) });
      toast("Spotly campaign deleted.");
      await load();
    } catch (error) {
      toast(error.message || "The campaign could not be deleted.", { type: "error", title: "Could not delete campaign" });
    } finally { setBusy(false); }
  }

  async function reviewReward(reward, action) {
    setBusy(true);
    try {
      await authenticatedFetch("/api/admin/growth/referrals", { method: "POST", body: JSON.stringify({ id: reward.id, action }) });
      toast(action === "approve" ? "Referral reward approved." : "Referral reward rejected.", { title: "Reward reviewed" });
      await load();
    } catch (error) {
      toast(error.message || "The referral reward could not be reviewed.", { type: "error", title: "Could not review reward" });
    } finally { setBusy(false); }
  }

  if (loading) return <SectionCard title="Spotly campaigns" description="Platform-wide offers controlled by Spotly."><div className="p-8 text-sm text-secondary">Loading campaigns…</div></SectionCard>;

  return <>
    <SectionCard title="Spotly campaigns" description="Run platform-funded offers across every eligible merchant or a selected set of businesses.">
      <div className="border-b p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm leading-6 text-secondary">Campaigns are revalidated on the server at checkout. Usage limits and discounts are reserved atomically with the customer transaction.</p><Button onClick={() => edit()}><Plus className="h-4 w-4" />New Spotly campaign</Button></div></div>
      {campaigns.length ? <div className="grid gap-4 p-5 lg:grid-cols-2">{campaigns.map((campaign) => <Card key={campaign.id} className="p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-admin-soft text-admin"><BadgePercent className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{campaign.name}</h3><StatusBadge status={campaign.active ? "Active" : "Paused"} /></div><p className="mt-1 text-sm text-secondary">{campaign.type === "percentage" ? `${campaign.value}% off` : `${money(campaign.value, campaign.currency)} off`}{campaign.minimumSpend ? ` · ${money(campaign.minimumSpend, campaign.currency)} minimum` : ""}</p></div></div>{campaign.description ? <p className="mt-4 text-sm leading-6">{campaign.description}</p> : null}<div className="mt-4 flex flex-wrap gap-2">{campaign.code ? <Badge tone="accent">{campaign.code}</Badge> : <Badge tone="success">Automatic</Badge>}<Badge><CalendarDays className="h-3 w-3" />{campaign.startsAt || "Now"}{campaign.endsAt ? ` – ${campaign.endsAt}` : " onward"}</Badge><Badge><Store className="h-3 w-3" />{campaign.businessIds?.length ? `${campaign.businessIds.length} selected businesses` : "All businesses"}</Badge><Badge>{campaign.usedCount || 0}{campaign.usageLimit ? ` / ${campaign.usageLimit}` : " uses"}</Badge></div><div className="mt-5 flex gap-2 border-t pt-4"><Button size="sm" variant="outline" onClick={() => edit(campaign)}>Edit</Button><Button size="sm" variant="ghost" className="ml-auto text-danger" disabled={busy} onClick={() => remove(campaign)}><Trash2 className="h-4 w-4" />Delete</Button></div></Card>)}</div> : <EmptyState icon={BadgePercent} title="No Spotly-funded campaigns yet" description="Merchant promotions can already be managed in each Business workspace. Create a platform campaign only when Spotly is funding or coordinating the offer." action={<Button onClick={() => edit()}><Plus className="h-4 w-4" />Create campaign</Button>} />}
    </SectionCard>

    <SectionCard title="Referral reward review" description="Review referral rewards when automatic approval is disabled in Platform configuration.">
      {rewards.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Reward</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{rewards.map((reward) => <tr key={reward.id} className="border-t"><td className="px-5 py-4"><div className="flex items-center gap-2"><Gift className="h-4 w-4 text-admin" /><div><p className="font-semibold">{reward.role === "referrer" ? "Inviter reward" : "New customer reward"}</p><p className="mt-1 text-xs text-tertiary">{reward.orderId ? `Order ${reward.orderId.slice(-8).toUpperCase()}` : "Qualified referral"}</p></div></div></td><td className="px-5 py-4 font-mono text-xs text-secondary">…{String(reward.userId || "").slice(-8)}</td><td className="px-5 py-4 font-semibold">{money(reward.amount, reward.currency)}</td><td className="px-5 py-4"><StatusBadge status={String(reward.status || "pending_review").replaceAll("_", " ")} /></td><td className="px-5 py-4"><div className="flex justify-end gap-2">{reward.status === "pending_review" ? <><Button size="sm" onClick={() => reviewReward(reward, "approve")} disabled={busy}><Check className="h-4 w-4" />Approve</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => reviewReward(reward, "reject")} disabled={busy}><XCircle className="h-4 w-4" />Reject</Button></> : null}</div></td></tr>)}</tbody></table></div> : <EmptyState icon={Gift} title="No referral rewards yet" description="Qualified referral rewards will appear here. When auto-approval is on, they will arrive already approved." />}
    </SectionCard>

    <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Spotly campaign" : "New Spotly campaign"} size="lg"><form onSubmit={save} className="max-h-[80vh] space-y-5 overflow-y-auto p-5">
      <div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Campaign name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="Welcome to Spotly" /></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Customer-facing description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="surface min-h-24 w-full rounded-xl p-4 outline-none" placeholder="A short explanation of the offer." /></label><label><span className="mb-2 block text-sm font-semibold">Code <span className="font-normal text-tertiary">optional</span></span><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="Automatic if blank" /></label><label><span className="mb-2 block text-sm font-semibold">Audience</span><select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="all_customers">All customers</option><option value="new_customers">New customers</option><option value="returning_customers">Returning customers</option><option value="private_beta">Private beta customers</option></select></label></div>
      <div className="grid gap-4 sm:grid-cols-4"><label><span className="mb-2 block text-sm font-semibold">Discount</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="surface h-12 w-full rounded-xl px-3"><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label><label><span className="mb-2 block text-sm font-semibold">Value</span><input required type="number" min="0.01" step="0.01" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} className="surface h-12 w-full rounded-xl px-3 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Currency</span><select value={form.currency} disabled={form.type === "percentage"} onChange={(event) => setForm({ ...form, currency: event.target.value })} className="surface h-12 w-full rounded-xl px-3"><option value="USD">USD</option><option value="ZWG">ZiG</option></select></label><label><span className="mb-2 block text-sm font-semibold">Usage limit</span><input type="number" min="0" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} className="surface h-12 w-full rounded-xl px-3 outline-none" /></label></div>
      <div className="grid gap-4 sm:grid-cols-3"><label><span className="mb-2 block text-sm font-semibold">Minimum spend</span><input type="number" min="0" step="0.01" value={form.minimumSpend} onChange={(event) => setForm({ ...form, minimumSpend: event.target.value })} className="surface h-12 w-full rounded-xl px-3 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Starts</span><input type="date" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="surface h-12 w-full rounded-xl px-3 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Ends <span className="font-normal text-tertiary">optional</span></span><input type="date" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className="surface h-12 w-full rounded-xl px-3 outline-none" /></label></div>
      <div><p className="text-sm font-semibold">Business scope</p><p className="mt-1 text-xs leading-5 text-secondary">Leave every business unchecked to make the campaign eligible across Spotly. Select businesses to limit it.</p><div className="mt-3 max-h-52 space-y-1 overflow-y-auto rounded-2xl border p-2">{businesses.filter((business) => business.public !== false && !business.canonicalBusinessId).map((business) => <label key={business.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-grouped"><input type="checkbox" checked={form.businessIds.includes(business.id)} onChange={() => toggleBusiness(business.id)} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{business.name || business.brandName || business.id}</span><span className="text-xs text-tertiary">{business.city || ""}</span></label>)}</div>{form.businessIds.length ? <p className="mt-2 text-xs text-secondary">Selected: {form.businessIds.map((id) => businessMap.get(id)?.name || id).slice(0, 4).join(", ")}{form.businessIds.length > 4 ? ` +${form.businessIds.length - 4}` : ""}</p> : null}</div>
      <label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input className="mt-1" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span><span className="block text-sm font-semibold">Campaign active</span><span className="mt-1 block text-xs leading-5 text-secondary">Date, audience, usage limit and checkout eligibility are still enforced even when active.</span></span></label>
      <div className="flex justify-end gap-2 border-t pt-5"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={busy}>{editing ? "Save changes" : "Create campaign"}</Button></div>
    </form></Modal>
  </>;
}
