"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  BadgeDollarSign,
  BookOpenCheck,
  Boxes,
  Building2,
  CalendarCheck,
  CircleHelp,
  ClipboardList,
  CreditCard,
  GitBranch,
  IdCard,
  KeyRound,
  MapPin,
  PackageCheck,
  Route,
  SearchCheck,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound
} from "lucide-react";
import { Badge, Card, PageHeader, SectionCard, Tabs } from "@/components/ui";

const maps = {
  commerce: [
    { id: "account", title: "Account", description: "Shared identity, contact methods, consent, and account status.", icon: UserRound, controls: ["users", "authentication", "notificationPreferences"] },
    { id: "membership", title: "Membership", description: "Connects a person to an organization, business, location, and responsibility.", icon: KeyRound, controls: ["memberships", "businessInvitations", "roleTemplates"] },
    { id: "organization", title: "Organization", description: "The legal or controlling entity that owns brands and central policies.", icon: Building2, controls: ["organizations", "ownership", "governancePolicies"] },
    { id: "brand", title: "Brand", description: "The customer-facing business identity, catalogue defaults, and brand rules.", icon: Store, controls: ["businesses", "catalogTemplates", "promotions"] },
    { id: "location", title: "Location", description: "The physical or operational unit with hours, staff, stock, and fulfilment.", icon: MapPin, controls: ["branches", "inventory", "openingHours"] },
    { id: "offering", title: "Offering", description: "Product, menu item, service, event, ticket, property, or listing.", icon: ShoppingBag, controls: ["products", "availability", "pricing"] },
    { id: "transaction", title: "Order / Booking / Ticket", description: "The customer transaction and its state history.", icon: ClipboardList, controls: ["orders", "orderEvents", "bookings"] },
    { id: "payment", title: "Payment", description: "Intent, confirmation, fees, commission, currency, and reconciliation.", icon: CreditCard, controls: ["paymentIntents", "payouts", "businessFinanceSettings"] },
    { id: "fulfilment", title: "Pickup / Delivery / Check-in", description: "The final operating workflow appropriate to the business model.", icon: Route, controls: ["operationalSettings", "drivers", "kiosk"] },
    { id: "settlement", title: "Settlement", description: "Funds, payout state, exception holds, and recipient rules.", icon: BadgeDollarSign, controls: ["payouts", "commerceSettings", "reconciliation"] },
    { id: "support", title: "Support and audit", description: "Conversation, intervention, reason, event, and immutable history.", icon: ShieldCheck, controls: ["supportConversations", "supportMessages", "auditLogs"] }
  ],
  workforce: [
    { id: "candidate", title: "Candidate", description: "Application, screening, interview, references, offer, and consent.", icon: SearchCheck, controls: ["staffCandidates", "workforceRequests"] },
    { id: "employment", title: "Employment", description: "Employee or contractor relationship, dates, documents, and status.", icon: IdCard, controls: ["staffProfiles", "contracts", "documents"] },
    { id: "role", title: "Role pack", description: "Title, department, permissions, training, schedule, equipment, and expectations.", icon: BookOpenCheck, controls: ["roleTemplates", "staffRolePacks"] },
    { id: "permissions", title: "Permissions and scope", description: "Platform, region, department, organization, location, or assigned case.", icon: KeyRound, controls: ["customPermissions", "scope", "approvalLimits"] },
    { id: "schedule", title: "Schedule and attendance", description: "Shift, clock events, exceptions, overtime, and corrections.", icon: CalendarCheck, controls: ["staffShifts", "timesheets"] },
    { id: "task", title: "Work", description: "Assigned operating tasks, queues, due dates, and completion evidence.", icon: ClipboardList, controls: ["staffTasks", "adminTasks", "supportConversations"] },
    { id: "performance", title: "Performance and learning", description: "Goals, check-ins, training, recognition, coaching, and development.", icon: PackageCheck, controls: ["staffPerformance", "staffTrainingAssignments"] },
    { id: "payroll", title: "Payroll preparation", description: "Pay, allowances, deductions, statutory fields, approvals, and export.", icon: BadgeDollarSign, controls: ["staffPayrollRecords", "payrollRules"] },
    { id: "exit", title: "Exit and alumni", description: "Final day, access revocation, ownership transfer, assets, and records.", icon: Boxes, controls: ["offboardingTasks", "staffAssets", "auditLogs"] }
  ]
};

const explanations = {
  access: {
    question: "Why can this person access this location?",
    answer: "Their active Spotly account is connected through a membership to the organization or business. The resolved role pack grants a permission, the membership scope includes the location, and no suspension or expiry blocks the access.",
    trace: ["Account active", "Membership active", "Role permits action", "Location is in scope", "Temporary exception not expired"]
  },
  publication: {
    question: "Why is this business not public?",
    answer: "Publication depends on business lifecycle status, verification, required brand details, at least one valid location, capability-specific setup, and any parent-company approval required by governance policy.",
    trace: ["Brand record", "Verification status", "Location readiness", "Capability setup", "Parent approval", "Publication task"]
  },
  payment: {
    question: "Why is this payment held?",
    answer: "A hold can result from an unresolved dispute, failed reconciliation, payout minimum, settlement delay, risk decision, recipient configuration, or an administrator action. The payment and audit records show the exact reason.",
    trace: ["Payment intent", "Provider response", "Order state", "Risk or dispute", "Settlement policy", "Audit decision"]
  },
  governance: {
    question: "Why did this branch change require approval?",
    answer: "The parent organization marked that operational field as centrally controlled or branch-suggested. The location’s edit therefore created a change request instead of changing the live value immediately.",
    trace: ["Organization policy", "Brand default", "Location request", "Approver scope", "Effective live value"]
  }
};

export function PlatformMap({ businessCount = 0, userCount = 0, taskCount = 0 }) {
  const [tab, setTab] = useState("commerce");
  const [selected, setSelected] = useState(maps.commerce[0].id);
  const [explain, setExplain] = useState("access");
  const nodes = maps[tab];
  const current = useMemo(() => nodes.find((node) => node.id === selected) || nodes[0], [nodes, selected]);
  const CurrentIcon = current.icon;
  function changeTab(value) {
    setTab(value);
    setSelected(maps[value][0].id);
  }
  return <div className="space-y-6"><PageHeader title="Platform map" description="A plain-language operating map of Spotly’s entities, workforce, workflows, settings, and reasons." actions={<div className="flex gap-2"><Badge tone="neutral">{businessCount} businesses</Badge><Badge tone="neutral">{userCount} accounts</Badge><Badge tone="neutral">{taskCount} open tasks</Badge></div>} /><Tabs value={tab} onChange={changeTab} tabs={[{ value: "commerce", label: "Customer and commerce network" }, { value: "workforce", label: "Workforce network" }]} /><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><SectionCard title={tab === "commerce" ? "Account to settlement" : "Candidate to alumni"} description="Select any node to inspect its purpose and controlling records"><div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">{nodes.map((node, index) => { const Icon = node.icon; const active = current.id === node.id; return <div key={node.id} className="contents"><button onClick={() => setSelected(node.id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-admin bg-admin-soft text-admin" : "bg-grouped hover:border-admin/40"}`}><div className="flex items-start justify-between gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-white" : "bg-admin-soft text-admin"}`}><Icon className="h-5 w-5" /></span><Badge tone={active ? "accent" : "neutral"}>{index + 1}</Badge></div><p className="mt-4 font-bold">{node.title}</p><p className="mt-2 text-xs leading-5 text-secondary">{node.description}</p></button>{index < nodes.length - 1 && (index + 1) % 3 !== 0 ? <ArrowDown className="hidden self-center justify-self-center text-tertiary lg:block lg:-rotate-90" /> : null}</div>; })}</div></SectionCard><SectionCard title={current.title} description="What this node means"><div className="p-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-admin-soft text-admin"><CurrentIcon className="h-6 w-6" /></span><p className="mt-4 text-sm leading-6 text-secondary">{current.description}</p><p className="mt-5 text-xs font-bold uppercase tracking-[.14em] text-tertiary">Controlling records and settings</p><div className="mt-3 flex flex-wrap gap-2">{current.controls.map((control) => <Badge key={control}>{control}</Badge>)}</div><div className="mt-6 rounded-2xl bg-grouped p-4"><div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-admin" /><p className="font-semibold">Relationship health</p></div><p className="mt-2 text-sm leading-6 text-secondary">A production diagnostic should count missing, duplicate, conflicting, or orphaned relationships here and link directly to the correct operating queue.</p></div></div></SectionCard></div><SectionCard title="Explain this" description="A reusable diagnostic pattern for every important record"><div className="grid gap-5 p-5 lg:grid-cols-[.7fr_1.3fr]"><div className="space-y-2">{Object.entries(explanations).map(([id, item]) => <button key={id} onClick={() => setExplain(id)} className={`w-full rounded-xl p-4 text-left text-sm font-semibold transition ${explain === id ? "bg-admin-soft text-admin" : "bg-grouped hover:bg-admin-soft"}`}><CircleHelp className="mr-2 inline h-4 w-4" />{item.question}</button>)}</div><Card className="bg-grouped p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-admin">Diagnostic answer</p><h3 className="mt-3 text-xl font-bold">{explanations[explain].question}</h3><p className="mt-3 text-sm leading-6 text-secondary">{explanations[explain].answer}</p><div className="mt-5 space-y-2">{explanations[explain].trace.map((step, index) => <div key={step} className="flex items-center gap-3 rounded-xl bg-[var(--surface)] p-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-admin-soft text-xs font-bold text-admin">{index + 1}</span><span className="text-sm font-semibold">{step}</span></div>)}</div></Card></div></SectionCard></div>;
}
