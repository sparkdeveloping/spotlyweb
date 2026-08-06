"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
  Store
} from "lucide-react";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, Card, EmptyState, Modal, SearchField, StatusBadge } from "@/components/ui";
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
    <main className="min-h-screen bg-[#fafafe] px-4 py-16 text-[#17171f] sm:px-6">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-violet-100 bg-white p-7 text-center shadow-[0_24px_80px_rgba(80,61,170,.12)] sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-700"><ShoppingBasket className="h-8 w-8" /></div>
        <Badge tone="purple" className="mt-6">Private marketplace preview</Badge>
        <h1 className="mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Spotly is preparing Zimbabwe’s easiest pickup experience.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-600">Businesses are being claimed, verified, and prepared before customer ordering opens broadly. {privateBeta ? "Your account does not currently have preview access." : "The private beta is currently paused by an administrator."}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild><Link href="/">Join the launch list</Link></Button>
          <Button asChild variant="outline"><Link href="/claim">List or claim a business</Link></Button>
          <Button asChild variant="ghost"><Link href="/support">Contact support</Link></Button>
        </div>
      </div>
    </main>
  );
}

function BusinessCard({ business, favorite, onFavorite, onOpen }) {
  const image = business.coverImage || business.image || "/brand/spotly.png";
  const archetype = businessArchetype(business);
  const locationCount = Number(business.branchCount || business.locationCount || 0);
  return (
    <motion.article layout whileHover={{ y: -3 }} className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-xl">
      <button onClick={() => onOpen(business)} className="block w-full text-left">
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-violet-100 to-purple-50">
          <Image src={image} alt={business.name} fill unoptimized className={cn("object-cover", image.includes("/brand/") && "object-contain p-10")} sizes="(max-width: 768px) 100vw, 33vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
            <Badge className="bg-white/95 text-gray-800 ring-0">{business.category || "Business"}</Badge>
            {business.verificationStatus === "approved" ? <Badge className="bg-emerald-600 text-white ring-0"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge> : <Badge className="bg-black/60 text-white ring-0">Unclaimed listing</Badge>}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold">{business.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500"><MapPin className="h-4 w-4" />{locationCount ? `${locationCount} ${archetype.nouns.branch}${locationCount === 1 ? "" : "s"}` : "Zimbabwe-wide listing"}</p>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-gray-600">{business.description || "A provisional Spotly listing ready for the business owner to verify and complete."}</p>
        </div>
      </button>
      <div className="flex items-center gap-2 border-t border-gray-100 p-3">
        <Button onClick={() => onOpen(business)} className="flex-1" size="sm">View listing</Button>
        <Button onClick={() => onFavorite(business.id)} size="icon" variant="outline" aria-label={favorite ? "Remove from saved" : "Save business"}><Heart className={cn("h-5 w-5", favorite && "fill-rose-500 text-rose-500")} /></Button>
      </div>
    </motion.article>
  );
}

function ProductCard({ product, quantity, onChange, currency, archetype }) {
  const price = product.prices?.[currency] ?? product.price ?? 0;
  return (
    <Card className="flex gap-4 p-4">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
        {product.image ? <Image src={product.image} alt={product.name} fill unoptimized className="object-cover" sizes="96px" /> : <div className="flex h-full items-center justify-center text-gray-400"><ShoppingBasket className="h-8 w-8" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-semibold">{product.name}</h3><p className="mt-1 line-clamp-2 text-sm text-secondary">{product.description || product.category || `Available ${archetype.capabilities.includes("pickup_orders") ? "for pickup" : "from this business"}`}</p></div>
          <p className="shrink-0 font-bold">{formatCurrency(price, currency)}</p>
        </div>
        <div className="mt-4 flex justify-end">
          {quantity ? (
            <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1">
              <button onClick={() => onChange(product, quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
              <span className="w-9 text-center text-sm font-bold">{quantity}</span>
              <button onClick={() => onChange(product, quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
            </div>
          ) : <Button size="sm" onClick={() => onChange(product, 1)}><Plus className="h-4 w-4" />Add</Button>}
        </div>
      </div>
    </Card>
  );
}

function OfferingPreviewCard({ product, currency, archetype }) {
  const price = product.prices?.[currency] ?? product.price ?? 0;
  const priceLabel = Number(price) > 0 ? formatCurrency(price, currency) : product.requiresBusinessReview ? "Price being confirmed" : "Ask the business";
  return (
    <Card className="flex gap-4 p-4">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
        {product.image ? <Image src={product.image} alt={product.name} fill unoptimized className="object-cover" sizes="96px" /> : <div className="flex h-full items-center justify-center text-gray-400"><Store className="h-8 w-8" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-semibold">{product.name}</h3><p className="mt-1 line-clamp-2 text-sm text-secondary">{product.description || product.category || `A published ${archetype.nouns.item} from this business.`}</p></div>
          <p className="shrink-0 text-sm font-bold">{priceLabel}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {product.durationMinutes ? <Badge tone="neutral">{product.durationMinutes} minutes</Badge> : null}
          {product.capacity ? <Badge tone="neutral">Capacity {product.capacity}</Badge> : null}
          {product.venue ? <Badge tone="neutral">{product.venue}</Badge> : null}
          <Badge tone={product.active === false ? "neutral" : "green"}>{product.active === false ? "Not currently available" : "Published"}</Badge>
        </div>
      </div>
    </Card>
  );
}

function OrderCard({ order, onPay }) {
  const created = timestamp(order.createdAt);
  const paymentNeeded = ["unpaid", "pending"].includes(order.paymentStatus);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-gray-500">{order.number || order.id}</p><h3 className="mt-2 text-lg font-bold">{order.businessName || "Spotly order"}</h3><p className="mt-1 text-sm text-secondary">{created ? created.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" }) : "Just now"}</p></div>
        <div className="text-right"><StatusBadge status={order.status || "submitted"} /><p className="mt-3 font-bold">{formatCurrency(order.totals?.total || 0, order.currency)}</p></div>
      </div>
      <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm"><p className="font-semibold">Pickup: {order.pickup?.date} · {order.pickup?.slot}</p><p className="mt-1 text-gray-600">{order.branchName}</p></div>
      {paymentNeeded && <Button className="mt-4 w-full" onClick={() => onPay(order)}><CreditCard className="h-4 w-4" />Complete payment</Button>}
    </Card>
  );
}

function CheckoutModal({ open, onClose, business, branches, selectedBranchId, cartItems, currency, user, onComplete }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ branchId: "", date: dayOptions()[1].value, slot: "10:00–10:30", paymentMethod: "paynow", contactName: user?.displayName || "", contactPhone: user?.phoneNumber || "", notes: "", substitutionPreference: "contact_me", mobileChannel: "ecocash" });

  useEffect(() => {
    if (!open || !branches.length) return;
    const preferred = branches.some((branch) => branch.id === selectedBranchId) ? selectedBranchId : branches[0].id;
    setForm((value) => value.branchId === preferred ? value : ({ ...value, branchId: preferred }));
  }, [branches, open, selectedBranchId]);

  async function submit(event) {
    event.preventDefault();
    if (!user || user.isAnonymous) {
      window.location.href = `/login?next=${encodeURIComponent("/marketplace")}`;
      return;
    }
    if (!form.branchId) return toast("Choose a pickup branch.", { type: "error", title: "Pickup branch required" });
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
        else toast(payment.instructions || "Payment request sent to your phone.", "success");
      } else {
        toast("Order placed. The business will confirm your pickup.", "success");
      }
      onComplete(order);
      onClose();
    } catch (error) {
      toast(error.message, { type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const field = (key) => ({ value: form[key], onChange: (event) => setForm({ ...form, [key]: event.target.value }) });
  return (
    <Modal open={open} onClose={onClose} title="Confirm grocery pickup" size="lg">
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-2xl bg-violet-50 p-4"><p className="font-semibold">{business?.name}</p><p className="mt-1 text-sm text-violet-700">{cartItems.length} unique items · {cartItems.reduce((sum, item) => sum + item.quantity, 0)} total</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Pickup branch<select {...field("branchId")} required className="input mt-2 w-full">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName || branch.name || "Main location"} · {branch.city}</option>)}</select></label>
          <label className="text-sm font-medium">Pickup day<select {...field("date")} className="input mt-2 w-full">{dayOptions().map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
          <label className="text-sm font-medium">Pickup time<select {...field("slot")} className="input mt-2 w-full">{slotOptions().map((slot) => <option key={slot}>{slot}</option>)}</select></label>
          <label className="text-sm font-medium">Payment<select {...field("paymentMethod")} className="input mt-2 w-full"><option value="paynow">Paynow checkout</option><option value="ecocash">EcoCash through Paynow</option><option value="onemoney">OneMoney through Paynow</option><option value="cash">Cash at pickup</option><option value="bank_transfer">Bank transfer</option></select></label>
          <label className="text-sm font-medium">Pickup contact<input {...field("contactName")} required className="input mt-2 w-full" autoComplete="name" /></label>
          <label className="text-sm font-medium">Phone number<input {...field("contactPhone")} required className="input mt-2 w-full" autoComplete="tel" placeholder="0772 000 000" /></label>
        </div>
        <label className="block text-sm font-medium">Substitutions<select {...field("substitutionPreference")} className="input mt-2 w-full"><option value="contact_me">Contact me before substituting</option><option value="best_match">Choose the best similar item</option><option value="no_substitutions">Remove unavailable items</option></select></label>
        <label className="block text-sm font-medium">Notes for the business<textarea {...field("notes")} className="input mt-2 min-h-24 w-full resize-y" placeholder="Optional pickup or product notes" /></label>
        <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1" onClick={onClose}>Back</Button><Button type="submit" className="flex-1" disabled={submitting}>{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Place order</Button></div>
      </form>
    </Modal>
  );
}

export function MarketplaceApp() {
  const { user, profile, authReady } = useAuth();
  const { settings, settingsReady } = usePlatform();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [cart, setCart] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("discover");
  const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");

  const allowed = settings.launch?.marketplaceEnabled || (settings.launch?.privateBetaEnabled && (profile?.privateBeta || profile?.roles?.some((role) => ["super_admin", "admin"].includes(role))));

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await searchBusinesses(query, 80);
        if (active) setBusinesses(result);
      } catch {
        if (active) setBusinesses([]);
      } finally {
        if (active) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (!selected?.id) { setProducts([]); setBranches([]); setSelectedBranchId(""); return undefined; }
    const stopProducts = subscribeBusinessCatalog(selected.id, (items) => setProducts(items.filter((item) => item.available !== false && item.status !== "archived")), () => setProducts([]));
    const stopBranches = subscribeBranches(selected.id, (items) => {
      setBranches(items);
      setSelectedBranchId((current) => items.some((branch) => branch.id === current) ? current : (items[0]?.id || ""));
    }, () => setBranches([]));
    return () => { stopProducts(); stopBranches(); };
  }, [selected?.id]);

  useEffect(() => user?.uid && !user.isAnonymous ? subscribeFavorites(user.uid, setFavorites, () => {}) : undefined, [user?.uid, user?.isAnonymous]);
  useEffect(() => user?.uid && !user.isAnonymous ? subscribeCustomerOrders(user.uid, setOrders, () => {}) : undefined, [user?.uid, user?.isAnonymous]);

  const selectedArchetype = useMemo(() => businessArchetype(selected || {}), [selected]);
  const selectedIsPickup = selectedArchetype.capabilities.includes("pickup_orders");
  const locationNoun = selectedArchetype.nouns.branch;
  const visibleProducts = useMemo(() => products.filter((product) => !product.branchIds?.length || !selectedBranchId || product.branchIds.includes(selectedBranchId)), [products, selectedBranchId]);
  const cartItems = useMemo(() => visibleProducts.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })), [cart, visibleProducts]);
  const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.prices?.[currency] ?? item.price ?? 0) * item.quantity, 0);

  function changeQuantity(product, quantity) {
    setCart((current) => ({ ...current, [product.id]: Math.max(0, Math.min(99, quantity)) }));
  }

  async function toggleFavorite(id) {
    if (!user || user.isAnonymous) return window.location.assign(`/login?next=${encodeURIComponent("/marketplace")}`);
    const next = !favorites.includes(id);
    setFavorites((current) => next ? [...current, id] : current.filter((item) => item !== id));
    try { await saveFavorite(user.uid, id, next); } catch (error) { toast(error.message, { type: "error" }); }
  }

  async function payOrder(order) {
    try {
      const response = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: order.id, channel: "web" }) });
      if (response.redirectUrl) window.location.assign(response.redirectUrl);
    } catch (error) { toast(error.message, { type: "error" }); }
  }

  if (!authReady || !settingsReady) return <div className="flex min-h-screen items-center justify-center bg-white"><LoaderCircle className="h-8 w-8 animate-spin text-violet-600" /></div>;
  if (!allowed) return <MarketplaceGate privateBeta={settings.launch?.privateBetaEnabled} />;

  return (
    <div className="min-h-screen bg-[#f8f8fc] text-[#17171f]">
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 font-bold"><Image src="/brand/spotly.png" alt="Spotly" width={40} height={40} className="h-10 w-10 rounded-xl" /><span className="text-xl">Spotly</span></Link>
          <div className="hidden flex-1 md:block"><SearchField value={query} onChange={setQuery} placeholder="Search businesses, services, events, and products" /></div>
          <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"><option value="USD">USD</option><option value="ZWG">ZiG</option></select>
          <Link href={user && !user.isAnonymous ? "/account" : "/login?next=/marketplace"} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold">{user && !user.isAnonymous ? profile?.displayName || user.email : "Sign in"}</Link>
        </div>
        <div className="border-t border-gray-100 px-4 py-3 md:hidden"><SearchField value={query} onChange={setQuery} placeholder="Search Zimbabwe" /></div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-2xl bg-white p-1 shadow-sm ring-1 ring-gray-200">{[["discover", "Discover"], ["orders", `Orders${orders.length ? ` (${orders.length})` : ""}`]].map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={cn("rounded-xl px-4 py-2 text-sm font-semibold", tab === id ? "bg-violet-600 text-white" : "text-gray-600")}>{label}</button>)}</div>
          <div className="flex items-center gap-2 text-sm text-gray-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />Verified businesses are marked clearly</div>
        </div>

        {tab === "orders" ? (
          <section className="mt-7">
            <h1 className="text-3xl font-bold tracking-[-.04em]">Your pickup orders</h1>
            {!user || user.isAnonymous ? <EmptyState className="mt-6" icon={PackageCheck} title="Sign in to see your orders" description="Spotly keeps order status, payment recovery, and pickup details with your shared account." action={<Button asChild><Link href="/login?next=/marketplace">Sign in</Link></Button>} /> : orders.length ? <div className="mt-6 grid gap-4 lg:grid-cols-2">{orders.map((order) => <OrderCard key={order.id} order={order} onPay={payOrder} />)}</div> : <EmptyState className="mt-6" icon={ShoppingBasket} title="No pickup orders yet" description="Browse a business with a published catalogue and your first order will appear here." action={<Button onClick={() => setTab("discover")}>Browse businesses</Button>} />}
          </section>
        ) : selected ? (
          <section>
            <button onClick={() => { setSelected(null); setCart({}); }} className="flex items-center gap-2 text-sm font-semibold text-violet-700"><ArrowLeft className="h-4 w-4" />All businesses</button>
            <div className="mt-5 overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
              <div className="grid gap-0 lg:grid-cols-[1fr_.42fr]">
                <div className="p-6 sm:p-8"><div className="flex flex-wrap gap-2"><Badge tone="purple">{selected.category}</Badge>{selected.verificationStatus === "approved" ? <Badge tone="green"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge> : <Badge tone="neutral">Provisional · unclaimed</Badge>}</div><h1 className="mt-4 text-4xl font-bold tracking-[-.045em]">{selected.name}</h1><p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">{selected.description || "This public listing was prepared to make business onboarding easier. The owner can claim it, verify details, and publish products without starting from an empty form."}</p><div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-600"><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />Zimbabwe</span><span className="flex items-center gap-1"><Store className="h-4 w-4" />{branches.length || selected.branchCount || 1} {locationNoun}{(branches.length || selected.branchCount || 1) === 1 ? "" : "s"}</span></div></div>
                <div className="flex flex-col justify-center border-t bg-violet-50 p-6 lg:border-l lg:border-t-0"><p className="text-sm font-semibold text-violet-900">Own or manage this business?</p><p className="mt-2 text-sm leading-6 text-violet-800">Claim the pre-filled listing, confirm each exact location, and complete verification.</p><Button asChild className="mt-4"><Link href={`/claim?business=${selected.id}`}>Claim this business</Link></Button></div>
              </div>
            </div>

            <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_340px]">
              <div>{branches.length > 0 && <div className="mb-6 rounded-[24px] border border-violet-100 bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><MapPin className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold">Choose the exact {locationNoun}</p><p className="mt-1 text-sm leading-6 text-gray-600">You are viewing the <strong>{selected.name}</strong> brand. Availability, contact details, and customer options can differ by {locationNoun}.</p><div className="mt-4 flex flex-wrap gap-2">{branches.map((branch) => { const active = branch.id === selectedBranchId; return <button key={branch.id} type="button" onClick={() => { setSelectedBranchId(branch.id); setCart({}); }} className={cn("rounded-2xl border px-4 py-3 text-left transition", active ? "border-violet-600 bg-violet-50 ring-2 ring-violet-100" : "hover:border-violet-300")}><span className="block text-sm font-bold">{branch.branchName || branch.name || `Main ${locationNoun}`}</span><span className="mt-1 block text-xs text-gray-500">{branch.city || "Zimbabwe"}{branch.address ? ` · ${branch.address}` : ""}</span></button>; })}</div></div></div></div>}<div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-600">{selectedArchetype.shortLabel}</p><h2 className="mt-2 text-2xl font-bold">{selectedArchetype.nouns.catalog}</h2></div><p className="text-sm text-gray-500">{visibleProducts.length} {selectedArchetype.nouns.items}</p></div>{visibleProducts.length ? <div className="mt-5 grid gap-3 xl:grid-cols-2">{visibleProducts.map((product) => selectedIsPickup ? <ProductCard key={product.id} product={product} quantity={cart[product.id] || 0} onChange={changeQuantity} currency={currency} archetype={selectedArchetype} /> : <OfferingPreviewCard key={product.id} product={product} currency={currency} archetype={selectedArchetype} />)}</div> : <EmptyState className="mt-5" icon={Store} title={`${selectedArchetype.nouns.catalog} not published yet`} description={`This business is visible, but it has not published verified ${selectedArchetype.nouns.items}. Claiming and onboarding preserve the public details while the owner completes this section.`} action={<Button asChild variant="outline"><Link href={`/claim?business=${selected.id}`}>Help complete this listing</Link></Button>} />}</div>
              {selectedIsPickup ? <aside className="h-fit rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24"><div className="flex items-center justify-between"><h2 className="font-bold">Your basket</h2><ShoppingBasket className="h-5 w-5 text-violet-600" /></div>{cartItems.length ? <><div className="mt-4 space-y-3">{cartItems.map((item) => <div key={item.id} className="flex items-center gap-3 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 font-bold text-violet-700">{item.quantity}</span><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="font-semibold">{formatCurrency(Number(item.prices?.[currency] ?? item.price ?? 0) * item.quantity, currency)}</span></div>)}</div><div className="my-5 border-t border-gray-200" /><div className="flex items-center justify-between text-lg font-bold"><span>Subtotal</span><span>{formatCurrency(cartTotal, currency)}</span></div><p className="mt-2 text-xs leading-5 text-gray-500">Final availability and substitutions are confirmed by the business. Any configured service fee is calculated securely at checkout.</p><Button className="mt-5 w-full" onClick={() => setCheckout(true)}>Choose pickup time</Button></> : <div className="py-8 text-center"><ShoppingBasket className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 text-sm font-semibold">Your basket is empty</p><p className="mt-1 text-xs leading-5 text-gray-500">Add published products to continue.</p></div>}</aside> : <aside className="h-fit rounded-[24px] border border-violet-100 bg-violet-50 p-5 lg:sticky lg:top-24"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-700"><ShieldCheck className="h-5 w-5" /></div><h2 className="mt-4 font-bold">Customer actions are opening in stages</h2><p className="mt-2 text-sm leading-6 text-violet-900/75">You can review the published {selectedArchetype.nouns.items} and exact {locationNoun} now. Online {selectedArchetype.nouns.activity} will appear only after the business and Spotly complete the required checks.</p><Button asChild variant="outline" className="mt-5 w-full bg-white"><Link href="/support">Ask Spotly Support</Link></Button></aside>}
            </div>
          </section>
        ) : (
          <section>
            <div className="mt-2 rounded-[30px] bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-7 text-white shadow-2xl sm:p-10"><Badge className="bg-white/15 text-white ring-white/20">Private beta</Badge><h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-[-.05em] sm:text-6xl">Groceries ready when you are.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-white/80">Find a Zimbabwean business, choose a branch, build a basket, select a pickup slot, and follow every update from one shared Spotly account.</p><div className="mt-7 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-white/12 px-4 py-2">Pickup-first launch</span><span className="rounded-full bg-white/12 px-4 py-2">USD + ZiG</span><span className="rounded-full bg-white/12 px-4 py-2">Paynow + pay at pickup</span></div></div>
            <div className="mt-9 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-600">Zimbabwe directory</p><h2 className="mt-2 text-2xl font-bold">Businesses being prepared for Spotly</h2></div><p className="hidden text-sm text-gray-500 sm:block">{businesses.length} shown</p></div>
            {loading ? <div className="flex justify-center py-20"><LoaderCircle className="h-7 w-7 animate-spin text-violet-600" /></div> : businesses.length ? <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{businesses.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={toggleFavorite} onOpen={setSelected} />)}</div> : <EmptyState className="mt-5" icon={Search} title="No matching business found" description="Try a shorter name, another city, or add the business so our team can review it." action={<Button asChild><Link href="/claim">Add a missing business</Link></Button>} />}
          </section>
        )}
      </main>

      <footer className="mt-16 border-t border-gray-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p>Spotly marketplace private preview · Africa/Harare</p><div className="flex gap-4"><Link href="/claim">List a business</Link><Link href="/support">Support</Link><Link href="/devstatus">Development status</Link></div></div></footer>

      {selectedIsPickup && <CheckoutModal open={checkout} onClose={() => setCheckout(false)} business={selected} branches={branches} selectedBranchId={selectedBranchId} cartItems={cartItems} currency={currency} user={user} onComplete={() => setCart({})} />}
    </div>
  );
}
