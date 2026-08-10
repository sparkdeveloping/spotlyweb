"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bike, CheckCircle2, Clock3, MapPin, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { Badge, Button, Card, EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { formatCurrency } from "@/lib/format";

const label = (value = "") => String(value).replaceAll("_", " ");
const terminal = new Set(["delivered", "failed", "cancelled", "returned"]);

export function DeliveryView() {
  const { selectedBusinessId, selectedBranch, branches, selectedBranchId, setSelectedBranchId } = useBusinessWorkspace();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyJob, setBusyJob] = useState("");
  const [form, setForm] = useState({ enabled: false, paused: false, latitude: "", longitude: "", radiusKm: 8, preparationMinutes: 20, pickupPoint: "", pickupInstructions: "", contactPhone: "", vehicleTypes: ["motorcycle", "car"] });

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

  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    const delivery = selectedBranch?.delivery || {};
    setForm({
      enabled: Boolean(delivery.enabled), paused: Boolean(delivery.paused),
      latitude: delivery.location?.lat ?? selectedBranch?.location?.lat ?? selectedBranch?.lat ?? "",
      longitude: delivery.location?.lng ?? selectedBranch?.location?.lng ?? selectedBranch?.lng ?? "",
      radiusKm: Number(delivery.radiusKm || 8), preparationMinutes: Number(delivery.preparationMinutes || 20),
      pickupPoint: delivery.pickupPoint || "", pickupInstructions: delivery.pickupInstructions || "", contactPhone: delivery.contactPhone || "",
      vehicleTypes: delivery.vehicleTypes?.length ? delivery.vehicleTypes : ["motorcycle", "car"]
    });
  }, [selectedBranch]);

  async function save() {
    if (!selectedBranchId) return;
    setSaving(true); setError("");
    try {
      await authenticatedFetch("/api/business/delivery", { method: "POST", body: JSON.stringify({ action: "configure", businessId: selectedBusinessId, branchId: selectedBranchId, delivery: { ...form, latitude: form.latitude === "" ? undefined : Number(form.latitude), longitude: form.longitude === "" ? undefined : Number(form.longitude), radiusKm: Number(form.radiusKm), preparationMinutes: Number(form.preparationMinutes) } }) });
      await load();
    } catch (reason) { setError(reason.message); } finally { setSaving(false); }
  }

  function useLocation() {
    if (!navigator.geolocation) return setError("Location is not available on this device.");
    navigator.geolocation.getCurrentPosition((position) => setForm((current) => ({ ...current, latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) })), (reason) => setError(reason.message || "The location could not be read."), { enableHighAccuracy: true, timeout: 12000 });
  }

  async function jobAction(job, action, extra = {}) {
    setBusyJob(job.id); setError("");
    try { await authenticatedFetch("/api/business/delivery", { method: "POST", body: JSON.stringify({ action, businessId: selectedBusinessId, deliveryJobId: job.id, ...extra }) }); await load(); }
    catch (reason) { setError(reason.message); } finally { setBusyJob(""); }
  }

  const branchJobs = useMemo(() => jobs.filter((job) => !selectedBranchId || job.branchId === selectedBranchId).sort((a,b)=>String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||""))), [jobs, selectedBranchId]);
  const active = branchJobs.filter((job) => !terminal.has(job.state));

  if (!branches.length) return <div className="space-y-6"><PageHeader eyebrow="Fulfilment" title="Delivery" description="Delivery is configured per exact business location."/><Card variant="bordered" className="p-8 text-center"><MapPin className="mx-auto h-9 w-9 text-[var(--accent)]"/><h2 className="mt-4 text-xl font-semibold">Add the pickup location first</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-secondary">Drivers need a real branch with an address before Spotly can configure pickup coordinates, service radius, handoff instructions, or dispatch.</p><Button asChild className="mt-5"><Link href={`/business/branches?business=${encodeURIComponent(selectedBusinessId)}`}>Add location</Link></Button></Card></div>;

  return <div className="space-y-6"><PageHeader eyebrow="Fulfilment" title="Delivery" description="Configure this location, prepare delivery orders, and hand them to the assigned Driver without leaving Spotly Business." actions={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4"/>Refresh</Button>} />
    {error && <div className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]"><AlertTriangle className="mr-2 inline h-4 w-4"/>{error}</div>}
    {branches.length > 1 && <label className="block max-w-sm text-sm font-semibold">Location<select className="field-control mt-2 w-full" value={selectedBranchId || ""} onChange={(event)=>setSelectedBranchId(event.target.value)}>{branches.map((branch)=><option key={branch.id} value={branch.id}>{branch.branchName || branch.name || branch.displayName}</option>)}</select></label>}
    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><SectionCard title="Delivery setup" description="Delivery belongs to the exact location, not only the business brand."><div className="space-y-4">
      <label className="flex items-start gap-3 rounded-xl bg-[var(--surface-2)] p-4"><input className="mt-1" type="checkbox" checked={form.enabled} onChange={(e)=>setForm({...form,enabled:e.target.checked})}/><span><span className="block font-semibold">Customers can get delivery from this location</span><span className="mt-1 block text-sm text-secondary">Pickup can remain enabled at the same time.</span></span></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Latitude<input className="field-control mt-2 w-full" inputMode="decimal" value={form.latitude} onChange={(e)=>setForm({...form,latitude:e.target.value})}/></label><label className="text-sm font-semibold">Longitude<input className="field-control mt-2 w-full" inputMode="decimal" value={form.longitude} onChange={(e)=>setForm({...form,longitude:e.target.value})}/></label></div>
      <Button type="button" variant="outline" onClick={useLocation}><MapPin className="h-4 w-4"/>Use this device location</Button>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Delivery radius (km)<input className="field-control mt-2 w-full" type="number" min="0.5" max="100" step="0.5" value={form.radiusKm} onChange={(e)=>setForm({...form,radiusKm:e.target.value})}/></label><label className="text-sm font-semibold">Normal preparation time (min)<input className="field-control mt-2 w-full" type="number" min="0" max="1440" value={form.preparationMinutes} onChange={(e)=>setForm({...form,preparationMinutes:e.target.value})}/></label></div>
      <label className="block text-sm font-semibold">Driver pickup point<input className="field-control mt-2 w-full" value={form.pickupPoint} onChange={(e)=>setForm({...form,pickupPoint:e.target.value})} placeholder="Example: Collections desk by the east entrance"/></label>
      <label className="block text-sm font-semibold">Driver pickup instructions<textarea className="field-control mt-2 min-h-24 w-full" value={form.pickupInstructions} onChange={(e)=>setForm({...form,pickupInstructions:e.target.value})} placeholder="Tell Drivers exactly where to go and who to ask for."/></label>
      <label className="block text-sm font-semibold">Pickup contact phone<input className="field-control mt-2 w-full" value={form.contactPhone} onChange={(e)=>setForm({...form,contactPhone:e.target.value})}/></label>
      <div><p className="text-sm font-semibold">Supported vehicles</p><div className="mt-2 flex flex-wrap gap-2">{["motorcycle","car","van","bicycle"].map((type)=>{const on=form.vehicleTypes.includes(type);return <button key={type} type="button" onClick={()=>setForm({...form,vehicleTypes:on?form.vehicleTypes.filter((v)=>v!==type):[...form.vehicleTypes,type]})} className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${on?"border-[var(--accent)] bg-[var(--accent-soft)]":"bg-[var(--surface)]"}`}>{type}</button>})}</div></div>
      <label className="flex items-center gap-3"><input type="checkbox" checked={form.paused} onChange={(e)=>setForm({...form,paused:e.target.checked})}/><span className="text-sm font-semibold">Temporarily pause new delivery orders</span></label>
      <Button loading={saving} onClick={save}>Save delivery setup</Button>
    </div></SectionCard>
    <SectionCard title="Location readiness"><div className="space-y-3">{[
      [form.enabled,"Delivery enabled"], [Number.isFinite(Number(form.latitude))&&Number.isFinite(Number(form.longitude)),"Map location added"], [Boolean(form.pickupPoint),"Pickup point explained"], [Boolean(form.pickupInstructions),"Driver instructions added"], [Boolean(form.contactPhone),"Pickup contact added"], [form.vehicleTypes.length>0,"Vehicle types selected"]
    ].map(([ok,text])=><div key={text} className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] p-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ok?"bg-[var(--success-soft)] text-success":"bg-[var(--warning-soft)] text-warning"}`}>{ok?<CheckCircle2 className="h-4 w-4"/>:<AlertTriangle className="h-4 w-4"/>}</span><span className="text-sm font-medium">{text}</span></div>)}</div></SectionCard></div>
    <SectionCard title={`Active deliveries (${active.length})`} description="Mark an order ready only after payment and packing are complete.">{loading ? <div className="py-12 text-center text-sm text-secondary">Loading deliveries…</div> : branchJobs.length ? <div className="divide-y">{branchJobs.map((job)=><DeliveryRow key={job.id} job={job} busy={busyJob===job.id} onAction={jobAction}/>)}</div> : <EmptyState icon={Truck} title="No delivery orders yet" description="Customer delivery orders from this location will appear here."/>}</SectionCard>
  </div>;
}

function DeliveryRow({ job, busy, onAction }) {
  const [bags,setBags]=useState(Number(job.bagCount||1)); const [chilled,setChilled]=useState(Number(job.chilledBagCount||0)); const [delay,setDelay]=useState(10);
  const preparing=["awaiting_dispatch"].includes(job.state)&&!job.businessReadyAt&&!job.assignedDriverId;
  return <div className="py-5 first:pt-0 last:pb-0"><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">{job.assignedDriverId?<Bike className="h-5 w-5"/>:<PackageCheck className="h-5 w-5"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{job.number || job.id}</h3><StatusBadge status={label(job.state)}/>{job.exceptionCode&&<Badge tone="warning">{label(job.exceptionCode)}</Badge>}</div><p className="mt-1 text-sm text-secondary">{job.dropoff?.suburb || job.dropoff?.formattedAddress || "Customer address"}</p><p className="mt-2 text-xs text-tertiary">Driver pay {formatCurrency(job.acceptedDriverPay||job.quotedDriverPay||0,job.currency)} · {job.assignedDriverId?`Driver ${job.assignedDriverId.slice(0,8)}…`:"No Driver assigned yet"}</p></div></div>
    {!terminal.has(job.state)&&<div className="mt-4 rounded-xl bg-[var(--surface-2)] p-4">{preparing?<><p className="text-sm font-semibold">Packing complete?</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Bags<input className="field-control mt-1 w-full" type="number" min="1" value={bags} onChange={(e)=>setBags(Number(e.target.value))}/></label><label className="text-xs font-semibold">Chilled bags<input className="field-control mt-1 w-full" type="number" min="0" value={chilled} onChange={(e)=>setChilled(Number(e.target.value))}/></label></div><div className="mt-3 flex flex-wrap gap-2"><Button loading={busy} onClick={()=>onAction(job,"ready",{bagCount:bags,chilledBagCount:chilled})}>Ready — find a Driver</Button><label className="flex items-center gap-2 text-xs font-semibold"><Clock3 className="h-4 w-4"/><input className="field-control h-10 w-20" type="number" min="5" max="240" value={delay} onChange={(e)=>setDelay(Number(e.target.value))}/><Button size="sm" variant="outline" loading={busy} onClick={()=>onAction(job,"delay",{minutes:delay,reason:"Business preparation delay"})}>Need more time</Button></label></div></>:<p className="text-sm text-secondary">{job.state === "driver_arrived_pickup" || job.state === "pickup_verification" ? `Driver is at the location. Verify ${job.bagCount||1} bag${job.bagCount===1?"":"s"} before handoff.` : job.assignedDriverId ? "A Driver is assigned. Spotly will keep this status synchronized with the Driver app." : "Spotly is searching for an eligible Driver."}</p>}</div>}
  </div>;
}
