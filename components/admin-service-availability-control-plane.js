"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Eye,
  EyeOff,
  History,
  MapPin,
  RefreshCw,
  RotateCcw,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { SERVICE_IDENTITIES } from "@/lib/service-identity";
import { Badge, Button, Card, EmptyState, Modal, PageSkeleton, SectionCard, Tabs } from "@/components/ui";

const SERVICE_ORDER = ["eat", "shop", "ride", "book", "events", "send"];
const STATE_ORDER = ["hidden", "preview", "discover", "live", "paused"];
const STATE_LABEL = { hidden: "Hidden", preview: "Preview", discover: "Discover", live: "Live", paused: "Paused", inherit: "Inherit" };
const STATE_TONE = { hidden: "neutral", preview: "info", discover: "warning", live: "success", paused: "danger" };
const READINESS_TONE = { ready: "success", warning: "warning", blocked: "danger" };
const RISK_TONE = { low: "neutral", medium: "warning", high: "warning", critical: "danger" };

function serviceName(service) {
  return SERVICE_IDENTITIES[service]?.label || service;
}

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function stateSelectValue(cell) {
  return cell?.override?.state || "inherit";
}

function StateSelect({ cell, onChange, disabled = false, compact = false }) {
  const value = stateSelectValue(cell);
  const resolved = cell?.decision?.state || "hidden";
  return <div className="min-w-[118px]">
    <select
      aria-label={`Availability state. Resolved ${resolved}`}
      className={`field-control w-full ${compact ? "h-9 text-xs" : "h-10 text-sm"}`}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="inherit">Inherit · {STATE_LABEL[resolved]}</option>
      {STATE_ORDER.map((state) => <option key={state} value={state}>{STATE_LABEL[state]}</option>)}
    </select>
    <div className="mt-1 flex items-center gap-1.5"><Badge tone={STATE_TONE[resolved] || "neutral"}>{STATE_LABEL[resolved]}</Badge><span className="text-[10px] text-tertiary">{cell?.decision?.source || "bootstrap"}</span></div>
  </div>;
}

function SummaryStat({ label, value, detail, icon: Icon }) {
  return <Card className="p-4"><div className="flex items-center gap-2 text-secondary"><Icon className="h-4 w-4"/><p className="text-xs font-semibold">{label}</p></div><p className="mt-2 text-2xl font-semibold">{value}</p>{detail ? <p className="mt-1 text-xs text-tertiary">{detail}</p> : null}</Card>;
}

function ReadinessIcon({ state }) {
  if (state === "ready") return <CheckCircle2 className="h-4 w-4 text-success"/>;
  if (state === "blocked") return <AlertTriangle className="h-4 w-4 text-danger"/>;
  return <CircleDashed className="h-4 w-4 text-warning"/>;
}

export function AdminServiceAvailabilityControlPlane() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("matrix");
  const [selectedCountry, setSelectedCountry] = useState("ZW");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [rollbackTarget, setRollbackTarget] = useState(null);
  const [rollbackNote, setRollbackNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setData(await authenticatedFetch("/api/admin/service-availability", { cache: "no-store" })); }
    catch (caught) { setError(caught.message || "Countries & Services could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(payload, key, successMessage = "") {
    setBusy(key); setError(""); setMessage("");
    try {
      const result = await authenticatedFetch("/api/admin/service-availability", { method: "POST", body: JSON.stringify(payload) });
      setData((current) => ({ ...(current || {}), ...result }));
      if (successMessage) setMessage(successMessage);
      return result;
    } catch (caught) {
      setError(caught.message || "The Countries & Services change could not be completed.");
      return null;
    } finally { setBusy(""); }
  }

  async function edit(scope, service, state, country = "", city = "") {
    const inherit = state === "inherit";
    await run({ action: "edit", scope, service, state, inherit, ...(country ? { country } : {}), ...(city ? { city } : {}) }, `edit:${scope}:${service}:${country}:${city}`, "Draft updated. Production has not changed yet.");
  }

  async function resetDraft() {
    await run({ action: "reset_draft" }, "reset", "Draft reset to the currently published configuration.");
  }

  async function publish() {
    const result = await run({ action: "publish", note: publishNote.trim() }, "publish", "Countries & Services revision published to all Spotly clients.");
    if (result) { setPublishOpen(false); setPublishNote(""); }
  }

  async function rollback() {
    if (!rollbackTarget) return;
    const result = await run({ action: "rollback", revisionId: rollbackTarget.id, note: rollbackNote.trim() }, `rollback:${rollbackTarget.id}`, `Rollback published as a new revision from Revision ${rollbackTarget.number}.`);
    if (result) { setRollbackTarget(null); setRollbackNote(""); }
  }

  const countries = data?.countries || [];
  const draftMatrix = data?.draft?.matrix || [];
  const activeMatrix = data?.active?.matrix || [];
  const draftCountry = draftMatrix.find((item) => item.country === selectedCountry) || draftMatrix[0];
  const activeCountry = activeMatrix.find((item) => item.country === selectedCountry) || activeMatrix[0];
  const readinessCountry = data?.readiness?.countries?.[selectedCountry] || null;
  const impact = data?.impact || { summary: {}, runtimeChanges: [], changed: false };
  const publishBlockers = data?.publishBlockers || [];
  const activeRevision = data?.active?.revision || {};
  const draftDirty = impact.changed === true;
  const stale = data?.draft?.stale === true;

  const changedCountryRows = useMemo(() => (impact.runtimeChanges || []).filter((item) => item.scope === "country"), [impact.runtimeChanges]);
  const changedCityRows = useMemo(() => (impact.runtimeChanges || []).filter((item) => item.scope === "city"), [impact.runtimeChanges]);

  if (loading && !data) return <PageSkeleton cards={4} rows={5}/>;
  if (!data) return <EmptyState icon={AlertTriangle} title="Countries & Services could not be loaded" description={error || "Try again."} action={<Button onClick={load}>Retry</Button>}/>;

  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryStat icon={Rocket} label="Published revision" value={activeRevision.number || "—"} detail={activeRevision.publishedAt ? dateLabel(activeRevision.publishedAt) : "Bootstrap configuration"}/>
      <SummaryStat icon={Save} label="Draft changes" value={impact.summary?.directChanges || 0} detail={draftDirty ? "Not live until published" : "Matches production"}/>
      <SummaryStat icon={Sparkles} label="Runtime contexts affected" value={impact.summary?.runtimeContexts || 0} detail={`${impact.summary?.servicesAffected || 0} services · ${impact.summary?.countriesAffected || 0} countries`}/>
      <SummaryStat icon={ShieldCheck} label="Publish blockers" value={publishBlockers.length} detail={publishBlockers.length ? "Resolve before making new live scopes" : "No changed live scope is blocked"}/>
    </div>

    {error ? <div role="alert" className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-danger">{error}</div> : null}
    {message ? <div role="status" className="rounded-xl bg-[var(--success-soft)] p-4 text-sm text-success">{message}</div> : null}
    {stale ? <div className="rounded-xl border border-warning bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]"><strong>Draft is stale.</strong> Another revision was published after this draft began. Reset it to production before making or publishing more changes.</div> : null}

    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]">Countries & Services</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">One rollout control plane for every Spotly client</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Edit a shared draft, inspect exactly what changes across web, customer iOS, Driver iOS and backend transaction gates, then publish one immutable revision. Nothing in the matrix changes production until Publish.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={load} loading={loading}><RefreshCw className="h-4 w-4"/>Refresh</Button><Button variant="outline" disabled={!data?.draft?.exists || busy === "reset"} loading={busy === "reset"} onClick={resetDraft}><RotateCcw className="h-4 w-4"/>Reset draft</Button><Button disabled={!draftDirty || stale || busy === "publish"} onClick={() => setPublishOpen(true)}><Rocket className="h-4 w-4"/>Review & publish</Button></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold text-tertiary">ACTIVE</p><p className="mt-1 font-semibold">{activeRevision.number ? `Revision ${activeRevision.number}` : "Bootstrap"}</p><p className="mt-1 text-xs text-secondary">{activeRevision.publishedByEmail || "Canonical defaults / legacy migration"}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold text-tertiary">DRAFT BASE</p><p className="mt-1 font-semibold">{data.draft?.baseRevisionNumber ? `Revision ${data.draft.baseRevisionNumber}` : "Bootstrap"}</p><p className="mt-1 text-xs text-secondary">{data.draft?.updatedAt ? `Edited ${dateLabel(data.draft.updatedAt)}` : "No saved draft yet"}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold text-tertiary">PROPAGATION</p><p className="mt-1 font-semibold">Firebase runtime authority</p><p className="mt-1 text-xs text-secondary">Customer web · customer iOS · Driver iOS · backend mutations</p></div></div>
    </Card>

    <Tabs idPrefix="countries-services" value={tab} onChange={setTab} tabs={[{ value: "matrix", label: "Country × service matrix" }, { value: "cities", label: "City overrides" }, { value: "readiness", label: "Readiness" }, { value: "impact", label: "Impact preview" }, { value: "history", label: "Revisions & audit" }]}/>

    {tab === "matrix" ? <div className="space-y-5">
      <SectionCard title="Country × service matrix" description="Country overrides sit above service defaults and below city overrides. ‘Inherit’ keeps the canonical resolver precedence instead of duplicating configuration.">
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b text-xs text-secondary"><th className="p-4">Country</th>{SERVICE_ORDER.map((service) => <th key={service} className="p-4">{serviceName(service)}</th>)}</tr></thead><tbody>{draftMatrix.map((country) => <tr key={country.country} className="border-b last:border-0"><td className="p-4 align-top"><button className="text-left" onClick={() => { setSelectedCountry(country.country); setTab("cities"); }}><span className="font-semibold">{country.name}</span><span className="mt-1 block text-xs text-secondary">{country.country} · open cities</span></button></td>{SERVICE_ORDER.map((service) => <td key={service} className="p-4 align-top"><StateSelect cell={country.services?.[service]} disabled={stale || busy.startsWith("edit:")} onChange={(state) => edit("country", service, state, country.country)}/></td>)}</tr>)}</tbody></table></div>
      </SectionCard>
      <SectionCard title="Global service defaults" description="Fallback used only when a country or city does not provide a stronger decision. Canonical bootstrap still applies when no explicit default exists."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{SERVICE_ORDER.map((service) => { const node = data.draft?.config?.services?.[service] || {}; const state = node.defaultState || "inherit"; return <div key={service} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Spotly {serviceName(service)}</p><p className="mt-1 text-xs text-secondary">Service-wide fallback</p></div><Badge tone={state === "inherit" ? "neutral" : STATE_TONE[state]}>{STATE_LABEL[state]}</Badge></div><select className="field-control mt-3 w-full" value={state} disabled={stale || busy.startsWith("edit:")} onChange={(event) => edit("service", service, event.target.value)}><option value="inherit">Use canonical bootstrap</option>{STATE_ORDER.map((item) => <option key={item} value={item}>{STATE_LABEL[item]}</option>)}</select></div>; })}</div></SectionCard>
    </div> : null}

    {tab === "cities" ? <div className="space-y-5">
      <div className="flex flex-wrap gap-2">{countries.map((country) => <Button key={country.code} size="sm" variant={selectedCountry === country.code ? "primary" : "outline"} onClick={() => setSelectedCountry(country.code)}>{country.name}</Button>)}</div>
      <SectionCard title={`${draftCountry?.name || selectedCountry} city overrides`} description="A city override wins over the country matrix. Use it for controlled launches, pauses and pilots without changing the rest of the country.">
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead><tr className="border-b text-xs text-secondary"><th className="p-4">City</th>{SERVICE_ORDER.map((service) => <th key={service} className="p-4">{serviceName(service)}</th>)}</tr></thead><tbody>{(draftCountry?.cities || []).map((city) => <tr key={city.id} className="border-b last:border-0"><td className="p-4 align-top"><p className="font-semibold">{city.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-secondary"><MapPin className="h-3 w-3"/>{selectedCountry}:{city.id}</p></td>{SERVICE_ORDER.map((service) => <td key={service} className="p-4 align-top"><StateSelect compact cell={city.services?.[service]} disabled={stale || busy.startsWith("edit:")} onChange={(state) => edit("city", service, state, selectedCountry, city.name)}/></td>)}</tr>)}</tbody></table></div>
      </SectionCard>
      {activeCountry ? <p className="text-xs text-tertiary">Production remains on {activeRevision.number ? `Revision ${activeRevision.number}` : "bootstrap configuration"} until the draft is published.</p> : null}
    </div> : null}

    {tab === "readiness" ? <div className="space-y-5">
      <div className="flex flex-wrap gap-2">{countries.map((country) => <Button key={country.code} size="sm" variant={selectedCountry === country.code ? "primary" : "outline"} onClick={() => setSelectedCountry(country.code)}>{country.name}</Button>)}</div>
      <div className="grid gap-4 xl:grid-cols-2">{SERVICE_ORDER.map((service) => { const entry = readinessCountry?.services?.[service]; const checks = entry?.readiness?.checks || []; const decision = entry?.decision || {}; return <Card key={service} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-tertiary">Spotly {serviceName(service)}</p><h3 className="mt-2 text-lg font-semibold">{draftCountry?.name || selectedCountry} · {STATE_LABEL[decision.state] || decision.state}</h3></div><Badge tone={READINESS_TONE[entry?.readiness?.state] || "neutral"}>{entry?.readiness?.state || "unknown"}</Badge></div><div className="mt-4 divide-y">{checks.map((check) => <div key={check.id} className="flex items-start gap-3 py-3"><ReadinessIcon state={check.state}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{check.label}</p><p className="mt-1 text-xs leading-5 text-secondary">{check.detail}</p></div>{check.blocking ? <Badge tone="danger">Blocks live publish</Badge> : null}</div>)}</div></Card>; })}</div>
      {publishBlockers.length ? <SectionCard title="Changed live scopes that cannot publish yet" description="Only new/changed scopes that would become live block this draft. Existing unrelated live scopes do not stop an otherwise safe publication."><div className="divide-y">{publishBlockers.map((item) => <div key={`${item.service}-${item.country}-${item.city}`} className="p-4"><p className="font-semibold">Spotly {serviceName(item.service)} · {item.city || item.country}</p><p className="mt-1 text-sm text-secondary">{item.blockers.map((check) => check.label).join(" · ")}</p></div>)}</div></SectionCard> : <Card className="p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-success"/><div><p className="font-semibold">No changed live scope is blocked</p><p className="mt-1 text-sm text-secondary">The draft can pass readiness once you are satisfied with its impact.</p></div></div></Card>}
    </div> : null}

    {tab === "impact" ? <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryStat icon={Rocket} label="Transactions starting" value={impact.summary?.transactionsStarting || 0}/><SummaryStat icon={Clock3} label="Transactions stopping" value={impact.summary?.transactionsStopping || 0}/><SummaryStat icon={EyeOff} label="Surfaces hidden" value={impact.summary?.surfacesHidden || 0}/><SummaryStat icon={Eye} label="Surfaces shown" value={impact.summary?.surfacesShown || 0}/></div>
      <Card className="p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--accent)]"/><div><p className="font-semibold">Propagation preview</p><p className="mt-1 text-sm leading-6 text-secondary">Publishing this draft updates the Firebase runtime authority consumed by customer web, customer iOS and Driver iOS. Backend transaction gates read the same published configuration, so a client cannot bypass a paused or non-live service.</p></div></div></Card>
      <SectionCard title="Country-level impact" description={`${changedCountryRows.length} resolved country context${changedCountryRows.length === 1 ? "" : "s"} change.`}><div className="divide-y">{changedCountryRows.length ? changedCountryRows.map((item) => <div key={`${item.service}-${item.country}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">Spotly {serviceName(item.service)} · {item.countryName}</p><p className="mt-1 text-xs text-secondary">{item.before.state} → {item.after.state}{item.after.reason ? ` · ${item.after.reason}` : ""}</p></div><Badge tone={RISK_TONE[item.risk?.level] || "neutral"}>{item.risk?.label || "Change"}</Badge></div>) : <div className="p-6 text-center text-sm text-secondary">No country-level runtime changes.</div>}</div></SectionCard>
      <SectionCard title="City-level impact" description={`${changedCityRows.length} resolved city context${changedCityRows.length === 1 ? "" : "s"} change.`}><div className="max-h-[520px] divide-y overflow-y-auto">{changedCityRows.length ? changedCityRows.map((item) => <div key={`${item.service}-${item.country}-${item.city}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">Spotly {serviceName(item.service)} · {item.city}, {item.country}</p><p className="mt-1 text-xs text-secondary">{item.before.state} → {item.after.state}</p></div><Badge tone={RISK_TONE[item.risk?.level] || "neutral"}>{item.risk?.label || "Change"}</Badge></div>) : <div className="p-6 text-center text-sm text-secondary">No city-level runtime changes.</div>}</div></SectionCard>
    </div> : null}

    {tab === "history" ? <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <SectionCard title="Published revisions" description="Immutable snapshots. Rollback republishes an older snapshot as a new revision; history is never rewritten."><div className="divide-y">{(data.revisions || []).length ? data.revisions.map((revision) => <div key={revision.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">Revision {revision.number}</p><Badge tone={revision.id === activeRevision.id ? "success" : revision.kind === "rollback" ? "warning" : "neutral"}>{revision.id === activeRevision.id ? "active" : revision.kind}</Badge></div><p className="mt-1 text-xs text-secondary">{dateLabel(revision.publishedAt)} · {revision.publishedByEmail || revision.publishedBy || "administrator"}</p>{revision.note ? <p className="mt-2 text-sm leading-6">{revision.note}</p> : null}<p className="mt-2 text-xs text-tertiary">{revision.impact?.runtimeContexts || 0} runtime contexts · {revision.impact?.transactionsStarting || 0} start transactions · {revision.impact?.transactionsStopping || 0} stop transactions</p></div>{revision.id !== activeRevision.id ? <Button size="sm" variant="outline" onClick={() => { setRollbackTarget(revision); setRollbackNote(`Rollback to Revision ${revision.number}`); }}><History className="h-4 w-4"/>Rollback</Button> : null}</div></div>) : <div className="p-8 text-center text-sm text-secondary">No published revision history yet. The first publish creates Revision 1.</div>}</div></SectionCard>
      <SectionCard title="Audit activity" description="Draft edits, publishes, resets and rollbacks are recorded with the acting administrator."><div className="max-h-[680px] divide-y overflow-y-auto">{(data.audit || []).length ? data.audit.slice(0, 40).map((event) => <div key={event.id} className="p-4"><p className="text-sm font-semibold">{String(event.action || "").replaceAll("_", " ").replaceAll(".", " · ")}</p><p className="mt-1 text-xs text-secondary">{event.actorEmail || event.actorId || "administrator"} · {dateLabel(event.createdAt)}</p>{event.metadata?.note ? <p className="mt-2 text-xs leading-5">{event.metadata.note}</p> : null}</div>) : <div className="p-8 text-center text-sm text-secondary">Control-plane audit events will appear after the first edit.</div>}</div></SectionCard>
    </div> : null}

    <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publish Countries & Services" description="This changes the runtime authority used by every Spotly client and backend transaction gate." size="md">
      <div className="space-y-4 p-5"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold text-tertiary">RUNTIME CONTEXTS</p><p className="mt-1 text-2xl font-semibold">{impact.summary?.runtimeContexts || 0}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold text-tertiary">BLOCKERS</p><p className="mt-1 text-2xl font-semibold">{publishBlockers.length}</p></div></div>{publishBlockers.length ? <div className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-danger">Resolve the changed live-scope readiness blockers before publishing.</div> : null}<label className="block text-sm font-semibold">Publish note<textarea className="field-control mt-2 min-h-24 w-full" value={publishNote} onChange={(event) => setPublishNote(event.target.value)} placeholder="Why are we changing rollout availability?"/></label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button><Button disabled={publishBlockers.length > 0 || stale || !draftDirty} loading={busy === "publish"} onClick={publish}><Rocket className="h-4 w-4"/>Publish revision</Button></div></div>
    </Modal>

    <Modal open={Boolean(rollbackTarget)} onClose={() => setRollbackTarget(null)} title={rollbackTarget ? `Rollback to Revision ${rollbackTarget.number}` : "Rollback"} description="Rollback publishes that old snapshot as a brand-new revision so the audit trail remains immutable." size="md">
      <div className="space-y-4 p-5"><div className="rounded-xl bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]"><strong>This is a production change.</strong> Current readiness is checked again before the rollback can publish.</div><label className="block text-sm font-semibold">Rollback note<textarea className="field-control mt-2 min-h-24 w-full" value={rollbackNote} onChange={(event) => setRollbackNote(event.target.value)} placeholder="Why is this rollback necessary?"/></label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRollbackTarget(null)}>Cancel</Button><Button loading={Boolean(rollbackTarget && busy === `rollback:${rollbackTarget.id}`)} onClick={rollback}><RotateCcw className="h-4 w-4"/>Publish rollback</Button></div></div>
    </Modal>
  </div>;
}
