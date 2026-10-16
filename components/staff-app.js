"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BadgeCheck,
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
  WalletCards,
  ScanBarcode
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { StaffCatalogueCapture } from "@/components/staff-catalogue-capture";
import { StaffHiring } from "@/components/staff-hiring";
import { PortalShell } from "@/components/portal-shell";
import { NotificationCenter } from "@/components/notification-center";
import { spotlyPortalUrl } from "@/lib/spotly-domains";
import { authenticatedFetch } from "@/lib/api-client";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  EntityPicker,
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
  canRecruitStaff,
  hasStaffAccess,
  hasStaffPermission,
  isPeopleAdministrator,
  isPeopleManager,
  rolePackFor,
  staffDisplayName,
  staffLifecycleFor
} from "@/data/staff";
import {
  clockStaffShift,
  decideLeaveRequest,
  saveLeaveRequest,
  saveStaffAsset,
  saveStaffProfile,
  saveStaffSupportRequest,
  saveStaffTask,
  saveStaffShift,
  saveTrainingAssignment,
  saveWorkforceRequest,
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
  leave: { title: "Time off", description: "Balances, requests, approvals, and team coverage." },
  learning: { title: "Learning", description: "Role-based onboarding, required training, assessments, and renewals." },
  performance: { title: "Performance", description: "Goals, check-ins, probation, development, and coaching." },
  pay: { title: "Pay", description: "Pay records, allowances, reimbursements, payslips, and payroll status." },
  assets: { title: "Equipment", description: "Equipment issued to Spotly staff and its return condition." },
  notifications: { title: "Staff notifications", description: "Approvals, schedule changes, People Operations activity and work updates." },
  help: { title: "Help & support", description: "People support, technical help, confidential concerns, and incidents." },
  profile: { title: "Profile", description: "Employment, role, access, documents, contacts, and account details." },
  catalogue: { title: "Product capture", description: "Build Spotly’s reusable product library from verified field observations." }
};

const inputClass = "surface h-12 w-full rounded-xl px-4 outline-none focus:ring-2 focus:ring-[var(--accent)]/20";
const textareaClass = "surface min-h-28 w-full rounded-xl p-4 outline-none focus:ring-2 focus:ring-[var(--accent)]/20";

function harareNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Harare" }));
}

function harareDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Harare", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

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

function taskDueDate(task) {
  return toDate(task.slaAt || task.dueAt || task.dueDate);
}

function taskUrgency(task) {
  const priority = { urgent: 0, high: 1, normal: 2, low: 3 }[task.priority] ?? 2;
  const due = taskDueDate(task)?.getTime();
  return [priority, due ?? Number.MAX_SAFE_INTEGER, toDate(task.createdAt)?.getTime() || 0];
}

function sortTasks(items) {
  return [...items].sort((a, b) => {
    const left = taskUrgency(a);
    const right = taskUrgency(b);
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  });
}

function dueLabel(task) {
  const due = taskDueDate(task);
  if (!due) return { label: "No due time", tone: "neutral" };
  const now = Date.now();
  const diffHours = Math.round((due.getTime() - now) / 3_600_000);
  if (diffHours < 0) return { label: `Overdue · ${dateLabel(due)}`, tone: "danger" };
  if (diffHours <= 24) return { label: diffHours <= 1 ? "Due within 1 hour" : `Due in ${diffHours} hours`, tone: "warning" };
  return { label: `Due ${dateLabel(due)}`, tone: "neutral" };
}

function nextActionFor(task) {
  if (task.nextAction) return task.nextAction;
  const first = Array.isArray(task.checklist) ? task.checklist.find((item) => typeof item === "string" || !item?.completed) : null;
  if (typeof first === "string") return first;
  if (first?.label) return first.label;
  return "Open the task and complete the next required action.";
}

function roleTools(data) {
  const id = data.rolePack?.id;
  const tools = [];
  if (["support_agent", "operations_manager", "platform_admin"].includes(id) || hasStaffPermission(data.profile, data.staffProfile, "support.read")) tools.push({ label: "Support operations", detail: "Customer and business conversations", href: spotlyPortalUrl("admin", "/work?queue=support"), icon: Headphones });
  if (["verification_officer", "business_success_manager", "operations_manager", "regional_operations_manager", "platform_admin"].includes(id) || hasStaffPermission(data.profile, data.staffProfile, "businesses.read", "claims.read")) tools.push({ label: "Marketplace operations", detail: "Businesses, claims and launch readiness", href: spotlyPortalUrl("admin", "/marketplace"), icon: Store });
  if (["driver_operations_coordinator", "operations_manager", "regional_operations_manager", "platform_admin"].includes(id) || hasStaffPermission(data.profile, data.staffProfile, "drivers.read")) tools.push({ label: "Mobility operations", detail: "Drivers, incidents and service exceptions", href: spotlyPortalUrl("admin", "/mobility"), icon: PackageCheck });
  if (["finance_admin", "platform_admin"].includes(id) || hasStaffPermission(data.profile, data.staffProfile, "finance.read")) tools.push({ label: "Money operations", detail: "Payouts, reconciliation and finance exceptions", href: spotlyPortalUrl("admin", "/money"), icon: WalletCards });
  if (["content_editor", "platform_admin"].includes(id) || hasStaffPermission(data.profile, data.staffProfile, "content.read")) tools.push({ label: "Growth & content", detail: "Content, help and marketplace quality", href: spotlyPortalUrl("admin", "/growth"), icon: BookOpenCheck });
  if (["platform_admin"].includes(id) || hasStaffPermission(data.profile, data.staffProfile, "*")) tools.push({ label: "Platform system", detail: "Access, configuration, diagnostics and audit", href: spotlyPortalUrl("admin", "/system"), icon: ShieldCheck });
  return tools.slice(0, 4);
}

function staffNavigation(data) {
  const manager = data.manager;
  const permissions = new Set([...(data.profile?.customPermissions || []), ...(data.staffProfile?.permissions || []), ...(data.rolePack?.permissions || [])]);
  const canCaptureCatalogue = permissions.has("*") || permissions.has("master_products.capture") || permissions.has("master_products.*");
  const items = [
    { id: "today", label: "Today", icon: LayoutDashboard, href: "/", group: "Work" },
    { id: "work", label: "My work", icon: ListChecks, href: "/work", group: "Work" }
  ];
  if (manager) items.push({ id: "team", label: "Team", icon: UsersRound, href: "/team", group: "People" });
  if (data.canRecruit) items.push({ id: "hiring", label: "Hiring", icon: UserPlus, href: "/hiring", group: "People" });
  if (canCaptureCatalogue) items.push({ id: "catalogue", label: "Product capture", icon: ScanBarcode, href: "/catalogue", group: "Field tools" });
  items.push(
    { id: "schedule", label: "Schedule", icon: CalendarDays, href: "/schedule", group: "Work" },
    { id: "leave", label: "Time off", icon: HandHeart, href: "/leave", group: "Me" },
    { id: "learning", label: "Learning", icon: GraduationCap, href: "/learning", group: "Me" },
    { id: "performance", label: "Performance", icon: Target, href: "/performance", group: "Me" },
    { id: "pay", label: "Pay", icon: WalletCards, href: "/pay", group: "Me" },
    { id: "assets", label: "Equipment", icon: Laptop, href: "/assets", group: "Support" },
    { id: "notifications", label: "Notifications", icon: Bell, href: "/notifications", group: "Support" },
    { id: "help", label: "Help & support", icon: LifeBuoy, href: "/help", group: "Support" },
    { id: "profile", label: "Profile", icon: UserRound, href: "/profile", group: "Support" }
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
  const [supportRequests, setSupportRequests] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const manager = isPeopleManager(profile, staffProfile);
  const peopleAdministrator = isPeopleAdministrator(profile, staffProfile);
  const canRecruit = canRecruitStaff(profile, staffProfile);

  useEffect(() => {
    if (!user?.uid) return undefined;
    setReady(false);
    setError("");
    let active = true;
    const baseSources = ["profile", "tasks", "shifts", "leave", "training", "performance", "payroll", "assets", "support"];
    const expectedSources = manager ? [...baseSources, "directory", "workforce"] : baseSources;
    const settledSources = new Set();
    const settle = (source) => {
      if (!active || settledSources.has(source)) return;
      settledSources.add(source);
      if (settledSources.size >= expectedSources.length) setReady(true);
    };
    const onError = (source) => (reason) => {
      if (!active) return;
      const detail = reason?.message || "Some workforce information could not be loaded.";
      setError((current) => current ? `${current} ${detail}` : detail);
      settle(source);
    };
    const receive = (source, setter) => (value) => {
      if (!active) return;
      setter(value);
      settle(source);
    };
    const broadScope = manager ? {} : { userId: user.uid };
    const ownScope = { userId: user.uid };
    const payrollScope = peopleAdministrator ? broadScope : ownScope;
    const supportScope = peopleAdministrator ? broadScope : ownScope;
    const cleanups = [
      subscribeStaffProfile(user.uid, receive("profile", setStaffProfile), onError("profile")),
      subscribeStaffTasks(receive("tasks", setTasks), { assigneeId: manager ? undefined : user.uid, onError: onError("tasks") }),
      subscribeStaffShifts(receive("shifts", setShifts), { ...broadScope, onError: onError("shifts") }),
      subscribeLeaveRequests(receive("leave", setLeave), { ...broadScope, onError: onError("leave") }),
      subscribeTrainingAssignments(receive("training", setTraining), { ...broadScope, onError: onError("training") }),
      subscribePerformanceRecords(receive("performance", setPerformance), { ...broadScope, onError: onError("performance") }),
      subscribePayrollRecords(receive("payroll", setPayroll), { ...payrollScope, onError: onError("payroll") }),
      subscribeStaffAssets(receive("assets", setAssets), { userId: manager ? undefined : user.uid, onError: onError("assets") }),
      subscribeStaffSupportRequests(receive("support", setSupportRequests), { ...supportScope, onError: onError("support") })
    ];
    if (manager) {
      cleanups.push(subscribeStaffDirectory(receive("directory", setDirectory), { managerId: peopleAdministrator ? undefined : user.uid, onError: onError("directory") }));
      cleanups.push(subscribeWorkforceRequests(receive("workforce", setWorkforceRequests), onError("workforce")));
    }
    return () => {
      active = false;
      cleanups.forEach((cleanup) => cleanup?.());
    };
  }, [user?.uid, manager, peopleAdministrator]);

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
    supportRequests,
    ready,
    error,
    manager,
    peopleAdministrator,
    canRecruit,
    lifecycle: staffLifecycleFor(staffProfile),
    rolePack: rolePackFor(profile, staffProfile)
  };
}

function StaffAccess({ data, children }) {
  if (!data.ready) {
    return <main className="min-h-screen bg-[var(--background)] px-4 py-10"><div className="mx-auto max-w-5xl space-y-5"><div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-2)]" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl bg-[var(--surface-2)]" />)}</div></div></main>;
  }
  const allowed = hasStaffAccess(data.profile, data.staffProfile);
  if (allowed) return children;
  const reference = data.user?.uid ? data.user.uid.slice(0, 8).toUpperCase() : "NOT-AVAILABLE";
  const status = data.staffProfile?.status || "not_ready";
  const blocked = {
    suspended: { title: "Your Staff access is suspended", description: "Your employment record is still held by Spotly, but Staff access is temporarily disabled. Contact People Operations for the reason, review process, and next step." },
    offboarding: { title: "Your Staff access is in offboarding", description: "Your normal workspace is closed while Spotly completes access removal, equipment return, final People Operations steps, and any remaining employment administration." },
    former: { title: "This Staff profile is no longer active", description: "Your former-employee record remains protected, but the day-to-day Staff workspace is no longer available." },
    alumni: { title: "This Staff profile is no longer active", description: "Your former-employee record remains protected, but the day-to-day Staff workspace is no longer available." }
  }[status];
  const title = blocked?.title || "Your staff profile is not ready";
  const description = blocked?.description || "Spotly Staff is available to employees, contractors, interns, and approved internal operators. People Operations must finish linking your employment profile before you can continue.";

  return <main className="flex min-h-screen items-center justify-center bg-grouped px-4 py-10"><Card elevated className="w-full max-w-xl p-7 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><LockKeyhole className="h-7 w-7" /></span><h1 className="mt-5 text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-secondary">{description}</p><div className="mt-5 rounded-xl bg-grouped p-4 text-left text-sm leading-6"><p className="font-semibold">Signed in as</p><p className="text-secondary">{data.user?.displayName || data.user?.email}</p><p className="mt-3 font-semibold">Employment state</p><p className="text-secondary">{data.lifecycle?.label || "Profile not linked"}</p><p className="mt-3 font-semibold">Reference</p><p className="font-mono text-secondary">{reference}</p></div><div className="mt-6 grid gap-2 sm:grid-cols-2"><Button asChild><Link href={spotlyPortalUrl("customer", `/support?subject=${encodeURIComponent(`Staff access: ${status}`)}`)}>Contact People Operations</Link></Button><Button asChild variant="outline"><Link href={spotlyPortalUrl("customer", "/account")}>Return to account</Link></Button></div></Card></main>;
}

function SectionIntro({ section, actions }) {
  return <PageHeader {...sectionMeta[section]} actions={actions} />;
}

function roleQueue(packId) {
  const queues = {
    support_agent: { title: "Customer and business conversations", description: "Respond, assign, escalate, add internal notes, and close resolved support work.", href: "/work?queue=operations", icon: Headphones },
    verification_officer: { title: "Business verification queue", description: "Review ownership evidence, parent-company relationships, risk, and publication readiness.", href: "/work?queue=operations", icon: ShieldCheck },
    business_success_manager: { title: "Business readiness queue", description: "Guide businesses through setup, catalogue readiness, parent approvals, and launch.", href: "/work?queue=business-readiness", icon: Store },
    finance_admin: { title: "Payment and payout exceptions", description: "Review settlements, reconciliation, refunds, payout holds, and finance tasks.", href: "/work?queue=finance", icon: WalletCards },
    operations_manager: { title: "Platform operations control", description: "Review claims, support, launch readiness, incidents, staffing coverage, and escalations.", href: "/work?queue=operations", icon: ClipboardList },
    regional_operations_manager: { title: "Regional operations", description: "Review assigned cities or provinces, business readiness, service issues, and team coverage.", href: "/work?queue=operations", icon: MapPin },
    driver_operations_coordinator: { title: "Driver and fleet operations", description: "Review onboarding, document compliance, availability, incidents, and field support.", href: "/work?queue=driver-operations", icon: PackageCheck },
    people_operations_admin: { title: "People operations", description: "Run hiring, onboarding, leave, payroll preparation, training, assets, and offboarding.", href: "/work?queue=people", icon: UsersRound },
    platform_admin: { title: "Platform control centre", description: "Operate configuration, access, diagnostics, audit, incidents, and cross-functional queues.", href: "/work?queue=platform", icon: ShieldCheck },
    content_editor: { title: "Content operations", description: "Manage help resources, announcements, training content, public pages, and translations.", href: "/work?queue=content", icon: BookOpenCheck }
  };
  return queues[packId] || { title: "Assigned Spotly work", description: "Open the operating queue associated with your role and current assignments.", href: "/work", icon: ListChecks };
}

function TaskRow({ task, user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const due = dueLabel(task);
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
  return <div className="grid gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[44px_1fr_auto] sm:items-start"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><ClipboardCheck className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{task.title || "Assigned work"}</p><StatusBadge status={task.status || "open"} />{task.priority && <Badge tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"}>{task.priority}</Badge>}<Badge tone={due.tone}>{due.label}</Badge></div><p className="mt-2 text-sm leading-6 text-secondary">{task.description || task.queue || "Open the task for its full operating context."}</p><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-lg bg-grouped p-2.5"><span className="text-tertiary">Owner</span><span className="ml-2 font-semibold text-[var(--text)]">{task.assigneeName || (task.assigneeId === user?.uid ? "You" : task.ownerName || task.department || "Unassigned")}</span></div><div className="rounded-lg bg-grouped p-2.5"><span className="text-tertiary">Next</span><span className="ml-2 font-semibold text-[var(--text)]">{nextActionFor(task)}</span></div></div></div><div className="flex flex-wrap gap-2 sm:justify-end"><Button asChild size="sm" variant="ghost"><Link href={`/work?task=${encodeURIComponent(task.id)}`}>Open</Link></Button>{!["completed", "cancelled"].includes(task.status) && <Button size="sm" variant="outline" onClick={complete} loading={loading}><Check className="h-4 w-4" />Complete</Button>}</div></div>;
}

function Today({ data, openModal }) {
  const ownTasks = data.manager ? data.tasks.filter((task) => task.assigneeId === data.user.uid || (!task.assigneeId && task.createdBy === data.user.uid)) : data.tasks;
  const openTasks = sortTasks(ownTasks.filter((task) => !["completed", "cancelled"].includes(task.status)));
  const overdueTasks = openTasks.filter((task) => taskDueDate(task) && taskDueDate(task).getTime() < Date.now());
  const ownTraining = data.training.filter((item) => !data.manager || item.userId === data.user.uid);
  const pendingTraining = ownTraining.filter((item) => !["completed", "passed"].includes(item.status));
  const overdueLearning = pendingTraining.filter((item) => toDate(item.dueDate) && toDate(item.dueDate).getTime() < Date.now());
  const today = harareDateKey();
  const todaysShift = data.shifts.find((shift) => shift.userId === data.user.uid && (String(shift.date || "").slice(0, 10) === today || (toDate(shift.startAt) ? harareDateKey(toDate(shift.startAt)) === today : false)));
  const directReportIds = new Set(data.directory.filter((person) => person.managerId === data.user.uid).map((person) => person.userId || person.id));
  const pendingLeave = data.manager ? data.leave.filter((item) => item.status === "pending" && (data.peopleAdministrator || directReportIds.has(item.userId))) : [];
  const pendingRequests = data.canRecruit ? data.workforceRequests.filter((item) => item.status === "submitted") : [];
  const roleName = data.staffProfile?.roleTitle || data.rolePack?.name || "Spotly staff member";
  const name = staffDisplayName(data.staffProfile || data.profile, data.user?.displayName || data.user?.email || "there");
  const queue = roleQueue(data.rolePack?.id);
  const QueueIcon = queue.icon;
  const tools = roleTools(data);
  const directReports = data.manager ? data.directory.filter((person) => person.managerId === data.user.uid) : [];
  const teamShiftIds = new Set(data.shifts.filter((shift) => String(shift.date || "").slice(0, 10) === today || (toDate(shift.startAt) && harareDateKey(toDate(shift.startAt)) === today)).filter((shift) => ["scheduled", "in_progress"].includes(shift.status)).map((shift) => shift.userId));
  const teamWorking = directReports.filter((person) => teamShiftIds.has(person.userId || person.id)).length;
  const teamBlocked = directReports.filter((person) => ["suspended", "offboarding"].includes(person.status)).length;
  const firstDayChecklist = [
    { label: "Account and personal details", done: Boolean(data.staffProfile?.onboardingChecklist?.account && data.staffProfile?.onboardingChecklist?.personalDetails), href: "/profile" },
    { label: "Role and manager confirmed", done: Boolean(data.staffProfile?.rolePackId && data.staffProfile?.managerId), href: "/profile" },
    { label: "Required learning", done: pendingTraining.length === 0, href: "/learning" },
    { label: "Equipment ready", done: !(data.rolePack?.equipment || []).length || data.assets.some((asset) => (asset.assignedTo || asset.userId) === data.user.uid && !["returned", "lost"].includes(asset.status)), href: "/assets" },
    { label: "First shift visible", done: Boolean(todaysShift || data.shifts.some((shift) => shift.userId === data.user.uid)), href: "/schedule" }
  ];
  const agenda = [
    ...(todaysShift ? [{ id: `shift-${todaysShift.id}`, time: timeLabel(todaysShift.startAt, todaysShift.startTime || "08:00"), title: todaysShift.status === "in_progress" ? "Shift in progress" : "Shift starts", detail: todaysShift.location || todaysShift.workArrangement || "Your usual work arrangement", href: "/schedule", icon: Clock3 }] : []),
    ...openTasks.slice(0, 4).map((task) => ({ id: `task-${task.id}`, time: dueLabel(task).label, title: task.title || "Assigned work", detail: nextActionFor(task), href: `/work?task=${encodeURIComponent(task.id)}`, icon: ClipboardCheck })),
    ...pendingTraining.slice(0, 1).map((item) => ({ id: `training-${item.id}`, time: item.dueDate ? dateLabel(item.dueDate) : "Required", title: item.title || "Required learning", detail: item.description || "Complete the learning required for your role.", href: "/learning", icon: GraduationCap }))
  ];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">{new Intl.DateTimeFormat("en-ZW", { timeZone: "Africa/Harare", weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">Good {harareNow().getHours() < 12 ? "morning" : harareNow().getHours() < 18 ? "afternoon" : "evening"}, {name.split(" ")[0]}</h1><p className="mt-2 text-sm text-secondary">{roleName} · {data.staffProfile?.department || data.rolePack?.department || "Spotly"}</p></div><div className="flex flex-wrap gap-2">{todaysShift ? <ShiftCard shift={todaysShift} user={data.user} compact /> : <Button asChild variant="outline"><Link href="/schedule"><CalendarDays className="h-4 w-4" />No shift today</Link></Button>}<Button variant="outline" onClick={() => openModal("support")}><Headphones className="h-4 w-4" />Ask for help</Button></div></div>

    {["preboarding", "probation", "leave"].includes(data.staffProfile?.status) && <Card className="border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] bg-[var(--accent-soft)] p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)]"><IdCard className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{data.lifecycle.label}</p><StatusBadge status={data.staffProfile?.status} /></div><p className="mt-1 text-sm leading-6 text-secondary">{data.lifecycle.description}</p>{data.staffProfile?.status === "preboarding" && <div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm"><Link href="/learning">Required learning</Link></Button><Button asChild size="sm" variant="outline"><Link href="/profile">Check your profile</Link></Button></div>}</div></div></Card>}

    {["preboarding", "probation"].includes(data.staffProfile?.status) && <SectionCard title="Starting at Spotly" description="A practical first-day checklist generated from your actual Staff setup"><div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-5">{firstDayChecklist.map((item) => <Link key={item.label} href={item.href} className="rounded-xl border bg-[var(--surface)] p-4 transition hover:bg-grouped"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.done ? "bg-[var(--success-soft)] text-success" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}>{item.done ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</span><p className="mt-3 text-sm font-semibold">{item.label}</p><p className="mt-1 text-xs text-secondary">{item.done ? "Ready" : "Needs attention"}</p></Link>)}</div></SectionCard>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Open work" value={String(openTasks.length)} hint={overdueTasks.length ? `${overdueTasks.length} overdue` : "No overdue tasks"} icon={ClipboardCheck} tone={overdueTasks.length ? "danger" : "success"} /><MetricCard label="Required learning" value={String(pendingTraining.length)} hint={overdueLearning.length ? `${overdueLearning.length} overdue` : "Current"} icon={GraduationCap} tone={overdueLearning.length ? "warning" : "neutral"} /><MetricCard label="Today’s shift" value={todaysShift ? (todaysShift.status === "in_progress" ? "Working" : timeLabel(todaysShift.startAt, todaysShift.startTime || "08:00")) : "No shift"} hint={todaysShift?.location || "Check schedule for the next shift"} icon={Clock3} />{data.manager ? <MetricCard label="Direct reports working" value={`${teamWorking}/${directReports.length}`} hint={teamBlocked ? `${teamBlocked} need lifecycle attention` : "Today’s scheduled coverage"} icon={UsersRound} tone={teamBlocked ? "warning" : "neutral"} /> : <MetricCard label="Employment" value={data.lifecycle.label} hint={data.staffProfile?.employmentType || "Spotly staff"} icon={IdCard} />}</div>

    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><SectionCard title="What needs your attention" description="Shift, due work and required learning ordered around the next action"><div>{agenda.map(({ id, time, title, detail, href, icon: Icon }) => <Link key={id} href={href} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-4 py-4 transition hover:bg-grouped last:border-b-0 sm:grid-cols-[120px_40px_1fr_auto] sm:items-start"><span className="order-2 text-xs font-semibold text-tertiary sm:order-none sm:pt-2">{time}</span><span className="order-1 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] sm:order-none"><Icon className="h-5 w-5" /></span><span className="col-span-2 order-3 sm:col-span-1 sm:order-none"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm leading-6 text-secondary">{detail}</span></span><ArrowRight className="order-4 mt-1 h-4 w-4 text-tertiary sm:mt-3" /></Link>)}{!agenda.length && <EmptyState icon={CheckCircle2} title="Nothing needs action right now" description="New assignments, learning, approvals and schedule changes will appear here with a clear next step." />}</div></SectionCard><div className="space-y-5"><SectionCard title="Your operating queue" description={queue.description}><div className="p-5"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><QueueIcon className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-semibold">{queue.title}</h2><Button asChild className="mt-5 w-full"><Link href={queue.href}>Open queue<ArrowRight className="h-4 w-4" /></Link></Button></div></SectionCard>{data.manager && <SectionCard title="Manager decisions" description="Approvals and staffing exceptions waiting on you"><div className="divide-y"><Link href="/leave" className="flex items-center justify-between p-4 hover:bg-grouped"><span><span className="block font-semibold">Time-off requests</span><span className="text-sm text-secondary">{pendingLeave.length} waiting</span></span><Badge tone={pendingLeave.length ? "warning" : "success"}>{pendingLeave.length}</Badge></Link>{data.canRecruit && <Link href="/hiring" className="flex items-center justify-between p-4 hover:bg-grouped"><span><span className="block font-semibold">Headcount requests</span><span className="text-sm text-secondary">{pendingRequests.length} waiting</span></span><Badge tone={pendingRequests.length ? "warning" : "success"}>{pendingRequests.length}</Badge></Link>}<Link href="/team" className="flex items-center justify-between p-4 hover:bg-grouped"><span><span className="block font-semibold">Team lifecycle</span><span className="text-sm text-secondary">{teamBlocked} blocked or offboarding</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link></div></SectionCard>}</div></div>

    {tools.length > 0 && <SectionCard title="Role tools" description="Cross-product tools are shown only when your role needs them"><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">{tools.map(({ label, detail, href, icon: Icon }) => <a key={label} href={href} className="group rounded-xl border bg-[var(--surface)] p-4 transition hover:border-strong hover:shadow-card"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span><p className="mt-4 font-semibold">{label}</p><p className="mt-1 text-xs leading-5 text-secondary">{detail}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">Open tool<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span></a>)}</div></SectionCard>}

    <SectionCard title="Assigned work" description="Priority, due/SLA and next action are visible before you open the task" action={<Link href="/work" className="text-sm font-semibold text-[var(--accent)]">View all</Link>}><div>{openTasks.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} user={data.user} />)}{!openTasks.length && <EmptyState icon={CheckCircle2} title="You are clear for now" description="New work will appear here with an owner, priority, due time and direct next action." />}</div></SectionCard>{data.error && <Card className="border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--on-warning-soft)]"><AlertTriangle className="mr-2 inline h-4 w-4" />{data.error}</Card>}
  </div>;
}

function Work({ data, openModal }) {
  const params = useSearchParams();
  const taskId = params.get("task");
  const requestedQueue = params.get("queue") || "";
  const [filter, setFilter] = useState("open");
  const [queryText, setQueryText] = useState("");
  const scopedTasks = data.manager ? data.tasks.filter((task) => task.assigneeId === data.user.uid || (!task.assigneeId && task.createdBy === data.user.uid)) : data.tasks;
  const selectedTask = scopedTasks.find((task) => task.id === taskId) || null;
  const openAll = sortTasks(scopedTasks.filter((task) => !["completed", "cancelled"].includes(task.status)));
  const overdueCount = openAll.filter((task) => taskDueDate(task) && taskDueDate(task).getTime() < Date.now()).length;
  const urgentCount = openAll.filter((task) => ["urgent", "high"].includes(task.priority)).length;
  const visible = sortTasks(scopedTasks).filter((task) => {
    const queueText = requestedQueue.replaceAll("-", " ").toLowerCase();
    const matchesQueue = !requestedQueue || [task.queue, task.department, task.queueId].filter(Boolean).join(" ").toLowerCase().includes(queueText);
    const matchesFilter = filter === "all" || (filter === "open" && !["completed", "cancelled"].includes(task.status)) || (filter === "overdue" && !["completed", "cancelled"].includes(task.status) && taskDueDate(task) && taskDueDate(task).getTime() < Date.now()) || task.status === filter;
    const matchesText = [task.title, task.description, task.department, task.queue, task.priority, task.assigneeName, task.nextAction].filter(Boolean).join(" ").toLowerCase().includes(queryText.toLowerCase());
    return matchesQueue && matchesFilter && matchesText;
  });
  return <div className="space-y-6"><SectionIntro section="work" actions={<Button onClick={() => openModal("task")}><Plus className="h-4 w-4" />Add task</Button>} /><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Open" value={String(openAll.length)} hint="Your current operating queue" icon={ListChecks} /><MetricCard label="Overdue" value={String(overdueCount)} hint={overdueCount ? "Needs immediate attention" : "Nothing overdue"} icon={Clock3} tone={overdueCount ? "danger" : "success"} /><MetricCard label="High priority" value={String(urgentCount)} hint="Urgent or high priority" icon={AlertTriangle} tone={urgentCount ? "warning" : "neutral"} /></div>{requestedQueue && <Card variant="bordered" className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Scoped queue: {requestedQueue.replaceAll("-", " ")}</p><p className="mt-1 text-sm text-secondary">Only work mapped to this operating queue is shown. Priority and SLA still determine the order.</p></div><Button asChild size="sm" variant="ghost"><Link href="/work">Clear queue</Link></Button></div></Card>}<div className="grid gap-3 xl:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search title, owner, queue, priority or next action" /><Tabs idPrefix="staff-work-status" value={filter} onChange={setFilter} tabs={[{ value: "open", label: "Open" }, { value: "overdue", label: `Overdue (${overdueCount})` }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Completed" }, { value: "all", label: "All" }]} /></div><SectionCard title="Personal work queue" description="Each item shows priority, owner, due/SLA and the next useful action"><div>{visible.map((task) => <TaskRow key={task.id} task={task} user={data.user} />)}{!visible.length && <EmptyState icon={ClipboardList} title="No work matches this view" description="Change the filter or queue. When new work is assigned, it will appear here with a clear owner, deadline and next action." action={<Button variant="outline" onClick={() => openModal("task")}>Add task</Button>} />}</div></SectionCard><Modal open={Boolean(taskId)} onClose={() => window.history.replaceState(null, "", requestedQueue ? `/work?queue=${encodeURIComponent(requestedQueue)}` : "/work")} title={selectedTask?.title || "Task not found"} description={selectedTask ? "Complete the work with owner, SLA, checklist and context visible." : "This task is not available in your assigned work."}>{selectedTask ? <div className="space-y-5 p-5"><div className="flex flex-wrap gap-2"><StatusBadge status={selectedTask.status || "open"} /><Badge tone={selectedTask.priority === "urgent" ? "danger" : selectedTask.priority === "high" ? "warning" : "neutral"}>{selectedTask.priority || "normal"}</Badge><Badge tone={dueLabel(selectedTask).tone}>{dueLabel(selectedTask).label}</Badge></div><div className="grid gap-3 sm:grid-cols-3"><Card variant="plain" className="bg-grouped p-4"><p className="text-xs text-tertiary">Owner</p><p className="mt-1 font-semibold">{selectedTask.assigneeName || (selectedTask.assigneeId === data.user.uid ? "You" : selectedTask.ownerName || "Unassigned")}</p></Card><Card variant="plain" className="bg-grouped p-4"><p className="text-xs text-tertiary">Queue</p><p className="mt-1 font-semibold">{selectedTask.queue || selectedTask.department || "Spotly"}</p></Card><Card variant="plain" className="bg-grouped p-4"><p className="text-xs text-tertiary">Next action</p><p className="mt-1 font-semibold">{nextActionFor(selectedTask)}</p></Card></div><div><h3 className="font-semibold">Context</h3><p className="mt-2 text-sm leading-7 text-secondary">{selectedTask.description || "No additional context was recorded."}</p></div><div><h3 className="font-semibold">Checklist</h3><div className="mt-3 space-y-2">{(selectedTask.checklist || ["Review the linked context", "Complete the required action", "Record the outcome"]).map((item, index) => <label key={`${typeof item === "string" ? item : item.label}-${index}`} className="flex items-start gap-3 rounded-lg border p-3"><input type="checkbox" className="mt-1" defaultChecked={Boolean(item.completed)} /><span className="text-sm">{typeof item === "string" ? item : item.label}</span></label>)}</div></div><div className="flex flex-wrap gap-2 border-t pt-4"><Button onClick={() => updateStaffTask(selectedTask.id, { status: "completed", completedAt: new Date().toISOString() }, data.user)}>Mark complete</Button><Button asChild variant="outline"><Link href={`/help?topic=staff-task&reference=${encodeURIComponent(selectedTask.id)}`}>Ask for help</Link></Button></div></div> : <EmptyState icon={ClipboardList} title="Task unavailable" description="It may have been removed, reassigned, or outside your staff scope." />}</Modal></div>;
}

function Team({ data, openModal }) {
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState("active");
  const teamScope = data.peopleAdministrator ? data.directory : data.directory.filter((person) => person.managerId === data.user.uid || (person.userId || person.id) === data.user.uid);
  const today = harareDateKey();
  const todayShifts = data.shifts.filter((shift) => String(shift.date || "").slice(0, 10) === today || (toDate(shift.startAt) && harareDateKey(toDate(shift.startAt)) === today));
  const workingIds = new Set(todayShifts.filter((shift) => shift.status === "in_progress").map((shift) => shift.userId));
  const scheduledIds = new Set(todayShifts.filter((shift) => ["scheduled", "in_progress"].includes(shift.status)).map((shift) => shift.userId));
  const teamIds = new Set(teamScope.map((person) => person.userId || person.id));
  const pendingLeave = data.leave.filter((request) => request.status === "pending" && request.userId !== data.user.uid && teamIds.has(request.userId));
  const lifecycleAttention = teamScope.filter((person) => ["preboarding", "suspended", "offboarding"].includes(person.status) || !person.managerId);
  const visible = teamScope.filter((person) => {
    const matchesText = [person.displayName, person.email, person.department, person.roleTitle, person.employeeNumber, person.managerName].filter(Boolean).join(" ").toLowerCase().includes(queryText.toLowerCase());
    const matchesFilter = filter === "all" || person.status === filter || (filter === "active" && ["active", "probation", "leave"].includes(person.status)) || (filter === "attention" && (["preboarding", "suspended", "offboarding"].includes(person.status) || !person.managerId));
    return matchesText && matchesFilter;
  });
  const activeCount = teamScope.filter((person) => ["active", "probation", "leave"].includes(person.status)).length;
  return <div className="space-y-6">
    <SectionIntro section="team" actions={data.peopleAdministrator ? <Button asChild><Link href="/hiring"><UserPlus className="h-4 w-4" />Add from hiring</Link></Button> : <Badge tone="neutral">Your reporting team</Badge>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Active people" value={String(activeCount)} hint={data.peopleAdministrator ? "Across Staff" : "In your reporting team"} icon={UsersRound} /><MetricCard label="Working now" value={String(teamScope.filter((person) => workingIds.has(person.userId || person.id)).length)} hint={`${teamScope.filter((person) => scheduledIds.has(person.userId || person.id)).length} scheduled today`} icon={Clock3} /><MetricCard label="Approvals" value={String(pendingLeave.length)} hint="Time-off requests waiting" icon={UserCheck} tone={pendingLeave.length ? "warning" : "success"} /><MetricCard label="Needs attention" value={String(lifecycleAttention.length)} hint="Preboarding, access or reporting line" icon={AlertTriangle} tone={lifecycleAttention.length ? "warning" : "success"} /></div>
    <div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search name, role, manager, department or employee number" /><Tabs idPrefix="staff-team-filter" value={filter} onChange={setFilter} tabs={[{ value: "active", label: "Active" }, { value: "attention", label: `Attention (${lifecycleAttention.length})` }, { value: "preboarding", label: "Preboarding" }, { value: "offboarding", label: "Offboarding" }, { value: "all", label: "All" }]} /></div>
    <SectionCard title={data.peopleAdministrator ? "People directory" : "Your team"} description="Role, reporting line, employment state and today’s working state are visible together">{visible.length ? <>
      <div className="grid gap-3 p-3 md:grid-cols-2 xl:hidden">{visible.map((person) => { const id = person.userId || person.id; return <article key={person.id} className="rounded-xl border bg-[var(--surface)] p-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] font-bold text-[var(--accent)]">{staffDisplayName(person).split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{staffDisplayName(person)}</h3><p className="mt-1 text-xs text-secondary">{person.email || person.employeeNumber || "Contact not set"}</p></div><StatusBadge status={person.status || "active"} /></div><p className="mt-3 text-sm font-semibold">{person.roleTitle || STAFF_ROLE_PACKS[person.rolePackId]?.name || "Role not assigned"}</p><p className="mt-1 text-xs text-secondary">{person.department || "Department not assigned"} · {person.employmentType || "Employment type not set"}</p><div className="mt-3 flex flex-wrap gap-2"><Badge tone={workingIds.has(id) ? "success" : scheduledIds.has(id) ? "info" : "neutral"}>{workingIds.has(id) ? "Working now" : scheduledIds.has(id) ? "Scheduled today" : "No shift today"}</Badge>{!person.managerId && <Badge tone="warning">Manager missing</Badge>}</div><p className="mt-3 text-xs text-tertiary">Reports to: {person.managerName || (person.managerId ? "Assigned manager" : "Not assigned")}</p>{person.startDate && <p className="mt-1 text-xs text-tertiary">Started {dateLabel(person.startDate)}</p>}</div></div>{data.peopleAdministrator && <Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => openModal("staff", person)}>Open employee record</Button>}</article>; })}</div>
      <div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Person</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Reports to</th><th className="px-5 py-3">Today</th><th className="px-5 py-3">Employment</th><th className="px-5 py-3">State</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((person) => { const id = person.userId || person.id; return <tr key={person.id} className="border-t"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] font-bold text-[var(--accent)]">{staffDisplayName(person).split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><p className="font-semibold">{staffDisplayName(person)}</p><p className="mt-1 text-xs text-secondary">{person.email || person.employeeNumber || "Contact not set"}</p></div></div></td><td className="px-5 py-4"><p className="font-semibold">{person.roleTitle || STAFF_ROLE_PACKS[person.rolePackId]?.name || "Role not assigned"}</p><p className="mt-1 text-xs text-secondary">{person.department || "Department not assigned"}</p></td><td className="px-5 py-4"><p>{person.managerName || (person.managerId ? "Assigned manager" : "Not assigned")}</p>{!person.managerId && <span className="mt-1 inline-block text-xs font-semibold text-warning">Needs reporting line</span>}</td><td className="px-5 py-4"><Badge tone={workingIds.has(id) ? "success" : scheduledIds.has(id) ? "info" : "neutral"}>{workingIds.has(id) ? "Working" : scheduledIds.has(id) ? "Scheduled" : "No shift"}</Badge></td><td className="px-5 py-4"><p>{person.employmentType || "Not set"}</p><p className="mt-1 text-xs text-secondary">{person.startDate ? `Since ${dateLabel(person.startDate)}` : "Start date not set"}</p></td><td className="px-5 py-4"><StatusBadge status={person.status || "active"} /></td><td className="px-5 py-4">{data.peopleAdministrator ? <Button size="sm" variant="outline" onClick={() => openModal("staff", person)}>Open record</Button> : <Badge tone="neutral">View only</Badge>}</td></tr>; })}</tbody></table></div>
    </> : <EmptyState icon={UsersRound} title="No staff records match this view" description={data.peopleAdministrator ? "Employees flow here from hiring and onboarding. Change the filter or start from Hiring." : "Your direct reports will appear here once People Operations assigns reporting lines."} action={data.peopleAdministrator ? <Button asChild variant="outline"><Link href="/hiring">Open Hiring</Link></Button> : null} />}</SectionCard>
  </div>;
}

function Hiring({ data, openModal }) {
  return <StaffHiring data={data} openModal={openModal} />;
}

function ShiftCard({ shift, user, compact = false }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState("");
  const canClock = shift.userId === user?.uid;
  async function clock(action) {
    if (!canClock) return;
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
    if (canClock && shift.status === "scheduled") return <Button onClick={() => clock("in")} loading={loading === "in"}><Clock3 className="h-4 w-4" />Start shift</Button>;
    if (canClock && shift.status === "in_progress") return <Button variant="danger" onClick={() => clock("out")} loading={loading === "out"}>End shift</Button>;
    return <Button asChild variant="outline"><Link href="/schedule">View shift</Link></Button>;
  }
  return <div className="rounded-2xl bg-grouped p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-tertiary">{dateLabel(shift.date || shift.startAt)}</p><p className="mt-2 text-xl font-bold">{timeLabel(shift.startAt, shift.startTime || "08:00")}–{timeLabel(shift.endAt, shift.endTime || "17:00")}</p><p className="mt-1 text-sm text-secondary">{shift.location || shift.workArrangement || "Spotly workspace"}</p>{shift.employeeName && <p className="mt-2 text-xs font-semibold text-tertiary">{shift.employeeName}</p>}</div><StatusBadge status={shift.status || "scheduled"} /></div>{canClock && shift.status === "scheduled" && <Button className="mt-5 w-full" onClick={() => clock("in")} loading={loading === "in"}><Clock3 className="h-4 w-4" />Start my shift</Button>}{canClock && shift.status === "in_progress" && <Button variant="danger" className="mt-5 w-full" onClick={() => clock("out")} loading={loading === "out"}>End my shift</Button>}{shift.status === "completed" && <div className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--success-soft)] p-3 text-sm font-semibold text-[var(--on-success-soft)]"><CheckCircle2 className="h-4 w-4" />Shift completed</div>}{!canClock && <div className="mt-5 rounded-xl bg-[var(--surface)] p-3 text-xs leading-5 text-secondary">Attendance must be recorded by the assigned employee. Manager corrections remain separate and auditable.</div>}</div>;
}

function Schedule({ data, openModal }) {
  const directReportIds = new Set(data.directory.filter((person) => person.managerId === data.user.uid).map((person) => person.userId || person.id));
  const scopedShifts = data.peopleAdministrator ? data.shifts : data.manager ? data.shifts.filter((shift) => shift.userId === data.user.uid || directReportIds.has(shift.userId)) : data.shifts.filter((shift) => shift.userId === data.user.uid);
  const upcoming = [...scopedShifts].sort((a, b) => (toDate(a.startAt)?.getTime() || new Date(a.date || 0).getTime()) - (toDate(b.startAt)?.getTime() || new Date(b.date || 0).getTime()));
  const today = harareDateKey();
  const own = upcoming.filter((shift) => shift.userId === data.user.uid);
  const todayOwn = own.find((shift) => String(shift.date || "").slice(0, 10) === today || (toDate(shift.startAt) && harareDateKey(toDate(shift.startAt)) === today));
  const exceptions = scopedShifts.filter((shift) => ["missed", "late", "exception"].includes(shift.status));
  const inProgress = scopedShifts.filter((shift) => shift.status === "in_progress");
  return <div className="space-y-6"><SectionIntro section="schedule" actions={data.manager ? <Button onClick={() => openModal("shift")}><Plus className="h-4 w-4" />Add shift</Button> : null} />
    {!todayOwn && !data.manager && <Card className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><CalendarDays className="h-5 w-5" /></span><div><h2 className="font-semibold">No shift is scheduled for you today</h2><p className="mt-1 text-sm leading-6 text-secondary">This is not an error. Your next assigned shift appears below. If you expected to work today, ask your manager or People Operations before clocking time elsewhere.</p></div></div></Card>}
    <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Scheduled" value={String(data.manager ? scopedShifts.length : own.length)} hint={data.manager ? "Team shifts in this view" : "Your shifts in this view"} icon={CalendarDays} /><MetricCard label="Working now" value={String(data.manager ? inProgress.length : own.filter((shift) => shift.status === "in_progress").length)} hint="Clocked-in shifts" icon={Clock3} tone={inProgress.length ? "success" : "neutral"} /><MetricCard label="Attendance exceptions" value={String(data.manager ? exceptions.length : own.filter((shift) => ["missed", "late", "exception"].includes(shift.status)).length)} hint="Late, missed or needs review" icon={AlertTriangle} tone={exceptions.length ? "warning" : "success"} /></div>
    <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]"><SectionCard title={data.manager ? "Coverage guidance" : "How attendance works"}><div className="p-5"><div className="space-y-3"><div className="rounded-xl bg-grouped p-4"><p className="font-semibold">1. Check the assigned time and place</p><p className="mt-1 text-sm text-secondary">Each shift shows the expected working arrangement or location.</p></div><div className="rounded-xl bg-grouped p-4"><p className="font-semibold">2. Clock your own shift</p><p className="mt-1 text-sm text-secondary">Start and end actions are available only to the employee assigned to that shift.</p></div><div className="rounded-xl bg-grouped p-4"><p className="font-semibold">3. Exceptions stay visible</p><p className="mt-1 text-sm text-secondary">Late, missed or corrected attendance remains auditable instead of being silently overwritten.</p></div></div></div></SectionCard><SectionCard title={data.manager ? "Team schedule" : "Your upcoming shifts"} description={data.manager ? "Coverage and working state across the team" : "Mobile-first shift cards with direct clock actions"}><div className="grid gap-4 p-5 md:grid-cols-2">{(data.manager ? upcoming : own).map((shift) => <ShiftCard key={shift.id} shift={shift} user={data.user} />)}{!(data.manager ? upcoming : own).length && <div className="md:col-span-2"><EmptyState icon={CalendarDays} title="No shifts have been scheduled" description={data.manager ? "Add shifts for employees or use flexible schedule policies for eligible roles." : "Your manager has not assigned a shift. Your Staff workspace will show the next shift when one is added."} action={data.manager ? <Button variant="outline" onClick={() => openModal("shift")}>Add shift</Button> : null} /></div>}</div></SectionCard></div>
  </div>;
}

function Leave({ data, openModal }) {
  const directReportIds = new Set(data.directory.filter((person) => person.managerId === data.user.uid).map((person) => person.userId || person.id));
  const own = data.leave.filter((item) => item.userId === data.user.uid);
  const teamLeave = data.peopleAdministrator ? data.leave : data.manager ? data.leave.filter((item) => item.userId === data.user.uid || directReportIds.has(item.userId)) : own;
  const pending = teamLeave.filter((item) => item.status === "pending" && item.userId !== data.user.uid);
  return <div className="space-y-6"><SectionIntro section="leave" actions={<Button onClick={() => openModal("leave")}><Plus className="h-4 w-4" />Request leave</Button>} /><div className="metric-grid"><MetricCard label="Annual leave" value={`${data.staffProfile?.leaveBalances?.annual ?? 0} days`} hint="Available balance" icon={CalendarDays} /><MetricCard label="Sick leave" value={`${data.staffProfile?.leaveBalances?.sick ?? 0} days`} hint="Recorded balance" icon={HandHeart} /><MetricCard label="Pending requests" value={String(own.filter((item) => item.status === "pending").length)} hint="Your requests" icon={Clock3} />{data.manager && <MetricCard label="Team decisions" value={String(pending.length)} hint="Awaiting approval" icon={UserCheck} tone={pending.length ? "warning" : "success"} />}</div>{data.manager && pending.length > 0 && <SectionCard title="Manager approvals" description="Coverage should be reviewed before a decision"><div>{pending.map((request) => <LeaveApproval key={request.id} request={request} user={data.user} />)}</div></SectionCard>}<SectionCard title={data.manager ? "Leave register" : "Your requests"}><div>{(data.manager ? teamLeave : own).map((request) => <div key={request.id} className="flex flex-col gap-3 border-b p-5 last:border-b-0 sm:flex-row sm:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><HandHeart className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{request.type || "Leave request"}</p><p className="mt-1 text-sm text-secondary">{dateLabel(request.startDate)} – {dateLabel(request.endDate)} · {request.days || "Uncalculated"} day(s)</p><p className="mt-1 text-xs text-tertiary">{request.reason || "No private note added"}</p></div><StatusBadge status={request.status || "pending"} /></div>)}{!(data.manager ? teamLeave : own).length && <EmptyState icon={HandHeart} title="No leave requests yet" description="Available leave balances and all submitted requests will remain visible here." action={<Button variant="outline" onClick={() => openModal("leave")}>Request leave</Button>} />}</div></SectionCard></div>;
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
  const [quizAnswer, setQuizAnswer] = useState("");
  const [lessonStep, setLessonStep] = useState(0);
  const packTraining = data.rolePack?.training || [];
  const ownTraining = data.training.filter((item) => item.userId === data.user.uid || (!item.userId && !data.manager));
  const directReportIds = new Set(data.directory.filter((person) => person.managerId === data.user.uid).map((person) => person.userId || person.id));
  const teamTraining = data.manager ? data.training.filter((item) => item.userId && item.userId !== data.user.uid && (data.peopleAdministrator || directReportIds.has(item.userId))) : [];
  const assignedTitles = new Set(ownTraining.map((item) => item.title));
  const combined = [...ownTraining, ...packTraining.filter((title) => !assignedTitles.has(title)).map((title, index) => ({ id: `role-${index}`, title, status: "required", source: "role" }))];
  const teamOverdue = teamTraining.filter((item) => !["completed", "passed"].includes(item.status) && toDate(item.dueDate) && toDate(item.dueDate).getTime() < Date.now());
  const overdue = ownTraining.filter((item) => !["completed", "passed"].includes(item.status) && toDate(item.dueDate) && toDate(item.dueDate).getTime() < Date.now());
  const certifications = ownTraining.filter((item) => ["completed", "passed"].includes(item.status) && (item.certificateName || item.certification || item.renewalDate));
  const complete = combined.filter((item) => ["completed", "passed"].includes(item.status)).length;
  const progress = combined.length ? Math.round((complete / combined.length) * 100) : 100;

  async function finishLesson() {
    const expected = active?.quiz?.answer || "report";
    if (!active || !acknowledged || quizAnswer !== expected) {
      toast("Complete the checklist and answer the assessment before finishing.", { type: "error", title: "Assessment incomplete" });
      return;
    }
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
        assessmentScore: 100,
        completedAt: new Date().toISOString(),
        renewalDate: active.renewalDate || null
      }, data.user);
      toast("Your learning progress was saved.", { title: "Learning complete" });
      setActive(null);
      setAcknowledged(false);
      setQuizAnswer("");
      setLessonStep(0);
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not save learning" });
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6"><SectionIntro section="learning" /><Card className="p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><GraduationCap className="h-7 w-7" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Learning for {data.staffProfile?.roleTitle || data.rolePack?.name || "your role"}</h2><p className="mt-1 text-sm text-secondary">{complete} of {combined.length} required items complete</p></div><Badge tone={progress === 100 ? "success" : "accent"}>{progress}%</Badge></div><ProgressBar value={progress} className="mt-4" /></div></div></Card><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Required" value={String(combined.length)} hint={`${complete} complete`} icon={BookOpenCheck} /><MetricCard label="Overdue" value={String(overdue.length)} hint={overdue.length ? "Complete these first" : "Nothing overdue"} icon={Clock3} tone={overdue.length ? "warning" : "success"} /><MetricCard label="Certifications" value={String(certifications.length)} hint={certifications[0]?.renewalDate ? `Next renewal ${dateLabel(certifications[0].renewalDate)}` : "Completed credentials"} icon={BadgeCheck} /></div>{data.manager && <Card className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><UsersRound className="h-5 w-5" /></span><div><h2 className="font-semibold">Team learning attention</h2><p className="mt-1 text-sm text-secondary">{teamOverdue.length ? `${teamOverdue.length} overdue team learning item${teamOverdue.length === 1 ? "" : "s"} need follow-up.` : "No overdue team learning items in your current scope."}</p></div></div></Card>}<div className="grid gap-4 lg:grid-cols-2">{combined.map((item) => { const done = ["completed", "passed"].includes(item.status); return <Card key={item.id} className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><BookOpenCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><StatusBadge status={item.status || "assigned"} /></div><p className="mt-2 text-sm leading-6 text-secondary">{item.description || "Read the guidance, confirm your understanding, and complete any required acknowledgement."}</p><p className="mt-3 text-xs text-tertiary">{item.dueDate ? `Due ${dateLabel(item.dueDate)}` : item.source === "role" ? "Required for your role" : "No due date"}</p></div></div><Button className="mt-5 w-full" variant={done ? "outline" : "secondary"} onClick={() => { setActive(item); setAcknowledged(done); setQuizAnswer(done ? (item.quiz?.answer || "report") : ""); setLessonStep(0); }}>{done ? "Review learning" : "Continue learning"}<ArrowRight className="h-4 w-4" /></Button></Card>; })}{!combined.length && <div className="lg:col-span-2"><EmptyState icon={GraduationCap} title="No learning has been assigned" description="Required orientation, policy acknowledgements, quizzes, and renewals will appear here." /></div>}</div><Modal open={Boolean(active)} onClose={() => { setActive(null); setAcknowledged(false); setQuizAnswer(""); setLessonStep(0); }} title={active?.title || "Learning"} description="Read the material, complete the checklist and pass the short assessment."><div className="space-y-5 p-5"><div className="flex gap-2" aria-label="Lesson progress">{["Learn", "Check", "Assess"].map((label, index) => <div key={label} className="flex-1"><div className={`h-1.5 rounded-full ${index <= lessonStep ? "bg-[var(--accent)]" : "bg-grouped"}`} /><p className="mt-2 text-center text-xs text-secondary">{label}</p></div>)}</div>{lessonStep === 0 && <div className="space-y-4"><div className="rounded-xl bg-grouped p-5"><h3 className="font-semibold">What you need to know</h3><p className="mt-3 text-sm leading-7 text-secondary">{active?.content || active?.description || "This learning item introduces the standards, responsibilities, and operating steps required for your work at Spotly. Review the current approved procedure before continuing."}</p></div>{active?.videoUrl && <div className="aspect-video overflow-hidden rounded-xl border"><iframe className="h-full w-full" src={active.videoUrl} title={active.title} allowFullScreen /></div>}<Button className="w-full" onClick={() => setLessonStep(1)}>Continue to checklist</Button></div>}{lessonStep === 1 && <div className="space-y-4"><h3 className="font-semibold">Completion checklist</h3><ul className="space-y-2 text-sm leading-6 text-secondary">{(active?.checklist || ["I understand how this guidance applies to my work.", "I know where to ask for help or report an issue.", "I will follow the current approved procedure."]).map((item) => <li key={item} className="rounded-lg border p-3">{item}</li>)}</ul><label className="flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-4 w-4" /><span><span className="block font-semibold">I completed the checklist</span><span className="mt-1 block text-sm leading-6 text-secondary">Your completion and assessment result are saved to your learning history.</span></span></label><div className="flex gap-2"><Button variant="outline" onClick={() => setLessonStep(0)}>Back</Button><Button className="flex-1" onClick={() => setLessonStep(2)} disabled={!acknowledged}>Continue to assessment</Button></div></div>}{lessonStep === 2 && <div className="space-y-4"><div><h3 className="font-semibold">Short assessment</h3><p className="mt-2 text-sm leading-6 text-secondary">{active?.quiz?.question || "What should you do when you are unsure how to apply this procedure?"}</p></div><div className="space-y-2">{(active?.quiz?.options || [{ value: "guess", label: "Guess and continue" }, { value: "report", label: "Pause and ask the approved manager or support channel" }, { value: "ignore", label: "Ignore the procedure" }]).map((option) => <label key={option.value} className={`flex items-start gap-3 rounded-xl border p-4 ${quizAnswer === option.value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}><input type="radio" name="lesson-answer" value={option.value} checked={quizAnswer === option.value} onChange={(event) => setQuizAnswer(event.target.value)} className="mt-1" /><span className="text-sm font-semibold">{option.label}</span></label>)}</div>{quizAnswer && quizAnswer !== (active?.quiz?.answer || "report") && <p className="rounded-lg bg-[var(--danger-soft)] p-3 text-sm text-danger">Review the material and choose the safe approved response.</p>}<div className="flex gap-2"><Button variant="outline" onClick={() => setLessonStep(1)}>Back</Button>{!["completed", "passed"].includes(active?.status) ? <Button className="flex-1" onClick={finishLesson} loading={saving} disabled={!acknowledged || !quizAnswer}>Submit assessment</Button> : <Button className="flex-1" variant="outline" onClick={() => setActive(null)}>Close review</Button>}</div></div>}</div></Modal></div>;
}

function Performance({ data }) {
  const own = data.performance.filter((item) => item.userId === data.user.uid || (!item.userId && !data.manager));
  const directReportIds = new Set(data.directory.filter((person) => person.managerId === data.user.uid).map((person) => person.userId || person.id));
  const visible = data.peopleAdministrator ? data.performance : data.manager ? data.performance.filter((item) => item.userId === data.user.uid || directReportIds.has(item.userId)) : own;
  const due = visible.filter((item) => item.reviewDate && toDate(item.reviewDate) && toDate(item.reviewDate).getTime() <= Date.now() && !["completed", "closed"].includes(item.status));
  return <div className="space-y-6"><SectionIntro section="performance" /><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><SectionCard title="Current cycle" description={data.staffProfile?.probationEndDate ? `Probation ends ${dateLabel(data.staffProfile.probationEndDate)}` : "Role expectations and development"}><div className="p-5"><Target className="h-7 w-7 text-[var(--accent)]" /><h3 className="mt-4 text-lg font-bold">{data.staffProfile?.performanceCycle || "Quarterly check-in"}</h3><p className="mt-2 text-sm leading-6 text-secondary">Performance combines clear role expectations, regular manager conversations, recognition, coaching, and career development. It does not publicly rank employees.</p><p className="mt-5 rounded-xl bg-grouped p-3 text-sm text-secondary">Your manager will schedule the next check-in. Use Help & support to request an earlier conversation.</p></div></SectionCard><SectionCard title={data.manager ? "Team goals and check-ins" : "Your goals and check-ins"} description={data.manager ? `${due.length} review${due.length === 1 ? "" : "s"} due or overdue · coaching stays private to the reporting relationship` : "Goals, feedback and check-ins without public ranking"}><div>{visible.map((record) => <div key={record.id} className="border-b p-5 last:border-b-0"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{record.title || record.type || "Performance record"}</p>{data.manager && <p className="mt-1 text-xs font-semibold text-[var(--accent)]">{record.employeeName || record.userName || (record.userId === data.user.uid ? "You" : "Team member")}</p>}<p className="mt-1 text-sm leading-6 text-secondary">{record.summary || record.description || "No summary has been recorded."}</p></div><StatusBadge status={record.status || "active"} /></div>{record.progress !== undefined && <ProgressBar value={record.progress} className="mt-4" />}<p className="mt-3 text-xs text-tertiary">{record.reviewDate ? `Review ${dateLabel(record.reviewDate)}` : "Review date not set"}</p></div>)}{!visible.length && <EmptyState icon={Target} title="No performance records yet" description="Probation goals, check-ins, feedback, coaching plans, reviews, and development goals will appear here." />}</div></SectionCard></div></div>;
}

function Pay({ data }) {
  const records = sortByDate(data.payroll.filter((record) => record.userId === data.user.uid || record.employeeId === data.user.uid), "periodEnd");
  const latest = records[0];
  return <div className="space-y-6"><SectionIntro section="pay" actions={<Badge tone="neutral">Private</Badge>} /><div className="metric-grid"><MetricCard label="Latest net pay" value={latest ? currencyLabel(latest.netPay, latest.currency) : "Not available"} hint={latest ? `${dateLabel(latest.periodStart)} – ${dateLabel(latest.periodEnd)}` : "Payroll has not been published"} icon={BadgeDollarSign} /><MetricCard label="Allowances" value={latest ? currencyLabel(latest.allowances, latest.currency) : "—"} hint="Latest published period" icon={WalletCards} /><MetricCard label="Reimbursements" value={latest ? currencyLabel(latest.reimbursements, latest.currency) : "—"} hint="Approved expenses" icon={FileText} /><MetricCard label="Payment status" value={latest?.status ? latest.status.replaceAll("_", " ") : "Not available"} hint={latest?.paymentDate ? `Paid ${dateLabel(latest.paymentDate)}` : "People Operations controls publication"} icon={CheckCircle2} /></div><SectionCard title="Pay records" description="Sensitive information is visible only to the employee and authorized People or Finance staff"><div>{records.map((record) => <div key={record.id} className="flex flex-col gap-3 border-b p-5 last:border-b-0 sm:flex-row sm:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><WalletCards className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{dateLabel(record.periodStart)} – {dateLabel(record.periodEnd)}</p><p className="mt-1 text-sm text-secondary">Gross {currencyLabel(record.grossPay, record.currency)} · Deductions {currencyLabel(record.deductions, record.currency)}</p></div><div className="text-left sm:text-right"><p className="font-bold">{currencyLabel(record.netPay, record.currency)}</p><div className="mt-1"><StatusBadge status={record.status || "prepared"} /></div></div>{record.payslipUrl ? <Button asChild size="sm" variant="outline"><a href={record.payslipUrl} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />Open payslip</a></Button> : <span className="text-xs text-tertiary">Payslip not published</span>}</div>)}{!records.length && <EmptyState icon={WalletCards} title="No pay records are available" description="Published payslips, allowances, bonuses, deductions, reimbursements, and payment reconciliation will appear here." />}</div></SectionCard></div>;
}

function Assets({ data, openModal }) {
  const visibleAssets = data.peopleAdministrator ? data.assets : data.assets.filter((asset) => (asset.assignedTo || asset.userId) === data.user.uid);
  return <div className="space-y-6"><SectionIntro section="assets" actions={data.peopleAdministrator ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openModal("support", { category: "technical", subject: "Equipment issue" })}>Report issue</Button><Button onClick={() => openModal("asset")}><Plus className="h-4 w-4" />Issue asset</Button></div> : <Button variant="outline" onClick={() => openModal("support", { category: "technical", subject: "Equipment issue" })}>Report equipment issue</Button>} /><SectionCard>{visibleAssets.length ? <><div className="space-y-3 p-4 md:hidden">{visibleAssets.map((asset) => <Card key={asset.id} variant="bordered" className="p-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Laptop className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{asset.type || asset.name || "Equipment"}</p><StatusBadge status={asset.status || "assigned"} /></div><p className="mt-1 text-xs text-secondary">{asset.serialNumber || asset.assetNumber || asset.id}</p></div></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-tertiary">Assigned to</dt><dd className="mt-1 font-semibold">{asset.assignedToName || asset.assignedTo || "Unassigned"}</dd></div><div><dt className="text-xs text-tertiary">Issued</dt><dd className="mt-1 font-semibold">{dateLabel(asset.issuedAt)}</dd></div><div className="col-span-2"><dt className="text-xs text-tertiary">Condition</dt><dd className="mt-1 font-semibold">{asset.condition || "Not recorded"}</dd></div></dl></Card>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Asset</th><th className="px-5 py-3">Assigned to</th><th className="px-5 py-3">Issued</th><th className="px-5 py-3">Condition</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{visibleAssets.map((asset) => <tr key={asset.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold">{asset.type || asset.name || "Equipment"}</p><p className="mt-1 text-xs text-secondary">{asset.serialNumber || asset.assetNumber || asset.id}</p></td><td className="px-5 py-4">{asset.assignedToName || asset.assignedTo || "Unassigned"}</td><td className="px-5 py-4">{dateLabel(asset.issuedAt)}</td><td className="px-5 py-4">{asset.condition || "Not recorded"}</td><td className="px-5 py-4"><StatusBadge status={asset.status || "assigned"} /></td></tr>)}</tbody></table></div></> : <EmptyState icon={Laptop} title="No assets are recorded" description={data.peopleAdministrator ? "Issue laptops, phones, SIM cards, uniforms, badges, scanners, vehicles, and other equipment with condition and return tracking." : "Equipment issued to you will appear here with its condition and return obligations."} action={data.peopleAdministrator ? <Button variant="outline" onClick={() => openModal("asset")}>Issue asset</Button> : <Button variant="outline" onClick={() => openModal("support", { category: "technical", subject: "Equipment issue" })}>Report equipment issue</Button>} />}</SectionCard></div>;
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
  return <div className="space-y-6"><SectionIntro section="profile" actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openModal("profile_self", record)}>Edit my details</Button>{data.peopleAdministrator && <Button variant="outline" onClick={() => openModal("staff", record)}>Edit staff record</Button>}</div>} /><Card className="p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[var(--accent)] text-2xl font-semibold text-[var(--on-accent)]">{staffDisplayName(record, data.user?.displayName || data.user?.email).split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold">{staffDisplayName(record, data.user?.displayName || data.user?.email)}</h2><StatusBadge status={record.status || "active"} /></div><p className="mt-1 font-semibold text-[var(--accent)]">{record.roleTitle || pack?.name || "Spotly staff member"}</p><p className="mt-2 text-sm text-secondary">{record.email || data.user?.email}</p></div><Badge tone="accent">{record.department || pack?.department || "Spotly"}</Badge></div></Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sections.map(([title, value, Icon]) => <Card key={title} className="p-5"><Icon className="h-5 w-5 text-[var(--accent)]" /><p className="mt-4 text-xs font-bold uppercase tracking-[.14em] text-tertiary">{title}</p><p className="mt-2 font-semibold">{value}</p></Card>)}</div><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Role and access"><div className="p-5"><p className="text-sm leading-6 text-secondary">{pack?.summary || "Your access follows your employment, assigned responsibilities, work location, and any temporary approvals."}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-grouped p-3"><p className="text-xs text-tertiary">Access level</p><p className="mt-1 font-semibold">{data.manager ? "Manager" : "Team member"}</p></div><div className="rounded-xl bg-grouped p-3"><p className="text-xs text-tertiary">Assigned areas</p><p className="mt-1 font-semibold">{Math.max(1, new Set([...(record.permissions || []), ...(pack?.permissions || [])].map((item) => String(item).split(".")[0])).size)} work areas</p></div></div></div></SectionCard><SectionCard title="Emergency and contact details"><div className="p-5"><div className="space-y-4"><div className="flex items-center gap-3"><Phone className="h-5 w-5 text-[var(--accent)]" /><div><p className="text-sm font-semibold">Phone</p><p className="text-sm text-secondary">{record.phone || "Not provided"}</p></div></div><div className="flex items-center gap-3"><HeartHandshake className="h-5 w-5 text-[var(--accent)]" /><div><p className="text-sm font-semibold">Emergency contact</p><p className="text-sm text-secondary">{record.emergencyContactName || "Not provided"}{record.emergencyContactPhone ? ` · ${record.emergencyContactPhone}` : ""}</p></div></div></div></div></SectionCard></div></div>;
}

function StaffModal({ type, item, open, onClose, data }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({});
  useEffect(() => {
    if (!open) return;
    const defaults = {
      task: { title: "", description: "", priority: "normal", status: "open", assigneeId: data.user.uid, department: data.staffProfile?.department || data.rolePack?.department || "" },
      leave: { type: LEAVE_TYPES[0], startDate: "", endDate: "", reason: "", coverageNote: "", days: 1, userId: data.user.uid, employeeName: staffDisplayName(data.staffProfile || data.profile, data.user.email) },
      workforce: { roleTitle: "", department: STAFF_DEPARTMENTS[0], employmentType: STAFF_EMPLOYMENT_TYPES[0], reason: "", startDate: "", status: "submitted" },
      staff: { userId: "", displayName: "", email: "", rolePackId: "support_agent", roleTitle: STAFF_ROLE_PACKS.support_agent.name, department: STAFF_ROLE_PACKS.support_agent.department, employmentType: STAFF_EMPLOYMENT_TYPES[0], status: "preboarding", startDate: "", probationEndDate: "", managerId: "", endDate: "", offboardingReason: "", accessEndDate: "", equipmentReturnDue: "", handoverOwnerId: "", handoverOwnerName: "" },
      shift: { userId: "", employeeName: "", date: "", startTime: "08:00", endTime: "17:00", location: "Harare", status: "scheduled" },
      asset: { type: "Laptop", assetNumber: "", serialNumber: "", assignedTo: "", assignedToName: "", condition: "Good", issuedAt: new Date().toISOString().slice(0, 10), status: "assigned" },
      support: { category: "people", subject: "", description: "", urgency: "normal", confidentiality: "standard", userId: data.user.uid },
      profile_self: { id: data.user.uid, userId: data.user.uid, displayName: staffDisplayName(data.staffProfile || data.profile, data.user.email), preferredName: data.staffProfile?.preferredName || "", phone: data.staffProfile?.phone || "", emergencyContactName: data.staffProfile?.emergencyContactName || "", emergencyContactPhone: data.staffProfile?.emergencyContactPhone || "", emergencyContactRelationship: data.staffProfile?.emergencyContactRelationship || "", workArrangement: data.staffProfile?.workArrangement || "" }
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
      if (type === "staff") {
        const userId = form.id || form.userId;
        await authenticatedFetch("/api/staff/people", { method: "POST", body: JSON.stringify({
          action: "save_profile",
          userId,
          displayName: form.displayName || "",
          email: form.email || "",
          rolePackId: form.rolePackId,
          department: form.department,
          employmentType: form.employmentType,
          status: form.status,
          startDate: form.startDate || "",
          probationEndDate: form.probationEndDate || "",
          employeeNumber: form.employeeNumber || "",
          managerId: form.managerId || "",
          managerName: form.managerName || "",
          endDate: form.endDate || "",
          offboardingReason: form.offboardingReason || "",
          accessEndDate: form.accessEndDate || "",
          equipmentReturnDue: form.equipmentReturnDue || "",
          handoverOwnerId: form.handoverOwnerId || "",
          handoverOwnerName: form.handoverOwnerName || ""
        }) });
      }
      if (type === "shift") await saveStaffShift(form, data.user);
      if (type === "asset") await saveStaffAsset(form, data.user);
      if (type === "support") await saveStaffSupportRequest(form, data.user);
      if (type === "profile_self") await saveStaffProfile({ id: data.user.uid, userId: data.user.uid, displayName: form.displayName, preferredName: form.preferredName, phone: form.phone, emergencyContactName: form.emergencyContactName, emergencyContactPhone: form.emergencyContactPhone, emergencyContactRelationship: form.emergencyContactRelationship, workArrangement: form.workArrangement }, data.user);
      toast("The workforce record was saved.", { title: "Saved" });
      onClose();
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not save" });
    } finally {
      setLoading(false);
    }
  }

  const staffOptions = (data.directory || []).map((record) => ({
    value: record.userId || record.id,
    label: staffDisplayName(record),
    description: [record.roleTitle || STAFF_ROLE_PACKS[record.rolePackId]?.name, record.department, record.email].filter(Boolean).join(" · "),
    keywords: [record.employeeNumber, record.email, record.department, record.rolePackId].filter(Boolean)
  }));
  if (data.staffProfile && !staffOptions.some((option) => option.value === (data.staffProfile.userId || data.staffProfile.id || data.user.uid))) {
    staffOptions.push({ value: data.staffProfile.userId || data.staffProfile.id || data.user.uid, label: staffDisplayName(data.staffProfile, data.user.email), description: [data.staffProfile.roleTitle, data.staffProfile.department, data.staffProfile.email || data.user.email].filter(Boolean).join(" · ") });
  }
  const titles = { task: "Add work", leave: "Request leave", workforce: "Workforce request", staff: "Staff record", shift: "Add shift", asset: "Issue asset", support: "Internal support request", profile_self: "Edit my details" };
  return <Modal open={open} onClose={onClose} title={titles[type] || "Staff action"} size="lg"><form onSubmit={submit}><div className="grid gap-4 p-5 sm:grid-cols-2">{type === "task" && <><Field label="Task title"><input required value={form.title || ""} onChange={(event) => patch({ title: event.target.value })} className={inputClass} /></Field><Field label="Priority"><select value={form.priority || "normal"} onChange={(event) => patch({ priority: event.target.value })} className={inputClass}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field><Field label="Assignee"><EntityPicker value={form.assigneeId || ""} onChange={(value, option) => patch({ assigneeId: value, assigneeName: option?.label || "" })} options={staffOptions} title="Choose an assignee" placeholder="Search the staff directory" /></Field><Field label="Department"><select value={form.department || ""} onChange={(event) => patch({ department: event.target.value })} className={inputClass}><option value="">Choose department</option>{STAFF_DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></Field><Field label="Due date"><input type="date" value={form.dueDate || ""} onChange={(event) => patch({ dueDate: event.target.value })} className={inputClass} /></Field><Field label="Next action"><input value={form.nextAction || ""} onChange={(event) => patch({ nextAction: event.target.value })} className={inputClass} placeholder="What should happen next?" /></Field><Field label="Description" wide><textarea value={form.description || ""} onChange={(event) => patch({ description: event.target.value })} className={textareaClass} /></Field></>}{type === "profile_self" && <><Field label="Full name"><input required value={form.displayName || ""} onChange={(event) => patch({ displayName: event.target.value })} className={inputClass} /></Field><Field label="Preferred name"><input value={form.preferredName || ""} onChange={(event) => patch({ preferredName: event.target.value })} className={inputClass} /></Field><Field label="Phone"><input value={form.phone || ""} onChange={(event) => patch({ phone: event.target.value })} className={inputClass} /></Field><Field label="Work arrangement"><select value={form.workArrangement || ""} onChange={(event) => patch({ workArrangement: event.target.value })} className={inputClass}><option value="">Not set</option><option value="office">Office</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option><option value="field">Field</option></select></Field><Field label="Emergency contact"><input value={form.emergencyContactName || ""} onChange={(event) => patch({ emergencyContactName: event.target.value })} className={inputClass} /></Field><Field label="Relationship"><input value={form.emergencyContactRelationship || ""} onChange={(event) => patch({ emergencyContactRelationship: event.target.value })} className={inputClass} /></Field><Field label="Emergency phone" wide><input value={form.emergencyContactPhone || ""} onChange={(event) => patch({ emergencyContactPhone: event.target.value })} className={inputClass} /></Field></>}{type === "leave" && <><Field label="Leave type"><select value={form.type || LEAVE_TYPES[0]} onChange={(event) => patch({ type: event.target.value })} className={inputClass}>{LEAVE_TYPES.map((leaveType) => <option key={leaveType}>{leaveType}</option>)}</select></Field><Field label="Days"><input type="number" min="0.5" step="0.5" value={form.days || 1} onChange={(event) => patch({ days: Number(event.target.value) })} className={inputClass} /></Field><Field label="Start date"><input required type="date" value={form.startDate || ""} onChange={(event) => patch({ startDate: event.target.value })} className={inputClass} /></Field><Field label="End date"><input required type="date" value={form.endDate || ""} onChange={(event) => patch({ endDate: event.target.value })} className={inputClass} /></Field><Field label="Reason or note" wide><textarea value={form.reason || ""} onChange={(event) => patch({ reason: event.target.value })} className={textareaClass} /></Field><Field label="Coverage plan" wide><textarea value={form.coverageNote || ""} onChange={(event) => patch({ coverageNote: event.target.value })} className={textareaClass} placeholder="Who will cover urgent work, or what can wait? Optional for roles without scheduled coverage." /></Field></>}{type === "workforce" && <><Field label="Role title"><input required value={form.roleTitle || ""} onChange={(event) => patch({ roleTitle: event.target.value })} className={inputClass} /></Field><Field label="Department"><select value={form.department || STAFF_DEPARTMENTS[0]} onChange={(event) => patch({ department: event.target.value })} className={inputClass}>{STAFF_DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></Field><Field label="Employment type"><select value={form.employmentType || STAFF_EMPLOYMENT_TYPES[0]} onChange={(event) => patch({ employmentType: event.target.value })} className={inputClass}>{STAFF_EMPLOYMENT_TYPES.map((typeName) => <option key={typeName}>{typeName}</option>)}</select></Field><Field label="Proposed start date"><input type="date" value={form.startDate || ""} onChange={(event) => patch({ startDate: event.target.value })} className={inputClass} /></Field><Field label="Budget"><input value={form.budget || ""} onChange={(event) => patch({ budget: event.target.value })} className={inputClass} placeholder="Amount and currency" /></Field><Field label="Reason for the role" wide><textarea required value={form.reason || ""} onChange={(event) => patch({ reason: event.target.value })} className={textareaClass} /></Field></>}{type === "staff" && <><Field label="Linked Spotly account"><EntityPicker value={form.userId || form.id || ""} onChange={(value, option) => patch({ userId: value, id: value, displayName: option?.label || form.displayName, email: data.directory.find((record) => (record.userId || record.id) === value)?.email || form.email })} options={staffOptions} title="Choose a staff account" placeholder="Search existing staff" allowClear={false} /></Field><Field label="Full name"><input required value={form.displayName || ""} onChange={(event) => patch({ displayName: event.target.value })} className={inputClass} /></Field><Field label="Email"><input type="email" value={form.email || ""} onChange={(event) => patch({ email: event.target.value })} className={inputClass} /></Field><Field label="Role"><select value={form.rolePackId || "support_agent"} onChange={(event) => { const pack = STAFF_ROLE_PACKS[event.target.value]; patch({ rolePackId: event.target.value, roleTitle: pack.name, department: pack.department }); }} className={inputClass}>{Object.values(STAFF_ROLE_PACKS).map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></Field><Field label="Department"><select value={form.department || ""} onChange={(event) => patch({ department: event.target.value })} className={inputClass}>{STAFF_DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></Field><Field label="Employment type"><select value={form.employmentType || STAFF_EMPLOYMENT_TYPES[0]} onChange={(event) => patch({ employmentType: event.target.value })} className={inputClass}>{STAFF_EMPLOYMENT_TYPES.map((typeName) => <option key={typeName}>{typeName}</option>)}</select></Field><Field label="Start date"><input type="date" value={String(form.startDate || "").slice(0, 10)} onChange={(event) => patch({ startDate: event.target.value })} className={inputClass} /></Field><Field label="Probation end"><input type="date" value={String(form.probationEndDate || "").slice(0, 10)} onChange={(event) => patch({ probationEndDate: event.target.value })} className={inputClass} /></Field><Field label="Status"><select value={form.status || "preboarding"} onChange={(event) => patch({ status: event.target.value })} className={inputClass}>{["preboarding", "probation", "active", "leave", "suspended", "offboarding", "former"].map((status) => <option key={status}>{status}</option>)}</select></Field><Field label="Manager"><EntityPicker value={form.managerId || ""} onChange={(value, option) => patch({ managerId: value, managerName: option?.label || "" })} options={staffOptions.filter((option) => option.value !== (form.userId || form.id))} title="Choose a manager" placeholder="Search managers and staff" /></Field><Field label="Employee number"><input value={form.employeeNumber || ""} onChange={(event) => patch({ employeeNumber: event.target.value })} className={inputClass} /></Field>{["offboarding", "former"].includes(form.status) && <><Field label="Last working date"><input type="date" value={String(form.endDate || "").slice(0, 10)} onChange={(event) => patch({ endDate: event.target.value })} className={inputClass} /></Field><Field label="Access ends"><input type="date" value={String(form.accessEndDate || "").slice(0, 10)} onChange={(event) => patch({ accessEndDate: event.target.value })} className={inputClass} /></Field><Field label="Equipment return due"><input type="date" value={String(form.equipmentReturnDue || "").slice(0, 10)} onChange={(event) => patch({ equipmentReturnDue: event.target.value })} className={inputClass} /></Field><Field label="Handover owner"><EntityPicker value={form.handoverOwnerId || ""} onChange={(value, option) => patch({ handoverOwnerId: value, handoverOwnerName: option?.label || "" })} options={staffOptions.filter((option) => option.value !== (form.userId || form.id))} title="Choose a handover owner" placeholder="Search staff" /></Field><Field label="Offboarding reason" wide><textarea value={form.offboardingReason || ""} onChange={(event) => patch({ offboardingReason: event.target.value })} className={textareaClass} placeholder="Record the controlled reason and handover context." /></Field></>}</>}{type === "shift" && <><Field label="Staff member"><EntityPicker value={form.userId || ""} onChange={(value, option) => patch({ userId: value, employeeName: option?.label || "" })} options={staffOptions} title="Choose a staff member" placeholder="Search the staff directory" allowClear={false} /></Field><Field label="Employee name"><input readOnly value={form.employeeName || ""} className={`${inputClass} bg-grouped`} /></Field><Field label="Date"><input required type="date" value={form.date || ""} onChange={(event) => patch({ date: event.target.value })} className={inputClass} /></Field><Field label="Location or arrangement"><input value={form.location || ""} onChange={(event) => patch({ location: event.target.value })} className={inputClass} /></Field><Field label="Start time"><input type="time" value={form.startTime || "08:00"} onChange={(event) => patch({ startTime: event.target.value })} className={inputClass} /></Field><Field label="End time"><input type="time" value={form.endTime || "17:00"} onChange={(event) => patch({ endTime: event.target.value })} className={inputClass} /></Field></>}{type === "asset" && <><Field label="Asset type"><select required value={form.type || "Laptop"} onChange={(event) => patch({ type: event.target.value })} className={inputClass}>{["Laptop", "Phone", "SIM card", "Security key", "Headset", "Tablet", "Vehicle", "Other"].map((assetType) => <option key={assetType}>{assetType}</option>)}</select></Field><Field label="Asset number"><input value={form.assetNumber || ""} onChange={(event) => patch({ assetNumber: event.target.value })} className={inputClass} /></Field><Field label="Serial number"><input value={form.serialNumber || ""} onChange={(event) => patch({ serialNumber: event.target.value })} className={inputClass} /></Field><Field label="Assigned to"><EntityPicker value={form.assignedTo || ""} onChange={(value, option) => patch({ assignedTo: value, assignedToName: option?.label || "" })} options={staffOptions} title="Choose who receives this asset" placeholder="Search the staff directory" /></Field><Field label="Assigned employee"><input readOnly value={form.assignedToName || ""} className={`${inputClass} bg-grouped`} /></Field><Field label="Condition"><select value={form.condition || "Good"} onChange={(event) => patch({ condition: event.target.value })} className={inputClass}><option>New</option><option>Good</option><option>Fair</option><option>Damaged</option></select></Field><Field label="Issue date"><input type="date" value={String(form.issuedAt || "").slice(0, 10)} onChange={(event) => patch({ issuedAt: event.target.value })} className={inputClass} /></Field></>}{type === "support" && <><Field label="Request type"><select value={form.category || "people"} onChange={(event) => patch({ category: event.target.value })} className={inputClass}><option value="people">People Operations</option><option value="technical">Technical support</option><option value="confidential">Confidential concern</option><option value="incident">Workplace incident</option></select></Field><Field label="Urgency"><select value={form.urgency || "normal"} onChange={(event) => patch({ urgency: event.target.value })} className={inputClass}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field><Field label="Subject" wide><input required value={form.subject || ""} onChange={(event) => patch({ subject: event.target.value })} className={inputClass} /></Field><Field label="What happened or what do you need?" wide><textarea required value={form.description || ""} onChange={(event) => patch({ description: event.target.value })} className={textareaClass} /></Field></>}</div><div className="sticky bottom-0 flex justify-end gap-2 border-t bg-[var(--surface)] p-5"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>Save</Button></div></form></Modal>;
}

function Field({ label, children, wide = false }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-sm font-semibold">{label}</span>{children}</label>;
}

function StaffWorkspace({ section }) {
  const data = useStaffData();
  const [modal, setModal] = useState({ type: "", item: null });
  const navigation = useMemo(() => staffNavigation(data), [data]);
  const allowed = new Set(navigation.map((item) => item.id));
  const safeSection = allowed.has(section) ? section : "today";
  const openModal = (type, item = null) => setModal({ type, item });
  return <StaffAccess data={data}><PortalShell portalId="staff" activeSection={safeSection} navigation={navigation} footer={false}><div className="mx-auto max-w-[1550px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{safeSection === "today" && <Today data={data} openModal={openModal} />}{safeSection === "work" && <Work data={data} openModal={openModal} />}{safeSection === "catalogue" && <StaffCatalogueCapture data={data} />}{safeSection === "team" && data.manager && <Team data={data} openModal={openModal} />}{safeSection === "hiring" && data.canRecruit && <Hiring data={data} openModal={openModal} />}{safeSection === "schedule" && <Schedule data={data} openModal={openModal} />}{safeSection === "leave" && <Leave data={data} openModal={openModal} />}{safeSection === "learning" && <Learning data={data} />}{safeSection === "performance" && <Performance data={data} />}{safeSection === "pay" && <Pay data={data} />}{safeSection === "assets" && <Assets data={data} openModal={openModal} />}{safeSection === "notifications" && <NotificationCenter workspace="staff" title="Staff notifications" description="Approvals, schedule changes, People Operations activity and work updates." />}{safeSection === "help" && <Help data={data} openModal={openModal} />}{safeSection === "profile" && <Profile data={data} openModal={openModal} />}</div><StaffModal type={modal.type} item={modal.item} open={Boolean(modal.type)} onClose={() => setModal({ type: "", item: null })} data={data} /></PortalShell></StaffAccess>;
}

export function StaffApp({ section = "today" }) {
  return <AuthGate portal="staff" title="Sign in to Spotly Staff"><StaffWorkspace section={section} /></AuthGate>;
}
