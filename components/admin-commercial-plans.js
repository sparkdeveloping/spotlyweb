"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, SectionCard } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";
import { fieldClass, selectClass } from "@/components/business/shared";

const DEFAULT_PLAN = {
  mode: "draft", revision: 0, agreementVersion: "", agreementUrl: "", rules: [],
  trial: { status: "hidden", benefit: "commission", durationMonths: 3, startsAt: "", endsAt: "", approvedAt: "", approvalReference: "", headline: "", termsUrl: "" }
};
const DEFAULT_OVERRIDE = { businessId: "", country: "ZW", service: "eat", status: "draft", commissionPercent: 10,
  startsAt: "", endsAt: "", signedTermsEvidence: "", reason: "" };
const SERVICES = ["eat", "shop", "book", "events"];
const TYPES = ["*", "restaurant_food", "grocery_retail", "retail_store", "appointments_services", "accommodation_activities", "ticketing_events", "directory_profile"];
const toInput = (iso = "") => { if (!iso) return ""; const date = new Date(iso); return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; };
const fromInput = (value) => value ? new Date(value).toISOString() : "";
const label = (value) => value === "*" ? "All business types" : value.replaceAll("_", " ");

function DateField({ title, value, onChange }) {
  return <label className="block space-y-1 text-xs font-medium text-secondary"><span>{title}</span><input className={`${fieldClass} !h-10`} type="datetime-local" value={toInput(value)} onChange={(event) => onChange(fromInput(event.target.value))} /></label>;
}
export function AdminCommercialPlans() {
  const [plan, setPlan] = useState(DEFAULT_PLAN);
  const [revision, setRevision] = useState(0);
  const [businessId, setBusinessId] = useState("");
  const [override, setOverride] = useState(null);
  const [overrideRevision, setOverrideRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();
  const load = useCallback(async (id = "") => {
    setLoading(true); setError("");
    try {
      const result = await authenticatedFetch(`/api/admin/commercial-plans${id ? `?businessId=${encodeURIComponent(id)}` : ""}`);
      setPlan(result.plans ? { ...DEFAULT_PLAN, ...result.plans, trial: { ...DEFAULT_PLAN.trial, ...result.plans.trial } } : DEFAULT_PLAN);
      setRevision(Number(result.plans?.revision || 0));
      setOverride(id ? { ...DEFAULT_OVERRIDE, businessId: id, ...(result.override || {}) } : null);
      setOverrideRevision(Number(result.override?.revision || 0));
    } catch (caught) { setError(caught.message || "Commercial plans could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const changeRule = (index, update) => setPlan((previous) => ({ ...previous, rules: previous.rules.map((row, number) => number === index ? { ...row, ...update } : row) }));
  async function saveGlobal() {
    setSaving("global");
    try {
      await authenticatedFetch("/api/admin/commercial-plans", { method: "PATCH", body: JSON.stringify({ scope: "global", expectedRevision: revision,
        plan: { mode: plan.mode, agreementVersion: plan.agreementVersion, agreementUrl: plan.agreementUrl,
          rules: plan.rules.map(({ id, country, service, businessType, commissionPercent, startsAt, endsAt }) => ({ id, country, service, businessType, commissionPercent: Number(commissionPercent), startsAt, endsAt })), trial: plan.trial } }) });
      toast("Commercial policy version saved. Existing merchant agreements are unchanged.", { title: "Policy saved" }); await load(override?.businessId || "");
    } catch (caught) { toast(caught.message, { type: "error", title: "Policy could not be saved" }); }
    finally { setSaving(""); }
  }
  async function loadBusiness() {
    if (!/^[A-Za-z0-9_-]{2,160}$/.test(businessId.trim())) return setError("Enter a valid business reference.");
    await load(businessId.trim());
  }
  async function saveOverride() {
    if (!override) return;
    setSaving("override");
    try {
      await authenticatedFetch("/api/admin/commercial-plans", { method: "PATCH", body: JSON.stringify({ scope: "business", expectedRevision: overrideRevision,
        override: { businessId: override.businessId, status: override.status, country: override.country, service: override.service,
          commissionPercent: Number(override.commissionPercent), startsAt: override.startsAt, endsAt: override.endsAt,
          reason: override.reason, signedTermsEvidence: override.signedTermsEvidence } }) });
      toast("Business pricing saved. The owner must separately accept the offered terms.", { title: "Override saved" }); await load(override.businessId);
    } catch (caught) { toast(caught.message, { type: "error", title: "Override could not be saved" }); }
    finally { setSaving(""); }
  }
  const updateOverride = (next) => setOverride((previous) => ({ ...previous, ...next }));
  return <div className="space-y-5">
    <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Business commercial plans</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Set prospective Spotly commissions by country, service and business type. Existing deals take priority until an owner accepts replacement terms. No historic transaction can be repriced.</p></div><Badge tone={plan.mode === "active" ? "warning" : "neutral"}>{plan.mode === "active" ? "Agreement-enabled" : "Draft only"}</Badge></div><p className="mt-4 rounded-xl bg-grouped px-4 py-3 text-xs leading-6 text-secondary">Revenue collection remains under a separate server activation switch. Configuring or publishing a plan here never creates subscription invoices, charges a merchant, or enables Malawi payouts.</p></Card>
    {error && <div role="alert" className="rounded-xl border border-danger/30 p-4 text-sm text-danger">{error} <Button size="sm" variant="outline" onClick={() => load()}>Retry</Button></div>}
    {loading ? <p className="px-2 text-sm text-secondary">Loading commercial configuration…</p> : <>
      <SectionCard title="Country and category commission" description="A more specific business type overrides the matching country-and-service default. Save a new version whenever terms change."><div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-secondary">Agreement version<input value={plan.agreementVersion} onChange={(e) => setPlan({ ...plan, agreementVersion: e.target.value })} className={`${fieldClass} mt-1`} placeholder="e.g. business-2026-11" /></label><label className="text-xs font-medium text-secondary">Signed agreement URL<input value={plan.agreementUrl} onChange={(e) => setPlan({ ...plan, agreementUrl: e.target.value })} className={`${fieldClass} mt-1`} placeholder="https://…" /></label></div>
        <div className="space-y-3">{plan.rules.map((rule, index) => <div key={rule.id} className="rounded-2xl border p-4"><div className="grid items-end gap-3 sm:grid-cols-[.8fr_.8fr_1.4fr_.8fr_auto]">
          <label className="text-xs font-medium text-secondary">Country<select className={`${selectClass} mt-1`} value={rule.country} onChange={(e) => changeRule(index, { country: e.target.value })}><option value="ZW">Zimbabwe</option><option value="MW">Malawi</option></select></label>
          <label className="text-xs font-medium text-secondary">Service<select className={`${selectClass} mt-1`} value={rule.service} onChange={(e) => changeRule(index, { service: e.target.value })}>{SERVICES.map((value) => <option key={value} value={value}>{value === "eat" ? "Bite" : value === "shop" ? "Shopper" : value === "events" ? "Live" : "Book"}</option>)}</select></label>
          <label className="text-xs font-medium text-secondary">Business type<select className={`${selectClass} mt-1`} value={rule.businessType} onChange={(e) => changeRule(index, { businessType: e.target.value })}>{TYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label className="text-xs font-medium text-secondary">Commission %<input type="number" min="0" max="100" step="0.1" className={`${fieldClass} mt-1`} value={rule.commissionPercent} onChange={(e) => changeRule(index, { commissionPercent: e.target.value })}/></label>
          <Button variant="outline" onClick={() => setPlan((previous) => ({ ...previous, rules: previous.rules.filter((_, number) => number !== index) }))}>Remove</Button></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><DateField title="Effective from (optional)" value={rule.startsAt} onChange={(value) => changeRule(index, { startsAt: value })}/><DateField title="Ends (optional)" value={rule.endsAt} onChange={(value) => changeRule(index, { endsAt: value })}/></div>
        </div>)}</div>
        <Button variant="outline" onClick={() => setPlan((previous) => ({ ...previous, rules: [...previous.rules, { id: `rule_${Date.now()}`, country: "ZW", service: "eat", businessType: "*", commissionPercent: 10, startsAt: "", endsAt: "" }] }))}>Add commission rule</Button>
        <div className="flex flex-wrap items-end gap-4 border-t pt-4"><label className="min-w-40 text-xs font-medium text-secondary">Plan status<select className={`${selectClass} mt-1`} value={plan.mode} onChange={(e) => setPlan({ ...plan, mode: e.target.value })}><option value="draft">Draft · no effect</option><option value="active">Available for owner acceptance</option></select></label><Button onClick={saveGlobal} loading={saving === "global"}>Save version {revision + 1}</Button></div>
      </div></SectionCard>
      <SectionCard title="Three-month introductory offer" description="Hidden until approved, date-bounded and launched. Only commission waivers are supported; subscription billing has not been implemented."><div className="grid gap-4 p-5 sm:grid-cols-2">
        <label className="text-xs font-medium text-secondary">Visibility<select className={`${selectClass} mt-1`} value={plan.trial.status} onChange={(e) => setPlan({ ...plan, trial: { ...plan.trial, status: e.target.value } })}><option value="hidden">Hidden</option><option value="scheduled">Scheduled — not shown</option><option value="live">Live — subject to approval and dates</option></select></label>
        <label className="text-xs font-medium text-secondary">Offer headline<input className={`${fieldClass} mt-1`} value={plan.trial.headline} onChange={(e) => setPlan({ ...plan, trial: { ...plan.trial, headline: e.target.value } })} placeholder="3 months with no Spotly commission for eligible new businesses" /></label>
        <DateField title="Enrollment opens" value={plan.trial.startsAt} onChange={(value) => setPlan({ ...plan, trial: { ...plan.trial, startsAt: value } })}/><DateField title="Enrollment closes" value={plan.trial.endsAt} onChange={(value) => setPlan({ ...plan, trial: { ...plan.trial, endsAt: value } })}/>
        <label className="text-xs font-medium text-secondary">Approved offer terms URL<input className={`${fieldClass} mt-1`} value={plan.trial.termsUrl} onChange={(e) => setPlan({ ...plan, trial: { ...plan.trial, termsUrl: e.target.value } })} placeholder="https://…" /></label>
        <DateField title="External legal approval timestamp (required for live)" value={plan.trial.approvedAt} onChange={(value) => setPlan({ ...plan, trial: { ...plan.trial, approvedAt: value } })}/>
        <label className="text-xs font-medium text-secondary sm:col-span-2">Verified legal approval reference (required for live)<input className={`${fieldClass} mt-1`} value={plan.trial.approvalReference} onChange={(e) => setPlan({ ...plan, trial: { ...plan.trial, approvalReference: e.target.value } })} placeholder="Internal approval reference; do not paste private documents" /></label>
        <div className="sm:col-span-2"><Button onClick={saveGlobal} loading={saving === "global"}>Save trial configuration</Button></div>
      </div></SectionCard>
      <SectionCard title="Individual business agreement" description="Look up one merchant at a time. An active override must reference signed-terms evidence, and the owner must still accept the exact rate in their Money workspace."><div className="space-y-4 p-5"><div className="flex flex-wrap gap-2"><input className={`${fieldClass} max-w-md flex-1`} value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="Business ID" aria-label="Business ID"/><Button variant="outline" onClick={loadBusiness}>Find business</Button></div>
        {override && <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold">{override.businessId} · current version {overrideRevision}</p>
          <label className="text-xs font-medium text-secondary">Status<select className={`${selectClass} mt-1`} value={override.status} onChange={(e) => updateOverride({ status: e.target.value })}><option value="draft">Draft</option><option value="active">Offer for acceptance</option><option value="disabled">Disabled</option></select></label>
          <label className="text-xs font-medium text-secondary">Commission %<input type="number" min="0" max="100" step="0.1" className={`${fieldClass} mt-1`} value={override.commissionPercent} onChange={(e) => updateOverride({ commissionPercent: e.target.value })} /></label>
          <label className="text-xs font-medium text-secondary">Country<select className={`${selectClass} mt-1`} value={override.country} onChange={(e) => updateOverride({ country: e.target.value })}><option value="ZW">Zimbabwe</option><option value="MW">Malawi</option></select></label>
          <label className="text-xs font-medium text-secondary">Service<select className={`${selectClass} mt-1`} value={override.service} onChange={(e) => updateOverride({ service: e.target.value })}>{SERVICES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="text-xs font-medium text-secondary sm:col-span-2">Reason<input className={`${fieldClass} mt-1`} value={override.reason} onChange={(e) => updateOverride({ reason: e.target.value })} placeholder="Document the negotiated commercial reason" /></label>
          <label className="text-xs font-medium text-secondary sm:col-span-2">Verified agreement evidence reference<input className={`${fieldClass} mt-1`} value={override.signedTermsEvidence} onChange={(e) => updateOverride({ signedTermsEvidence: e.target.value })} placeholder="Reference only; do not paste personal documents" /></label>
          <DateField title="Effective from (optional)" value={override.startsAt} onChange={(value) => updateOverride({ startsAt: value })}/><DateField title="Expires (optional)" value={override.endsAt} onChange={(value) => updateOverride({ endsAt: value })}/>
          <div className="sm:col-span-2"><Button onClick={saveOverride} loading={saving === "override"}>Save negotiated terms</Button></div>
        </div>}
      </div></SectionCard>
    </>}
  </div>;
}
