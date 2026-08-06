"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Keyboard,
  LockKeyhole,
  MonitorSmartphone,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Store,
  XCircle
} from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace, BusinessDataProvider } from "@/components/business/business-context";
import { AuthGate } from "@/components/auth-gate";
import { WorkspaceContextSwitcher } from "@/components/business/shared";
import { saveBusinessProfile } from "@/lib/firebase-services";
import { updateBusinessOrder } from "@/lib/business-services";
import { KIOSK_MODES } from "@/data/business-archetypes";

function availableModes(capabilities = []) {
  const set = new Set(capabilities);
  return KIOSK_MODES.filter((mode) => {
    if (mode.id === "pickup_checkin") return set.has("kiosk_pickup") || set.has("pickup_orders");
    if (mode.id === "self_order") return false; // Reserved until the unattended checkout flow is enabled.
    if (mode.id === "ticket_checkin") return set.has("tickets") || set.has("kiosk_checkin");
    if (mode.id === "appointment_checkin") return set.has("appointments") || set.has("bookings") || set.has("kiosk_checkin");
    return false;
  });
}

export function KioskView() {
  const { business, user, archetype, selectedBranch, branches } = useBusinessWorkspace();
  const modes = availableModes(business?.capabilities || archetype.capabilities);
  const [mode, setMode] = useState(business?.kiosk?.defaultMode || modes[0]?.id || "pickup_checkin");
  const [requirePin, setRequirePin] = useState(business?.kiosk?.requireExitPin !== false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function save() {
    setSaving(true);
    try {
      await saveBusinessProfile(business.id, {
        kiosk: {
          ...(business.kiosk || {}),
          enabled: true,
          defaultMode: mode,
          requireExitPin: requirePin,
          branchId: selectedBranch?.id || "",
          updatedAt: new Date().toISOString()
        }
      }, user);
      toast("Kiosk settings are ready for this business.", { title: "Kiosk configured" });
    } catch (error) {
      toast(error.message || "The kiosk settings could not be saved.", { type: "error", title: "Could not save kiosk" });
    } finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader eyebrow="Optional device mode" title="Kiosk" description="Turn a tablet or computer into a focused customer check-in or ordering screen without exposing the business workspace." /><WorkspaceContextSwitcher /></div>
    {!modes.length ? <Card><EmptyState icon={MonitorSmartphone} title="Kiosk mode is not needed yet" description="Enable pickup, ticketing, appointments, or bookings from the guided setup centre. Spotly will then offer the matching kiosk mode." action={<Button asChild><Link href="/business/setup">Review business setup</Link></Button>} /></Card> : <div className="grid gap-5 xl:grid-cols-[1fr_370px]">
      <Card className="overflow-hidden"><div className="border-b p-6"><h2 className="text-xl font-black">Choose what this device does</h2><p className="mt-2 text-sm leading-6 text-secondary">Keep each kiosk focused on one customer task. Staff can still manage the full workflow from Spotly Business.</p></div><div className="grid gap-3 p-5 md:grid-cols-2">{modes.map((item) => { const Icon = item.icon; const selected = mode === item.id; return <button type="button" onClick={() => setMode(item.id)} key={item.id} className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${selected ? "border-business bg-business-soft ring-2 ring-business/10" : "hover:border-business/30"}`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-business text-white" : "bg-grouped text-secondary"}`}><Icon className="h-5 w-5" /></span><span><span className="font-bold">{item.label}</span><span className="mt-1.5 block text-sm leading-6 text-secondary">{item.description}</span></span></button>; })}</div><div className="border-t p-5"><label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input className="mt-1" type="checkbox" checked={requirePin} onChange={(event) => setRequirePin(event.target.checked)} /><span><span className="block text-sm font-bold">Require a staff PIN to leave kiosk mode</span><span className="mt-1 block text-xs leading-5 text-secondary">Prevents customers from opening the wider business portal on an unattended device.</span></span></label><div className="mt-5 flex flex-col gap-3 sm:flex-row"><Button onClick={save} loading={saving}>Save kiosk settings</Button><Button asChild variant="outline"><Link href={`/business/kiosk/live?mode=${mode}&branch=${selectedBranch?.id || ""}`} target="_blank">Launch full-screen kiosk<ExternalLink className="h-4 w-4" /></Link></Button></div></div></Card>
      <div className="space-y-5"><Card className="p-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-business-soft text-business"><ShieldCheck className="h-6 w-6" /></span><h3 className="mt-5 font-bold">Safe for shared devices</h3><p className="mt-2 text-sm leading-6 text-secondary">The full-screen view hides menus, finance, staff, and settings. All updates still use the signed-in user and are recorded in activity history.</p></Card><Card className="p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-tertiary">Current location</p><h3 className="mt-3 font-bold">{selectedBranch?.branchName || selectedBranch?.name || selectedBranch?.displayName || "Choose a location"}</h3><p className="mt-1 text-sm text-secondary">{selectedBranch?.city || "Zimbabwe"} · {branches.length} accessible location{branches.length === 1 ? "" : "s"}</p></Card></div>
    </div>}
  </div>;
}

function codeFor(order) {
  return String(order.pickupCode || order.ticketCode || order.orderNumber || order.number || order.id?.slice(0, 8) || "").replace(/\s/g, "").toUpperCase();
}

function KioskLiveContent() {
  const { business, orders, user, selectedBranch, selectedBranchId, branches, setSelectedBranchId, archetype } = useBusinessWorkspace();
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const mode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mode") || business?.kiosk?.defaultMode || "pickup_checkin" : "pickup_checkin";
  const modeInfo = KIOSK_MODES.find((item) => item.id === mode) || KIOSK_MODES[0];
  const visibleOrders = useMemo(() => orders.filter((order) => !selectedBranchId || !order.branchId || order.branchId === selectedBranchId), [orders, selectedBranchId]);

  function find() {
    const normalized = code.replace(/\s/g, "").toUpperCase();
    const match = visibleOrders.find((order) => codeFor(order) === normalized);
    if (!match) {
      setResult(null);
      setState("error");
      setMessage("We could not find that reference at this location. Check the code or ask a team member.");
      return;
    }
    setResult(match);
    setState("found");
    setMessage("");
  }

  async function confirmArrival() {
    if (!result) return;
    setState("processing");
    try {
      const nextStatus = mode === "ticket_checkin" ? "checked_in" : mode === "appointment_checkin" ? "arrived" : "customer_arrived";
      await updateBusinessOrder(result, { status: nextStatus, checkedInAt: new Date().toISOString(), kioskMode: mode }, user, mode === "ticket_checkin" ? "Ticket checked in at kiosk." : "Customer checked in at kiosk.");
      setState("success");
      setMessage(mode === "ticket_checkin" ? "Ticket accepted. Welcome." : "You are checked in. The team has been notified.");
    } catch (error) {
      setState("error");
      setMessage(error.message || "This check-in could not be completed. Ask a team member for help.");
    }
  }

  function reset() { setCode(""); setResult(null); setState("idle"); setMessage(""); }

  return <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-[#0d6a42] to-emerald-500 p-4 text-white sm:p-8">
    <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col rounded-[32px] bg-white/10 p-5 shadow-2xl backdrop-blur-xl sm:min-h-[calc(100vh-4rem)] sm:p-8">
      <header className="flex flex-col gap-4 border-b border-white/15 pb-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-business"><Store className="h-7 w-7" /></span><div><p className="text-xl font-black">{business?.brandName || business?.name || "Spotly Business"}</p><p className="mt-1 text-sm text-white/65">{modeInfo.label} · {selectedBranch?.displayName || selectedBranch?.name || "Main location"}</p></div></div>{branches.length > 1 && <select value={selectedBranch?.id || ""} onChange={(event) => setSelectedBranchId(event.target.value)} className="h-12 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white outline-none">{branches.map((branch) => <option className="text-black" key={branch.id} value={branch.id}>{branch.branchName || branch.name || branch.displayName}</option>)}</select>}</header>
      <div className="flex flex-1 items-center justify-center py-10"><AnimatePresence mode="wait">
        {state === "success" ? <motion.section key="success" initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl text-center"><motion.span initial={{ scale: .5 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: .45 }} className="mx-auto flex h-28 w-28 items-center justify-center rounded-[36px] bg-emerald-300 text-emerald-950"><CheckCircle2 className="h-14 w-14" /></motion.span><h1 className="mt-8 text-4xl font-black tracking-tight">All set</h1><p className="mx-auto mt-4 max-w-lg text-lg leading-8 text-white/75">{message}</p><Button onClick={reset} className="mt-8 bg-white text-emerald-950 hover:bg-white/90">Done</Button></motion.section>
          : <motion.section key="entry" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl text-center"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/12"><ScanLine className="h-10 w-10" /></span><h1 className="mt-7 text-4xl font-black tracking-tight sm:text-5xl">{mode === "ticket_checkin" ? "Enter your ticket code" : mode === "appointment_checkin" ? "Check in for your booking" : "Tell us you have arrived"}</h1><p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/70">Enter the reference from your confirmation. No account details or business controls are shown on this device.</p><div className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"><label className="flex h-16 flex-1 items-center gap-3 rounded-2xl bg-white px-5 text-emerald-950 shadow-xl"><Keyboard className="h-5 w-5 text-emerald-700" /><input autoFocus value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); if (state === "error") setState("idle"); }} onKeyDown={(event) => { if (event.key === "Enter") find(); }} placeholder="Example: SPOT-4821" className="min-w-0 flex-1 bg-transparent text-lg font-black uppercase tracking-[.12em] outline-none placeholder:text-emerald-900/30" /></label><Button onClick={find} disabled={!code.trim()} className="h-16 bg-emerald-300 px-7 text-emerald-950 hover:bg-emerald-200">Find</Button></div>{state === "error" && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-5 flex max-w-xl items-start gap-3 rounded-2xl bg-red-400/20 p-4 text-left"><XCircle className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm leading-6">{message}</p></motion.div>}{state === "found" && result && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-6 max-w-xl rounded-3xl bg-white p-6 text-left text-ink shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.14em] text-tertiary">Reference</p><h2 className="mt-2 text-2xl font-black">{result.orderNumber || result.number || codeFor(result)}</h2><p className="mt-1 text-sm text-secondary">{result.customerName || result.customer?.name || "Customer"}</p></div><Badge tone="success">Found</Badge></div><div className="mt-5 rounded-2xl bg-grouped p-4"><p className="text-sm font-bold">{modeInfo.label}</p><p className="mt-1 text-sm leading-6 text-secondary">{mode === "ticket_checkin" ? `${result.quantity || result.items?.length || 1} ticket${(result.quantity || result.items?.length || 1) === 1 ? "" : "s"}` : `${result.items?.length || 0} item${result.items?.length === 1 ? "" : "s"} · ${String(result.status || "confirmed").replaceAll("_", " ")}`}</p></div><Button onClick={confirmArrival} loading={state === "processing"} className="mt-5 w-full">Confirm check-in<ArrowRight className="h-4 w-4" /></Button></motion.div>}</motion.section>}
      </AnimatePresence></div>
      <footer className="flex items-center justify-between border-t border-white/15 pt-5 text-xs text-white/55"><span>Powered by Spotly</span><span className="flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" />Shared-device mode</span></footer>
    </div>
  </main>;
}

export function KioskLiveApp() {
  return <AuthGate portal="business" title="Sign in to use this kiosk"><BusinessDataProvider><KioskLiveContent /></BusinessDataProvider></AuthGate>;
}
