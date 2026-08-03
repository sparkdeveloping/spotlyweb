"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  FileCheck2,
  HelpCircle,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Trash2,
  UserPlus,
  UsersRound,
  WalletCards
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
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
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import {
  inviteBusinessStaff,
  removeProduct,
  saveBranch,
  saveBusinessFinanceSettings,
  saveBusinessProfile,
  saveProduct,
  sendSupportMessage,
  subscribeBranches,
  subscribeBusiness,
  subscribeBusinessCatalog,
  subscribeBusinessClaimsForBusiness,
  subscribeBusinessFinanceSettings,
  subscribeBusinessInvitations,
  subscribeClaims,
  subscribeOrdersForBusiness,
  subscribeSupportConversations,
  subscribeSupportMessages,
  updateOrderStatus
} from "@/lib/firebase-services";
import { formatCurrency } from "@/lib/format";

const meta = {
  dashboard: { title: "Business dashboard", description: "The most useful next actions across your Spotly operation." },
  activity: { title: "Orders & pickup", description: "Prepare, confirm, and complete grocery pickup orders." },
  catalog: { title: "Catalog", description: "Products, pricing, availability, and pickup eligibility." },
  branches: { title: "Branches", description: "Branch-specific locations, hours, pickup, and payment settings." },
  insights: { title: "Insights", description: "Operational signals generated from live Spotly activity." },
  promotions: { title: "Promotions", description: "Promotions will activate when the customer marketplace is enabled." },
  staff: { title: "Staff & access", description: "Invite people with the least access they need." },
  finance: { title: "Finance", description: "Currencies, payment methods, recipient, and payout preferences." },
  support: { title: "Support", description: "Keep a complete conversation history with Spotly Support." },
  settings: { title: "Business settings", description: "Public profile, publication readiness, and operating defaults." }
};

function useBusinessData(user, memberships) {
  const membership = memberships.find((item) => item.businessId || item.businessIds?.length);
  const businessId = membership?.businessId || membership?.businessIds?.[0] || "";
  const [business, setBusiness] = useState(null);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [claims, setClaims] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [finance, setFinance] = useState(null);
  const [support, setSupport] = useState([]);
  const [loading, setLoading] = useState(Boolean(businessId));

  useEffect(() => {
    if (!businessId) { setLoading(false); return undefined; }
    setLoading(true);
    const cleanups = [
      subscribeBusiness(businessId, (value) => { setBusiness(value); setLoading(false); }, () => setLoading(false)),
      subscribeBranches(businessId, setBranches, () => {}),
      subscribeBusinessCatalog(businessId, setProducts, () => {}),
      subscribeOrdersForBusiness(businessId, setOrders, () => {}),
      subscribeBusinessClaimsForBusiness(businessId, setClaims, () => {}),
      subscribeBusinessInvitations(businessId, setInvitations, () => {}),
      subscribeBusinessFinanceSettings(businessId, setFinance, () => {}),
      subscribeSupportConversations(setSupport, { businessId, onError: () => {} })
    ];
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, [businessId]);

  return { membership, businessId, business, branches, products, orders, claims, invitations, finance, support, loading };
}

function NoBusiness({ user }) {
  const [claims, setClaims] = useState([]);
  useEffect(() => subscribeClaims(setClaims, { applicantId: user.uid, limit: 20, onError: () => {} }), [user.uid]);
  return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><PageHeader title="Your Spotly Business workspace" description="Claim an existing listing or add a business before operational tools can be attached to your account." /><div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><Card className="p-7"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-business-soft text-business"><Building2 className="h-7 w-7" /></span><h2 className="mt-5 text-2xl font-black">Start with the business that already exists.</h2><p className="mt-3 leading-7 text-secondary">Spotly searches provisional Zimbabwean listings first. Confirm what is correct, edit what is not, and submit ownership evidence.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href="/claim"><Button>Find or claim a business<ArrowRight className="h-4 w-4" /></Button></Link><Link href="/claim?new=1"><Button variant="outline">Add a new business</Button></Link></div></Card><SectionCard title="Your applications" description="Verification status updates appear here.">{claims.length ? <div>{claims.map((claim) => <div key={claim.id} className="flex items-center gap-3 border-b p-4 last:border-0"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-business-soft text-business"><FileCheck2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Claim {claim.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-xs text-secondary">Business: {claim.businessId}</p></div><StatusBadge status={claim.status?.replaceAll("_", " ") || "submitted"} /></div>)}</div> : <EmptyState icon={FileCheck2} title="No applications yet" description="Your first claim or business application will appear here with a clear status." action={<Link href="/claim"><Button size="sm">Start an application</Button></Link>} />}</SectionCard></div></div>;
}

function Readiness({ business, branches, products, finance, claims }) {
  const checks = [
    { label: "Ownership verified", done: business?.verificationStatus === "approved" || business?.claimStatus === "claimed" },
    { label: "Public profile completed", done: Boolean(business?.description && business?.phone && business?.city) },
    { label: "At least one active branch", done: branches.some((branch) => branch.status === "active") },
    { label: "Pickup-ready catalog", done: products.some((product) => product.active && product.pickupEligible) },
    { label: "Payment and payout settings", done: Boolean(finance?.paymentMethods?.length && finance?.payoutCadence) }
  ];
  const complete = checks.filter((item) => item.done).length;
  const percent = Math.round((complete / checks.length) * 100);
  return <SectionCard title="Launch readiness" description={`${complete} of ${checks.length} important setup areas complete`}><div className="p-5"><div className="flex items-center justify-between"><span className="text-3xl font-black">{percent}%</span><Badge tone={percent === 100 ? "success" : "warning"}>{percent === 100 ? "Ready for admin review" : "Action required"}</Badge></div><ProgressBar value={percent} className="mt-4" /><div className="mt-5 space-y-3">{checks.map((item) => <div key={item.label} className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.done ? "bg-emerald-50 text-success" : "bg-grouped text-tertiary"}`}>{item.done ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}</span><span className="text-sm font-semibold">{item.label}</span></div>)}</div>{claims.some((claim) => claim.status === "needs_information") && <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">Verification needs more information. Open your claim or support conversation before completing publication setup.</div>}</div></SectionCard>;
}

function Dashboard({ data }) {
  const pendingOrders = data.orders.filter((order) => !["completed", "cancelled", "picked_up"].includes(order.status)).length;
  const activeProducts = data.products.filter((product) => product.active).length;
  return <div className="space-y-6"><PageHeader title={data.business?.name || "Business dashboard"} description={`${data.business?.city || "Zimbabwe"} · ${data.business?.category || "Business"} · ${data.branches.length} branch${data.branches.length === 1 ? "" : "es"}`} actions={<StatusBadge status={data.business?.verificationStatus || data.business?.status || "draft"} />} /><div className="metric-grid"><MetricCard label="Orders needing action" value={String(pendingOrders)} hint={pendingOrders ? "Open the pickup queue" : "Nothing waiting right now"} icon={ShoppingBag} tone={pendingOrders ? "warning" : "success"} /><MetricCard label="Active products" value={String(activeProducts)} hint={`${data.products.length} total catalog items`} icon={BookOpenCheck} /><MetricCard label="Branches" value={String(data.branches.length)} hint={data.branches.length ? "Branch-level controls enabled" : "Add your first branch"} icon={MapPin} /><MetricCard label="Support conversations" value={String(data.support.filter((item) => item.status !== "closed").length)} hint="Open or awaiting response" icon={MessageCircle} /></div><div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]"><Readiness {...data} /><SectionCard title="Recommended next actions" description="Based on your current setup"><div>{[
    { icon: data.branches.length ? CheckCircle2 : MapPin, title: data.branches.length ? "Review branch hours" : "Add your first branch", subtitle: "Pickup availability depends on accurate branch settings", href: "/business/branches" },
    { icon: data.products.length ? PackageCheck : BookOpenCheck, title: data.products.length ? "Check product availability" : "Create your pickup catalog", subtitle: "Use helpful names, prices, and stock status", href: "/business/catalog" },
    { icon: financeIcon(data.finance), title: data.finance ? "Review finance preferences" : "Configure payment methods", subtitle: "USD, ZiG, Paynow, mobile money, card, cash, and bank transfer", href: "/business/finance" },
    { icon: HeadphonesIcon, title: "Ask Spotly Support", subtitle: "Keep context and replies in one conversation", href: "/business/support" }
  ].map((item) => <Link key={item.title} href={item.href} className="flex items-center gap-3 border-b p-4 last:border-0 hover:bg-[var(--surface-2)]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-business-soft text-business"><item.icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs text-secondary">{item.subtitle}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div></SectionCard></div></div>;
}
function financeIcon(finance) { return finance ? WalletCards : CircleDollarSign; }
function HeadphonesIcon(props) { return <HelpCircle {...props} />; }

function OrdersView({ orders, user }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState("active");
  const visible = orders.filter((order) => filter === "all" || (filter === "active" ? !["picked_up", "completed", "cancelled"].includes(order.status) : ["picked_up", "completed", "cancelled"].includes(order.status)));
  async function advance(order) {
    const next = { new: "accepted", accepted: "preparing", preparing: "ready_for_pickup", ready_for_pickup: "picked_up" }[order.status] || "completed";
    try { await updateOrderStatus(order.id, next, user); toast(`Order moved to ${next.replaceAll("_", " ")}.`, { title: "Order updated" }); } catch (error) { toast(error.message, { type: "error", title: "Could not update order" }); }
  }
  return <div className="space-y-6"><PageHeader {...meta.activity} /><Tabs value={filter} onChange={setFilter} tabs={[{ value: "active", label: "Needs action" }, { value: "completed", label: "Completed" }, { value: "all", label: "All orders" }]} /><SectionCard>{visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Pickup</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((order) => <tr key={order.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold">{order.reference || order.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-xs text-secondary">{order.itemCount || order.items?.length || 0} items</p></td><td className="px-5 py-4">{order.customerName || "Spotly customer"}</td><td className="px-5 py-4">{order.pickupAt || order.pickupWindow || "Awaiting slot"}</td><td className="px-5 py-4 font-semibold">{formatCurrency(order.total || 0, order.currency || "USD")}</td><td className="px-5 py-4"><StatusBadge status={(order.status || "new").replaceAll("_", " ")} /></td><td className="px-5 py-4"><Button size="sm" onClick={() => advance(order)} disabled={["picked_up", "completed", "cancelled"].includes(order.status)}>Advance status</Button></td></tr>)}</tbody></table></div> : <EmptyState icon={ShoppingBag} title={filter === "active" ? "No orders need attention" : "No orders in this view"} description="New grocery pickup orders will appear here in realtime with a useful next action." />}</SectionCard></div>;
}

function ProductModal({ product, open, onClose, businessId, user }) {
  const [form, setForm] = useState(product || { name: "", description: "", category: "Groceries", price: "", currency: "USD", stockStatus: "in_stock", stockQuantity: 0, stockMode: "status", active: true, pickupEligible: true, sku: "", barcode: "" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  useEffect(() => { setForm(product || { name: "", description: "", category: "Groceries", price: "", currency: "USD", stockStatus: "in_stock", stockQuantity: 0, stockMode: "status", active: true, pickupEligible: true, sku: "", barcode: "" }); }, [product, open]);
  async function submit(event) { event.preventDefault(); setLoading(true); try { await saveProduct(form, businessId, user); toast("Product saved to Firebase.", { title: "Catalog updated" }); onClose(); } catch (error) { toast(error.message, { type: "error", title: "Could not save product" }); } finally { setLoading(false); } }
  return <Modal open={open} onClose={onClose} title={form.id ? "Edit product" : "Add product"}><form onSubmit={submit} className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Product name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Description</span><textarea value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} className="surface min-h-24 w-full rounded-xl p-4 outline-none" /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Category</span><input value={form.category || ""} onChange={(event) => setForm({ ...form, category: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">SKU</span><input value={form.sku || ""} onChange={(event) => setForm({ ...form, sku: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Price</span><div className="flex"><select value={form.currency || "USD"} onChange={(event) => setForm({ ...form, currency: event.target.value })} className="surface h-12 rounded-l-xl border-r-0 px-3"><option>USD</option><option>ZWG</option></select><input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="surface h-12 min-w-0 flex-1 rounded-r-xl px-4 outline-none" /></div></label><label><span className="mb-2 block text-sm font-semibold">Availability</span><select value={form.stockStatus || "in_stock"} onChange={(event) => setForm({ ...form, stockStatus: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="unavailable">Unavailable</option></select></label></div><div className="flex flex-wrap gap-5 rounded-xl bg-grouped p-4"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active !== false} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Active</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.pickupEligible !== false} onChange={(event) => setForm({ ...form, pickupEligible: event.target.checked })} />Pickup eligible</label></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>Save product</Button></div></form></Modal>;
}

function CatalogView({ products, businessId, user }) {
  const [queryText, setQueryText] = useState("");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const visible = products.filter((item) => [item.name, item.category, item.sku, item.barcode].join(" ").toLowerCase().includes(queryText.toLowerCase()));
  async function remove(item) { if (!window.confirm(`Delete ${item.name}?`)) return; try { await removeProduct(item.id, user); toast("Product deleted."); } catch (error) { toast(error.message, { type: "error" }); } }
  return <div className="space-y-6"><PageHeader {...meta.catalog} actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" />Add product</Button>} /><SearchField value={queryText} onChange={setQueryText} placeholder="Search name, category, SKU, or barcode" /><SectionCard>{visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Stock</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((product) => <tr key={product.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-secondary">{product.sku || "No SKU"}</p></td><td className="px-5 py-4">{product.category}</td><td className="px-5 py-4 font-semibold">{formatCurrency(product.price || 0, product.currency || "USD")}</td><td className="px-5 py-4"><StatusBadge status={(product.stockStatus || "in_stock").replaceAll("_", " ")} /></td><td className="px-5 py-4"><StatusBadge status={product.active ? "Active" : "Paused"} /></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => { setEditing(product); setOpen(true); }}><Edit3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => remove(product)}><Trash2 className="h-4 w-4 text-danger" /></Button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={BookOpenCheck} title={queryText ? "No products match" : "Create the first useful product"} description={queryText ? "Try another product name, category, SKU, or barcode." : "Add a grocery item with a clear price, stock state, and pickup eligibility."} action={!queryText && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add product</Button>} />}</SectionCard><ProductModal product={editing} open={open} onClose={() => setOpen(false)} businessId={businessId} user={user} /></div>;
}

function BranchModal({ branch, open, onClose, business, user }) {
  const [form, setForm] = useState(branch || { name: "", city: "Harare", address: "", phone: "", email: "", public: true, status: "active", fulfilment: ["pickup"] });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  useEffect(() => setForm(branch || { name: "", city: "Harare", address: "", phone: "", email: "", public: true, status: "active", fulfilment: ["pickup"] }), [branch, open]);
  async function submit(event) { event.preventDefault(); setLoading(true); try { await saveBranch(form, business.id, business.organizationId, user); toast("Branch settings saved."); onClose(); } catch (error) { toast(error.message, { type: "error", title: "Could not save branch" }); } finally { setLoading(false); } }
  return <Modal open={open} onClose={onClose} title={form.id ? "Edit branch" : "Add branch"}><form onSubmit={submit} className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Branch name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder={`${business?.name || "Business"} — City / suburb`} /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">City</span><input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Phone</span><input value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="+263" /></label></div><label className="block"><span className="mb-2 block text-sm font-semibold">Address</span><input value={form.address || ""} onChange={(event) => setForm({ ...form, address: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Status</span><select value={form.status || "active"} onChange={(event) => setForm({ ...form, status: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option></select></label><label className="flex items-end gap-2 pb-3 text-sm font-semibold"><input type="checkbox" checked={form.public !== false} onChange={(event) => setForm({ ...form, public: event.target.checked })} />Visible publicly when approved</label></div><div className="rounded-xl bg-grouped p-4"><p className="text-sm font-semibold">Pickup defaults</p><p className="mt-1 text-xs leading-5 text-secondary">30-minute windows, 12 orders per slot, and a 45-minute preparation buffer. Edit advanced values after creating the branch.</p></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>Save branch</Button></div></form></Modal>;
}

function BranchesView({ branches, business, user }) {
  const [editing, setEditing] = useState(null); const [open, setOpen] = useState(false);
  return <div className="space-y-6"><PageHeader {...meta.branches} actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" />Add branch</Button>} />{branches.length ? <div className="grid gap-4 lg:grid-cols-2">{branches.map((branch) => <Card key={branch.id} className="p-5"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-business-soft text-business"><Store className="h-5 w-5" /></span><StatusBadge status={branch.status || "active"} /></div><h3 className="mt-5 text-lg font-bold">{branch.name}</h3><p className="mt-2 text-sm text-secondary">{branch.address || `${branch.city} · Address needs confirmation`}</p><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-grouped p-3"><p className="text-xs text-tertiary">Fulfilment</p><p className="mt-1 font-semibold">{branch.fulfilment?.includes("pickup") ? "Pickup enabled" : "Not configured"}</p></div><div className="rounded-xl bg-grouped p-3"><p className="text-xs text-tertiary">Visibility</p><p className="mt-1 font-semibold">{branch.public ? "Public" : "Hidden"}</p></div></div><Button variant="outline" className="mt-5 w-full" onClick={() => { setEditing(branch); setOpen(true); }}><Settings className="h-4 w-4" />Edit branch</Button></Card>)}</div> : <EmptyState icon={MapPin} title="No branches are configured" description="Branches separate hours, pickup capacity, pricing, inventory, staff, and payment methods." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add first branch</Button>} />}<BranchModal branch={editing} open={open} onClose={() => setOpen(false)} business={business} user={user} /></div>;
}

function StaffView({ business, branches, invitations, user }) {
  const [open, setOpen] = useState(false); const [form, setForm] = useState({ name: "", email: "", role: "staff", branchIds: [] }); const [loading, setLoading] = useState(false); const { toast } = useToast();
  async function invite(event) { event.preventDefault(); setLoading(true); try { await inviteBusinessStaff(form, business, user); toast(`Invitation created for ${form.email}.`, { title: "Staff invited" }); setOpen(false); setForm({ name: "", email: "", role: "staff", branchIds: [] }); } catch (error) { toast(error.message, { type: "error", title: "Could not invite staff" }); } finally { setLoading(false); } }
  return <div className="space-y-6"><PageHeader {...meta.staff} actions={<Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />Invite staff</Button>} /><div className="grid gap-4 sm:grid-cols-3">{[["Owner", "Everything for the organization and its businesses"], ["Manager", "Selected branches, orders, catalog, and staff"], ["Staff", "Operational access selected during invitation"]].map(([role, copy]) => <Card key={role} className="p-5"><UsersRound className="h-5 w-5 text-business" /><h3 className="mt-4 font-bold">{role}</h3><p className="mt-2 text-sm leading-6 text-secondary">{copy}</p></Card>)}</div><SectionCard title="Pending and recent invitations">{invitations.length ? <div>{invitations.map((item) => <div key={item.id} className="flex items-center gap-3 border-b p-4 last:border-0"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-business-soft text-business"><UserPlus className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name || item.email}</p><p className="mt-1 text-xs text-secondary">{item.email} · {item.role}</p></div><StatusBadge status={item.status || "pending"} /></div>)}</div> : <EmptyState icon={UserPlus} title="No staff invitations yet" description="Invite the first team member and restrict their access to the branches and work they need." />}</SectionCard><Modal open={open} onClose={() => setOpen(false)} title="Invite staff"><form onSubmit={invite} className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Email</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="manager">Manager</option><option value="catalog_manager">Catalog manager</option><option value="order_staff">Order staff</option><option value="finance_viewer">Finance viewer</option><option value="staff">Custom staff</option></select></label><div><p className="mb-2 text-sm font-semibold">Branch access</p><div className="space-y-2">{branches.map((branch) => <label key={branch.id} className="flex items-center gap-3 rounded-xl bg-grouped p-3 text-sm font-semibold"><input type="checkbox" checked={form.branchIds.includes(branch.id)} onChange={(event) => setForm({ ...form, branchIds: event.target.checked ? [...form.branchIds, branch.id] : form.branchIds.filter((id) => id !== branch.id) })} />{branch.name}</label>)}</div></div><Button type="submit" loading={loading} className="w-full">Create invitation</Button></form></Modal></div>;
}

function FinanceView({ finance, businessId, user }) {
  const [form, setForm] = useState(finance || { acceptedCurrencies: ["USD", "ZWG"], paymentMethods: ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"], paymentRecipient: "platform", payoutCadence: "weekly", payoutMethod: "bank_transfer", bankName: "", accountName: "", accountNumberMasked: "", mobileMoneyNumber: "", taxNumber: "" });
  const [loading, setLoading] = useState(false); const { toast } = useToast();
  useEffect(() => { if (finance) setForm(finance); }, [finance]);
  async function save(event) { event.preventDefault(); setLoading(true); try { await saveBusinessFinanceSettings(businessId, form, user); toast("Finance preferences saved.", { title: "Finance updated" }); } catch (error) { toast(error.message, { type: "error", title: "Could not save finance settings" }); } finally { setLoading(false); } }
  return <div className="space-y-6"><PageHeader {...meta.finance} /><form onSubmit={save} className="grid gap-5 lg:grid-cols-2"><SectionCard title="Currencies and payment methods" description="Business settings remain subject to platform and provider availability"><div className="space-y-5 p-5"><div><p className="text-sm font-semibold">Accepted currencies</p><div className="mt-3 flex gap-3">{["USD", "ZWG"].map((currency) => <label key={currency} className="flex flex-1 items-center gap-3 rounded-xl bg-grouped p-4 text-sm font-semibold"><input type="checkbox" checked={form.acceptedCurrencies?.includes(currency)} onChange={(event) => setForm({ ...form, acceptedCurrencies: event.target.checked ? [...(form.acceptedCurrencies || []), currency] : (form.acceptedCurrencies || []).filter((item) => item !== currency) })} />{currency}</label>)}</div></div><div><p className="text-sm font-semibold">Payment methods</p><div className="mt-3 grid grid-cols-2 gap-2">{["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"].map((method) => <label key={method} className="flex items-center gap-2 rounded-xl bg-grouped p-3 text-sm font-semibold capitalize"><input type="checkbox" checked={form.paymentMethods?.includes(method)} onChange={(event) => setForm({ ...form, paymentMethods: event.target.checked ? [...(form.paymentMethods || []), method] : (form.paymentMethods || []).filter((item) => item !== method) })} />{method.replaceAll("_", " ")}</label>)}</div></div><label className="block"><span className="mb-2 block text-sm font-semibold">Who receives customer payments?</span><select value={form.paymentRecipient || "platform"} onChange={(event) => setForm({ ...form, paymentRecipient: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="platform">Spotly, followed by settlement</option><option value="business">Business directly</option><option value="hybrid">Depends on payment method</option></select></label></div></SectionCard><SectionCard title="Payout and settlement" description="Secure provider credentials belong in Vercel environment variables, not Firestore"><div className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Payout cadence</span><select value={form.payoutCadence || "weekly"} onChange={(event) => setForm({ ...form, payoutCadence: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="daily">Daily</option><option value="twice_weekly">Twice weekly</option><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="monthly">Monthly</option><option value="manual">Manual approval</option></select></label><label className="block"><span className="mb-2 block text-sm font-semibold">Payout method</span><select value={form.payoutMethod || "bank_transfer"} onChange={(event) => setForm({ ...form, payoutMethod: event.target.value })} className="surface h-12 w-full rounded-xl px-4"><option value="bank_transfer">Bank transfer</option><option value="ecocash">EcoCash</option><option value="onemoney">OneMoney</option><option value="manual">Manual settlement</option></select></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Bank</span><input value={form.bankName || ""} onChange={(event) => setForm({ ...form, bankName: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Account name</span><input value={form.accountName || ""} onChange={(event) => setForm({ ...form, accountName: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label></div><label className="block"><span className="mb-2 block text-sm font-semibold">Masked account reference</span><input value={form.accountNumberMasked || ""} onChange={(event) => setForm({ ...form, accountNumberMasked: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="••••4521" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Tax / fiscal reference</span><input value={form.taxNumber || ""} onChange={(event) => setForm({ ...form, taxNumber: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" placeholder="Ready for later configuration" /></label></div></SectionCard><div className="lg:col-span-2"><Button type="submit" loading={loading}>Save finance preferences</Button></div></form></div>;
}

function SupportView({ conversations, business, user }) {
  const [selected, setSelected] = useState(conversations[0]?.id || ""); const [messages, setMessages] = useState([]); const [reply, setReply] = useState(""); const { toast } = useToast();
  useEffect(() => { if (!selected && conversations[0]) setSelected(conversations[0].id); }, [conversations, selected]);
  useEffect(() => selected ? subscribeSupportMessages(selected, setMessages, () => {}) : undefined, [selected]);
  async function send(event) { event.preventDefault(); if (!reply.trim()) return; const body = reply; setReply(""); try { await sendSupportMessage(selected, body, user, { senderRole: "business" }); } catch (error) { setReply(body); toast(error.message, { type: "error" }); } }
  return <div className="space-y-6"><PageHeader {...meta.support} actions={<Link href="/support"><Button><Plus className="h-4 w-4" />New conversation</Button></Link>} /><Card className="grid min-h-[560px] overflow-hidden lg:grid-cols-[320px_1fr]"><div className="border-r"><div className="border-b p-4"><p className="font-bold">Conversations</p></div>{conversations.length ? conversations.map((item) => <button key={item.id} onClick={() => setSelected(item.id)} className={`w-full border-b p-4 text-left ${selected === item.id ? "bg-business-soft" : "hover:bg-[var(--surface-2)]"}`}><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{item.subject}</p><StatusBadge status={item.status} /></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary">{item.lastMessage}</p></button>) : <div className="p-5 text-sm leading-6 text-secondary">No support conversation is linked to this business yet. Open one with the business name and relevant reference.</div>}</div><div className="flex min-h-0 flex-col">{selected ? <><div className="min-h-0 flex-1 overflow-y-auto bg-grouped p-5"><div className="space-y-3">{messages.filter((item) => !item.internal).map((message) => { const mine = message.senderId === user.uid; return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 ${mine ? "bg-business text-white" : "border bg-white"}`}><p className="text-xs font-semibold opacity-65">{message.senderName}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p></div></div>; })}</div></div><form onSubmit={send} className="flex gap-2 border-t p-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} className="min-h-11 flex-1 rounded-xl bg-grouped p-3 text-sm outline-none" placeholder="Reply with relevant context…" /><Button type="submit">Send</Button></form></> : <EmptyState icon={MessageCircle} title="Select or start a conversation" description="Support messages, assignment, status, and history remain connected to the business." action={<Link href="/support"><Button>Start conversation</Button></Link>} />}</div></Card></div>;
}

function SettingsView({ business, user }) {
  const [form, setForm] = useState(business || {}); const [loading, setLoading] = useState(false); const { toast } = useToast();
  useEffect(() => setForm(business || {}), [business]);
  async function save(event) { event.preventDefault(); setLoading(true); try { await saveBusinessProfile(business.id, form, user); toast("Business profile saved.", { title: "Settings updated" }); } catch (error) { toast(error.message, { type: "error", title: "Could not save profile" }); } finally { setLoading(false); } }
  return <div className="space-y-6"><PageHeader {...meta.settings} /><form onSubmit={save} className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><SectionCard title="Public business profile" description="Every field can be corrected before or after verification"><div className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Business name</span><input value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Description</span><textarea value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} className="surface min-h-32 w-full rounded-xl p-4 outline-none" /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Category</span><input value={form.category || ""} onChange={(event) => setForm({ ...form, category: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">City</span><input value={form.city || ""} onChange={(event) => setForm({ ...form, city: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Phone</span><input value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Email</span><input value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Website</span><input value={form.website || ""} onChange={(event) => setForm({ ...form, website: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label><label><span className="mb-2 block text-sm font-semibold">Instagram</span><input value={form.instagram || ""} onChange={(event) => setForm({ ...form, instagram: event.target.value })} className="surface h-12 w-full rounded-xl px-4 outline-none" /></label></div><Button type="submit" loading={loading}>Save public profile</Button></div></SectionCard><div className="space-y-5"><SectionCard title="Publication"><div className="space-y-4 p-5"><div className="flex items-center justify-between"><span className="text-sm text-secondary">Claim status</span><StatusBadge status={business.claimStatus || "unclaimed"} /></div><div className="flex items-center justify-between"><span className="text-sm text-secondary">Verification</span><StatusBadge status={business.verificationStatus || "unverified"} /></div><div className="flex items-center justify-between"><span className="text-sm text-secondary">Public visibility</span><StatusBadge status={business.public ? "Public" : "Hidden"} /></div><p className="text-xs leading-5 text-tertiary">Administration controls final publication and can request information, merge duplicates, or correct imported sources.</p></div></SectionCard><SectionCard title="Source and ownership"><div className="p-5"><p className="text-sm font-semibold">{business.source?.label || "Owner-created listing"}</p><p className="mt-2 text-xs leading-5 text-secondary">{business.source?.rightsStatus === "provisional_review_required" ? "Provisional public information must be reviewed for accuracy and media rights." : "This listing was created directly by a Spotly user."}</p>{business.source?.url && <a href={business.source.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold text-business">Open recorded source</a>}</div></SectionCard></div></form></div>;
}

function PlaceholderView({ section }) {
  return <div className="space-y-6"><PageHeader {...meta[section]} /><Card className="p-8"><EmptyState icon={section === "insights" ? CalendarClock : BadgeCheck} title={section === "insights" ? "Insights need real activity" : "Promotions are prepared for marketplace activation"} description={section === "insights" ? "Meaningful charts will populate from orders, pickup performance, catalog conversion, cancellations, and customer signals—without inventing metrics." : "The data model and navigation remain ready, but promotion publishing should wait for the customer marketplace and payment rules to be enabled by administration."} /></Card></div>;
}

export function BusinessApp({ section = "dashboard" }) {
  const safe = meta[section] ? section : "dashboard";
  const { user, memberships } = useAuth();
  const data = useBusinessData(user, memberships);
  return <AuthGate portal="business" title="Sign in to Spotly Business"><PortalShell portalId="business" activeSection={safe}><div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{!data.businessId ? <NoBusiness user={user} /> : data.loading ? <Card className="p-10 text-center text-secondary">Loading your business from Firebase…</Card> : !data.business ? <EmptyState icon={Building2} title="Business record unavailable" description="The membership exists, but its business record could not be loaded. Contact Spotly Support with the membership reference." action={<Link href="/support"><Button>Contact support</Button></Link>} /> : <>{safe === "dashboard" && <Dashboard data={data} />}{safe === "activity" && <OrdersView orders={data.orders} user={user} />}{safe === "catalog" && <CatalogView products={data.products} businessId={data.businessId} user={user} />}{safe === "branches" && <BranchesView branches={data.branches} business={data.business} user={user} />}{safe === "staff" && <StaffView business={data.business} branches={data.branches} invitations={data.invitations} user={user} />}{safe === "finance" && <FinanceView finance={data.finance} businessId={data.businessId} user={user} />}{safe === "support" && <SupportView conversations={data.support} business={data.business} user={user} />}{safe === "settings" && <SettingsView business={data.business} user={user} />}{["insights", "promotions"].includes(safe) && <PlaceholderView section={safe} />}</>}</div></PortalShell></AuthGate>;
}
