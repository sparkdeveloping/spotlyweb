"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  HandHeart,
  Headphones,
  HeartHandshake,
  IdCard,
  Laptop,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LockKeyhole,
  MessageCircleMore,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  ShieldCheck,
  Store,
  Target,
  UserCheck,
  UserPlus,
  UserRound,
  UsersRound,
  WalletCards
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  ProgressBar,
  SearchField,
  SectionCard,
  StatusBadge,
  Tabs
} from "@/components/ui";
import {
  LEAVE_TYPES,
  STAFF_DEPARTMENTS,
  STAFF_EMPLOYMENT_TYPES,
  STAFF_ROLE_PACKS,
  hasStaffAccess,
  isPeopleAdministrator,
  isPeopleManager,
  rolePackFor,
  staffDisplayName
} from "@/data/staff";
import {
  clockStaffShift,
  decideLeaveRequest,
  saveCandidate,
  saveLeaveRequest,
  saveStaffAsset,
  saveStaffProfile,
  saveStaffSupportRequest,
  saveStaffTask,
  saveStaffShift,
  saveTrainingAssignment,
  saveWorkforceRequest,
  subscribeCandidates,
  subscribeLeaveRequests,
  subscribePayrollRecords,
  subscribePerformanceRecords,
  subscribeStaffAssets,
  subscribeStaffDirectory,
  subscribeStaffProfile,
  subscribeStaffShifts,
  subscribeStaffSupportRequests,
  subscribeStaffTasks,
  subscribeTrainingAssignments,
  subscribeWorkforceRequests,
  updateStaffTask
} from "@/lib/staff-services";

const sectionMeta = {
  today: { title: "Today", description: "Your shift, assigned work, approvals, and the next useful action." },
  work: { title: "My work", description: "Assigned tasks and operating queues, ordered by urgency." },
  team: { title: "Team", description: "Spotly employees, contractors, managers, roles, and employment status." },
  hiring: { title: "Hiring", description: "Workforce requests, applicants, interviews, offers, and preboarding." },
  schedule: { title: "Schedule", description: "Shifts, attendance, clock events, and coverage." },
  leave: { title: "Leave", description: "Balances, requests, approvals, and team coverage." },
  learning: { title: "Learning", description: "Role-based onboarding, required training, assessments, and renewals." },
  performance: { title: "Performance", description: "Goals, check-ins, probation, development, and coaching." },
  pay: { title: "Pay", description: "Pay records, allowances, reimbursements, payslips, and payroll status." },
  assets: { title: "Assets", description: "Equipment issued to Spotly staff and its return condition." },
  help: { title: "Help & support", description: "People support, technical help, confidential concerns, and incidents." },
  profile: { title: "Profile", description: "Employment, role, access, documents, contacts, and account details." }
};

const inputClass = "surface h-12 w-full rounded-xl px-4 outline-none focus:ring-2 focus:ring-[var(--accent)]/20";
const textareaClass = "surface min-h-28 w-full rounded-xl p-4 outline-none focus:ring-2 focus:ring-[var(--accent)]/20";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateLabel(value, fallback = "Not scheduled") {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-ZW", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function timeLabel(value, fallback = "") {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-ZW", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function currencyLabel(value, currency = "USD") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-ZW", { style: "currency", currency: currency === "ZWG" ? "ZWG" : "USD", maximumFractionDigits: 2 }).format(amount);
}

function sortByDate(items, field = "createdAt") {
  return [...items].sort((a, b) => (toDate(b[field])?.getTime() || 0) - (toDate(a[field])?.getTime() || 0));
}

function staffNavigation(manager) {
  const items = [
    { id: "today", label: "Today", icon: LayoutDashboard, href: "/staff" },
    { id: "work", label: "My work", icon: ListChecks, href: "/staff/work" }
  ];
  if (manager) {
    items.push({ id: "team", label: "Team", icon: UsersRound, href: "/staff/team" });
    items.push({ id: "hiring", label: "Hiring", icon: UserPlus, href: "/staff/hiring" });
  }
  items.push(
    { id: "schedule", label: "Schedule", icon: CalendarDays, href: "/staff/schedule" },
    { id: "leave", label: "Leave", icon: HandHeart, href: "/staff/leave" },
    { id: "learning", label: "Learning", icon: GraduationCap, href: "/staff/learning" },
    { id: "performance", label: "Performance", icon: Target, href: "/staff/performance" },
    { id: "pay", label: "Pay", icon: WalletCards, href: "/staff/pay" },
    { id: "assets", label: "Assets", icon: Laptop, href: "/staff/assets" },
    { id: "help", label: "Help & support", icon: LifeBuoy, href: "/staff/help" },
    { id: "profile", label: "Profile", icon: UserRound, href: "/staff/profile" }
  );
  return items;
}

function useStaffData() {
  const { user, profile } = useAuth();
  const [staffProfile, setStaffProfile] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leave, setLeave] = useState([]);
  const [training, setTraining] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [assets, setAssets] = useState([]);
  const [workforceRequests, setWorkforceRequests] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [supportRequests, setSupportRequests] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const manager = isPeopleManager(profile, staffProfile);
  const peopleAdministrator = isPeopleAdministrator(profile, staffProfile);

  useEffect(() => {
    if (!user?.uid) return undefined;
    setReady(false);
    setError("");
    let settled = false;
    const markReady = () => {
      if (!settled) {
        settled = true;
        setReady(true);
      }
    };
    const onError = (reason) => {
      setError(reason?.message || "Some workforce information could not be loaded.");
      markReady();
    };
    const personal = manager ? {} : { userId: user.uid };
    const cleanups = [
      subscribeStaffProfile(user.uid, (value) => { setStaffProfile(value); markReady(); }, onError),
      subscribeStaffTasks(setTasks, { assigneeId: manager ? undefined : user.uid, onError }),
      subscribeStaffShifts(setShifts, { ...personal, onError }),
      subscribeLeaveRequests(setLeave, { ...personal, onError }),
      subscribeTrainingAssignments(setTraining, { ...personal, onError }),
      subscribePerformanceRecords(setPerformance, { ...personal, onError }),
      subscribePayrollRecords(setPayroll, { ...personal, onError }),
      subscribeStaffAssets(setAssets, { userId: manager ? undefined : user.uid, onError }),
      subscribeStaffSupportRequests(setSupportRequests, { ...personal, onError })
    ];
    if (manager) {
      cleanups.push(subscribeStaffDirectory(setDirectory, onError));
      cleanups.push(subscribeWorkforceRequests(setWorkforceRequests, onError));
      cleanups.push(subscribeCandidates(setCandidates, onError));
    }
    const timeout = window.setTimeout(markReady, 1600);
    return () => {
      window.clearTimeout(timeout);
      cleanups.forEach((cleanup) => cleanup?.());
    };
  }, [user?.uid, manager]);

  return {
    user,
    profile,
    staffProfile,
    directory,
    tasks,
    shifts,
    leave,
    training,
    performance,
    payroll,
    assets,
    workforceRequests,
    candidates,
    supportRequests,
    ready,
    error,
    manager,
    peopleAdministrator,
    rolePack: rolePackFor(profile, staffProfile)
  };
}

function StaffAccess({ data, children }) {
  const allowed = hasStaffAccess(data.profile, data.staffProfile);
  if (allowed) return children;
  const reference = data.user?.uid ? data.user.uid.slice(0, 8).toUpperCase() : "NOT-AVAILABLE";

  return <main className="flex min-h-screen items-center justify-center bg-grouped px-4 py-10"><Card elevated className="w-full max-w-xl p-7 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><LockKeyhole className="h-7 w-7" /></span><h1 className="mt-5 text-2xl font-semibold">Your staff profile is not ready</h1><p className="mt-3 text-sm leading-6 text-secondary">Spotly Staff is available to employees, contractors, interns, and approved internal operators. People Operations must finish linking your employment profile before you can continue.</p><div className="mt-5 rounded-xl bg-grouped p-4 text-left text-sm leading-6"><p className="font-semibold">Signed in as</p><p className="text-secondary">{data.user?.displayName || data.user?.email}</p><p className="mt-3 font-semibold">Reference</p><p className="font-mono text-secondary">{reference}</p></div><div className="mt-6 grid gap-2 sm:grid-cols-2"><Button asChild><Link href={`/support?subject=${encodeURIComponent("Staff profile not ready")}`}>Contact People Operations</Link></Button><Button asChild variant="outline"><Link href="/account">Return to account</Link></Button></div></Card></main>;
}

function SectionIntro({ section, actions }) {
  return <PageHeader {...sectionMeta[section]} actions={actions} />;
}

function roleQueue(packId) {
  const queues = {
    support_agent: { title: "Customer and business conversations", description: "Respond, assign, escalate, add internal notes, and close resolved support work.", href: "/admin/operations", icon: Headphones },
    verification_officer: { title: "Business verification queue", description: "Review ownership evidence, parent-company relationships, risk, and publication readiness.", href: "/admin/operations", icon: ShieldCheck },
    business_success_manager: { title: "Business readiness queue", description: "Guide businesses through setup, catalogue readiness, parent approvals, and launch.", href: "/admin/businesses", icon: Store },
    finance_admin: { title: "Payment and payout exceptions", description: "Review settlements, reconciliation, refunds, payout holds, and finance tasks.", href: "/admin/finance", icon: WalletCards },
    operations_manager: { title: "Platform operations control", description: "Review claims, support, launch readiness, incidents, staffing coverage, and escalations.", href: "/admin/operations", icon: ClipboardList },
    regional_operations_manager: { title: "Regional operations", description: "Review assigned cities or provinces, business readiness, service issues, and team coverage.", href: "/admin/operations", icon: MapPin },
    driver_operations_coordinator: { title: "Driver and fleet operations", description: "Review onboarding, document compliance, availability, incidents, and field support.", href: "/admin/drivers", icon: PackageCheck },
    people_operations_admin: { title: "People operations", description: "Run hiring, onboarding, leave, payroll preparation, training, assets, and offboarding.", href: "/admin/people", icon: UsersRound },
    platform_admin: { title: "Platform control centre", description: "Operate configuration, access, diagnostics, audit, incidents, and cross-functional queues.", href: "/admin", icon: ShieldCheck },
    content_editor: { title: "Content operations", description: "Manage help resources, announcements, training content, public pages, and translations.", href: "/admin/content", icon: BookOpenCheck }
  };
  return queues[packId] || { title: "Assigned Spotly work", description: "Open the operating queue associated with your role and current assignments.", href: "/staff/work", icon: ListChecks };
}

function TaskRow({ task, user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  async function complete() {
    setLoading(true);
    try {
      await updateStaffTask(task.id, { status: "completed", completedAt: new Date().toISOString() }, user);
      toast("The task was marked complete.", { title: "Work updated" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not update task" });
    } finally {
      setLoading(false);
    }
  }
  return <div className="flex flex-col gap-3 border-b p-4 last:border-b-0 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><ClipboardCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{task.title || "Assigned work"}</p><StatusBadge status={task.status || "open"} />{task.priority && <Badge tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"}>{task.priority}</Badge>}</div><p className="mt-1 text-sm leading-6 text-secondary">{task.description || task.queue || "Open the task for its full operating context."}</p><p className="mt-1 text-xs text-tertiary">{task.department || "Spotly"}{task.dueDate ? ` · Due ${dateLabel(task.dueDate)}` : ""}</p></div>{!['completed', 'cancelled'].includes(task.status) && <Button size="sm" variant="outline" onClick={complete} loading={loading}><Check className="h-4 w-4" />Complete</Button>}</div>;
}

function Today({ data, openModal }) {
  const ownTasks = data.manager ? data.tasks.filter((task) => !task.assigneeId || task.assigneeId === data.user.uid) : data.tasks;
  const openTasks = sortByDate(ownTasks.filter((task) => !["completed", "cancelled"].includes(task.status)), "dueDate");
  const pendingTraining = data.training.filter((item) => !["completed", "passed"].includes(item.status));
  const today = new Date().toISOString().slice(0, 10);
  const todaysShift = data.shifts.find((shift) => String(shift.date || "").slice(0, 10) === today || (toDate(shift.startAt)?.toISOString().slice(0, 10) === today));
  const pendingLeave = data.manager ? data.leave.filter((item) => item.status === "pending") : [];
  const pendingRequests = data.manager ? data.workforceRequests.filter((item) => item.status === "submitted") : [];
  const roleName = data.staffProfile?.roleTitle || data.rolePack?.name || "Spotly staff member";
  const name = staffDisplayName(data.staffProfile || data.profile, data.user?.displayName || data.user?.email || "there");
  const queue = roleQueue(data.rolePack?.id);
  const QueueIcon = queue.icon;
  const agenda = [
    ...(todaysShift ? [{ id: `shift-${todaysShift.id}`, time: timeLabel(todaysShift.startAt, todaysShift.startTime || "08:00"), title: "Shift starts", detail: todaysShift.location || todaysShift.workArrangement || "Your usual work arrangement", href: "/staff/schedule", icon: Clock3 }] : []),
    ...openTasks.slice(0, 3).map((task) => ({ id: `task-${task.id}`, time: task.dueTime || (task.dueDate ? "Due" : "Today"), title: task.title || "Assigned work", detail: task.description || task.department || "Open your work queue for the full context.", href: "/staff/work", icon: ClipboardCheck })),
    ...pendingTraining.slice(0, 1).map((item) => ({ id: `training-${item.id}`, time: item.dueDate ? dateLabel(item.dueDate) : "Next", title: item.title || "Required learning", detail: "Continue your assigned learning and preserve your progress.", href: "/staff/learning", icon: GraduationCap }))
  ];

  return <div className="space-y-6"><div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">{new Intl.DateTimeFormat("en-ZW", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {name.split(" ")[0]}</h1><p className="mt-2 text-sm text-secondary">{roleName} · {data.staffProfile?.department || data.rolePack?.department || "Spotly"}</p></div><div className="flex flex-wrap gap-2">{todaysShift ? <ShiftCard shift={todaysShift} user={data.user} compact /> : <Button asChild><Link href="/staff/schedule">View schedule</Link></Button>}<Button variant="outline" onClick={() => openModal("support")}><Headphones className="h-4 w-4" />Ask for help</Button></div></div><div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><SectionCard title="Today’s agenda" description="Your shift, due work, and required learning in one place"><div>{agenda.map(({ id, time, title, detail, href, icon: Icon }) => <Link key={id} href={href} className="grid grid-cols-[64px_40px_1fr_auto] items-start gap-3 border-b px-4 py-4 transition hover:bg-grouped last:border-b-0"><span className="pt-2 text-xs font-semibold text-tertiary">{time}</span><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span><span><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm leading-6 text-secondary">{detail}</span></span><ArrowRight className="mt-3 h-4 w-4 text-tertiary" /></Link>)}{!agenda.length && <EmptyState icon={CheckCircle2} title="Nothing is due right now" description="New assignments, learning, and schedule changes will appear here with a direct next action." />}</div></SectionCard><div className="space-y-5"><SectionCard title="Your work queue" description={queue.description}><div className="p-5"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><QueueIcon className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-semibold">{queue.title}</h2><Button asChild className="mt-5 w-full"><Link href={queue.href}>Open queue<ArrowRight className="h-4 w-4" /></Link></Button></div></SectionCard>{data.manager && <SectionCard title="Approvals" description="Requests waiting for your decision"><div className="divide-y"><Link href="/staff/leave" className="flex items-center justify-between p-4 hover:bg-grouped"><span><span className="block font-semibold">Leave requests</span><span className="text-sm text-secondary">{pendingLeave.length} waiting</span></span><Badge tone={pendingLeave.length ? "warning" : "success"}>{pendingLeave.length}</Badge></Link><Link href="/staff/hiring" className="flex items-center justify-between p-4 hover:bg-grouped"><span><span className="block font-semibold">Workforce requests</span><span className="text-sm text-secondary">{pendingRequests.length} waiting</span></span><Badge tone={pendingRequests.length ? "warning" : "success"}>{pendingRequests.length}</Badge></Link></div></SectionCard>}</div></div><SectionCard title="Assigned work" description="Ordered by urgency and due date" action={<Link href="/staff/work" className="text-sm font-semibold text-[var(--accent)]">View all</Link>}><div>{openTasks.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} user={data.user} />)}{!openTasks.length && <EmptyState icon={CheckCircle2} title="You are clear for now" description="New work will appear here with a direct next action." />}</div></SectionCard>{data.error && <Card className="border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mr-2 inline h-4 w-4" />{data.error}</Card>}</div>;
}

function Work({ data, openModal }) {
  const [filter, setFilter] = useState("open");
  const [queryText, setQueryText] = useState("");
  const visible = sortByDate(data.tasks, "dueDate").filter((task) => {
    const matchesFilter = filter === "all" || (filter === "open" && !["completed", "cancelled"].includes(task.status)) || task.status === filter;
    const matchesText = [task.title, task.description, task.department, task.queue, task.priority].filter(Boolean).join(" ").toLowerCase().includes(queryText.toLowerCase());
    return matchesFilter && matchesText;
  });
  return <div className="space-y-6"><SectionIntro section="work" actions={<Button onClick={() => openModal("task")}><Plus className="h-4 w-4" />Add task</Button>} /><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search assigned work" /><Tabs value={filter} onChange={setFilter} tabs={[{ value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Completed" }, { value: "all", label: "All" }]} /></div><SectionCard>{visible.map((task) => <TaskRow key={task.id} task={task} user={data.user} />)}{!visible.length && <EmptyState icon={ClipboardList} title="No work matches this view" description="Assigned cases, operational tasks, and manager requests appear here. Change the filter or add a personal task." action={<Button variant="outline" onClick={() => openModal("task")}>Add task</Button>} />}</SectionCard></div>;
}

function Team({ data, openModal }) {
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState("active");
  const visible = data.directory.filter((person) => {
    const matchesText = [person.displayName, person.email, person.department, person.roleTitle, person.employeeNumber].filter(Boolean).join(" ").toLowerCase().includes(queryText.toLowerCase());
    const matchesFilter = filter === "all" || person.status === filter || (filter === "active" && ["active", "probation"].includes(person.status));
    return matchesText && matchesFilter;
  });
  const activeCount = data.directory.filter((person) => ["active", "probation"].includes(person.status)).length;
  const preboardingCount = data.directory.filter((person) => person.status === "preboarding").length;
  const offboardingCount = data.directory.filter((person) => person.status === "offboarding").length;
  return <div className="space-y-6">
    <SectionIntro section="team" actions={data.peopleAdministrator ? <Button onClick={() => openModal("staff")}><UserPlus className="h-4 w-4" />Add staff record</Button> : <Badge tone="neutral">Manager view</Badge>} />
    <div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-4 text-sm"><span><strong>{activeCount}</strong> active</span><span><strong>{preboardingCount}</strong> preboarding</span><span><strong>{offboardingCount}</strong> exits in progress</span></div>
    <div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search name, role, department, or employee number" /><Tabs value={filter} onChange={setFilter} tabs={[{ value: "active", label: "Active" }, { value: "preboarding", label: "Preboarding" }, { value: "offboarding", label: "Offboarding" }, { value: "all", label: "All" }]} /></div>
    <SectionCard>{visible.length ? <>
      <div className="space-y-3 p-3 lg:hidden">{visible.map((person) => <article key={person.id} className="rounded-xl border bg-white p-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] font-bold text-[var(--accent)]">{staffDisplayName(person).split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{staffDisplayName(person)}</h3><p className="mt-1 text-xs text-secondary">{person.email || person.employeeNumber || "Contact not set"}</p></div><StatusBadge status={person.status || "active"} /></div><p className="mt-3 text-sm font-semibold">{person.roleTitle || STAFF_ROLE_PACKS[person.rolePackId]?.name || "Role not assigned"}</p><p className="mt-1 text-xs text-secondary">{person.department || "Department not assigned"} · {person.employmentType || "Employment type not set"}</p><p className="mt-2 text-xs text-tertiary">Manager: {person.managerName || (person.managerId ? "Assigned" : "Not assigned")}</p></div></div>{data.peopleAdministrator && <Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => openModal("staff", person)}>Open staff record</Button>}</article>)}</div>
      <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Person</th><th className="px-5 py-3">Role and department</th><th className="px-5 py-3">Employment</th><th className="px-5 py-3">Manager</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((person) => <tr key={person.id} className="border-t"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] font-bold text-[var(--accent)]">{staffDisplayName(person).split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><p className="font-semibold">{staffDisplayName(person)}</p><p className="mt-1 text-xs text-secondary">{person.email || person.employeeNumber || "Contact not set"}</p></div></div></td><td className="px-5 py-4"><p className="font-semibold">{person.roleTitle || STAFF_ROLE_PACKS[person.rolePackId]?.name || "Role not assigned"}</p><p className="mt-1 text-xs text-secondary">{person.department || "Department not assigned"}</p></td><td className="px-5 py-4">{person.employmentType || "Not set"}</td><td className="px-5 py-4 text-secondary">{person.managerName || (person.managerId ? "Assigned" : "Not assigned")}</td><td className="px-5 py-4"><StatusBadge status={person.status || "active"} /></td><td className="px-5 py-4">{data.peopleAdministrator ? <Button size="sm" variant="outline" onClick={() => openModal("staff", person)}>Open record</Button> : <Badge tone="neutral">View only</Badge>}</td></tr>)}</tbody></table></div>
    </> : <EmptyState icon={UsersRound} title="No staff records match this view" description="Add employees only after a linked Spotly account or candidate has reached preboarding." action={data.peopleAdministrator ? <Button variant="outline" onClick={() => openModal("staff")}>Add staff record</Button> : null} />}</SectionCard>
  </div>;
}

function Hiring({ data, openModal }) {
  const [tab, setTab] = useState("requests");
  const pipeline = ["applied", "screening", "interview", "reference_check", "offer", "preboarding"];
  return <div className="space-y-6"><SectionIntro section="hiring" actions={<div className="flex gap-2"><Button variant="outline" onClick={() => openModal("workforce")}><Plus className="h-4 w-4" />Workforce request</Button><Button onClick={() => openModal("candidate")}><UserPlus className="h-4 w-4" />Add candidate</Button></div>} /><Tabs value={tab} onChange={setTab} tabs={[{ value: "requests", label: `Workforce requests (${data.workforceRequests.length})` }, { value: "pipeline", label: `Candidate pipeline (${data.candidates.length})` }, { value: "rolepacks", label: "Roles" }]} />{tab === "requests" && <SectionCard>{data.workforceRequests.length ? sortByDate(data.workforceRequests).map((request) => <div key={request.id} className="flex flex-col gap-3 border-b p-5 last:border-b-0 sm:flex-row sm:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><BriefcaseBusiness className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{request.roleTitle || "Workforce request"}</p><StatusBadge status={request.status || "draft"} /></div><p className="mt-1 text-sm text-secondary">{request.department || "Department not set"} · {request.employmentType || "Employment type not set"} · Start {dateLabel(request.startDate)}</p><p className="mt-1 text-xs text-tertiary">{request.reason || "Business need has not been documented."}</p></div><Button size="sm" variant="outline" onClick={() => openModal("workforce", request)}>Review</Button></div>) : <EmptyState icon={BriefcaseBusiness} title="No workforce requests yet" description="Managers request approved headcount before a vacancy and candidate pipeline are opened." action={<Button variant="outline" onClick={() => openModal("workforce")}>Create workforce request</Button>} />}</SectionCard>}{tab === "pipeline" && <div className="grid gap-4 xl:grid-cols-3">{pipeline.map((stage) => { const items = data.candidates.filter((candidate) => (candidate.status || "applied") === stage); return <SectionCard key={stage} title={stage.replaceAll("_", " ")} description={`${items.length} candidate${items.length === 1 ? "" : "s"}`}><div>{items.map((candidate) => <button key={candidate.id} onClick={() => openModal("candidate", candidate)} className="block w-full border-b p-4 text-left last:border-b-0 hover:bg-grouped"><p className="font-semibold">{candidate.fullName || candidate.email || "Candidate"}</p><p className="mt-1 text-sm text-secondary">{candidate.roleTitle || "Role not selected"}</p><p className="mt-1 text-xs text-tertiary">{candidate.location || "Zimbabwe"} · {candidate.availability || "Availability not set"}</p></button>)}{!items.length && <p className="p-5 text-sm leading-6 text-secondary">Candidates at this stage will appear here.</p>}</div></SectionCard>; })}</div>}{tab === "rolepacks" && <div className="grid gap-4 lg:grid-cols-2">{Object.values(STAFF_ROLE_PACKS).map((pack) => <Card key={pack.id} className="p-5"><div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><IdCard className="h-5 w-5" /></span><Badge tone={pack.managerView ? "accent" : "neutral"}>{pack.managerView ? "Manager" : "Individual contributor"}</Badge></div><h3 className="mt-4 text-lg font-bold">{pack.name}</h3><p className="mt-1 text-sm font-semibold text-[var(--accent)]">{pack.department}</p><p className="mt-3 text-sm leading-6 text-secondary">{pack.summary}</p><div className="mt-4 grid gap-3 rounded-xl bg-grouped p-4 text-sm sm:grid-cols-2"><div><p className="text-xs font-semibold text-tertiary">Learning</p><p className="mt-1 font-semibold">{pack.training.length} required item{pack.training.length === 1 ? "" : "s"}</p></div><div><p className="text-xs font-semibold text-tertiary">Standard equipment</p><p className="mt-1 font-semibold">{pack.equipment.length ? pack.equipment.join(", ") : "None assigned"}</p></div></div></Card>)}</div>}</div>;
}

function ShiftCard({ shift, user, compact = false }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState("");
  async function clock(action) {
    setLoading(action);
    try {
      await clockStaffShift(shift.id, action, user);
      toast(action === "in" ? "Your shift has started." : "Your shift has ended.", { title: action === "in" ? "Clocked in" : "Clocked out" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Attendance update failed" });
    } finally {
      setLoading("");
    }
  }
  if (compact) {
    if (shift.status === "scheduled") return <Button onClick={() => clock("in")} loading={loading === "in"}><Clock3 className="h-4 w-4" />Start shift</Button>;
    if (shift.status === "in_progress") return <Button variant="danger" onClick={() => clock("out")} loading={loading === "out"}>End shift</Button>;
    return <Button asChild variant="outline"><Link href="/staff/schedule">View shift</Link></Button>;
  }
  return <div className="rounded-2xl bg-grouped p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-tertiary">{dateLabel(shift.date || shift.startAt)}</p><p className="mt-2 text-xl font-bold">{timeLabel(shift.startAt, shift.startTime || "08:00")}–{timeLabel(shift.endAt, shift.endTime || "17:00")}</p><p className="mt-1 text-sm text-secondary">{shift.location || shift.workArrangement || "Spotly workspace"}</p></div><StatusBadge status={shift.status || "scheduled"} /></div>{shift.status === "scheduled" && <Button className="mt-5 w-full" onClick={() => clock("in")} loading={loading === "in"}><Clock3 className="h-4 w-4" />Start shift</Button>}{shift.status === "in_progress" && <Button variant="danger" className="mt-5 w-full" onClick={() => clock("out")} loading={loading === "out"}>End shift</Button>}{shift.status === "completed" && <div className="mt-5 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800 dark:bg-green-950/30 dark:text-green-300"><CheckCircle2 className="h-4 w-4" />Shift completed</div>}</div>;
}

function Schedule({ data, openModal }) {
  const upcoming = [...data.shifts].sort((a, b) => (toDate(a.startAt)?.getTime() || new Date(a.date || 0).getTime()) - (toDate(b.startAt)?.getTime() || new Date(b.date || 0).getTime()));
  return <div className="space-y-6"><SectionIntro section="schedule" actions={data.manager ? <Button onClick={() => openModal("shift")}><Plus className="h-4 w-4" />Add shift</Button> : null} /><div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]"><SectionCard title="Attendance summary"><div className="p-5"><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-grouped p-4"><p className="text-xs text-secondary">Scheduled</p><p className="mt-2 text-2xl font-bold">{data.shifts.length}</p></div><div className="rounded-2xl bg-grouped p-4"><p className="text-xs text-secondary">Exceptions</p><p className="mt-2 text-2xl font-bold">{data.shifts.filter((shift) => ["missed", "late", "exception"].includes(shift.status)).length}</p></div></div><p className="mt-5 text-sm leading-6 text-secondary">Clock events can be recorded online or queued on the device for later synchronization. Manager corrections remain auditable.</p></div></SectionCard><SectionCard title="Upcoming shifts" description={data.manager ? "Team schedule and coverage" : "Your assigned schedule"}><div className="grid gap-4 p-5 md:grid-cols-2">{upcoming.map((shift) => <ShiftCard key={shift.id} shift={shift} user={data.user} />)}{!upcoming.length && <div className="md:col-span-2"><EmptyState icon={CalendarDays} title="No shifts have been scheduled" description={data.manager ? "Add shifts for employees or use flexible schedule policies for eligible roles." : "Your manager has not assigned a shift. Flexible work can be recorded through an approved timesheet."} action={data.manager ? <Button variant="outline" onClick={() => openModal("shift")}>Add shift</Button> : null} /></div>}</div></SectionCard></div></div>;
}

function Leave({ data, openModal }) {
  const pending = data.leave.filter((item) => item.status === "pending");
  const own = data.leave.filter((item) => item.userId === data.user.uid || !data.manager);
  return <div className="space-y-6"><SectionIntro section="leave" actions={<Button onClick={() => openModal("leave")}><Plus className="h-4 w-4" />Request leave</Button>} /><div className="metric-grid"><MetricCard label="Annual leave" value={`${data.staffProfile?.leaveBalances?.annual ?? 0} days`} hint="Available balance" icon={CalendarDays} /><MetricCard label="Sick leave" value={`${data.staffProfile?.leaveBalances?.sick ?? 0} days`} hint="Recorded balance" icon={HandHeart} /><MetricCard label="Pending requests" value={String(own.filter((item) => item.status === "pending").length)} hint="Your requests" icon={Clock3} />{data.manager && <MetricCard label="Team decisions" value={String(pending.length)} hint="Awaiting approval" icon={UserCheck} tone={pending.length ? "warning" : "success"} />}</div>{data.manager && pending.length > 0 && <SectionCard title="Manager approvals" description="Coverage should be reviewed before a decision"><div>{pending.map((request) => <LeaveApproval key={request.id} request={request} user={data.user} />)}</div></SectionCard>}<SectionCard title={data.manager ? "Leave register" : "Your requests"}><div>{(data.manager ? data.leave : own).map((request) => <div key={request.id} className="flex flex-col gap-3 border-b p-5 last:border-b-0 sm:flex-row sm:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><HandHeart className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{request.type || "Leave request"}</p><p className="mt-1 text-sm text-secondary">{dateLabel(request.startDate)} – {dateLabel(request.endDate)} · {request.days || "Uncalculated"} day(s)</p><p className="mt-1 text-xs text-tertiary">{request.reason || "No private note added"}</p></div><StatusBadge status={request.status || "pending"} /></div>)}{!data.leave.length && <EmptyState icon={HandHeart} title="No leave requests yet" description="Available leave balances and all submitted requests will remain visible here." action={<Button variant="outline" onClick={() => openModal("leave")}>Request leave</Button>} />}</div></SectionCard></div>;
}

function LeaveApproval({ request, user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState("");
  async function decide(status) {
    setLoading(status);
    try {
      await decideLeaveRequest(request.id, status, "Reviewed in the Spotly staff workspace.", user);
      toast(`Leave request ${status}.`, { title: "Decision saved" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Decision failed" });
    } finally {
      setLoading("");
    }
  }
  return <div className="flex flex-col gap-4 border-b p-5 last:border-b-0 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{request.employeeName || request.userEmail || request.userId}</p><p className="mt-1 text-sm text-secondary">{request.type} · {dateLabel(request.startDate)} – {dateLabel(request.endDate)}</p><p className="mt-1 text-xs text-tertiary">{request.coverageNote || request.reason || "Coverage has not been documented."}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => decide("declined")} loading={loading === "declined"}>Decline</Button><Button size="sm" onClick={() => decide("approved")} loading={loading === "approved"}><Check className="h-4 w-4" />Approve</Button></div></div>;
}

function Learning({ data }) {
  const { toast } = useToast();
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const packTraining = data.rolePack?.training || [];
  const assignedTitles = new Set(data.training.map((item) => item.title));
  const combined = [...data.training, ...packTraining.filter((title) => !assignedTitles.has(title)).map((title, index) => ({ id: `role-${index}`, title, status: "required", source: "role" }))];
  const complete = combined.filter((item) => ["completed", "passed"].includes(item.status)).length;
  const progress = combined.length ? Math.round((complete / combined.length) * 100) : 100;

  async function finishLesson() {
    if (!active || !acknowledged) return;
    setSaving(true);
    try {
      const generated = String(active.id).startsWith("role-");
      await saveTrainingAssignment({
        ...(generated ? {} : active),
        id: generated ? undefined : active.id,
        userId: data.user.uid,
        employeeName: staffDisplayName(data.staffProfile, data.user.displayName || data.user.email),
        title: active.title,
        description: active.description || "Required learning",
        status: "completed",
        progress: 100,
        completedAt: new Date().toISOString()
      }, data.user);
      toast("Your learning progress was saved.", { title: "Learning complete" });
      setActive(null);
      setAcknowledged(false);
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not save learning" });
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6"><SectionIntro section="learning" /><Card className="p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><GraduationCap className="h-7 w-7" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Learning for {data.staffProfile?.roleTitle || data.rolePack?.name || "your role"}</h2><p className="mt-1 text-sm text-secondary">{complete} of {combined.length} required items complete</p></div><Badge tone={progress === 100 ? "success" : "accent"}>{progress}%</Badge></div><ProgressBar value={progress} className="mt-4" /></div></div></Card><div className="grid gap-4 lg:grid-cols-2">{combined.map((item) => { const done = ["completed", "passed"].includes(item.status); return <Card key={item.id} className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><BookOpenCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><StatusBadge status={item.status || "assigned"} /></div><p className="mt-2 text-sm leading-6 text-secondary">{item.description || "Read the guidance, confirm your understanding, and complete any required acknowledgement."}</p><p className="mt-3 text-xs text-tertiary">{item.dueDate ? `Due ${dateLabel(item.dueDate)}` : item.source === "role" ? "Required for your role" : "No due date"}</p></div></div><Button className="mt-5 w-full" variant={done ? "outline" : "secondary"} onClick={() => { setActive(item); setAcknowledged(done); }}>{done ? "Review learning" : "Continue learning"}<ArrowRight className="h-4 w-4" /></Button></Card>; })}{!combined.length && <div className="lg:col-span-2"><EmptyState icon={GraduationCap} title="No learning has been assigned" description="Required orientation, policy acknowledgements, quizzes, and renewals will appear here." /></div>}</div><Modal open={Boolean(active)} onClose={() => { setActive(null); setAcknowledged(false); }} title={active?.title || "Learning"} description="Read the guidance and confirm your understanding."><div className="space-y-5 p-5"><div className="rounded-xl bg-grouped p-5"><h3 className="font-semibold">What you need to know</h3><p className="mt-3 text-sm leading-7 text-secondary">{active?.content || active?.description || "This learning item introduces the standards, responsibilities, and operating steps required for your work at Spotly. Review the linked policy or training material supplied by your manager before confirming completion."}</p></div><div><h3 className="font-semibold">Before you finish</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-secondary"><li>• I understand how this guidance applies to my work.</li><li>• I know where to ask for help or report an issue.</li><li>• I will follow the current approved procedure.</li></ul></div><label className="flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-4 w-4" /><span><span className="block font-semibold">I have reviewed this learning</span><span className="mt-1 block text-sm leading-6 text-secondary">This confirmation is saved to your learning history.</span></span></label><div className="flex justify-end gap-2 border-t pt-4"><Button variant="ghost" onClick={() => { setActive(null); setAcknowledged(false); }}>Close</Button>{!["completed", "passed"].includes(active?.status) && <Button onClick={finishLesson} loading={saving} disabled={!acknowledged}>Mark complete</Button>}</div></div></Modal></div>;
}

function Performance({ data }) {
  const own = data.performance.filter((item) => item.userId === data.user.uid || !data.manager);
  return <div className="space-y-6"><SectionIntro section="performance" /><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><SectionCard title="Current cycle" description={data.staffProfile?.probationEndDate ? `Probation ends ${dateLabel(data.staffProfile.probationEndDate)}` : "Role expectations and development"}><div className="p-5"><Target className="h-7 w-7 text-[var(--accent)]" /><h3 className="mt-4 text-lg font-bold">{data.staffProfile?.performanceCycle || "Quarterly check-in"}</h3><p className="mt-2 text-sm leading-6 text-secondary">Performance combines clear role expectations, regular manager conversations, recognition, coaching, and career development. It does not publicly rank employees.</p><p className="mt-5 rounded-xl bg-grouped p-3 text-sm text-secondary">Your manager will schedule the next check-in. Use Help & support to request an earlier conversation.</p></div></SectionCard><SectionCard title={data.manager ? "Goals and check-ins" : "Your goals and check-ins"}><div>{own.map((record) => <div key={record.id} className="border-b p-5 last:border-b-0"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{record.title || record.type || "Performance record"}</p><p className="mt-1 text-sm leading-6 text-secondary">{record.summary || record.description || "No summary has been recorded."}</p></div><StatusBadge status={record.status || "active"} /></div>{record.progress !== undefined && <ProgressBar value={record.progress} className="mt-4" />}<p className="mt-3 text-xs text-tertiary">{record.reviewDate ? `Review ${dateLabel(record.reviewDate)}` : "Review date not set"}</p></div>)}{!own.length && <EmptyState icon={Target} title="No performance records yet" description="Probation goals, check-ins, feedback, coaching plans, reviews, and development goals will appear here." />}</div></SectionCard></div></div>;
}

function Pay({ data }) {
  const records = sortByDate(data.payroll, "periodEnd");
  const latest = records[0];
  return <div className="space-y-6"><SectionIntro section="pay" actions={<Badge tone="neutral">Private</Badge>} /><div className="metric-grid"><MetricCard label="Latest net pay" value={latest ? currencyLabel(latest.netPay, latest.currency) : "Not available"} hint={latest ? `${dateLabel(latest.periodStart)} – ${dateLabel(latest.periodEnd)}` : "Payroll has not been published"} icon={BadgeDollarSign} /><MetricCard label="Allowances" value={latest ? currencyLabel(latest.allowances, latest.currency) : "—"} hint="Latest published period" icon={WalletCards} /><MetricCard label="Reimbursements" value={latest ? currencyLabel(latest.reimbursements, latest.currency) : "—"} hint="Approved expenses" icon={FileText} /><MetricCard label="Payment status" value={latest?.status ? latest.status.replaceAll("_", " ") : "Not available"} hint={latest?.paymentDate ? `Paid ${dateLabel(latest.paymentDate)}` : "People Operations controls publication"} icon={CheckCircle2} /></div><SectionCard title="Pay records" description="Sensitive information is visible only to the employee and authorized People or Finance staff"><div>{records.map((record) => <div key={record.id} className="flex flex-col gap-3 border-b p-5 last:border-b-0 sm:flex-row sm:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><WalletCards className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{dateLabel(record.periodStart)} – {dateLabel(record.periodEnd)}</p><p className="mt-1 text-sm text-secondary">Gross {currencyLabel(record.grossPay, record.currency)} · Deductions {currencyLabel(record.deductions, record.currency)}</p></div><div className="text-left sm:text-right"><p className="font-bold">{currencyLabel(record.netPay, record.currency)}</p><div className="mt-1"><StatusBadge status={record.status || "prepared"} /></div></div>{record.payslipUrl ? <Button asChild size="sm" variant="outline"><a href={record.payslipUrl} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />Open payslip</a></Button> : <span className="text-xs text-tertiary">Payslip not published</span>}</div>)}{!records.length && <EmptyState icon={WalletCards} title="No pay records are available" description="Published payslips, allowances, bonuses, deductions, reimbursements, and payment reconciliation will appear here." />}</div></SectionCard></div>;
}

function Assets({ data, openModal }) {
  return <div className="space-y-6"><SectionIntro section="assets" actions={data.manager ? <Button onClick={() => openModal("asset")}><Plus className="h-4 w-4" />Issue asset</Button> : null} /><SectionCard>{data.assets.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Asset</th><th className="px-5 py-3">Assigned to</th><th className="px-5 py-3">Issued</th><th className="px-5 py-3">Condition</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{data.assets.map((asset) => <tr key={asset.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold">{asset.type || asset.name || "Equipment"}</p><p className="mt-1 text-xs text-secondary">{asset.serialNumber || asset.assetNumber || asset.id}</p></td><td className="px-5 py-4">{asset.assignedToName || asset.assignedTo || "Unassigned"}</td><td className="px-5 py-4">{dateLabel(asset.issuedAt)}</td><td className="px-5 py-4">{asset.condition || "Not recorded"}</td><td className="px-5 py-4"><StatusBadge status={asset.status || "assigned"} /></td></tr>)}</tbody></table></div> : <EmptyState icon={Laptop} title="No assets are recorded" description={data.manager ? "Issue laptops, phones, SIM cards, uniforms, badges, scanners, vehicles, and other equipment with condition and return tracking." : "Equipment issued to you will appear here with its condition and return obligations."} action={data.manager ? <Button variant="outline" onClick={() => openModal("asset")}>Issue asset</Button> : null} />}</SectionCard></div>;
}

function Help({ data, openModal }) {
  const options = [
    { icon: HeartHandshake, title: "People Operations", text: "Employment, leave, pay, benefits, workplace support, or policy questions.", type: "people" },
    { icon: Laptop, title: "Technical support", text: "Account access, equipment, software, security, or connectivity issues.", type: "technical" },
    { icon: ShieldCheck, title: "Confidential concern", text: "Raise a sensitive workplace concern with restricted visibility.", type: "confidential" },
    { icon: AlertTriangle, title: "Workplace incident", text: "Report an injury, security event, harassment, or operational safety incident.", type: "incident" }
  ];
  return <div className="space-y-6"><SectionIntro section="help" /><div className="grid gap-4 lg:grid-cols-2">{options.map(({ icon: Icon, title, text, type }) => <Card key={type} className="p-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-6 w-6" /></span><h2 className="mt-4 text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-secondary">{text}</p><Button className="mt-5 w-full" variant="outline" onClick={() => openModal("support", { category: type })}>Start request</Button></Card>)}</div><SectionCard title="Your request history"><div>{data.supportRequests.map((request) => <div key={request.id} className="flex items-center gap-3 border-b p-5 last:border-b-0"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><MessageCircleMore className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{request.subject || request.category || "Support request"}</p><p className="mt-1 truncate text-sm text-secondary">{request.description || "No description"}</p></div><StatusBadge status={request.status || "open"} /></div>)}{!data.supportRequests.length && <EmptyState icon={Headphones} title="No internal support requests" description="Requests appear here without exposing confidential content to unauthorized users." />}</div></SectionCard></div>;
}

function Profile({ data, openModal }) {
  const record = data.staffProfile || {};
  const pack = data.rolePack;
  const sections = [
    ["Employment", record.employmentType || "Not set", BriefcaseBusiness],
    ["Department", record.department || pack?.department || "Not set", UsersRound],
    ["Manager", record.managerName || (record.managerId ? "Assigned manager" : "Not assigned"), UserCheck],
    ["Work arrangement", record.workArrangement || "Not set", CalendarDays],
    ["Employee number", record.employeeNumber || "Not assigned", IdCard],
    ["Start date", dateLabel(record.startDate), Clock3]
  ];
  return <div className="space-y-6"><SectionIntro section="profile" actions={data.peopleAdministrator ? <Button variant="outline" onClick={() => openModal("staff", record)}>Edit staff record</Button> : null} /><Card className="p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[var(--accent)] text-2xl font-black text-white">{staffDisplayName(record, data.user?.displayName || data.user?.email).split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black">{staffDisplayName(record, data.user?.displayName || data.user?.email)}</h2><StatusBadge status={record.status || "active"} /></div><p className="mt-1 font-semibold text-[var(--accent)]">{record.roleTitle || pack?.name || "Spotly staff member"}</p><p className="mt-2 text-sm text-secondary">{record.email || data.user?.email}</p></div><Badge tone="accent">{record.department || pack?.department || "Spotly"}</Badge></div></Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sections.map(([title, value, Icon]) => <Card key={title} className="p-5"><Icon className="h-5 w-5 text-[var(--accent)]" /><p className="mt-4 text-xs font-bold uppercase tracking-[.14em] text-tertiary">{title}</p><p className="mt-2 font-semibold">{value}</p></Card>)}</div><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Role and access"><div className="p-5"><p className="text-sm leading-6 text-secondary">{pack?.summary || "Your access follows your employment, assigned responsibilities, work location, and any temporary approvals."}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-grouped p-3"><p className="text-xs text-tertiary">Access level</p><p className="mt-1 font-semibold">{data.manager ? "Manager" : "Team member"}</p></div><div className="rounded-xl bg-grouped p-3"><p className="text-xs text-tertiary">Assigned areas</p><p className="mt-1 font-semibold">{Math.max(1, new Set([...(record.permissions || []), ...(pack?.permissions || [])].map((item) => String(item).split(".")[0])).size)} work areas</p></div></div></div></SectionCard><SectionCard title="Emergency and contact details"><div className="p-5"><div className="space-y-4"><div className="flex items-center gap-3"><Phone className="h-5 w-5 text-[var(--accent)]" /><div><p className="text-sm font-semibold">Phone</p><p className="text-sm text-secondary">{record.phone || "Not provided"}</p></div></div><div className="flex items-center gap-3"><HeartHandshake className="h-5 w-5 text-[var(--accent)]" /><div><p className="text-sm font-semibold">Emergency contact</p><p className="text-sm text-secondary">{record.emergencyContactName || "Not provided"}{record.emergencyContactPhone ? ` · ${record.emergencyContactPhone}` : ""}</p></div></div></div></div></SectionCard></div></div>;
}

function StaffModal({ type, item, open, onClose, data }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({});
  useEffect(() => {
    if (!open) return;
    const defaults = {
      task: { title: "", description: "", priority: "normal", status: "open", assigneeId: data.user.uid, department: data.staffProfile?.department || data.rolePack?.department || "" },
      leave: { type: LEAVE_TYPES[0], startDate: "", endDate: "", reason: "", days: 1, userId: data.user.uid, employeeName: staffDisplayName(data.staffProfile || data.profile, data.user.email) },
      workforce: { roleTitle: "", department: STAFF_DEPARTMENTS[0], employmentType: STAFF_EMPLOYMENT_TYPES[0], reason: "", startDate: "", status: "submitted" },
      candidate: { fullName: "", email: "", phone: "", roleTitle: "", location: "", availability: "", status: "applied" },
      staff: { userId: "", displayName: "", email: "", rolePackId: "support_agent", roleTitle: STAFF_ROLE_PACKS.support_agent.name, department: STAFF_ROLE_PACKS.support_agent.department, employmentType: STAFF_EMPLOYMENT_TYPES[0], status: "preboarding", startDate: "", managerId: "" },
      shift: { userId: "", employeeName: "", date: "", startTime: "08:00", endTime: "17:00", location: "Harare", status: "scheduled" },
      asset: { type: "Laptop", assetNumber: "", serialNumber: "", assignedTo: "", assignedToName: "", condition: "Good", issuedAt: new Date().toISOString().slice(0, 10), status: "assigned" },
      support: { category: "people", subject: "", description: "", urgency: "normal", confidentiality: "standard", userId: data.user.uid }
    };
    setForm({ ...(defaults[type] || {}), ...(item || {}) });
  }, [open, type, item, data.user.uid, data.user.email, data.staffProfile, data.profile, data.rolePack]);
  const patch = (values) => setForm((current) => ({ ...current, ...values }));

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      if (type === "task") await saveStaffTask(form, data.user);
      if (type === "leave") await saveLeaveRequest(form, data.user);
      if (type === "workforce") await saveWorkforceRequest(form, data.user);
      if (type === "candidate") await saveCandidate(form, data.user);
      if (type === "staff") {
        const pack = STAFF_ROLE_PACKS[form.rolePackId];
        await saveStaffProfile({ ...form, id: form.id || form.userId, roleTitle: form.roleTitle || pack?.name, department: form.department || pack?.department, permissions: form.permissions || pack?.permissions || [] }, data.user);
      }
      if (type === "shift") await saveStaffShift(form, data.user);
      if (type === "asset") await saveStaffAsset(form, data.user);
      if (type === "support") await saveStaffSupportRequest(form, data.user);
      toast("The workforce record was saved.", { title: "Saved" });
      onClose();
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not save" });
    } finally {
      setLoading(false);
    }
  }

  const titles = { task: "Add work", leave: "Request leave", workforce: "Workforce request", candidate: "Candidate record", staff: "Staff record", shift: "Add shift", asset: "Issue asset", support: "Internal support request" };
  return <Modal open={open} onClose={onClose} title={titles[type] || "Staff action"} size="lg"><form onSubmit={submit}><div className="grid gap-4 p-5 sm:grid-cols-2">{type === "task" && <><Field label="Task title"><input required value={form.title || ""} onChange={(event) => patch({ title: event.target.value })} className={inputClass} /></Field><Field label="Priority"><select value={form.priority || "normal"} onChange={(event) => patch({ priority: event.target.value })} className={inputClass}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field><Field label="Assignee account ID"><input value={form.assigneeId || ""} onChange={(event) => patch({ assigneeId: event.target.value })} className={inputClass} /></Field><Field label="Department"><select value={form.department || ""} onChange={(event) => patch({ department: event.target.value })} className={inputClass}><option value="">Choose department</option>{STAFF_DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></Field><Field label="Due date"><input type="date" value={form.dueDate || ""} onChange={(event) => patch({ dueDate: event.target.value })} className={inputClass} /></Field><Field label="Description" wide><textarea value={form.description || ""} onChange={(event) => patch({ description: event.target.value })} className={textareaClass} /></Field></>}{type === "leave" && <><Field label="Leave type"><select value={form.type || LEAVE_TYPES[0]} onChange={(event) => patch({ type: event.target.value })} className={inputClass}>{LEAVE_TYPES.map((leaveType) => <option key={leaveType}>{leaveType}</option>)}</select></Field><Field label="Days"><input type="number" min="0.5" step="0.5" value={form.days || 1} onChange={(event) => patch({ days: Number(event.target.value) })} className={inputClass} /></Field><Field label="Start date"><input required type="date" value={form.startDate || ""} onChange={(event) => patch({ startDate: event.target.value })} className={inputClass} /></Field><Field label="End date"><input required type="date" value={form.endDate || ""} onChange={(event) => patch({ endDate: event.target.value })} className={inputClass} /></Field><Field label="Reason or note" wide><textarea value={form.reason || ""} onChange={(event) => patch({ reason: event.target.value })} className={textareaClass} /></Field></>}{type === "workforce" && <><Field label="Role title"><input required value={form.roleTitle || ""} onChange={(event) => patch({ roleTitle: event.target.value })} className={inputClass} /></Field><Field label="Department"><select value={form.department || STAFF_DEPARTMENTS[0]} onChange={(event) => patch({ department: event.target.value })} className={inputClass}>{STAFF_DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></Field><Field label="Employment type"><select value={form.employmentType || STAFF_EMPLOYMENT_TYPES[0]} onChange={(event) => patch({ employmentType: event.target.value })} className={inputClass}>{STAFF_EMPLOYMENT_TYPES.map((typeName) => <option key={typeName}>{typeName}</option>)}</select></Field><Field label="Proposed start date"><input type="date" value={form.startDate || ""} onChange={(event) => patch({ startDate: event.target.value })} className={inputClass} /></Field><Field label="Budget"><input value={form.budget || ""} onChange={(event) => patch({ budget: event.target.value })} className={inputClass} placeholder="Amount and currency" /></Field><Field label="Reason for the role" wide><textarea required value={form.reason || ""} onChange={(event) => patch({ reason: event.target.value })} className={textareaClass} /></Field></>}{type === "candidate" && <><Field label="Full name"><input required value={form.fullName || ""} onChange={(event) => patch({ fullName: event.target.value })} className={inputClass} /></Field><Field label="Role"><input value={form.roleTitle || ""} onChange={(event) => patch({ roleTitle: event.target.value })} className={inputClass} /></Field><Field label="Email"><input type="email" value={form.email || ""} onChange={(event) => patch({ email: event.target.value })} className={inputClass} /></Field><Field label="Phone"><input value={form.phone || ""} onChange={(event) => patch({ phone: event.target.value })} className={inputClass} /></Field><Field label="Location"><input value={form.location || ""} onChange={(event) => patch({ location: event.target.value })} className={inputClass} /></Field><Field label="Availability"><input value={form.availability || ""} onChange={(event) => patch({ availability: event.target.value })} className={inputClass} /></Field><Field label="Pipeline stage"><select value={form.status || "applied"} onChange={(event) => patch({ status: event.target.value })} className={inputClass}>{["applied", "screening", "interview", "reference_check", "offer", "preboarding", "rejected", "talent_pool"].map((stage) => <option key={stage} value={stage}>{stage.replaceAll("_", " ")}</option>)}</select></Field><Field label="Notes" wide><textarea value={form.notes || ""} onChange={(event) => patch({ notes: event.target.value })} className={textareaClass} /></Field></>}{type === "staff" && <><Field label="Linked account ID"><input required value={form.userId || form.id || ""} onChange={(event) => patch({ userId: event.target.value, id: event.target.value })} className={inputClass} /></Field><Field label="Full name"><input required value={form.displayName || ""} onChange={(event) => patch({ displayName: event.target.value })} className={inputClass} /></Field><Field label="Email"><input type="email" value={form.email || ""} onChange={(event) => patch({ email: event.target.value })} className={inputClass} /></Field><Field label="Role"><select value={form.rolePackId || "support_agent"} onChange={(event) => { const pack = STAFF_ROLE_PACKS[event.target.value]; patch({ rolePackId: event.target.value, roleTitle: pack.name, department: pack.department }); }} className={inputClass}>{Object.values(STAFF_ROLE_PACKS).map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></Field><Field label="Department"><select value={form.department || ""} onChange={(event) => patch({ department: event.target.value })} className={inputClass}>{STAFF_DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></Field><Field label="Employment type"><select value={form.employmentType || STAFF_EMPLOYMENT_TYPES[0]} onChange={(event) => patch({ employmentType: event.target.value })} className={inputClass}>{STAFF_EMPLOYMENT_TYPES.map((typeName) => <option key={typeName}>{typeName}</option>)}</select></Field><Field label="Start date"><input type="date" value={String(form.startDate || "").slice(0, 10)} onChange={(event) => patch({ startDate: event.target.value })} className={inputClass} /></Field><Field label="Status"><select value={form.status || "preboarding"} onChange={(event) => patch({ status: event.target.value })} className={inputClass}>{["preboarding", "probation", "active", "leave", "suspended", "offboarding", "alumni"].map((status) => <option key={status}>{status}</option>)}</select></Field><Field label="Manager account ID"><input value={form.managerId || ""} onChange={(event) => patch({ managerId: event.target.value })} className={inputClass} /></Field><Field label="Employee number"><input value={form.employeeNumber || ""} onChange={(event) => patch({ employeeNumber: event.target.value })} className={inputClass} /></Field></>}{type === "shift" && <><Field label="Staff account ID"><input required value={form.userId || ""} onChange={(event) => patch({ userId: event.target.value })} className={inputClass} /></Field><Field label="Employee name"><input value={form.employeeName || ""} onChange={(event) => patch({ employeeName: event.target.value })} className={inputClass} /></Field><Field label="Date"><input required type="date" value={form.date || ""} onChange={(event) => patch({ date: event.target.value })} className={inputClass} /></Field><Field label="Location or arrangement"><input value={form.location || ""} onChange={(event) => patch({ location: event.target.value })} className={inputClass} /></Field><Field label="Start time"><input type="time" value={form.startTime || "08:00"} onChange={(event) => patch({ startTime: event.target.value })} className={inputClass} /></Field><Field label="End time"><input type="time" value={form.endTime || "17:00"} onChange={(event) => patch({ endTime: event.target.value })} className={inputClass} /></Field></>}{type === "asset" && <><Field label="Asset type"><input required value={form.type || ""} onChange={(event) => patch({ type: event.target.value })} className={inputClass} /></Field><Field label="Asset number"><input value={form.assetNumber || ""} onChange={(event) => patch({ assetNumber: event.target.value })} className={inputClass} /></Field><Field label="Serial number"><input value={form.serialNumber || ""} onChange={(event) => patch({ serialNumber: event.target.value })} className={inputClass} /></Field><Field label="Assigned account ID"><input value={form.assignedTo || ""} onChange={(event) => patch({ assignedTo: event.target.value })} className={inputClass} /></Field><Field label="Assigned employee"><input value={form.assignedToName || ""} onChange={(event) => patch({ assignedToName: event.target.value })} className={inputClass} /></Field><Field label="Condition"><select value={form.condition || "Good"} onChange={(event) => patch({ condition: event.target.value })} className={inputClass}><option>New</option><option>Good</option><option>Fair</option><option>Damaged</option></select></Field><Field label="Issue date"><input type="date" value={String(form.issuedAt || "").slice(0, 10)} onChange={(event) => patch({ issuedAt: event.target.value })} className={inputClass} /></Field></>}{type === "support" && <><Field label="Request type"><select value={form.category || "people"} onChange={(event) => patch({ category: event.target.value })} className={inputClass}><option value="people">People Operations</option><option value="technical">Technical support</option><option value="confidential">Confidential concern</option><option value="incident">Workplace incident</option></select></Field><Field label="Urgency"><select value={form.urgency || "normal"} onChange={(event) => patch({ urgency: event.target.value })} className={inputClass}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field><Field label="Subject" wide><input required value={form.subject || ""} onChange={(event) => patch({ subject: event.target.value })} className={inputClass} /></Field><Field label="What happened or what do you need?" wide><textarea required value={form.description || ""} onChange={(event) => patch({ description: event.target.value })} className={textareaClass} /></Field></>}</div><div className="sticky bottom-0 flex justify-end gap-2 border-t bg-[var(--surface)] p-5"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>Save</Button></div></form></Modal>;
}

function Field({ label, children, wide = false }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-sm font-semibold">{label}</span>{children}</label>;
}

function StaffWorkspace({ section }) {
  const data = useStaffData();
  const [modal, setModal] = useState({ type: "", item: null });
  const navigation = useMemo(() => staffNavigation(data.manager), [data.manager]);
  const allowed = new Set(navigation.map((item) => item.id));
  const safeSection = allowed.has(section) ? section : "today";
  const openModal = (type, item = null) => setModal({ type, item });
  return <StaffAccess data={data}><PortalShell portalId="staff" activeSection={safeSection} navigation={navigation} footer={false}><div className="mx-auto max-w-[1550px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{safeSection === "today" && <Today data={data} openModal={openModal} />}{safeSection === "work" && <Work data={data} openModal={openModal} />}{safeSection === "team" && data.manager && <Team data={data} openModal={openModal} />}{safeSection === "hiring" && data.manager && <Hiring data={data} openModal={openModal} />}{safeSection === "schedule" && <Schedule data={data} openModal={openModal} />}{safeSection === "leave" && <Leave data={data} openModal={openModal} />}{safeSection === "learning" && <Learning data={data} />}{safeSection === "performance" && <Performance data={data} />}{safeSection === "pay" && <Pay data={data} />}{safeSection === "assets" && <Assets data={data} openModal={openModal} />}{safeSection === "help" && <Help data={data} openModal={openModal} />}{safeSection === "profile" && <Profile data={data} openModal={openModal} />}</div><StaffModal type={modal.type} item={modal.item} open={Boolean(modal.type)} onClose={() => setModal({ type: "", item: null })} data={data} /></PortalShell></StaffAccess>;
}

export function StaffApp({ section = "today" }) {
  return <AuthGate portal="staff" title="Sign in to Spotly Staff"><StaffWorkspace section={section} /></AuthGate>;
}
