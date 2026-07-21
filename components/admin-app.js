"use client";

import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BadgeCheck,
  Bike,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Network,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tag,
  Trash2,
  Truck,
  UserCheck,
  UserRound,
  UsersRound,
  WalletCards,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Sparkline } from "@/components/charts";
import { Badge, Button, Card, EmptyState, ListRow, MetricCard, Modal, PageHeader, ProgressBar, SearchField, SectionCard, Select, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { adminMetrics, adminOrders, auditLog, businesses as seedBusinesses, customers, drivers as seedDrivers, incidents as seedIncidents, platformServices as seedServices, transactions } from "@/data/admin";
import { cn } from "@/lib/cn";
import { formatCurrency, initials } from "@/lib/format";

const sectionMeta = {
  dashboard: { title: "Platform dashboard", description: "Live operational health across the Spotly ecosystem." },
  operations: { title: "Operations", description: "Orders, deliveries, bookings, incidents, and service recovery." },
  businesses: { title: "Businesses", description: "Applications, verification, risk, and marketplace access." },
  drivers: { title: "Drivers", description: "Driver verification, status, performance, and safety." },
  customers: { title: "Customers", description: "Customer accounts, activity, restrictions, and support context." },
  finance: { title: "Finance", description: "Transactions, payouts, disputes, fees, and reconciliation." },
  content: { title: "Content", description: "Categories, cities, placements, and discovery configuration." },
  platform: { title: "Platform status", description: "Service health, integrations, latency, and availability." },
  audit: { title: "Audit log", description: "A permanent record of sensitive administrative actions." },
  settings: { title: "Admin settings", description: "Roles, permissions, security, notification, and workspace controls." }
};

const tableHead = "bg-[var(--surface-2)] text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-tertiary";
const th = "px-5 py-3";
const td = "px-5 py-4 text-sm";

function CriticalBanner({ incidents }) {
  const critical = incidents.filter((item) => item.severity === "Critical" && item.status !== "Resolved");
  if (!critical.length) return null;
  return <Card className="border-red-300 bg-red-50 p-5 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger text-white"><AlertOctagon className="h-6 w-6" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{critical.length} critical incident requires immediate review</h2><Badge tone="danger">Priority 0</Badge></div><p className="mt-1 text-sm opacity-75">{critical[0].id} · {critical[0].summary}</p></div><Button variant="danger" onClick={() => { window.location.href = "/admin/operations"; }}>Open incident queue</Button></div></Card>;
}

function Dashboard({ incidents, services }) {
  const operational = services.filter((item) => item.status === "Operational").length;
  return <div className="space-y-7"><PageHeader eyebrow="Live · All cities" {...sectionMeta.dashboard} actions={<><Select value="All cities" onChange={() => {}} options={["All cities", "Harare", "Bulawayo", "Mutare"]} /><Button variant="outline"><RefreshCw className="h-4 w-4" />Refresh</Button></>} /><CriticalBanner incidents={incidents} /><div className="metric-grid">{adminMetrics.map((metric) => <MetricCard key={metric.label} label={metric.label} value={metric.value} delta={metric.delta} tone={metric.status === "danger" ? "danger" : metric.status === "warning" ? "warning" : metric.status === "good" ? "success" : "default"} />)}</div><div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><SectionCard title="Requires attention" description="Highest-priority work across operations"><div>{incidents.filter((item) => item.status !== "Resolved").slice(0, 4).map((item) => <Link key={item.id} href="/admin/operations" className="flex min-h-[72px] items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-[var(--surface-2)]"><span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", item.severity === "Critical" ? "bg-red-100 text-danger dark:bg-red-950/50" : "bg-amber-100 text-warning dark:bg-amber-950/50")}><AlertTriangle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.id} · {item.type}</p><Badge tone={item.severity === "Critical" ? "danger" : "warning"}>{item.severity}</Badge></div><p className="mt-1 truncate text-sm text-secondary">{item.summary}</p></div><span className="text-xs text-tertiary">{item.opened}</span><ChevronRight className="h-4 w-4 text-tertiary" /></Link>)}</div></SectionCard><SectionCard title="Platform health" description={`${operational}/${services.length} services operational`}><div className="p-5"><div className="flex items-center justify-between"><div><p className="text-4xl font-bold">{Math.round((operational / services.length) * 100)}%</p><p className="mt-1 text-sm text-secondary">services healthy</p></div><span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-success dark:bg-green-950/40"><Server className="h-6 w-6" /></span></div><ProgressBar value={(operational / services.length) * 100} className="mt-5 h-3" color="#16a34a" /><div className="mt-5 space-y-3">{services.slice(0, 5).map((item) => <div key={item.id} className="flex items-center gap-2 text-sm"><span className={cn("h-2 w-2 rounded-full", item.status === "Operational" ? "bg-success" : "bg-warning")} /><span className="flex-1 text-secondary">{item.name}</span><StatusBadge status={item.status} /></div>)}</div><Link href="/admin/platform" className="mt-5 block text-center text-sm font-semibold text-[var(--accent)]">View all services</Link></div></SectionCard></div><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><SectionCard title="Platform volume" description="Orders processed · last 12 hours"><div className="p-5"><div className="flex items-end gap-3"><p className="text-3xl font-bold">1,842</p><p className="pb-1 text-sm text-success">+12.4%</p></div><Sparkline values={[92, 108, 98, 126, 148, 137, 166, 184, 172, 206, 194, 228]} className="mt-5 h-32" /></div></SectionCard><SectionCard title="Verification queues"><div><Link href="/admin/businesses" className="flex min-h-[72px] items-center gap-3 border-b px-4 py-3 hover:bg-[var(--surface-2)]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Building2 className="h-5 w-5" /></span><div className="flex-1"><p className="font-semibold">Business applications</p><p className="mt-1 text-sm text-secondary">4 pending review</p></div><Badge tone="warning">4</Badge><ChevronRight className="h-4 w-4 text-tertiary" /></Link><Link href="/admin/drivers" className="flex min-h-[72px] items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Bike className="h-5 w-5" /></span><div className="flex-1"><p className="font-semibold">Driver applications</p><p className="mt-1 text-sm text-secondary">6 pending review</p></div><Badge tone="warning">6</Badge><ChevronRight className="h-4 w-4 text-tertiary" /></Link></div></SectionCard></div></div>;
}

function Operations({ incidents, setIncidents, openIncident }) {
  const [tab, setTab] = useState("incidents");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const filteredIncidents = incidents.filter((item) => (filter === "All" || item.severity === filter || item.status === filter) && `${item.id} ${item.type} ${item.summary} ${item.city}`.toLowerCase().includes(query.toLowerCase()));
  const filteredOrders = adminOrders.filter((item) => `${item.id} ${item.business} ${item.customer} ${item.driver}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6"><PageHeader {...sectionMeta.operations} actions={<Button variant="outline"><Download className="h-4 w-4" />Export queue</Button>} /><Tabs value={tab} onChange={setTab} tabs={[{ value: "incidents", label: `Incidents (${incidents.filter((i) => i.status !== "Resolved").length})` }, { value: "orders", label: `Orders (${adminOrders.length})` }, { value: "deliveries", label: "Deliveries" }, { value: "bookings", label: "Bookings" }]} /><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={query} onChange={setQuery} placeholder={`Search ${tab}`} />{tab === "incidents" && <div className="no-scrollbar flex gap-2 overflow-x-auto">{["All", "Critical", "High", "New", "Investigating", "Resolved"].map((item) => <button key={item} onClick={() => setFilter(item)} className={cn("h-[52px] rounded-2xl border px-4 text-sm font-semibold", filter === item ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "surface")}>{item}</button>)}</div>}</div>{tab === "incidents" && <SectionCard><div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead className={tableHead}><tr><th className={th}>Incident</th><th className={th}>Type / summary</th><th className={th}>Severity</th><th className={th}>Status</th><th className={th}>City</th><th className={th}>Owner</th><th className={th}>Opened</th><th className={th}></th></tr></thead><tbody>{filteredIncidents.map((item) => <tr key={item.id} className="border-t hover:bg-[var(--surface-2)]"><td className={cn(td, "font-semibold text-[var(--accent)]")}>{item.id}</td><td className={cn(td, "max-w-[360px]")}><p className="font-semibold">{item.type}</p><p className="mt-1 truncate text-xs text-secondary">{item.summary}</p></td><td className={td}><Badge tone={item.severity === "Critical" ? "danger" : item.severity === "High" ? "warning" : "neutral"}>{item.severity}</Badge></td><td className={td}><StatusBadge status={item.status} /></td><td className={td}>{item.city}</td><td className={td}>{item.owner}</td><td className={cn(td, "text-secondary")}>{item.opened}</td><td className={td}><Button size="sm" variant="outline" onClick={() => openIncident(item)}>Review</Button></td></tr>)}</tbody></table></div></SectionCard>}{tab === "orders" && <SectionCard><div className="overflow-x-auto"><table className="w-full min-w-[1000px]"><thead className={tableHead}><tr><th className={th}>Order</th><th className={th}>Business</th><th className={th}>Customer</th><th className={th}>Driver</th><th className={th}>Value</th><th className={th}>Status</th><th className={th}>Age</th><th className={th}></th></tr></thead><tbody>{filteredOrders.map((item) => <tr key={item.id} className="border-t hover:bg-[var(--surface-2)]"><td className={cn(td, "font-semibold text-[var(--accent)]")}>{item.id}</td><td className={td}>{item.business}</td><td className={td}>{item.customer}</td><td className={td}>{item.driver}</td><td className={cn(td, "font-semibold")}>{formatCurrency(item.value)}</td><td className={td}><StatusBadge status={item.status} /></td><td className={cn(td, "text-secondary")}>{item.age}</td><td className={td}><Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></SectionCard>}{["deliveries", "bookings"].includes(tab) && <Card><EmptyState icon={tab === "deliveries" ? Truck : CalendarDays} title={`${tab[0].toUpperCase()}${tab.slice(1)} workspace`} description="The operational table is ready for your production data source. Demo records are represented in the unified orders queue." /></Card>}</div>;
}

function EntityTable({ type, rows, query, onReview }) {
  const isBusiness = type === "business";
  const filtered = rows.filter((item) => `${item.id} ${item.name} ${item.city} ${isBusiness ? item.category : item.vehicle}`.toLowerCase().includes(query.toLowerCase()));
  return <SectionCard><div className="overflow-x-auto"><table className="w-full min-w-[980px]"><thead className={tableHead}><tr><th className={th}>{isBusiness ? "Business" : "Driver"}</th><th className={th}>{isBusiness ? "Category" : "Vehicle"}</th><th className={th}>City</th><th className={th}>Rating</th><th className={th}>{isBusiness ? "Orders" : "Jobs"}</th><th className={th}>Status</th><th className={th}>{isBusiness ? "Risk" : "Verification"}</th><th className={th}></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-t hover:bg-[var(--surface-2)]"><td className={td}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">{initials(item.name)}</span><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.id}</p></div></div></td><td className={td}>{isBusiness ? item.category : item.vehicle}</td><td className={td}>{item.city}</td><td className={td}>{item.rating || "—"}</td><td className={td}>{isBusiness ? item.orders : item.jobs}</td><td className={td}><StatusBadge status={item.status} /></td><td className={td}>{isBusiness ? <Badge tone={item.risk === "High" ? "danger" : item.risk === "Medium" ? "warning" : "success"}>{item.risk}</Badge> : <StatusBadge status={item.verification} />}</td><td className={td}><Button size="sm" variant="outline" onClick={() => onReview(item)}>Review</Button></td></tr>)}</tbody></table></div></SectionCard>;
}

function Businesses({ businesses, openReview }) {
  const [query, setQuery] = useState("");
  return <div className="space-y-6"><PageHeader {...sectionMeta.businesses} actions={<><Button variant="outline"><Download className="h-4 w-4" />Export</Button><Button><Plus className="h-4 w-4" />Add business</Button></>} /><div className="metric-grid"><MetricCard label="Active businesses" value="428" delta="+22" hint="this month" tone="success" icon={Building2} /><MetricCard label="Pending review" value="4" delta="Oldest 2d" hint="verification queue" tone="warning" icon={FileCheck2} /><MetricCard label="Restricted" value="3" delta="1 high risk" hint="active controls" tone="danger" icon={ShieldAlert} /><MetricCard label="GMV this month" value="US$284K" delta="+17.2%" hint="all businesses" tone="success" icon={CircleDollarSign} /></div><SearchField value={query} onChange={setQuery} placeholder="Search businesses" /><EntityTable type="business" rows={businesses} query={query} onReview={openReview} /></div>;
}

function Drivers({ drivers, openReview }) {
  const [query, setQuery] = useState("");
  return <div className="space-y-6"><PageHeader {...sectionMeta.drivers} actions={<><Button variant="outline"><Download className="h-4 w-4" />Export</Button><Button><Plus className="h-4 w-4" />Invite driver</Button></>} /><div className="metric-grid"><MetricCard label="Approved drivers" value="612" delta="+34" hint="this month" tone="success" icon={UserCheck} /><MetricCard label="Online now" value="138" delta="72% supply" hint="Harare peak" icon={Bike} /><MetricCard label="Pending review" value="6" delta="Oldest 1d" hint="verification queue" tone="warning" icon={FileCheck2} /><MetricCard label="Safety holds" value="2" delta="Review now" hint="temporary restriction" tone="danger" icon={ShieldAlert} /></div><SearchField value={query} onChange={setQuery} placeholder="Search drivers" /><EntityTable type="driver" rows={drivers} query={query} onReview={openReview} /></div>;
}

function Customers() {
  const [query, setQuery] = useState("");
  const filtered = customers.filter((item) => `${item.id} ${item.name} ${item.city}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6"><PageHeader {...sectionMeta.customers} actions={<Button variant="outline"><Download className="h-4 w-4" />Export</Button>} /><div className="metric-grid"><MetricCard label="Active customers" value="18.4K" delta="+1.2K" hint="this month" tone="success" icon={UsersRound} /><MetricCard label="Repeat rate" value="38%" delta="+2.1 pts" hint="30-day cohort" tone="success" icon={Activity} /><MetricCard label="Restricted" value="12" delta="4 high risk" hint="manual controls" tone="danger" icon={LockKeyhole} /><MetricCard label="Support cases" value="28" delta="7 urgent" hint="open now" tone="warning" icon={ClipboardList} /></div><SearchField value={query} onChange={setQuery} placeholder="Search customers" /><SectionCard><div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead className={tableHead}><tr><th className={th}>Customer</th><th className={th}>City</th><th className={th}>Orders</th><th className={th}>Bookings</th><th className={th}>Lifetime spend</th><th className={th}>Status</th><th className={th}>Risk</th><th className={th}></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-t hover:bg-[var(--surface-2)]"><td className={td}><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.id}</p></td><td className={td}>{item.city}</td><td className={td}>{item.orders}</td><td className={td}>{item.bookings}</td><td className={cn(td, "font-semibold")}>{formatCurrency(item.spend)}</td><td className={td}><StatusBadge status={item.status} /></td><td className={td}><Badge tone={item.risk === "High" ? "danger" : "success"}>{item.risk}</Badge></td><td className={td}><Button size="sm" variant="outline">View</Button></td></tr>)}</tbody></table></div></SectionCard></div>;
}

function Finance() {
  return <div className="space-y-6"><PageHeader {...sectionMeta.finance} actions={<><Button variant="outline"><FileText className="h-4 w-4" />Reconciliation</Button><Button><Download className="h-4 w-4" />Export</Button></>} /><div className="metric-grid"><MetricCard label="Gross volume" value="US$284K" delta="+17.2%" hint="this month" tone="success" icon={CircleDollarSign} /><MetricCard label="Platform fees" value="US$28.4K" delta="10.0%" hint="effective take rate" icon={WalletCards} /><MetricCard label="Payouts pending" value="US$42.8K" delta="18 payouts" hint="next settlement" tone="warning" icon={CreditCard} /><MetricCard label="Disputed" value="US$486" delta="7 cases" hint="0.17% of volume" tone="danger" icon={AlertTriangle} /></div><div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><SectionCard title="Transactions" description="Latest platform money movement"><div className="overflow-x-auto"><table className="w-full min-w-[800px]"><thead className={tableHead}><tr><th className={th}>Reference</th><th className={th}>Type</th><th className={th}>Business</th><th className={th}>Gross</th><th className={th}>Fees</th><th className={th}>Net</th><th className={th}>Status</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.id} className="border-t"><td className={cn(td, "font-semibold text-[var(--accent)]")}>{item.id}</td><td className={td}>{item.type}</td><td className={td}>{item.business}</td><td className={cn(td, "font-semibold")}>{formatCurrency(item.gross)}</td><td className={td}>{formatCurrency(item.fees)}</td><td className={td}>{formatCurrency(item.net)}</td><td className={td}><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div></SectionCard><div className="space-y-5"><SectionCard title="Payout review"><div className="p-5"><div className="rounded-2xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex gap-3"><AlertTriangle className="h-5 w-5" /><div><p className="text-sm font-semibold">POT-3340 on hold</p><p className="mt-1 text-sm opacity-75">Nando&apos;s Avondale · active dispute TXN-88419</p></div></div></div><Button className="mt-4 w-full" variant="outline">Review payout</Button></div></SectionCard><SectionCard title="Settlement health"><div className="p-5"><div className="flex items-center justify-between"><span className="text-sm text-secondary">Successful this month</span><span className="font-semibold">99.4%</span></div><ProgressBar value={99.4} className="mt-3" color="#16a34a" /><p className="mt-4 text-xs leading-5 text-secondary">Two payouts required manual review. No bank file failures.</p></div></SectionCard></div></div></div>;
}

function Content() {
  const [categories, setCategories] = useState([
    { id: "cat-food", name: "Food & Drink", type: "Food", cities: 3, order: 1, status: "Active" },
    { id: "cat-retail", name: "Retail", type: "Retail", cities: 2, order: 2, status: "Active" },
    { id: "cat-services", name: "Services", type: "Services", cities: 3, order: 3, status: "Active" },
    { id: "cat-health", name: "Health & Wellness", type: "Health", cities: 1, order: 4, status: "Draft" }
  ]);
  const { toast } = useToast();
  return <div className="space-y-6"><PageHeader {...sectionMeta.content} actions={<Button onClick={() => { setCategories((current) => [...current, { id: `cat-${Date.now()}`, name: "New category", type: "Custom", cities: 0, order: current.length + 1, status: "Draft" }]); toast("Draft category created."); }}><Plus className="h-4 w-4" />New category</Button>} /><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><SectionCard title="Marketplace categories" description="Controls discovery hierarchy and availability"><div>{categories.map((item) => <div key={item.id} className="flex min-h-[68px] items-center gap-3 border-b px-4 py-3 last:border-b-0"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Tag className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{item.order}. {item.name}</p><p className="mt-1 text-sm text-secondary">{item.type} · {item.cities} cities</p></div><StatusBadge status={item.status} /><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></div>)}</div></SectionCard><div className="space-y-5"><SectionCard title="Active cities"><div><ListRow icon={MapPin} title="Harare" subtitle="Live · 428 businesses · 18.4K customers" trailing={<StatusBadge status="Active" />} /><div className="mx-4 border-t" /><ListRow icon={MapPin} title="Bulawayo" subtitle="Pilot · 42 businesses · 2.1K customers" trailing={<StatusBadge status="Active" />} /><div className="mx-4 border-t" /><ListRow icon={MapPin} title="Mutare" subtitle="Internal launch preparation" trailing={<StatusBadge status="Draft" />} /></div></SectionCard><SectionCard title="Discovery placements"><div><ListRow icon={LayoutDashboard} title="Home hero" subtitle="5 scheduled campaigns" /><div className="mx-4 border-t" /><ListRow icon={Store} title="Featured businesses" subtitle="12 active placements" /><div className="mx-4 border-t" /><ListRow icon={CalendarDays} title="Events carousel" subtitle="8 published events" /></div></SectionCard></div></div></div>;
}

function Platform({ services, setServices }) {
  const { toast } = useToast();
  function toggle(service) { setServices((current) => current.map((item) => item.id === service.id ? { ...item, status: item.status === "Operational" ? "Maintenance" : "Operational" } : item)); toast(`${service.name} status updated.`); }
  return <div className="space-y-6"><PageHeader {...sectionMeta.platform} actions={<Button variant="outline"><RefreshCw className="h-4 w-4" />Run checks</Button>} /><Card className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-green-100 text-success dark:bg-green-950/40"><CheckCircle2 className="h-7 w-7" /></span><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Platform available</h2><StatusBadge status="Operational" /></div><p className="mt-1 text-sm text-secondary">One service is degraded. Core order, dispatch, and authentication flows remain available.</p></div><p className="text-sm text-secondary">Last check · 40 seconds ago</p></div></Card><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{services.map((item) => <Card key={item.id} className="p-5"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Server className="h-5 w-5" /></span><StatusBadge status={item.status} /></div><h3 className="mt-5 font-semibold">{item.name}</h3><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-xs text-tertiary">Latency</p><p className="mt-1 font-semibold">{item.latency}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-xs text-tertiary">Uptime</p><p className="mt-1 font-semibold">{item.uptime}</p></div></div><Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => toggle(item)}>{item.status === "Operational" ? "Schedule maintenance" : "Mark operational"}</Button></Card>)}</div><SectionCard title="Integrations"><div className="grid gap-0 lg:grid-cols-2"><ListRow icon={KeyRound} title="Firebase Authentication" subtitle="Connected · production project" trailing={<StatusBadge status="Connected" />} /><ListRow icon={Network} title="Firestore" subtitle="Connected · multi-region" trailing={<StatusBadge status="Connected" />} /><ListRow icon={CreditCard} title="Payment gateway" subtitle="Connected · elevated latency" trailing={<StatusBadge status="Degraded" />} /><ListRow icon={Globe2} title="Maps & geocoding" subtitle="Connected · healthy quota" trailing={<StatusBadge status="Connected" />} /></div></SectionCard></div>;
}

function Audit() {
  const [query, setQuery] = useState("");
  const filtered = auditLog.filter((item) => `${item.actor} ${item.action} ${item.entity} ${item.reason}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6"><PageHeader {...sectionMeta.audit} actions={<Button variant="outline"><Download className="h-4 w-4" />Export log</Button>} /><Card className="border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex gap-3"><LockKeyhole className="mt-0.5 h-5 w-5" /><div><p className="text-sm font-semibold">Audit records are immutable</p><p className="mt-1 text-sm opacity-75">Sensitive actions, permission changes, reveals, approvals, and enforcement decisions are retained.</p></div></div></Card><SearchField value={query} onChange={setQuery} placeholder="Search actor, action, entity, or reason" /><SectionCard><div>{filtered.map((item) => <div key={item.id} className="flex gap-4 border-b px-5 py-4 last:border-b-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><ClipboardCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.actor}</p><Badge tone="neutral">{item.action}</Badge></div><p className="mt-2 text-sm">{item.entity}</p><p className="mt-1 text-sm text-secondary">Reason: {item.reason}</p><p className="mt-2 text-xs text-tertiary">{item.id} · {item.time}</p></div></div>)}</div></SectionCard></div>;
}

function SettingsView() {
  const { toast } = useToast();
  return <div className="space-y-6"><PageHeader {...sectionMeta.settings} actions={<Button onClick={() => toast("Admin settings saved.")}>Save changes</Button>} /><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Workspace"><div><ListRow icon={UserRound} title="My admin profile" subtitle="Aisha Moyo · Operations manager" /><div className="mx-4 border-t" /><ListRow icon={BellRingIcon} title="Notifications" subtitle="Critical incidents, queues, and finance alerts" /><div className="mx-4 border-t" /><ListRow icon={SlidersHorizontal} title="Dashboard preferences" subtitle="City, metrics, and saved filters" /></div></SectionCard><SectionCard title="Access control"><div><ListRow icon={UsersRound} title="Admin staff" subtitle="18 active staff accounts" /><div className="mx-4 border-t" /><ListRow icon={ShieldCheck} title="Roles & permissions" subtitle="8 roles · least-privilege access" /><div className="mx-4 border-t" /><ListRow icon={KeyRound} title="Authentication policy" subtitle="MFA required · 12-hour sessions" /></div></SectionCard><SectionCard title="Security"><div><ListRow icon={LockKeyhole} title="Sensitive data controls" subtitle="Masked by default · reason required to reveal" /><div className="mx-4 border-t" /><ListRow icon={ClipboardList} title="Audit retention" subtitle="7 years · immutable storage" /><div className="mx-4 border-t" /><ListRow icon={ShieldAlert} title="Incident escalation" subtitle="P0 and P1 routing rules" /></div></SectionCard><SectionCard title="Environment"><div className="p-5"><div className="flex items-center justify-between"><span className="text-sm text-secondary">Environment</span><Badge tone="success">Production</Badge></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-secondary">Region</span><span className="text-sm font-semibold">Africa multi-region</span></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-secondary">Release</span><span className="text-sm font-semibold">web-1.0.0</span></div><Button className="mt-5 w-full" variant="outline">View deployment details</Button></div></SectionCard></div></div>;
}

function BellRingIcon(props) { return <Activity {...props} />; }

function IncidentModal({ incident, onClose, onResolve }) {
  const [reason, setReason] = useState("");
  return <Modal open={Boolean(incident)} onClose={onClose} title={incident?.id || "Incident"} size="lg">{incident && <div className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Badge tone={incident.severity === "Critical" ? "danger" : "warning"}>{incident.severity}</Badge><StatusBadge status={incident.status} /></div><h3 className="mt-4 text-2xl font-semibold">{incident.type}</h3><p className="mt-2 leading-7 text-secondary">{incident.summary}</p></div><Button variant="outline"><Eye className="h-4 w-4" />Open linked records</Button></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Card className="p-4"><p className="text-xs uppercase tracking-wide text-tertiary">City</p><p className="mt-2 font-semibold">{incident.city}</p></Card><Card className="p-4"><p className="text-xs uppercase tracking-wide text-tertiary">Owner</p><p className="mt-2 font-semibold">{incident.owner}</p></Card><Card className="p-4"><p className="text-xs uppercase tracking-wide text-tertiary">Opened</p><p className="mt-2 font-semibold">{incident.opened}</p></Card></div><SectionCard title="Resolution reason" description="Required for audit history" className="mt-5"><div className="p-4"><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the investigation outcome and customer, driver, or business action taken…" className="surface min-h-32 w-full resize-y rounded-2xl bg-transparent p-4 outline-none focus:ring-2 focus:ring-[var(--accent)]/30" /></div></SectionCard><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="danger"><ShieldAlert className="h-4 w-4" />Escalate</Button><div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!reason.trim()} onClick={() => onResolve(incident.id, reason)}><CheckCircle2 className="h-4 w-4" />Resolve incident</Button></div></div></div>}</Modal>;
}

function ReviewModal({ entity, type, onClose, onDecision }) {
  const isBusiness = type === "business";
  const pending = isBusiness ? entity?.status === "In review" || entity?.status === "Needs information" : entity?.verification === "In review" || entity?.verification === "Needs information";
  return <Modal open={Boolean(entity)} onClose={onClose} title={entity ? `${isBusiness ? "Business" : "Driver"} review · ${entity.id}` : "Review"} size="lg">{entity && <div className="p-5"><div className="flex items-start gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--accent-soft)] text-lg font-bold text-[var(--accent)]">{initials(entity.name)}</span><div className="min-w-0 flex-1"><h3 className="text-2xl font-semibold">{entity.name}</h3><p className="mt-1 text-sm text-secondary">{entity.city} · {isBusiness ? entity.category : entity.vehicle}</p><div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={isBusiness ? entity.status : entity.verification} />{isBusiness && <Badge tone={entity.risk === "Medium" ? "warning" : "success"}>{entity.risk} risk</Badge>}</div></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{["Identity", isBusiness ? "Registration" : "Driver licence", isBusiness ? "Bank account" : "Vehicle"].map((item) => <Card key={item} className="p-4"><FileCheck2 className="h-5 w-5 text-success" /><p className="mt-3 text-sm font-semibold">{item}</p><p className="mt-1 text-xs text-secondary">Verified document</p></Card>)}</div><SectionCard title="Review checklist" className="mt-5"><div>{["Names match submitted identity", "Address and city are supported", "Required documents are current", "No duplicate or restricted account match"].map((item) => <div key={item} className="flex min-h-[58px] items-center gap-3 border-b px-4 last:border-b-0"><CheckCircle2 className="h-5 w-5 text-success" /><span className="text-sm font-medium">{item}</span></div>)}</div></SectionCard><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{pending ? <><Button variant="danger" onClick={() => onDecision(entity.id, "Rejected")}><XCircle className="h-4 w-4" />Reject</Button><Button variant="outline" onClick={() => onDecision(entity.id, "Needs information")}>Request information</Button><Button onClick={() => onDecision(entity.id, "Approved")}><BadgeCheck className="h-4 w-4" />Approve</Button></> : <Button variant="outline" onClick={onClose}>Close</Button>}</div></div>}</Modal>;
}

export function AdminApp({ section = "dashboard" }) {
  const safeSection = sectionMeta[section] ? section : "dashboard";
  const [incidents, setIncidents] = useState(seedIncidents);
  const [businesses, setBusinesses] = useState(seedBusinesses);
  const [drivers, setDrivers] = useState(seedDrivers);
  const [services, setServices] = useState(seedServices);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityType, setEntityType] = useState(null);
  const { toast } = useToast();

  function resolveIncident(id, reason) {
    setIncidents((current) => current.map((item) => item.id === id ? { ...item, status: "Resolved", owner: "Aisha Moyo", resolution: reason } : item));
    setSelectedIncident(null);
    toast(`${id} was resolved and written to the audit log.`, { title: "Incident resolved" });
  }

  function reviewEntity(entity, type) { setSelectedEntity(entity); setEntityType(type); }
  function decideEntity(id, decision) {
    if (entityType === "business") setBusinesses((current) => current.map((item) => item.id === id ? { ...item, status: decision === "Approved" ? "Active" : decision } : item));
    else setDrivers((current) => current.map((item) => item.id === id ? { ...item, verification: decision, status: decision === "Approved" ? "Offline" : item.status } : item));
    setSelectedEntity(null); toast(`${id} marked ${decision}.`, { title: "Review completed" });
  }

  return <PortalShell portalId="admin" activeSection={safeSection}><div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
    {safeSection === "dashboard" && <Dashboard incidents={incidents} services={services} />}
    {safeSection === "operations" && <Operations incidents={incidents} setIncidents={setIncidents} openIncident={setSelectedIncident} />}
    {safeSection === "businesses" && <Businesses businesses={businesses} openReview={(entity) => reviewEntity(entity, "business")} />}
    {safeSection === "drivers" && <Drivers drivers={drivers} openReview={(entity) => reviewEntity(entity, "driver")} />}
    {safeSection === "customers" && <Customers />}
    {safeSection === "finance" && <Finance />}
    {safeSection === "content" && <Content />}
    {safeSection === "platform" && <Platform services={services} setServices={setServices} />}
    {safeSection === "audit" && <Audit />}
    {safeSection === "settings" && <SettingsView />}
  </div><IncidentModal incident={selectedIncident} onClose={() => setSelectedIncident(null)} onResolve={resolveIncident} /><ReviewModal entity={selectedEntity} type={entityType} onClose={() => setSelectedEntity(null)} onDecision={decideEntity} /></PortalShell>;
}
