"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bike, CarFront, CheckCircle2, Mail, MapPin, MessageCircle, PackageCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { publicApiFetch } from "@/lib/api-client";
import { DRIVER_CAPABILITIES, capabilitySupportsVehicle } from "@/lib/driver-capabilities";
import { SPOTLY_COUNTRIES, countryDefinition } from "@/lib/country-engine";
import { driverAcquisitionAttribution, driverAcquisitionSlug } from "@/lib/driver-acquisition";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

const EMPTY = { legalName: "", phone: "", email: "", country: "", city: "", vehicleType: "", requestedCapabilities: [], licenceStatus: "", contactPreference: "whatsapp", consent: false };
const VEHICLES = [
  { id: "bicycle", label: "Bicycle", icon: Bike },
  { id: "motorcycle", label: "Motorcycle", icon: Bike },
  { id: "car", label: "Car", icon: CarFront },
  { id: "van", label: "Van", icon: Truck },
];
const LICENCE = [
  ["yes", "Yes, I have a valid licence"],
  ["learning", "I am currently learning / licensing"],
  ["no", "No"],
  ["not_sure", "Not sure what Spotly needs"],
];

function attribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return driverAcquisitionAttribution({
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "",
    via: params.get("via") || params.get("ref") || "",
    referrer: document.referrer || "",
  });
}
function sessionId() {
  const key = "spotly-driver-acquisition-session-v1";
  try {
    let value = sessionStorage.getItem(key);
    if (!value) { value = crypto.randomUUID(); sessionStorage.setItem(key, value); }
    return value;
  } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

export function DriverAcquisitionLanding({ campaignSlug = "" }) {
  const slug = useMemo(() => driverAcquisitionSlug(campaignSlug), [campaignSlug]);
  const [campaign, setCampaign] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const session = useRef("");
  const source = useRef({});
  const started = useRef(false);
  const contactCompleted = useRef(false);
  const country = countryDefinition(form.country);

  useEffect(() => {
    session.current = sessionId();
    source.current = attribution();
    let cancelled = false;
    async function boot() {
      let loaded = null;
      if (slug) {
        try { loaded = (await publicApiFetch(`/api/public/driver-acquisition?campaign=${encodeURIComponent(slug)}`)).campaign || null; }
        catch { loaded = null; }
      }
      if (cancelled) return;
      setCampaign(loaded);
      if (loaded?.country) setForm((current) => ({ ...current, country: loaded.country, city: loaded.city || "" }));
      if (navigator.doNotTrack !== "1") publicApiFetch("/api/public/driver-acquisition", { method: "POST", body: JSON.stringify({ event: "view", campaign: slug, sessionId: session.current, attribution: source.current, country: loaded?.country || "", city: loaded?.city || "" }) }).catch(() => null);
    }
    boot();
    return () => { cancelled = true; };
  }, [slug]);

  function trackStart() {
    if (started.current) return;
    started.current = true;
    if (navigator.doNotTrack !== "1") publicApiFetch("/api/public/driver-acquisition", { method: "POST", body: JSON.stringify({ event: "start", campaign: slug, sessionId: session.current, attribution: source.current, country: form.country, city: form.city }) }).catch(() => null);
  }
  function update(name, value) { trackStart(); setForm((current) => ({ ...current, [name]: value })); }
  function continueForm() {
    setError("");
    if (form.legalName.trim().length < 2) return setError("Add your full name so our Driver team knows who to contact.");
    if (!form.country || !form.city) return setError("Choose your country and city.");
    if (!form.phone.trim() && !form.email.trim()) return setError("Add a phone number or email address so we can contact you.");
    if (!contactCompleted.current) {
      contactCompleted.current = true;
      if (navigator.doNotTrack !== "1") publicApiFetch("/api/public/driver-acquisition", { method: "POST", body: JSON.stringify({ event: "contact_complete", campaign: slug, sessionId: session.current, attribution: source.current, country: form.country, city: form.city }) }).catch(() => null);
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function vehicle(value) {
    trackStart();
    setForm((current) => ({ ...current, vehicleType: value, requestedCapabilities: (current.requestedCapabilities || []).filter((id) => capabilitySupportsVehicle(id, value)) }));
  }
  function toggleCapability(id) {
    trackStart();
    setForm((current) => ({ ...current, requestedCapabilities: current.requestedCapabilities.includes(id) ? current.requestedCapabilities.filter((value) => value !== id) : [...current.requestedCapabilities, id] }));
  }
  async function submit(event) {
    event.preventDefault(); setError("");
    if (!form.consent) return setError("Confirm that Spotly may contact you about Driver onboarding and that you accept the Privacy Policy.");
    setBusy(true);
    try {
      await publicApiFetch("/api/public/driver-leads", { method: "POST", body: JSON.stringify({
        lead: { legalName: form.legalName, phone: form.phone, email: form.email, country: form.country, city: form.city, vehicleType: form.vehicleType, requestedCapabilities: form.requestedCapabilities },
        campaign: slug,
        sessionId: session.current,
        attribution: source.current,
        licenceStatus: form.licenceStatus,
        contactPreference: form.contactPreference,
        contactConsent: true,
      }) });
      setComplete(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError(err.message || "We could not save your details. Try again."); }
    finally { setBusy(false); }
  }

  if (complete) return <main data-workspace="driver" className="min-h-screen bg-[var(--background)] px-4 py-12 text-[var(--text)] sm:px-6">
    <div className="mx-auto max-w-xl pt-[8vh]"><Card elevated className="overflow-hidden p-0"><div className="bg-driver-soft p-7 text-center sm:p-9"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-driver text-[var(--on-accent)]"><CheckCircle2 className="h-8 w-8" /></span><h1 className="mt-5 text-3xl font-bold tracking-tight">Your details are with Spotly.</h1><p className="mx-auto mt-3 max-w-md leading-7 text-secondary">Our Driver team can now follow up using the contact details you gave us. You do not need to create an account yet.</p></div><div className="space-y-3 p-6 sm:p-8"><div className="rounded-2xl bg-[var(--surface-2)] p-4 text-sm leading-6"><strong>What happens next?</strong><br />Spotly can contact you, complete any missing onboarding details with you, and send a secure link when it is time for you to continue the Driver application yourself.</div><Button asChild className="w-full"><Link href={spotlyPortalUrl("driver")}>Learn more about Spotly Driver<ArrowRight className="h-4 w-4" /></Link></Button></div></Card></div>
  </main>;

  return <main data-workspace="driver" className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <header className="border-b bg-[color-mix(in_srgb,var(--background)_94%,transparent)] backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-[1180px] items-center px-4 sm:px-6"><Link href={spotlyPortalUrl("driver")} className="flex items-center gap-3"><Image src="/api/branding/assets/driver_symbol_color.svg" alt="" width={40} height={40} /><span className="font-bold">Spotly Driver</span></Link><Link href={spotlyPortalUrl("driver")} className="ml-auto text-sm font-semibold text-secondary">About Driver</Link></div></header>
    <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-9 sm:px-6 lg:grid-cols-[1fr_520px] lg:items-start lg:py-14">
      <section className="pt-2 lg:sticky lg:top-24">
        <div className="inline-flex items-center gap-2 rounded-full bg-driver-soft px-3 py-1.5 text-xs font-bold text-driver"><Sparkles className="h-3.5 w-3.5" />DRIVE · DELIVER · EARN</div>
        <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-[-.045em] sm:text-5xl lg:text-6xl">Interested in driving with Spotly?</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-secondary">Leave a few details. Our Driver team can help you understand what fits your vehicle, what documents you may need and how to continue when onboarding is ready for you.</p>
        {campaign?.city ? <div className="mt-6 inline-flex items-center gap-2 rounded-xl border bg-[var(--surface)] px-4 py-3 text-sm font-semibold"><MapPin className="h-4 w-4 text-driver" />Driver interest in {campaign.city}</div> : null}
        <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
          {[[MessageCircle,"Leave your contact","Phone, WhatsApp or email"],[PackageCheck,"Tell us what you drive","Vehicle details can be completed later"],[ShieldCheck,"Continue securely later","A private link can reopen the same profile"]].map(([Icon,title,text])=><div key={title} className="rounded-2xl border bg-[var(--surface)] p-4"><Icon className="h-5 w-5 text-driver"/><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-secondary">{text}</p></div>)}
        </div>
        <p className="mt-6 max-w-xl text-xs leading-5 text-tertiary">Submitting this form does not approve you as a Driver or guarantee work. Spotly reviews eligibility and service availability separately.</p>
      </section>

      <Card elevated className="overflow-hidden p-0">
        <div className="border-b p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-driver">Driver interest</p><h2 className="mt-1 text-2xl font-bold">{step === 1 ? "Tell us where to reach you" : "A little about how you would work"}</h2></div><span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold">{step} of 2</span></div><div className="mt-4 grid grid-cols-2 gap-2"><span className="h-1.5 rounded-full bg-driver"/><span className={`h-1.5 rounded-full ${step === 2 ? "bg-driver" : "bg-[var(--border)]"}`}/></div></div>
        {step === 1 ? <div className="space-y-4 p-5 sm:p-6">
          <label className="block text-sm font-semibold">Full name *<input className="field-control mt-2 w-full" autoComplete="name" value={form.legalName} onChange={(e)=>update("legalName",e.target.value)} placeholder="Your full name"/></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Country *<select className="field-control mt-2 w-full" value={form.country} onChange={(e)=>setForm((current)=>({...current,country:e.target.value,city:""}))}><option value="">Choose country</option>{SPOTLY_COUNTRIES.map((item)=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="block text-sm font-semibold">City *<select className="field-control mt-2 w-full" value={form.city} disabled={!form.country} onChange={(e)=>update("city",e.target.value)}><option value="">Choose city</option>{(country?.cities||[]).map((item)=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label></div>
          <label className="block text-sm font-semibold">Phone / WhatsApp<input className="field-control mt-2 w-full" type="tel" autoComplete="tel" value={form.phone} onChange={(e)=>update("phone",e.target.value)} placeholder={country?.dialCode ? `${country.dialCode} …` : "+…"}/></label>
          <label className="block text-sm font-semibold">Email <span className="font-normal text-tertiary">Optional if you added a phone</span><input className="field-control mt-2 w-full" type="email" autoComplete="email" value={form.email} onChange={(e)=>update("email",e.target.value)} placeholder="you@example.com"/></label>
          <label className="block text-sm font-semibold">Best way to contact you<select className="field-control mt-2 w-full" value={form.contactPreference} onChange={(e)=>update("contactPreference",e.target.value)}><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="email">Email</option><option value="either">Any of these</option></select></label>
          {error ? <p className="rounded-xl bg-[var(--danger-soft)] p-3 text-sm text-danger" role="alert">{error}</p> : null}
          <Button className="w-full" size="lg" onClick={continueForm}>Continue<ArrowRight className="h-4 w-4"/></Button>
          <p className="text-center text-xs text-tertiary">No account or document upload required at this stage.</p>
        </div> : <form className="space-y-5 p-5 sm:p-6" onSubmit={submit}>
          <div><p className="text-sm font-semibold">What would you use for work?</p><p className="mt-1 text-xs text-secondary">Optional. You can confirm or change this with Spotly later.</p><div className="mt-3 grid grid-cols-2 gap-2">{VEHICLES.map(({id,label,icon:Icon})=><button type="button" key={id} onClick={()=>vehicle(form.vehicleType===id?"":id)} className={`rounded-xl border p-3 text-left ${form.vehicleType===id?"border-driver bg-driver-soft":"bg-[var(--surface)]"}`}><Icon className="h-5 w-5 text-driver"/><span className="mt-2 block text-sm font-semibold">{label}</span></button>)}</div></div>
          <label className="block text-sm font-semibold">Driver licence status <span className="font-normal text-tertiary">Optional</span><select className="field-control mt-2 w-full" value={form.licenceStatus} onChange={(e)=>update("licenceStatus",e.target.value)}><option value="">Prefer not to say</option>{LICENCE.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
          {form.vehicleType ? <div><p className="text-sm font-semibold">What work interests you?</p><div className="mt-2 space-y-2">{Object.values(DRIVER_CAPABILITIES).filter((cap)=>capabilitySupportsVehicle(cap.id,form.vehicleType)).map((cap)=><label key={cap.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--surface-2)] p-3"><input type="checkbox" className="mt-1" checked={form.requestedCapabilities.includes(cap.id)} onChange={()=>toggleCapability(cap.id)}/><span><span className="block text-sm font-semibold">{cap.label}</span><span className="mt-0.5 block text-xs leading-5 text-secondary">{cap.description}</span></span></label>)}</div></div> : null}
          <label className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-6"><input type="checkbox" className="mt-1" checked={form.consent} onChange={(e)=>update("consent",e.target.checked)}/><span>Spotly may contact me about Driver onboarding. I have read the <Link className="font-semibold underline" href={spotlyPortalUrl("customer","/privacy")} target="_blank">Privacy Policy</Link>.</span></label>
          {error ? <p className="rounded-xl bg-[var(--danger-soft)] p-3 text-sm text-danger" role="alert">{error}</p> : null}
          <div className="grid grid-cols-[auto_1fr] gap-2"><Button type="button" variant="outline" onClick={()=>{setError("");setStep(1);}}>Back</Button><Button type="submit" size="lg" loading={busy}>Send my details<ArrowRight className="h-4 w-4"/></Button></div>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-tertiary"><ShieldCheck className="h-3.5 w-3.5"/>Your details enter Spotly’s private Driver recruitment pipeline.</p>
        </form>}
      </Card>
    </div>
  </main>;
}
