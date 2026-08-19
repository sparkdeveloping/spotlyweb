"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bike, CheckCircle2, Clock3, MapPin, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { Badge, Button, Card, EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { WorkspaceContextSwitcher } from "@/components/business/shared";
import { formatCurrency } from "@/lib/format";

const label = (value = "") => String(value).replaceAll("_", " ");
const terminal = new Set(["delivered", "failed", "cancelled", "returned"]);
const vehicleOptions = [
  { id: "motorcycle", label: "Motorcycle" },
  { id: "car", label: "Car" },
  { id: "van", label: "Van" },
  { id: "bicycle", label: "Bicycle" }
];

function validPoint(value) {
  return value && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng));
}

export function DeliveryView() {
  const { selectedBusinessId, selectedBranch, branches, branchesLoading, branchesError, refreshBranches, selectedBranchId } = useBusinessWorkspace();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyJob, setBusyJob] = useState("");
  const [form, setForm] = useState({ enabled: false, paused: false, radiusKm: 8, preparationMinutes: 20, pickupPoint: "", pickupInstructions: "", contactPhone: "", vehicleTypes: ["motorcycle", "car"] });

  const load = useCallback(async () => {
    if (!selectedBusinessId) return;
    setLoading(true);
    try {
      const result = await authenticatedFetch(`/api/business/delivery?businessId=${encodeURIComponent(selectedBusinessId)}`, { cache: "no-store" });
      setJobs(result.deliveries || []);
      setError("");
    } catch (reason) {
      setError(reason.message || "Delivery operations could not load.");
    } finally {
      setLoading(false);
    }
  }, [selectedBusinessId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const delivery = selectedBranch?.delivery || {};
    setForm({
      enabled: Boolean(delivery.enabled),
      paused: Boolean(delivery.paused),
      radiusKm: Number(delivery.radiusKm || 8),
      preparationMinutes: Number(delivery.preparationMinutes || 20),
      pickupPoint: delivery.pickupPoint || "",
      pickupInstructions: delivery.pickupInstructions || "",
      contactPhone: delivery.contactPhone || selectedBranch?.phone || "",
      vehicleTypes: delivery.vehicleTypes?.length ? delivery.vehicleTypes : ["motorcycle", "car"]
    });
    setSaved("");
  }, [selectedBranch]);

  const mapLocation = validPoint(selectedBranch?.location)
    ? selectedBranch.location
    : validPoint(selectedBranch?.delivery?.location)
      ? selectedBranch.delivery.location
      : null;

  async function save() {
    if (!selectedBranchId) return;
    if (form.enabled && !mapLocation) {
      setError("Add a map pin to this location before turning on delivery. Spotly uses that pin for dispatch and service-radius checks.");
      return;
    }
    if (form.enabled && !String(form.pickupPoint || "").trim()) {
      setError("Tell Drivers exactly where to collect orders at this location.");
      return;
    }
    if (form.enabled && !String(form.contactPhone || "").trim()) {
      setError("Add a pickup contact phone before turning on delivery.");
      return;
    }
    setSaving(true);
    setError("");
    setSaved("");
    try {
      await authenticatedFetch("/api/business/delivery", {
        method: "POST",
        body: JSON.stringify({
          action: "configure",
          businessId: selectedBusinessId,
          branchId: selectedBranchId,
          delivery: {
            ...form,
            latitude: mapLocation ? Number(mapLocation.lat) : undefined,
            longitude: mapLocation ? Number(mapLocation.lng) : undefined,
            radiusKm: Number(form.radiusKm),
            preparationMinutes: Number(form.preparationMinutes)
          }
        })
      });
      await Promise.all([load(), refreshBranches(selectedBusinessId)]);
      setSaved("Delivery settings saved.");
    } catch (reason) {
      setError(reason.message || "Delivery settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function jobAction(job, action, extra = {}) {
    setBusyJob(job.id);
    setError("");
    try {
      await authenticatedFetch("/api/business/delivery", { method: "POST", body: JSON.stringify({ action, businessId: selectedBusinessId, deliveryJobId: job.id, ...extra }) });
      await load();
    } catch (reason) {
      setError(reason.message || "The delivery could not be updated.");
    } finally {
      setBusyJob("");
    }
  }

  const branchJobs = useMemo(() => jobs
    .filter((job) => !selectedBranchId || job.branchId === selectedBranchId)
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))), [jobs, selectedBranchId]);
  const active = branchJobs.filter((job) => !terminal.has(job.state));
  const setupComplete = Boolean(form.enabled && mapLocation && form.pickupPoint && form.pickupInstructions && form.contactPhone && form.vehicleTypes.length);

  if (branchesError) return <div className="space-y-6"><PageHeader eyebrow="Fulfilment" title="Delivery" description="Delivery is configured per exact business location."/><Card variant="bordered" className="p-8 text-center"><AlertTriangle className="mx-auto h-9 w-9 text-danger"/><h2 className="mt-4 text-xl font-semibold">Locations could not be loaded</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-secondary">{branchesError}</p><Button className="mt-5" variant="outline" loading={branchesLoading} onClick={() => refreshBranches(selectedBusinessId).catch(() => {})}>Try again</Button></Card></div>;
  if (branchesLoading && !branches.length) return <div className="space-y-6"><PageHeader eyebrow="Fulfilment" title="Delivery" description="Delivery is configured per exact business location."/><Card variant="bordered" className="p-8 text-center"><p className="font-semibold">Loading locations…</p></Card></div>;
  if (!branches.length) return <div className="space-y-6"><PageHeader eyebrow="Fulfilment" title="Delivery" description="Delivery is configured per exact business location."/><Card variant="bordered" className="p-8 text-center"><MapPin className="mx-auto h-9 w-9 text-[var(--accent)]"/><h2 className="mt-4 text-xl font-semibold">Add the pickup location first</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-secondary">Drivers need a real location with an address and map pin before Spotly can configure dispatch.</p><Button asChild className="mt-5"><Link href={`/business/branches?business=${encodeURIComponent(selectedBusinessId)}`}>Add location</Link></Button></Card></div>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <PageHeader eyebrow="Fulfilment" title="Delivery" description="Set the delivery promise once for this location, then manage live handoffs below." actions={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4"/>Refresh</Button>} />
      <WorkspaceContextSwitcher />
    </div>

    {error && <div role="alert" className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]"><AlertTriangle className="mr-2 inline h-4 w-4"/>{error}</div>}
    {saved && <div role="status" className="rounded-xl bg-[var(--success-soft)] p-4 text-sm font-semibold text-success"><CheckCircle2 className="mr-2 inline h-4 w-4"/>{saved}</div>}

    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <SectionCard title="Delivery setup" description={`These settings apply only to ${selectedBranch?.branchName || selectedBranch?.name || "this location"}.`}>
        <div className="space-y-5">
          <label className="flex items-start gap-3 rounded-xl bg-[var(--surface-2)] p-4">
            <input className="mt-1" type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })}/>
            <span><span className="block font-semibold">Offer delivery from this location</span><span className="mt-1 block text-sm text-secondary">Customers can still choose pickup when pickup is enabled.</span></span>
          </label>

          <div className={`rounded-xl border p-4 ${mapLocation ? "border-[var(--success)]/20 bg-[var(--success-soft)]/45" : "border-[var(--warning)]/25 bg-[var(--warning-soft)]/45"}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mapLocation ? "bg-[var(--success-soft)] text-success" : "bg-[var(--warning-soft)] text-warning"}`}><MapPin className="h-5 w-5"/></span><div><p className="text-sm font-bold">Pickup map pin</p><p className="mt-1 text-xs leading-5 text-secondary">{mapLocation ? "Saved with this location and used automatically for Driver routing." : "No map pin is saved for this location yet."}</p>{mapLocation && <p className="mt-1 text-xs text-tertiary">{Number(mapLocation.lat).toFixed(5)}, {Number(mapLocation.lng).toFixed(5)}</p>}</div></div>
              <Button asChild size="sm" variant="outline"><Link href={`/business/branches?business=${encodeURIComponent(selectedBusinessId)}`}>{mapLocation ? "Update in Locations" : "Add map pin"}</Link></Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Delivery radius <span className="font-normal text-secondary">(km)</span><input className="field-control mt-2 w-full" type="number" min="0.5" max="100" step="0.5" value={form.radiusKm} onChange={(event) => setForm({ ...form, radiusKm: event.target.value })}/><span className="mt-1 block text-xs font-normal text-secondary">Customers outside this radius cannot choose delivery.</span></label>
            <label className="text-sm font-semibold">Typical preparation time <span className="font-normal text-secondary">(minutes)</span><input className="field-control mt-2 w-full" type="number" min="0" max="1440" value={form.preparationMinutes} onChange={(event) => setForm({ ...form, preparationMinutes: event.target.value })}/><span className="mt-1 block text-xs font-normal text-secondary">Helps Spotly avoid sending a Driver too early.</span></label>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="font-semibold">Driver handoff</h3>
            <p className="mt-1 text-sm text-secondary">Tell the Driver where to go when they reach this location.</p>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold">Pickup point<input className="field-control mt-2 w-full" value={form.pickupPoint} onChange={(event) => setForm({ ...form, pickupPoint: event.target.value })} placeholder="Example: Collections desk by the east entrance"/></label>
              <label className="block text-sm font-semibold">Pickup instructions<textarea className="field-control mt-2 min-h-24 w-full" value={form.pickupInstructions} onChange={(event) => setForm({ ...form, pickupInstructions: event.target.value })} placeholder="Example: Park by Gate B, enter through the side door, and ask for Online Orders."/></label>
              <label className="block text-sm font-semibold">Pickup contact phone<input className="field-control mt-2 w-full" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} placeholder="+263 …"/></label>
            </div>
          </div>

          <div><p className="text-sm font-semibold">Vehicles this location can hand orders to</p><p className="mt-1 text-xs text-secondary">Choose the vehicle types suitable for normal orders from this branch.</p><div className="mt-3 flex flex-wrap gap-2">{vehicleOptions.map((option) => { const on = form.vehicleTypes.includes(option.id); return <button key={option.id} type="button" aria-pressed={on} onClick={() => setForm({ ...form, vehicleTypes: on ? form.vehicleTypes.filter((value) => value !== option.id) : [...form.vehicleTypes, option.id] })} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${on ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "bg-[var(--surface)]"}`}>{option.label}</button>; })}</div></div>

          <label className="flex items-start gap-3 rounded-xl border p-4"><input className="mt-1" type="checkbox" checked={form.paused} onChange={(event) => setForm({ ...form, paused: event.target.checked })}/><span><span className="block text-sm font-semibold">Pause new delivery orders</span><span className="mt-1 block text-xs leading-5 text-secondary">Use this temporarily when the location cannot fulfil delivery. Existing deliveries remain visible.</span></span></label>
          <Button loading={saving} onClick={save}>Save delivery setup</Button>
        </div>
      </SectionCard>

      <SectionCard title="Ready for delivery?" description="Spotly checks the pieces needed for a clear Driver handoff.">
        <div className="space-y-3">{[
          [form.enabled, "Delivery is turned on"],
          [Boolean(mapLocation), "Location has a map pin"],
          [Boolean(form.pickupPoint), "Pickup point is clear"],
          [Boolean(form.pickupInstructions), "Driver instructions are added"],
          [Boolean(form.contactPhone), "Pickup contact is added"],
          [form.vehicleTypes.length > 0, "Vehicle types are selected"]
        ].map(([ok, text]) => <div key={text} className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] p-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ok ? "bg-[var(--success-soft)] text-success" : "bg-[var(--warning-soft)] text-warning"}`}>{ok ? <CheckCircle2 className="h-4 w-4"/> : <AlertTriangle className="h-4 w-4"/>}</span><span className="text-sm font-medium">{text}</span></div>)}</div>
        <div className={`mt-5 rounded-xl p-4 text-sm ${setupComplete ? "bg-[var(--success-soft)] text-success" : "bg-[var(--surface-2)] text-secondary"}`}>{setupComplete ? "This location has the core setup Spotly needs for delivery." : "Complete the highlighted items before relying on live dispatch from this location."}</div>
      </SectionCard>
    </div>

    <SectionCard title={`Active deliveries (${active.length})`} description="Mark an order ready only after payment and packing are complete.">{loading ? <div className="py-12 text-center text-sm text-secondary">Loading deliveries…</div> : branchJobs.length ? <div className="divide-y">{branchJobs.map((job) => <DeliveryRow key={job.id} job={job} busy={busyJob === job.id} onAction={jobAction}/>)}</div> : <EmptyState icon={Truck} title="No delivery orders yet" description="Customer delivery orders from this location will appear here."/>}</SectionCard>
  </div>;
}

function DeliveryRow({ job, busy, onAction }) {
  const [bags, setBags] = useState(Number(job.bagCount || 1));
  const [chilled, setChilled] = useState(Number(job.chilledBagCount || 0));
  const [delay, setDelay] = useState(10);
  const preparing = ["awaiting_dispatch"].includes(job.state) && !job.businessReadyAt && !job.assignedDriverId;
  return <div className="py-5 first:pt-0 last:pb-0">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">{job.assignedDriverId ? <Bike className="h-5 w-5"/> : <PackageCheck className="h-5 w-5"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{job.number || job.id}</h3><StatusBadge status={label(job.state)}/>{job.exceptionCode && <Badge tone="warning">{label(job.exceptionCode)}</Badge>}</div><p className="mt-1 text-sm text-secondary">{job.dropoff?.suburb || job.dropoff?.formattedAddress || "Customer address"}</p><p className="mt-2 text-xs text-tertiary">Driver pay {formatCurrency(job.acceptedDriverPay || job.quotedDriverPay || 0, job.currency)} · {job.assignedDriverId ? `Driver ${job.assignedDriverId.slice(0, 8)}…` : "No Driver assigned yet"}</p></div></div>
    {!terminal.has(job.state) && <div className="mt-4 rounded-xl bg-[var(--surface-2)] p-4">{preparing ? <><p className="text-sm font-semibold">Packing complete?</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Bags<input className="field-control mt-1 w-full" type="number" min="1" value={bags} onChange={(event) => setBags(Number(event.target.value))}/></label><label className="text-xs font-semibold">Chilled bags<input className="field-control mt-1 w-full" type="number" min="0" value={chilled} onChange={(event) => setChilled(Number(event.target.value))}/></label></div><div className="mt-3 flex flex-wrap gap-2"><Button loading={busy} onClick={() => onAction(job, "ready", { bagCount: bags, chilledBagCount: chilled })}>Ready — find a Driver</Button><label className="flex items-center gap-2 text-xs font-semibold"><Clock3 className="h-4 w-4"/><input className="field-control h-10 w-20" type="number" min="5" max="240" value={delay} onChange={(event) => setDelay(Number(event.target.value))}/><Button size="sm" variant="outline" loading={busy} onClick={() => onAction(job, "delay", { minutes: delay, reason: "Business preparation delay" })}>Need more time</Button></label></div></> : <p className="text-sm text-secondary">{job.state === "driver_arrived_pickup" || job.state === "pickup_verification" ? `Driver is at the location. Verify ${job.bagCount || 1} bag${job.bagCount === 1 ? "" : "s"} before handoff.` : job.assignedDriverId ? "A Driver is assigned. Spotly will keep this status synchronized with the Driver app." : "Spotly is searching for an eligible Driver."}</p>}</div>}
  </div>;
}
