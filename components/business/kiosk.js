"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink, Keyboard, LockKeyhole, MonitorSmartphone, RefreshCw, ScanLine, ShieldCheck, Store, Truck, XCircle } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { Badge, Button, Card, EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { WorkspaceContextSwitcher } from "@/components/business/shared";

const STORAGE_KEY = "spotly-kiosk-device-v1";
const modes = [
  { id: "pickup_checkin", label: "Customer pickup check-in", description: "Customers enter an order code when they arrive.", icon: Store },
  { id: "driver_pickup", label: "Driver pickup", description: "Drivers enter a delivery or pickup code when they reach this location.", icon: Truck }
];
const time = (value) => value ? new Date(value).toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" }) : "Never";

export function KioskView() {
  const { selectedBusinessId, selectedBranchId, selectedBranch, branches, branchesLoading, branchesError, refreshBranches } = useBusinessWorkspace();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [enrollment, setEnrollment] = useState(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "Front desk tablet", mode: "pickup_checkin", requireExitPin: true, exitPin: "" });

  const load = useCallback(async () => {
    if (!selectedBusinessId) return;
    setLoading(true);
    try {
      const result = await authenticatedFetch(`/api/kiosk/enroll?businessId=${encodeURIComponent(selectedBusinessId)}`, { cache: "no-store" });
      setDevices(result.devices || []);
      setError("");
    } catch (reason) {
      setError(reason.message || "Kiosk devices could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [selectedBusinessId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setEnrollment(null); setCopied(false); }, [selectedBranchId]);

  const pinValid = !form.requireExitPin || /^\d{4,8}$/.test(form.exitPin);
  const nameValid = form.name.trim().length >= 2;

  async function create() {
    if (!selectedBranchId) return setError("Choose a location first.");
    if (!nameValid) return setError("Give this tablet a short staff-facing name, such as Front desk tablet.");
    if (!pinValid) return setError("Create a 4–8 digit staff exit PIN before activating kiosk mode.");
    setCreating(true);
    setError("");
    try {
      const result = await authenticatedFetch("/api/kiosk/enroll", { method: "POST", body: JSON.stringify({ action: "create", businessId: selectedBusinessId, branchId: selectedBranchId, ...form, name: form.name.trim() }) });
      setEnrollment(result);
      await load();
    } catch (reason) {
      setError(reason.message || "Kiosk setup could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function copyCode() {
    if (!enrollment?.enrollmentCode) return;
    try {
      await navigator.clipboard.writeText(enrollment.enrollmentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function revoke(device) {
    if (!confirm(`Revoke ${device.name}? The tablet will stop working as soon as it next connects.`)) return;
    try {
      await authenticatedFetch("/api/kiosk/enroll", { method: "POST", body: JSON.stringify({ action: "revoke", deviceId: device.id, businessId: selectedBusinessId }) });
      await load();
    } catch (reason) {
      setError(reason.message || "This kiosk could not be revoked.");
    }
  }

  if (branchesError) return <div className="space-y-6"><div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader eyebrow="Shared devices" title="Check-in kiosk" description="Turn a tablet into a simple check-in screen for one real business location."/><WorkspaceContextSwitcher/></div><Card variant="bordered" className="p-8 text-center"><XCircle className="mx-auto h-9 w-9 text-danger"/><h2 className="mt-4 text-xl font-semibold">Locations could not be loaded</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-secondary">{branchesError}</p><Button className="mt-5" variant="outline" loading={branchesLoading} onClick={() => refreshBranches(selectedBusinessId).catch(() => {})}>Try again</Button></Card></div>;
  if (branchesLoading && !branches.length) return <div className="space-y-6"><div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader eyebrow="Shared devices" title="Check-in kiosk" description="Turn a tablet into a simple check-in screen for one real business location."/><WorkspaceContextSwitcher/></div><Card variant="bordered" className="p-8 text-center"><p className="font-semibold">Loading locations…</p></Card></div>;
  if (!branches.length) return <div className="space-y-6"><div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader eyebrow="Shared devices" title="Check-in kiosk" description="Turn a tablet into a simple check-in screen for one real business location."/><WorkspaceContextSwitcher/></div><Card variant="bordered" className="p-8 text-center"><Store className="mx-auto h-9 w-9 text-[var(--accent)]"/><h2 className="mt-4 text-xl font-semibold">Add a location before setting up a kiosk</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-secondary">A kiosk belongs to an exact pickup or Driver handoff location. Add the real location first, then return here.</p><Button asChild className="mt-5"><Link href={`/business/branches?business=${encodeURIComponent(selectedBusinessId)}`}>Add location</Link></Button></Card></div>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader eyebrow="Shared tablet" title="Check-in kiosk" description="Set up a tablet customers or Drivers can use without giving it access to your Business account."/><WorkspaceContextSwitcher/></div>
    {error && <div role="alert" className="rounded-xl border border-danger/20 bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{error}</div>}

    <Card variant="bordered" className="p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-3">
        {[{ n: "1", title: "Choose the job", text: "Customer pickup check-in or Driver pickup." }, { n: "2", title: "Protect staff controls", text: "Use a staff-only PIN so customers cannot leave kiosk mode." }, { n: "3", title: "Activate the tablet", text: "Open the kiosk screen on the tablet and enter the one-time setup code." }].map((step) => <div key={step.n} className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-business-soft text-sm font-bold text-business">{step.n}</span><div><h2 className="font-semibold">{step.title}</h2><p className="mt-1 text-sm leading-6 text-secondary">{step.text}</p></div></div>)}
      </div>
    </Card>

    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <SectionCard title="Set up a shared tablet" description={`This tablet will be locked to ${selectedBranch?.branchName || selectedBranch?.name || selectedBranch?.displayName || "the selected location"}.`}>
        <div className="space-y-5">
          <div><p className="text-sm font-semibold">What should people do on this tablet?</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{modes.map((item) => { const Icon = item.icon; const on = form.mode === item.id; return <button key={item.id} type="button" onClick={() => setForm({ ...form, mode: item.id })} className={`rounded-xl border p-4 text-left transition ${on ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : "bg-[var(--surface)] hover:bg-[var(--surface-2)]"}`}><Icon className="h-5 w-5"/><p className="mt-3 font-semibold">{item.label}</p><p className="mt-1 text-xs leading-5 text-secondary">{item.description}</p></button>; })}</div></div>
          <label className="block text-sm font-semibold">Tablet name <span className="font-normal text-secondary">(staff only)</span><input className="field-control mt-2 w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Front desk tablet"/><span className="mt-2 block text-xs font-normal leading-5 text-secondary">Use a name your team will recognize if you add more tablets later.</span></label>
          <div className="rounded-xl border bg-[var(--surface-2)] p-4">
            <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" checked={form.requireExitPin} onChange={(e) => setForm({ ...form, requireExitPin: e.target.checked, exitPin: e.target.checked ? form.exitPin : "" })}/><span><span className="block text-sm font-semibold">Protect kiosk mode with a staff PIN</span><span className="mt-1 block text-xs leading-5 text-secondary">Recommended. Customers and Drivers can use the kiosk but cannot return to the normal tablet screen.</span></span></label>
            {form.requireExitPin && <label className="mt-4 block text-sm font-semibold">Staff exit PIN<input className={`field-control mt-2 w-full ${form.exitPin && !pinValid ? "border-danger" : ""}`} inputMode="numeric" type="password" minLength="4" maxLength="8" value={form.exitPin} onChange={(e) => setForm({ ...form, exitPin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="4–8 digits"/><span className={`mt-2 block text-xs font-normal ${form.exitPin && !pinValid ? "text-danger" : "text-secondary"}`}>{form.exitPin && !pinValid ? "Use at least 4 digits." : "Only staff should know this PIN."}</span></label>}
          </div>
          <Button loading={creating} disabled={!selectedBranchId || !nameValid || !pinValid} onClick={create}><MonitorSmartphone className="h-4 w-4"/>Create kiosk setup</Button>
        </div>
      </SectionCard>

      <div className="space-y-5">
        <Card className="p-5"><ShieldCheck className="h-6 w-6 text-[var(--accent)]"/><h3 className="mt-4 font-semibold">Safe for a shared device</h3><p className="mt-2 text-sm leading-6 text-secondary">The tablet can only perform its kiosk job for this location. It cannot open your Business workspace, products, Money, team, or owner account.</p></Card>
        <Card className="p-5"><LockKeyhole className="h-6 w-6 text-[var(--accent)]"/><h3 className="mt-4 font-semibold">You stay in control</h3><p className="mt-2 text-sm leading-6 text-secondary">You can revoke a kiosk from this page at any time. A revoked tablet stops working when it reconnects.</p></Card>
      </div>
    </div>

    {enrollment && <Card variant="bordered" className="border-business/30 bg-business-soft p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-business"><CheckCircle2 className="h-6 w-6"/></span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[.14em] text-business">Kiosk setup ready</p><h2 className="mt-1 text-xl font-semibold">Enter this code on the shared tablet</h2><p className="mt-3 font-mono text-3xl font-semibold tracking-[.12em]">{enrollment.enrollmentCode}</p><p className="mt-2 text-sm leading-6 text-secondary">The code expires in {enrollment.expiresInMinutes} minutes. It can activate one tablet only.</p></div><div className="flex flex-col gap-2 sm:flex-row lg:flex-col"><Button variant="outline" onClick={copyCode}><Copy className="h-4 w-4"/>{copied ? "Copied" : "Copy code"}</Button><Button asChild><a href={`/business/kiosk/live?code=${encodeURIComponent(enrollment.enrollmentCode)}`} target="_blank" rel="noreferrer">Open kiosk screen<ExternalLink className="h-4 w-4"/></a></Button></div></div></Card>}

    <SectionCard title="Shared tablets" description="See which kiosks are active, waiting for setup, or revoked." action={<Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4"/>Refresh</Button>}>
      {loading ? <div className="py-12 text-center text-sm text-secondary">Loading kiosks…</div> : devices.length ? <div className="divide-y">{devices.map((device) => { const branch = branches.find((item) => item.id === device.branchId); return <div key={device.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"><MonitorSmartphone className="h-5 w-5 text-[var(--accent)]"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{device.name}</p><StatusBadge status={device.status}/></div><p className="mt-1 text-xs leading-5 text-secondary">{modes.find((m) => m.id === device.mode)?.label || device.mode} · {branch?.branchName || branch?.name || branch?.displayName || "Location"} · Last seen {time(device.lastSeenAt)}</p></div>{device.status !== "revoked" && <Button size="sm" variant="outline" onClick={() => revoke(device)}>Revoke</Button>}</div>; })}</div> : <EmptyState icon={MonitorSmartphone} title="No shared tablets yet" description="Create a kiosk setup above when you are ready to turn a tablet into a check-in screen."/>}
    </SectionCard>
  </div>;
}

function readDevice(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");}catch{return null;}}
function headers(device){return {"content-type":"application/json","x-spotly-kiosk-device":device.deviceId,"x-spotly-kiosk-credential":device.credential};}
async function kioskRequest(device,path,body={}){const response=await fetch(path,{method:"POST",headers:headers(device),body:JSON.stringify(body),cache:"no-store"});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||"The kiosk request failed.");return payload;}

export function KioskLiveApp(){
  const [device,setDevice]=useState(null); const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{setDevice(readDevice());setHydrated(true);},[]);
  if(!hydrated)return <KioskShell><p className="text-center text-white/70">Starting kiosk…</p></KioskShell>;
  return device?<LiveDevice device={device} onInvalidDevice={()=>{localStorage.removeItem(STORAGE_KEY);setDevice(null);}}/>:<EnrollDevice onEnrolled={(value)=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));setDevice(value);}}/>;
}
function KioskShell({children}){return <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-[#0d6a42] to-emerald-500 p-4 text-white sm:p-8"><div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl flex-col rounded-[32px] bg-[var(--surface)]/10 p-5 shadow-2xl backdrop-blur-xl sm:min-h-[calc(100vh-4rem)] sm:p-8">{children}</div></main>}
function EnrollDevice({onEnrolled}){const [code,setCode]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");useEffect(()=>{try{const initial=new URLSearchParams(window.location.search).get("code")||"";if(initial)setCode(initial.toUpperCase());}catch{}},[]);async function enroll(){setBusy(true);setError("");try{const response=await fetch("/api/kiosk/enroll",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"activate",enrollmentCode:code.trim().toUpperCase()})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Kiosk setup failed.");onEnrolled(payload);}catch(reason){setError(reason.message);}finally{setBusy(false);}}return <KioskShell><header className="flex items-center gap-4 border-b border-white/15 pb-6"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--accent)]"><MonitorSmartphone className="h-7 w-7"/></span><div><h1 className="text-xl font-semibold">Set up this Spotly kiosk</h1><p className="mt-1 text-sm text-white/65">Use the one-time code created in Spotly Business.</p></div></header><div className="flex flex-1 items-center justify-center"><section className="w-full max-w-xl text-center"><LockKeyhole className="mx-auto h-12 w-12"/><h2 className="mt-6 text-3xl font-semibold">Enter the kiosk setup code</h2><input autoFocus value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} onKeyDown={(e)=>e.key==="Enter"&&enroll()} className="mt-7 h-16 w-full rounded-2xl bg-[var(--surface)] px-5 text-center font-mono text-xl font-semibold tracking-[.16em] text-[var(--text)] outline-none" placeholder="ENROLLMENT CODE"/>{error&&<p className="mt-4 rounded-xl bg-red-400/20 p-3 text-sm">{error}</p>}<Button className="mt-5 h-14 bg-emerald-300 text-emerald-950 hover:bg-emerald-200" loading={busy} disabled={!code.trim()} onClick={enroll}>Activate kiosk</Button></section></div></KioskShell>}
function LiveDevice({device,onInvalidDevice}){const [code,setCode]=useState("");const [state,setState]=useState("idle");const [result,setResult]=useState(null);const [message,setMessage]=useState("");const [exitOpen,setExitOpen]=useState(false);const [pin,setPin]=useState("");
  const mode=useMemo(()=>modes.find((item)=>item.id===device.mode)||modes[0],[device.mode]); const ModeIcon=mode.icon;
  useEffect(()=>{const beat=()=>kioskRequest(device,"/api/kiosk/heartbeat").catch(()=>{});beat();const timer=setInterval(beat,60000);return()=>clearInterval(timer);},[device]);
  useEffect(()=>{if(!["success","found"].includes(state))return;const timer=setTimeout(()=>{setCode("");setState("idle");setResult(null);setMessage("");},12000);return()=>clearTimeout(timer);},[state]);
  async function find(){setState("processing");setMessage("");try{const payload=device.mode==="driver_pickup"?await kioskRequest(device,"/api/kiosk/driver-pickup",{code}):await kioskRequest(device,"/api/kiosk/lookup",{code});setResult(payload);setState(device.mode==="driver_pickup"?"success":"found");setMessage(device.mode==="driver_pickup"?"Driver arrival recorded. The team can prepare the handoff.":"");}catch(reason){setState("error");setMessage(reason.message);}}
  async function checkIn(){setState("processing");try{await kioskRequest(device,"/api/kiosk/check-in",{orderId:result.order.id});setState("success");setMessage("You're checked in. The team has been notified.");}catch(reason){setState("error");setMessage(reason.message);}}
  async function exit(){try{await kioskRequest(device,"/api/kiosk/exit",{pin});window.location.assign("/");}catch(reason){if(/revoked|device|credential/i.test(reason.message||""))onInvalidDevice?.();else setMessage(reason.message);}}
  return <KioskShell><header className="flex items-center gap-4 border-b border-white/15 pb-6"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--accent)]"><ModeIcon className="h-7 w-7"/></span><div className="flex-1"><h1 className="text-xl font-semibold">Spotly kiosk</h1><p className="mt-1 text-sm text-white/65">{mode.label}</p></div><button className="rounded-lg px-3 py-2 text-xs text-white/60 hover:bg-[var(--surface)]/10" onClick={()=>setExitOpen(true)}>Staff exit</button></header><div className="flex flex-1 items-center justify-center py-10"><section className="w-full max-w-2xl text-center">{state==="success"?<><span className="mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] bg-emerald-300 text-emerald-950"><CheckCircle2 className="h-12 w-12"/></span><h2 className="mt-7 text-4xl font-semibold">All set</h2><p className="mx-auto mt-3 max-w-lg text-white/75">{message}</p></>:<><ScanLine className="mx-auto h-12 w-12"/><h2 className="mt-6 text-4xl font-semibold">{device.mode==="driver_pickup"?"Driver pickup":"Tell us you have arrived"}</h2><p className="mx-auto mt-3 max-w-lg text-white/70">Enter the reference shown in Spotly. This shared device only receives the information needed for this check-in.</p><div className="mx-auto mt-7 flex max-w-xl gap-3"><label className="flex h-16 flex-1 items-center gap-3 rounded-2xl bg-[var(--surface)] px-5 text-[var(--text)]"><Keyboard className="h-5 w-5"/><input autoFocus value={code} onChange={(e)=>{setCode(e.target.value.toUpperCase());if(state==="error")setState("idle");}} onKeyDown={(e)=>e.key==="Enter"&&find()} className="min-w-0 flex-1 bg-transparent font-semibold uppercase tracking-[.1em] outline-none" placeholder="SP-..."/></label><Button className="h-16 bg-emerald-300 text-emerald-950 hover:bg-emerald-200" disabled={!code.trim()||state==="processing"} loading={state==="processing"} onClick={find}>{device.mode === "driver_pickup" ? "Check in Driver" : "Find order"}</Button></div>{state==="error"&&<div className="mx-auto mt-4 flex max-w-xl items-center gap-3 rounded-xl bg-red-400/20 p-4 text-left"><XCircle className="h-5 w-5"/><p className="text-sm">{message}</p></div>}{state==="found"&&result?.order&&<div className="mx-auto mt-5 max-w-xl rounded-2xl bg-[var(--surface)] p-5 text-left text-[var(--text)]"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-tertiary">ORDER</p><h3 className="mt-1 text-xl font-semibold">{result.order.number}</h3><p className="mt-1 text-sm text-secondary">{result.order.contactName} · {result.order.itemCount} item{result.order.itemCount===1?"":"s"}</p></div><Badge tone="success">Found</Badge></div><Button className="mt-5 w-full" onClick={checkIn}>I'm here — notify the team</Button></div>}</>}</section></div>{exitOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><Card className="w-full max-w-sm p-5 text-[var(--text)]"><h3 className="text-lg font-semibold">Staff exit</h3><p className="mt-2 text-sm text-secondary">Enter the staff PIN to leave kiosk mode. This device stays enrolled until it is revoked in Spotly Business.</p>{device.requireExitPin&&<input autoFocus className="field-control mt-4 w-full" type="password" inputMode="numeric" value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,"").slice(0,8))} placeholder="Staff PIN"/>}{message&&<p className="mt-3 text-sm text-danger">{message}</p>}<div className="mt-4 flex gap-2"><Button onClick={exit}>Exit kiosk</Button><Button variant="outline" onClick={()=>{setExitOpen(false);setMessage("");}}>Cancel</Button></div></Card></div>}</KioskShell>}
