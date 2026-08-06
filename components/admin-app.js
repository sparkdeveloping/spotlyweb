"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BellRing,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Database,
  Edit3,
  ExternalLink,
  FileCheck2,
  Flag,
  Handshake,
  Headphones,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  Plus,
  Save,
  ShieldCheck,
  Store,
  UserCog,
  UsersRound,
  WalletCards,
  XCircle
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import {
  DEFAULT_PLATFORM_SETTINGS,
  adminUpdateBusiness,
  assignSupportConversation,
  decideBusinessClaim,
  getBranchesForBusiness,
  deleteHelpResource,
  saveAnnouncement,
  saveHelpResource,
  savePlatformSettings,
  saveRoleTemplate,
  saveUserAccess,
  sendSupportMessage,
  subscribeAnnouncements,
  subscribeAuditLogs,
  subscribeBusinesses,
  subscribeClaims,
  subscribeHelpResources,
  subscribePartnershipLeads,
  subscribeRoleTemplates,
  subscribeSupportConversations,
  subscribeSupportMessages,
  subscribeUsers,
  subscribeWaitlist,
  updatePartnershipLead,
  updateSupportConversation
} from "@/lib/firebase-services";
import { seedSummary } from "@/data/zimbabwe-businesses";
import { BUSINESS_ARCHETYPES, capabilitiesFor, inferBusinessType } from "@/data/business-archetypes";
import { businessCategories, zimbabweCities } from "@/data/business-config";
import { defaultRoleTemplates } from "@/data/production-seed";
import { authenticatedFetch } from "@/lib/api-client";
import { canAccessAdminSection, hasAdminAccess } from "@/lib/admin-access";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { AdminDirectoryManager } from "@/components/admin-directory-manager";
import { AdminPeopleOperations } from "@/components/admin-people-operations";
import { AdminOrganizationGovernance } from "@/components/admin-organization-governance";
import { PlatformMap } from "@/components/platform-map";
import {
  subscribeAdminTasks,
  subscribeAllPayouts,
  updateAdminTask,
  updatePayout
} from "@/lib/business-services";

const sectionMeta = {
  dashboard: { title: "Platform overview", description: "Live operational signals from the platform, without invented metrics." },
  operations: { title: "Operations", description: "Claims, verification, support, and action queues." },
  organizations: { title: "Organizations", description: "Parent companies, brands, locations, ownership, and delegated authority." },
  businesses: { title: "Businesses", description: "Imported, claimed, verified, published, and duplicate listings." },
  people: { title: "People operations", description: "Spotly employees, hiring, schedules, leave, payroll preparation, training, assets, and exits." },
  drivers: { title: "Driver program", description: "Driver and fleet onboarding, compliance, availability, incidents, and payouts." },
  customers: { title: "Customers and accounts", description: "Customer identities, access, private beta, support context, and account status." },
  finance: { title: "Commerce & finance", description: "Platform-wide currencies, payment methods, recipients, commission, and payouts." },
  content: { title: "Content & growth", description: "Coming-soon content, waitlist, partnerships, announcements, and help resources." },
  "platform-map": { title: "Platform map", description: "Entity, workforce, workflow, configuration, and diagnostic relationships." },
  platform: { title: "Platform configuration", description: "Launch controls, data imports, verification, and environment readiness." },
  audit: { title: "Audit log", description: "Recorded changes and decisions across the platform." },
  settings: { title: "Admin settings", description: "Roles, support details, integrations, legal information, and administrator access." }
};

const defaultRoles = defaultRoleTemplates.filter((role) => role.scope === "platform");

function useAdminData() {
  const [businesses, setBusinesses] = useState([]);
  const [claims, setClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [support, setSupport] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [partnerships, setPartnerships] = useState([]);
  const [audit, setAudit] = useState([]);
  const [help, setHelp] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let settled = false;
    const mark = () => { if (!settled) { settled = true; setReady(true); } };
    const cleanups = [
      subscribeBusinesses((items) => { setBusinesses(items); mark(); }, { limit: 500, onError: mark }),
      subscribeClaims(setClaims, { limit: 250, onError: () => {} }),
      subscribeUsers(setUsers, { limit: 500, onError: () => {} }),
      subscribeSupportConversations(setSupport, { limit: 250, onError: () => {} }),
      subscribeWaitlist(setWaitlist, { limit: 1000, onError: () => {} }),
      subscribePartnershipLeads(setPartnerships, { limit: 250, onError: () => {} }),
      subscribeAuditLogs(setAudit, { limit: 300, onError: () => {} }),
      subscribeHelpResources(setHelp, { limit: 200, onError: () => {} }),
      subscribeAnnouncements(setAnnouncements, { limit: 100, onError: () => {} }),
      subscribeRoleTemplates(setRoles, { limit: 100, onError: () => {} }),
      subscribeAdminTasks(setTasks, { limit: 250, onError: () => {} }),
      subscribeAllPayouts(setPayouts, { limit: 250, onError: () => {} })
    ];
    const timeout = window.setTimeout(mark, 1800);
    return () => { window.clearTimeout(timeout); cleanups.forEach((cleanup) => cleanup?.()); };
  }, []);

  return { businesses, claims, users, support, waitlist, partnerships, audit, help, announcements, roles, tasks, payouts, ready };
}

function AdminAccess({ children }) {
  const { user, profile, hasRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const allowed = hasRole("super_admin") || hasRole("admin") || hasAdminAccess(profile);
  if (allowed) return children;
  async function bootstrap() {
    setLoading(true);
    try { await authenticatedFetch("/api/admin/bootstrap", { method: "POST" }); await user.getIdToken(true); toast("This account now has the super-admin bootstrap role. Refreshing access…", { title: "Admin access enabled" }); window.setTimeout(() => window.location.reload(), 700); }
    catch (error) { toast(error.message, { type: "error", title: "Bootstrap failed" }); }
    finally { setLoading(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-grouped px-4"><Card elevated className="w-full max-w-lg p-7 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-admin-soft text-admin"><LockKeyhole className="h-7 w-7" /></span><h1 className="mt-5 text-2xl font-black">Administrator access is not assigned</h1><p className="mt-3 text-sm leading-6 text-secondary">Your Spotly account exists, but your account profile does not contain an administrator role. This prevents accidental exposure of platform controls.</p><div className="mt-5 rounded-2xl bg-grouped p-4 text-left text-sm leading-6"><p className="font-semibold">Current account</p><p className="text-secondary">{user?.email}</p><p className="mt-3 font-semibold">Production setup</p><p className="text-secondary">Assign a trusted administrator role, then keep access protected through the platform security configuration.</p></div><Button onClick={bootstrap} loading={loading} className="mt-6 w-full">Request one-time super-admin bootstrap</Button><p className="mt-3 text-xs leading-5 text-tertiary">This succeeds only when the current email is in the server-only BOOTSTRAP_ADMIN_EMAILS Vercel variable and no conflicting first administrator exists.</p><Link href="/account" className="mt-5 block text-sm font-semibold text-admin">Return to account</Link></Card></main>;
}

function Dashboard({ data }) {
  const pendingClaims = data.claims.filter((item) => ["submitted", "needs_information"].includes(item.status));
  const openSupport = data.support.filter((item) => !["closed", "resolved"].includes(item.status));
  const escalatedSupport = openSupport.filter((item) => ["urgent", "high"].includes(item.priority) || item.status === "escalated");
  const publicationTasks = data.tasks.filter((item) => item.type === "business_publication_review" && item.status !== "completed");
  const pendingPayouts = data.payouts.filter((item) => !["paid", "cancelled", "rejected"].includes(item.status));
  const failedTasks = data.tasks.filter((item) => ["failed", "blocked", "error"].includes(item.status));
  const queues = [
    { title: "Business claims", count: pendingClaims.length, detail: "Ownership and authority review", href: "/admin/operations", icon: FileCheck2, urgent: pendingClaims.some((item) => item.riskLevel === "high") },
    { title: "Publication review", count: publicationTasks.length, detail: "Businesses waiting to become public", href: "/admin/operations", icon: Store },
    { title: "Support conversations", count: openSupport.length, detail: `${escalatedSupport.length} escalated or high priority`, href: "/admin/operations", icon: Headphones, urgent: escalatedSupport.length > 0 },
    { title: "Payout exceptions", count: pendingPayouts.length, detail: "Pending, held, or processing", href: "/admin/finance", icon: AlertTriangle, urgent: pendingPayouts.some((item) => item.status === "held") },
    { title: "People approvals", count: data.tasks.filter((item) => String(item.type || "").startsWith("staff_") && item.status !== "completed").length, detail: "Hiring, leave, and workforce work", href: "/admin/people", icon: UsersRound }
  ];
  const urgentItems = [
    ...failedTasks.slice(0, 3).map((item) => ({ id: item.id, title: item.title || "Platform task failed", detail: item.description || item.type || "Review the failed task and assign an owner.", href: "/admin/operations", icon: AlertTriangle })),
    ...escalatedSupport.slice(0, 3).map((item) => ({ id: item.id, title: item.subject || "Escalated support conversation", detail: `${item.requesterName || item.requesterEmail || "Requester"} · ${item.category || "Support"}`, href: "/admin/operations", icon: Headphones }))
  ];
  const health = [
    { label: "Business records", value: data.businesses.length, detail: `${data.businesses.filter((item) => item.verificationStatus === "approved").length} verified` },
    { label: "Customer accounts", value: data.users.length, detail: `${data.users.filter((item) => item.status === "suspended").length} suspended` },
    { label: "Open operational tasks", value: data.tasks.filter((item) => item.status !== "completed").length, detail: `${failedTasks.length} blocked or failed` },
    { label: "Waitlist", value: data.waitlist.length, detail: "Launch interest captured" }
  ];

  return <div className="space-y-6"><div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-admin">Spotly operations</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">Control centre</h1><p className="mt-2 text-sm text-secondary">Urgent work, active queues, and platform health.</p></div><Badge tone={data.ready ? "success" : "warning"}>{data.ready ? "Live data connected" : "Connecting"}</Badge></div>{urgentItems.length > 0 && <SectionCard title="Urgent now" description="Issues that should be owned before routine queue work"><div>{urgentItems.map(({ id, title, detail, href, icon: Icon }) => <Link key={id} href={href} className="flex items-start gap-4 border-b p-4 transition hover:bg-grouped last:border-b-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger dark:bg-red-950/30"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm leading-6 text-secondary">{detail}</span></span><ArrowRight className="mt-3 h-4 w-4 text-tertiary" /></Link>)}</div></SectionCard>}<SectionCard title="Work queues" description="Open work ordered by operational purpose"><div className="grid sm:grid-cols-2 xl:grid-cols-5">{queues.map(({ title, count, detail, href, icon: Icon, urgent }) => <Link key={title} href={href} className="border-b p-5 transition hover:bg-grouped sm:border-r xl:border-b-0"><div className="flex items-start justify-between gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${urgent ? "bg-amber-50 text-warning dark:bg-amber-950/30" : "bg-admin-soft text-admin"}`}><Icon className="h-5 w-5" /></span><Badge tone={urgent ? "warning" : count ? "accent" : "success"}>{count}</Badge></div><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-secondary">{detail}</p></Link>)}</div></SectionCard><div className="grid gap-5 lg:grid-cols-[1fr_.9fr]"><SectionCard title="Platform health" description="Current record and queue signals"><div className="grid grid-cols-2">{health.map((item) => <div key={item.label} className="border-b p-5 odd:border-r"><p className="text-sm text-secondary">{item.label}</p><p className="mt-2 text-2xl font-semibold">{item.value}</p><p className="mt-1 text-xs text-tertiary">{item.detail}</p></div>)}</div></SectionCard><SectionCard title="Recent decisions" description="Latest recorded platform activity"><div>{data.audit.slice(0, 6).map((item) => <div key={item.id} className="flex gap-3 border-b p-4 last:border-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-soft text-admin"><Activity className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{String(item.action || "Platform update").replaceAll("_", " ")}</p><p className="mt-1 truncate text-xs text-secondary">{item.entityType || "Record"} · {item.actorEmail || "Spotly"}</p></div></div>)}{!data.audit.length && <EmptyState icon={ClipboardList} title="No recorded decisions yet" description="Reviews, configuration changes, and access decisions will appear here." />}</div></SectionCard></div><div className="flex flex-wrap gap-2"><Button asChild><Link href="/admin/operations">Open operations<ArrowRight className="h-4 w-4" /></Link></Button><Button asChild variant="outline"><Link href="/admin/platform-map">Open platform map</Link></Button><Button asChild variant="outline"><Link href="/admin/platform">Review configuration</Link></Button></div></div>;
}

function ClaimReviewModal({ claim, businesses, open, onClose, user }) {
  const business = businesses.find((item) => item.id === claim?.businessId);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState("");
  const { toast } = useToast();
  async function decide(decision) {
    setLoading(decision);
    try { await decideBusinessClaim(claim, decision, user, reason); toast(`Claim marked ${decision === "approve" ? "approved" : decision === "request" ? "needs information" : "rejected"}.`, { title: "Verification decision saved" }); onClose(); }
    catch (error) { toast(error.message, { type: "error", title: "Decision failed" }); }
    finally { setLoading(""); }
  }
  return <Modal open={open} onClose={onClose} title="Business claim review" size="lg">{claim && <div className="p-5"><div className="grid gap-4 sm:grid-cols-2"><Card className="p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-tertiary">Business</p><h3 className="mt-3 text-xl font-bold">{business?.name || claim.businessId}</h3><p className="mt-2 text-sm text-secondary">{business?.category || "Category unavailable"} · {business?.city || "City unavailable"}</p><div className="mt-4"><StatusBadge status={business?.verificationStatus || "unverified"} /></div></Card><Card className="p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-tertiary">Applicant</p><h3 className="mt-3 text-xl font-bold">{claim.applicantName || claim.applicantEmail}</h3><p className="mt-2 text-sm text-secondary">{claim.applicantEmail} · {(claim.roleAtBusiness || "owner").replaceAll("_", " ")}</p><div className="mt-4"><StatusBadge status={claim.status || "submitted"} /></div></Card></div><SectionCard title="Evidence and review context" className="mt-5"><div className="p-5"><p className="text-sm leading-6 text-secondary">{claim.notes || "The applicant did not add a review note."}</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{(claim.evidence || []).length ? claim.evidence.map((file) => <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="rounded-xl border p-3 text-sm font-semibold hover:bg-grouped"><FileCheck2 className="mb-3 h-5 w-5 text-success" />{file.name}<ExternalLink className="ml-2 inline h-3.5 w-3.5" /></a>) : <div className="sm:col-span-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No file evidence was attached. Use phone, email, public records, or request more information before approval.</div>}</div></div></SectionCard><label className="mt-5 block"><span className="mb-2 block text-sm font-semibold">Decision reason or request</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} className="surface min-h-28 w-full rounded-xl p-4 outline-none" placeholder="Explain the evidence reviewed, information required, or rejection reason." /></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="danger" onClick={() => decide("reject")} loading={loading === "reject"} disabled={!reason.trim()}><XCircle className="h-4 w-4" />Reject</Button><Button variant="outline" onClick={() => decide("request")} loading={loading === "request"} disabled={!reason.trim()}>Request information</Button><Button onClick={() => decide("approve")} loading={loading === "approve"}><BadgeCheck className="h-4 w-4" />Approve</Button></div></div>}</Modal>;
}

function SupportDesk({ conversations, user }) {
  const [selected, setSelected] = useState(conversations[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const { toast } = useToast();
  useEffect(() => { if (!selected && conversations[0]) setSelected(conversations[0].id); }, [conversations, selected]);
  useEffect(() => selected ? subscribeSupportMessages(selected, setMessages, () => {}) : undefined, [selected]);
  const current = conversations.find((item) => item.id === selected);
  async function send(event) { event.preventDefault(); if (!reply.trim()) return; const body = reply; setReply(""); try { await sendSupportMessage(selected, body, user, { senderName: user.displayName || "Spotly Support", senderRole: "admin", internal }); } catch (error) { setReply(body); toast(error.message, { type: "error" }); } }
  async function setStatus(status) { try { await updateSupportConversation(selected, { status }, user); toast(`Conversation marked ${status}.`); } catch (error) { toast(error.message, { type: "error" }); } }
  return <Card className="grid min-h-[610px] overflow-hidden lg:grid-cols-[340px_1fr]"><div className="border-r"><div className="border-b p-4"><p className="font-bold">Support queue</p><p className="mt-1 text-xs text-secondary">{conversations.length} conversations</p></div><div className="max-h-[548px] overflow-y-auto">{conversations.map((item) => <button key={item.id} onClick={() => setSelected(item.id)} className={`w-full border-b p-4 text-left ${selected === item.id ? "bg-admin-soft" : "hover:bg-grouped"}`}><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{item.subject}</p><StatusBadge status={item.status || "open"} /></div><p className="mt-1 truncate text-xs text-secondary">{item.requesterName || item.requesterEmail || "Visitor"} · {item.category}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary">{item.lastMessage}</p></button>)}{!conversations.length && <div className="p-5 text-sm leading-6 text-secondary">No support conversations yet. The public and business chat systems will create records here.</div>}</div></div><div className="flex min-h-0 flex-col">{current ? <><div className="flex flex-wrap items-center gap-2 border-b p-4"><div className="min-w-0 flex-1"><p className="truncate font-bold">{current.subject}</p><p className="mt-1 text-xs text-secondary">{current.requesterEmail || "No email"} · {current.category} · {current.priority || "normal"}</p></div><Button size="sm" variant="outline" onClick={() => assignSupportConversation(current.id, user.uid, user)}>Assign to me</Button><select value={current.status || "open"} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-xl border bg-white px-3 text-xs font-semibold"><option value="open">Open</option><option value="assigned">Assigned</option><option value="waiting_on_user">Waiting on user</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div><div className="min-h-0 flex-1 overflow-y-auto bg-grouped p-5"><div className="space-y-3">{messages.map((message) => <div key={message.id} className={`flex ${message.senderRole === "admin" ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${message.internal ? "border border-amber-200 bg-amber-50 text-amber-950" : message.senderRole === "admin" ? "bg-admin text-white" : "border bg-white"}`}><p className="text-[11px] font-bold opacity-65">{message.internal ? "INTERNAL NOTE · " : ""}{message.senderName}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p></div></div>)}</div></div><form onSubmit={send} className="border-t bg-white p-4"><div className="flex items-end gap-2"><textarea value={reply} onChange={(event) => setReply(event.target.value)} className={`min-h-11 flex-1 rounded-xl p-3 text-sm outline-none ${internal ? "bg-amber-50" : "bg-grouped"}`} placeholder={internal ? "Internal note visible only to administrators…" : "Reply to the requester…"} /><Button type="submit">Send</Button></div><label className="mt-2 flex items-center gap-2 text-xs font-semibold text-secondary"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Internal note</label></form></> : <EmptyState icon={MessageCircle} title="Select a support conversation" description="Assignment, internal notes, linked context, status, and response history live here." />}</div></Card>;
}

function PublicationQueue({ tasks, businesses, user }) {
  const [busy, setBusy] = useState("");
  const { toast } = useToast();
  const openTasks = tasks.filter((item) => item.type === "business_publication_review" && item.status !== "completed");
  async function decide(task, decision) {
    const business = businesses.find((item) => item.id === task.businessId);
    if (!business) return toast("The linked business record was not found.", { type: "error", title: "Business missing" });
    const reason = decision === "needs_information" ? window.prompt("What should the business correct before publication?") : "";
    if (decision === "needs_information" && !reason) return;
    setBusy(task.id);
    try {
      if (decision === "approve") {
        await adminUpdateBusiness(business.id, { ...business, status: "active", public: true, publishedAt: new Date().toISOString(), publishedBy: user.uid }, user);
        await updateAdminTask(task.id, { status: "completed", decision: "approved", completedAt: new Date().toISOString() }, user);
        toast(`${business.name} is now approved for publication.`, { title: "Business published" });
      } else {
        await adminUpdateBusiness(business.id, { ...business, status: "draft", public: false, publicationReviewReason: reason }, user);
        await updateAdminTask(task.id, { status: "completed", decision: "needs_information", reason, completedAt: new Date().toISOString() }, user);
        toast("The business has been sent a clear correction requirement.", { title: "Changes requested" });
      }
    } catch (error) { toast(error.message || "The review decision could not be saved.", { type: "error", title: "Could not complete review" }); }
    finally { setBusy(""); }
  }
  return <SectionCard>{openTasks.length ? <div className="divide-y">{openTasks.map((task) => { const business = businesses.find((item) => item.id === task.businessId); return <div key={task.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-admin-soft text-admin"><Store className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{business?.name || task.businessName || task.businessId}</p><p className="mt-1 text-xs text-secondary">Publication review · requested by {task.requestedByEmail || "business owner"}</p><div className="mt-2 flex flex-wrap gap-2"><StatusBadge status={business?.verificationStatus || "unverified"} /><StatusBadge status={business?.status || "draft"} /><Badge tone="neutral">{business?.branchIds?.length || 0} linked branches</Badge></div></div><div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link href={`/admin/support-view/${task.businessId}`}>Support view</Link></Button><Button size="sm" variant="outline" loading={busy === task.id} onClick={() => decide(task, "needs_information")}>Request changes</Button><Button size="sm" loading={busy === task.id} onClick={() => decide(task, "approve")}><CheckCircle2 className="h-4 w-4" />Approve</Button></div></div>; })}</div> : <EmptyState icon={BadgeCheck} title="No publication reviews are waiting" description="When a business completes every readiness check and requests review, it appears here with direct approval and correction actions." />}</SectionCard>;
}

function Operations({ data, user }) {
  const [tab, setTab] = useState("claims");
  const [selectedClaim, setSelectedClaim] = useState(null);
  const claims = data.claims.filter((item) => ["submitted", "needs_information"].includes(item.status));
  const publicationTasks = data.tasks.filter((item) => item.type === "business_publication_review" && item.status !== "completed");
  return <div className="space-y-6"><PageHeader {...sectionMeta.operations} /><Tabs value={tab} onChange={setTab} tabs={[{ value: "claims", label: `Claims (${claims.length})` }, { value: "publication", label: `Publication (${publicationTasks.length})` }, { value: "support", label: `Support (${data.support.filter((item) => !["closed", "resolved"].includes(item.status)).length})` }]} />{tab === "claims" ? <SectionCard>{claims.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Claim</th><th className="px-5 py-3">Business</th><th className="px-5 py-3">Applicant</th><th className="px-5 py-3">Evidence</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{claims.map((claim) => { const business = data.businesses.find((item) => item.id === claim.businessId); return <tr key={claim.id} className="border-t"><td className="px-5 py-4 font-semibold">{claim.id.slice(0, 8).toUpperCase()}</td><td className="px-5 py-4"><p className="font-semibold">{business?.name || claim.businessId}</p><p className="mt-1 text-xs text-secondary">{business?.city || "Location unavailable"}</p></td><td className="px-5 py-4"><p>{claim.applicantName || claim.applicantEmail}</p><p className="mt-1 text-xs text-secondary">{claim.roleAtBusiness}</p></td><td className="px-5 py-4">{claim.evidence?.length || 0} file(s)</td><td className="px-5 py-4"><StatusBadge status={claim.status.replaceAll("_", " ")} /></td><td className="px-5 py-4"><Button size="sm" onClick={() => setSelectedClaim(claim)}>Review</Button></td></tr>; })}</tbody></table></div> : <EmptyState icon={FileCheck2} title="Claim queue is clear" description="New business claims will appear here in realtime. A clear queue means every current application has a decision." />}</SectionCard> : tab === "publication" ? <PublicationQueue tasks={data.tasks} businesses={data.businesses} user={user} /> : <SupportDesk conversations={data.support} user={user} />}<ClaimReviewModal claim={selectedClaim} businesses={data.businesses} open={Boolean(selectedClaim)} onClose={() => setSelectedClaim(null)} user={user} /></div>;
}

function BusinessLocationsModal({ business, open, onClose }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!open || !business?.id) return undefined;
    setLoading(true);
    setError("");
    getBranchesForBusiness(business.id)
      .then((items) => { if (active) setBranches(items); })
      .catch((reason) => { if (active) setError(reason.message || "Locations could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [business?.id, open]);

  return <Modal open={open} onClose={onClose} title={business ? `${business.name} locations` : "Business locations"} size="lg">
    <div className="max-h-[76vh] overflow-y-auto p-5">
      <div className="rounded-2xl bg-admin-soft p-4 text-sm leading-6 text-admin"><strong>{business?.name}</strong> is the business brand. The records below are the exact branches, venues, properties, or service locations connected to it.</div>
      {loading ? <div className="flex justify-center py-14"><span className="h-7 w-7 animate-spin rounded-full border-2 border-admin border-t-transparent" /></div>
        : error ? <EmptyState icon={AlertTriangle} title="Locations could not be loaded" description={error} action={<Button variant="outline" onClick={onClose}>Close</Button>} />
          : branches.length ? <div className="mt-5 space-y-3">{branches.map((branch, index) => <div key={branch.id} className="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grouped text-admin"><Building2 className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{branch.branchName || branch.name || `Location ${index + 1}`}</p>{index === 0 && <Badge tone="neutral">Primary</Badge>}<StatusBadge status={branch.status || "active"} /></div><p className="mt-1 text-sm text-secondary">{[branch.address, branch.city].filter(Boolean).join(" · ") || "Address awaiting confirmation"}</p><p className="mt-1 text-xs text-tertiary">{branch.id}</p></div>
            <Badge tone={branch.public === false ? "warning" : "success"}>{branch.public === false ? "Hidden" : "Public"}</Badge>
          </div>)}</div> : <EmptyState className="mt-5" icon={Building2} title="No location is connected" description="This brand needs at least one exact customer or service location before it can be published." />}
    </div>
  </Modal>;
}

function BusinessModal({ business, open, onClose, user }) {
  const isNew = !business;
  const defaults = useMemo(() => ({
    name: "",
    brandName: "",
    legalName: "",
    businessType: "grocery_retail",
    category: "Groceries",
    description: "",
    branchName: "Main location",
    city: "Harare",
    address: "",
    phone: "",
    email: "",
    website: "",
    operatingModel: "physical_single",
    claimStatus: "unclaimed",
    verificationStatus: "unverified",
    status: "provisional",
    public: true,
    country: "ZW",
    source: { type: "admin_created", imported: false }
  }), []);
  const [form, setForm] = useState(defaults);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    const next = business ? { ...defaults, ...business, businessType: inferBusinessType(business) } : defaults;
    setForm(next);
    setStep(0);
  }, [business, open, defaults]);

  function patch(values) { setForm((current) => ({ ...current, ...values })); }
  function chooseType(type) {
    const archetype = BUSINESS_ARCHETYPES[type];
    patch({ businessType: type, category: archetype?.categoryHints?.[0] || form.category, capabilities: capabilitiesFor(type) });
  }
  async function save(event) {
    event.preventDefault();
    if (!form.name.trim()) return toast("Enter the business brand name.", { type: "error", title: "Business name required" });
    if (isNew && step === 0) { setStep(1); return; }
    if (isNew && !form.branchName.trim()) return toast("Give the first location a short name, such as Hillside or Main office.", { type: "error", title: "Location name required" });
    setLoading(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        brandName: (form.brandName || form.name).trim(),
        businessType: form.businessType,
        capabilities: capabilitiesFor(form.businessType)
      };
      if (isNew) await authenticatedFetch("/api/admin/businesses", { method: "POST", body: JSON.stringify(payload) });
      else await adminUpdateBusiness(business.id, { ...payload, aliases: [...new Set([...(form.aliases || []), form.name, form.brandName, form.city].filter(Boolean))] }, user);
      toast(isNew ? "The brand and its first location are now in the live directory." : "Business brand updated.", { title: isNew ? "Business created" : "Saved" });
      onClose();
    } catch (error) { toast(error.message || "The business could not be saved.", { type: "error", title: "Could not save business" }); }
    finally { setLoading(false); }
  }

  const title = isNew ? (step === 0 ? "Add a business brand" : "Add its first location") : "Edit business brand";
  return <Modal open={open} onClose={onClose} title={title} size="lg"><form onSubmit={save} className="max-h-[80vh] overflow-y-auto">
    {isNew && <div className="border-b px-5 py-4"><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${step >= 0 ? "bg-admin text-white" : "bg-grouped"}`}>1</span><div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-admin" : "bg-grouped"}`} /><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${step >= 1 ? "bg-admin text-white" : "bg-grouped"}`}>2</span></div><div className="mt-2 flex justify-between text-xs font-semibold text-secondary"><span>Business brand</span><span>First location</span></div></div>}
    <div className="space-y-5 p-5">
      {(!isNew || step === 0) && <>
        <div><p className="text-sm font-black">What kind of business is this?</p><p className="mt-1 text-sm leading-6 text-secondary">This choice shapes the onboarding, workspace, customer actions, and language. It can be changed later.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.values(BUSINESS_ARCHETYPES).map((item) => { const Icon = item.icon; const selected = form.businessType === item.id; return <button key={item.id} type="button" onClick={() => chooseType(item.id)} className={`flex items-start gap-3 rounded-2xl border p-4 text-left ${selected ? "border-admin bg-admin-soft ring-2 ring-admin/10" : "hover:border-admin/30"}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-admin text-white" : "bg-grouped text-secondary"}`}><Icon className="h-5 w-5" /></span><span><span className="block text-sm font-bold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-secondary">{item.description}</span></span></button>; })}</div></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Business brand name</span><input required value={form.name || ""} onChange={(event) => patch({ name: event.target.value, brandName: form.brandName || event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="Example: OK Zimbabwe" /><span className="mt-1.5 block text-xs text-secondary">Use the brand customers recognize, not a branch name or address.</span></label><label><span className="mb-2 block text-sm font-semibold">Legal name <span className="font-normal text-tertiary">optional</span></span><input value={form.legalName || ""} onChange={(event) => patch({ legalName: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Primary category</span><select value={form.category || "Other"} onChange={(event) => patch({ category: event.target.value })} className="surface h-12 w-full rounded-xl px-4">{businessCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Description</span><textarea rows={4} value={form.description || ""} onChange={(event) => patch({ description: event.target.value })} className="surface w-full rounded-xl p-4 outline-none" placeholder="What customers should know about this business" /></label></div>
      </>}
      {isNew && step === 1 && <>
        <div className="rounded-2xl bg-admin-soft p-4"><p className="text-sm font-black text-admin">{form.name}</p><p className="mt-1 text-sm leading-6 text-secondary">Now add one exact location. More locations can be added after the brand exists.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Short location name</span><input required value={form.branchName || ""} onChange={(event) => patch({ branchName: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="Hillside, CBD, Main office" /></label><label><span className="mb-2 block text-sm font-semibold">Operating model</span><select value={form.operatingModel || "physical_single"} onChange={(event) => patch({ operatingModel: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="physical_single">One physical location</option><option value="physical_multi">Several locations</option><option value="online_only">Online only</option><option value="mobile_service">Mobile or at-customer service</option></select></label><label><span className="mb-2 block text-sm font-semibold">City</span><select value={form.city || "Harare"} onChange={(event) => patch({ city: event.target.value })} className="surface h-12 w-full rounded-xl px-4">{zimbabweCities.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="mb-2 block text-sm font-semibold">Address or service area</span><input value={form.address || ""} onChange={(event) => patch({ address: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Phone</span><input value={form.phone || ""} onChange={(event) => patch({ phone: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Email</span><input type="email" value={form.email || ""} onChange={(event) => patch({ email: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Website <span className="font-normal text-tertiary">optional</span></span><input value={form.website || ""} onChange={(event) => patch({ website: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label></div>
      </>}
      {!isNew && <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Phone</span><input value={form.phone || ""} onChange={(event) => patch({ phone: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Email</span><input type="email" value={form.email || ""} onChange={(event) => patch({ email: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Website</span><input value={form.website || ""} onChange={(event) => patch({ website: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Primary city</span><select value={form.city || "Harare"} onChange={(event) => patch({ city: event.target.value })} className="surface h-12 w-full rounded-xl px-4">{zimbabweCities.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="mb-2 block text-sm font-semibold">Claim status</span><select value={form.claimStatus || "unclaimed"} onChange={(event) => patch({ claimStatus: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="unclaimed">Unclaimed</option><option value="claim_pending">Claim pending</option><option value="claimed">Claimed</option><option value="claim_needs_information">Needs information</option></select></label><label><span className="mb-2 block text-sm font-semibold">Verification</span><select value={form.verificationStatus || "unverified"} onChange={(event) => patch({ verificationStatus: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="unverified">Unverified</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label><label><span className="mb-2 block text-sm font-semibold">Lifecycle status</span><select value={form.status || "provisional"} onChange={(event) => patch({ status: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="provisional">Provisional</option><option value="draft">Draft</option><option value="pending_publication_review">Publication review</option><option value="active">Active</option><option value="paused">Paused</option><option value="removed">Removed</option></select></label><label className="flex items-center gap-3 rounded-xl bg-grouped p-4 text-sm font-semibold"><input type="checkbox" checked={form.public !== false} onChange={(event) => patch({ public: event.target.checked })} />Visible in the public directory</label></div>}
    </div>
    <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white/95 p-5 backdrop-blur"><div>{isNew && step === 1 && <Button type="button" variant="ghost" onClick={() => setStep(0)}>Back</Button>}</div><div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>{isNew && step === 0 ? "Continue to location" : isNew ? "Create brand & location" : "Save business"}</Button></div></div>
  </form></Modal>;
}

function Businesses({ data, user }) {
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [locationsFor, setLocationsFor] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const visible = data.businesses.filter((item) => {
    const matchesText = [item.name, item.brandName, item.category, item.city, item.id].filter(Boolean).join(" ").toLowerCase().includes(queryText.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "unclaimed" && item.claimStatus === "unclaimed") || (filter === "claimed" && item.claimStatus === "claimed") || (filter === "verified" && item.verificationStatus === "approved") || (filter === "review" && ["claim_pending", "pending_publication_review"].includes(item.status) || item.claimStatus === "claim_pending") || (filter === "provisional" && item.status === "provisional");
    return matchesText && matchesFilter;
  });
  return <div className="space-y-6"><PageHeader {...sectionMeta.businesses} actions={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" />Add business brand</Button>} /><AdminDirectoryManager liveBusinessCount={data.businesses.length} compact /><div className="rounded-2xl border bg-admin-soft p-4 text-sm leading-6 text-admin"><strong>Brand first, locations second.</strong> Each row below is one business brand. Open locations to see its branches, venues, properties, or service areas.</div><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search brand, category, city, or ID" /><Tabs value={filter} onChange={setFilter} tabs={[{ value: "all", label: `All (${data.businesses.length})` }, { value: "unclaimed", label: "Unclaimed" }, { value: "claimed", label: "Claimed" }, { value: "verified", label: "Verified" }, { value: "review", label: "Review" }, { value: "provisional", label: "Provisional" }]} /></div><SectionCard>{visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Business brand</th><th className="px-5 py-3">Model</th><th className="px-5 py-3">Locations</th><th className="px-5 py-3">Ownership</th><th className="px-5 py-3">Publication</th><th className="px-5 py-3">Readiness</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((item) => {
    const missing = [item.description, item.phone || item.email, item.category].filter((value) => !value).length;
    const archetype = BUSINESS_ARCHETYPES[inferBusinessType(item)];
    return <tr key={item.id} className="border-t align-top"><td className="px-5 py-4"><p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.id}</p></td><td className="px-5 py-4"><p className="font-semibold">{archetype?.shortLabel || item.category}</p><p className="mt-1 text-xs text-secondary">{item.category} · {item.city || "Zimbabwe"}</p></td><td className="px-5 py-4"><button className="rounded-xl border px-3 py-2 text-left transition hover:border-admin hover:bg-admin-soft" onClick={() => setLocationsFor(item)}><span className="block font-bold">{item.branchCount || item.branchIds?.length || 0} location{(item.branchCount || item.branchIds?.length || 0) === 1 ? "" : "s"}</span><span className="mt-0.5 block text-xs text-admin">Open hierarchy</span></button></td><td className="px-5 py-4"><StatusBadge status={(item.claimStatus || "unclaimed").replaceAll("_", " ")} /><div className="mt-2"><StatusBadge status={item.verificationStatus || "unverified"} /></div></td><td className="px-5 py-4"><StatusBadge status={item.status || "provisional"} /><p className="mt-2 text-xs text-secondary">{item.public === false ? "Hidden from directory" : "Visible in directory"}</p></td><td className="px-5 py-4"><Badge tone={missing ? "warning" : "success"}>{missing ? `${missing} brand detail${missing === 1 ? "" : "s"} to confirm` : "Core brand details ready"}</Badge></td><td className="px-5 py-4"><div className="flex flex-col gap-2"><Button asChild size="sm" variant="ghost" className="w-full"><Link href={`/admin/support-view/${item.id}`}><Headphones className="h-4 w-4" />Support view</Link></Button><Button size="sm" variant="outline" onClick={() => { setEditing(item); setModalOpen(true); }}><Edit3 className="h-4 w-4" />Edit brand</Button></div></td></tr>;
  })}</tbody></table></div> : <EmptyState icon={Store} title={data.businesses.length ? "No business brands match this view" : "Populate the business directory"} description={data.businesses.length ? "Change the search or filter." : "Use the directory setup above. Brands and their exact locations will be connected separately in Firestore."} />}</SectionCard><BusinessModal business={editing} open={modalOpen} onClose={() => setModalOpen(false)} user={user} /><BusinessLocationsModal business={locationsFor} open={Boolean(locationsFor)} onClose={() => setLocationsFor(null)} /></div>;
}

function People({ data, user }) {
  const [queryText, setQueryText] = useState(""); const [editing, setEditing] = useState(null);
  const visible = data.users.filter((item) => [item.displayName, item.email, ...(item.roles || [])].join(" ").toLowerCase().includes(queryText.toLowerCase()));
  return <div className="space-y-6"><PageHeader {...sectionMeta.customers} /><SearchField value={queryText} onChange={setQueryText} placeholder="Search name, email, or role" /><SectionCard>{visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Person</th><th className="px-5 py-3">Providers</th><th className="px-5 py-3">Roles</th><th className="px-5 py-3">Beta</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold">{item.displayName || "Unnamed user"}</p><p className="mt-1 text-xs text-secondary">{item.email || item.id}</p></td><td className="px-5 py-4 text-xs text-secondary">{item.providers?.join(", ") || "password"}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-1">{(item.roles || ["customer"]).map((role) => <Badge key={role} tone="neutral">{role}</Badge>)}</div></td><td className="px-5 py-4"><StatusBadge status={item.privateBeta ? "Enabled" : "Not enabled"} /></td><td className="px-5 py-4"><StatusBadge status={item.status || "active"} /></td><td className="px-5 py-4"><Button size="sm" variant="outline" onClick={() => setEditing(item)}>Access</Button></td></tr>)}</tbody></table></div> : <EmptyState icon={UsersRound} title="No user profiles yet" description="User profiles appear here after people create or sign in to their Spotly accounts." />}</SectionCard><AccessModal person={editing} open={Boolean(editing)} onClose={() => setEditing(null)} actor={user} /></div>;
}

function AccessModal({ person, open, onClose, actor }) {
  const [roles, setRoles] = useState(person?.roles || ["customer"]); const [status, setStatus] = useState(person?.status || "active"); const [privateBeta, setPrivateBeta] = useState(Boolean(person?.privateBeta)); const [permissions, setPermissions] = useState((person?.customPermissions || []).join("\n")); const [loading, setLoading] = useState(false); const { toast } = useToast();
  useEffect(() => { setRoles(person?.roles || ["customer"]); setStatus(person?.status || "active"); setPrivateBeta(Boolean(person?.privateBeta)); setPermissions((person?.customPermissions || []).join("\n")); }, [person]);
  async function save() { setLoading(true); try { await saveUserAccess(person.id, { roles, status, privateBeta, customPermissions: permissions.split(/\n|,/).map((item) => item.trim()).filter(Boolean) }, actor); toast("User access updated.", { title: "Saved" }); onClose(); } catch (error) { toast(error.message, { type: "error" }); } finally { setLoading(false); } }
  const roleOptions = ["customer", "business", "super_admin", "platform_admin", "operations_manager", "verification_officer", "business_success_manager", "finance_admin", "finance_viewer", "support_manager", "support_agent", "content_manager", "marketing_manager", "risk_compliance_officer", "data_import_manager", "analytics_viewer", "auditor"];
  return <Modal open={open} onClose={onClose} title="User roles and access">{person && <div className="space-y-5 p-5"><div><p className="font-bold">{person.displayName || person.email}</p><p className="mt-1 text-sm text-secondary">{person.email}</p></div><div><p className="text-sm font-semibold">Roles</p><div className="mt-3 grid grid-cols-2 gap-2">{roleOptions.map((role) => <label key={role} className="flex items-center gap-2 rounded-xl bg-grouped p-3 text-xs font-semibold"><input type="checkbox" checked={roles.includes(role)} onChange={(event) => setRoles(event.target.checked ? [...roles, role] : roles.filter((item) => item !== role))} />{role.replaceAll("_", " ")}</label>)}</div></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Account status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="surface h-12 w-full rounded-xl px-4"><option value="active">Active</option><option value="restricted">Restricted</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option></select></label><label className="flex items-end gap-2 pb-3 text-sm font-semibold"><input type="checkbox" checked={privateBeta} onChange={(event) => setPrivateBeta(event.target.checked)} />Private beta access</label></div><label className="block"><span className="mb-2 block text-sm font-semibold">Custom permissions</span><textarea value={permissions} onChange={(event) => setPermissions(event.target.value)} className="surface min-h-24 w-full rounded-xl p-4 font-mono text-xs outline-none" placeholder="One permission per line" /></label><Button onClick={save} loading={loading} className="w-full">Save access</Button></div>}</Modal>;
}

function CommerceSettings({ settings, onChange, onSave, loading }) {
  const commerce = settings.commerce || {};
  const update = (values) => onChange({ ...settings, commerce: { ...commerce, ...values } });
  return <div className="space-y-6"><PageHeader {...sectionMeta.finance} actions={<Button onClick={onSave} loading={loading}><Save className="h-4 w-4" />Save commerce settings</Button>} /><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Currencies and payments"><div className="space-y-5 p-5"><div><p className="text-sm font-semibold">Supported currencies</p><div className="mt-3 flex gap-3">{["USD", "ZWG"].map((currency) => <label key={currency} className="flex flex-1 items-center gap-3 rounded-xl bg-grouped p-4 text-sm font-semibold"><input type="checkbox" checked={commerce.currencies?.includes(currency)} onChange={(event) => update({ currencies: event.target.checked ? [...(commerce.currencies || []), currency] : (commerce.currencies || []).filter((item) => item !== currency) })} />{currency}</label>)}</div></div><div><p className="text-sm font-semibold">Platform payment methods</p><div className="mt-3 grid grid-cols-2 gap-2">{["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"].map((method) => <label key={method} className="flex items-center gap-2 rounded-xl bg-grouped p-3 text-sm font-semibold capitalize"><input type="checkbox" checked={commerce.paymentMethods?.includes(method)} onChange={(event) => update({ paymentMethods: event.target.checked ? [...(commerce.paymentMethods || []), method] : (commerce.paymentMethods || []).filter((item) => item !== method) })} />{method.replaceAll("_", " ")}</label>)}</div></div><label className="block"><span className="mb-2 block text-sm font-semibold">Default payment recipient</span><select value={commerce.paymentRecipient || "platform"} onChange={(event) => update({ paymentRecipient: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="platform">Spotly, followed by settlement</option><option value="business">Business directly</option><option value="hybrid">Depends on business or method</option></select></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={commerce.businessCanOverrideRecipient !== false} onChange={(event) => update({ businessCanOverrideRecipient: event.target.checked })} />Businesses may override recipient where supported</label></div></SectionCard><SectionCard title="Commission and payout defaults"><div className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Default Spotly commission (%)</span><input type="number" min="0" max="100" step="0.1" value={commerce.commissionPercent ?? 10} onChange={(event) => update({ commissionPercent: Number(event.target.value) })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Payout cadence</span><select value={commerce.payoutCadence || "weekly"} onChange={(event) => update({ payoutCadence: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="daily">Daily</option><option value="twice_weekly">Twice weekly</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="manual">Manual</option></select></label><label><span className="mb-2 block text-sm font-semibold">Payout delay (days)</span><input type="number" min="0" value={commerce.payoutDelayDays ?? 2} onChange={(event) => update({ payoutDelayDays: Number(event.target.value) })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Pickup slot minutes</span><input type="number" min="10" value={commerce.pickupSlotMinutes ?? 30} onChange={(event) => update({ pickupSlotMinutes: Number(event.target.value) })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Default slot capacity</span><input type="number" min="1" value={commerce.defaultSlotCapacity ?? 12} onChange={(event) => update({ defaultSlotCapacity: Number(event.target.value) })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label></div><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={commerce.substitutionsEnabled !== false} onChange={(event) => update({ substitutionsEnabled: event.target.checked })} />Allow customer substitution preferences</label></div></SectionCard></div></div>;
}


function PayoutAdminQueue({ payouts, businesses, user }) {
  const [busy, setBusy] = useState("");
  const { toast } = useToast();
  async function change(item, status) {
    const reference = status === "paid" ? window.prompt("Enter the bank, mobile-money, or settlement reference:") : "";
    if (status === "paid" && !reference) return;
    setBusy(item.id);
    try {
      await updatePayout(item.id, { status, reference, [`${status}At`]: new Date().toISOString() }, user);
      toast(`Payout marked ${status.replaceAll("_", " ")}.`, { title: "Payout updated" });
    } catch (error) { toast(error.message || "The payout could not be updated.", { type: "error", title: "Could not update" }); }
    finally { setBusy(""); }
  }
  return <SectionCard title="Business payout queue" description="Review requested settlements through approval, processing, and payment.">{payouts.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Business</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Requested by</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3"></th></tr></thead><tbody>{payouts.map((item) => { const business = businesses.find((value) => value.id === item.businessId); return <tr key={item.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold">{business?.name || item.businessId}</p><p className="mt-1 text-xs text-secondary">{item.id}</p></td><td className="px-5 py-4 font-bold">{item.currency || "USD"} {Number(item.amount || 0).toFixed(2)}</td><td className="px-5 py-4 text-xs text-secondary">{item.requestedByEmail || item.requestedBy}</td><td className="px-5 py-4"><StatusBadge status={item.status || "requested"} /></td><td className="px-5 py-4 text-xs text-secondary">{item.reference || "—"}</td><td className="px-5 py-4"><div className="flex gap-2">{item.status === "requested" && <Button size="sm" variant="outline" loading={busy === item.id} onClick={() => change(item, "approved")}>Approve</Button>}{item.status === "approved" && <Button size="sm" variant="outline" loading={busy === item.id} onClick={() => change(item, "processing")}>Start processing</Button>}{["approved", "processing"].includes(item.status) && <Button size="sm" loading={busy === item.id} onClick={() => change(item, "paid")}>Mark paid</Button>}{!["paid", "rejected"].includes(item.status) && <Button size="sm" variant="ghost" className="text-danger" loading={busy === item.id} onClick={() => change(item, "rejected")}>Reject</Button>}</div></td></tr>; })}</tbody></table></div> : <EmptyState icon={WalletCards} title="No payout requests yet" description="Business payout requests will appear here with a complete settlement state and reference." />}</SectionCard>;
}

function Content({ data, user }) {
  const [tab, setTab] = useState("waitlist");
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [helpForm, setHelpForm] = useState({ title: "", description: "", type: "article", youtubeId: "", category: "Getting started", language: "en", audience: ["public", "business"], published: true, order: 10 });
  const [announcement, setAnnouncement] = useState({ title: "", message: "", audience: ["all"], priority: "normal", active: true });
  const { toast } = useToast();
  async function saveHelp(event) { event.preventDefault(); try { await saveHelpResource(helpForm, user); toast("Help resource saved."); setHelpOpen(false); } catch (error) { toast(error.message, { type: "error" }); } }
  async function addAnnouncement(event) { event.preventDefault(); try { await saveAnnouncement(announcement, user); toast("Announcement saved."); setAnnouncementOpen(false); } catch (error) { toast(error.message, { type: "error" }); } }
  return <div className="space-y-6"><PageHeader {...sectionMeta.content} actions={<>{tab === "help" && <Button onClick={() => setHelpOpen(true)}><Plus className="h-4 w-4" />Help resource</Button>}{tab === "announcements" && <Button onClick={() => setAnnouncementOpen(true)}><Plus className="h-4 w-4" />Announcement</Button>}</>} /><Tabs value={tab} onChange={setTab} tabs={[{ value: "waitlist", label: `Waitlist (${data.waitlist.length})` }, { value: "partnerships", label: `Partnerships (${data.partnerships.length})` }, { value: "help", label: `Help (${data.help.length})` }, { value: "announcements", label: `Announcements (${data.announcements.length})` }]} />{tab === "waitlist" && <SectionCard>{data.waitlist.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Person</th><th className="px-5 py-3">City</th><th className="px-5 py-3">Interests</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{data.waitlist.map((item) => <tr key={item.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.email} · {item.phone || "No phone"}</p></td><td className="px-5 py-4">{item.city || "Not provided"}</td><td className="px-5 py-4">{item.interests?.join(", ") || "General"}</td><td className="px-5 py-4"><StatusBadge status={item.status || "waiting"} /></td></tr>)}</tbody></table></div> : <EmptyState icon={UsersRound} title="No waitlist entries yet" description="The public coming-soon form writes audience preferences here." />}</SectionCard>}{tab === "partnerships" && <div className="grid gap-4 lg:grid-cols-2">{data.partnerships.map((lead) => <Card key={lead.id} className="p-5"><div className="flex items-start justify-between gap-3"><Handshake className="h-5 w-5 text-admin" /><StatusBadge status={lead.status || "new"} /></div><h3 className="mt-4 text-lg font-bold">{lead.organization}</h3><p className="mt-1 text-sm text-secondary">{lead.type?.replaceAll("_", " ")} · {lead.name} · {lead.email}</p><p className="mt-4 text-sm leading-6">{lead.message}</p><div className="mt-5 flex gap-2"><Button size="sm" onClick={() => updatePartnershipLead(lead.id, { status: "contacted" }, user)}>Mark contacted</Button><Button size="sm" variant="outline" onClick={() => updatePartnershipLead(lead.id, { status: "closed" }, user)}>Close</Button></div></Card>)}{!data.partnerships.length && <Card><EmptyState icon={Handshake} title="No partnership leads yet" description="Public partnership requests will be organized here by type and status." /></Card>}</div>}{tab === "help" && <div className="grid gap-4 lg:grid-cols-2">{data.help.map((item) => <Card key={item.id} className="p-5"><div className="flex items-start justify-between gap-3"><BookOpen className="h-5 w-5 text-admin" /><StatusBadge status={item.published ? "Published" : "Draft"} /></div><h3 className="mt-4 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{item.description}</p><div className="mt-4 flex flex-wrap gap-2"><Badge tone="neutral">{item.category}</Badge><Badge tone="neutral">{item.language}</Badge><Badge tone="neutral">{item.type}</Badge></div><div className="mt-5 flex gap-2"><Button size="sm" variant="outline" onClick={() => { setHelpForm(item); setHelpOpen(true); }}>Edit</Button><Button size="sm" variant="ghost" onClick={() => deleteHelpResource(item.id, user)}>Delete</Button></div></Card>)}{!data.help.length && <Card><EmptyState icon={BookOpen} title="No published help resources yet" description="Add guides or unlisted YouTube orientation videos. The public help center has intentional starter content until then." /></Card>}</div>}{tab === "announcements" && <div className="grid gap-4 lg:grid-cols-2">{data.announcements.map((item) => <Card key={item.id} className="p-5"><div className="flex items-start justify-between"><BellRing className="h-5 w-5 text-admin" /><StatusBadge status={item.active ? "Active" : "Inactive"} /></div><h3 className="mt-4 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{item.message}</p><p className="mt-4 text-xs font-semibold text-tertiary">Audience: {item.audience?.join(", ") || "all"} · {item.priority}</p></Card>)}{!data.announcements.length && <Card><EmptyState icon={BellRing} title="No announcements yet" description="Create targeted platform, business, customer, or administrator notices." /></Card>}</div>}<Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help resource"><form onSubmit={saveHelp} className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Title</span><input required value={helpForm.title} onChange={(event) => setHelpForm({ ...helpForm, title: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Description</span><textarea required value={helpForm.description} onChange={(event) => setHelpForm({ ...helpForm, description: event.target.value })} className="surface min-h-24 w-full rounded-xl p-4 outline-none" /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Type</span><select value={helpForm.type} onChange={(event) => setHelpForm({ ...helpForm, type: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="article">Article / guide</option><option value="video">YouTube video</option><option value="external">External resource</option></select></label><label><span className="mb-2 block text-sm font-semibold">Language</span><select value={helpForm.language} onChange={(event) => setHelpForm({ ...helpForm, language: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="en">English</option><option value="sn">ChiShona</option><option value="nd">isiNdebele</option><option value="all">All</option></select></label></div><label className="block"><span className="mb-2 block text-sm font-semibold">YouTube video ID</span><input value={helpForm.youtubeId || ""} onChange={(event) => setHelpForm({ ...helpForm, youtubeId: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="For unlisted YouTube videos" /></label><Button type="submit" className="w-full">Save resource</Button></form></Modal><Modal open={announcementOpen} onClose={() => setAnnouncementOpen(false)} title="Create announcement"><form onSubmit={addAnnouncement} className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Title</span><input required value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Message</span><textarea required value={announcement.message} onChange={(event) => setAnnouncement({ ...announcement, message: event.target.value })} className="surface min-h-28 w-full rounded-xl p-4 outline-none" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Priority</span><select value={announcement.priority} onChange={(event) => setAnnouncement({ ...announcement, priority: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label><Button type="submit" className="w-full">Publish announcement</Button></form></Modal></div>;
}

function Platform({ data, settings, setSettings, onSave, saving, user }) {
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();
  const launch = settings.launch || {};
  const verification = settings.verification || {};
  const updateLaunch = (values) => setSettings({ ...settings, launch: { ...launch, ...values } });
  const updateVerification = (values) => setSettings({ ...settings, verification: { ...verification, ...values } });
  async function seed() { if (!window.confirm(`Import or refresh ${seedSummary.listings} provisional listings, role templates, help resources, and platform defaults?`)) return; setSeeding(true); try { const result = await authenticatedFetch("/api/admin/seed", { method: "POST", body: JSON.stringify({ includeBusinesses: true }) }); toast(`${result.businesses} provisional listings and ${result.roles} role templates were added to the live platform.`, { title: "Seed complete" }); } catch (error) { toast(error.message, { type: "error", title: "Seed failed" }); } finally { setSeeding(false); } }
  return <div className="space-y-6"><PageHeader {...sectionMeta.platform} actions={<Button onClick={onSave} loading={saving}><Save className="h-4 w-4" />Save platform settings</Button>} /><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Launch mode" description="Every public customer release decision is admin-controlled"><div className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Public mode</span><select value={launch.publicMode || "coming-soon"} onChange={(event) => updateLaunch({ publicMode: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="coming-soon">Coming soon</option><option value="private-beta">Private beta landing</option><option value="marketplace">Public marketplace</option><option value="maintenance">Maintenance</option></select></label><label className="flex items-center justify-between rounded-xl bg-grouped p-4 text-sm font-semibold"><span>Marketplace enabled</span><input type="checkbox" checked={Boolean(launch.marketplaceEnabled)} onChange={(event) => updateLaunch({ marketplaceEnabled: event.target.checked })} /></label><label className="flex items-center justify-between rounded-xl bg-grouped p-4 text-sm font-semibold"><span>Private beta enabled</span><input type="checkbox" checked={launch.privateBetaEnabled !== false} onChange={(event) => updateLaunch({ privateBetaEnabled: event.target.checked })} /></label><div><p className="text-sm font-semibold">Languages</p><div className="mt-3 flex flex-wrap gap-2">{[["en", "English"], ["sn", "ChiShona"], ["nd", "isiNdebele"]].map(([code, label]) => <label key={code} className="flex items-center gap-2 rounded-xl bg-grouped p-3 text-sm font-semibold"><input type="checkbox" checked={launch.languages?.includes(code)} onChange={(event) => updateLaunch({ languages: event.target.checked ? [...(launch.languages || []), code] : (launch.languages || []).filter((item) => item !== code) })} />{label}</label>)}</div></div></div></SectionCard><SectionCard title="Verification policy"><div className="space-y-4 p-5"><label className="flex items-center justify-between rounded-xl bg-grouped p-4 text-sm font-semibold"><span>Publish unclaimed businesses</span><input type="checkbox" checked={verification.publishUnclaimed !== false} onChange={(event) => updateVerification({ publishUnclaimed: event.target.checked })} /></label><label className="flex items-center justify-between rounded-xl bg-grouped p-4 text-sm font-semibold"><span>Allow provisional public media</span><input type="checkbox" checked={verification.provisionalMediaEnabled !== false} onChange={(event) => updateVerification({ provisionalMediaEnabled: event.target.checked })} /></label><label className="flex items-center justify-between rounded-xl bg-grouped p-4 text-sm font-semibold"><span>Low-risk auto approval</span><input type="checkbox" checked={Boolean(verification.lowRiskAutoApproval)} onChange={(event) => updateVerification({ lowRiskAutoApproval: event.target.checked })} /></label><label className="flex items-center justify-between rounded-xl bg-grouped p-4 text-sm font-semibold"><span>Manual review required</span><input type="checkbox" checked={verification.manualReviewRequired !== false} onChange={(event) => updateVerification({ manualReviewRequired: event.target.checked })} /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Auto-approval risk threshold</span><input type="number" min="0" max="100" value={verification.autoApprovalThreshold ?? 15} onChange={(event) => updateVerification({ autoApprovalThreshold: Number(event.target.value) })} className="surface h-12 w-full rounded-xl px-4 outline-none" /><span className="mt-2 block text-xs leading-5 text-tertiary">Lower values are stricter. Existing provisional listings currently enter review with a low-risk score of 10; owner-created businesses remain in manual review.</span></label><p className="text-xs leading-5 text-tertiary">When enabled and manual review is disabled, the secure claim route can approve an unclaimed low-risk listing only for an owner or franchisee who supplies evidence. Every decision is logged and can be reviewed later.</p></div></SectionCard><SectionCard title="Zimbabwe business seed" description="Provisional listings are searchable before owners claim them"><div className="p-5"><div className="grid grid-cols-3 gap-3"><div className="rounded-xl bg-grouped p-4"><p className="text-2xl font-black">{seedSummary.brands}</p><p className="mt-1 text-xs text-secondary">researched brands</p></div><div className="rounded-xl bg-grouped p-4"><p className="text-2xl font-black">{seedSummary.listings}</p><p className="mt-1 text-xs text-secondary">provisional listings</p></div><div className="rounded-xl bg-grouped p-4"><p className="text-2xl font-black">{seedSummary.cities.length}</p><p className="mt-1 text-xs text-secondary">cities represented</p></div></div><p className="mt-4 text-xs leading-5 text-secondary">{seedSummary.disclaimer}</p><Button onClick={seed} loading={seeding} className="mt-5 w-full"><Database className="h-4 w-4" />Import or refresh seed data</Button></div></SectionCard><SectionCard title="Environment readiness"><div className="space-y-3 p-5">{[
    ["Firebase web project", true, "Configured for denzeltinashe-spotly"],
    ["Vercel deployment", true, "Next.js route handlers supported"],
    ["Paynow credentials", false, "Add secure server environment variables"],
    ["Resend credentials", false, "Add RESEND_API_KEY and verified sender"],
    ["Apple authentication", false, "Configure Apple provider and callback"],
    ["Push notifications", false, "Add VAPID key and service worker"],
    ["Production rules", false, "Replace open test rules before release"]
  ].map(([label, done, note]) => <div key={label} className="flex items-start gap-3 rounded-xl bg-grouped p-3"><span className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg ${done ? "bg-emerald-50 text-success" : "bg-amber-50 text-warning"}`}>{done ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</span><div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-secondary">{note}</p></div></div>)}</div></SectionCard></div></div>;
}

function Audit({ logs }) {
  const [queryText, setQueryText] = useState("");
  const visible = logs.filter((item) => [item.action, item.entityType, item.entityId, item.actorEmail].join(" ").toLowerCase().includes(queryText.toLowerCase()));
  return <div className="space-y-6"><PageHeader {...sectionMeta.audit} /><SearchField value={queryText} onChange={setQueryText} placeholder="Search action, entity, ID, or actor" /><SectionCard>{visible.length ? <div>{visible.map((item) => <div key={item.id} className="flex gap-4 border-b p-5 last:border-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-admin-soft text-admin"><ClipboardList className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.action}</p><Badge tone="neutral">{item.entityType}</Badge></div><p className="mt-2 text-sm text-secondary">{item.entityId}</p><p className="mt-2 text-xs text-tertiary">Actor: {item.actorEmail || item.actorId || "System"}</p>{item.metadata && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-admin">View metadata</summary><pre className="mt-2 overflow-x-auto rounded-xl bg-grouped p-3 text-[11px]">{JSON.stringify(item.metadata, null, 2)}</pre></details>}</div></div>)}</div> : <EmptyState icon={ClipboardList} title="No matching audit entries" description="Adjust the search or complete an action that records an audit event." />}</SectionCard></div>;
}

function AdminSettings({ data, settings, setSettings, onSave, saving, user }) {
  const [tab, setTab] = useState("support"); const [installing, setInstalling] = useState(false); const { toast } = useToast();
  async function installRoles() { setInstalling(true); try { for (const role of defaultRoles) await saveRoleTemplate(role, user); toast("Default role templates installed.", { title: "Access model ready" }); } catch (error) { toast(error.message, { type: "error" }); } finally { setInstalling(false); } }
  const support = settings.support || {}; const integrations = settings.integrations || {}; const legal = settings.legal || {};
  const update = (section, values) => setSettings({ ...settings, [section]: { ...(settings[section] || {}), ...values } });
  return <div className="space-y-6"><PageHeader {...sectionMeta.settings} actions={<Button onClick={onSave} loading={saving}><Save className="h-4 w-4" />Save settings</Button>} /><Tabs value={tab} onChange={setTab} tabs={[{ value: "support", label: "Support" }, { value: "integrations", label: "Integrations" }, { value: "legal", label: "Legal" }, { value: "roles", label: `Roles (${data.roles.length})` }]} />{tab === "support" && <div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Public support details"><div className="space-y-4 p-5">{[["email", "Support email"], ["phone", "Support phone"], ["whatsapp", "WhatsApp"], ["hours", "Support hours"]].map(([key, label]) => <label key={key} className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><input value={support[key] || ""} onChange={(event) => update("support", { [key]: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="Administration will be prompted until configured" /></label>)}<label className="block"><span className="mb-2 block text-sm font-semibold">Target first response (minutes)</span><input type="number" min="1" value={support.responseTargetMinutes || 30} onChange={(event) => update("support", { responseTargetMinutes: Number(event.target.value) })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label></div></SectionCard><SectionCard title="Live chat policy"><div className="space-y-4 p-5"><label className="flex items-center justify-between rounded-xl bg-grouped p-4 text-sm font-semibold"><span>Live chat enabled</span><input type="checkbox" checked={support.liveChatEnabled !== false} onChange={(event) => update("support", { liveChatEnabled: event.target.checked })} /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Audience</span><select value={support.audience || "everyone"} onChange={(event) => update("support", { audience: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="everyone">Everyone, including visitors</option><option value="signed_in">Signed-in users</option><option value="business">Businesses only</option></select></label><p className="text-sm leading-6 text-secondary">The admin support desk supports assignment, statuses, priorities, internal notes, conversation history, and business/customer context.</p></div></SectionCard></div>}{tab === "integrations" && <div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Provider switches"><div className="space-y-3 p-5">{[["paynowEnabled", "Paynow"], ["emailEnabled", "Transactional email"], ["pushEnabled", "Push notifications"], ["appleAuthEnabled", "Apple sign-in linking"], ["phoneAuthEnabled", "Phone linking"]].map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-xl bg-grouped p-4 text-sm font-semibold"><span>{label}</span><input type="checkbox" checked={Boolean(integrations[key])} onChange={(event) => update("integrations", { [key]: event.target.checked })} /></label>)}</div></SectionCard><SectionCard title="Credential policy"><div className="p-5"><ShieldCheck className="h-6 w-6 text-success" /><h3 className="mt-4 font-bold">Secrets stay in Vercel</h3><p className="mt-2 text-sm leading-6 text-secondary">Paynow integration IDs and keys, Resend API keys, Firebase Admin credentials, Apple secrets, and private webhook verification values must be stored as encrypted Vercel environment variables. This dashboard controls behavior and readiness, not secret values.</p><div className="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">Do not store passwords, private keys, or full payment credentials in Firestore platform settings.</div></div></SectionCard></div>}{tab === "legal" && <div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Entity details"><div className="space-y-4 p-5">{[["legalName", "Legal business name"], ["tradingName", "Trading name"], ["registeredAddress", "Registered address"], ["companyNumber", "Company registration number"], ["taxNumber", "ZIMRA / TIN"]].map(([key, label]) => <label key={key} className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><input value={legal[key] || ""} onChange={(event) => update("legal", { [key]: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="Ready to configure" /></label>)}</div></SectionCard><SectionCard title="Legal contacts and documents"><div className="space-y-4 p-5">{[["privacyEmail", "Privacy contact email"], ["termsEmail", "Terms contact email"]].map(([key, label]) => <label key={key} className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><input value={legal[key] || ""} onChange={(event) => update("legal", { [key]: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="Ready to configure" /></label>)}<div className="rounded-xl bg-grouped p-4"><p className="text-sm font-semibold">Documents to prepare</p><ul className="mt-3 space-y-2 text-sm text-secondary"><li>Privacy policy</li><li>Terms of service</li><li>Merchant agreement</li><li>Refund and cancellation policy</li><li>Acceptable use policy</li><li>Data-processing terms</li></ul></div></div></SectionCard></div>}{tab === "roles" && <div className="space-y-5"><div className="flex justify-end"><Button onClick={installRoles} loading={installing}><KeyRound className="h-4 w-4" />Install default roles</Button></div><div className="grid gap-4 lg:grid-cols-2">{(data.roles.length ? data.roles : defaultRoles).map((role) => <Card key={role.id} className="p-5"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-admin-soft text-admin"><UserCog className="h-5 w-5" /></span><Badge tone="neutral">Level {role.level}</Badge></div><h3 className="mt-4 text-lg font-bold">{role.name}</h3><p className="mt-2 text-sm leading-6 text-secondary">{role.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{role.permissions.slice(0, 6).map((permission) => <Badge key={permission} tone="neutral">{permission}</Badge>)}{role.permissions.length > 6 && <Badge tone="neutral">+{role.permissions.length - 6}</Badge>}</div></Card>)}</div></div>}</div>;
}

function DriverDormant() {
  return <div className="space-y-6"><PageHeader {...sectionMeta.drivers} /><Card className="p-8"><EmptyState icon={Flag} title="Driver operations are intentionally dormant" description="The current release is centered on grocery pickup. Driver architecture remains available for a future delivery phase without becoming a launch dependency." action={<Button asChild variant="outline"><Link href="/admin/platform">Review release configuration</Link></Button>} /></Card></div>;
}

export function AdminApp({ section = "dashboard" }) {
  const safe = sectionMeta[section] ? section : "dashboard";
  const { user, profile } = useAuth();
  const { settings: liveSettings } = usePlatform();
  const [settings, setSettings] = useState(liveSettings || DEFAULT_PLATFORM_SETTINGS);
  const [saving, setSaving] = useState(false);
  const data = useAdminData();
  const { toast } = useToast();
  useEffect(() => setSettings(liveSettings || DEFAULT_PLATFORM_SETTINGS), [liveSettings]);
  async function saveSettings() { setSaving(true); try { await savePlatformSettings(settings, user); toast("Platform configuration saved.", { title: "Settings updated" }); } catch (error) { toast(error.message, { type: "error", title: "Could not save settings" }); } finally { setSaving(false); } }
  const allowedSection = canAccessAdminSection(profile, safe);
  return <AuthGate portal="admin" title="Sign in to Spotly Admin"><AdminAccess><PortalShell portalId="admin" activeSection={safe}><div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{!allowedSection && <Card className="p-8"><EmptyState icon={LockKeyhole} title="This section is outside your administrator access" description="Your assigned role does not include this area. Ask a super administrator to adjust your role or custom permissions when this work is part of your responsibilities." action={<Button asChild variant="outline"><Link href="/admin">Return to dashboard</Link></Button>} /></Card>}{allowedSection && safe === "dashboard" && <Dashboard data={data} />}{allowedSection && safe === "operations" && <Operations data={data} user={user} />}{allowedSection && safe === "organizations" && <AdminOrganizationGovernance businesses={data.businesses} claims={data.claims} tasks={data.tasks} />}{allowedSection && safe === "businesses" && <Businesses data={data} user={user} />}{allowedSection && safe === "people" && <AdminPeopleOperations />}{allowedSection && safe === "drivers" && <DriverDormant />}{allowedSection && safe === "customers" && <People data={data} user={user} />}{allowedSection && safe === "finance" && <div className="space-y-6"><CommerceSettings settings={settings} onChange={setSettings} onSave={saveSettings} loading={saving} /><PayoutAdminQueue payouts={data.payouts} businesses={data.businesses} user={user} /></div>}{allowedSection && safe === "content" && <Content data={data} user={user} />}{allowedSection && safe === "platform-map" && <PlatformMap businessCount={data.businesses.length} userCount={data.users.length} taskCount={data.tasks.filter((item) => !["completed", "cancelled"].includes(item.status)).length} />}{allowedSection && safe === "platform" && <Platform data={data} settings={settings} setSettings={setSettings} onSave={saveSettings} saving={saving} user={user} />}{allowedSection && safe === "audit" && <Audit logs={data.audit} />}{allowedSection && safe === "settings" && <AdminSettings data={data} settings={settings} setSettings={setSettings} onSave={saveSettings} saving={saving} user={user} />}</div></PortalShell></AdminAccess></AuthGate>;
}
