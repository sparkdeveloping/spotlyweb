"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Download, Headphones, Save, Store, UserCheck, WalletCards } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchField, StatusBadge, Tabs } from "@/components/ui";
import { assignSupportConversation, decideBusinessClaim, subscribeBusinesses, subscribeClaims, subscribeSupportConversations, updateSupportConversation } from "@/lib/firebase-services";
import { subscribeAdminTasks, subscribeAllPayouts, updateAdminTask, updatePayout } from "@/lib/business-services";
import { readState, writeState } from "@/lib/browser-state";

const QUEUES = {
  "business-claims": { title: "Business claims", description: "Ownership and authority reviews awaiting a clear decision.", icon: Store, slaHours: 48 },
  "publication-review": { title: "Publication review", description: "Businesses requesting customer publication.", icon: CheckCircle2, slaHours: 48 },
  support: { title: "Support conversations", description: "Open, escalated and assigned customer or business support.", icon: Headphones, slaHours: 24 },
  "payment-exceptions": { title: "Payment and payout exceptions", description: "Held, pending or failed money movement requiring review.", icon: WalletCards, slaHours: 24 },
  "staff-approvals": { title: "Staff approvals", description: "Internal People Operations decisions due for review.", icon: UserCheck, slaHours: 48 },
  incidents: { title: "Operational incidents", description: "Failed or urgent platform work requiring an owner.", icon: AlertTriangle, slaHours: 4 }
};

function dateValue(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function ageHours(record) {
  const date = dateValue(record.createdAt || record.submittedAt || record.requestedAt);
  return date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000)) : null;
}

function ageLabel(record) {
  const hours = ageHours(record);
  if (hours === null) return "Age unavailable";
  return hours < 24 ? `${hours}h old` : `${Math.floor(hours / 24)}d old`;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv(queue, records) {
  const rows = [["reference", "title", "status", "priority", "assigned_to", "age_hours"], ...records.map((record) => [record.id, record.title || record.subject || record.applicantName || "", record.status || "open", record.priority || "", record.assignedTo || "", ageHours(record) ?? ""])]
    .map((row) => row.map(escapeCsv).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([rows], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `spotly-${queue}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function QueueBody({ queue }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [records, setRecords] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(params.get("q") || "");
  const [status, setStatus] = useState(params.get("status") || "open");
  const [owner, setOwner] = useState(params.get("owner") || "all");
  const [priority, setPriority] = useState(params.get("priority") || "all");
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [busy, setBusy] = useState("");
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [savedViews, setSavedViews] = useState([]);

  const meta = QUEUES[queue] || { title: "Admin queue", description: "Operational records requiring review.", icon: ClipboardList, slaHours: 48 };
  const Icon = meta.icon;

  useEffect(() => {
    if (!user) return;
    setSavedViews(readState(`spotly-admin-queue-views:${queue}`, user, [], "local"));
  }, [queue, user?.uid]);

  useEffect(() => {
    setLoading(true);
    setError("");
    const onError = (reasonValue) => { setError(reasonValue?.message || "This queue could not be loaded."); setLoading(false); };
    const ready = (items) => { setRecords(items); setLoading(false); };
    let cleanup = () => {};
    if (queue === "business-claims") cleanup = subscribeClaims(ready, { limit: 250, onError });
    else if (queue === "support") cleanup = subscribeSupportConversations(ready, { limit: 250, onError });
    else if (queue === "payment-exceptions") cleanup = subscribeAllPayouts(ready, { limit: 250, onError });
    else cleanup = subscribeAdminTasks((items) => ready(items.filter((item) => queue === "publication-review" ? item.type === "business_publication_review" : queue === "staff-approvals" ? String(item.type || "").includes("staff") || String(item.type || "").includes("leave") : ["failed", "urgent", "escalated"].includes(item.status) || item.priority === "urgent")), { limit: 250, onError });
    return () => cleanup?.();
  }, [queue]);

  useEffect(() => {
    if (queue !== "business-claims" && queue !== "publication-review") return undefined;
    return subscribeBusinesses(setBusinesses, { limit: 300, onError: () => {} });
  }, [queue]);

  function updateUrl(next = {}) {
    const search = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([key, value]) => value && value !== "all" ? search.set(key, value) : search.delete(key));
    router.replace(`${pathname}${search.toString() ? `?${search}` : ""}`, { scroll: false });
  }

  const visible = useMemo(() => records.filter((record) => {
    const recordStatus = String(record.status || "open");
    const matchesStatus = status === "all" || (status === "open" ? !["completed", "closed", "resolved", "paid", "rejected", "approved"].includes(recordStatus) : recordStatus === status);
    const matchesOwner = owner === "all" || (owner === "mine" ? record.assignedTo === user?.uid : owner === "unassigned" ? !record.assignedTo : record.assignedTo === owner);
    const matchesPriority = priority === "all" || String(record.priority || "normal") === priority;
    const business = businesses.find((item) => item.id === (record.businessId || record.entityId));
    const text = [record.id, record.title, record.subject, record.applicantName, record.applicantEmail, record.requesterName, record.requesterEmail, record.type, record.priority, recordStatus, business?.name].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && matchesOwner && matchesPriority && text.includes(query.toLowerCase());
  }), [records, status, owner, priority, query, businesses, user?.uid]);

  async function assign(record) {
    setBusy(record.id);
    try {
      if (queue === "support") await assignSupportConversation(record.id, user.uid, user);
      else if (queue === "payment-exceptions") await updatePayout(record.id, { assignedTo: user.uid, assignedAt: new Date().toISOString() }, user);
      else await updateAdminTask(record.id, { assignedTo: user.uid, assignedAt: new Date().toISOString(), status: record.status === "open" ? "assigned" : record.status }, user);
      toast("This record is now assigned to you.", { title: "Queue updated" });
    } catch (reasonValue) { toast(reasonValue.message, { type: "error", title: "Could not assign" }); }
    finally { setBusy(""); }
  }

  async function bulkAssign() {
    const chosen = visible.filter((record) => selectedIds.has(record.id));
    if (!chosen.length) return;
    setBusy("bulk");
    try {
      for (const record of chosen) await assign(record);
      setSelectedIds(new Set());
      toast(`${chosen.length} records were assigned to you.`, { title: "Queue updated" });
    } finally { setBusy(""); }
  }

  async function applyDecision(event) {
    event.preventDefault();
    if (!selected || !decision) return;
    setBusy(selected.id);
    try {
      if (queue === "business-claims") await decideBusinessClaim(selected, decision === "request_information" ? "request" : decision, user, reason);
      else if (queue === "support") await updateSupportConversation(selected.id, { status: decision, decisionReason: reason, reviewedBy: user.uid }, user);
      else if (queue === "payment-exceptions") await updatePayout(selected.id, { status: decision, decisionReason: reason, reviewedBy: user.uid }, user);
      else await updateAdminTask(selected.id, { status: decision, decisionReason: reason, reviewedBy: user.uid, reviewedAt: new Date().toISOString() }, user);
      toast("The decision was recorded.", { title: "Queue updated" });
      setSelected(null); setDecision(""); setReason("");
    } catch (reasonValue) { toast(reasonValue.message, { type: "error", title: "Decision not saved" }); }
    finally { setBusy(""); }
  }

  function saveView() {
    const name = `${status} · ${owner} · ${priority}${query ? ` · ${query}` : ""}`;
    const next = [...savedViews.filter((view) => view.name !== name), { name, query, status, owner, priority }].slice(-8);
    setSavedViews(next);
    writeState(`spotly-admin-queue-views:${queue}`, user, next, "local");
    toast("This queue view was saved to your account on this device.", { title: "View saved" });
  }

  function applyView(view) {
    setQuery(view.query || ""); setStatus(view.status || "open"); setOwner(view.owner || "all"); setPriority(view.priority || "all");
    updateUrl({ q: view.query || "", status: view.status || "open", owner: view.owner || "all", priority: view.priority || "all" });
  }

  const decisionOptions = queue === "business-claims"
    ? [["approve", "Approve"], ["request_information", "Request information"], ["reject", "Reject"]]
    : queue === "support"
      ? [["assigned", "Keep assigned"], ["escalated", "Escalate"], ["resolved", "Resolve"]]
      : queue === "payment-exceptions"
        ? [["approved", "Approve"], ["processing", "Start processing"], ["paid", "Mark paid"], ["rejected", "Reject"]]
        : [["assigned", "Assign"], ["in_progress", "Start work"], ["completed", "Complete"], ["escalated", "Escalate"]];

  return <div className="space-y-6">
    <Button asChild variant="ghost" size="sm"><Link href="/admin"><ArrowLeft className="h-4 w-4" />Control centre</Link></Button>
    <PageHeader title={meta.title} description={meta.description} actions={<><Button variant="outline" onClick={saveView}><Save className="h-4 w-4" />Save view</Button><Button variant="outline" onClick={() => exportCsv(queue, visible)}><Download className="h-4 w-4" />Export</Button></>} />
    <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto_auto]"><SearchField label="Search queue" value={query} onChange={(value) => { setQuery(value); updateUrl({ q: value }); }} placeholder="Search this queue" /><Tabs idPrefix={`admin-queue-${queue}`} value={status} onChange={(value) => { setStatus(value); updateUrl({ status: value }); }} tabs={[{ value: "open", label: "Open" }, { value: "assigned", label: "Assigned" }, { value: "completed", label: "Completed" }, { value: "all", label: "All" }]} /><select aria-label="Owner filter" value={owner} onChange={(event) => { setOwner(event.target.value); updateUrl({ owner: event.target.value }); }} className="input h-11"><option value="all">All owners</option><option value="mine">Assigned to me</option><option value="unassigned">Unassigned</option></select><select aria-label="Priority filter" value={priority} onChange={(event) => { setPriority(event.target.value); updateUrl({ priority: event.target.value }); }} className="input h-11"><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option></select></div>
    {savedViews.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Saved queue views">{savedViews.map((view) => <Button key={view.name} size="sm" variant="ghost" onClick={() => applyView(view)}>{view.name}</Button>)}</div>}
    {selectedIds.size > 0 && <Card variant="bordered" className="flex flex-wrap items-center gap-3 p-3"><p className="flex-1 text-sm font-semibold">{selectedIds.size} selected</p><Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Clear</Button><Button size="sm" onClick={bulkAssign} loading={busy === "bulk"}>Assign selected to me</Button></Card>}
    {error && <Card variant="bordered" className="border-danger/30 bg-red-50 p-4 text-sm text-danger">{error}<Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="ml-2">Retry</Button></Card>}
    {loading ? <Card variant="bordered" className="p-8 text-center text-sm text-secondary">Loading queue…</Card> : visible.length ? <div className="space-y-3">{visible.map((record) => { const business = businesses.find((item) => item.id === (record.businessId || record.entityId)); const overdue = (ageHours(record) ?? 0) > meta.slaHours; const checked = selectedIds.has(record.id); return <Card key={record.id} variant="bordered" className="p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(record.id); else next.delete(record.id); return next; })} /><span className="sr-only">Select {record.id}</span></label><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-admin-soft text-admin"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{record.title || record.subject || business?.name || record.applicantName || record.id}</p><StatusBadge status={record.status || "open"} />{record.priority && <Badge tone={record.priority === "urgent" ? "danger" : "warning"}>{record.priority}</Badge>}{overdue && <Badge tone="danger">SLA overdue</Badge>}</div><p className="mt-1 text-sm text-secondary">{record.description || record.lastMessage || record.applicantEmail || record.type || "Review the linked record and record the next decision."}</p><p className="mt-2 text-xs text-tertiary">{ageLabel(record)} · {record.assignedTo ? "Assigned" : "Unassigned"} · SLA {meta.slaHours}h</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => assign(record)} loading={busy === record.id}>Assign to me</Button><Button size="sm" onClick={() => { setSelected({ ...record, businessName: business?.name }); setDecision(""); setReason(""); }}>Review</Button></div></div></Card>; })}</div> : <EmptyState icon={Icon} title="This queue is clear" description="No records match the current filters." />}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || selected?.subject || selected?.businessName || "Queue record"} description="Review the linked record, owner, SLA and current status before recording a decision.">{selected && <form onSubmit={applyDecision} className="space-y-5 p-5"><div className="flex flex-wrap gap-2"><StatusBadge status={selected.status || "open"} />{selected.priority && <Badge tone="warning">{selected.priority}</Badge>}<Badge tone={(ageHours(selected) ?? 0) > meta.slaHours ? "danger" : "neutral"}>{ageLabel(selected)}</Badge></div><dl className="grid gap-4 sm:grid-cols-2">{[["Reference", selected.id], ["Assigned to", selected.assignedTo || "Unassigned"], ["Business", selected.businessName || selected.businessId || "Not linked"], ["Requester", selected.requesterEmail || selected.applicantEmail || selected.requestedByEmail || "Not recorded"]].map(([label, value]) => <div key={label} className="rounded-lg bg-grouped p-4"><dt className="text-xs text-tertiary">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl><div><h3 className="font-semibold">Record context</h3><p className="mt-2 text-sm leading-7 text-secondary">{selected.description || selected.lastMessage || selected.decisionReason || "No additional plain-language context was recorded."}</p></div><label className="block"><span className="mb-2 block text-sm font-semibold">Decision</span><select required value={decision} onChange={(event) => setDecision(event.target.value)} className="input w-full"><option value="">Choose a decision</option>{decisionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-semibold">Reason or internal note</span><textarea required={decision === "reject" || decision === "request_information" || decision === "rejected" || decision === "escalated"} value={reason} onChange={(event) => setReason(event.target.value)} className="input min-h-28 w-full py-3" placeholder="Record enough context for the next reviewer." /></label><div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => assign(selected)} loading={busy === selected.id}>Assign to me</Button><Button type="button" variant="ghost" onClick={() => setSelected(null)}>Cancel</Button><Button type="submit" loading={busy === selected.id}>Record decision</Button></div></form>}</Modal>
  </div>;
}

export function AdminQueueApp({ queue }) {
  return <AuthGate portal="admin" title="Sign in to Spotly Admin"><PortalShell portalId="admin" activeSection="dashboard"><main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9"><QueueBody queue={queue} /></main></PortalShell></AuthGate>;
}
