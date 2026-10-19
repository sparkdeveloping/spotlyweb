"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Globe2, MapPin, PhoneCall, RefreshCw, ShieldAlert, ShoppingBasket, SlidersHorizontal, Store, UserRoundCheck } from "lucide-react";
import { useAuth } from "@/components/firebase-provider";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { AdminAccess } from "@/components/admin-legacy-sections";
import { canAccessAdminSection } from "@/lib/admin-access";
import { authenticatedFetch } from "@/lib/api-client";

const inputStyle = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-offset-2 focus:outline-[var(--accent)]";
const states = ["pending_review","pending_manual_quote","contacting_business","awaiting_customer","awaiting_confirmation","confirmed","in_progress","completed","declined","cancelled","expired"];
function formatStatus(status) { return String(status || "pending_review").replaceAll("_", " "); }
const ended = new Set(["completed","declined","cancelled","expired"]);

function Queue() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("open");
  const [kind, setKind] = useState("all");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState({ proposedDate: "", proposedTime: "14:00", confirmationReference: "", assigneeId: "" });
  async function refresh() {
    setError("");
    try { const result = await authenticatedFetch("/api/admin/assist"); setRequests(result.requests || []); }
    catch (err) { setError(err.message || "Unable to load requests."); }
  }
  useEffect(() => { refresh(); }, []);
  const visible = requests.filter((r) => (filter === "all" || (filter === "open" ? !ended.has(r.state) : ended.has(r.state))) && (kind === "all" || r.kind === kind));
  const item = requests.find((r) => r.id === selected) || visible[0] || null;
  async function action(name) {
    if (!item) return;
    if (["decline","cancel"].includes(name) && !message.trim() && !window.confirm("Close this request without an explanatory message?")) return;
    setBusy(true);setError("");
    try {
      await authenticatedFetch("/api/admin/assist", { method: "PATCH", body: JSON.stringify({
        kind: item.kind, id: item.id, action: name,
        message, ...Object.fromEntries(Object.entries(proposal).filter(([,v]) => Boolean(v)))
      }) });
      setMessage(""); await refresh();
    } catch (err) { setError(err.message || "Could not update this request."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["Open cases",requests.filter((r)=>!ended.has(r.state)).length,ClipboardList],["Appointments",requests.filter((r)=>r.kind==="booking").length,CalendarDays],["Shopping checks",requests.filter((r)=>r.kind==="shopping").length,ShoppingBasket],["Needs customer",requests.filter((r)=>r.state==="awaiting_customer").length,PhoneCall]].map(([label,value,Icon])=><div key={label} className="rounded-xl border bg-[var(--surface)] p-4"><Icon className="h-5 w-5 text-[var(--accent)]"/><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-[var(--text-2)]">{label}</p></div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><select aria-label="Request status" className={inputStyle} value={filter} onChange={(e)=>setFilter(e.target.value)}><option value="open">Open</option><option value="closed">Completed/closed</option><option value="all">All</option></select><select aria-label="Request type" className={inputStyle} value={kind} onChange={(e)=>setKind(e.target.value)}><option value="all">All types</option><option value="booking">Bookings</option><option value="shopping">Shopping</option></select></div><button type="button" className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold" onClick={refresh}><RefreshCw className="h-4 w-4"/>Refresh</button></div>
    {error && <p role="alert" className="rounded-xl border p-4 text-sm text-[var(--danger)]">{error}</p>}
    <div className="grid gap-4 lg:grid-cols-[.88fr_1.12fr]">
      <div className="max-h-[690px] space-y-2 overflow-y-auto pr-1">{visible.map((entry)=><button type="button" key={entry.id} onClick={()=>{setSelected(entry.id);setMessage("");setProposal({proposedDate:"",proposedTime:"14:00",confirmationReference:"",assigneeId:""});}} className={`w-full rounded-xl border p-4 text-left transition hover:border-[var(--accent)] ${item?.id===entry.id?"border-[var(--accent)] bg-[var(--accent-soft)]":"bg-[var(--surface)]"}`}><div className="flex justify-between gap-2"><span className="font-semibold">{entry.businessName}</span><span className="text-xs text-[var(--text-2)]">{entry.kind}</span></div><p className="mt-1 text-xs text-[var(--text-2)]">{entry.city || "Location pending"} · {formatStatus(entry.state)}</p><p className="mt-2 text-sm text-[var(--text-2)]">{entry.serviceName || entry.contactName || "Request"}</p></button>)}
        {!visible.length && <p className="rounded-xl border bg-[var(--surface)] p-6 text-sm text-[var(--text-2)]">No cases match these filters.</p>}
      </div>
      <div className="rounded-2xl border bg-[var(--surface)] p-5 sm:p-6">
        {!item ? <p className="py-12 text-center text-sm text-[var(--text-2)]">Select a case to review.</p>:<>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]">{item.kind} · {formatStatus(item.state)}</p><h3 className="mt-2 text-xl font-semibold">{item.businessName}</h3><p className="mt-1 text-sm text-[var(--text-2)]">{item.city}, {item.country || "ZW"}</p></div><span className="rounded-xl bg-[var(--surface-2)] p-2"><Store className="h-5 w-5"/></span></div>
          <dl className="mt-5 grid gap-x-4 gap-y-3 border-y py-5 text-sm sm:grid-cols-2">{[
            ["Customer",item.contactName],["Phone",item.contactPhone],
            ["Requested",item.kind==="booking"?`${item.preferredDate||""} ${item.preferredTime||""}`:item.deliveryAddress],
            ["Service",item.serviceName || "Independent shopping"],
            ["Preferred alternatives",item.flexibility || "—"],["Assigned to",item.assignedTo || "Unassigned"]
          ].map(([label,value])=><div key={label}><dt className="text-xs text-[var(--text-3)]">{label}</dt><dd className="mt-1 break-words font-medium">{value || "—"}</dd></div>)}</dl>
          {item.estimate && <div className="mt-4 rounded-xl bg-[var(--surface-2)] p-3 text-sm">Estimated total: <strong>{new Intl.NumberFormat("en", { style: "currency", currency: item.estimate?.currency || "USD" }).format(item.estimate?.totalEstimate || 0)}</strong><p className="mt-1 text-xs text-[var(--text-2)]">Not paid. No Driver dispatched. Requires a separate funded purchase flow.</p></div>}
          {item.proposedDate && <p className="mt-4 text-sm font-semibold">Proposed: {item.proposedDate} at {item.proposedTime}</p>}
          {item.customerMessage && <p className="mt-4 rounded-xl bg-[var(--surface-2)] p-4 text-sm text-[var(--text-2)]">{item.customerMessage}</p>}
          {!ended.has(item.state) ? <>
            <h4 className="mt-6 font-semibold">Next step</h4>
            <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">Contact this business on the customer's behalf. Only confirm a booking after the business accepts a specific date and time. Shopping requests must remain unfunded until payments, receipts and dispatch are verified.</p>
            {item.kind==="booking" && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Alternative date<input type="date" className={"mt-1 "+inputStyle} value={proposal.proposedDate} onChange={(e)=>setProposal((v)=>({...v,proposedDate:e.target.value}))}/></label><label className="text-xs font-semibold">Alternative time<input type="time" className={"mt-1 "+inputStyle} value={proposal.proposedTime} onChange={(e)=>setProposal((v)=>({...v,proposedTime:e.target.value}))}/></label>
              <label className="sm:col-span-2 text-xs font-semibold">Business confirmation reference<input className={"mt-1 "+inputStyle} value={proposal.confirmationReference} onChange={(e)=>setProposal((v)=>({...v,confirmationReference:e.target.value}))} placeholder="e.g. staff member's name + reference / booking number"/></label>
            </div>}
            <label className="mt-4 block text-xs font-semibold">Customer update / internal reason<textarea rows={3} className={"mt-1 "+inputStyle} value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Explain next steps or the alternative offered"/></label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={busy} onClick={()=>action("contact")} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Contacted business</button>
              {item.kind==="booking" && <>
                <button disabled={busy} onClick={()=>action("offer_alternative")} className="rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-40">Offer alternative</button>
                <button disabled={busy} onClick={()=>action("request_confirmation")} className="rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-40">Await confirmation</button>
                <button disabled={busy} onClick={()=>action("confirm_booking")} className="rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-40">Confirm booking</button>
                {item.state==="confirmed" && <button disabled={busy} onClick={()=>action("complete")} className="rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-40">Complete</button>}
              </>}
              <button disabled={busy} onClick={()=>action("decline")} className="rounded-xl border px-4 py-2.5 text-xs font-semibold text-[var(--danger)] disabled:opacity-40">Decline</button>
              <button disabled={busy} onClick={()=>action("cancel")} className="rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-40">Cancel</button>
            </div>
          </> : <p className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--text-2)]"><CheckCircle2 className="h-4 w-4"/>This case is closed.</p>}
        </>}
      </div>
    </div>
  </div>;
}

function Coverage() {
  const [coverage,setCoverage] = useState({});
  const [stores,setStores] = useState([]);
  const [busy,setBusy] = useState("");
  const [error,setError] = useState("");
  const [city,setCity] = useState("");
  const [country,setCountry] = useState("ZW");
  async function refresh() {
    try {
      const [res, data] = await Promise.all([
        authenticatedFetch("/api/admin/assist/coverage"),
        authenticatedFetch("/api/admin/independent-shopping")
      ]);
      setCoverage(res.coverage || {});setStores(data.stores || []);
    } catch(err){setError(err.message||"Could not load availability.");}
  }
  useEffect(()=>{refresh();},[]);
  async function toggle(scope,target,enabled) {
    setBusy(scope+target);setError("");
    try {
      await authenticatedFetch("/api/admin/assist/coverage",{method:"PATCH",body:JSON.stringify({scope,enabled,...target})});
      await refresh();
    }catch(err){setError(err.message||"Could not change availability.");}
    finally{setBusy("");}
  }
  const isCountryOn=(code)=>coverage.countries?.[code]?.enabled!==false && coverage.globalEnabled!==false;
  return <div className="space-y-5">
    <div className="rounded-2xl border bg-[var(--surface)] p-5 sm:p-6"><div className="flex items-start gap-3"><Globe2 className="h-6 w-6 text-[var(--accent)]"/><div><h3 className="text-xl font-semibold">Where Spotly Assist can help</h3><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Available by default for eligible locations. Turn off any country, city or individual listing with one action. A request is not a confirmed order; paid fulfilment has additional checks.</p></div></div>
      <div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-4"><div><p className="font-semibold">Across Africa</p><p className="text-xs text-[var(--text-2)]">Master Assist request switch</p></div><button disabled={!!busy} onClick={()=>toggle("global",{},coverage.globalEnabled===false)} className={`rounded-full px-4 py-2 text-xs font-semibold ${coverage.globalEnabled===false?"bg-[var(--text)] text-[var(--background)]":"bg-[var(--success-soft)] text-[var(--on-success-soft)]"}`}>{coverage.globalEnabled===false?"Disabled · turn on":"Available · turn off"}</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{[["ZW","Zimbabwe"],["MW","Malawi"]].map(([code,label])=><div key={code} className="flex items-center justify-between gap-2 rounded-xl border p-4"><div><p className="font-semibold">{label}</p><p className="text-xs text-[var(--text-2)]">{code} · inherited area rules</p></div><button disabled={!!busy} onClick={()=>toggle("country",{country:code},!isCountryOn(code))} className="rounded-full bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold">{isCountryOn(code)?"Available · disable":"Disabled · enable"}</button></div>)}</div>
      <div className="mt-6 grid items-end gap-3 sm:grid-cols-[110px_1fr_auto_auto]"><label className="text-xs font-semibold">Country<select className={"mt-1 "+inputStyle} value={country} onChange={(e)=>setCountry(e.target.value)}><option value="ZW">Zimbabwe</option><option value="MW">Malawi</option></select></label><label className="text-xs font-semibold">City<input className={"mt-1 "+inputStyle} value={city} onChange={(e)=>setCity(e.target.value)} placeholder="Harare, Lilongwe…"/></label><button disabled={!city.trim()||!!busy} onClick={()=>toggle("city",{country,city},true)} className="rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-40">Enable city</button><button disabled={!city.trim()||!!busy} onClick={()=>toggle("city",{country,city},false)} className="rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-40">Disable city</button></div>
      {error&&<p role="alert" className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
    </div>
    <div className="rounded-2xl border bg-[var(--surface)] p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-semibold">Individual locations</h3><p className="mt-2 text-sm text-[var(--text-2)]">Switch off a specific independently managed listing without hiding other businesses.</p></div><Link href="/independent-shopping" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">Manage menus<ArrowRight className="h-4 w-4"/></Link></div>
      <div className="mt-5 space-y-2">{stores.map((store)=><div key={store.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="font-semibold">{store.name}</p><p className="mt-1 text-xs text-[var(--text-2)]">{store.city} · {store.country||"ZW"} · {store.status}</p></div><div className="flex gap-2"><button disabled={!!busy||!store.directoryBusinessId} onClick={()=>toggle("business",{businessId:store.directoryBusinessId},false)} className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-40">Disable requests</button><button disabled={!!busy||!store.directoryBusinessId} onClick={()=>toggle("business",{businessId:store.directoryBusinessId},true)} className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent-strong)] disabled:opacity-40">Enable</button></div></div>)}
        {!stores.length&&<p className="text-sm text-[var(--text-2)]">No independent shopping locations added yet. Start by adding menus and confirming prices.</p>}</div>
    </div>
  </div>;
}

export function AdminAssistApp() {
  const {profile}=useAuth();
  const allowed=canAccessAdminSection(profile,"marketplace");
  const [tab,setTab]=useState("requests");
  return <AuthGate portal="admin" title="Sign in to Spotly Admin"><AdminAccess><PortalShell portalId="admin" activeSection="marketplace"><main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8">
    <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]"><ArrowLeft className="h-4 w-4"/>Marketplace</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Spotly V9 · Operations</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Spotly Assist</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Independent shopping requests, appointment confirmations and Africa-wide location availability in one place.</p></div><Link href="/independent-shopping" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"><Store className="h-4 w-4"/>Menu and price manager</Link></div>
    <div className="mt-6 flex items-start gap-3 rounded-xl bg-[var(--surface-2)] p-4 text-sm"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"/><p>Spotly Assist does not imply a partnership. Shopping requests are not paid orders, and may not be dispatched until the independent-purchase financial flow is approved. Existing business ordering continues separately.</p></div>
    {!allowed?<p className="mt-8 rounded-xl border p-5">Your administrator role does not include marketplace operations.</p>:<>
      <div className="mt-7 flex flex-wrap gap-2 border-b pb-4">{[["requests","Requests & follow-up",ClipboardList],["coverage","Location availability",MapPin]].map(([id,label,Icon])=><button type="button" key={id} onClick={()=>setTab(id)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${tab===id?"bg-[var(--accent)] text-white":"bg-[var(--surface-2)] text-[var(--text-2)]"}`}><Icon className="h-4 w-4"/>{label}</button>)}
        <Link href="/queues/business-claims?status=open" className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm font-semibold"><UserRoundCheck className="h-4 w-4"/>Business claims</Link></div>
      <div className="mt-6">{tab==="requests"?<Queue/>:<Coverage/>}</div>
    </>}
  </main></PortalShell></AdminAccess></AuthGate>;
}
