"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BadgeDollarSign,
  BarChart3,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  Globe2,
  ImagePlus,
  MapPin,
  MoreHorizontal,
  PackageCheck,
  Pause,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  TrendingUp,
  UserPlus,
  UsersRound,
  WalletCards
} from "lucide-react";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { BarChart, DonutChart, Sparkline } from "@/components/charts";
import { Badge, Button, Card, EmptyState, ListRow, MetricCard, Modal, PageHeader, ProgressBar, SearchField, SectionCard, Select, StatusBadge, Tabs, statusTone } from "@/components/ui";
import { useToast } from "@/components/providers";
import { businessMetrics, catalogItems as initialCatalogItems, orderMix, orders as initialOrders, payouts, promotions as initialPromotions, reservations, revenueSeries, staff as initialStaff } from "@/data/business";
import { cn } from "@/lib/cn";
import { formatCurrency, initials } from "@/lib/format";

const sectionMeta = {
  dashboard: { title: "Dashboard", description: "A live overview of Namaste Harare’s operation." },
  activity: { title: "Activity", description: "Orders, reservations, and operational work in one queue." },
  catalog: { title: "Catalog", description: "Manage products, services, availability, and pricing." },
  insights: { title: "Insights", description: "Understand revenue, demand, customers, and conversion." },
  promotions: { title: "Promotions", description: "Create offers and measure profitable growth." },
  staff: { title: "Staff", description: "Manage access, roles, invitations, and shifts." },
  finance: { title: "Finance", description: "Payouts, transactions, fees, and reconciliation." },
  settings: { title: "Settings", description: "Business details, locations, fulfilment, and integrations." }
};

function MetricStrip() {
  return <div className="metric-grid">{businessMetrics.map((metric, index) => <MetricCard key={metric.label} {...metric} tone={index === 0 || index === 3 ? "success" : "default"} />)}</div>;
}

function OrderRow({ order, onStatusChange, onOpen }) {
  const nextStatus = { New: "Preparing", Preparing: "Ready", Ready: "Collected", Collected: "Completed" }[order.status];
  return (
    <div className="grid min-h-[72px] items-center gap-3 border-b px-4 py-3 last:border-b-0 lg:grid-cols-[115px_1.2fr_.8fr_100px_120px_auto]">
      <button onClick={() => onOpen(order)} className="text-left text-sm font-semibold text-[var(--accent)] hover:underline">{order.id}</button>
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{order.customer}</p><p className="mt-1 truncate text-xs text-secondary">{order.items}</p></div>
      <div><p className="text-sm font-medium">{order.type}</p><p className="mt-1 text-xs text-secondary">{order.zone}</p></div>
      <p className="text-sm font-semibold">{formatCurrency(order.total)}</p>
      <StatusBadge status={order.status} />
      <div className="flex justify-end gap-2">{nextStatus && <Button size="sm" onClick={() => onStatusChange(order.id, nextStatus)}>{nextStatus}</Button>}<Button size="icon" variant="ghost" onClick={() => onOpen(order)}><ChevronRight className="h-4 w-4" /></Button></div>
    </div>
  );
}

function Dashboard({ orders, setOrders, openOrder }) {
  const { toast } = useToast();
  function updateOrder(id, status) {
    setOrders((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    toast(`${id} moved to ${status}.`, { title: "Order updated" });
  }
  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Monday · 20 July" title="Good evening, Chido" description="Namaste Harare is open. Three orders require action and the dining room has 72% capacity tonight." actions={<><Button variant="outline"><RefreshCw className="h-4 w-4" />Refresh</Button><Button><Plus className="h-4 w-4" />New order</Button></>} />
      <Card className="overflow-hidden border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-[linear-gradient(135deg,var(--surface),var(--accent-soft))] p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success text-white"><CheckCircle2 className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">Open and accepting orders</h2><Badge tone="success" dot>Operational</Badge></div><p className="mt-1 text-sm text-secondary">Delivery 25–35 min · Collection 15–20 min · Reservations available</p></div><div className="flex gap-2"><Button size="sm" variant="outline"><Pause className="h-4 w-4" />Pause orders</Button><Button size="sm" variant="secondary">Open workspace</Button></div></div>
      </Card>
      <MetricStrip />
      <div className="grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
        <SectionCard title="Live activity" description="Orders that need attention now" action={<Link href="/business/activity" className="text-sm font-semibold text-[var(--accent)]">View all</Link>}>
          <div className="overflow-x-auto"><div className="min-w-[850px]">{orders.slice(0, 4).map((order) => <OrderRow key={order.id} order={order} onStatusChange={updateOrder} onOpen={openOrder} />)}</div></div>
        </SectionCard>
        <SectionCard title="Tonight’s reservations" description={`${reservations.reduce((sum, item) => sum + item.party, 0)} guests expected`}>
          <div>{reservations.map((reservation) => <div key={reservation.id} className="flex min-h-[66px] items-center gap-3 border-b px-4 py-3 last:border-b-0"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)]">{reservation.time}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{reservation.name} · {reservation.party} guests</p><p className="mt-1 truncate text-xs text-secondary">{reservation.area} · {reservation.notes}</p></div><StatusBadge status={reservation.status} /></div>)}</div>
        </SectionCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <SectionCard title="Revenue" description="Last 12 weeks" action={<Badge tone="success">+18.4%</Badge>}><div className="p-5"><div className="flex items-end gap-3"><p className="text-3xl font-bold">US$8,426</p><p className="pb-1 text-sm text-secondary">this month</p></div><Sparkline values={revenueSeries} className="mt-5 h-32" /></div></SectionCard>
        <SectionCard title="Order mix" description="Today"><div className="flex flex-col items-center gap-5 p-5 sm:flex-row"><DonutChart segments={orderMix} centerValue="96" centerLabel="orders" /><div className="w-full space-y-3">{orderMix.map((item) => <div key={item.label} className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="flex-1 text-secondary">{item.label}</span><span className="font-semibold">{item.value}%</span></div>)}</div></div></SectionCard>
      </div>
    </div>
  );
}

function Activity({ orders, setOrders, openOrder }) {
  const [tab, setTab] = useState("orders");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const visibleOrders = orders.filter((order) => (filter === "All" || order.status === filter) && `${order.id} ${order.customer} ${order.items}`.toLowerCase().includes(query.toLowerCase()));
  function updateOrder(id, status) { setOrders((current) => current.map((item) => item.id === id ? { ...item, status } : item)); toast(`${id} moved to ${status}.`); }
  return (
    <div className="space-y-6"><PageHeader {...sectionMeta.activity} actions={<Button><Plus className="h-4 w-4" />Create order</Button>} /><Tabs value={tab} onChange={setTab} tabs={[{ value: "orders", label: `Orders (${orders.length})` }, { value: "reservations", label: `Reservations (${reservations.length})` }]} />
      {tab === "orders" ? <><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={query} onChange={setQuery} placeholder="Search orders or customers" /><div className="no-scrollbar flex gap-2 overflow-x-auto">{["All", "New", "Preparing", "Ready", "Collected", "Completed"].map((item) => <button key={item} onClick={() => setFilter(item)} className={cn("h-[52px] rounded-2xl border px-4 text-sm font-semibold", filter === item ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "surface")}>{item}</button>)}</div></div><SectionCard><div className="overflow-x-auto"><div className="min-w-[900px]">{visibleOrders.length ? visibleOrders.map((order) => <OrderRow key={order.id} order={order} onStatusChange={updateOrder} onOpen={openOrder} />) : <EmptyState icon={Search} title="No matching orders" description="Try another status or search term." />}</div></div></SectionCard></> : <SectionCard title="Reservation book" description="Today · all service areas"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">Guest</th><th className="px-5 py-3">Party</th><th className="px-5 py-3">Area</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Notes</th></tr></thead><tbody>{reservations.map((item) => <tr key={item.id} className="border-t"><td className="px-5 py-4 font-semibold">{item.time}</td><td className="px-5 py-4">{item.name}</td><td className="px-5 py-4">{item.party}</td><td className="px-5 py-4">{item.area}</td><td className="px-5 py-4"><StatusBadge status={item.status} /></td><td className="px-5 py-4 text-secondary">{item.notes}</td></tr>)}</tbody></table></div></SectionCard>}
    </div>
  );
}

function Catalog({ items, setItems }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();
  const visible = items.filter((item) => (status === "All" || item.status === status) && `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()));
  function saveItem(form) {
    if (form.id) setItems((current) => current.map((item) => item.id === form.id ? { ...item, ...form, price: Number(form.price), stock: Number(form.stock) } : item));
    else setItems((current) => [{ ...form, id: `item-${Date.now()}`, price: Number(form.price), stock: Number(form.stock), orders: 0, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=80" }, ...current]);
    setEditing(null); toast(`${form.name} was saved.`, { title: "Catalog updated" });
  }
  return (
    <div className="space-y-6"><PageHeader {...sectionMeta.catalog} actions={<><Button variant="outline"><Download className="h-4 w-4" />Export</Button><Button onClick={() => setEditing({ name: "", category: "Popular", price: "", stock: "", status: "Active" })}><Plus className="h-4 w-4" />Add item</Button></>} /><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={query} onChange={setQuery} placeholder="Search catalog" /><Tabs value={status} onChange={setStatus} tabs={[{ value: "All", label: "All" }, { value: "Active", label: "Active" }, { value: "Paused", label: "Paused" }]} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <Card key={item.id} className="overflow-hidden"><div className="relative aspect-[16/8]"><Image src={item.image} alt={item.name} fill className="object-cover" sizes="400px" /><button onClick={() => setEditing(item)} className="surface absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-gray-800"><Edit3 className="h-4 w-4" /></button></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{item.name}</h3><p className="mt-1 text-sm text-secondary">{item.category}</p></div><StatusBadge status={item.status} /></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[var(--surface-2)] p-2"><p className="text-xs text-tertiary">Price</p><p className="mt-1 text-sm font-semibold">{formatCurrency(item.price)}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-2"><p className="text-xs text-tertiary">Stock</p><p className="mt-1 text-sm font-semibold">{item.stock}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-2"><p className="text-xs text-tertiary">Orders</p><p className="mt-1 text-sm font-semibold">{item.orders}</p></div></div></div></Card>)}</div>
      <CatalogEditor key={editing?.id || (editing ? "new" : "closed")} item={editing} onClose={() => setEditing(null)} onSave={saveItem} onDelete={editing?.id ? () => { setItems((current) => current.filter((item) => item.id !== editing.id)); setEditing(null); toast(`${editing.name} was removed.`, { type: "error", title: "Item deleted" }); } : null} />
    </div>
  );
}

function CatalogEditor({ item, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(item || {});
  if (!item) return null;
  return <Modal open title={item.id ? "Edit catalog item" : "Add catalog item"} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave(form); }} className="space-y-5 p-5"><div className="grid gap-4 sm:grid-cols-2"><FormField label="Item name" value={form.name || ""} onChange={(value) => setForm({ ...form, name: value })} required /><FormField label="Category" value={form.category || ""} onChange={(value) => setForm({ ...form, category: value })} required /><FormField label="Price (USD)" type="number" value={form.price ?? ""} onChange={(value) => setForm({ ...form, price: value })} required /><FormField label="Available stock" type="number" value={form.stock ?? ""} onChange={(value) => setForm({ ...form, stock: value })} required /></div><label className="block"><span className="mb-2 block text-sm font-semibold">Status</span><select value={form.status || "Active"} onChange={(event) => setForm({ ...form, status: event.target.value })} className="surface h-[52px] w-full rounded-2xl bg-transparent px-4 outline-none"><option>Active</option><option>Paused</option></select></label><div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-between"><div>{onDelete && <Button variant="danger" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete</Button>}</div><div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save item</Button></div></div></form></Modal>;
}

function FormField({ label, value, onChange, type = "text", required, placeholder }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} className="surface h-[52px] w-full rounded-2xl bg-transparent px-4 outline-none focus:ring-2 focus:ring-[var(--accent)]/30" /></label>;
}

function Insights() {
  const daily = revenueSeries.map((amount, index) => ({ day: `${index + 1}`, amount }));
  return <div className="space-y-6"><PageHeader {...sectionMeta.insights} actions={<Select value="30 days" onChange={() => {}} options={["7 days", "30 days", "90 days"]} />} /><div className="metric-grid"><MetricCard label="Gross revenue" value="US$8,426" delta="+18.4%" hint="vs previous period" tone="success" icon={CircleDollarSign} /><MetricCard label="Net revenue" value="US$7,583" delta="90.0%" hint="after Spotly fees" icon={WalletCards} /><MetricCard label="Orders" value="642" delta="+12.8%" hint="across all channels" icon={ShoppingBag} /><MetricCard label="Conversion" value="8.7%" delta="+1.2 pts" hint="profile views to orders" icon={TrendingUp} /></div><div className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]"><SectionCard title="Revenue trend" description="Daily gross revenue"><div className="p-5"><BarChart data={daily} height={250} formatValue={(value) => formatCurrency(value)} /></div></SectionCard><SectionCard title="Order mix" description="Fulfilment distribution"><div className="flex flex-col items-center gap-5 p-5"><DonutChart segments={orderMix} centerValue="642" centerLabel="orders" /><div className="w-full space-y-3">{orderMix.map((item) => <div key={item.label} className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="flex-1 text-secondary">{item.label}</span><span className="font-semibold">{item.value}%</span></div>)}</div></div></SectionCard></div><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Top products"><div>{initialCatalogItems.slice(0, 4).map((item, index) => <div key={item.id} className="flex min-h-[64px] items-center gap-3 border-b px-4 py-3 last:border-b-0"><span className="w-6 text-sm font-bold text-tertiary">{index + 1}</span><Image src={item.image} alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.orders} orders</p></div><p className="text-sm font-semibold">{formatCurrency(item.orders * item.price)}</p></div>)}</div></SectionCard><SectionCard title="Customer signals"><div className="grid grid-cols-2 gap-3 p-5"><div className="rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-sm text-secondary">Returning customers</p><p className="mt-3 text-3xl font-bold">38%</p><ProgressBar value={38} className="mt-3" /></div><div className="rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-sm text-secondary">Average basket</p><p className="mt-3 text-3xl font-bold">US$13.12</p><p className="mt-3 text-xs font-semibold text-success">+US$1.04</p></div><div className="rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-sm text-secondary">Profile saves</p><p className="mt-3 text-3xl font-bold">184</p><p className="mt-3 text-xs text-tertiary">Last 30 days</p></div><div className="rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-sm text-secondary">Average rating</p><p className="mt-3 flex items-center gap-2 text-3xl font-bold">4.8 <Star className="h-6 w-6 fill-amber-400 text-amber-400" /></p><p className="mt-3 text-xs text-tertiary">312 reviews</p></div></div></SectionCard></div></div>;
}

function Promotions({ promotions, setPromotions }) {
  const [creating, setCreating] = useState(false); const { toast } = useToast();
  function duplicate(item) { setPromotions((current) => [{ ...item, id: `p-${Date.now()}`, name: `${item.name} copy`, code: `${item.code}2`, status: "Draft", redemptions: 0, spent: 0 }, ...current]); toast("Promotion duplicated."); }
  return <div className="space-y-6"><PageHeader {...sectionMeta.promotions} actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create promotion</Button>} /><div className="grid gap-4 lg:grid-cols-3">{promotions.map((item) => <Card key={item.id} className="p-5"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><BadgeDollarSign className="h-5 w-5" /></span><StatusBadge status={item.status} /></div><h3 className="mt-5 text-lg font-semibold">{item.name}</h3><div className="mt-2 flex items-center gap-2"><code className="rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs font-semibold">{item.code}</code><button onClick={() => navigator.clipboard?.writeText(item.code)}><Copy className="h-4 w-4 text-tertiary" /></button></div><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-xs text-tertiary">Discount</p><p className="mt-1 font-semibold">{item.discount}</p></div><div><p className="text-xs text-tertiary">Redemptions</p><p className="mt-1 font-semibold">{item.redemptions}</p></div></div><div className="mt-5"><div className="flex justify-between text-xs"><span className="text-secondary">Budget used</span><span className="font-semibold">{formatCurrency(item.spent)} / {formatCurrency(item.budget)}</span></div><ProgressBar value={(item.spent / item.budget) * 100} className="mt-2" /></div><div className="mt-5 flex gap-2"><Button size="sm" variant="outline" className="flex-1"><Edit3 className="h-4 w-4" />Edit</Button><Button size="sm" variant="ghost" onClick={() => duplicate(item)}><Copy className="h-4 w-4" /></Button></div></Card>)}</div><CreatePromotion open={creating} onClose={() => setCreating(false)} onCreate={(item) => { setPromotions((current) => [{ ...item, id: `p-${Date.now()}`, redemptions: 0, spent: 0, status: "Active" }, ...current]); setCreating(false); toast("Promotion is now active."); }} /></div>;
}

function CreatePromotion({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", code: "", discount: "10%", budget: 200, ends: "31 Aug" });
  return <Modal open={open} onClose={onClose} title="Create promotion"><form onSubmit={(event) => { event.preventDefault(); onCreate(form); }} className="space-y-4 p-5"><FormField label="Promotion name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required /><div className="grid gap-4 sm:grid-cols-2"><FormField label="Promo code" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase() })} required /><FormField label="Discount" value={form.discount} onChange={(value) => setForm({ ...form, discount: value })} required /><FormField label="Budget (USD)" type="number" value={form.budget} onChange={(value) => setForm({ ...form, budget: Number(value) })} required /><FormField label="End date" value={form.ends} onChange={(value) => setForm({ ...form, ends: value })} required /></div><div className="flex justify-end gap-2 border-t pt-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Launch promotion</Button></div></form></Modal>;
}

function Staff({ staff, setStaff }) {
  const [query, setQuery] = useState(""); const [invite, setInvite] = useState(false); const { toast } = useToast();
  const visible = staff.filter((item) => `${item.name} ${item.role} ${item.email}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6"><PageHeader {...sectionMeta.staff} actions={<Button onClick={() => setInvite(true)}><UserPlus className="h-4 w-4" />Invite staff</Button>} /><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={query} onChange={setQuery} placeholder="Search staff" /><Button variant="outline"><ShieldCheck className="h-4 w-4" />Manage roles</Button></div><SectionCard><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Staff member</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Access / shift</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">{initials(item.name)}</span><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.email}</p></div></div></td><td className="px-5 py-4">{item.role}</td><td className="px-5 py-4 text-secondary">{item.shift}</td><td className="px-5 py-4"><StatusBadge status={item.status} /></td><td className="px-5 py-4"><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></SectionCard><InviteStaff open={invite} onClose={() => setInvite(false)} onInvite={(item) => { setStaff((current) => [{ ...item, id: `s-${Date.now()}`, status: "Invited", shift: "Pending" }, ...current]); setInvite(false); toast(`Invitation sent to ${item.email}.`); }} /></div>;
}

function InviteStaff({ open, onClose, onInvite }) {
  const [form, setForm] = useState({ name: "", email: "", role: "Front desk" });
  return <Modal open={open} onClose={onClose} title="Invite staff member"><form onSubmit={(event) => { event.preventDefault(); onInvite(form); }} className="space-y-4 p-5"><FormField label="Full name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required /><FormField label="Email address" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required /><label className="block"><span className="mb-2 block text-sm font-semibold">Role</span><select className="surface h-[52px] w-full rounded-2xl bg-transparent px-4 outline-none" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>Manager</option><option>Front desk</option><option>Kitchen</option><option>Finance</option></select></label><div className="flex justify-end gap-2 border-t pt-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Send invitation</Button></div></form></Modal>;
}

function Finance() {
  return <div className="space-y-6"><PageHeader {...sectionMeta.finance} actions={<><Button variant="outline"><FileText className="h-4 w-4" />Statements</Button><Button><Download className="h-4 w-4" />Export</Button></>} /><div className="metric-grid"><MetricCard label="Available balance" value="US$1,274.80" delta="Ready" hint="for payout" tone="success" icon={WalletCards} /><MetricCard label="Next payout" value="US$842.10" delta="24 Jul" hint="CABS ••4521" icon={CalendarDays} /><MetricCard label="Gross this month" value="US$8,426" delta="+18.4%" hint="before fees" tone="success" icon={CircleDollarSign} /><MetricCard label="Spotly fees" value="US$842.60" delta="10.0%" hint="effective rate" icon={ReceiptText} /></div><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><SectionCard title="Payout history" description="Settlements to CABS ••4521"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{payouts.map((item) => <tr key={item.id} className="border-t"><td className="px-5 py-4 font-semibold text-[var(--accent)]">{item.id}</td><td className="px-5 py-4">{item.date}</td><td className="px-5 py-4 text-secondary">{item.method}</td><td className="px-5 py-4 font-semibold">{formatCurrency(item.amount)}</td><td className="px-5 py-4"><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div></SectionCard><SectionCard title="Payout method"><div className="p-5"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><WalletCards className="h-5 w-5" /></span><div><p className="font-semibold">CABS business account</p><p className="mt-1 text-sm text-secondary">•••• 4521 · USD</p></div></div><div className="mt-5 rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-sm font-semibold">Weekly automatic payout</p><p className="mt-1 text-sm text-secondary">Every Friday, less active holds and disputes.</p></div><Button className="mt-5 w-full" variant="outline">Manage payout method</Button></div></SectionCard></div></div>;
}

function SettingsView() {
  const { toast } = useToast(); const [accepting, setAccepting] = useState(true); const [delivery, setDelivery] = useState(true); const [reservationsEnabled, setReservationsEnabled] = useState(true);
  return <div className="space-y-6"><PageHeader {...sectionMeta.settings} actions={<Button onClick={() => toast("Business settings saved.")}>Save changes</Button>} /><div className="grid gap-5 lg:grid-cols-[1fr_340px]"><div className="space-y-5"><SectionCard title="Business identity" description="Public information shown to customers"><div className="grid gap-4 p-5 sm:grid-cols-2"><FormField label="Business name" value="Namaste Harare" onChange={() => {}} /><FormField label="Category" value="Restaurant" onChange={() => {}} /><FormField label="Phone" value="+263 77 200 0001" onChange={() => {}} /><FormField label="Email" value="hello@namaste.co.zw" onChange={() => {}} /><div className="sm:col-span-2"><FormField label="Address" value="Borrowdale Road, Harare" onChange={() => {}} /></div></div></SectionCard><SectionCard title="Operations" description="Control active customer-facing capabilities"><div><ToggleRow icon={ShoppingBag} title="Accepting orders" subtitle="Allow customers to place food orders" value={accepting} onChange={setAccepting} /><div className="mx-4 border-t" /><ToggleRow icon={PackageCheck} title="Delivery" subtitle="Offer delivery through Spotly Driver" value={delivery} onChange={setDelivery} /><div className="mx-4 border-t" /><ToggleRow icon={CalendarDays} title="Reservations" subtitle="Allow table reservation requests" value={reservationsEnabled} onChange={setReservationsEnabled} /></div></SectionCard><SectionCard title="Integrations"><div><ListRow icon={Printer} title="Receipt printer" subtitle="Star Micronics TSP143 · Connected" trailing={<StatusBadge status="Connected" />} /><div className="mx-4 border-t" /><ListRow icon={Globe2} title="Website ordering" subtitle="Embed Spotly ordering on your website" trailing={<StatusBadge status="Active" />} /><div className="mx-4 border-t" /><ListRow icon={ReceiptText} title="Accounting export" subtitle="Connect Xero or QuickBooks" trailing={<Button size="sm" variant="outline">Connect</Button>} /></div></SectionCard></div><div className="space-y-5"><Card className="overflow-hidden"><div className="relative aspect-square"><Image src="/brand/spotly-business.png" alt="Spotly Business icon" fill className="object-cover" /></div><div className="p-4"><h3 className="font-semibold">Namaste Harare</h3><p className="mt-1 text-sm text-secondary">Verified Spotly Business</p><Button className="mt-4 w-full" variant="outline"><Eye className="h-4 w-4" />View customer profile</Button></div></Card><SectionCard title="Business status"><div className="p-5"><div className="flex items-center justify-between"><span className="text-sm text-secondary">Account</span><StatusBadge status="Active" /></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-secondary">Verification</span><StatusBadge status="Approved" /></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-secondary">Payouts</span><StatusBadge status="Connected" /></div></div></SectionCard></div></div></div>;
}

function ToggleRow({ icon: Icon, title, subtitle, value, onChange }) {
  return <div className="flex min-h-[70px] items-center gap-3 px-4 py-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-secondary">{subtitle}</p></div><button role="switch" aria-checked={value} onClick={() => onChange(!value)} className={cn("relative h-7 w-12 rounded-full transition", value ? "bg-[var(--accent)]" : "bg-gray-300 dark:bg-gray-700")}><span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition", value ? "left-6" : "left-1")} /></button></div>;
}

function OrderModal({ order, onClose, onUpdate }) {
  const next = { New: "Preparing", Preparing: "Ready", Ready: "Collected", Collected: "Completed" }[order?.status];
  return <Modal open={Boolean(order)} onClose={onClose} title={order?.id || "Order"}>{order && <div className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-secondary">Customer</p><h3 className="mt-1 text-xl font-semibold">{order.customer}</h3></div><StatusBadge status={order.status} /></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Card className="p-4"><p className="text-xs uppercase tracking-wide text-tertiary">Fulfilment</p><p className="mt-2 font-semibold">{order.type}</p><p className="mt-1 text-sm text-secondary">{order.zone}</p></Card><Card className="p-4"><p className="text-xs uppercase tracking-wide text-tertiary">Expected</p><p className="mt-2 font-semibold">{order.eta}</p><p className="mt-1 text-sm text-secondary">Placed {order.placed}</p></Card></div><SectionCard title="Items" className="mt-5"><div className="flex items-center justify-between px-4 py-4"><div><p className="font-semibold">{order.items}</p><p className="mt-1 text-sm text-secondary">Customer notes: No special requests</p></div><p className="font-semibold">{formatCurrency(order.total)}</p></div></SectionCard><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline"><Printer className="h-4 w-4" />Print</Button>{next && <Button onClick={() => { onUpdate(order.id, next); onClose(); }}>{next}</Button>}</div></div>}</Modal>;
}

export function BusinessApp({ section = "dashboard" }) {
  const safeSection = sectionMeta[section] ? section : "dashboard";
  const [orders, setOrders] = useState(initialOrders);
  const [items, setItems] = useState(initialCatalogItems);
  const [promotions, setPromotions] = useState(initialPromotions);
  const [staff, setStaff] = useState(initialStaff);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { toast } = useToast();
  function updateOrder(id, status) { setOrders((current) => current.map((item) => item.id === id ? { ...item, status } : item)); toast(`${id} moved to ${status}.`); }
  return <PortalShell portalId="business" activeSection={safeSection}><div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
    {safeSection === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} openOrder={setSelectedOrder} />}
    {safeSection === "activity" && <Activity orders={orders} setOrders={setOrders} openOrder={setSelectedOrder} />}
    {safeSection === "catalog" && <Catalog items={items} setItems={setItems} />}
    {safeSection === "insights" && <Insights />}
    {safeSection === "promotions" && <Promotions promotions={promotions} setPromotions={setPromotions} />}
    {safeSection === "staff" && <Staff staff={staff} setStaff={setStaff} />}
    {safeSection === "finance" && <Finance />}
    {safeSection === "settings" && <SettingsView />}
  </div><OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdate={updateOrder} /></PortalShell>;
}
