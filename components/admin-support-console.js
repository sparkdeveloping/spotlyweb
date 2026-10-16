"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  AtSign,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  FileText,
  Headphones,
  Inbox,
  Info,
  Mail,
  MessageCircleMore,
  MoreHorizontal,
  Paperclip,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  UserRoundCheck,
  UsersRound,
  X
} from "lucide-react";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, EmptyState, NativeSelect, SearchField, StatusBadge, Textarea } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import {
  sendSupportMessage,
  subscribeSupportConversations,
  subscribeSupportMessages,
  updateSupportConversation,
  uploadSupportAttachment
} from "@/lib/firebase-services";
import { formatCurrency } from "@/lib/format";

const ACTIVE_STATUSES = new Set(["open", "assigned", "waiting_for_spotly", "waiting_for_user", "escalated"]);
const PRIORITIES = ["low", "normal", "high", "urgent"];
const STATUS_OPTIONS = ["open", "assigned", "waiting_for_spotly", "waiting_for_user", "escalated", "resolved", "closed"];
const SUPPORTED_ATTACHMENTS = new Set(["application/pdf", "image/jpeg", "image/png", "text/plain"]);
const CANNED_REPLIES = [
  { id: "acknowledge", label: "Acknowledge", text: "Thanks for contacting Spotly. I’m looking into this now and I’ll keep the conversation updated here." },
  { id: "more-detail", label: "Ask for details", text: "I can help with this. Could you confirm what you were trying to do, what you expected to happen, and what happened instead? If there is a reference number, please include it here." },
  { id: "payment-safe", label: "Payment safety", text: "I can review the payment status from Spotly’s records. Please do not send your password, one-time code, PIN, or full card/payment credentials in this conversation." },
  { id: "resolved", label: "Resolved", text: "This should now be resolved. Please try the action again and tell me here if anything still looks wrong." },
  { id: "handoff", label: "Escalation handoff", text: "I’m escalating this to the appropriate Spotly team with the context already attached. You do not need to open another support request." }
];

function asDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?._seconds) return new Date(value._seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateTime(value, fallback = "Recently") {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat("en-ZW", { dateStyle: "medium", timeStyle: "short" }).format(date) : fallback;
}

function shortTime(value) {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat("en-ZW", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date) : "";
}

function cleanLabel(value = "") {
  return String(value || "").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lastActivityMs(item) {
  return asDate(item.lastMessageAt || item.updatedAt || item.createdAt)?.getTime?.() || 0;
}

function priorityTone(priority) {
  return priority === "urgent" ? "danger" : priority === "high" ? "warning" : priority === "low" ? "neutral" : "info";
}

function ConversationRow({ item, active, onClick }) {
  const unread = Number(item.unreadForSupport || 0);
  return <button type="button" onClick={onClick} className={cn("group w-full border-b border-[var(--border-subtle)] px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]", active ? "bg-[var(--admin-soft)]" : "hover:bg-[var(--surface-hover)]")}>
    <div className="flex items-start gap-3">
      <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", unread ? "bg-[var(--admin)] text-[var(--on-admin)]" : "bg-[var(--surface-2)] text-[var(--text-2)]")}><MessageCircleMore className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className={cn("truncate text-sm", unread ? "font-bold" : "font-semibold")}>{item.subject || "Support conversation"}</span>{unread > 0 ? <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-bold text-[var(--on-danger)]">{unread > 9 ? "9+" : unread}</span> : null}</span>
        <span className="mt-1 flex items-center gap-2 text-xs text-[var(--text-3)]"><span className="truncate">{item.requesterName || item.requesterEmail || "Customer"}</span><span aria-hidden>·</span><span className="shrink-0">{shortTime(item.lastMessageAt || item.updatedAt)}</span></span>
        <span className="mt-2 block line-clamp-2 text-xs leading-5 text-[var(--text-2)]">{item.lastMessage || "No message preview"}</span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5"><StatusBadge status={item.status || "open"} />{item.priority && item.priority !== "normal" ? <Badge tone={priorityTone(item.priority)}>{cleanLabel(item.priority)}</Badge> : null}{item.assignedToName ? <span className="truncate text-[10px] font-semibold text-[var(--text-3)]">{item.assignedToName}</span> : null}</span>
      </span>
    </div>
  </button>;
}

function AttachmentLinks({ attachments = [], internal = false }) {
  if (!attachments.length) return null;
  return <div className="mt-3 grid gap-2">{attachments.map((attachment) => <a key={`${attachment.path || "file"}-${attachment.url}`} href={attachment.url} target="_blank" rel="noreferrer" className={cn("flex items-center gap-2 rounded-[10px] border px-3 py-2 text-xs font-semibold transition hover:bg-[var(--surface-hover)]", internal && "border-[color-mix(in_srgb,var(--warning)_30%,var(--border))]")}><Paperclip className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">{attachment.name || "Attachment"}</span><ArrowUpRight className="h-3.5 w-3.5" /></a>)}</div>;
}

function MessageBubble({ message, currentUserId }) {
  const support = message.senderRole === "support";
  const internal = Boolean(message.internal);
  const mine = message.senderId === currentUserId;
  if (internal) return <div className="mx-auto max-w-[760px] rounded-[14px] border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] px-4 py-3 text-[var(--on-warning-soft)]">
    <div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="h-4 w-4" /><span>Internal note · {message.senderName || "Spotly team"}</span><span className="ml-auto font-normal opacity-70">{shortTime(message.createdAt)}</span></div>
    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p><AttachmentLinks attachments={message.attachments} internal />
  </div>;
  return <div className={cn("flex", support ? "justify-end" : "justify-start")}>
    <div className={cn("max-w-[86%] rounded-[18px] px-4 py-3 sm:max-w-[75%]", support ? "bg-[var(--admin)] text-[var(--on-admin)]" : "border border-[var(--border)] bg-[var(--surface)]")}>
      <div className={cn("flex items-center gap-2 text-[11px] font-semibold", support ? "text-[color-mix(in_srgb,var(--on-admin)_75%,transparent)]" : "text-[var(--text-3)]")}><span>{message.senderName || (support ? "Spotly Support" : "Customer")}{mine && support ? " · You" : ""}</span><span className="ml-auto font-normal">{shortTime(message.createdAt)}</span></div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p><AttachmentLinks attachments={message.attachments} />
    </div>
  </div>;
}

function InfoRow({ label, value, href }) {
  if (!value) return null;
  const content = <><span className="text-xs text-[var(--text-3)]">{label}</span><span className="min-w-0 truncate text-right text-xs font-semibold">{value}</span></>;
  return href ? <a href={href} className="flex items-center justify-between gap-3 py-1.5 hover:text-[var(--admin)]">{content}</a> : <div className="flex items-center justify-between gap-3 py-1.5">{content}</div>;
}

function RelatedObject({ label, item, kind }) {
  if (!item) return null;
  const status = item.status || item.state || item.paymentStatus || "";
  const total = Number(item.total ?? item.amount);
  return <div className="rounded-[14px] border border-[var(--border-subtle)] p-3">
    <div className="flex items-start gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-2)] text-[var(--admin)]"><FileText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--text-3)]">{label}</p><p className="mt-1 truncate text-sm font-semibold">{item.number || item.reference || item.id}</p></div>{status ? <StatusBadge status={status} /> : null}</div>
    {Number.isFinite(total) && total > 0 ? <p className="mt-2 text-sm font-semibold">{formatCurrency(total, item.currency || "USD")}</p> : null}
    {kind ? <p className="mt-1 text-xs text-[var(--text-3)]">{cleanLabel(kind)}</p> : null}
  </div>;
}

function ContextPanel({ context, conversation, currentUserId, onAssign, onOpenConversation, busy }) {
  const requester = context?.requester;
  const business = context?.business;
  const related = context?.related || {};
  const agents = context?.agents || [];
  const assigned = conversation?.assignedTo || "";
  return <div className="space-y-5 p-4">
    <section>
      <div className="flex items-center gap-2"><CircleUserRound className="h-4 w-4 text-[var(--admin)]" /><h3 className="text-sm font-semibold">Requester</h3></div>
      <div className="mt-3 rounded-[14px] bg-[var(--surface-2)] p-3"><p className="font-semibold">{requester?.displayName || conversation?.requesterName || "Customer"}</p>
        <div className="mt-2"><InfoRow label="Email" value={requester?.email || conversation?.requesterEmail} href={(requester?.email || conversation?.requesterEmail) ? `mailto:${requester?.email || conversation?.requesterEmail}` : undefined} /><InfoRow label="Phone" value={requester?.phone || requester?.phoneNumber} href={(requester?.phone || requester?.phoneNumber) ? `tel:${requester?.phone || requester?.phoneNumber}` : undefined} /><InfoRow label="City" value={requester?.city} /></div>
      </div>
    </section>

    <section>
      <div className="flex items-center gap-2"><UserRoundCheck className="h-4 w-4 text-[var(--admin)]" /><h3 className="text-sm font-semibold">Assignment</h3></div>
      <NativeSelect value={assigned} onChange={(event) => onAssign(event.target.value)} disabled={busy} className="mt-3 w-full">
        <option value="">Unassigned</option>
        {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.id === currentUserId ? `${agent.displayName} · You` : agent.displayName}</option>)}
      </NativeSelect>
      {conversation?.assignedToName ? <p className="mt-2 text-xs text-[var(--text-3)]">Owned by {conversation.assignedToName}</p> : <p className="mt-2 text-xs text-[var(--text-3)]">Anyone with Support access can pick this up.</p>}
    </section>

    {business ? <section><div className="flex items-center gap-2"><Store className="h-4 w-4 text-[var(--admin)]" /><h3 className="text-sm font-semibold">Business</h3></div><div className="mt-3 rounded-[14px] border border-[var(--border-subtle)] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{business.name || business.id}</p><div className="mt-2 flex flex-wrap gap-1.5"><StatusBadge status={business.status || "unknown"} />{business.verificationStatus ? <StatusBadge status={business.verificationStatus} /> : null}</div></div><Button asChild size="sm" variant="ghost"><Link href={`/support-view/${business.id}`} aria-label="Open business support view"><ArrowUpRight className="h-4 w-4" /></Link></Button></div></div></section> : null}

    {(related.order || related.ride || related.parcel || related.delivery || related.claim || related.paymentIntent) ? <section><h3 className="text-sm font-semibold">Attached context</h3><div className="mt-3 grid gap-2"><RelatedObject label="Order / booking" item={related.order} kind={related.order?.transactionType} /><RelatedObject label="Ride" item={related.ride} kind="Ride" /><RelatedObject label="Send" item={related.parcel} kind="Send" /><RelatedObject label="Delivery" item={related.delivery} kind="Delivery" /><RelatedObject label="Business claim" item={related.claim} kind="Claim" /><RelatedObject label="Payment" item={related.paymentIntent} kind="Payment intent" /></div></section> : null}

    {context?.recentActivity?.length ? <section><h3 className="text-sm font-semibold">Recent Spotly activity</h3><div className="mt-2 divide-y divide-[var(--border-subtle)]">{context.recentActivity.slice(0, 6).map((item) => <div key={`${item.kind}-${item.id}`} className="py-2.5"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs font-semibold">{item.number || item.id}</span><StatusBadge status={item.status || item.state || item.paymentStatus || "unknown"} /></div><p className="mt-1 text-[11px] text-[var(--text-3)]">{cleanLabel(item.kind)} · {shortTime(item.updatedAt || item.createdAt)}</p></div>)}</div></section> : null}

    {context?.supportHistory?.length > 1 ? <section><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[var(--admin)]" /><h3 className="text-sm font-semibold">Previous conversations</h3></div><div className="mt-2 divide-y divide-[var(--border-subtle)]">{context.supportHistory.filter((item) => item.id !== conversation?.id).slice(0, 5).map((item) => <button type="button" key={item.id} onClick={() => onOpenConversation(item.id)} className="flex w-full items-center gap-2 py-2.5 text-left hover:text-[var(--admin)]"><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{item.subject || "Support conversation"}</span><span className="mt-0.5 block text-[11px] text-[var(--text-3)]">{shortTime(item.lastMessageAt || item.createdAt)}</span></span><ChevronRight className="h-3.5 w-3.5" /></button>)}</div></section> : null}

    {context?.rawContext && Object.values(context.rawContext).some(Boolean) ? <details className="rounded-[14px] border border-[var(--border-subtle)] p-3"><summary className="cursor-pointer text-xs font-semibold">Submitted context</summary><div className="mt-2 space-y-1">{Object.entries(context.rawContext).filter(([, value]) => value != null && value !== "").slice(0, 12).map(([key, value]) => <InfoRow key={key} label={cleanLabel(key)} value={typeof value === "object" ? JSON.stringify(value).slice(0, 120) : String(value)} />)}</div></details> : null}
  </div>;
}

export function AdminSupportConsole() {
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("conversation") || "");
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("active");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [canned, setCanned] = useState("");
  const endRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeSupportConversations((items) => { setConversations(items); setLoading(false); setError(""); }, { limit: 300, onError: (reason) => { setError(reason.message || "Support conversations could not be loaded."); setLoading(false); } });
    return unsubscribe;
  }, []);

  const selected = useMemo(() => conversations.find((item) => item.id === selectedId) || null, [conversations, selectedId]);
  const unread = Number(selected?.unreadForSupport || 0);

  useEffect(() => {
    if (!selectedId) { setMessages([]); setContext(null); return undefined; }
    const unsubscribe = subscribeSupportMessages(selectedId, setMessages, (reason) => toast(reason.message || "Messages could not be loaded.", { type: "error" }));
    return unsubscribe;
  }, [selectedId, toast]);

  const loadContext = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setContextLoading(true);
    try {
      const result = await authenticatedFetch("/api/admin/support/context", { method: "POST", body: JSON.stringify({ conversationId }) });
      setContext(result);
    } catch (reason) {
      setContext(null);
      toast(reason.message || "Conversation context could not be loaded.", { type: "error" });
    } finally { setContextLoading(false); }
  }, [toast]);

  useEffect(() => { if (selectedId) loadContext(selectedId); }, [selectedId, loadContext]);
  useEffect(() => { if (!selectedId || !user?.uid || unread < 1) return; updateSupportConversation(selectedId, { markRead: true }, user).catch(() => {}); }, [selectedId, unread, user]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);
  useEffect(() => { const linked = searchParams.get("conversation"); if (linked) setSelectedId(linked); }, [searchParams]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const currentUserId = user?.uid || "";
    return conversations.filter((item) => {
      const active = ACTIVE_STATUSES.has(item.status || "open");
      if (scope === "active" && !active) return false;
      if (scope === "mine" && item.assignedTo !== currentUserId) return false;
      if (scope === "unassigned" && item.assignedTo) return false;
      if (scope === "urgent" && !["urgent", "high"].includes(item.priority) && item.status !== "escalated") return false;
      if (scope === "resolved" && !["resolved", "closed"].includes(item.status)) return false;
      if (term && ![item.subject, item.requesterName, item.requesterEmail, item.lastMessage, item.category, item.id].filter(Boolean).join(" ").toLowerCase().includes(term)) return false;
      return true;
    }).sort((a, b) => {
      const unreadDiff = Number(b.unreadForSupport || 0) - Number(a.unreadForSupport || 0);
      if (unreadDiff) return unreadDiff;
      const urgentDiff = Number(["urgent", "high"].includes(b.priority) || b.status === "escalated") - Number(["urgent", "high"].includes(a.priority) || a.status === "escalated");
      return urgentDiff || lastActivityMs(b) - lastActivityMs(a);
    });
  }, [conversations, query, scope, user?.uid]);

  const counts = useMemo(() => ({
    active: conversations.filter((item) => ACTIVE_STATUSES.has(item.status || "open")).length,
    mine: conversations.filter((item) => item.assignedTo === user?.uid && ACTIVE_STATUSES.has(item.status || "open")).length,
    unassigned: conversations.filter((item) => !item.assignedTo && ACTIVE_STATUSES.has(item.status || "open")).length,
    urgent: conversations.filter((item) => (["urgent", "high"].includes(item.priority) || item.status === "escalated") && ACTIVE_STATUSES.has(item.status || "open")).length,
    resolved: conversations.filter((item) => ["resolved", "closed"].includes(item.status)).length
  }), [conversations, user?.uid]);

  function openConversation(id) { setSelectedId(id); setContextOpen(false); }

  async function patch(values, successMessage = "Conversation updated.") {
    if (!selectedId || busy) return;
    setBusy("update");
    try { await updateSupportConversation(selectedId, values, user); toast(successMessage, { type: "success" }); }
    catch (reason) { toast(reason.message || "Conversation could not be updated.", { type: "error" }); }
    finally { setBusy(""); }
  }

  async function assign(agentId) {
    const agent = context?.agents?.find((item) => item.id === agentId);
    await patch({ assignedTo: agentId || null, assignedToName: agent?.displayName || null }, agentId ? `Assigned to ${agent?.displayName || "agent"}.` : "Conversation unassigned.");
  }

  function chooseFiles(event) {
    const chosen = Array.from(event.target.files || []).slice(0, 6);
    const invalid = chosen.find((file) => !SUPPORTED_ATTACHMENTS.has(file.type) || file.size > 10 * 1024 * 1024);
    if (invalid) { toast("Attachments must be PDF, JPG, PNG or text files under 10 MB.", { type: "error" }); event.target.value = ""; return; }
    setFiles(chosen);
    event.target.value = "";
  }

  async function sendReply(event) {
    event?.preventDefault?.();
    if (!selectedId || busy || (!reply.trim() && !files.length)) return;
    setBusy("send"); setUploadProgress(0);
    try {
      const attachments = [];
      for (const file of files) attachments.push(await uploadSupportAttachment(selectedId, file, user?.uid, setUploadProgress));
      await sendSupportMessage(selectedId, reply.trim() || "Attachment", user, { internal, attachments, status: internal ? undefined : "waiting_for_user", senderName: profile?.displayName || user?.displayName || user?.email || "Spotly Support", senderRole: "support" });
      setReply(""); setFiles([]); setUploadProgress(0); setCanned("");
      if (!internal && !selected?.assignedTo && user?.uid) await updateSupportConversation(selectedId, { assignedTo: user.uid, assignedToName: profile?.displayName || user?.displayName || user?.email || "Spotly Support" }, user).catch(() => {});
    } catch (reason) { toast(reason.message || "Reply could not be sent.", { type: "error" }); }
    finally { setBusy(""); }
  }

  function insertCanned(value) {
    setCanned(value);
    const item = CANNED_REPLIES.find((entry) => entry.id === value);
    if (item) setReply((current) => current ? `${current}\n\n${item.text}` : item.text);
  }

  const activeCount = counts.active;
  return <div className="v7-page-enter space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold text-[var(--admin)]">Support desk</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.035em]">Talk to customers without leaving Spotly.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Live conversations, internal notes, assignment, attached Spotly context and resolution history stay together.</p></div>
      <div className="flex items-center gap-2"><Badge tone={activeCount ? "warning" : "success"}>{activeCount} active</Badge><Badge tone={conversations.some((item) => Number(item.unreadForSupport || 0) > 0) ? "admin" : "neutral"}>{conversations.reduce((sum, item) => sum + Number(item.unreadForSupport || 0), 0)} unread</Badge></div>
    </div>

    <div className="min-h-[720px] overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)] xl:grid xl:grid-cols-[330px_minmax(0,1fr)_320px]">
      <section className={cn("min-h-[720px] flex-col border-r border-[var(--border-subtle)] xl:flex", selectedId ? "hidden" : "flex")}>
        <div className="border-b border-[var(--border-subtle)] p-4"><SearchField value={query} onChange={setQuery} placeholder="Search conversations" label="Search support conversations" /><div className="mt-3 flex flex-wrap gap-1.5">{[
          ["active", "Active"], ["mine", "Mine"], ["unassigned", "Unassigned"], ["urgent", "Urgent"], ["resolved", "Resolved"]
        ].map(([value, label]) => <button type="button" key={value} onClick={() => setScope(value)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", scope === value ? "bg-[var(--admin)] text-[var(--on-admin)]" : "bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>{label} <span className="ml-1 opacity-70">{counts[value]}</span></button>)}</div></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{loading ? <div className="space-y-0">{[0,1,2,3,4].map((item) => <div key={item} className="flex gap-3 border-b p-4"><span className="v7-skeleton h-10 w-10 rounded-[12px]"/><span className="flex-1"><span className="v7-skeleton block h-3 w-2/3 rounded"/><span className="v7-skeleton mt-2 block h-3 w-full rounded"/><span className="v7-skeleton mt-2 block h-3 w-1/2 rounded"/></span></div>)}</div> : error ? <EmptyState icon={AlertTriangle} title="Support desk unavailable" description={error} /> : filtered.length ? filtered.map((item) => <ConversationRow key={item.id} item={item} active={item.id === selectedId} onClick={() => openConversation(item.id)} />) : <EmptyState icon={Inbox} title="Nothing in this view" description="Change the filter or search another name, subject or reference." />}</div>
      </section>

      <section className={cn("min-h-[720px] min-w-0 flex-col xl:flex", selectedId ? "flex" : "hidden")}>
        {selected ? <>
          <header className="border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5"><div className="flex items-start gap-3"><Button variant="ghost" size="sm" className="xl:hidden" onClick={() => setSelectedId("")} aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></Button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-semibold">{selected.subject || "Support conversation"}</h3>{unread ? <Badge tone="danger">{unread} new</Badge> : null}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-3)]"><span>{selected.requesterName || selected.requesterEmail || "Customer"}</span><span>·</span><span>#{selected.id.slice(0, 8).toUpperCase()}</span><span>·</span><span>{cleanLabel(selected.category || "general")}</span></div></div><Button variant="outline" size="sm" className="xl:hidden" onClick={() => setContextOpen(true)}><Info className="h-4 w-4" />Context</Button><div className="hidden items-center gap-2 sm:flex"><StatusBadge status={selected.status || "open"} />{selected.priority && selected.priority !== "normal" ? <Badge tone={priorityTone(selected.priority)}>{cleanLabel(selected.priority)}</Badge> : null}</div></div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!selected.assignedTo ? <Button size="sm" variant="outline" onClick={() => assign(user?.uid)} loading={busy === "update"}><UserRoundCheck className="h-4 w-4" />Assign to me</Button> : selected.assignedTo === user?.uid ? <Badge tone="admin">Assigned to you</Badge> : <Badge>{selected.assignedToName || "Assigned"}</Badge>}
              <NativeSelect aria-label="Priority" value={selected.priority || "normal"} onChange={(event) => patch({ priority: event.target.value }, "Priority updated.")} className="h-9 w-auto min-w-[110px] text-xs">{PRIORITIES.map((item) => <option key={item} value={item}>{cleanLabel(item)}</option>)}</NativeSelect>
              <NativeSelect aria-label="Conversation status" value={selected.status || "open"} onChange={(event) => patch({ status: event.target.value }, "Status updated.")} className="h-9 w-auto min-w-[150px] text-xs">{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{cleanLabel(item)}</option>)}</NativeSelect>
              {selected.status !== "escalated" && !["resolved", "closed"].includes(selected.status) ? <Button size="sm" variant="ghost" onClick={() => patch({ status: "escalated", priority: "urgent" }, "Conversation escalated.")}><AlertTriangle className="h-4 w-4" />Escalate</Button> : null}
              {["resolved", "closed"].includes(selected.status) ? <Button size="sm" onClick={() => patch({ status: "open" }, "Conversation reopened.")}><RefreshCw className="h-4 w-4" />Reopen</Button> : <Button size="sm" onClick={() => patch({ status: "resolved" }, "Conversation resolved.")}><CheckCircle2 className="h-4 w-4" />Resolve</Button>}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-2)]/40 px-4 py-5 sm:px-6"><div className="mx-auto max-w-4xl space-y-3"><div className="mb-5 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--text-2)]"><span className="font-semibold">Support safety:</span> Spotly staff should never ask for passwords, OTPs, PINs or full payment credentials. Internal notes are invisible to the requester.</div>{messages.length ? messages.map((message) => <MessageBubble key={message.id} message={message} currentUserId={user?.uid} />) : <div className="py-16 text-center text-sm text-[var(--text-3)]">Loading conversation history…</div>}<div ref={endRef} /></div></div>

          <form onSubmit={sendReply} className="border-t border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="mx-auto max-w-4xl">
              <div className="mb-3 flex flex-wrap items-center gap-2"><div className="inline-flex rounded-[10px] bg-[var(--surface-2)] p-1"><button type="button" onClick={() => setInternal(false)} className={cn("rounded-[8px] px-3 py-1.5 text-xs font-semibold", !internal ? "bg-[var(--surface)] shadow-sm" : "text-[var(--text-3)]")}>Reply</button><button type="button" onClick={() => setInternal(true)} className={cn("rounded-[8px] px-3 py-1.5 text-xs font-semibold", internal ? "bg-[var(--warning-soft)] text-[var(--on-warning-soft)] shadow-sm" : "text-[var(--text-3)]")}>Internal note</button></div><NativeSelect aria-label="Insert canned reply" value={canned} onChange={(event) => insertCanned(event.target.value)} className="h-9 max-w-[210px] text-xs"><option value="">Canned reply…</option>{CANNED_REPLIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</NativeSelect>{internal ? <Badge tone="warning"><ShieldCheck className="h-3 w-3" />Staff only</Badge> : null}</div>
              <Textarea value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") sendReply(event); }} placeholder={internal ? "Add context for the next Spotly teammate…" : "Reply to the requester…"} className={cn("min-h-[96px] w-full resize-y", internal && "border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)]/40")} />
              {files.length ? <div className="mt-2 flex flex-wrap gap-2">{files.map((file) => <span key={`${file.name}-${file.size}`} className="inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs"><Paperclip className="h-3.5 w-3.5" /><span className="max-w-[190px] truncate">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))} aria-label={`Remove ${file.name}`}><X className="h-3.5 w-3.5" /></button></span>)}</div> : null}
              {busy === "send" && uploadProgress > 0 ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full bg-[var(--admin)] transition-[width]" style={{ width: `${uploadProgress}%` }} /></div> : null}
              <div className="mt-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt,application/pdf,image/jpeg,image/png,text/plain" className="hidden" onChange={chooseFiles} /><Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" />Attach</Button><span className="hidden text-[11px] text-[var(--text-3)] sm:inline">Ctrl/⌘ + Enter to send</span></div><Button type="submit" loading={busy === "send"} disabled={!reply.trim() && !files.length}>{internal ? <ShieldCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />}{internal ? "Add note" : "Send reply"}</Button></div>
            </div>
          </form>
        </> : <EmptyState icon={Headphones} title="Choose a conversation" description="Select a support conversation to read the full history, reply, add an internal note or inspect attached Spotly context." />}
      </section>

      <aside className="hidden min-h-[720px] overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--surface)] xl:block"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3"><div><p className="text-sm font-semibold">Context</p><p className="text-[11px] text-[var(--text-3)]">What the agent needs to know</p></div>{contextLoading ? <RefreshCw className="h-4 w-4 animate-spin text-[var(--text-3)]" /> : null}</div>{selected ? <ContextPanel context={context} conversation={selected} currentUserId={user?.uid} onAssign={assign} onOpenConversation={openConversation} busy={busy === "update"} /> : <div className="p-5 text-sm text-[var(--text-3)]">Select a conversation.</div>}</aside>
    </div>

    {contextOpen && selected ? <div className="fixed inset-0 z-[90] xl:hidden"><button type="button" className="absolute inset-0 bg-black/40" onClick={() => setContextOpen(false)} aria-label="Close context"/><aside className="absolute inset-y-0 right-0 w-[min(92vw,380px)] overflow-y-auto bg-[var(--surface)] shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-[var(--surface)] px-4 py-3"><div><p className="font-semibold">Conversation context</p><p className="text-xs text-[var(--text-3)]">Customer, assignment and Spotly activity</p></div><Button variant="ghost" size="sm" onClick={() => setContextOpen(false)} aria-label="Close context"><X className="h-4 w-4" /></Button></div><ContextPanel context={context} conversation={selected} currentUserId={user?.uid} onAssign={assign} onOpenConversation={(id) => { openConversation(id); setContextOpen(false); }} busy={busy === "update"} /></aside></div> : null}
  </div>;
}
