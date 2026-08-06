"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Laptop,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Badge, Button, Card, EmptyState, MetricCard, PageHeader, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { staffDisplayName } from "@/data/staff";
import {
  subscribeCandidates,
  subscribeLeaveRequests,
  subscribePayrollRecords,
  subscribeStaffAssets,
  subscribeStaffDirectory,
  subscribeStaffShifts,
  subscribeTrainingAssignments,
  subscribeWorkforceRequests
} from "@/lib/staff-services";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-ZW", { day: "numeric", month: "short", year: "numeric" }).format(date) : "Not set";
}

function usePeopleData() {
  const [staff, setStaff] = useState([]);
  const [requests, setRequests] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leave, setLeave] = useState([]);
  const [training, setTraining] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let settled = false;
    const mark = () => { if (!settled) { settled = true; setReady(true); } };
    const onError = (reason) => { setError(reason?.message || "Some people operations information could not be loaded."); mark(); };
    const cleanups = [
      subscribeStaffDirectory((items) => { setStaff(items); mark(); }, onError),
      subscribeWorkforceRequests(setRequests, onError),
      subscribeCandidates(setCandidates, onError),
      subscribeStaffShifts(setShifts, { onError }),
      subscribeLeaveRequests(setLeave, { onError }),
      subscribeTrainingAssignments(setTraining, { onError }),
      subscribePayrollRecords(setPayroll, { onError }),
      subscribeStaffAssets(setAssets, { onError })
    ];
    const timeout = window.setTimeout(mark, 1600);
    return () => { window.clearTimeout(timeout); cleanups.forEach((cleanup) => cleanup?.()); };
  }, []);

  return { staff, requests, candidates, shifts, leave, training, payroll, assets, error, ready };
}

function Overview({ data }) {
  const active = data.staff.filter((person) => ["active", "probation"].includes(person.status)).length;
  const preboarding = data.staff.filter((person) => person.status === "preboarding").length;
  const leavePending = data.leave.filter((item) => item.status === "pending").length;
  const payrollPending = data.payroll.filter((item) => !["paid", "published"].includes(item.status)).length;
  const compliance = [
    { title: "Employer registration", status: "needs review", detail: "Record effective dates and supporting evidence." },
    { title: "PAYE configuration", status: "needs review", detail: "Version tax tables and payroll rules by effective date." },
    { title: "NSSA registration", status: "needs review", detail: "Store employer registration and contribution setup." },
    { title: "NEC classification", status: "needs review", detail: "Assign configurable sector rule packs." },
    { title: "Data protection", status: "configured", detail: "Purpose, access, retention, export, and deletion controls." }
  ];
  return <div className="space-y-6"><div className="metric-grid"><MetricCard label="Active workforce" value={String(active)} hint={`${preboarding} in preboarding`} icon={UsersRound} /><MetricCard label="Open vacancies" value={String(data.requests.filter((item) => ["approved", "open", "recruiting"].includes(item.status)).length)} hint={`${data.candidates.length} candidates`} icon={BriefcaseBusiness} /><MetricCard label="Leave decisions" value={String(leavePending)} hint="Awaiting manager action" icon={CalendarDays} tone={leavePending ? "warning" : "success"} /><MetricCard label="Payroll exceptions" value={String(payrollPending)} hint="Prepared but not complete" icon={WalletCards} tone={payrollPending ? "warning" : "success"} /></div><div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]"><SectionCard title="People operations attention" description="The current administrative queues"><div className="p-5"><div className="space-y-3">{[
    { icon: UserPlus, title: `${data.requests.filter((item) => item.status === "submitted").length} workforce requests need approval`, href: "/staff/hiring" },
    { icon: UserCheck, title: `${data.staff.filter((item) => item.status === "preboarding").length} people are preparing to start`, href: "/staff/team" },
    { icon: CalendarDays, title: `${leavePending} leave requests need a decision`, href: "/staff/leave" },
    { icon: GraduationCap, title: `${data.training.filter((item) => !["completed", "passed"].includes(item.status)).length} learning assignments are incomplete`, href: "/staff/learning" },
    { icon: Laptop, title: `${data.assets.filter((item) => ["damaged", "return_due"].includes(item.status)).length} asset exceptions need review`, href: "/staff/assets" }
  ].map(({ icon: Icon, title, href }) => <Link key={title} href={href} className="flex items-center gap-3 rounded-xl bg-grouped p-4 hover:bg-admin-soft"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-admin-soft text-admin"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1 text-sm font-semibold">{title}</span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div></div></SectionCard><SectionCard title="Zimbabwe employer setup" description="Configuration status, not a legal-compliance claim"><div>{compliance.map((item) => <div key={item.title} className="flex gap-3 border-b p-4 last:border-b-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-admin-soft text-admin">{item.status === "configured" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><StatusBadge status={item.status} /></div><p className="mt-1 text-xs leading-5 text-secondary">{item.detail}</p></div></div>)}</div></SectionCard></div></div>;
}

function Directory({ data }) {
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState("active");
  const visible = data.staff.filter((person) => {
    const text = [person.displayName, person.email, person.roleTitle, person.department, person.employeeNumber].filter(Boolean).join(" ").toLowerCase();
    const matchesStatus = status === "all" || person.status === status || (status === "active" && ["active", "probation"].includes(person.status));
    return matchesStatus && text.includes(queryText.toLowerCase());
  });
  return <div className="space-y-5">
    <div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search name, department, role, or employee number" /><Tabs value={status} onChange={setStatus} tabs={[{ value: "active", label: "Active" }, { value: "preboarding", label: "Preboarding" }, { value: "offboarding", label: "Offboarding" }, { value: "all", label: "All" }]} /></div>
    <SectionCard>{visible.length ? <>
      <div className="space-y-3 p-3 lg:hidden">{visible.map((person) => <article key={person.id} className="rounded-xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{staffDisplayName(person)}</h3><p className="mt-1 text-xs text-secondary">{person.email || person.employeeNumber || "Contact not set"}</p></div><StatusBadge status={person.status || "active"} /></div><p className="mt-4 text-sm font-semibold">{person.roleTitle || "Role not assigned"}</p><p className="mt-1 text-xs text-secondary">{person.department || "Department not assigned"} · {person.employmentType || "Employment type not set"}</p><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><p className="text-tertiary">Manager</p><p className="mt-1 font-semibold">{person.managerName || (person.managerId ? "Assigned" : "Not assigned")}</p></div><div><p className="text-tertiary">Start date</p><p className="mt-1 font-semibold">{dateLabel(person.startDate)}</p></div></div><Button asChild className="mt-4 w-full" size="sm" variant="outline"><Link href="/staff/team">Open staff record</Link></Button></article>)}</div>
      <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Role and department</th><th className="px-5 py-3">Employment</th><th className="px-5 py-3">Manager</th><th className="px-5 py-3">Start date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((person) => <tr key={person.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold">{staffDisplayName(person)}</p><p className="mt-1 text-xs text-secondary">{person.email || person.employeeNumber || "Contact not set"}</p></td><td className="px-5 py-4"><p className="font-semibold">{person.roleTitle || "Role not assigned"}</p><p className="mt-1 text-xs text-secondary">{person.department || "Department not assigned"}</p></td><td className="px-5 py-4">{person.employmentType || "Not set"}</td><td className="px-5 py-4">{person.managerName || (person.managerId ? "Assigned" : "Not assigned")}</td><td className="px-5 py-4">{dateLabel(person.startDate)}</td><td className="px-5 py-4"><StatusBadge status={person.status || "active"} /></td><td className="px-5 py-4"><Button asChild size="sm" variant="outline"><Link href="/staff/team">Open record</Link></Button></td></tr>)}</tbody></table></div>
    </> : <EmptyState icon={UsersRound} title="No people match this view" description="The shared Spotly workforce directory will appear here after employment records are created." action={<Button asChild variant="outline"><Link href="/staff/team">Open staff workspace</Link></Button>} />}</SectionCard>
  </div>;
}

function Recruitment({ data }) {
  const stages = ["applied", "screening", "interview", "reference_check", "offer", "preboarding"];
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3">{stages.map((stage) => <Card key={stage} className="p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-tertiary">{stage.replaceAll("_", " ")}</p><p className="mt-3 text-3xl font-bold">{data.candidates.filter((candidate) => (candidate.status || "applied") === stage).length}</p></Card>)}</div><SectionCard title="Workforce requests"><div>{data.requests.map((request) => <div key={request.id} className="flex flex-col gap-3 border-b p-5 last:border-b-0 sm:flex-row sm:items-center"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-admin-soft text-admin"><BriefcaseBusiness className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{request.roleTitle || "Requested position"}</p><p className="mt-1 text-sm text-secondary">{request.department || "Department not set"} · {request.employmentType || "Employment type not set"}</p><p className="mt-1 text-xs text-tertiary">{request.reason || "Reason not documented"}</p></div><StatusBadge status={request.status || "draft"} /></div>)}{!data.requests.length && <EmptyState icon={UserPlus} title="No workforce requests" description="Approved headcount requests, vacancies, candidates, interviews, offers, and preboarding will be managed through the shared staff system." action={<Button asChild variant="outline"><Link href="/staff/hiring">Open hiring workspace</Link></Button>} />}</div></SectionCard></div>;
}

function Administration({ data }) {
  const [tab, setTab] = useState("attendance");
  const tabs = [{ value: "attendance", label: "Attendance" }, { value: "leave", label: "Leave" }, { value: "payroll", label: "Payroll" }, { value: "assets", label: "Assets" }, { value: "learning", label: "Learning" }];
  const sources = { attendance: data.shifts, leave: data.leave, payroll: data.payroll, assets: data.assets, learning: data.training };
  const items = sources[tab] || [];
  return <div className="space-y-5"><Tabs value={tab} onChange={setTab} tabs={tabs} /><SectionCard title={`${tabs.find((item) => item.value === tab)?.label} register`} description="Sensitive sections remain limited to authorized administrators"><div>{items.slice(0, 100).map((item) => <div key={item.id} className="flex items-center gap-3 border-b p-5 last:border-b-0"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-admin-soft text-admin">{tab === "attendance" ? <CalendarDays className="h-5 w-5" /> : tab === "leave" ? <ClipboardCheck className="h-5 w-5" /> : tab === "payroll" ? <WalletCards className="h-5 w-5" /> : tab === "assets" ? <Laptop className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="font-semibold">{item.employeeName || item.assignedToName || item.title || item.userEmail || item.userId || item.id}</p><p className="mt-1 text-sm text-secondary">{tab === "attendance" ? `${item.date || dateLabel(item.startAt)} · ${item.location || item.workArrangement || "Location not set"}` : tab === "leave" ? `${item.type || "Leave"} · ${dateLabel(item.startDate)}–${dateLabel(item.endDate)}` : tab === "payroll" ? `${dateLabel(item.periodStart)}–${dateLabel(item.periodEnd)} · ${item.currency || "USD"}` : tab === "assets" ? `${item.type || "Asset"} · ${item.assetNumber || item.serialNumber || "Identifier not set"}` : item.description || "Assigned learning"}</p></div><StatusBadge status={item.status || "recorded"} /></div>)}{!items.length && <EmptyState icon={FileText} title={`No ${tab} records`} description="Records will populate from the shared workforce services when this process begins." />}</div></SectionCard></div>;
}

export function AdminPeopleOperations() {
  const data = usePeopleData();
  const [tab, setTab] = useState("overview");
  const tabs = useMemo(() => [
    { value: "overview", label: "Overview" },
    { value: "directory", label: `Directory (${data.staff.length})` },
    { value: "recruitment", label: `Recruitment (${data.candidates.length})` },
    { value: "administration", label: "Workforce administration" }
  ], [data.staff.length, data.candidates.length]);
  return <div className="space-y-6"><PageHeader title="People operations" description="Spotly employees, contractors, hiring, onboarding, schedules, leave, payroll preparation, training, assets, performance, support, and exits." actions={<div className="flex gap-2"><Badge tone={data.ready ? "success" : "warning"}>{data.ready ? "Live workforce data" : "Loading"}</Badge><Button asChild><Link href="/staff">Open staff workspace<ArrowRight className="h-4 w-4" /></Link></Button></div>} /><div className="rounded-2xl border bg-admin-soft p-4 text-sm leading-6 text-admin"><strong>Employment relationship matters.</strong> This area is for Spotly’s internal workforce. Merchant employees remain in <strong>Spotly Business → Team</strong>, while drivers remain in <strong>Spotly Driver</strong>.</div><Tabs value={tab} onChange={setTab} tabs={tabs} />{tab === "overview" && <Overview data={data} />}{tab === "directory" && <Directory data={data} />}{tab === "recruitment" && <Recruitment data={data} />}{tab === "administration" && <Administration data={data} />}{data.error && <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mr-2 inline h-4 w-4" />{data.error}</Card>}<SectionCard title="People controls" description="High-risk workforce actions are complete workflows"><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">{[
    [ShieldCheck, "Access and role packs", "Employment → role pack → permissions → scope → limits"],
    [UserCheck, "Onboarding and exits", "Accounts, learning, equipment, ownership transfer, and revocation"],
    [WalletCards, "Payroll preparation", "USD and ZiG records, allowances, deductions, approvals, and exports"],
    [FileText, "Audit and retention", "Purpose, access limits, retention, export, deletion, and evidence"]
  ].map(([Icon, title, description]) => <Card key={title} className="bg-grouped p-4"><Icon className="h-5 w-5 text-admin" /><p className="mt-3 font-semibold">{title}</p><p className="mt-2 text-xs leading-5 text-secondary">{description}</p></Card>)}</div></SectionCard></div>;
}
