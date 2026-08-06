"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  CreditCard,
  Heart,
  LoaderCircle,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Store,
  X
} from "lucide-react";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, Card, EmptyState, Modal, SearchField, StatusBadge, Tabs } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import {
  saveFavorite,
  searchBusinesses,
  subscribeBranches,
  subscribeBusinessCatalog,
  subscribeCustomerOrders,
  subscribeFavorites
} from "@/lib/firebase-services";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { businessArchetype } from "@/data/business-archetypes";

const VIEW_VALUES = new Set(["discover", "search", "orders", "saved"]);

function timestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayOptions() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      value: date.toISOString().slice(0, 10),
      label: index === 0 ? "Today" : index === 1 ? "Tomorrow" : date.toLocaleDateString("en-ZW", { weekday: "short", day: "numeric", month: "short" })
    };
  });
}

function slotOptions() {
  const slots = [];
  for (let hour = 8; hour < 18; hour += 1) {
    slots.push(`${String(hour).padStart(2, "0")}:00–${String(hour).padStart(2, "0")}:30`);
    slots.push(`${String(hour).padStart(2, "0")}:30–${String(hour + 1).padStart(2, "0")}:00`);
  }
  return slots;
}

function MarketplaceGate({ privateBeta }) {
  return (
    <main className="min-h-screen bg-[#fffdf9] px-4 py-16 text-[#17171f] sm:px-6">
      <div className="mx-auto max-w-3xl rounded-[20px] border border-violet-100 bg-white p-7 text-center shadow-elevated sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><ShoppingBasket className="h-8 w-8" /></div>
        <Badge tone="purple" className="mt-6">Pickup pilot</Badge>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Customer ordering is opening by invitation.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-600">Businesses and pickup operations are being prepared before ordering opens more widely. {privateBeta ? "This account does not currently have preview access." : "The pilot is currently paused."}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild><Link href="/">Join the launch list</Link></Button>
          <Button asChild variant="outline"><Link href="/claim">Find or add a business</Link></Button>
          <Button asChild variant="ghost"><Link href="/support">Get help</Link></Button>
        </div>
      </div>
    </main>
  );
}

function BusinessVisual({ business }) {
  const image = business.coverImage || business.image;
  if (image) return <Image src={image} alt={business.name} fill unoptimized className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />;
  const letter = (business.name || "B").trim().slice(0, 1).toUpperCase();
  return <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#f3efff,#efe7db)]"><span className="flex h-20 w-20 items-center justify-center rounded-[20px] bg-white text-3xl font-semibold text-violet shadow-card">{letter}</span></div>;
}

function BusinessCard({ business, favorite, onFavorite, onOpen }) {
  const archetype = businessArchetype(business);
  const locationCount = Number(business.branchCount || business.locationCount || 0);
  const verified = business.verificationStatus === "approved" || business.verificationStatus === "verified";
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-violet/25 hover:shadow-elevated">
      <button onClick={() => onOpen(business)} className="block w-full text-left">
        <div className="relative aspect-[16/9] overflow-hidden bg-[#f3f0e9]">
          <BusinessVisual business={business} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2"><Badge className="bg-white/95 text-gray-800 ring-0">{business.category || "Business"}</Badge>{verified && <Badge className="bg-emerald-600 text-white ring-0"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge>}</div>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold">{business.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-gray-500"><MapPin className="h-4 w-4" />{locationCount ? `${locationCount} ${archetype.nouns.branch}${locationCount === 1 ? "" : "s"}` : business.city || "Zimbabwe"}</p></div><ChevronRight className="mt-1 h-5 w-5 text-gray-400" /></div>
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-gray-600">{business.description || "View locations and available products or services."}</p>
        </div>
      </button>
      <div className="flex items-center gap-2 border-t border-gray-100 p-3"><Button onClick={() => onOpen(business)} className="flex-1" size="sm">View locations</Button><Button onClick={() => onFavorite(business.id)} size="icon" variant="outline" aria-label={favorite ? "Remove from saved" : "Save business"}><Heart className={cn("h-5 w-5", favorite && "fill-rose-500 text-rose-500")} /></Button></div>
    </article>
  );
}

function ProductCard({ product, quantity, onChange, currency, archetype }) {
  const price = product.prices?.[currency] ?? product.price ?? 0;
  return (
    <Card className="flex gap-4 p-4">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">{product.image ? <Image src={product.image} alt={product.name} fill unoptimized className="object-cover" sizes="96px" /> : <div className="flex h-full items-center justify-center text-gray-400"><ShoppingBasket className="h-8 w-8" /></div>}</div>
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{product.name}</h3><p className="mt-1 line-clamp-2 text-sm text-secondary">{product.description || product.unit || product.category || `Available ${archetype.capabilities.includes("pickup_orders") ? "for pickup" : "from this business"}`}</p></div><p className="shrink-0 font-semibold">{formatCurrency(price, currency)}</p></div><div className="mt-4 flex justify-end">{quantity ? <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1"><button onClick={() => onChange(product, quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100" aria-label={`Decrease ${product.name}`}><Minus className="h-4 w-4" /></button><span className="w-9 text-center text-sm font-semibold">{quantity}</span><button onClick={() => onChange(product, quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-md bg-violet text-white" aria-label={`Increase ${product.name}`}><Plus className="h-4 w-4" /></button></div> : <Button size="sm" onClick={() => onChange(product, 1)}><Plus className="h-4 w-4" />Add</Button>}</div></div>
    </Card>
  );
}

function OfferingPreviewCard({ product, currency, archetype }) {
  const price = product.prices?.[currency] ?? product.price ?? 0;
  const priceLabel = Number(price) > 0 ? formatCurrency(price, currency) : product.requiresBusinessReview ? "Price being confirmed" : "Ask the business";
  return <Card className="flex gap-4 p-4"><div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">{product.image ? <Image src={product.image} alt={product.name} fill unoptimized className="object-cover" sizes="96px" /> : <div className="flex h-full items-center justify-center text-gray-400"><Store className="h-8 w-8" /></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{product.name}</h3><p className="mt-1 line-clamp-2 text-sm text-secondary">{product.description || product.category || `A published ${archetype.nouns.item} from this business.`}</p></div><p className="shrink-0 text-sm font-semibold">{priceLabel}</p></div><div className="mt-4 flex flex-wrap gap-2">{product.durationMinutes ? <Badge tone="neutral">{product.durationMinutes} minutes</Badge> : null}{product.capacity ? <Badge tone="neutral">Capacity {product.capacity}</Badge> : null}{product.venue ? <Badge tone="neutral">{product.venue}</Badge> : null}<Badge tone={product.active === false ? "neutral" : "green"}>{product.active === false ? "Not available" : "Available"}</Badge></div></div></Card>;
}

function OrderCard({ order, onPay, highlighted = false }) {
  const created = timestamp(order.createdAt);
  const paymentNeeded = ["unpaid", "pending"].includes(order.paymentStatus);
  return (
    <Card className={cn("p-5 transition", highlighted && "border-violet ring-4 ring-violet/10")}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[.08em] text-gray-500">{order.number || order.id}</p><h3 className="mt-2 text-lg font-semibold">{order.businessName || "Spotly order"}</h3><p className="mt-1 text-sm text-secondary">{created ? created.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" }) : "Just now"}</p></div><div className="text-right"><StatusBadge status={order.status || "submitted"} /><p className="mt-3 font-semibold">{formatCurrency(order.totals?.total || 0, order.currency)}</p></div></div>
      <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm"><p className="font-semibold">Pickup: {order.pickup?.date || "To be confirmed"} · {order.pickup?.slot || "Time pending"}</p><p className="mt-1 text-gray-600">{order.branchName || "Pickup location"}</p></div>
      {paymentNeeded && <Button className="mt-4 w-full" onClick={() => onPay(order)}><CreditCard className="h-4 w-4" />Continue payment</Button>}
    </Card>
  );
}

function BasketContents({ cartItems, cartTotal, currency, onCheckout, onClose }) {
  return <div className="p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your basket</h2>{onClose && <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Close basket"><X className="h-5 w-5" /></button>}</div>{cartItems.length ? <><div className="mt-5 space-y-3">{cartItems.map((item) => <div key={item.id} className="flex items-center gap-3 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 font-semibold text-violet-700">{item.quantity}</span><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="font-semibold">{formatCurrency(Number(item.prices?.[currency] ?? item.price ?? 0) * item.quantity, currency)}</span></div>)}</div><div className="my-5 border-t" /><div className="flex items-center justify-between text-lg font-semibold"><span>Subtotal</span><span>{formatCurrency(cartTotal, currency)}</span></div><p className="mt-2 text-xs leading-5 text-gray-500">Availability and any substitutions are confirmed before collection.</p><Button className="mt-5 w-full" onClick={onCheckout}>Choose pickup details</Button></> : <div className="py-10 text-center"><ShoppingBasket className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 text-sm font-semibold">Your basket is empty</p><p className="mt-1 text-xs text-gray-500">Add an available item to continue.</p></div>}</div>;
}

function CheckoutModal({ open, onClose, business, branches, selectedBranchId, cartItems, currency, user, onComplete }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ branchId: "", date: dayOptions()[1].value, slot: "10:00–10:30", paymentMethod: "paynow", contactName: user?.displayName || "", contactPhone: user?.phoneNumber || "", notes: "", substitutionPreference: "contact_me" });
  const steps = ["Basket", "Pickup", "Contact", "Payment", "Review"];

  useEffect(() => {
    if (!open) return;
    const saved = window.localStorage.getItem("spotly-checkout-draft");
    if (saved) { try { setForm((value) => ({ ...value, ...JSON.parse(saved) })); } catch {} }
    if (branches.length) {
      const preferred = branches.some((branch) => branch.id === selectedBranchId) ? selectedBranchId : branches[0].id;
      setForm((value) => ({ ...value, branchId: value.branchId || preferred }));
    }
  }, [open, branches, selectedBranchId]);

  useEffect(() => { if (open) window.localStorage.setItem("spotly-checkout-draft", JSON.stringify(form)); }, [form, open]);

  const total = cartItems.reduce((sum, item) => sum + Number(item.prices?.[currency] ?? item.price ?? 0) * item.quantity, 0);
  const selectedBranch = branches.find((branch) => branch.id === form.branchId);
  const field = (key) => ({ value: form[key], onChange: (event) => setForm({ ...form, [key]: event.target.value }) });

  function canContinue() {
    if (step === 1) return Boolean(form.branchId && form.date && form.slot);
    if (step === 2) return Boolean(form.contactName.trim() && form.contactPhone.trim());
    return true;
  }

  async function submit() {
    if (!user || user.isAnonymous) {
      window.location.assign(`/login?next=${encodeURIComponent("/marketplace")}`);
      return;
    }
    setSubmitting(true);
    try {
      const order = await authenticatedFetch("/api/orders/create", {
        method: "POST",
        body: JSON.stringify({
          businessId: business.id,
          branchId: form.branchId,
          items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })),
          currency,
          paymentMethod: form.paymentMethod,
          pickup: { date: form.date, slot: form.slot, contactName: form.contactName, contactPhone: form.contactPhone, notes: form.notes, substitutionPreference: form.substitutionPreference }
        })
      });
      if (order.paymentRequired) {
        const channel = ["ecocash", "onemoney"].includes(form.paymentMethod) ? form.paymentMethod : "web";
        const payment = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: order.orderId, channel, phone: form.contactPhone }) });
        if (payment.redirectUrl) window.location.assign(payment.redirectUrl);
        else toast(payment.instructions || "Payment request sent to your phone.", { type: "success" });
      } else toast("Order placed. The business will confirm your pickup.", { type: "success" });
      window.localStorage.removeItem("spotly-checkout-draft");
      onComplete(order);
      setStep(0);
      onClose();
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not place order" });
    } finally { setSubmitting(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Complete your pickup order" description={`Step ${step + 1} of ${steps.length}: ${steps[step]}`} size="lg">
      <div className="border-b px-5 py-4"><div className="flex gap-2">{steps.map((label, index) => <div key={label} className="min-w-0 flex-1"><div className={cn("h-1.5 rounded-full", index <= step ? "bg-violet" : "bg-gray-200")} /><p className={cn("mt-2 hidden text-xs sm:block", index === step ? "font-semibold text-violet" : "text-gray-500")}>{label}</p></div>)}</div></div>
      <div className="min-h-[360px] p-5 sm:p-6">
        {step === 0 && <div><div className="rounded-lg bg-violet-50 p-4"><p className="font-semibold">{business?.name}</p><p className="mt-1 text-sm text-violet-700">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} items · {formatCurrency(total, currency)}</p></div><div className="mt-5 divide-y">{cartItems.map((item) => <div key={item.id} className="flex gap-3 py-3 text-sm"><span className="font-semibold">{item.quantity}×</span><span className="flex-1">{item.name}</span><span className="font-semibold">{formatCurrency(Number(item.prices?.[currency] ?? item.price ?? 0) * item.quantity, currency)}</span></div>)}</div></div>}
        {step === 1 && <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Pickup location<select {...field("branchId")} required className="input mt-2 w-full">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName || branch.name || "Main location"} · {branch.city || "Zimbabwe"}</option>)}</select></label><label className="text-sm font-medium">Pickup day<select {...field("date")} className="input mt-2 w-full">{dayOptions().map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label><label className="text-sm font-medium">Pickup time<select {...field("slot")} className="input mt-2 w-full">{slotOptions().map((slot) => <option key={slot}>{slot}</option>)}</select></label><div className="rounded-lg bg-gray-50 p-4 text-sm sm:col-span-2"><p className="font-semibold">{selectedBranch?.branchName || selectedBranch?.name || "Selected pickup location"}</p><p className="mt-1 text-secondary">{[selectedBranch?.address, selectedBranch?.city].filter(Boolean).join(" · ") || "Address will be confirmed with the order."}</p></div></div>}
        {step === 2 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Pickup contact<input {...field("contactName")} required className="input mt-2 w-full" autoComplete="name" /></label><label className="text-sm font-medium">Phone number<input {...field("contactPhone")} required className="input mt-2 w-full" autoComplete="tel" placeholder="0772 000 000" /></label></div><label className="block text-sm font-medium">If something is unavailable<select {...field("substitutionPreference")} className="input mt-2 w-full"><option value="contact_me">Contact me before substituting</option><option value="best_match">Choose the best similar item</option><option value="no_substitutions">Remove unavailable items</option></select></label><label className="block text-sm font-medium">Notes for the business<textarea {...field("notes")} className="input mt-2 min-h-24 w-full resize-y" placeholder="Optional product or pickup notes" /></label></div>}
        {step === 3 && <div><p className="text-sm font-semibold">How would you like to pay?</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["paynow", "Paynow checkout", "Pay online after placing the order"], ["ecocash", "EcoCash", "Receive a Paynow mobile payment request"], ["onemoney", "OneMoney", "Receive a Paynow mobile payment request"], ["cash", "Pay at pickup", "Available only when the business accepts it"]].map(([value, label, copy]) => <button type="button" key={value} onClick={() => setForm({ ...form, paymentMethod: value })} className={cn("rounded-xl border p-4 text-left", form.paymentMethod === value ? "border-violet bg-violet-50 ring-2 ring-violet/10" : "hover:border-violet/40")}><p className="font-semibold">{label}</p><p className="mt-2 text-xs leading-5 text-secondary">{copy}</p></button>)}</div></div>}
        {step === 4 && <div className="space-y-4"><div className="rounded-xl border p-5"><p className="text-xs font-semibold text-tertiary">ORDER</p><p className="mt-2 text-lg font-semibold">{business?.name}</p><p className="mt-1 text-sm text-secondary">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} items · {formatCurrency(total, currency)}</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-semibold text-tertiary">PICKUP</p><p className="mt-2 text-sm font-semibold">{selectedBranch?.branchName || selectedBranch?.name}</p><p className="mt-1 text-sm text-secondary">{form.date} · {form.slot}</p></div><div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-semibold text-tertiary">PAYMENT</p><p className="mt-2 text-sm font-semibold capitalize">{form.paymentMethod.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-secondary">Instructions follow after the order is created.</p></div></div><div className="rounded-lg bg-violet-50 p-4 text-sm leading-6 text-violet-900">The business confirms final availability. Spotly will show the next step if an item needs attention.</div></div>}
      </div>
      <div className="sticky bottom-0 flex gap-3 border-t bg-white p-4 sm:px-6"><Button type="button" variant="outline" className="flex-1" onClick={() => step ? setStep(step - 1) : onClose()}>{step ? "Back" : "Close"}</Button>{step < steps.length - 1 ? <Button type="button" className="flex-1" disabled={!canContinue()} onClick={() => setStep(step + 1)}>Continue</Button> : <Button type="button" className="flex-1" loading={submitting} onClick={submit}><Check className="h-4 w-4" />Place order</Button>}</div>
    </Modal>
  );
}

export function MarketplaceApp() {
  const { user, profile, authReady } = useAuth();
  const { settings, settingsReady } = usePlatform();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderRefs = useRef({});
  const requestedView = searchParams.get("view");
  const requestedOrder = searchParams.get("order");
  const requestedBusiness = searchParams.get("business");
  const [query, setQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [businesses, setBusinesses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [pendingBranchId, setPendingBranchId] = useState("");
  const [cart, setCart] = useState({});
  const [basketOpen, setBasketOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState(VIEW_VALUES.has(requestedView) ? requestedView : requestedOrder ? "orders" : "discover");
  const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reloadKey, setReloadKey] = useState(0);

  const allowed = settings.launch?.marketplaceEnabled || (settings.launch?.privateBetaEnabled && (profile?.privateBeta || profile?.roles?.some((role) => ["super_admin", "admin"].includes(role))));

  function updateUrl(nextView, extras = {}) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    if (extras.order === null) params.delete("order");
    else if (extras.order) params.set("order", extras.order);
    if (extras.business === null) params.delete("business");
    else if (extras.business) params.set("business", extras.business);
    router.push(`/marketplace?${params.toString()}`, { scroll: false });
    setView(nextView);
  }

  useEffect(() => {
    const next = requestedOrder ? "orders" : VIEW_VALUES.has(requestedView) ? requestedView : "discover";
    setView(next);
  }, [requestedView, requestedOrder]);

  useEffect(() => {
    const saved = window.localStorage.getItem("spotly-marketplace-cart");
    if (saved) { try { setCart(JSON.parse(saved)); } catch {} }
  }, []);
  useEffect(() => { window.localStorage.setItem("spotly-marketplace-cart", JSON.stringify(cart)); }, [cart]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    const timer = setTimeout(async () => {
      try {
        const result = await searchBusinesses(query, 80);
        if (active) setBusinesses(result);
      } catch {
        if (active) { setBusinesses([]); setLoadError("We could not load businesses. Check your connection and try again."); }
      } finally { if (active) setLoading(false); }
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, reloadKey]);

  useEffect(() => {
    if (!requestedBusiness || selected || !businesses.length) return;
    const found = businesses.find((business) => business.id === requestedBusiness);
    if (found) setSelected(found);
  }, [requestedBusiness, businesses, selected]);

  useEffect(() => {
    if (!selected?.id) { setProducts([]); setBranches([]); setSelectedBranchId(""); return undefined; }
    const stopProducts = subscribeBusinessCatalog(selected.id, (items) => setProducts(items.filter((item) => item.available !== false && item.status !== "archived")), () => setProducts([]));
    const stopBranches = subscribeBranches(selected.id, (items) => { setBranches(items); setSelectedBranchId((current) => items.some((branch) => branch.id === current) ? current : (items[0]?.id || "")); }, () => setBranches([]));
    return () => { stopProducts(); stopBranches(); };
  }, [selected?.id]);

  useEffect(() => user?.uid && !user.isAnonymous ? subscribeFavorites(user.uid, setFavorites, () => {}) : undefined, [user?.uid, user?.isAnonymous]);
  useEffect(() => user?.uid && !user.isAnonymous ? subscribeCustomerOrders(user.uid, setOrders, () => {}) : undefined, [user?.uid, user?.isAnonymous]);
  useEffect(() => {
    if (!requestedOrder || view !== "orders" || !orders.length) return;
    const timer = setTimeout(() => orderRefs.current[requestedOrder]?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    return () => clearTimeout(timer);
  }, [requestedOrder, view, orders]);

  const selectedArchetype = useMemo(() => businessArchetype(selected || {}), [selected]);
  const selectedIsPickup = selectedArchetype.capabilities.includes("pickup_orders");
  const locationNoun = selectedArchetype.nouns.branch;
  const branchProducts = useMemo(() => products.filter((product) => !product.branchIds?.length || !selectedBranchId || product.branchIds.includes(selectedBranchId)), [products, selectedBranchId]);
  const categories = useMemo(() => [...new Set(branchProducts.map((product) => product.category).filter(Boolean))].sort(), [branchProducts]);
  const visibleProducts = useMemo(() => branchProducts.filter((product) => {
    const matchesCategory = category === "all" || product.category === category;
    const term = productQuery.trim().toLowerCase();
    const matchesSearch = !term || `${product.name} ${product.description || ""} ${product.category || ""}`.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  }), [branchProducts, category, productQuery]);
  const cartItems = useMemo(() => products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })), [cart, products]);
  const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.prices?.[currency] ?? item.price ?? 0) * item.quantity, 0);
  const shownBusinesses = view === "saved" ? businesses.filter((business) => favorites.includes(business.id)) : businesses;

  function changeQuantity(product, quantity) { setCart((current) => ({ ...current, [product.id]: Math.max(0, Math.min(99, quantity)) })); }
  async function toggleFavorite(id) {
    if (!user || user.isAnonymous) return window.location.assign(`/login?next=${encodeURIComponent("/marketplace?view=saved")}`);
    const next = !favorites.includes(id);
    setFavorites((current) => next ? [...current, id] : current.filter((item) => item !== id));
    try { await saveFavorite(user.uid, id, next); } catch (error) { toast(error.message, { type: "error" }); }
  }
  async function payOrder(order) {
    try { const response = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: order.id, channel: "web" }) }); if (response.redirectUrl) window.location.assign(response.redirectUrl); }
    catch (error) { toast(error.message, { type: "error" }); }
  }
  function openBusiness(business) { setSelected(business); setProductQuery(""); setCategory("all"); updateUrl("discover", { business: business.id, order: null }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function closeBusiness() { setSelected(null); updateUrl("discover", { business: null, order: null }); }
  function requestBranchChange(id) { if (id === selectedBranchId) return; if (cartItems.length) setPendingBranchId(id); else setSelectedBranchId(id); }
  function confirmBranchChange() { setCart({}); setSelectedBranchId(pendingBranchId); setPendingBranchId(""); }

  if (!authReady || !settingsReady) return <div className="flex min-h-screen items-center justify-center bg-white"><LoaderCircle className="h-8 w-8 animate-spin text-violet" /></div>;
  if (!allowed) return <MarketplaceGate privateBeta={settings.launch?.privateBetaEnabled} />;

  const tabItems = [{ value: "discover", label: "Discover" }, { value: "search", label: "Search" }, { value: "orders", label: orders.length ? `Orders (${orders.length})` : "Orders" }, { value: "saved", label: "Saved" }];

  return (
    <div className="min-h-screen bg-[#f8f8f5] text-[#17171f]" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}>
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/94 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6"><Link href="/" className="flex items-center gap-3 font-semibold"><Image src="/brand/spotly.svg" alt="" width={40} height={40} className="h-10 w-10" /><span className="text-xl">Spotly</span></Link><div className="hidden flex-1 md:block"><SearchField value={query} onChange={(value) => { setQuery(value); if (view !== "search") updateUrl("search"); }} label="Search businesses" placeholder="Search businesses, products or categories" /></div><select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"><option value="USD">USD</option><option value="ZWG">ZiG</option></select><Button asChild variant="outline" size="sm"><Link href={user && !user.isAnonymous ? "/account" : "/login?next=/marketplace"}>{user && !user.isAnonymous ? profile?.displayName?.split(" ")[0] || "Account" : "Sign in"}</Link></Button></div><div className="border-t border-gray-100 px-4 py-3 md:hidden"><SearchField value={query} onChange={(value) => { setQuery(value); if (view !== "search") updateUrl("search"); }} label="Search businesses" placeholder="Search nearby" /></div></header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-9">
        <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between"><Tabs tabs={tabItems} value={view} onChange={(next) => { setSelected(null); updateUrl(next, { business: null, order: next === "orders" ? requestedOrder : null }); }} label="Marketplace sections" /><div className="flex items-center gap-2 text-sm text-gray-500"><MapPin className="h-4 w-4 text-violet" />Zimbabwe · choose exact location before ordering</div></div>

        {view === "orders" ? (
          <section id="panel-orders" role="tabpanel" aria-labelledby="tab-orders" className="mt-7"><div><p className="text-sm font-semibold text-violet">Your activity</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">Pickup orders</h1></div>{!user || user.isAnonymous ? <EmptyState className="mt-6" icon={PackageCheck} title="Sign in to see your orders" description="Order status, payment recovery and pickup details stay with your account." action={<Button asChild><Link href="/login?next=/marketplace?view=orders">Sign in</Link></Button>} /> : orders.length ? <div className="mt-6 grid gap-4 lg:grid-cols-2">{orders.map((order) => <div key={order.id} ref={(node) => { orderRefs.current[order.id] = node; }}><OrderCard order={order} onPay={payOrder} highlighted={requestedOrder === order.id} /></div>)}</div> : requestedOrder ? <EmptyState className="mt-6" icon={PackageCheck} title="We could not find that order" description="It may belong to another account or no longer be available. Contact support with the link you opened." action={<Button asChild><Link href="/support">Contact support</Link></Button>} /> : <EmptyState className="mt-6" icon={ShoppingBasket} title="No pickup orders yet" description="Browse a business with available products and your first order will appear here." action={<Button onClick={() => updateUrl("discover", { order: null })}>Browse businesses</Button>} />}</section>
        ) : selected ? (
          <section id={`panel-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`} className="mt-6">
            <button onClick={closeBusiness} className="flex items-center gap-2 text-sm font-semibold text-violet"><ArrowLeft className="h-4 w-4" />All businesses</button>
            <div className="mt-5 border-b pb-6"><div className="flex flex-wrap gap-2"><Badge tone="purple">{selected.category || "Business"}</Badge>{["approved", "verified"].includes(selected.verificationStatus) ? <Badge tone="green"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge> : <Badge tone="neutral">Details awaiting confirmation</Badge>}</div><h1 className="mt-4 text-4xl font-semibold tracking-[-.04em]">{selected.name}</h1><p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">{selected.description || "Choose the exact location to see what is available."}</p><div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-gray-600"><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{selected.city || "Zimbabwe"}</span><span className="flex items-center gap-1"><Store className="h-4 w-4" />{branches.length || selected.branchCount || 1} {locationNoun}{(branches.length || selected.branchCount || 1) === 1 ? "" : "s"}</span><Link href={`/claim?business=${selected.id}`} className="font-semibold text-violet hover:underline">Manage or correct this listing</Link></div></div>

            <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_340px]">
              <div>
                {branches.length > 0 && <div className="mb-6 rounded-xl border border-violet-100 bg-white p-5 shadow-card"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><MapPin className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">Choose the exact {locationNoun}</p><p className="mt-1 text-sm leading-6 text-gray-600">Products, prices and pickup details can differ by location.</p><div className="mt-4 flex flex-wrap gap-2">{branches.map((branch) => { const active = branch.id === selectedBranchId; return <button key={branch.id} type="button" onClick={() => requestBranchChange(branch.id)} className={cn("rounded-lg border px-4 py-3 text-left transition", active ? "border-violet bg-violet-50 ring-2 ring-violet-100" : "hover:border-violet/40")}><span className="block text-sm font-semibold">{branch.branchName || branch.name || `Main ${locationNoun}`}</span><span className="mt-1 block text-xs text-gray-500">{branch.city || "Zimbabwe"}{branch.address ? ` · ${branch.address}` : ""}</span></button>; })}</div></div></div></div>}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-violet">{selectedArchetype.shortLabel}</p><h2 className="mt-2 text-2xl font-semibold">{selectedArchetype.nouns.catalog}</h2></div><p className="text-sm text-gray-500">{visibleProducts.length} shown</p></div>
                {branchProducts.length > 0 && <div className="mt-5 space-y-3"><SearchField value={productQuery} onChange={setProductQuery} label={`Search ${selectedArchetype.nouns.catalog}`} placeholder={`Search ${selectedArchetype.nouns.items}`} /><div className="no-scrollbar flex gap-2 overflow-x-auto pb-1"><button onClick={() => setCategory("all")} className={cn("rounded-full border px-3 py-2 text-sm font-semibold", category === "all" ? "border-violet bg-violet-soft text-violet-strong" : "bg-white")}>All</button>{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={cn("rounded-full border px-3 py-2 text-sm font-semibold", category === item ? "border-violet bg-violet-soft text-violet-strong" : "bg-white")}>{item}</button>)}</div></div>}
                {visibleProducts.length ? <div className="mt-5 grid gap-3 xl:grid-cols-2">{visibleProducts.map((product) => selectedIsPickup ? <ProductCard key={product.id} product={product} quantity={cart[product.id] || 0} onChange={changeQuantity} currency={currency} archetype={selectedArchetype} /> : <OfferingPreviewCard key={product.id} product={product} currency={currency} archetype={selectedArchetype} />)}</div> : branchProducts.length ? <EmptyState className="mt-5" icon={Search} title="No matching products" description="Try another search or category." action={<Button variant="outline" onClick={() => { setProductQuery(""); setCategory("all"); }}>Clear filters</Button>} /> : <EmptyState className="mt-5" icon={Store} title={`${selectedArchetype.nouns.catalog} not available yet`} description={`This business has not published available ${selectedArchetype.nouns.items} for this location.`} action={<div className="flex flex-wrap justify-center gap-2"><Button asChild variant="outline"><Link href="/support">Suggest an update</Link></Button><Button onClick={closeBusiness}>Browse similar businesses</Button></div>} />}
              </div>
              {selectedIsPickup ? <aside className="hidden h-fit rounded-xl border border-gray-200 bg-white shadow-card lg:sticky lg:top-24 lg:block"><BasketContents cartItems={cartItems} cartTotal={cartTotal} currency={currency} onCheckout={() => setCheckout(true)} /></aside> : <aside className="h-fit rounded-xl border border-violet-100 bg-violet-50 p-5 lg:sticky lg:top-24"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-violet-700"><ShieldCheck className="h-5 w-5" /></div><h2 className="mt-4 font-semibold">Online actions are opening in stages</h2><p className="mt-2 text-sm leading-6 text-violet-900/75">You can review the published {selectedArchetype.nouns.items} and exact {locationNoun}. Online {selectedArchetype.nouns.activity} will appear when the business is ready.</p><Button asChild variant="outline" className="mt-5 w-full bg-white"><Link href="/support">Ask Spotly Support</Link></Button></aside>}
            </div>
          </section>
        ) : (
          <section id={`panel-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`} className="mt-7">
            <div className="flex flex-col gap-6 rounded-[20px] bg-[#171329] p-6 text-white sm:p-8 lg:flex-row lg:items-center lg:justify-between"><div><Badge className="bg-white/12 text-white ring-white/20">Pickup pilot</Badge><h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Find a nearby business and choose the exact location.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">Search, compare available locations and build a basket without guessing where the order will be collected.</p></div><div className="flex min-w-[220px] flex-col gap-2 rounded-xl bg-white/8 p-4 text-sm"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-violet-300" />Pickup-first launch</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-violet-300" />USD and ZiG display</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-violet-300" />Clear order updates</span></div></div>
            <div className="mt-8 flex items-end justify-between"><div><p className="text-sm font-semibold text-violet">{view === "saved" ? "Your saved businesses" : view === "search" ? "Search results" : "Nearby discovery"}</p><h2 className="mt-2 text-2xl font-semibold">{view === "saved" ? "Businesses you want to revisit" : query ? `Results for “${query}”` : "Businesses preparing for Spotly"}</h2></div><p className="hidden text-sm text-gray-500 sm:block">{shownBusinesses.length} shown</p></div>
            {loading ? <div className="flex justify-center py-20"><LoaderCircle className="h-7 w-7 animate-spin text-violet" /></div> : loadError ? <EmptyState className="mt-5" icon={Search} title="Businesses could not be loaded" description={loadError} action={<Button onClick={() => setReloadKey((value) => value + 1)}>Try again</Button>} /> : shownBusinesses.length ? <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shownBusinesses.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={toggleFavorite} onOpen={openBusiness} />)}</div> : view === "saved" ? <EmptyState className="mt-5" icon={Heart} title="Nothing saved yet" description="Save a business to find it quickly later." action={<Button onClick={() => updateUrl("discover")}>Browse businesses</Button>} /> : <EmptyState className="mt-5" icon={Search} title="No matching business found" description="Try a shorter name, another category or add the business for review." action={<Button asChild><Link href="/claim">Add a missing business</Link></Button>} />}
          </section>
        )}
      </main>

      <footer className="mt-16 border-t border-gray-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p>Spotly pickup pilot · availability varies by location</p><div className="flex gap-4"><Link href="/claim">For businesses</Link><Link href="/support">Help</Link><Link href="/account">Account</Link></div></div></footer>

      {selectedIsPickup && cartItems.length > 0 && <button type="button" onClick={() => setBasketOpen(true)} className="safe-bottom fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-xl bg-violet px-4 py-3 text-left text-white shadow-elevated lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15"><ShoppingBasket className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} items</span><span className="block text-xs text-white/70">View basket</span></span><span className="font-semibold">{formatCurrency(cartTotal, currency)}</span></button>}
      {basketOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close basket" className="absolute inset-0 bg-black/45" onClick={() => setBasketOpen(false)} /><div className="safe-bottom absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-[20px] bg-white"><BasketContents cartItems={cartItems} cartTotal={cartTotal} currency={currency} onClose={() => setBasketOpen(false)} onCheckout={() => { setBasketOpen(false); setCheckout(true); }} /></div></div>}
      <Modal open={Boolean(pendingBranchId)} onClose={() => setPendingBranchId("")} title="Switch pickup location?" description="Products, prices and availability can differ by location." size="sm"><div className="p-5"><p className="text-sm leading-6 text-secondary">Switching will clear the current basket so you can build an accurate order for the new location.</p><div className="mt-5 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setPendingBranchId("")}>Keep this location</Button><Button className="flex-1" onClick={confirmBranchChange}>Switch and clear</Button></div></div></Modal>
      {selectedIsPickup && <CheckoutModal open={checkout} onClose={() => setCheckout(false)} business={selected} branches={branches} selectedBranchId={selectedBranchId} cartItems={cartItems} currency={currency} user={user} onComplete={(order) => { setCart({}); updateUrl("orders", { order: order.orderId || order.id, business: null }); }} />}
    </div>
  );
}
