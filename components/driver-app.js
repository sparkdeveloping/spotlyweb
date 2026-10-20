"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Bike, Camera, CarFront, CheckCircle2, CircleDollarSign, Clock3, FileCheck2, Gauge, IdCard,
   MapPin, Navigation, PackageCheck, Phone, ReceiptText, RefreshCw, ShieldCheck, ShoppingBasket, Truck, Upload, UserRound, WalletCards, WifiOff, X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { AuthGate } from "@/components/auth-gate";
import { Badge, Button, Card, EmptyState, PageHeader, PageSkeleton, SectionCard, StatusBadge } from "@/components/ui";
import { LottieEmptyState } from "@/components/spotly-lottie";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { authenticatedFetch } from "@/lib/api-client";
import { uploadFile } from "@/lib/firebase-services";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { NotificationCenter } from "@/components/notification-center";
import { DriverAssistShopping } from "@/components/driver-assist-shopping";
import { zimbabweCities } from "@/data/business-config";
import { DRIVER_CAPABILITIES, DRIVER_TRAINING_MODULES, capabilitySupportsVehicle, documentRequirementsFor, normalizeCapabilities, trainingModuleIsCurrent, trainingRequirementsFor } from "@/lib/driver-capabilities";

const sectionMeta = {
  home: { title: "Driver home", description: "Know if you can work, what is live now and what needs your attention." },
  jobs: { title: "Work", description: "Understand the actual work, route, time and guaranteed pay before accepting." },
  active: { title: "Active job", description: "The job is the product now. Complete one safe next action at a time." },
  earnings: { title: "Driver Money", description: "Today, available balances, payouts and earnings activity in plain language." },
  history: { title: "Activity", description: "Completed, cancelled and returned Ride, Delivery and Send work." },
  notifications: { title: "Driver notifications", description: "Offers, account actions, safety, application and payout updates." },
  support: { title: "Safety", description: "Urgent help, job-linked problems and Driver support without losing context." },
  profile: { title: "Account health", description: "Work approvals, vehicle, documents, payout and anything that could stop you earning." }
};

const APPLICATION_STEPS = ["Your details", "Work & vehicle", "Documents", "Work areas", "Getting paid", "Training & review"];
const DOCUMENTS = [
  { type: "identity", label: "Identification", helper: "Upload a clear Zimbabwe ID or other approved identity document." },
  { type: "licence", label: "Driver licence", helper: "Upload the licence you will use while delivering." },
  { type: "registration", label: "Vehicle registration", helper: "Upload the registration document for your vehicle." },
  { type: "insurance", label: "Vehicle insurance", helper: "Upload current insurance when the work you selected requires it." },
  { type: "vehicle_fitness", label: "Vehicle fitness / inspection", helper: "Passenger Ride work may require a current vehicle fitness or inspection record." }
];
const DRIVER_VEHICLES = [
  { id: "motorcycle", label: "Motorcycle", icon: Gauge },
  { id: "car", label: "Car", icon: CarFront },
  { id: "van", label: "Van", icon: Truck },
  { id: "bicycle", label: "Bicycle", icon: Bike }
];
const MOBILE_PAYOUT_PROVIDERS = ["EcoCash", "OneMoney", "InnBucks", "O'mari"];
const BANK_PAYOUT_PROVIDERS = ["CBZ", "Stanbic", "Steward Bank", "FBC", "CABS", "NMB", "ZB Bank", "First Capital Bank", "Nedbank Zimbabwe", "BancABC", "POSB", "Other bank"];
const EXPIRY_DOCUMENTS = new Set(["licence", "insurance", "vehicle_fitness"]);
const VEHICLE_SCOPED_DOCUMENTS = new Set(["registration", "insurance", "vehicle_fitness"]);


const ACTIVE_ACTIONS = {
  driver_assigned: { title: "Go to the business", button: "Start going to pickup", action: "start_to_pickup", destination: "pickup" },
  driver_to_pickup: { title: "Go to the business", button: "I arrived", action: "arrive_pickup", destination: "pickup" },
  driver_arrived_pickup: { title: "Collect the order", button: "Check pickup code", action: "begin_pickup_verification", destination: "pickup" },
  pickup_verification: { title: "Confirm pickup", button: "Order collected", action: "verify_pickup", code: "pickup" },
  collected: { title: "Ready to deliver", button: "Start delivery", action: "start_delivery", destination: "dropoff" },
  en_route: { title: "Go to the customer", button: "I arrived", action: "arrive_customer", destination: "dropoff" },
  driver_arrived_customer: { title: "Customer handoff", button: "Ask for delivery PIN", action: "begin_handoff", destination: "dropoff" },
  handoff_verification: { title: "Confirm delivery", button: "Complete delivery", action: "complete", code: "handoff" }
};

const ACTIVE_PARCEL_ACTIONS = {
  driver_assigned: { title: "Go to the sender", button: "Start going to pickup", action: "start_to_pickup", destination: "pickup" },
  driver_to_pickup: { title: "Go to the sender", button: "I arrived", action: "arrive_pickup", destination: "pickup" },
  driver_arrived_pickup: { title: "Collect the parcel", button: "Ask for pickup PIN", action: "begin_pickup_verification", destination: "pickup" },
  pickup_verification: { title: "Confirm pickup", button: "Parcel collected", action: "verify_pickup", code: "pickup" },
  collected: { title: "Ready to deliver", button: "Start delivery", action: "start_delivery", destination: "dropoff" },
  en_route: { title: "Go to the recipient", button: "I arrived", action: "arrive_dropoff", destination: "dropoff" },
  driver_arrived_dropoff: { title: "Recipient handoff", button: "Ask for delivery PIN", action: "begin_handoff", destination: "dropoff" },
  handoff_verification: { title: "Confirm delivery", button: "Complete Send", action: "complete", code: "handoff" }
};

function labelStatus(value = "") { return String(value).replaceAll("_", " "); }
function dateTime(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" }); }

function useDriverData() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true); setError("");
    try { setData(await authenticatedFetch("/api/driver/bootstrap")); }
    catch (err) { setError(err.message || "Driver information could not be loaded."); }
    finally { if (!quiet) setLoading(false); }
  }, []);
  useEffect(() => { load(); const timer = window.setInterval(() => load({ quiet: true }), 10000); return () => clearInterval(timer); }, [load]);
  return { data, loading, error, load };
}

function ProgressSteps({ current }) {
  return <div className="grid grid-cols-6 gap-2">{APPLICATION_STEPS.map((label, index) => <div key={label} className="min-w-0"><div className={cn("h-1.5 rounded-full", index <= current ? "bg-[var(--accent)]" : "bg-[var(--border)]")} /><p className={cn("mt-2 hidden truncate text-[11px] sm:block", index === current ? "font-semibold text-[var(--accent)]" : "text-tertiary")}>{label}</p></div>)}</div>;
}

function DriverApplication({ data, reload }) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const existing = data?.application || {};
  const vehicle = data?.vehicles?.[0] || {};
  const [step, setStep] = useState(Math.min(Number(existing.currentStep || 0), 5));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [openTraining, setOpenTraining] = useState("");
  const [trainingAnswers, setTrainingAnswers] = useState({});
  const [documentMeta, setDocumentMeta] = useState({});
  const [form, setForm] = useState({
    legalName: existing.legalName || profile?.displayName || user?.displayName || "",
    phone: existing.phone || profile?.phoneNumber || user?.phoneNumber || "",
    city: existing.city || "Harare",
    emergencyContactName: existing.emergencyContactName || "",
    emergencyContactPhone: existing.emergencyContactPhone || "",
    preferredZones: (existing.preferredZones || []).join(", "),
    vehicleType: vehicle.type || "motorcycle",
    requestedCapabilities: normalizeCapabilities(existing.requestedCapabilities || [], vehicle.type || "motorcycle"),
    registration: vehicle.registration || "",
    make: vehicle.make || "",
    model: vehicle.model || "",
    year: vehicle.year || "",
    ownership: vehicle.ownership || "driver_owned",
    payoutType: "mobile_money",
    payoutProvider: "EcoCash",
    payoutProviderOther: "",
    payoutName: existing.legalName || profile?.displayName || "",
    payoutIdentifier: "",
    agreementsAccepted: Boolean(existing.agreementsAccepted),
    locationConsent: Boolean(existing.locationConsent)
  });
  useEffect(() => { setStep(Math.min(Number(data?.application?.currentStep ?? step), 5)); }, [data?.application?.currentStep]);
  const uploaded = new Map((data?.documents || []).map((item) => [item.type, item]));
  const requestedCapabilities = form.requestedCapabilities.filter((id) => capabilitySupportsVehicle(id, form.vehicleType));
  const requiredDocumentTypes = documentRequirementsFor({ vehicleType: form.vehicleType, capabilities: requestedCapabilities });
  const requiredTraining = trainingRequirementsFor(requestedCapabilities);
  const reviewState = ["application_submitted", "under_review", "information_required", "approved", "rejected"].includes(existing.status) && !editing;

  function setVehicleType(vehicleType) {
    const nextCapabilities = normalizeCapabilities(form.requestedCapabilities, vehicleType).filter((id) => capabilitySupportsVehicle(id, vehicleType));
    setForm({ ...form, vehicleType, registration: vehicleType === "bicycle" ? "" : form.registration, requestedCapabilities: nextCapabilities });
  }
  function toggleCapability(capabilityId) {
    if (!capabilitySupportsVehicle(capabilityId, form.vehicleType)) return;
    const selected = form.requestedCapabilities.includes(capabilityId);
    setForm({ ...form, requestedCapabilities: selected ? form.requestedCapabilities.filter((id) => id !== capabilityId) : [...form.requestedCapabilities, capabilityId] });
  }
  async function saveStep(nextStep = step) {
    setSaving(true); setError("");
    try {
      const payload = { action: "save", application: {
        legalName: form.legalName, phone: form.phone, city: form.city, emergencyContactName: form.emergencyContactName, emergencyContactPhone: form.emergencyContactPhone,
        preferredZones: form.preferredZones.split(",").map((item) => item.trim()).filter(Boolean), requestedCapabilities, currentStep: nextStep,
        agreementsAccepted: form.agreementsAccepted, locationConsent: form.locationConsent
      } };
      // A brand-new applicant can save identity/contact details before vehicle setup exists.
      if (nextStep >= 2) payload.vehicle = { type: form.vehicleType, registration: form.vehicleType === "bicycle" ? "" : form.registration, make: form.make, model: form.model, year: form.year ? Number(form.year) : null, ownership: form.ownership, requestedCapabilities };
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify(payload) });
      await reload({ quiet: true });
      return true;
    } catch (err) { setError(err.message); return false; }
    finally { setSaving(false); }
  }
  async function nextStep() {
    if (step === 0 && (!form.legalName.trim() || !form.phone.trim() || !form.city.trim())) return setError("Add your name, phone and city before continuing.");
    if (step === 1 && requestedCapabilities.length === 0) return setError("Choose at least one kind of work you want to do.");
    if (step === 1 && form.vehicleType !== "bicycle" && !form.registration.trim()) return setError("Add your motor vehicle registration before continuing.");
    if (step === 1 && form.vehicleType !== "bicycle" && (!form.make.trim() || !form.model.trim())) return setError("Add the make and model of the motor vehicle before continuing.");
    if (step === 2 && requiredDocumentTypes.some((type) => !uploaded.has(type))) return setError("Upload each document required for the work and vehicle you selected.");
    if (step === 4 && !existing.payoutComplete && !form.payoutIdentifier.trim()) return setError("Add where Spotly should send your earnings.");
    if (step === 5 && (!form.agreementsAccepted || !form.locationConsent)) return setError("Accept the Driver and location terms before submitting.");
    if (!(await saveStep(Math.min(step + 1, 5)))) return;
    if (step === 4 && !existing.payoutComplete) {
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "payout", payout: { type: form.payoutType, provider: form.payoutProvider === "Other bank" ? form.payoutProviderOther : form.payoutProvider, recipientName: form.payoutName || form.legalName, identifier: form.payoutIdentifier } }) });
    }
    if (step < 5) setStep((value) => value + 1);
  }
  async function uploadDocument(type, file) {
    if (!file) return;
    const meta = documentMeta[type] || {};
    if (EXPIRY_DOCUMENTS.has(type) && !meta.expiresAt) return setError(`Add the expiry date for your ${type.replaceAll("_", " ")} before uploading.`);
    setUploading(type); setError("");
    try {
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `driver-applications/${user.uid}/documents/${type}/${file.lastModified || 0}-${safe}`;
      await uploadFile(path, file, { driverId: user.uid, documentType: type, ownerId: user.uid });
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "document", document: { type, storagePath: path, fileName: file.name, expiresAt: meta.expiresAt || null, referenceNumber: meta.referenceNumber || (type === "registration" ? form.registration : ""), vehicleId: VEHICLE_SCOPED_DOCUMENTS.has(type) ? `${user.uid}_primary` : undefined } }) });
      toast(`${DOCUMENTS.find((item) => item.type === type)?.label || "Document"} uploaded.`, { type: "success" });
      await reload({ quiet: true });
    } catch (err) { setError(err.message || "The document could not be uploaded."); }
    finally { setUploading(""); }
  }
  async function completeTraining(moduleId, trainingAnswer) {
    setSaving(true); setError("");
    try {
      await saveStep(5);
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "training", trainingModuleId: moduleId, trainingAnswer, trainingComplete: true }) });
      await reload({ quiet: true });
      setOpenTraining("");
      toast(`${DRIVER_TRAINING_MODULES[moduleId]?.label || "Training"} complete.`, { type: "success" });
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  async function submit() {
    setSaving(true); setError("");
    try {
      await saveStep(5);
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "submit" }) });
      await reload();
      toast("Your Driver application was sent to Spotly.", { type: "success" });
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (reviewState) {
    const rejected = existing.status === "rejected";
    const information = existing.status === "information_required";
    return <div className="space-y-6">
      <PageHeader eyebrow="Spotly Driver" title={rejected ? "Your application was not approved" : information ? "Spotly needs something from you" : existing.status === "approved" ? "You’re approved" : "Your application is being reviewed"} description={rejected ? "This decision does not restart your application. Read the reason below and use the available next step." : information ? "Fix the requested item and send it back for review." : existing.status === "approved" ? "Spotly is activating the work types you qualify for." : "Your Activation Centre shows what is with you and what is with Spotly."} />
      {(rejected || information) && <Card className={cn("p-5", rejected ? "border-danger" : "border-warning")}><p className="font-semibold">{rejected ? "Decision" : "Your action"}</p><p className="mt-2 text-sm text-secondary">{existing.reviewReason || (rejected ? "Spotly could not approve this application in its current form." : "Update the requested information, then submit again.")}</p><div className="mt-4 flex flex-wrap gap-2">{information && <Button onClick={() => { setStep(2); setEditing(true); }}>Fix application</Button>}<Button asChild variant="outline"><Link href="/support?topic=driver-application">Get help</Link></Button></div></Card>}
      <SectionCard padded title="Activation progress" description="Every item has a clear owner. ‘Spotly reviewing’ means you do not need to keep resubmitting it."><div className="divide-y">{(data?.requirements?.checks || data?.readiness?.checks || []).map((item) => <div key={item.id} className="flex items-center gap-3 py-4"><span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", item.ok ? "bg-[var(--success-soft)] text-success" : item.owner === "spotly" ? "bg-[var(--info-soft)] text-info" : "bg-[var(--warning-soft)] text-warning")}>{item.ok ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block font-medium">{item.label}</span>{item.reviewReason ? <span className="mt-1 block text-xs text-secondary">{item.reviewReason}</span> : null}</span><Badge tone={item.ok ? "success" : item.owner === "spotly" ? "info" : "warning"}>{item.ok ? "Complete" : item.owner === "spotly" ? "Spotly reviewing" : "Your action"}</Badge></div>)}</div></SectionCard>
      {information && <Button variant="outline" onClick={() => { setStep(0); setEditing(true); }}>Review all details</Button>}
    </div>;
  }

  return <div className="space-y-6">
    <PageHeader eyebrow={`Step ${step + 1} of ${APPLICATION_STEPS.length}`} title="Activation Centre" description="Spotly shows only the requirements that apply to the work and vehicle you choose." />
    <ProgressSteps current={step} />
    {error && <div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{error}</div>}
    {step === 0 && <SectionCard padded title="Your details" description="Tell Spotly who you are, where you plan to work and who to contact in an emergency."><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Full legal name<input className="field-control mt-2 w-full" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></label><label className="text-sm font-medium">Phone<input className="field-control mt-2 w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+263" /></label><label className="text-sm font-medium">City<select className="field-control mt-2 w-full" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>{zimbabweCities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label><label className="text-sm font-medium">Emergency contact<input className="field-control mt-2 w-full" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} /></label><label className="text-sm font-medium">Emergency phone<input className="field-control mt-2 w-full" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} /></label></div></SectionCard>}
    {step === 1 && <div className="space-y-4"><SectionCard padded title="What do you want to do?" description="Each work type activates independently. You can start earning from approved work without waiting for unrelated work types."><div className="grid gap-3 sm:grid-cols-2">{Object.values(DRIVER_CAPABILITIES).map((capability) => { const supported = capabilitySupportsVehicle(capability.id, form.vehicleType); const selected = form.requestedCapabilities.includes(capability.id); return <button type="button" key={capability.id} disabled={!supported} onClick={() => toggleCapability(capability.id)} className={cn("rounded-xl border p-4 text-left transition", selected && supported && "border-[var(--accent)] bg-[var(--accent-soft)]", !supported && "cursor-not-allowed opacity-45")}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{capability.label}</p><p className="mt-1 text-sm leading-5 text-secondary">{capability.description}</p></div>{selected && supported ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--accent)]" /> : null}</div></button>; })}</div></SectionCard><SectionCard padded title="Your vehicle" description="The vehicle changes what work and documents Spotly can require."><div className="grid gap-3 sm:grid-cols-4">{DRIVER_VEHICLES.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => setVehicleType(id)} className={cn("rounded-xl border p-4 text-left", form.vehicleType === id && "border-[var(--accent)] bg-[var(--accent-soft)]")}><Icon className="h-6 w-6 text-[var(--accent)]" /><p className="mt-3 font-semibold">{label}</p></button>)}</div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-medium">Ownership<select className="field-control mt-2 w-full" value={form.ownership} onChange={(e) => setForm({ ...form, ownership: e.target.value })}><option value="driver_owned">I own it</option><option value="rented">Rented</option><option value="fleet_owned">Fleet / company owned</option></select></label>{form.vehicleType !== "bicycle" && <label className="text-sm font-medium">Registration<input className="field-control mt-2 w-full uppercase" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="ABC 1234" /></label>}<label className="text-sm font-medium">Year<input type="number" min="1950" max="2100" className="field-control mt-2 w-full" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2022" /></label><label className="text-sm font-medium">Make<input className="field-control mt-2 w-full" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder={form.vehicleType === "bicycle" ? "Optional" : "Toyota"} /></label><label className="text-sm font-medium">Model<input className="field-control mt-2 w-full" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label></div></SectionCard></div>}
    {step === 2 && <SectionCard padded title="Required documents" description="This list is generated from your selected work and vehicle. Motorized work explicitly requires a Driver licence; a bicycle does not inherit motor-vehicle paperwork."><div className="grid gap-4 md:grid-cols-2">{requiredDocumentTypes.map((type) => { const item = DOCUMENTS.find((entry) => entry.type === type) || { type, label: labelStatus(type), helper: "Upload the evidence Spotly requested." }; const doc = uploaded.get(type); const meta = documentMeta[type] || {}; return <Card key={type} className="p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><IdCard className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.label}</p>{doc && <Badge tone={doc.status === "approved" ? "success" : doc.status === "rejected" ? "danger" : "warning"}>{labelStatus(doc.status)}</Badge>}</div><p className="mt-1 text-sm leading-5 text-secondary">{doc?.reviewReason || item.helper}</p>{doc?.referenceNumber ? <p className="mt-2 text-xs text-secondary">Reference: {doc.referenceNumber}</p> : null}{doc?.expiresAt ? <p className="mt-1 text-xs text-secondary">Expires {dateTime(doc.expiresAt)}</p> : null}<div className="mt-4 grid gap-3">{type !== "identity" ? <label className="text-xs font-semibold">{type === "licence" ? "LICENCE NUMBER" : type === "registration" ? "REGISTRATION NUMBER" : "REFERENCE NUMBER (OPTIONAL)"}<input className="field-control mt-1 w-full" value={meta.referenceNumber ?? (type === "registration" ? form.registration : "")} onChange={(event) => setDocumentMeta((current) => ({ ...current, [type]: { ...(current[type] || {}), referenceNumber: event.target.value } }))} disabled={type === "registration" && Boolean(form.registration)} /></label> : null}{EXPIRY_DOCUMENTS.has(type) ? <label className="text-xs font-semibold">EXPIRY DATE<input type="date" className="field-control mt-1 w-full" value={meta.expiresAt || ""} onChange={(event) => setDocumentMeta((current) => ({ ...current, [type]: { ...(current[type] || {}), expiresAt: event.target.value } }))} /></label> : null}<label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"><Upload className="h-4 w-4" />{uploading === type ? "Uploading…" : doc ? "Replace document" : "Upload document"}<input type="file" accept="image/*,.pdf" className="sr-only" disabled={Boolean(uploading)} onChange={(event) => uploadDocument(type, event.target.files?.[0])} /></label></div></div></div></Card>; })}</div></SectionCard>}
    {step === 3 && <SectionCard padded title="Where you want to work" description="These are preferences, not guaranteed jobs. Spotly still applies service areas and capability rules."><label className="text-sm font-medium">Preferred areas <span className="font-normal text-tertiary">separate with commas</span><input className="field-control mt-2 w-full" value={form.preferredZones} onChange={(e) => setForm({ ...form, preferredZones: e.target.value })} placeholder="Borrowdale, Highlands, Avondale" /></label><div className="mt-4 rounded-xl bg-[var(--surface-2)] p-4 text-sm text-secondary"><MapPin className="mb-2 h-5 w-5 text-[var(--accent)]" />When you are active, Spotly uses your live location to send nearby work that matches your approved capabilities and selected vehicle.</div></SectionCard>}
    {step === 4 && <SectionCard padded title="Getting paid" description="Saving a payout destination and being approved to work are separate. Spotly will show whether payout verification is still pending."><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Payout type<select className="field-control mt-2 w-full" value={form.payoutType} onChange={(e) => setForm({ ...form, payoutType: e.target.value, payoutProvider: e.target.value === "mobile_money" ? "EcoCash" : "CBZ" })}><option value="mobile_money">Mobile money</option><option value="bank">Bank account</option></select></label><label className="text-sm font-medium">Provider<select className="field-control mt-2 w-full" value={form.payoutProvider} onChange={(e) => setForm({ ...form, payoutProvider: e.target.value, payoutProviderOther: e.target.value === "Other bank" ? form.payoutProviderOther : "" })}>{(form.payoutType === "bank" ? BANK_PAYOUT_PROVIDERS : MOBILE_PAYOUT_PROVIDERS).map((provider) => <option key={provider}>{provider}</option>)}</select></label>{form.payoutType === "bank" && form.payoutProvider === "Other bank" && <label className="text-sm font-medium">Bank name<input className="field-control mt-2 w-full" value={form.payoutProviderOther} onChange={(e) => setForm({ ...form, payoutProviderOther: e.target.value })} /></label>}<label className="text-sm font-medium">Recipient name<input className="field-control mt-2 w-full" value={form.payoutName} onChange={(e) => setForm({ ...form, payoutName: e.target.value })} /></label><label className="text-sm font-medium">Account / wallet identifier<input className="field-control mt-2 w-full" value={form.payoutIdentifier} onChange={(e) => setForm({ ...form, payoutIdentifier: e.target.value })} placeholder={existing.payoutComplete ? "Already saved" : "Enter securely"} /></label></div>{existing.payoutComplete && <p className="mt-4 text-sm font-semibold text-success">Payout details saved. Verification can continue separately.</p>}</SectionCard>}
    {step === 5 && <div className="space-y-4">
      <SectionCard padded title="Short work training" description="Complete only the modules for the work you selected. Each module has operating guidance and one quick comprehension check; Spotly records the module version you completed.">
        <div className="space-y-3">{requiredTraining.map((moduleId) => {
          const module = DRIVER_TRAINING_MODULES[moduleId];
          const complete = trainingModuleIsCurrent(existing, moduleId);
          const open = openTraining === moduleId;
          const selectedAnswer = trainingAnswers[moduleId];
          return <div key={moduleId} className="rounded-xl bg-[var(--surface-2)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", complete ? "bg-[var(--success-soft)] text-success" : "bg-[var(--accent-soft)] text-[var(--accent)]")}>{complete ? <CheckCircle2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{module?.label || labelStatus(moduleId)}</span><span className="mt-1 block text-xs text-secondary">About {module?.minutes || 5} minutes · version {module?.version || 1}</span></span>
              {complete ? <Badge tone="success">Complete</Badge> : <Button size="sm" variant={open ? "outline" : "primary"} onClick={() => setOpenTraining(open ? "" : moduleId)}>{open ? "Close" : "Review module"}</Button>}
            </div>
            {open && !complete ? <div className="mt-4 border-t pt-4">
              <ul className="space-y-2 text-sm text-secondary">{(module?.lessons || []).map((lesson) => <li key={lesson} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" /><span>{lesson}</span></li>)}</ul>
              <div className="mt-5 rounded-xl bg-[var(--surface)] p-4"><p className="text-sm font-semibold">Quick check</p><p className="mt-2 text-sm text-secondary">{module?.check?.question}</p><div className="mt-3 space-y-2">{(module?.check?.options || []).map((option, index) => <label key={option} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", selectedAnswer === index && "border-[var(--accent)] bg-[var(--accent-soft)]")}><input type="radio" name={`training-${moduleId}`} className="mt-0.5" checked={selectedAnswer === index} onChange={() => setTrainingAnswers((current) => ({ ...current, [moduleId]: index }))} /><span>{option}</span></label>)}</div><Button className="mt-4" size="sm" loading={saving} disabled={selectedAnswer !== module?.check?.answer} onClick={() => completeTraining(moduleId, selectedAnswer)}>Complete module</Button></div>
            </div> : null}
          </div>;
        })}</div>
        <div className="mt-5 space-y-3"><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={form.locationConsent} onChange={(e) => setForm({ ...form, locationConsent: e.target.checked })} /><span>I understand Spotly uses my location while I am online for dispatch, safety and live job progress.</span></label><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={form.agreementsAccepted} onChange={(e) => setForm({ ...form, agreementsAccepted: e.target.checked })} /><span>I accept the Driver operating terms and safety rules presented by Spotly.</span></label></div>
      </SectionCard>
      <Button className="w-full" size="lg" onClick={submit} loading={saving}>Send application to Spotly</Button>
    </div>}
    <div className="flex justify-between gap-3">{step > 0 ? <Button variant="outline" onClick={() => setStep((value) => value - 1)}>Back</Button> : <span />}{step < 5 && <Button onClick={nextStep} loading={saving}>{step === 0 ? "Choose work & vehicle" : step === 1 ? "Add required documents" : step === 2 ? "Choose work areas" : step === 3 ? "Set up getting paid" : "Open training"}</Button>}</div>
  </div>;
}

function OfferCountdown({ expiresAt }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((new Date(expiresAt || 0).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  if (!expiresAt) return null;
  return <Badge tone={remaining <= 10 ? "danger" : remaining <= 30 ? "warning" : "neutral"}>{remaining > 0 ? `${remaining}s to decide` : "Expired"}</Badge>;
}

function OfferCard({ offer, onAccept, onDecline, busy }) {
  const shopping = offer.fulfilmentMode === "driver_shops" || offer.workType === "shop_and_deliver";
  return <Card className="overflow-hidden"><div className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={shopping ? "accent" : "neutral"}>{offer.workLabel || (shopping ? "Shop & Deliver" : "Prepared delivery")}</Badge><OfferCountdown expiresAt={offer.expiresAt} /></div><h3 className="mt-3 text-lg font-semibold">{offer.pickup?.name || "Pickup"}</h3><p className="mt-1 text-sm text-secondary">{offer.pickup?.area} → {offer.dropoff?.area}</p></div><div className="text-right"><p className="text-2xl font-semibold">{formatCurrency(offer.pay || 0, offer.currency)}</p><p className="mt-1 text-xs text-secondary">Guaranteed pay</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">TO PICKUP</p><p className="mt-2 font-semibold">{Number(offer.pickupDistanceKm ?? offer.distanceKm ?? 0).toFixed(1)} km</p></div><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">WORK DISTANCE</p><p className="mt-2 font-semibold">{Number(offer.workDistanceKm || 0).toFixed(1)} km</p></div><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">TOTAL ESTIMATE</p><p className="mt-2 font-semibold">~{offer.expectedMinutes || "—"} min</p></div><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">{shopping ? "SHOPPING" : "LOAD"}</p><p className="mt-2 font-semibold">{shopping ? `${offer.itemCount || 0} item${offer.itemCount === 1 ? "" : "s"}` : `${offer.bagCount || 1} package${offer.bagCount === 1 ? "" : "s"}`}</p></div></div>{shopping ? <div className="mt-4 rounded-xl bg-[var(--accent-soft)] p-3 text-sm"><strong>You are doing the shopping.</strong> The estimate includes shopping time; substitutions and checkout use Spotly’s shopping flow.</div> : <div className="mt-4 rounded-xl bg-[var(--surface-2)] p-3 text-sm"><strong>Prepared pickup.</strong> Collect the merchant-prepared order; do not shop the basket yourself.</div>}</div><div className="flex gap-2 border-t p-3"><Button variant="outline" className="flex-1" disabled={busy} onClick={() => onDecline(offer)}>Decline</Button><Button className="flex-[1.5]" loading={busy} onClick={() => onAccept(offer)}>Accept {shopping ? "Shop & Deliver" : "delivery"}</Button></div></Card>;
}

function RideOfferCard({ offer, onAccept, onDecline, busy }) {
  return <Card className="overflow-hidden"><div className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Badge tone="info">Ride</Badge><OfferCountdown expiresAt={offer.expiresAt} /></div><h3 className="mt-3 text-lg font-semibold">{offer.pickup?.label || offer.pickup?.area || "Pickup"}</h3><p className="mt-1 text-sm text-secondary">{offer.pickup?.area} → {offer.dropoff?.area}</p></div><div className="text-right"><p className="text-2xl font-semibold">{formatCurrency(offer.pay || 0, offer.currency)}</p><p className="mt-1 text-xs text-secondary">Guaranteed pay</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">TO PICKUP</p><p className="mt-2 font-semibold">{Number(offer.pickupDistanceKm || 0).toFixed(1)} km</p></div><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">TRIP</p><p className="mt-2 font-semibold">{Number(offer.tripDistanceKm || 0).toFixed(1)} km</p></div><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">TRIP ESTIMATE</p><p className="mt-2 font-semibold">~{offer.expectedTripMinutes || "—"} min</p></div></div></div><div className="flex gap-2 border-t p-3"><Button variant="outline" className="flex-1" disabled={busy} onClick={() => onDecline(offer)}>Decline</Button><Button className="flex-[1.5]" loading={busy} onClick={() => onAccept(offer)}>Accept ride</Button></div></Card>;
}

function ParcelOfferCard({ offer, onAccept, onDecline, busy }) {
  return <Card className="overflow-hidden"><div className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Badge tone="accent">Send</Badge><OfferCountdown expiresAt={offer.expiresAt} /></div><h3 className="mt-3 text-lg font-semibold">{offer.pickup?.label || offer.pickup?.area || "Pickup"}</h3><p className="mt-1 text-sm text-secondary">{offer.pickup?.area} → {offer.dropoff?.area}</p></div><div className="text-right"><p className="text-2xl font-semibold">{formatCurrency(offer.pay || 0, offer.currency)}</p><p className="mt-1 text-xs text-secondary">Guaranteed pay</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">TO PICKUP</p><p className="mt-2 font-semibold">{Number(offer.pickupDistanceKm || 0).toFixed(1)} km</p></div><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">DELIVERY</p><p className="mt-2 font-semibold">{Number(offer.tripDistanceKm || 0).toFixed(1)} km</p></div><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">ESTIMATE</p><p className="mt-2 font-semibold">~{offer.expectedTripMinutes || "—"} min</p></div><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">PARCEL</p><p className="mt-2 font-semibold capitalize">{offer.parcelSize || "medium"}</p></div></div></div><div className="flex gap-2 border-t p-3"><Button variant="outline" className="flex-1" disabled={busy} onClick={() => onDecline(offer)}>Decline</Button><Button className="flex-[1.5]" loading={busy} onClick={() => onAccept(offer)}>Accept Send</Button></div></Card>;
}

function Availability({ data, reload }) {
  const { enablePushNotifications } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const online = data?.presence?.online === true;
  const activeWork = data?.activeRide || data?.activeParcel || data?.activeJob;
  const approvedVehicles = (data?.vehicles || []).filter((item) => item.status === "approved");
  const fallbackVehicleId = data?.accountHealth?.selectedVehicleId || approvedVehicles[0]?.id || "";
  const [vehicleId, setVehicleId] = useState(fallbackVehicleId);
  const selectedVehicle = approvedVehicles.find((item) => item.id === vehicleId) || approvedVehicles.find((item) => item.id === fallbackVehicleId) || approvedVehicles[0];
  const activeCapabilities = (data?.capabilities || []).filter((item) => item.status === "active" && item.ready !== false && capabilitySupportsVehicle(item.id, selectedVehicle?.type || "")).map((item) => item.id);
  const approvedVehicleSignature = approvedVehicles.map((item) => item.id).join("|");
  const presenceCapabilitySignature = (data?.presence?.enabledCapabilities || []).join("|");
  const capabilitySignature = (data?.capabilities || []).map((item) => `${item.id}:${item.status}:${item.ready}`).join("|");
  const [enabledCapabilities, setEnabledCapabilities] = useState(data?.presence?.enabledCapabilities?.length ? data.presence.enabledCapabilities : activeCapabilities);

  useEffect(() => {
    if (!online) setVehicleId(data?.accountHealth?.selectedVehicleId || approvedVehicles[0]?.id || "");
  }, [online, data?.accountHealth?.selectedVehicleId, approvedVehicleSignature]);
  useEffect(() => {
    const allowed = (data?.capabilities || []).filter((item) => item.status === "active" && item.ready !== false && capabilitySupportsVehicle(item.id, selectedVehicle?.type || "")).map((item) => item.id);
    setEnabledCapabilities((current) => {
      const retained = current.filter((id) => allowed.includes(id));
      if (online && data?.presence?.enabledCapabilities?.length) return data.presence.enabledCapabilities.filter((id) => allowed.includes(id));
      return retained.length ? retained : allowed;
    });
  }, [selectedVehicle?.id, online, presenceCapabilitySignature, capabilitySignature]);

  function toggleCapability(id) {
    if (online) return;
    setEnabledCapabilities((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function setOnline(next) {
    setBusy(true); setPermissionError("");
    try {
      if (!next) { await authenticatedFetch("/api/driver/presence", { method: "POST", body: JSON.stringify({ online: false }) }); await reload(); return; }
      if (!selectedVehicle?.id) throw new Error("Choose an approved vehicle before going online.");
      if (!enabledCapabilities.length) throw new Error("Choose at least one active work type before going online.");
      if (!navigator.geolocation) throw new Error("This device does not support location. Use a phone or browser with location access.");
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Turn on precise location so Spotly can safely dispatch nearby work.")), { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }));
      await authenticatedFetch("/api/driver/presence", { method: "POST", body: JSON.stringify({ online: true, vehicleId: selectedVehicle.id, enabledCapabilities, location: { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy } }) });
      enablePushNotifications().catch(() => {});
      await reload();
      toast("You’re online and Spotly is checking live dispatchability.", { type: "success" });
    } catch (err) { setPermissionError(err.message); }
    finally { setBusy(false); }
  }

  return <Card className={cn("overflow-hidden", online && data.accountHealth?.dispatchable ? "border-[color-mix(in_srgb,var(--success)_30%,var(--border))]" : "")}><div className="p-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={cn("mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl", online ? "bg-[var(--success-soft)] text-success" : "bg-[var(--surface-2)] text-secondary")}><Navigation className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{online ? data.accountHealth?.dispatchable ? "Online and dispatchable" : "Online, but something needs attention" : "You’re offline"}</p>{online && <Badge tone={data.accountHealth?.location === "good" ? "success" : data.accountHealth?.location === "weak" ? "warning" : "danger"}>GPS {labelStatus(data.accountHealth?.location || "unknown")}</Badge>}</div><p className="mt-1 text-sm text-secondary">{online ? `Using ${selectedVehicle?.type ? labelStatus(selectedVehicle.type) : "your approved vehicle"}. Keep Spotly open enough for location and offer notifications.` : "Choose the vehicle and work you want this session, then go online when safely ready."}</p>{permissionError && <p className="mt-2 text-sm font-medium text-danger">{permissionError}</p>}</div></div><Button size="lg" variant={online ? "outline" : "primary"} loading={busy} disabled={Boolean(activeWork && online)} onClick={() => setOnline(!online)}>{online ? "Go offline" : "Go online"}</Button></div>
    <div className="mt-5 grid gap-4 border-t pt-5 lg:grid-cols-[260px_1fr]"><label className="text-sm font-semibold">Vehicle for this session<select className="field-control mt-2 w-full" value={selectedVehicle?.id || ""} disabled={online || busy} onChange={(event) => setVehicleId(event.target.value)}>{approvedVehicles.length ? approvedVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{labelStatus(vehicle.type)}{vehicle.registration ? ` · ${vehicle.registration}` : ""}</option>) : <option value="">No approved vehicle</option>}</select></label><div><p className="text-sm font-semibold">Work I’m accepting</p><div className="mt-2 flex flex-wrap gap-2">{activeCapabilities.length ? activeCapabilities.map((id) => <button type="button" key={id} disabled={online || busy} onClick={() => toggleCapability(id)} className={cn("rounded-xl border px-3 py-2 text-sm font-semibold transition", enabledCapabilities.includes(id) ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface)] text-secondary")}>{enabledCapabilities.includes(id) ? "✓ " : ""}{DRIVER_CAPABILITIES[id]?.shortLabel || labelStatus(id)}</button>) : <p className="text-sm text-secondary">No active work types match this approved vehicle yet.</p>}</div>{online ? <p className="mt-2 text-xs text-secondary">Go offline before changing vehicle or work preferences.</p> : null}</div></div>
  </div></Card>;
}

function LiveLocation({ data }) {
  const [watchError, setWatchError] = useState("");
  const watchRef = useRef(null);
  useEffect(() => {
    if (!data?.presence?.online || !navigator.geolocation) { setWatchError(""); return undefined; }
    let lastSent = 0;
    watchRef.current = navigator.geolocation.watchPosition((position) => {
      setWatchError("");
      if (Date.now() - lastSent < 15000) return;
      lastSent = Date.now();
      authenticatedFetch("/api/driver/location", { method: "POST", body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }) }).catch((err) => setWatchError(err.message || "Spotly could not update your live location."));
    }, (err) => setWatchError(err?.message || "Spotly lost access to your live location."), { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; };
  }, [data?.presence?.online]);
  if (!data?.presence?.online || (!watchError && !["stale", "missing"].includes(data?.accountHealth?.location))) return null;
  return <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-warning bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]"><WifiOff className="mt-0.5 h-5 w-5 shrink-0"/><div><p className="font-semibold">Spotly may not be able to dispatch you right now</p><p className="mt-1">{watchError || "Your location is stale or missing. Check GPS permission, network connection and battery/location settings."}</p></div></div>;
}

function CapabilityStrip({ data }) {
  const capabilities = data?.capabilities || [];
  if (!capabilities.length) return null;
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{capabilities.map((capability) => <Card key={capability.id} className="p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{capability.label}</p><p className="mt-1 text-xs text-secondary">{capability.status === "active" ? "Ready for matching work" : capability.status === "blocked" ? "A requirement is no longer valid" : labelStatus(capability.status)}</p></div><Badge tone={capability.status === "active" ? "success" : ["in_review", "requirements_incomplete"].includes(capability.status) ? "warning" : "danger"}>{capability.status === "active" ? "Ready" : labelStatus(capability.status)}</Badge></div></Card>)}</div>;
}

function DriverHome({ data, reload, onOffer, onRideOffer, onParcelOffer }) {
  const active = data.activeRide || data.activeParcel || data.activeJob;
  const offers = [...(data.rideOffers || []), ...(data.parcelOffers || []), ...(data.offers || [])];
  const blockers = (data.eligibility?.checks || []).filter((item) => !item.ok);
  const ledger = data.earnings || [];
  const todayKey = new Date().toDateString();
  const today = ledger.filter((item) => new Date(item.createdAt || 0).toDateString() === todayKey && Number(item.amount || 0) > 0).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return <div className="space-y-6"><PageHeader eyebrow={data.driver?.status === "active" ? "Working now" : "Spotly Driver"} {...sectionMeta.home} />
    {blockers.length ? <Card className="border-warning p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-warning"/><div className="flex-1"><p className="font-semibold">You have {blockers.length} account blocker{blockers.length === 1 ? "" : "s"}</p><p className="mt-1 text-sm text-secondary">{blockers.slice(0, 2).map((item) => item.label).join(" · ")}</p><Button asChild size="sm" className="mt-3"><Link href="/profile">Open Account health</Link></Button></div></div></Card> : null}
    <Availability data={data} reload={reload} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card className="p-5"><p className="text-xs font-semibold text-tertiary">CAN I WORK?</p><p className="mt-2 text-xl font-semibold">{data.accountHealth?.dispatchable ? "Yes — dispatchable" : data.presence?.online ? "Not right now" : data.eligibility?.eligible ? "Ready when online" : "Action needed"}</p><p className="mt-2 text-sm text-secondary">GPS {labelStatus(data.accountHealth?.location || "offline")} · {data.eligibility?.eligible ? "account ready" : "check account health"}</p></Card><Card className="p-5"><p className="text-xs font-semibold text-tertiary">Work nearby</p><p className="mt-2 text-3xl font-semibold">{offers.length}</p><p className="mt-2 text-sm text-secondary">live offer{offers.length === 1 ? "" : "s"}</p></Card><Card className="p-5"><p className="text-xs font-semibold text-tertiary">TODAY</p><p className="mt-2 text-3xl font-semibold">{formatCurrency(today)}</p><p className="mt-2 text-sm text-secondary">positive earning events today</p></Card><Card className="p-5"><p className="text-xs font-semibold text-tertiary">Available earnings</p><p className="mt-2 text-3xl font-semibold">{formatCurrency(data.balances?.USD?.available || 0, "USD")}</p><p className="mt-2 text-sm text-secondary">USD available · payout {labelStatus(data.accountHealth?.payout || "missing")}</p></Card></div>
    <SectionCard padded title="Your work approvals" description="Spotly activates each type of work independently."><CapabilityStrip data={data} /></SectionCard>
    {active ? <Card className="border-[var(--accent)] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Badge tone="accent">ACTIVE NOW</Badge><h2 className="mt-2 text-xl font-semibold">{data.activeRide ? "Continue your Ride" : data.activeParcel ? "Continue your Send" : data.activeJob?.fulfilmentMode === "driver_shops" ? "Continue Shop & Deliver" : "Continue delivery"}</h2><p className="mt-1 text-sm text-secondary">{active.number || active.id} · {labelStatus(active.state)}</p></div><Button asChild size="lg"><Link href="/active">Resume active job</Link></Button></div></Card> : null}
    {!active && offers.length ? <SectionCard padded title="Offers waiting now" description="Pay, workload, distance and time are shown before you decide."><div className="grid gap-4 xl:grid-cols-2">{(data.rideOffers || []).slice(0, 1).map((item) => <RideOfferCard key={item.id} offer={item} onAccept={onRideOffer.accept} onDecline={onRideOffer.decline} busy={onRideOffer.busy} />)}{(data.parcelOffers || []).slice(0, 1).map((item) => <ParcelOfferCard key={item.id} offer={item} onAccept={onParcelOffer.accept} onDecline={onParcelOffer.decline} busy={onParcelOffer.busy} />)}{(data.offers || []).slice(0, 2).map((item) => <OfferCard key={item.id} offer={item} onAccept={onOffer.accept} onDecline={onOffer.decline} busy={onOffer.busy} />)}</div></SectionCard> : null}
    {!active && !offers.length && data.presence?.online ? <LottieEmptyState name="driver-online" tone="driver" title="You’re available" description="There is no matching work nearby right now. Spotly will only offer work that your active capabilities and selected vehicle can perform." /> : null}
  </div>;
}

function Jobs({ data, offer, rideOffer, parcelOffer }) {
  const active = data.activeRide || data.activeParcel || data.activeJob;
  if (!data.presence?.online) return <div className="space-y-6"><PageHeader {...sectionMeta.jobs} /><LottieEmptyState name="driver-online" tone="driver" title="Go online to receive work" description="Return to Driver home and turn on location sharing when you are ready." action={<Button asChild><Link href="/">Go to Driver home</Link></Button>} /></div>;
  if (active) return <div className="space-y-6"><PageHeader {...sectionMeta.jobs} /><LottieEmptyState name="route-delivery" tone="driver" title="Finish your active job first" description="Spotly keeps one active ride, delivery or Send job at a time for a clear, safe workflow." action={<Button asChild><Link href="/active">Open active job</Link></Button>} /></div>;
  const rides = data.rideOffers || []; const parcels = data.parcelOffers || []; const deliveries = data.offers || [];
  return <div className="space-y-6"><PageHeader {...sectionMeta.jobs} />{rides.length || parcels.length || deliveries.length ? <><div className="flex flex-wrap gap-2"><Badge tone="info">{rides.length} ride{rides.length === 1 ? "" : "s"}</Badge><Badge tone="accent">{parcels.length} Send</Badge><Badge tone="neutral">{deliveries.length} deliver{deliveries.length === 1 ? "y" : "ies"}</Badge></div><div className="grid gap-4 xl:grid-cols-2">{rides.map((item) => <RideOfferCard key={item.id} offer={item} onAccept={rideOffer.accept} onDecline={rideOffer.decline} busy={rideOffer.busy} />)}{parcels.map((item) => <ParcelOfferCard key={item.id} offer={item} onAccept={parcelOffer.accept} onDecline={parcelOffer.decline} busy={parcelOffer.busy} />)}{deliveries.map((item) => <OfferCard key={item.id} offer={item} onAccept={offer.accept} onDecline={offer.decline} busy={offer.busy} />)}</div></> : <LottieEmptyState name="driver-online" tone="driver" title="No work nearby right now" description="Stay online. New ride and delivery offers appear here and can also arrive by push notification." />}</div>;
}


function ShoppingItemRow({ job, item, reload }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(item.status === "pending" ? "found" : item.status);
  const [quantity, setQuantity] = useState(String(item.actualQuantity || item.requestedQuantity || 1));
  const [price, setPrice] = useState(String(item.actualUnitPrice || item.estimatedUnitPrice || 0));
  const [replacementName, setReplacementName] = useState(item.replacementName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const replacementAllowed = job.shopping?.substitutionPreference !== "no_substitutions" && item.substitutionAllowed !== false;

  useEffect(() => {
    if (item.status === "substitution_pending") return;
    setStatus(item.status === "pending" ? "found" : item.status);
    setQuantity(String(item.actualQuantity || item.requestedQuantity || 1));
    setPrice(String(item.actualUnitPrice || item.estimatedUnitPrice || 0));
    setReplacementName(item.replacementName || "");
  }, [item.status, item.actualQuantity, item.actualUnitPrice, item.replacementName, item.requestedQuantity, item.estimatedUnitPrice]);

  async function save() {
    setBusy(true); setError("");
    try {
      const result = await authenticatedFetch("/api/driver/shopping", { method: "POST", body: JSON.stringify({ action: "item", deliveryJobId: job.id, productId: item.productId, status, actualQuantity: status === "unavailable" ? 0 : Number(quantity), actualUnitPrice: status === "unavailable" ? 0 : Number(price), replacementName: status === "replaced" ? replacementName.trim() : "" }) });
      await reload({ quiet: true });
      toast(result.customerApprovalRequired ? `Replacement sent to the customer for approval.` : `${item.name} updated.`, { type: "success" });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (item.status === "substitution_pending") return <Card variant="bordered" className="p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--warning-soft)] text-warning"><Clock3 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">Requested {item.requestedQuantity} · proposed replacement below</p></div><Badge tone="warning">Waiting on customer</Badge></div><div className="mt-3 rounded-xl bg-[var(--surface-2)] p-3"><p className="text-sm font-semibold">{item.proposedReplacementName || "Replacement"}</p><p className="mt-1 text-xs text-secondary">{item.proposedQuantity || 1} × {formatCurrency(item.proposedUnitPrice || 0, job.currency)}</p></div><p className="mt-3 text-xs leading-5 text-secondary">Spotly notified the customer. Basket review remains blocked until they approve or decline this substitution.</p></div></div></Card>;

  return <Card variant="bordered" className="p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><ShoppingBasket className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{[item.brand, item.variant, item.packSize].filter(Boolean).join(" · ") || `Requested ${item.requestedQuantity}`}</p><p className="mt-1 text-xs text-secondary">Requested {item.requestedQuantity}{item.unit ? ` ${item.unit}` : ""} · estimated {formatCurrency(item.estimatedUnitPrice || 0, job.currency)} each{item.gtin ? ` · barcode ${item.gtin}` : item.sku ? ` · SKU ${item.sku}` : ""}</p></div>{item.status !== "pending" && <StatusBadge status={item.status} />}</div>{!replacementAllowed ? <p className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-secondary">No substitutions are allowed for this item. If it is unavailable, mark it unavailable.</p> : job.shopping?.substitutionPreference === "contact_me" ? <p className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-secondary">A replacement must be approved by the customer before checkout. Spotly sends the proposal to Activity when you save it.</p> : null}<div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold text-secondary">Result<select className="field-control mt-1 w-full" value={status} onChange={(e) => setStatus(e.target.value)}><option value="found">Found requested item</option>{replacementAllowed ? <option value="replaced">Replacement</option> : null}<option value="unavailable">Unavailable</option></select></label>{status !== "unavailable" && <><label className="text-xs font-semibold text-secondary">Actual quantity<input className="field-control mt-1 w-full" type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label><label className="text-xs font-semibold text-secondary">Shelf price each<input className="field-control mt-1 w-full" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></label></>}{status === "replaced" && replacementAllowed && <label className="text-xs font-semibold text-secondary sm:col-span-3">Replacement name<input className="field-control mt-1 w-full" value={replacementName} onChange={(e) => setReplacementName(e.target.value)} placeholder="What did you find instead?" /></label>}</div>{error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}<Button className="mt-3" size="sm" variant={item.status === "pending" ? "primary" : "outline"} onClick={save} loading={busy} disabled={(status === "replaced" && (!replacementAllowed || replacementName.trim().length < 2))}>{status === "replaced" && job.shopping?.substitutionPreference === "contact_me" ? "Ask customer to approve" : "Save item"}</Button></div></div></Card>;
}

function ShoppingWorkflow({ job, reload }) {
  const { user } = useAuth(); const { toast } = useToast();
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [receiptPath, setReceiptPath] = useState(job.shopping?.receiptStoragePath || ""); const [error, setError] = useState("");
  const items = job.shopping?.items || [];
  const maxAuthorized = Number(job.shopping?.maxAuthorizedMerchandise || 0);
  const projected = Number(job.shopping?.projectedSubtotal ?? items.reduce((sum, item) => sum + (["found", "replaced"].includes(item.status) ? Number(item.actualQuantity || 0) * Number(item.actualUnitPrice || 0) : 0), 0));
  const pending = items.filter((item) => ["pending", "substitution_pending"].includes(item.status)).length;
  const pendingApprovals = items.filter((item) => item.status === "substitution_pending").length;
  async function action(nextAction) {
    setBusy(true); setError("");
    try { await authenticatedFetch("/api/driver/shopping", { method: "POST", body: JSON.stringify({ action: nextAction, deliveryJobId: job.id }) }); await reload(); toast(nextAction === "start" ? "Shopping started." : "Basket ready for checkout.", { type: "success" }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function uploadReceipt(file) {
    if (!file || !user?.uid) return; setUploading(true); setError("");
    try { const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_"); const path = `driver-deliveries/${user.uid}/${job.id}/receipts/${Date.now()}-${safe}`; await uploadFile(path, file, { driverId: user.uid, deliveryJobId: job.id, documentType: "store_receipt" }); setReceiptPath(path); toast("Store receipt uploaded.", { type: "success" }); }
    catch (err) { setError(err.message || "Receipt upload failed."); } finally { setUploading(false); }
  }
  async function finalize() {
    if (!receiptPath) return; setBusy(true); setError("");
    try { await authenticatedFetch("/api/driver/shopping", { method: "POST", body: JSON.stringify({ action: "finalize", deliveryJobId: job.id, receiptStoragePath: receiptPath }) }); await reload(); toast("Checkout reconciled. You can now start the delivery.", { type: "success" }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (job.state === "driver_arrived_pickup") return <SectionCard padded title="Shop this order" description="Do not use your own money. Spotly has already collected a customer-funded shopping limit for this basket."><div className="grid gap-3 sm:grid-cols-3"><Card variant="bordered" className="p-4"><p className="text-xs font-semibold text-tertiary">ITEMS</p><p className="mt-2 text-2xl font-semibold">{items.length}</p></Card><Card variant="bordered" className="p-4"><p className="text-xs font-semibold text-tertiary">FUNDED LIMIT</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(maxAuthorized, job.currency)}</p></Card><Card variant="bordered" className="p-4"><p className="text-xs font-semibold text-tertiary">SUBSTITUTIONS</p><p className="mt-2 text-sm font-semibold capitalize">{labelStatus(job.shopping?.substitutionPreference || "best_match")}</p></Card></div>{error && <p className="mt-4 text-sm font-medium text-danger">{error}</p>}<Button size="lg" className="mt-5 w-full" onClick={() => action("start")} loading={busy}><ShoppingBasket className="h-5 w-5" />Start shopping</Button></SectionCard>;
  if (job.state === "shopping") return <div className="space-y-4"><SectionCard padded title="Shopping checklist" description="Record what is actually on the shelf. Spotly blocks a basket that exceeds the customer's funded limit."><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold text-tertiary">CURRENT BASKET</p><p className="mt-2 text-lg font-semibold">{formatCurrency(projected, job.currency)}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold text-tertiary">LIMIT</p><p className="mt-2 text-lg font-semibold">{formatCurrency(maxAuthorized, job.currency)}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold text-tertiary">LEFT IN LIMIT</p><p className="mt-2 text-lg font-semibold">{formatCurrency(Math.max(0, maxAuthorized - projected), job.currency)}</p></div></div></SectionCard>{items.map((item) => <ShoppingItemRow key={item.productId} job={job} item={item} reload={reload} />)}{error && <p className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm font-medium text-danger">{error}</p>}<Button size="lg" className="w-full" disabled={pending > 0} loading={busy} onClick={() => action("review")}>{pendingApprovals ? `${pendingApprovals} substitution${pendingApprovals === 1 ? "" : "s"} waiting on customer` : pending ? `${pending} item${pending === 1 ? "" : "s"} still need a result` : "Review basket before checkout"}</Button></div>;
  if (job.state === "shopping_review") return <SectionCard padded title="Checkout & receipt" description="Check the basket once more. Do not use your own money. The store must authorize this Spotly checkout using the delivery reference before you finalize."><div className={cn("mb-4 rounded-xl border p-4", job.shopping?.checkoutAuthorizedAt ? "border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[var(--success-soft)]" : "border-warning bg-[var(--warning-soft)]")}><p className="text-xs font-semibold">STORE CHECKOUT AUTHORIZATION</p><p className="mt-2 text-lg font-semibold">{job.shopping?.checkoutAuthorizedAt ? "Authorized by store" : `Show ${job.number || job.id} at the Spotly kiosk / cashier`}</p><p className="mt-1 text-sm">{job.shopping?.checkoutAuthorizedAt ? "The funded basket is authorized. Upload the final store receipt after checkout." : "The merchant confirms the funded amount in Spotly. Final checkout is blocked until authorization is recorded."}</p></div><div className="space-y-3">{items.map((item) => <div key={item.productId} className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-3"><div className="min-w-0 flex-1"><p className="font-medium">{item.status === "replaced" ? item.replacementName : item.name}</p><p className="mt-1 text-xs text-secondary">{item.status === "unavailable" ? "Not purchased" : `${item.actualQuantity} × ${formatCurrency(item.actualUnitPrice || 0, job.currency)}`}</p></div><StatusBadge status={item.status} /></div>)}</div><div className="mt-4 rounded-xl border border-[var(--border)] p-4"><div className="flex justify-between gap-4"><span className="text-sm text-secondary">Basket total</span><span className="font-semibold">{formatCurrency(projected, job.currency)}</span></div><div className="mt-2 flex justify-between gap-4"><span className="text-sm text-secondary">Customer-funded limit</span><span className="font-semibold">{formatCurrency(maxAuthorized, job.currency)}</span></div></div><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-sm font-semibold hover:bg-[var(--surface-2)]"><ReceiptText className="h-5 w-5 text-[var(--accent)]" />{uploading ? "Uploading receipt…" : receiptPath ? "Receipt uploaded · replace photo" : "Take or upload store receipt"}<input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading} onChange={(e) => uploadReceipt(e.target.files?.[0])} /></label>{receiptPath && <p className="mt-2 text-xs font-semibold text-success">Receipt attached to this delivery.</p>}{error && <p className="mt-4 text-sm font-medium text-danger">{error}</p>}<div className="mt-5 grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => action("edit")} disabled={busy}>Return to shopping</Button><Button onClick={finalize} loading={busy} disabled={!receiptPath}><PackageCheck className="h-4 w-4" />Confirm checkout</Button></div></SectionCard>;
  return null;
}

function ExceptionWait({ until }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((new Date(until || 0).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    if (!until) return undefined;
    const update = () => setRemaining(Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  if (!until) return null;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return <div className={cn("mt-3 rounded-lg p-3 text-xs font-medium", remaining > 0 ? "bg-[var(--warning-soft)] text-warning" : "bg-[var(--info-soft)] text-info")}>{remaining > 0 ? `Stay with this job while Spotly can see the exception · resolution guidance in ${minutes}:${String(seconds).padStart(2, "0")}` : "The wait period is complete. Keep the job open and follow Spotly Operations guidance for the next resolution step."}</div>;
}

function JobProblemBar({ type, work, reload }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const options = type === "ride" ? [["rider_not_here","Rider not here","medium"],["wrong_rider","Wrong rider","high"],["vehicle_issue","Vehicle issue","high"],["unsafe_rider","Unsafe rider","critical"]] : type === "send" ? [["sender_unavailable","Sender unavailable","medium"],["parcel_mismatch","Parcel mismatch","high"],["recipient_unavailable","Recipient unavailable","medium"],["return_required","Return required","high"]] : work?.fulfilmentMode === "driver_shops" ? [["merchant_not_ready","Store not ready","medium"],["checkout_problem","Checkout problem","high"],["customer_unreachable","Customer unreachable","medium"],["unsafe_location","Unsafe location","critical"]] : [["merchant_not_ready","Order not ready","medium"],["merchant_closed","Merchant closed","high"],["package_problem","Package problem","high"],["customer_unreachable","Customer unreachable","medium"]];
  async function report(code, severity) {
    setBusy(code);
    try { await authenticatedFetch("/api/driver/work-exceptions", { method: "POST", body: JSON.stringify({ workType: type, workId: work.id, code, severity, note: `${options.find((item) => item[0] === code)?.[1] || labelStatus(code)} reported from active work.` }) }); await reload({ quiet: true }); toast("Spotly Operations can now see this problem on the live job.", { type: "success" }); }
    catch (err) { toast(err.message, { type: "error" }); }
    finally { setBusy(""); }
  }
  return <SectionCard padded title="Problem with this job?" description="Use a structured action so Spotly Operations sees the exact exception on this job. Safety stays available separately."><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{options.map(([code,title,severity]) => <Button key={code} variant="outline" loading={busy === code} onClick={() => report(code, severity)}>{title}</Button>)}</div>{work.exceptionCode ? <p className="mt-3 text-xs font-semibold text-warning">Open exception: {labelStatus(work.exceptionCode)}</p> : null}<ExceptionWait until={work.exceptionResolutionEligibleAt} /></SectionCard>;
}

function ActiveJob({ data, reload }) {
  const { toast } = useToast(); const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const job = data.activeJob;
  if (!job) return <div className="space-y-6"><PageHeader {...sectionMeta.active} /><LottieEmptyState name="route-delivery" tone="driver" title="No active delivery" description="Accept a delivery while online and it will appear here." action={<Button asChild><Link href="/jobs">View deliveries</Link></Button>} /></div>;
  const driverShops = job.fulfilmentMode === "driver_shops";
  const shoppingStates = ["driver_arrived_pickup", "shopping", "shopping_review"];
  const step = driverShops && job.state === "driver_assigned"
    ? { title: "Go to the store", button: "Start going to store", action: "start_to_pickup", destination: "pickup" }
    : driverShops && job.state === "driver_to_pickup"
      ? { title: "Go to the store", button: "I arrived at the store", action: "arrive_pickup", destination: "pickup" }
      : driverShops && shoppingStates.includes(job.state)
        ? null
        : ACTIVE_ACTIONS[job.state];
  const destination = step?.destination === "dropoff" ? job.dropoff : job.pickup;
  const title = driverShops && job.state === "driver_arrived_pickup" ? "Ready to shop" : driverShops && job.state === "shopping" ? "Shop the customer's basket" : driverShops && job.state === "shopping_review" ? "Review store checkout" : step?.title || labelStatus(job.state);
  function navigate() { if (!destination) return; const coords = Number.isFinite(Number(destination.lat)) && Number.isFinite(Number(destination.lng)) ? `${destination.lat},${destination.lng}` : encodeURIComponent(destination.formattedAddress || ""); window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords}`, "_blank", "noopener,noreferrer"); }
  async function act() { if (!step) return; setBusy(true); setError(""); try { await authenticatedFetch("/api/driver/delivery", { method: "POST", body: JSON.stringify({ deliveryJobId: job.id, action: step.action, code: step.code ? code.trim() : undefined }) }); setCode(""); await reload(); toast(step.action === "complete" ? `Delivery complete. You earned ${formatCurrency(job.acceptedDriverPay || job.quotedDriverPay || 0, job.currency)}.` : "Delivery updated.", { type: "success" }); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="space-y-6"><PageHeader eyebrow={job.number} title={title} description={driverShops ? "Shop, reconcile, then deliver. Spotly keeps the customer-funded basket limit visible throughout." : "One delivery. One next action."} />{error && <div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{error}</div>}<Card className="overflow-hidden"><div className="p-6 sm:p-8"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold tracking-[.08em] text-tertiary">{step?.destination === "dropoff" ? "NEXT DESTINATION" : driverShops ? "STORE" : "PICKUP"}</p>{driverShops && <Badge tone="warning">Shop & deliver</Badge>}</div><h2 className="mt-3 text-3xl font-semibold tracking-[-.03em]">{step?.destination === "dropoff" ? job.dropoff?.formattedAddress || job.dropoff?.suburb || "Customer" : job.pickup?.formattedAddress || job.pickup?.area || (driverShops ? "Store" : "Business")}</h2><p className="mt-3 text-sm leading-6 text-secondary">{step?.destination === "dropoff" ? [job.dropoff?.landmark, job.dropoff?.instructions].filter(Boolean).join(" · ") || "Customer delivery address" : job.pickup?.instructions || (driverShops ? "Enter the store and follow the shopping checklist below." : "Go to the business collection point.")}</p>{destination && step?.destination && <Button className="mt-5" variant="outline" onClick={navigate}><Navigation className="h-4 w-4" />Open navigation</Button>}</div><div className="border-t bg-[var(--surface-2)] p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs font-semibold text-tertiary">PAY</p><p className="mt-1 text-lg font-semibold">{formatCurrency(job.acceptedDriverPay || job.quotedDriverPay || 0, job.currency)}</p></div><div><p className="text-xs font-semibold text-tertiary">{driverShops ? "ITEMS" : "BAGS"}</p><p className="mt-1 text-lg font-semibold">{driverShops ? job.shopping?.items?.length || 0 : job.bagCount || 1}</p></div><div><p className="text-xs font-semibold text-tertiary">STATE</p><p className="mt-1 text-lg font-semibold capitalize">{labelStatus(job.state)}</p></div></div></div></Card>{driverShops && shoppingStates.includes(job.state) && <ShoppingWorkflow job={job} reload={reload} />}{step?.code && <Card className="p-5"><label className="text-sm font-medium">{step.code === "pickup" ? "Pickup code from the business" : "4-digit PIN from the customer"}<input inputMode="numeric" autoComplete="one-time-code" className="field-control mt-2 h-14 w-full text-center text-2xl font-semibold tracking-[.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="••••" /></label><p className="mt-2 text-xs text-secondary">{step.code === "pickup" ? "Do not leave until the pickup code is confirmed." : "The customer must tell you the PIN at handoff. Spotly never needs you to guess it."}</p></Card>}{step ? <Button size="lg" className="w-full min-h-14 text-base" loading={busy} disabled={Boolean(step.code && code.length < 4)} onClick={act}>{step.button}</Button> : !driverShops || !shoppingStates.includes(job.state) ? <LottieEmptyState name="success-burst" tone="driver" title="Delivery state updated" description="Refresh if another action is expected." action={<Button onClick={reload}><RefreshCw className="h-4 w-4" />Refresh</Button>} /> : null}<JobProblemBar type="delivery" work={job} reload={reload} /><Button asChild variant="outline" className="w-full"><Link href="/support"><ShieldCheck className="h-4 w-4" />Open Safety toolkit</Link></Button></div>;
}

function ActiveParcel({ data, reload }) {
  const { user } = useAuth(); const { toast } = useToast(); const parcel = data.activeParcel; const [code,setCode]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [proofPhotoUrl,setProofPhotoUrl]=useState(parcel?.proofPhotoUrl || ""); const [uploading,setUploading]=useState(false);
  if (!parcel) return <div className="space-y-6"><PageHeader {...sectionMeta.active}/><LottieEmptyState name="route-delivery" tone="driver" title="No active Send job" description="Accept a Send offer while online and it will appear here." action={<Button asChild><Link href="/jobs">View available work</Link></Button>}/></div>;
  const step=ACTIVE_PARCEL_ACTIONS[parcel.state]; const destination=step?.destination === "dropoff" ? parcel.dropoff : parcel.pickup; function navigate(){if(!destination)return;const coords=Number.isFinite(Number(destination.lat))&&Number.isFinite(Number(destination.lng))?`${destination.lat},${destination.lng}`:encodeURIComponent(destination.formattedAddress||"");window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords}`,"_blank","noopener,noreferrer");}
  async function uploadProof(file){if(!file||!user?.uid)return;setUploading(true);setError("");try{const path=`driver-send-proof/${user.uid}/${parcel.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;const result=await uploadFile(path,file,{contentType:file.type});setProofPhotoUrl(typeof result === "string" ? result : result?.url || result?.downloadURL || "");toast("Proof photo attached.",{type:"success"});}catch(err){setError(err.message);}finally{setUploading(false);}}
  async function act(){if(!step)return;setBusy(true);setError("");try{await authenticatedFetch("/api/driver/parcels",{method:"POST",body:JSON.stringify({parcelJobId:parcel.id,action:step.action,code:step.code?code.trim():undefined,proofPhotoUrl:step.action==="complete"?proofPhotoUrl||undefined:undefined})});setCode("");await reload();toast(step.action==="complete"?`Send complete. You earned ${formatCurrency(parcel.acceptedDriverPay||parcel.quote?.driverPay||0,parcel.currency)}.`:"Send updated.",{type:"success"});}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <div className="space-y-6"><PageHeader eyebrow={parcel.number} title={step?.title||labelStatus(parcel.state)} description="One parcel. One safe next action."/>{error?<div className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-danger">{error}</div>:null}<Card className="overflow-hidden"><div className="p-6 sm:p-8"><div className="flex items-center gap-2"><Badge tone="accent">Send</Badge><p className="text-xs font-semibold text-tertiary">{parcel.parcelSize?.toUpperCase()} PARCEL</p></div><h2 className="mt-3 text-3xl font-semibold tracking-[-.03em]">{destination?.formattedAddress||destination?.area||"Next stop"}</h2><p className="mt-3 text-sm text-secondary">{step?.destination === "dropoff" ? `${parcel.recipientName || "Recipient"} · contact details protected` : `${parcel.senderName || "Sender"} · contact details protected`}</p>{destination&&step?.destination?<Button className="mt-5" variant="outline" onClick={navigate}><Navigation className="h-4 w-4"/>Open navigation</Button>:null}</div><div className="border-t bg-[var(--surface-2)] p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs font-semibold text-tertiary">PAY</p><p className="mt-1 text-lg font-semibold">{formatCurrency(parcel.acceptedDriverPay||parcel.quote?.driverPay||0,parcel.currency)}</p></div><div><p className="text-xs font-semibold text-tertiary">PARCEL</p><p className="mt-1 text-lg font-semibold capitalize">{parcel.parcelSize}</p></div><div><p className="text-xs font-semibold text-tertiary">STATE</p><p className="mt-1 text-lg font-semibold capitalize">{labelStatus(parcel.state)}</p></div></div></div></Card>{step?.code?<Card className="p-5"><label className="text-sm font-medium">{step.code==="pickup"?"Pickup PIN from sender":"Delivery PIN from recipient"}<input inputMode="numeric" maxLength={4} className="field-control mt-2 w-full text-center font-mono text-2xl tracking-[.3em]" value={code} onChange={(e)=>setCode(e.target.value.replace(/\D/g,"").slice(0,4))}/></label></Card>:null}{step?.action==="complete"?<Card className="p-5"><p className="font-semibold">Proof of delivery</p><p className="mt-1 text-sm text-secondary">Add a handoff photo when required by Spotly Operations or when it helps document the delivery.</p><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-sm font-semibold hover:bg-[var(--surface-2)]"><Camera className="h-5 w-5 text-[var(--accent)]"/>{uploading?"Uploading…":proofPhotoUrl?"Photo attached · replace":"Take or upload delivery photo"}<input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading} onChange={(e)=>uploadProof(e.target.files?.[0])}/></label></Card>:null}{step?<Button size="lg" className="w-full" onClick={act} loading={busy} disabled={Boolean(step.code&&code.length!==4)||Boolean(step.action==="complete"&&parcel.proofPhotoRequired&&!proofPhotoUrl)}>{step.button}</Button>:null}<JobProblemBar type="send" work={parcel} reload={reload}/><Button asChild variant="outline" className="w-full"><Link href="/support"><ShieldCheck className="h-4 w-4"/>Open Safety toolkit</Link></Button></div>;
}

function ActiveRide({ data, reload }) {
  const ride = data.activeRide; const { toast } = useToast(); const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (!ride) return <div className="space-y-6"><PageHeader {...sectionMeta.active} /><LottieEmptyState name="route-delivery" tone="driver" title="No active ride" description="Accept a ride while online and it will appear here." action={<Button asChild><Link href="/jobs">View work</Link></Button>} /></div>;
  const actions = {
    driver_assigned: { action: "start_to_pickup", label: "Start going to pickup", destination: ride.pickup },
    driver_to_pickup: { action: "arrive_pickup", label: "I arrived at pickup", destination: ride.pickup },
    driver_arrived_pickup: { action: "begin_pickup_verification", label: "Ask for pickup PIN", destination: ride.pickup },
    pickup_verification: { action: "verify_pickup", label: "Verify PIN & start ride", code: true, destination: ride.pickup },
    in_trip: { action: "arrive_dropoff", label: "I arrived at destination", destination: ride.dropoff },
    driver_arrived_dropoff: { action: "complete", label: "Complete ride", destination: ride.dropoff }
  }; const step = actions[ride.state];
  function navigate() { if (!step?.destination) return; const dest = step.destination; const coords = Number.isFinite(Number(dest.lat)) && Number.isFinite(Number(dest.lng)) ? `${dest.lat},${dest.lng}` : encodeURIComponent(dest.formattedAddress || ""); window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords}`, "_blank", "noopener,noreferrer"); }
  async function act() { if (!step) return; setBusy(true); setError(""); try { await authenticatedFetch("/api/driver/rides", { method: "POST", body: JSON.stringify({ rideId: ride.id, action: step.action, code: step.code ? code.trim() : undefined }) }); setCode(""); await reload(); toast(step.action === "complete" ? `Ride complete. You earned ${formatCurrency(ride.acceptedDriverPay || ride.quote?.driverPay || 0, ride.currency)}.` : "Ride updated.", { type: "success" }); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="space-y-6"><PageHeader eyebrow={ride.number} title={ride.state === "in_trip" ? "Take the rider to the destination" : ride.state === "pickup_verification" ? "Confirm the rider" : "Active ride"} description="Follow one clear step at a time. Never start the trip without the rider's pickup PIN." />{error && <div role="alert" className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{error}</div>}<Card className="overflow-hidden"><div className="p-6 sm:p-8"><div className="flex items-center gap-2"><Badge tone="info">Ride</Badge><p className="text-xs font-semibold uppercase tracking-[.1em] text-tertiary">{ride.serviceType || "economy"}</p></div><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em]">{step?.destination?.formattedAddress || step?.destination?.label || (ride.state === "in_trip" ? "Destination" : "Pickup")}</h2><p className="mt-3 text-sm text-secondary">{ride.pickup?.area || "Pickup"} → {ride.dropoff?.area || "Destination"}</p>{step?.destination ? <Button className="mt-5" variant="outline" onClick={navigate}><Navigation className="h-4 w-4" />Open navigation</Button> : null}</div><div className="grid gap-3 border-t bg-[var(--surface-2)] p-5 sm:grid-cols-3"><div><p className="text-xs font-semibold text-tertiary">PAY</p><p className="mt-1 text-lg font-semibold">{formatCurrency(ride.acceptedDriverPay || ride.quote?.driverPay || 0, ride.currency)}</p></div><div><p className="text-xs font-semibold text-tertiary">TRIP</p><p className="mt-1 text-lg font-semibold">{ride.quote?.distanceKm || 0} km</p></div><div><p className="text-xs font-semibold text-tertiary">STATE</p><p className="mt-1 text-lg font-semibold capitalize">{labelStatus(ride.state)}</p></div></div></Card>{step?.code ? <Card className="p-5"><label className="text-sm font-medium">4-digit pickup PIN from the rider<input inputMode="numeric" autoComplete="one-time-code" className="field-control mt-2 h-14 w-full text-center text-2xl font-semibold tracking-[.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" /></label><p className="mt-2 text-xs text-secondary">Check the rider and vehicle details together. The ride only starts after Spotly verifies the PIN.</p></Card> : null}{step ? <Button size="lg" className="min-h-14 w-full text-base" loading={busy} disabled={Boolean(step.code && code.length < 4)} onClick={act}>{step.label}</Button> : null}<JobProblemBar type="ride" work={ride} reload={reload} /><Button asChild variant="outline" className="w-full"><Link href="/support"><ShieldCheck className="h-4 w-4" />Open Safety toolkit</Link></Button></div>;
}

function Earnings({ data, reload }) {
  const ledger = data.earnings || [];
  const payouts = data.payouts || [];
  const { toast } = useToast();
  const currencies = ["USD", "ZWG"].filter((currency) => data.balances?.[currency] || ledger.some((item) => (item.currency || "USD") === currency));
  const [currency, setCurrency] = useState(currencies[0] || "USD");
  const balance = data.balances?.[currency] || {};
  const currencyLedger = ledger.filter((item) => (item.currency || "USD") === currency);
  const fallbackAvailable = currencyLedger.filter((item) => (item.bucket || "available") === "available").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const available = data.balances?.[currency] ? Number(balance.available || 0) : fallbackAvailable;
  const paid = data.balances?.[currency] ? Number(balance.paid_out || 0) : currencyLedger.filter((item) => item.bucket === "paid_out").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const reserved = Number(balance.reserved || 0);
  const processing = Number(balance.processing || 0);
  const minimum = Number(data.payoutPolicy?.minimum || 20);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payoutEdit, setPayoutEdit] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ type: data.payoutAccount?.type || "mobile_money", provider: data.payoutAccount?.provider || "EcoCash", recipientName: data.application?.legalName || data.driver?.displayName || "", identifier: "" });
  const earningTypes = new Set(["delivery_earned", "ride_earned", "parcel_earned", "send_earned"]);
  const earningEvents = currencyLedger.filter((item) => earningTypes.has(item.type));
  const todayKey = new Date().toDateString();
  const todayEarned = earningEvents.filter((item) => new Date(item.createdAt || 0).toDateString() === todayKey).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  async function updatePayoutDestination() {
    if (!payoutForm.provider.trim() || !payoutForm.recipientName.trim() || payoutForm.identifier.trim().length < 3) return setError("Add the provider, recipient name and new account or wallet identifier.");
    setBusy(true); setError("");
    try {
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "payout", payout: payoutForm }) });
      setPayoutEdit(false); setPayoutForm((current) => ({ ...current, identifier: "" }));
      await reload(); toast("Payout destination sent to Spotly for verification.", { type: "success" });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function requestPayout() {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    setBusy(true); setError("");
    try {
      await authenticatedFetch("/api/driver/payout", { method: "POST", body: JSON.stringify({ action: "request", amount: numeric, currency }) });
      setAmount(""); await reload(); toast("Your payout request was sent to Spotly.", { type: "success" });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><PageHeader {...sectionMeta.earnings} actions={currencies.length > 1 ? <div className="flex gap-2">{currencies.map((item) => <Button key={item} size="sm" variant={currency === item ? "primary" : "outline"} onClick={() => { setCurrency(item); setAmount(""); }}>{item}</Button>)}</div> : null} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card className="p-5"><CircleDollarSign className="h-5 w-5 text-[var(--accent)]" /><p className="mt-4 text-sm text-secondary">Today</p><p className="mt-1 text-3xl font-semibold">{formatCurrency(todayEarned, currency)}</p></Card><Card className="p-5"><WalletCards className="h-5 w-5 text-[var(--accent)]" /><p className="mt-4 text-sm text-secondary">Available</p><p className="mt-1 text-3xl font-semibold">{formatCurrency(available, currency)}</p></Card><Card className="p-5"><Clock3 className="h-5 w-5 text-[var(--accent)]" /><p className="mt-4 text-sm text-secondary">Payout in progress</p><p className="mt-1 text-3xl font-semibold">{formatCurrency(reserved + processing, currency)}</p></Card><Card className="p-5"><PackageCheck className="h-5 w-5 text-[var(--accent)]" /><p className="mt-4 text-sm text-secondary">Completed earning events</p><p className="mt-1 text-3xl font-semibold">{earningEvents.length}</p><p className="mt-1 text-xs text-secondary">Ride, Delivery and Send included</p></Card></div>
    <div className="grid gap-5 lg:grid-cols-2"><SectionCard padded title="Request a payout" description={`Minimum ${formatCurrency(minimum, currency)} · ${String(data.payoutPolicy?.cadence || "weekly").replaceAll("_", " ")}`}><div className="space-y-4"><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold text-tertiary">PAYOUT ACCOUNT</p><p className="mt-2 font-semibold">{data.payoutAccount ? `${data.payoutAccount.provider || data.payoutAccount.type} · ${data.payoutAccount.maskedIdentifier || "Saved"}` : "Not set up"}</p><p className="mt-1 text-sm capitalize text-secondary">{labelStatus(data.payoutAccount?.verificationState || "not verified")}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => setPayoutEdit((value) => !value)}>{payoutEdit ? "Cancel change" : data.payoutAccount ? "Change payout destination" : "Set payout destination"}</Button>{payoutEdit ? <div className="mt-4 grid gap-3"><label className="text-xs font-semibold">TYPE<select className="field-control mt-1 w-full" value={payoutForm.type} onChange={(event) => setPayoutForm((current) => ({ ...current, type: event.target.value }))}><option value="mobile_money">Mobile money</option><option value="bank">Bank account</option></select></label><label className="text-xs font-semibold">PROVIDER<input className="field-control mt-1 w-full" value={payoutForm.provider} onChange={(event) => setPayoutForm((current) => ({ ...current, provider: event.target.value }))} placeholder="EcoCash, CBZ…" /></label><label className="text-xs font-semibold">RECIPIENT NAME<input className="field-control mt-1 w-full" value={payoutForm.recipientName} onChange={(event) => setPayoutForm((current) => ({ ...current, recipientName: event.target.value }))} /></label><label className="text-xs font-semibold">NEW ACCOUNT / WALLET<input className="field-control mt-1 w-full" value={payoutForm.identifier} onChange={(event) => setPayoutForm((current) => ({ ...current, identifier: event.target.value }))} autoComplete="off" /></label><Button size="sm" loading={busy} onClick={updatePayoutDestination}>Send for verification</Button><p className="text-xs leading-5 text-secondary">For security, Spotly may ask you to sign in again before replacing a verified destination.</p></div> : null}</div>{error && <p role="alert" className="rounded-lg bg-[var(--danger-soft)] p-3 text-sm text-[var(--on-danger-soft)]">{error}</p>}<label className="text-sm font-medium">Payout amount ({currency})<input className="field-control mt-2 w-full" type="number" min={minimum} max={available} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={Math.max(minimum, available).toFixed(2)} /></label><Button onClick={requestPayout} loading={busy} disabled={data.payoutAccount?.verificationState !== "verified" || Number(amount) < minimum || Number(amount) > available}>Request {currency} payout</Button>{data.payoutAccount?.verificationState !== "verified" && <p className="text-xs leading-5 text-secondary">You can keep earning if your work capabilities are active, but Spotly must verify this payout destination before sending money.</p>}</div></SectionCard><SectionCard padded title="Payout history">{payouts.filter((item) => (item.currency || "USD") === currency).length ? <div className="divide-y">{payouts.filter((item) => (item.currency || "USD") === currency).map((item) => <div key={item.id} className="flex items-center gap-4 py-3"><div className="min-w-0 flex-1"><p className="font-medium">{formatCurrency(item.amount || 0, item.currency)}</p><p className="mt-1 text-xs text-secondary">{dateTime(item.createdAt)}{item.reference ? ` · ${item.reference}` : ""}</p></div><StatusBadge status={item.status || "requested"} /></div>)}</div> : <LottieEmptyState name="success-burst" tone="driver" title={`No ${currency} payouts yet`} description="Requested and completed payouts will appear here." />}</SectionCard></div>
    <SectionCard padded title="Earnings activity" description="Work earnings and adjustments are shown as Driver language, while Spotly keeps the detailed ledger authoritative in the background.">{currencyLedger.length ? <div className="divide-y">{currencyLedger.map((item) => <div key={item.id} className="flex items-center gap-4 py-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--success-soft)] text-success"><CircleDollarSign className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-medium">{item.type === "ride_earned" ? "Ride earnings" : item.type === "delivery_earned" ? "Delivery earnings" : ["parcel_earned", "send_earned"].includes(item.type) ? "Send earnings" : labelStatus(item.type)}</p><p className="mt-1 text-xs text-secondary">{dateTime(item.createdAt)} · {item.deliveryJobId || item.rideId || item.parcelJobId || item.reference || item.description || "Driver Money"}</p></div><p className="font-semibold">{formatCurrency(item.amount || 0, item.currency)}</p></div>)}</div> : <LottieEmptyState name="success-burst" tone="driver" title="No earnings yet" description="Completed Ride, Delivery and Send work will appear here automatically." />}</SectionCard>
  </div>;
}

function HistoryView({ data }) {
  const jobs = (data.jobs || []).filter((item) => ["delivered", "failed", "cancelled", "returned"].includes(item.state));
  const rides = (data.rides || []).filter((item) => ["completed", "failed", "cancelled"].includes(item.state));
  const parcels = (data.parcels || []).filter((item) => ["delivered", "failed", "cancelled", "returned"].includes(item.state));
  const rows = [...rides.map((item) => ({ ...item, kind: "ride", sortAt: item.completedAt || item.updatedAt || item.createdAt })), ...jobs.map((item) => ({ ...item, kind: item.fulfilmentMode === "driver_shops" ? "shopping" : "delivery", sortAt: item.deliveredAt || item.updatedAt || item.createdAt })), ...parcels.map((item) => ({ ...item, kind: "send", sortAt: item.deliveredAt || item.updatedAt || item.createdAt }))].sort((a,b) => String(b.sortAt || "").localeCompare(String(a.sortAt || "")));
  return <div className="space-y-6"><PageHeader {...sectionMeta.history} />{rows.length ? <div className="space-y-3">{rows.map((item) => <Card key={`${item.kind}_${item.id}`} className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Badge tone={item.kind === "ride" ? "info" : item.kind === "send" || item.kind === "shopping" ? "accent" : "neutral"}>{item.kind === "ride" ? "Ride" : item.kind === "send" ? "Send" : item.kind === "shopping" ? "Shop & Deliver" : "Delivery"}</Badge><p className="text-xs font-semibold text-tertiary">{item.number}</p></div><h3 className="mt-2 font-semibold">{item.pickup?.area || "Pickup"} → {item.dropoff?.suburb || item.dropoff?.area || "Destination"}</h3><p className="mt-1 text-sm text-secondary">{dateTime(item.sortAt)}</p></div><div className="text-right"><StatusBadge status={item.state} /><p className="mt-3 font-semibold">{formatCurrency(item.kind === "ride" || item.kind === "send" ? item.acceptedDriverPay || item.quote?.driverPay || 0 : item.acceptedDriverPay || item.quotedDriverPay || 0, item.currency)}</p></div></div></Card>)}</div> : <LottieEmptyState name="route-delivery" tone="driver" title="No completed work yet" description="Completed Ride, Delivery and Send work will appear here." />}</div>;
}

function Support({ data }) {
  const [category, setCategory] = useState("safety");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("critical");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const active = data.activeRide || data.activeParcel || data.activeJob;
  async function report(options = {}) {
    const nextCategory = options.category || category;
    const nextSeverity = options.severity || severity;
    const nextDescription = options.description || description.trim();
    if (nextDescription.length < 3) return;
    setBusy(true);
    try {
      await authenticatedFetch("/api/driver/incidents", { method: "POST", body: JSON.stringify({ deliveryJobId: data.activeJob?.id, rideId: data.activeRide?.id, parcelJobId: data.activeParcel?.id, category: nextCategory, description: nextDescription, severity: nextSeverity }) });
      setDescription("");
      toast(nextSeverity === "critical" ? "Urgent safety incident sent to Spotly Operations." : "The incident was sent to Spotly Operations.", { type: "success" });
    } catch (err) { toast(err.message, { type: "error" }); }
    finally { setBusy(false); }
  }
  const location = data.presence?.currentLocation;
  const emergencyPhone = data.application?.emergencyContactPhone || "";
  const emergencyName = data.application?.emergencyContactName || "Trusted contact";
  const cityEmergency = ["Harare", "Bulawayo"].includes(data.driver?.city || data.application?.city || "") ? "112" : "";
  async function shareCurrentWork() {
    const reference = active?.number || active?.id || "No active job";
    const locationText = location ? `https://maps.google.com/?q=${location.lat},${location.lng}` : "Location unavailable";
    const text = `Spotly Driver safety share · ${reference} · ${locationText}`;
    try {
      if (navigator.share) await navigator.share({ title: "Spotly Driver safety share", text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); toast("Safety details copied. Share them with someone you trust.", { type: "success" }); }
    } catch {}
  }
  return <div className="space-y-6"><PageHeader {...sectionMeta.support} />
    <Card className="border-danger p-5"><div className="flex flex-col gap-4"><div><Badge tone="danger">SAFETY TOOLKIT</Badge><h2 className="mt-2 text-xl font-semibold">If you are in immediate danger, move to safety and contact emergency services first.</h2><p className="mt-2 text-sm text-secondary">Spotly can receive an urgent incident with your current job context. This does not replace police, ambulance or fire services.</p>{location ? <p className="mt-2 text-xs font-semibold">Current Spotly location: {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}</p> : null}</div><div className="flex flex-wrap gap-2">{cityEmergency ? <Button asChild className="bg-danger text-[var(--on-danger)] hover:bg-danger"><a href={`tel:${cityEmergency}`}><Phone className="h-4 w-4"/>Call {cityEmergency} emergency response</a></Button> : null}<Button variant="outline" className="border-danger text-danger" loading={busy} onClick={() => report({ category: "safety", severity: "critical", description: `Emergency safety help requested${active ? ` during ${active.number || active.id}` : ""}.` })}><ShieldCheck className="h-4 w-4"/>Alert Spotly urgently</Button><Button variant="outline" onClick={shareCurrentWork}><MapPin className="h-4 w-4"/>Share current job & location</Button>{emergencyPhone ? <Button asChild variant="outline"><a href={`tel:${emergencyPhone}`}><Phone className="h-4 w-4"/>Call {emergencyName}</a></Button> : null}</div>{cityEmergency ? <p className="text-xs leading-5 text-secondary">Zimbabwe Republic Police publishes 112/911 Emergency Response Centre numbers for Harare and Bulawayo. Use the appropriate local emergency service for your actual situation.</p> : <p className="text-xs leading-5 text-secondary">Your current city does not have a Spotly-configured emergency number. Use your phone’s local emergency service and share your location above.</p>}</div></Card>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Crash / collision","crash","critical"],["Unsafe person or place","unsafe_person","critical"],["Vehicle breakdown","breakdown","high"],["Cannot complete handoff","customer_unreachable","high"]].map(([title, quickCategory, quickSeverity]) => <button type="button" key={quickCategory} disabled={busy} onClick={() => report({ category: quickCategory, severity: quickSeverity, description: `${title}${active ? ` · ${active.number || active.id}` : ""}. Driver requested operational assistance.` })} className="rounded-xl border bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--surface-2)]"><ShieldCheck className="h-5 w-5 text-[var(--accent)]"/><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-xs text-secondary">Send a job-linked {quickSeverity} alert</p></button>)}</div>
    <div className="grid gap-5 lg:grid-cols-2"><SectionCard padded title="Report another problem" description={active ? `Spotly will attach ${active.number || active.id} automatically.` : "This report will be attached to your Driver account."}><div className="space-y-4"><label className="text-sm font-medium">What happened?<select className="field-control mt-2 w-full" value={category} onChange={(e) => setCategory(e.target.value)}><option value="safety">Safety concern</option><option value="crash">Crash / collision</option><option value="unsafe_person">Unsafe person or place</option><option value="breakdown">Vehicle breakdown</option><option value="customer_unreachable">Cannot reach customer / recipient</option><option value="ride_no_show">Rider not at pickup</option><option value="merchant_closed">Merchant closed</option><option value="parcel_mismatch">Parcel does not match declaration</option><option value="checkout_problem">Store checkout problem</option><option value="return_required">Return / failed delivery help</option><option value="address_problem">Cannot find address</option><option value="order_damaged">Order damaged</option><option value="other">Other</option></select></label><label className="text-sm font-medium">Urgency<select className="field-control mt-2 w-full" value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="text-sm font-medium">What does Spotly need to know?<textarea className="field-control mt-2 min-h-28 w-full" value={description} onChange={(e) => setDescription(e.target.value)} /></label><Button onClick={() => report()} loading={busy} disabled={description.trim().length < 3}>Send to Spotly Operations</Button></div></SectionCard><SectionCard padded title="Your recent support"><div className="space-y-3">{(data.incidents || []).slice(0, 8).map((incident) => <div key={incident.id} className="rounded-xl bg-[var(--surface-2)] p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold capitalize">{labelStatus(incident.category)}</p><StatusBadge status={incident.status || "open"}/></div><p className="mt-1 text-xs text-secondary">{labelStatus(incident.severity)} · {dateTime(incident.createdAt)}</p></div>)}{!(data.incidents || []).length ? <LottieEmptyState name="success-burst" tone="driver" title="No support cases" description="Job-linked incidents and their status will appear here."/> : null}</div></SectionCard></div>
  </div>;
}

function AdditionalVehicleSetup({ data, reload, onDone }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const editableVehicle = (data.vehicles || []).find((item) => ["setup_required", "information_required", "rejected"].includes(item.status) && !String(item.id || "").endsWith("_primary")) || null;
  const initialType = editableVehicle?.type || "motorcycle";
  const [step, setStep] = useState(0);
  const [vehicleId, setVehicleId] = useState(editableVehicle?.id || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [documentMeta, setDocumentMeta] = useState({});
  const [form, setForm] = useState({
    type: initialType,
    registration: editableVehicle?.registration || "",
    make: editableVehicle?.make || "",
    model: editableVehicle?.model || "",
    year: editableVehicle?.year || "",
    ownership: editableVehicle?.ownership || "driver_owned",
    requestedCapabilities: normalizeCapabilities(editableVehicle?.requestedCapabilities || [], initialType).filter((id) => capabilitySupportsVehicle(id, initialType))
  });
  const requestedCapabilities = form.requestedCapabilities.filter((id) => capabilitySupportsVehicle(id, form.type));
  const requiredDocumentTypes = documentRequirementsFor({ vehicleType: form.type, capabilities: requestedCapabilities });

  function setVehicleType(type) {
    const capabilities = normalizeCapabilities(form.requestedCapabilities, type).filter((id) => capabilitySupportsVehicle(id, type));
    setForm((current) => ({ ...current, type, registration: type === "bicycle" ? "" : current.registration, requestedCapabilities: capabilities }));
  }
  function toggleCapability(capabilityId) {
    if (!capabilitySupportsVehicle(capabilityId, form.type)) return;
    setForm((current) => ({ ...current, requestedCapabilities: current.requestedCapabilities.includes(capabilityId) ? current.requestedCapabilities.filter((id) => id !== capabilityId) : [...current.requestedCapabilities, capabilityId] }));
  }
  function newestDocument(type) {
    const scoped = VEHICLE_SCOPED_DOCUMENTS.has(type);
    return (data.documents || []).filter((item) => item.type === type && (!scoped || (vehicleId && item.vehicleId === vehicleId))).slice().sort((a, b) => new Date(b.uploadedAt || b.updatedAt || 0).getTime() - new Date(a.uploadedAt || a.updatedAt || 0).getTime())[0] || null;
  }
  async function saveVehicleDetails() {
    if (form.type !== "bicycle" && form.registration.trim().length < 2) return setError("Add the motor vehicle registration before continuing.");
    if (!requestedCapabilities.length) return setError("Choose at least one kind of work for this vehicle.");
    setBusy(true); setError("");
    try {
      const result = await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "vehicle", vehicleId: vehicleId || undefined, vehicle: { ...form, year: form.year ? Number(form.year) : null, registration: form.type === "bicycle" ? "" : form.registration, requestedCapabilities } }) });
      setVehicleId(result.vehicleId);
      await reload?.({ quiet: true });
      setStep(1);
    } catch (err) { setError(err.message || "The vehicle setup could not be saved."); }
    finally { setBusy(false); }
  }
  async function uploadVehicleDocument(type, file) {
    if (!file || !user?.uid || !vehicleId) return;
    const meta = documentMeta[type] || {};
    if (EXPIRY_DOCUMENTS.has(type) && !meta.expiresAt) return setError(`Add the expiry date for your ${type.replaceAll("_", " ")} before uploading.`);
    setUploading(type); setError("");
    try {
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `driver-applications/${user.uid}/documents/vehicle-${vehicleId}/${type}/${Date.now()}-${safe}`;
      await uploadFile(path, file, { driverId: user.uid, documentType: type, vehicleId, ownerId: user.uid });
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "document", document: { type, storagePath: path, fileName: file.name, expiresAt: meta.expiresAt || null, referenceNumber: meta.referenceNumber || (type === "registration" ? form.registration : ""), vehicleId: VEHICLE_SCOPED_DOCUMENTS.has(type) ? vehicleId : undefined } }) });
      toast(`${DOCUMENTS.find((item) => item.type === type)?.label || labelStatus(type)} sent to Spotly.`, { type: "success" });
      await reload?.({ quiet: true });
    } catch (err) { setError(err.message || "The document could not be uploaded."); }
    finally { setUploading(""); }
  }
  async function submitVehicleForReview() {
    if (!vehicleId) return setError("Save the vehicle details first.");
    setBusy(true); setError("");
    try {
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "vehicle_submit", vehicleId }) });
      toast("Vehicle setup sent to Driver Operations for review.", { type: "success" });
      await reload?.({ quiet: true });
      onDone?.();
    } catch (err) { setError(err.message || "The vehicle could not be submitted."); }
    finally { setBusy(false); }
  }

  return <Card className="p-5"><div className="flex items-start justify-between gap-4"><div><Badge tone="info">VEHICLE SETUP</Badge><h3 className="mt-2 text-lg font-semibold">{editableVehicle ? "Continue vehicle setup" : "Add another vehicle"}</h3><p className="mt-1 text-sm text-secondary">A vehicle is not sent for approval until its work types and required evidence are complete.</p></div><Button size="sm" variant="ghost" onClick={onDone}>Close</Button></div>{editableVehicle?.reviewReason ? <div className="mt-4 rounded-xl bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]"><strong>Driver Operations requested changes.</strong><br />{editableVehicle.reviewReason}</div> : null}{error ? <div className="mt-4 rounded-xl bg-[var(--danger-soft)] p-3 text-sm text-[var(--on-danger-soft)]">{error}</div> : null}<div className="mt-5 grid grid-cols-3 gap-2">{["Vehicle & work", "Evidence", "Review"].map((label, index) => <div key={label}><div className={cn("h-1.5 rounded-full", index <= step ? "bg-[var(--accent)]" : "bg-[var(--border)]")} /><p className="mt-2 text-[11px] font-semibold text-secondary">{label}</p></div>)}</div>
    {step === 0 ? <div className="mt-5 space-y-5"><div><p className="text-sm font-semibold">Vehicle type</p><div className="mt-3 grid gap-3 sm:grid-cols-4">{DRIVER_VEHICLES.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => setVehicleType(id)} className={cn("rounded-xl border p-4 text-left", form.type === id && "border-[var(--accent)] bg-[var(--accent-soft)]")}><Icon className="h-5 w-5 text-[var(--accent)]"/><p className="mt-2 text-sm font-semibold">{label}</p></button>)}</div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-medium">Ownership<select className="field-control mt-2 w-full" value={form.ownership} onChange={(event) => setForm((current) => ({ ...current, ownership: event.target.value }))}><option value="driver_owned">I own it</option><option value="rented">Rented</option><option value="fleet_owned">Fleet / company owned</option></select></label>{form.type !== "bicycle" ? <label className="text-sm font-medium">Registration<input className="field-control mt-2 w-full uppercase" value={form.registration} onChange={(event) => setForm((current) => ({ ...current, registration: event.target.value }))} placeholder="ABC 1234" /></label> : null}<label className="text-sm font-medium">Year<input type="number" min="1950" max="2100" className="field-control mt-2 w-full" value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} placeholder="2022" /></label><label className="text-sm font-medium">Make<input className="field-control mt-2 w-full" value={form.make} onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))} placeholder={form.type === "bicycle" ? "Giant" : "Toyota"} /></label><label className="text-sm font-medium">Model<input className="field-control mt-2 w-full" value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} /></label></div><div><p className="text-sm font-semibold">Work this vehicle should be approved for</p><p className="mt-1 text-xs text-secondary">This determines the exact evidence Spotly asks for. Passenger Ride has stronger vehicle requirements than ordinary delivery.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.values(DRIVER_CAPABILITIES).map((capability) => { const supported = capabilitySupportsVehicle(capability.id, form.type); const selected = form.requestedCapabilities.includes(capability.id); return <button type="button" key={capability.id} disabled={!supported} onClick={() => toggleCapability(capability.id)} className={cn("rounded-xl border p-4 text-left", selected && supported && "border-[var(--accent)] bg-[var(--accent-soft)]", !supported && "cursor-not-allowed opacity-45")}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{capability.label}</p><p className="mt-1 text-xs leading-5 text-secondary">{capability.description}</p></div>{selected && supported ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--accent)]"/> : null}</div></button>; })}</div></div><Button className="w-full" loading={busy} onClick={saveVehicleDetails}>Continue to required evidence</Button></div> : null}
    {step === 1 ? <div className="mt-5 space-y-4"><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="font-semibold">Required for this {form.type.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-secondary">Motorized vehicles explicitly require a valid Driver licence. Vehicle papers below are tied to this exact vehicle, so one car’s evidence cannot approve another.</p></div><div className="grid gap-4 lg:grid-cols-2">{requiredDocumentTypes.map((type) => { const doc = newestDocument(type); const meta = documentMeta[type] || {}; const label = DOCUMENTS.find((item) => item.type === type)?.label || labelStatus(type); const expired = doc?.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now(); return <div key={type} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{label}</p><p className="mt-1 text-xs text-secondary">{VEHICLE_SCOPED_DOCUMENTS.has(type) ? "This evidence is linked to this vehicle." : "Driver-level evidence can be reused when it is still valid."}</p></div>{doc ? <Badge tone={doc.status === "approved" && !expired ? "success" : doc.status === "rejected" || expired ? "danger" : "warning"}>{expired ? "expired" : labelStatus(doc.status)}</Badge> : <Badge tone="danger">Missing</Badge>}</div>{doc?.reviewReason ? <p className="mt-2 text-xs text-danger">{doc.reviewReason}</p> : null}{doc?.expiresAt ? <p className="mt-2 text-xs text-secondary">Expires {dateTime(doc.expiresAt)}</p> : null}<div className="mt-4 grid gap-3">{type !== "identity" ? <label className="text-xs font-semibold">{type === "licence" ? "LICENCE NUMBER" : type === "registration" ? "REGISTRATION NUMBER" : "REFERENCE NUMBER (OPTIONAL)"}<input className="field-control mt-1 w-full" value={meta.referenceNumber ?? (type === "registration" ? form.registration : "")} onChange={(event) => setDocumentMeta((current) => ({ ...current, [type]: { ...(current[type] || {}), referenceNumber: event.target.value } }))} /></label> : null}{EXPIRY_DOCUMENTS.has(type) ? <label className="text-xs font-semibold">EXPIRY DATE<input type="date" className="field-control mt-1 w-full" value={meta.expiresAt || ""} onChange={(event) => setDocumentMeta((current) => ({ ...current, [type]: { ...(current[type] || {}), expiresAt: event.target.value } }))} /></label> : null}<label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"><Upload className="h-4 w-4"/>{uploading === type ? "Uploading…" : doc ? "Replace evidence" : "Upload evidence"}<input type="file" accept="image/*,.pdf" className="sr-only" disabled={Boolean(uploading)} onChange={(event) => uploadVehicleDocument(type, event.target.files?.[0])}/></label></div></div>; })}</div><div className="flex gap-2"><Button variant="outline" onClick={() => setStep(0)}>Back</Button><Button className="flex-1" onClick={() => setStep(2)}>Review vehicle setup</Button></div></div> : null}
    {step === 2 ? <div className="mt-5 space-y-4"><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="font-semibold capitalize">{[form.year, form.make, form.model].filter(Boolean).join(" ") || form.type} {form.registration ? `· ${form.registration.toUpperCase()}` : ""}</p><p className="mt-2 text-sm text-secondary">Requested work: {requestedCapabilities.map((id) => DRIVER_CAPABILITIES[id]?.shortLabel || id).join(", ")}</p></div><div className="divide-y rounded-xl border px-4">{requiredDocumentTypes.map((type) => { const doc = newestDocument(type); const expired = doc?.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now(); return <div key={type} className="flex items-center gap-3 py-3"><FileCheck2 className="h-4 w-4 text-[var(--accent)]"/><span className="flex-1 text-sm font-medium">{DOCUMENTS.find((item) => item.type === type)?.label || labelStatus(type)}</span><Badge tone={doc && !expired && doc.status !== "rejected" ? "success" : "danger"}>{doc && !expired && doc.status !== "rejected" ? "Added" : "Required"}</Badge></div>; })}</div><p className="text-xs leading-5 text-secondary">Submitting creates a visible Driver Operations review item in Admin. Spotly still must approve the vehicle and its evidence before you can select it for work.</p><div className="flex gap-2"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button className="flex-1" loading={busy} onClick={submitVehicleForReview}>Send complete vehicle for review</Button></div></div> : null}
  </Card>;
}


function ActiveDriverTraining({ data, reload }) {
  const { toast } = useToast();
  const [openTraining, setOpenTraining] = useState("");
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState("");
  const requested = data.application?.requestedCapabilities || data.driver?.requestedCapabilities || [];
  const modules = trainingRequirementsFor(requested);
  if (!modules.length) return null;
  async function complete(moduleId) {
    const module = DRIVER_TRAINING_MODULES[moduleId];
    const answer = answers[moduleId];
    if (answer !== module?.check?.answer) return;
    setBusy(moduleId);
    try {
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "training", trainingModuleId: moduleId, trainingAnswer: answer, trainingComplete: true }) });
      toast("Training module completed.", { type: "success" });
      setOpenTraining("");
      await reload?.({ quiet: true });
    } catch (err) { toast(err.message || "Training could not be saved.", { type: "error" }); }
    finally { setBusy(""); }
  }
  return <SectionCard padded title="Work training" description="When you add a vehicle or request a new kind of work, complete any new operating modules here. Training is separate by work type, so existing approvals stay intact."><div className="space-y-3">{modules.map((moduleId) => { const module = DRIVER_TRAINING_MODULES[moduleId]; const complete = trainingModuleIsCurrent(data.application || {}, moduleId); const open = openTraining === moduleId; const selectedAnswer = answers[moduleId]; return <div key={moduleId} className="rounded-xl bg-[var(--surface-2)] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", complete ? "bg-[var(--success-soft)] text-success" : "bg-[var(--accent-soft)] text-[var(--accent)]")}>{complete ? <CheckCircle2 className="h-5 w-5"/> : <ShieldCheck className="h-5 w-5"/>}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{module?.label || labelStatus(moduleId)}</span><span className="mt-1 block text-xs text-secondary">About {module?.minutes || 5} minutes · version {module?.version || 1}</span></span>{complete ? <Badge tone="success">Complete</Badge> : <Button size="sm" variant={open ? "outline" : "primary"} onClick={() => setOpenTraining(open ? "" : moduleId)}>{open ? "Close" : "Complete training"}</Button>}</div>{open && !complete ? <div className="mt-4 border-t pt-4"><ul className="space-y-2 text-sm text-secondary">{(module?.lessons || []).map((lesson) => <li key={lesson} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"/><span>{lesson}</span></li>)}</ul><div className="mt-5 rounded-xl bg-[var(--surface)] p-4"><p className="text-sm font-semibold">Quick check</p><p className="mt-2 text-sm text-secondary">{module?.check?.question}</p><div className="mt-3 space-y-2">{(module?.check?.options || []).map((option,index)=><label key={option} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", selectedAnswer === index && "border-[var(--accent)] bg-[var(--accent-soft)]")}><input type="radio" name={`active-training-${moduleId}`} className="mt-0.5" checked={selectedAnswer === index} onChange={() => setAnswers((current) => ({ ...current, [moduleId]: index }))}/><span>{option}</span></label>)}</div><Button className="mt-4" size="sm" loading={busy===moduleId} disabled={selectedAnswer !== module?.check?.answer} onClick={() => complete(moduleId)}>Complete module</Button></div></div> : null}</div>; })}</div></SectionCard>;
}

function Profile({ data, reload }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState("");
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [documentMeta, setDocumentMeta] = useState({});
  const driver = data.driver || {};
  const vehicles = data.vehicles || [];
  const selectedVehicle = vehicles.find((item) => item.id === data.accountHealth?.selectedVehicleId) || vehicles.find((item) => item.status === "approved") || vehicles[0];
  const blockers = (data.eligibility?.checks || []).filter((check) => !check.ok);
  const capabilityIds = data.application?.requestedCapabilities?.length ? data.application.requestedCapabilities : Object.keys(driver.capabilities || {});
  const requiredDocumentTypes = documentRequirementsFor({ vehicleType: selectedVehicle?.type || "car", capabilities: capabilityIds });
  const documentTypes = [...new Set([...requiredDocumentTypes, ...(data.documents || []).map((item) => item.type).filter(Boolean)])];
  const inProgressVehicle = vehicles.find((item) => ["setup_required", "information_required", "rejected"].includes(item.status) && !String(item.id || "").endsWith("_primary"));

  function newestDocument(type) {
    const scoped = VEHICLE_SCOPED_DOCUMENTS.has(type);
    return (data.documents || []).filter((item) => item.type === type && (!scoped || !selectedVehicle?.id || item.vehicleId === selectedVehicle.id || (String(selectedVehicle.id).endsWith("_primary") && !item.vehicleId))).slice().sort((a, b) => new Date(b.uploadedAt || b.updatedAt || 0).getTime() - new Date(a.uploadedAt || a.updatedAt || 0).getTime())[0] || null;
  }
  async function uploadRenewal(type, file) {
    if (!file || !user?.uid) return;
    const meta = documentMeta[type] || {};
    if (EXPIRY_DOCUMENTS.has(type) && !meta.expiresAt) return toast(`Add the expiry date for your ${type.replaceAll("_", " ")}.`, { type: "error" });
    setUploading(type);
    try {
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `driver-applications/${user.uid}/documents/renewals/${type}/${Date.now()}-${safe}`;
      await uploadFile(path, file, { driverId: user.uid, documentType: type, vehicleId: selectedVehicle?.id || null, ownerId: user.uid });
      await authenticatedFetch("/api/driver/application", { method: "POST", body: JSON.stringify({ action: "document", document: { type, storagePath: path, fileName: file.name, expiresAt: meta.expiresAt || null, referenceNumber: meta.referenceNumber || (type === "registration" ? selectedVehicle?.registration || "" : ""), vehicleId: VEHICLE_SCOPED_DOCUMENTS.has(type) ? selectedVehicle?.id : undefined } }) });
      toast("Document sent to Spotly for review.", { type: "success" });
      setDocumentMeta((current) => ({ ...current, [type]: {} }));
      await reload?.({ quiet: true });
    } catch (err) { toast(err.message || "The document could not be uploaded.", { type: "error" }); }
    finally { setUploading(""); }
  }
  return <div className="space-y-6"><PageHeader {...sectionMeta.profile} actions={<Button asChild variant="outline"><Link href="/account">Personal account settings</Link></Button>} />
    <Card className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--on-accent)]"><UserRound className="h-6 w-6" /></span><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{driver.displayName || driver.legalName || data.application?.legalName || "Spotly Driver"}</h2><Badge tone={blockers.length ? "warning" : "success"}>{blockers.length ? `${blockers.length} blocker${blockers.length === 1 ? "" : "s"}` : "Ready"}</Badge></div><p className="mt-1 text-sm text-secondary">{driver.city || data.application?.city || "Zimbabwe"} · Driver lifecycle {labelStatus(driver.status || "active")}</p></div></div></Card>
    <SectionCard padded title="Work approvals" description="A work type can be active even while another is still being reviewed."><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{(data.capabilities || []).map((capability) => <div key={capability.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{capability.label}</p><p className="mt-1 text-xs leading-5 text-secondary">{capability.description}</p></div><Badge tone={capability.status === "active" && capability.ready !== false ? "success" : capability.status === "blocked" || capability.status === "temporarily_blocked" ? "danger" : "warning"}>{capability.status === "active" && capability.ready !== false ? "Ready" : labelStatus(capability.status)}</Badge></div>{capability.requirements?.some((item) => !item.ok) ? <p className="mt-3 text-xs text-secondary">Needs: {capability.requirements.filter((item) => !item.ok).map((item) => item.label).join(", ")}</p> : null}</div>)}</div></SectionCard>
    <ActiveDriverTraining data={data} reload={reload} />
    <div className="grid gap-5 lg:grid-cols-2"><SectionCard padded title="Vehicles" description="Every added vehicle has its own setup and evidence. Only approved vehicles can be selected when you go online."><div className="space-y-3">{vehicles.map((vehicle) => <div key={vehicle.id} className={cn("rounded-xl p-4", vehicle.id === selectedVehicle?.id ? "border border-[var(--accent)] bg-[var(--accent-soft)]" : "bg-[var(--surface-2)]")}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold capitalize">{vehicle.type || "Vehicle"}{vehicle.id === selectedVehicle?.id ? " · selected" : ""}</p><p className="mt-1 text-sm text-secondary">{[vehicle.year, vehicle.make, vehicle.model, vehicle.registration].filter(Boolean).join(" · ") || (vehicle.type === "bicycle" ? "Bicycle" : "Vehicle details saved")}</p>{vehicle.requestedCapabilities?.length ? <p className="mt-2 text-xs text-secondary">Requested work: {vehicle.requestedCapabilities.map((id) => DRIVER_CAPABILITIES[id]?.shortLabel || id).join(", ")}</p> : null}{vehicle.reviewReason ? <p className="mt-2 text-xs text-danger">{vehicle.reviewReason}</p> : null}</div><Badge tone={vehicle.status === "approved" ? "success" : vehicle.status === "rejected" ? "danger" : vehicle.status === "setup_required" || vehicle.status === "information_required" ? "warning" : "info"}>{vehicle.status === "setup_required" ? "Setup incomplete" : labelStatus(vehicle.status || "pending")}</Badge></div></div>)}{!vehicles.length ? <p className="rounded-xl bg-[var(--surface-2)] p-4 text-sm text-secondary">No vehicle is on file.</p> : null}<Button size="sm" variant="outline" onClick={() => setVehicleFormOpen((value) => !value)}>{vehicleFormOpen ? "Close vehicle setup" : inProgressVehicle ? "Continue vehicle setup" : "Add another vehicle"}</Button>{vehicleFormOpen ? <div className="pt-2"><AdditionalVehicleSetup data={data} reload={reload} onDone={() => setVehicleFormOpen(false)} /></div> : null}</div></SectionCard><SectionCard padded title="Payout readiness"><div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="font-semibold">{data.payoutAccount ? `${data.payoutAccount.provider || data.payoutAccount.type} · ${data.payoutAccount.maskedIdentifier || "Saved"}` : "No payout destination saved"}</p><p className="mt-1 text-sm capitalize text-secondary">{labelStatus(data.accountHealth?.payout || "missing")}</p><Button asChild size="sm" variant="outline" className="mt-3"><Link href="/earnings">Open Driver Money</Link></Button></div></SectionCard></div>
    <SectionCard padded title="Documents & renewals" description="Replace rejected or expiring evidence here. Vehicle registration, insurance and fitness are tied to the currently selected vehicle; your identity and Driver licence are Driver-level evidence."><div className="divide-y">{documentTypes.map((type) => { const item = newestDocument(type); const required = requiredDocumentTypes.includes(type); const meta = documentMeta[type] || {}; return <div key={type} className="py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><FileCheck2 className="h-5 w-5 shrink-0 text-[var(--accent)]" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-medium">{DOCUMENTS.find((entry) => entry.type === type)?.label || labelStatus(type)}</span>{required ? <Badge tone="neutral">Required</Badge> : null}</span>{item?.referenceNumber ? <span className="mt-1 block text-xs text-secondary">Reference {item.referenceNumber}</span> : null}{item?.expiresAt ? <span className="mt-1 block text-xs text-secondary">Expires {dateTime(item.expiresAt)}</span> : null}{item?.reviewReason ? <span className="mt-1 block text-xs text-danger">{item.reviewReason}</span> : null}{!item ? <span className="mt-1 block text-xs text-danger">No valid document on file</span> : null}</span>{item ? <Badge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{labelStatus(item.status)}</Badge> : <Badge tone="danger">Missing</Badge>}</div><div className="mt-3 grid gap-3 pl-0 sm:grid-cols-[1fr_1fr_auto] sm:pl-8">{type !== "identity" ? <input aria-label={`${type} reference number`} className="field-control" placeholder={type === "licence" ? "Licence number" : "Reference number"} value={meta.referenceNumber ?? (type === "registration" ? selectedVehicle?.registration || "" : "")} onChange={(event) => setDocumentMeta((current) => ({ ...current, [type]: { ...(current[type] || {}), referenceNumber: event.target.value } }))} /> : <span />}{EXPIRY_DOCUMENTS.has(type) ? <input aria-label={`${type} expiry date`} type="date" className="field-control" value={meta.expiresAt || ""} onChange={(event) => setDocumentMeta((current) => ({ ...current, [type]: { ...(current[type] || {}), expiresAt: event.target.value } }))} /> : <span />}<label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"><Upload className="h-4 w-4" />{uploading === type ? "Uploading…" : item ? "Replace" : "Upload"}<input type="file" accept="image/*,.pdf" className="sr-only" disabled={Boolean(uploading)} onChange={(event) => uploadRenewal(type, event.target.files?.[0])} /></label></div></div>; })}</div></SectionCard>
    <SectionCard padded title="Can I go online?" description="These are the same authoritative checks used for Driver operations."><div className="divide-y">{(data.eligibility?.checks || []).map((check) => <div key={check.id} className="flex items-center gap-3 py-3"><span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", check.ok ? "bg-[var(--success-soft)] text-success" : "bg-[var(--danger-soft)] text-danger")}>{check.ok ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}</span><span className="flex-1 text-sm font-medium">{check.label}</span>{!check.ok ? <Badge tone="danger">Fix required</Badge> : null}</div>)}</div></SectionCard>
  </div>;
}

function DriverLifecycleState({ data }) {
  const status = data?.driver?.status || data?.application?.status || "application";
  const suspended = status === "suspended";
  const former = ["offboarded", "former"].includes(status);
  const unavailable = ["temporarily_unavailable", "offboarding"].includes(status);
  const reason = data?.driver?.statusReason || data?.driver?.suspensionReason || data?.driver?.offboardingReason || data?.application?.reviewReason || "Spotly Driver Operations will show the next available action here.";
  return <div className="space-y-6"><PageHeader eyebrow="Driver account" title={suspended ? "Your Driver account is suspended" : former ? "Your Driver account is no longer active" : unavailable ? "Your Driver account is temporarily unavailable" : "Your Driver account needs attention"} description="This is an account lifecycle state, not a new Driver application."/><Card className="p-6"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-warning"><AlertTriangle className="h-6 w-6"/></span><div><Badge tone={suspended || former ? "danger" : "warning"}>{labelStatus(status)}</Badge><h2 className="mt-3 text-xl font-semibold">Live work is unavailable</h2><p className="mt-2 text-sm leading-6 text-secondary">{reason}</p><div className="mt-5 flex flex-wrap gap-2"><Button asChild><Link href="/support?topic=driver-account">Contact Driver support</Link></Button><Button asChild variant="outline"><Link href="/earnings">View Driver Money</Link></Button></div></div></div></Card></div>;
}

function DriverMobileNav({ safe, hasActive }) {
  const items = [["home","/","Home"],["jobs","/jobs","Work"],["active","/active",hasActive ? "Resume" : "Active"],["earnings","/earnings","Money"],["profile","/profile","Account"]];
  return <nav aria-label="Driver mobile navigation" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] p-1.5 shadow-xl backdrop-blur md:hidden">{items.map(([id,href,labelText]) => <Link key={id} href={href} className={cn("rounded-xl px-1 py-2 text-center text-[11px] font-semibold", safe === id || (id === "active" && hasActive) ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-secondary")}>{labelText}</Link>)}</nav>;
}

export function DriverApp({ section = "home" }) {
  const safe = sectionMeta[section] ? section : "home";
  const { data, loading, error, load } = useDriverData();
  const { toast } = useToast();
  const router = useRouter();
  const [offerBusy, setOfferBusy] = useState(false);
  const [rideOfferBusy, setRideOfferBusy] = useState(false);
  const [parcelOfferBusy, setParcelOfferBusy] = useState(false);
  async function offerAction(offer, action) { setOfferBusy(true); try { await authenticatedFetch("/api/driver/offers", { method: "POST", body: JSON.stringify({ offerId: offer.id, action }) }); await load(); if (action === "accept") { toast(offer.fulfilmentMode === "driver_shops" ? "Shop & Deliver accepted." : "Delivery accepted.", { type: "success" }); router.push("/active"); } } catch (err) { toast(err.message, { type: "error" }); await load({ quiet: true }); } finally { setOfferBusy(false); } }
  async function rideOfferAction(offer, action) { setRideOfferBusy(true); try { await authenticatedFetch("/api/driver/ride-offers", { method: "POST", body: JSON.stringify({ offerId: offer.id, action }) }); await load(); if (action === "accept") { toast("Ride accepted.", { type: "success" }); router.push("/active"); } } catch (err) { toast(err.message, { type: "error" }); await load({ quiet: true }); } finally { setRideOfferBusy(false); } }
  async function parcelOfferAction(offer, action) { setParcelOfferBusy(true); try { await authenticatedFetch("/api/driver/parcel-offers", { method: "POST", body: JSON.stringify({ offerId: offer.id, action }) }); await load(); if (action === "accept") { toast("Send job accepted.", { type: "success" }); router.push("/active"); } } catch (err) { toast(err.message, { type: "error" }); await load({ quiet: true }); } finally { setParcelOfferBusy(false); } }
  const offer = { accept: (item) => offerAction(item, "accept"), decline: (item) => offerAction(item, "decline"), busy: offerBusy };
  const rideOffer = { accept: (item) => rideOfferAction(item, "accept"), decline: (item) => rideOfferAction(item, "decline"), busy: rideOfferBusy };
  const parcelOffer = { accept: (item) => parcelOfferAction(item, "accept"), decline: (item) => parcelOfferAction(item, "decline"), busy: parcelOfferBusy };
  const approvedWorkspace = Boolean(data?.driver && ["approved", "ready", "active"].includes(data.driver.status));
  const lifecycleState = Boolean(data?.driver && !approvedWorkspace && ["suspended", "offboarded", "former", "temporarily_unavailable", "offboarding"].includes(data.driver.status));
  const hasActive = Boolean(data?.activeRide || data?.activeParcel || data?.activeJob);
  return <AuthGate portal="driver" title="Spotly Driver"><PortalShell portalId="driver" activeSection={safe}><div className="mx-auto max-w-[1280px] px-4 py-7 pb-24 sm:px-6 lg:px-8 lg:py-9">{loading ? <PageSkeleton /> : error ? <EmptyState icon={AlertTriangle} title="Driver could not be loaded" description={error} action={<Button onClick={() => load()}><RefreshCw className="h-4 w-4" />Try again</Button>} /> : lifecycleState ? <DriverLifecycleState data={data || {}} /> : !approvedWorkspace ? <DriverApplication data={data || {}} reload={load} /> : <><LiveLocation data={data} />{hasActive && safe !== "active" ? <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">You have active work</p><p className="mt-1 text-sm">{data.activeRide ? "Ride" : data.activeParcel ? "Send" : data.activeJob?.fulfilmentMode === "driver_shops" ? "Shop & Deliver" : "Delivery"} · {labelStatus((data.activeRide || data.activeParcel || data.activeJob)?.state)}</p></div><Button asChild><Link href="/active">Resume job</Link></Button></div> : null}{safe === "home" && <DriverHome data={data} reload={load} onOffer={offer} onRideOffer={rideOffer} onParcelOffer={parcelOffer} />}{safe === "jobs" && <Jobs data={data} offer={offer} rideOffer={rideOffer} parcelOffer={parcelOffer} />}{safe === "jobs" && <DriverAssistShopping mode="jobs" />}{safe === "active" && (data.activeRide ? <ActiveRide data={data} reload={load} /> : data.activeParcel ? <ActiveParcel data={data} reload={load} /> : <ActiveJob data={data} reload={load} />)}{safe === "active" && <DriverAssistShopping mode="active" />}{safe === "earnings" && <Earnings data={data} reload={load} />}{safe === "history" && <HistoryView data={data} />}{safe === "notifications" && <NotificationCenter workspace="driver" title="Driver notifications" description="Offers, application actions, safety, payouts and work updates." />}{safe === "support" && <Support data={data} />}{safe === "profile" && <Profile data={data} reload={load} />}<DriverMobileNav safe={safe} hasActive={hasActive}/></>}</div></PortalShell></AuthGate>;
}
