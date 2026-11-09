"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, FlaskConical, MapPin, Plus, ShieldCheck, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { OPERATION_GRANT_TYPES } from "@/lib/operations-grants";
import { SERVICE_IDS } from "@/lib/contracts/generated";
import { SPOTLY_COUNTRIES, countryDefinition } from "@/lib/country-engine";
import { Badge, Button } from "@/components/ui";

const TYPE_LABELS = {
  service_preview: "Service preview",
  service_operations: "Service operations",
  payment_sandbox: "Payment sandbox",
  location_override: "Location override",
  driver_operations: "Driver operations"
};
const SERVICE_LABELS = { eat: "Bite", shop: "Shopper", ride: "Ride", book: "Book", events: "Live", send: "Send" };
const EMPTY = { type: "service_preview", service: "", country: "", city: "", hours: "24", reason: "" };

function expiry(hours) { return new Date(Date.now() + Math.max(1, Number(hours || 24)) * 60 * 60_000).toISOString(); }
function active(grant) { return grant.status === "active" && grant.expiresAt && new Date(grant.expiresAt).getTime() > Date.now(); }
function scopeText(grant) {
  const parts = [];
  if (grant.services?.length) parts.push(grant.services.map((item) => SERVICE_LABELS[item] || item).join(", "));
  if (grant.countries?.length) parts.push(grant.countries.map((item) => countryDefinition(item)?.name || item).join(", "));
  if (grant.cities?.length) parts.push(grant.cities.map((item) => item.split(":").slice(1).join(":").replaceAll("-", " ")).join(", "));
  return parts.length ? parts.join(" · ") : "All applicable scopes";
}

export function AdminOperationsGrants({ userId }) {
  const [grants, setGrants] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const country = countryDefinition(form.country);
  const load = useCallback(async () => {
    if (!userId) return;
    setBusy("load");
    try { const result = await authenticatedFetch(`/api/admin/operations-grants?userId=${encodeURIComponent(userId)}`, { cache: "no-store" }); setGrants(result.grants || []); setError(""); }
    catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  const current = useMemo(() => grants.filter(active), [grants]);

  async function issue() {
    setBusy("issue"); setError("");
    try {
      await authenticatedFetch("/api/admin/operations-grants", { method: "POST", body: JSON.stringify({
        action: "issue", userId, type: form.type,
        services: form.service ? [form.service] : [], countries: form.country ? [form.country] : [],
        cities: form.country && form.city ? [{ country: form.country, city: form.city }] : [],
        expiresAt: expiry(form.hours), reason: form.reason.trim()
      }) });
      setForm(EMPTY); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }
  async function revoke(grantId) {
    const reason = window.prompt("Why are you revoking this Operations grant?", "Testing complete");
    if (!reason) return;
    setBusy(`revoke:${grantId}`); setError("");
    try { await authenticatedFetch("/api/admin/operations-grants", { method: "POST", body: JSON.stringify({ action: "revoke", grantId, reason }) }); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><FlaskConical className="h-5 w-5"/></span><div><p className="font-semibold">Operations grants</p><p className="mt-1 text-xs leading-5 text-secondary">Temporary, scoped access for exercising real Spotly flows without role escalation or production financial contamination.</p></div></div>
    {error ? <p className="mt-3 rounded-lg bg-[var(--danger-soft)] p-3 text-xs text-danger">{error}</p> : null}
    <div className="mt-4 space-y-2">{current.map((grant) => <div key={grant.id} className="rounded-xl border bg-[var(--surface)] p-3"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--accent)]"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{TYPE_LABELS[grant.type] || grant.type}</p><Badge tone="success">Active</Badge></div><p className="mt-1 text-xs text-secondary">{scopeText(grant)}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-tertiary"><Clock3 className="h-3 w-3"/>Expires {new Date(grant.expiresAt).toLocaleString()}</p><p className="mt-1 text-[11px] text-tertiary">{grant.reason}</p></div><Button size="sm" variant="ghost" loading={busy===`revoke:${grant.id}`} onClick={() => revoke(grant.id)}><X className="h-4 w-4"/>Revoke</Button></div></div>)}{!current.length && busy!=="load" ? <p className="rounded-xl border border-dashed p-3 text-xs text-secondary">No active Operations grants.</p> : null}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold">Grant<select className="field-control mt-1 w-full" value={form.type} onChange={(e)=>setForm(v=>({...v,type:e.target.value}))}>{OPERATION_GRANT_TYPES.map((item)=><option key={item} value={item}>{TYPE_LABELS[item]}</option>)}</select></label>
      <label className="text-xs font-semibold">Service scope<select className="field-control mt-1 w-full" value={form.service} onChange={(e)=>setForm(v=>({...v,service:e.target.value}))}><option value="">All applicable services</option>{SERVICE_IDS.map((item)=><option key={item} value={item}>{SERVICE_LABELS[item]||item}</option>)}</select></label>
      <label className="text-xs font-semibold">Country scope<select className="field-control mt-1 w-full" value={form.country} onChange={(e)=>setForm(v=>({...v,country:e.target.value,city:""}))}><option value="">All supported countries</option>{SPOTLY_COUNTRIES.map((item)=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      <label className="text-xs font-semibold">City scope<select className="field-control mt-1 w-full" value={form.city} disabled={!form.country} onChange={(e)=>setForm(v=>({...v,city:e.target.value}))}><option value="">All cities in scope</option>{(country?.cities||[]).map((item)=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Duration<select className="field-control mt-1 w-full" value={form.hours} onChange={(e)=>setForm(v=>({...v,hours:e.target.value}))}><option value="1">1 hour</option><option value="8">8 hours</option><option value="24">24 hours</option><option value="168">7 days</option><option value="720">30 days</option></select></label>
      <label className="text-xs font-semibold">Reason<input className="field-control mt-1 w-full" value={form.reason} onChange={(e)=>setForm(v=>({...v,reason:e.target.value}))} placeholder="What is this account testing?"/></label>
    </div>
    <Button className="mt-3 w-full" loading={busy==="issue"} disabled={form.reason.trim().length<10} onClick={issue}><Plus className="h-4 w-4"/>Issue scoped grant</Button>
  </div>;
}
