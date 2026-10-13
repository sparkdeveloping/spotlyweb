"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Clock3,
  Copy,
  CreditCard,
  Edit3,
  MapPin,
  Plus,
  Store,
  Trash2
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { saveBranch } from "@/lib/firebase-services";
import { deleteBranch, markLaunchCriticalBusinessChange } from "@/lib/business-services";
import { defaultBranch, paymentMethods, zimbabweCities } from "@/data/business-config";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, ConfirmDialog, FieldLabel, FullScreenTask, fieldClass, selectClass } from "@/components/business/shared";
import { businessHref } from "@/lib/business-routing";

const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function isPrimaryBranch(branch, business, branches = []) {
  if (!branch?.id) return false;
  const primaryId = business?.primaryBranchId || business?.primaryLocationId || business?.defaultBranchId || "";
  return primaryId ? branch.id === primaryId : branches[0]?.id === branch.id;
}

function BranchModal({ branch, open, onClose }) {
  const { business, branches, user, selectedBusinessId, archetype, lifecycle, refreshBranches } = useBusinessWorkspace();
  const pickupEnabled = archetype.capabilities.includes("pickup_orders");
  const locationNoun = archetype.nouns.branch || "location";
  const [form, setForm] = useState({ ...defaultBranch });
  const [tab, setTab] = useState("details");
  const [copyFrom, setCopyFrom] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [task, setTask] = useState({ open: false, state: "processing", title: "", description: "", active: 0 });
  const { toast } = useToast();

  const tabs = useMemo(() => [
    { value: "details", label: "Identity & contact" },
    { value: "hours", label: "Opening hours" },
    { value: "operations", label: pickupEnabled ? "Pickup & payments" : "Operations & payments" }
  ], [pickupEnabled]);

  useEffect(() => {
    if (!open) return;
    const fallbackFulfilment = pickupEnabled ? ["pickup"] : archetype.capabilities.includes("appointments") ? ["appointment"] : archetype.capabilities.includes("tickets") ? ["ticketing"] : ["profile"];
    setForm(branch
      ? {
          ...defaultBranch,
          ...branch,
          name: branch.branchName || branch.name || "Main location",
          pickup: { ...defaultBranch.pickup, ...(branch.pickup || {}), enabled: pickupEnabled && branch.pickup?.enabled !== false },
          fulfilment: branch.fulfilment?.length ? branch.fulfilment : fallbackFulfilment,
          openingHours: { ...defaultBranch.openingHours, ...(branch.openingHours || {}) }
        }
      : {
          ...defaultBranch,
          name: "Main location",
          fulfilment: fallbackFulfilment,
          pickup: { ...defaultBranch.pickup, enabled: pickupEnabled }
        });
    setTab("details");
    setCopyFrom("");
  }, [branch, open, pickupEnabled, archetype.capabilities]);

  function update(values) { setForm((current) => ({ ...current, ...values })); }
  function updateHours(day, values) {
    setForm((current) => ({
      ...current,
      openingHours: { ...current.openingHours, [day]: { ...(current.openingHours?.[day] || {}), ...values } }
    }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast("Location services are not available on this device.", { type: "error", title: "Map pin unavailable" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update({ location: {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy || 0)
        } });
        setLocating(false);
        toast("The map pin was captured for this location.", { title: "Map pin added" });
      },
      (reason) => {
        setLocating(false);
        toast(reason.message || "Spotly could not read this device location.", { type: "error", title: "Map pin unavailable" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  function copySettings() {
    const source = branches.find((item) => item.id === copyFrom);
    if (!source) return;
    setForm((current) => ({
      ...current,
      openingHours: source.openingHours || defaultBranch.openingHours,
      pickup: source.pickup || defaultBranch.pickup,
      paymentMethods: source.paymentMethods || defaultBranch.paymentMethods,
      acceptedCurrencies: source.acceptedCurrencies || defaultBranch.acceptedCurrencies,
      fulfilment: source.fulfilment || current.fulfilment
    }));
    toast(`Hours and operating settings copied from ${source.branchName || source.name}.`, { title: "Settings copied" });
  }

  async function submit(event) {
    event.preventDefault();
    const primaryBranch = branch ? isPrimaryBranch(branch, business, branches) : branches.length === 0;
    const launchCriticalLocationChanged = primaryBranch && (!branch
      || String(form.name || form.branchName || "").trim() !== String(branch.branchName || branch.name || "").trim()
      || String(form.city || "").trim() !== String(branch.city || "").trim()
      || String(form.address || "").trim() !== String(branch.address || "").trim()
      || Number(form.location?.lat || 0) !== Number(branch.location?.lat || 0)
      || Number(form.location?.lng || 0) !== Number(branch.location?.lng || 0));
    if (launchCriticalLocationChanged && ["in_review", "complete"].includes(lifecycle?.launchReview?.state) && !window.confirm("This changes the primary launch location. Your current launch decision will need to be reviewed again. Continue?")) return;
    setLoading(true);
    setTask({ open: true, state: "processing", title: branch ? `Updating ${locationNoun}` : `Creating ${locationNoun}`, description: "Spotly is saving the details and updating who can see this location.", active: 1 });
    try {
      await saveBranch(form, selectedBusinessId, business.organizationId, user);
      await refreshBranches(selectedBusinessId);
      if (launchCriticalLocationChanged) {
        await markLaunchCriticalBusinessChange(selectedBusinessId, {
          id: "primary_location",
          label: "Primary location changed",
          description: "The primary location name, city, or address changed after a launch review decision.",
          href: businessHref("/business/branches", { businessId: selectedBusinessId })
        });
      }
      setTask({ open: true, state: "success", title: branch ? `${locationNoun} updated` : `${locationNoun} created`, description: launchCriticalLocationChanged && lifecycle?.stage === "live" ? "The location is saved. The live business remains operational while Spotly re-reviews this launch-critical location change." : lifecycle?.stage === "live" && !branch ? "The location is saved in Business and is waiting for Spotly review before customer publication." : "The location, hours, and operating settings are saved to this business.", active: 4 });
      toast(branch ? "Location changes saved." : "Location added to the business.", { title: "Saved" });
    } catch (error) {
      setTask({ open: true, state: "error", title: "Could not save this location", description: error.message, active: 1 });
    } finally {
      setLoading(false);
    }
  }

  function finishTask() {
    const succeeded = task.state === "success";
    setTask((current) => ({ ...current, open: false }));
    if (succeeded) onClose();
  }

  return <>
    <Modal open={open && !task.open} onClose={onClose} title={branch ? `Edit ${locationNoun}` : `Add ${locationNoun}`} size="xl">
      <form onSubmit={submit}>
        <div className="border-b px-5 py-4"><Tabs value={tab} onChange={setTab} tabs={tabs} /></div>
        <div className="p-5">
          {!branch && branches.length > 0 && <div className="mb-5 rounded-2xl bg-business-soft p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><FieldLabel label={`Copy operating settings from another ${locationNoun}`} className="flex-1"><select value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)} className={selectClass}><option value="">Choose a location</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.branchName || item.name}</option>)}</select></FieldLabel><Button type="button" variant="outline" onClick={copySettings} disabled={!copyFrom}><Copy className="h-4 w-4" />Copy settings</Button></div></div>}

          {tab === "details" && <div className="space-y-4">
            <div className="rounded-2xl bg-grouped p-4 text-sm leading-6 text-secondary"><strong className="text-ink">{business?.brandName || business?.name}</strong> is the business brand. This screen adds or edits one physical or service location underneath it.</div>
            <div className="grid gap-4 sm:grid-cols-2"><FieldLabel label={`${locationNoun[0].toUpperCase()}${locationNoun.slice(1)} name`} required hint="Use a short location label, not the business name. Example: Avondale or Main venue."><input required value={form.name || ""} onChange={(event) => update({ name: event.target.value, branchName: event.target.value })} className={fieldClass} placeholder="Main location" /></FieldLabel><FieldLabel label="City or town" required><input required value={form.city || ""} onChange={(event) => update({ city: event.target.value })} className={fieldClass} list="zimbabwe-branch-cities" /><datalist id="zimbabwe-branch-cities">{zimbabweCities.map((item) => <option key={item} value={item} />)}</datalist></FieldLabel></div>
            <FieldLabel label="Street address" required hint="Include the building, shopping centre, street, and suburb where useful."><input required value={form.address || ""} onChange={(event) => update({ address: event.target.value })} className={fieldClass} autoComplete="street-address" /></FieldLabel>
            <section className="rounded-2xl border bg-[var(--surface)] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${form.location?.lat != null && form.location?.lng != null ? "bg-[var(--success-soft)] text-success" : "bg-business-soft text-business"}`}><MapPin className="h-5 w-5" /></span><div><p className="text-sm font-bold">Map pin</p><p className="mt-1 max-w-xl text-xs leading-5 text-secondary">Used for delivery routing, nearby discovery, and accurate pickup directions. Only capture it while you are physically at this location.</p></div></div>
                <Button type="button" variant="outline" loading={locating} onClick={useCurrentLocation}><MapPin className="h-4 w-4" />{form.location?.lat != null ? "Update map pin" : "Use this device here"}</Button>
              </div>
              {form.location?.lat != null && form.location?.lng != null ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--success-soft)] px-4 py-3"><div><p className="text-sm font-semibold text-success">Map pin saved</p><p className="mt-1 text-xs text-secondary">{Number(form.location.lat).toFixed(5)}, {Number(form.location.lng).toFixed(5)}{form.location.accuracy ? ` · about ${Math.round(form.location.accuracy)} m accuracy` : ""}</p></div><Button type="button" size="sm" variant="ghost" onClick={() => update({ location: null })}>Remove pin</Button></div> : <div className="mt-4 rounded-xl bg-[var(--warning-soft)] px-4 py-3 text-sm text-warning">Add the pin before enabling delivery from this location.</div>}
            </section>
            <div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Phone" required><input required value={form.phone || ""} onChange={(event) => update({ phone: event.target.value })} className={fieldClass} autoComplete="tel" placeholder="+263" /></FieldLabel><FieldLabel label="Location email"><input type="email" value={form.email || ""} onChange={(event) => update({ email: event.target.value })} className={fieldClass} autoComplete="email" /></FieldLabel></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={form.status === "active"} onChange={(event) => update({ status: event.target.checked ? "active" : "paused" })} /><span><span className="block text-sm font-semibold">{lifecycle?.canOperate ? "Location is operational" : "Location setup is active"}</span><span className="mt-1 block text-xs leading-5 text-secondary">{lifecycle?.canOperate ? "Pause it when the location is temporarily unavailable." : "This prepares the location for launch; it does not make the business customer-live yet."}</span></span></label><label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={form.public !== false} onChange={(event) => update({ public: event.target.checked })} /><span><span className="block text-sm font-semibold">{lifecycle?.canOperate ? "Show this location to customers" : "Ready to show when the business goes live"}</span><span className="mt-1 block text-xs leading-5 text-secondary">{lifecycle?.canOperate ? "Turn this off to hide this location from customers." : "This setting prepares customer visibility. The location stays private until the business is approved and live."}</span></span></label></div>
          </div>}

          {tab === "hours" && <div className="space-y-3">{days.map((day) => { const hours = form.openingHours?.[day] || {}; return <div key={day} className="grid items-center gap-3 rounded-2xl bg-grouped p-4 sm:grid-cols-[130px_110px_1fr_1fr]"><p className="font-semibold capitalize">{day}</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!hours.closed} onChange={(event) => updateHours(day, { closed: !event.target.checked })} />Open</label><input type="time" disabled={hours.closed} value={hours.open || ""} onChange={(event) => updateHours(day, { open: event.target.value })} className="h-11 rounded-xl border bg-[var(--surface)] px-3 disabled:opacity-50" aria-label={`${day} opening time`} /><input type="time" disabled={hours.closed} value={hours.close || ""} onChange={(event) => updateHours(day, { close: event.target.value })} className="h-11 rounded-xl border bg-[var(--surface)] px-3 disabled:opacity-50" aria-label={`${day} closing time`} /></div>; })}<p className="text-xs leading-5 text-secondary">Customers and staff always see the hours for the exact location they selected.</p></div>}

          {tab === "operations" && <div className="space-y-5">
            {pickupEnabled && <SectionCard title="Pickup capacity" description="Set realistic capacity so customers only see pickup times your team can fulfil"><div className="grid gap-4 p-5 sm:grid-cols-3"><FieldLabel label="Slot length"><select value={form.pickup?.slotMinutes || 30} onChange={(event) => update({ pickup: { ...form.pickup, slotMinutes: Number(event.target.value) } })} className={selectClass}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></FieldLabel><FieldLabel label="Orders per slot"><input type="number" min="1" value={form.pickup?.slotCapacity || 12} onChange={(event) => update({ pickup: { ...form.pickup, slotCapacity: Number(event.target.value) } })} className={fieldClass} /></FieldLabel><FieldLabel label="Preparation time"><input type="number" min="5" value={form.pickup?.preparationMinutes || 45} onChange={(event) => update({ pickup: { ...form.pickup, preparationMinutes: Number(event.target.value) } })} className={fieldClass} /></FieldLabel></div><label className="mx-5 mb-5 flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={form.pickup?.enabled !== false} onChange={(event) => update({ pickup: { ...form.pickup, enabled: event.target.checked }, fulfilment: event.target.checked ? ["pickup"] : ["profile"] })} /><span><span className="block text-sm font-semibold">Customer pickup enabled</span><span className="mt-1 block text-xs leading-5 text-secondary">Turn this off if this location should only display information.</span></span></label></SectionCard>}
            {!pickupEnabled && <SectionCard title="Customer action"><div className="p-5"><p className="text-sm leading-6 text-secondary">This business uses <strong className="text-ink">{archetype.label.toLowerCase()}</strong> workflows. Spotly will show the relevant booking, ticket, reservation, or contact action instead of grocery pickup controls.</p></div></SectionCard>}
            <SectionCard title="Currencies"><div className="flex flex-wrap gap-3 p-5">{["USD", "ZWG"].map((currency) => <label key={currency} className="flex min-w-36 items-center gap-3 rounded-xl bg-grouped p-4 text-sm font-semibold"><input type="checkbox" checked={form.acceptedCurrencies?.includes(currency)} onChange={(event) => update({ acceptedCurrencies: event.target.checked ? [...(form.acceptedCurrencies || []), currency] : (form.acceptedCurrencies || []).filter((item) => item !== currency) })} />{currency}</label>)}</div></SectionCard>
            <SectionCard title="Payment methods" description="Only show methods this location can actually accept"><div className="grid gap-3 p-5 sm:grid-cols-2">{paymentMethods.map((method) => <label key={method.id} className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={form.paymentMethods?.includes(method.id)} onChange={(event) => update({ paymentMethods: event.target.checked ? [...(form.paymentMethods || []), method.id] : (form.paymentMethods || []).filter((item) => item !== method.id) })} /><span><span className="block text-sm font-semibold">{method.label}</span><span className="mt-1 block text-xs leading-5 text-secondary">{method.description}</span></span></label>)}</div></SectionCard>
          </div>}
        </div>
        <div className="flex gap-3 border-t p-5"><Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" loading={loading}><Check className="h-4 w-4" />Save location</Button></div>
      </form>
    </Modal>
    <FullScreenTask open={task.open} state={task.state} title={task.title} description={task.description} steps={["Validate location details", "Save operating settings", "Update customer visibility", "Refresh team access"]} activeStep={task.active} onDone={finishTask} doneLabel={task.state === "success" ? "Return to locations" : "Review details"} />
  </>;
}

function hoursSummary(branch) {
  const today = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "Africa/Harare" }).format(new Date()).toLowerCase();
  const hours = branch.openingHours?.[today];
  if (!hours || hours.closed) return "Closed today";
  return `${hours.open || "—"}–${hours.close || "—"} today`;
}

export function BranchesView() {
  const { branches, branchesLoading, branchesError, refreshBranches, business, user, selectedBusinessId, archetype, membership, lifecycle } = useBusinessWorkspace();
  const locationNoun = archetype.nouns.branch || "location";
  const permissions = membership?.permissions || [];
  const canManageAll = ["organization_owner", "business_owner", "business_manager"].includes(membership?.role) || permissions.includes("*") || permissions.includes("branches.*") || permissions.includes("branches.manage");
  const canEdit = canManageAll || membership?.role === "branch_manager" || permissions.includes("branches.update");
  const pickupEnabled = archetype.capabilities.includes("pickup_orders");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const handledDeepLink = useRef("");
  const { toast } = useToast();

  function edit(branch = null) { setEditing(branch); setOpen(true); }

  useEffect(() => {
    if (branchesLoading || branchesError) return;
    const key = searchParams.get("action") === "add" ? "add" : searchParams.get("edit") ? `edit:${searchParams.get("edit")}` : "";
    if (!key || handledDeepLink.current === key) return;
    handledDeepLink.current = key;
    if (key === "add" && canManageAll) { edit(); return; }
    const requested = searchParams.get("edit");
    if (requested && canEdit) {
      const target = branches.find((item) => item.id === requested);
      if (target) edit(target);
    }
  }, [branches, branchesError, branchesLoading, canEdit, canManageAll, searchParams]);
  async function remove() {
    if (!removeTarget) return;
    setLoading(true);
    try {
      const primaryBranch = isPrimaryBranch(removeTarget, business, branches);
      if (primaryBranch && ["in_review", "complete"].includes(lifecycle?.launchReview?.state) && !window.confirm("Removing the primary location requires the launch decision to be reviewed again. Continue?")) { setLoading(false); return; }
      await deleteBranch(removeTarget.id, selectedBusinessId, user);
      await refreshBranches(selectedBusinessId);
      if (primaryBranch) await markLaunchCriticalBusinessChange(selectedBusinessId, { id: "primary_location_removed", label: "Primary location removed", description: "The primary launch location was removed after a launch review decision.", href: businessHref("/business/branches", { businessId: selectedBusinessId }) });
      toast("Location removed.", { title: "Location deleted" }); setRemoveTarget(null);
    }
    catch (error) { toast(error.message, { type: "error", title: "Could not delete location" }); }
    finally { setLoading(false); }
  }

  const plural = `${locationNoun[0].toUpperCase()}${locationNoun.slice(1)}s`;
  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader title={plural} description={`Manage the exact ${locationNoun}s customers and staff can select under ${business?.brandName || business?.name}.`} actions={canManageAll && !branchesLoading && !branchesError ? <Button onClick={() => edit()}><Plus className="h-4 w-4" />Add {locationNoun}</Button> : null} /><BusinessSwitcher /></div>
    <Card className="border-business/15 bg-business-soft/50 p-5"><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-business" /><div><p className="font-bold">One brand, clearly separated locations</p><p className="mt-1 text-sm leading-6 text-secondary">A location does not become a separate business. You only see locations assigned to your account; owners and authorized managers can add or remove locations.</p></div></div></Card>
    {branchesError ? <Card variant="bordered" className="border-danger/30 bg-danger-soft p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Locations could not be loaded</p><p className="mt-1 text-sm leading-6 text-secondary">{branchesError}</p></div><Button variant="outline" loading={branchesLoading} onClick={() => refreshBranches(selectedBusinessId).catch(() => {})}>Try again</Button></div></Card> : branchesLoading && !branches.length ? <SectionCard><div className="p-8 text-center"><p className="font-semibold">Loading locations…</p><p className="mt-2 text-sm text-secondary">Checking the saved locations for this business.</p></div></SectionCard> : branches.length ? <div className="grid gap-5 lg:grid-cols-2">{branches.map((branch) => <Card key={branch.id} className="overflow-hidden"><div className="p-5"><div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-business-soft text-business"><Store className="h-6 w-6" /></span><div className="flex flex-wrap justify-end gap-2"><StatusBadge status={branch.status || "active"} />{["pending", "pending_launch_review"].includes(branch.reviewStatus) ? <Badge tone="warning">Waiting on Spotly</Badge> : branch.reviewStatus === "changes_requested" ? <Badge tone="danger">Changes requested</Badge> : branch.reviewStatus === "rejected" ? <Badge tone="danger">Not approved</Badge> : branch.reviewStatus === "approved" ? <Badge tone="success">Reviewed</Badge> : null}{branch.public !== false ? <Badge tone={lifecycle?.canOperate ? "success" : "neutral"}>{lifecycle?.canOperate ? "Customer-visible" : "Ready when live"}</Badge> : <Badge tone="neutral">Not customer-visible</Badge>}</div></div><p className="mt-5 text-xs font-semibold uppercase tracking-[.14em] text-tertiary">{business?.brandName || business?.name}</p><h2 className="mt-1 text-xl font-semibold">{branch.branchName || branch.name}</h2><p className="mt-2 text-sm leading-6 text-secondary">{branch.address || "Address needs confirmation"} · {branch.city || "Zimbabwe"}</p><div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${branch.location?.lat != null && branch.location?.lng != null ? "bg-[var(--success-soft)] text-success" : "bg-[var(--warning-soft)] text-warning"}`}><MapPin className="h-3.5 w-3.5" />{branch.location?.lat != null && branch.location?.lng != null ? "Map pin ready" : "Map pin needed for delivery"}</div>{branch.reviewStatus === "changes_requested" && branch.reviewReason ? <div className="mt-4 rounded-xl bg-[var(--danger-soft)] p-3 text-sm leading-6 text-danger"><strong>Spotly requested changes:</strong> {branch.reviewReason}</div> : null}<div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-grouped p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-business" />{hoursSummary(branch)}</div><p className="mt-2 text-xs text-secondary">{pickupEnabled ? branch.pickup?.enabled === false ? "Pickup disabled" : `${branch.pickup?.slotMinutes || 30}-minute pickup slots` : `${archetype.label} location`}</p></div><div className="rounded-2xl bg-grouped p-4"><div className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4 text-business" />{branch.paymentMethods?.length || 0} payment methods</div><p className="mt-2 text-xs text-secondary">{(branch.acceptedCurrencies || ["USD", "ZWG"]).join(" and ")}</p></div></div></div><div className="flex gap-2 border-t p-4">{canEdit ? <Button variant="outline" className="flex-1" onClick={() => edit(branch)}><Edit3 className="h-4 w-4" />Edit {locationNoun}</Button> : <p className="flex-1 px-2 py-2 text-sm text-secondary">You have view-only access to this {locationNoun}.</p>}{canManageAll && <Button size="icon" variant="ghost" onClick={() => setRemoveTarget(branch)} aria-label={`Delete ${branch.branchName || branch.name}`}><Trash2 className="h-4 w-4 text-danger" /></Button>}</div></Card>)}</div> : <SectionCard><EmptyState icon={MapPin} title={`Add the first ${locationNoun}`} description={`This holds the address, contact details, hours, customer action, and staff scope for one ${locationNoun}.`} action={canManageAll ? <Button onClick={() => edit()}><Plus className="h-4 w-4" />Add {locationNoun}</Button> : <Button href={businessHref("/business/support", { businessId: selectedBusinessId })} variant="outline">Ask for access</Button>} /></SectionCard>}
    <BranchModal branch={editing} open={open} onClose={() => setOpen(false)} />
    <ConfirmDialog open={Boolean(removeTarget)} onClose={() => setRemoveTarget(null)} title={`Delete this ${locationNoun}?`} description={`${removeTarget?.branchName || removeTarget?.name || "This location"} will no longer be available to customers or staff. A business must keep at least one location.`} confirmLabel="Delete location" danger loading={loading} onConfirm={remove} />
  </div>;
}
