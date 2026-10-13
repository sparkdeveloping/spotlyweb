"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, BadgeCheck, BadgePercent, ChevronRight, CreditCard, Heart, LoaderCircle, LocateFixed, MapPin, Minus, PackageCheck, Plus, RefreshCw, Search, ShieldCheck, ShoppingBasket, Star, Store, Truck, X } from "lucide-react";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, Card, EmptyState, Modal, Overlay, SearchField, StatusBadge } from "@/components/ui";
import { authenticatedFetch, publicApiFetch } from "@/lib/api-client";
import { deleteSavedItem, loadPublicMarketplaceBusiness, saveFavorite, saveSavedItem, searchLiveBusinesses, searchSpotly, subscribeCustomerOrders, subscribeFavorites, subscribeSavedItems, track } from "@/lib/firebase-services";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { businessArchetype } from "@/data/business-archetypes";
import { migrateLegacyState, readState, removeState, writeState } from "@/lib/browser-state";
import { branchAcceptedCurrencies, branchPaymentMethods, pickupAvailability } from "@/lib/pickup-availability";
import { NotificationBell } from "@/components/notification-center";
import { LottieEmptyState, SpotlyLottie } from "@/components/spotly-lottie";
import { resolveProductForBranch } from "@/lib/product-offers";
import { MARKETPLACE_SERVICE_KEYS, MarketplaceHome, ServiceModeHeader, serviceMatchesBusiness } from "@/components/marketplace-home";
import { CustomerTransactionModal, OfferDetailModal, TransactionSummary } from "@/components/customer-conversion";
import { CustomerSavedView, CustomerSearchView } from "@/components/customer-utility";
import { ServiceDiscoveryView } from "@/components/service-experience";

const CART_KEY = "spotly-marketplace-cart";
const CHECKOUT_KEY = "spotly-checkout-draft";
const LOCATION_KEY = "spotly-marketplace-location";
const RECENT_SEARCH_KEY = "spotly-recent-searches";
const RECENT_BUSINESS_KEY = "spotly-recent-businesses";
const MARKETPLACE_TABS_ID = "marketplace-sections";
const SERVICE_PATHS = new Set(["/ride", "/eat", "/shop", "/book", "/events", "/send"]);

function timestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function priceFor(product, currency) {
  const value = product?.prices?.[currency] ?? (product?.currency === currency || !product?.currency ? product?.price : undefined);
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function distanceKm(from, to) {
  if (![from?.lat, from?.lng, to?.lat, to?.lng].every(Number.isFinite)) return null;
  const radius = 6371;
  const radians = (value) => value * Math.PI / 180;
  const deltaLat = radians(to.lat - from.lat);
  const deltaLng = radians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MarketplaceGate({ privateBeta }) {
  return <main className="min-h-screen bg-[var(--background)] px-4 py-16 text-[var(--text)] sm:px-6"><div className="mx-auto max-w-3xl rounded-[20px] border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[var(--surface)] p-7 text-center sm:p-12"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[26px] bg-[var(--accent-soft)]"><SpotlyLottie name="marketplace-discover" mode="loop" eager className="h-20 w-20" fallback={<ShoppingBasket className="h-8 w-8 text-[var(--on-accent-soft)]" />} /></div><Badge tone="purple" className="mt-6">Controlled rollout</Badge><h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Customer ordering is opening by area.</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--text-2)]">Verified businesses and locations become available when their pickup or delivery operations are ready. {privateBeta ? "This account does not currently have preview access." : "Ordering is currently paused in this area."}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/">Join the launch list</Link></Button><Button asChild variant="outline"><Link href="/claim">Find or add a business</Link></Button><Button asChild variant="ghost"><Link href="/support">Get help</Link></Button></div></div></main>;
}

function LocationControl({ value, cities, supportedAreas, onChange, onLocate, locating }) {
  const areas = supportedAreas?.[value.city] || [];
  return <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"><label><span className="sr-only">City</span><select className="field-control h-12 w-full" value={value.city} onChange={(event) => onChange({ ...value, city: event.target.value, area: "", coordinates: null })}>{cities.map((city) => <option key={city}>{city}</option>)}</select></label><label><span className="sr-only">Area or suburb</span>{areas.length ? <select className="field-control h-12 w-full" value={value.area} onChange={(event) => onChange({ ...value, area: event.target.value })}><option value="">All areas in {value.city}</option>{areas.map((area) => <option key={area}>{area}</option>)}</select> : <input className="field-control h-12 w-full" value={value.area} onChange={(event) => onChange({ ...value, area: event.target.value })} placeholder={`Area or suburb in ${value.city}`} />}</label><Button variant="outline" onClick={onLocate} loading={locating}><LocateFixed className="h-4 w-4" />Use my location</Button></div>;
}

function BusinessVisual({ business }) {
  const image = business.coverImage || business.image || business.logoUrl;
  if (image) return <Image src={image} alt="" fill  className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />;
  return <div className="flex h-full items-center justify-center bg-[var(--surface-2)]"><span className="flex h-16 w-16 items-center justify-center rounded-xl border bg-[var(--surface)] text-2xl font-semibold text-violet">{(business.name || "B").slice(0, 1).toUpperCase()}</span></div>;
}

function BusinessCard({ business, favorite, onFavorite, onOpen, distance }) {
  const archetype = businessArchetype(business);
  const locationCount = Number(business.branchCount || business.locationCount || 0);
  const verified = ["approved", "verified"].includes(business.verificationStatus);
  const canOrder = archetype.capabilities.includes("pickup_orders");
  const cta = archetype.id === "restaurant_food" ? "View menu" : archetype.id === "grocery_retail" ? "Shop this business" : archetype.id === "ticketing_events" ? "View events" : archetype.id === "appointments_services" ? "View services" : archetype.id === "accommodation_activities" ? "View listings" : "View details";
  const capabilityLabel = canOrder ? "Online ordering" : archetype.id === "ticketing_events" ? "Events" : archetype.id === "appointments_services" ? "Services" : archetype.id === "accommodation_activities" ? "Bookings profile" : "Business profile";

  return <article className="overflow-hidden rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] hover:shadow-card"><button onClick={() => onOpen(business)} className="block w-full text-left"><div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-2)]"><BusinessVisual business={business} /><div className="absolute inset-0 bg-gradient-to-t from-black/38 via-transparent to-transparent" /><div className="absolute bottom-3 left-3 flex flex-wrap gap-2"><Badge className="bg-[var(--surface)]/95 text-[var(--text)] ring-0">{business.category || archetype.shortLabel}</Badge>{verified && <Badge className="bg-[var(--success)] text-[var(--on-success)] ring-0"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge>}</div></div><div className="p-5"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold tracking-[-.025em]">{business.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-[var(--text-3)]"><MapPin className="h-4 w-4" />{distance !== null ? `${distance.toFixed(1)} km away` : locationCount ? `${locationCount} ${archetype.nouns.branch}${locationCount === 1 ? "" : "s"}` : business.area || business.city || "Location not provided"}</p></div><ChevronRight className="mt-1 h-5 w-5 text-[var(--text-3)]" /></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--text-2)]">{business.description || `View ${archetype.nouns.catalog.toLowerCase()}, locations and currently published information.`}</p><div className="mt-4 flex flex-wrap gap-2"><Badge tone="neutral">{capabilityLabel}</Badge>{locationCount > 0 && <Badge tone="neutral"><MapPin className="mr-1 h-3.5 w-3.5" />{locationCount} {locationCount === 1 ? "location" : "locations"}</Badge>}{canOrder && <Badge tone="neutral"><Truck className="mr-1 h-3.5 w-3.5" />Pickup / delivery by location</Badge>}</div></div></button><div className="flex items-center gap-2 border-t border-[var(--border-subtle)] p-3"><Button onClick={() => onOpen(business)} className="flex-1" size="sm">{cta}</Button><Button onClick={() => onFavorite(business.id)} size="icon" variant="outline" aria-label={favorite ? "Remove from saved" : "Save business"}><Heart className={cn("h-5 w-5", favorite && "fill-[var(--danger)] text-[var(--danger)]")} /></Button></div></article>;
}

function ProductCard({ product, quantity, onChange, onOpen, currency, archetype }) {
  const reduce = useReducedMotion();
  const price = priceFor(product, currency);
  const unavailable = product.available === false || product.active === false || product.stockStatus === "out_of_stock";
  const pickup = archetype.capabilities.includes("pickup_orders");
  const actionLabel = archetype.id === "ticketing_events" ? "View tickets" : archetype.id === "appointments_services" ? "View service" : archetype.id === "accommodation_activities" ? "View booking" : "View details";

  return <motion.div layout whileHover={reduce ? undefined : { y: -3 }} transition={{ duration: .18 }}>
    <Card className="overflow-hidden p-0" variant="bordered">
      <button type="button" onClick={() => onOpen(product)} className="flex w-full gap-4 p-4 text-left">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[14px] bg-[var(--surface-2)]">
          {product.image ? <Image src={product.image} alt="" fill  className="object-cover" sizes="96px" /> : <div className="flex h-full items-center justify-center text-[var(--text-3)]"><ShoppingBasket className="h-8 w-8" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="truncate font-semibold">{product.name}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-secondary">{[product.unit, product.packSize, product.description || product.category || `Available from this business`].filter(Boolean).join(" · ")}</p></div>
            <p className={cn("shrink-0 font-semibold", price === null && "text-warning")}>{price === null ? `No ${currency} price` : price === 0 ? "Free" : formatCurrency(price, currency)}</p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            {unavailable ? <Badge tone="neutral">Unavailable</Badge> : product.stockQuantity > 0 && pickup ? <span className="text-xs text-secondary">{product.stockQuantity} available</span> : product.durationMinutes > 0 ? <span className="text-xs text-secondary">{product.durationMinutes} min</span> : product.startsAt ? <span className="text-xs text-secondary">Scheduled</span> : <span />}
            {!pickup ? <span className="text-xs font-semibold text-[var(--accent)]">{actionLabel} →</span> : null}
          </div>
        </div>
      </button>
      {pickup ? <div className="flex items-center justify-end border-t border-[var(--border-subtle)] px-4 py-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {quantity ? <motion.div key="quantity" initial={reduce ? false : { opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0, scale: .94 }} className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            <motion.button whileTap={reduce ? undefined : { scale: .9 }} onClick={() => onChange(product, quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]" aria-label={`Decrease ${product.name}`}><Minus className="h-4 w-4" /></motion.button>
            <motion.span key={quantity} initial={reduce ? false : { y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-9 text-center text-sm font-semibold">{quantity}</motion.span>
            <motion.button whileTap={reduce ? undefined : { scale: .9 }} disabled={price === null || unavailable || (product.maxQuantity && quantity >= product.maxQuantity)} onClick={() => onChange(product, quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet text-[var(--on-accent)] disabled:opacity-40" aria-label={`Increase ${product.name}`}><Plus className="h-4 w-4" /></motion.button>
          </motion.div> : <motion.div key="add" initial={reduce ? false : { opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0, scale: .94 }}><Button size="sm" disabled={price === null || unavailable} onClick={() => onChange(product, 1)}>{price !== null ? <SpotlyLottie name="basket-add" mode="hover" className="h-5 w-5" fallback={<Plus className="h-4 w-4" />} /> : <Plus className="h-4 w-4" />}{price !== null ? "Add to basket" : "Price unavailable"}</Button></motion.div>}
        </AnimatePresence>
      </div> : null}
    </Card>
  </motion.div>;
}

function customerPaymentNeeded(order = {}) {
  if (order.transactionType === "ride" && order.status !== "completed") return false;
  return ["unpaid", "pending", "initiated"].includes(order.paymentStatus) && Number(order.totals?.total || order.total || 0) > 0;
}

function customerActivityCancellable(order = {}) {
  if (order.transactionType === "ride") return false;
  return ["awaiting_payment", "submitted", "new", "requested", "confirmed", "accepted"].includes(order.status) && !["paid", "refund_pending", "refunded"].includes(order.paymentStatus);
}

function customerReviewEligible(order = {}) {
  if (order.transactionType === "ride") return order.status === "completed" && Boolean(order.rideTripId);
  const status = String(order.status || "").toLowerCase();
  const delivery = String(order.deliveryStatus || "").toLowerCase();
  return ["completed", "delivered", "checked_out"].includes(status) || delivery === "delivered";
}

function customerActivityRecoverable(order = {}) {
  const status = String(order.status || "").toLowerCase();
  const payment = String(order.paymentStatus || "").toLowerCase();
  return ["payment_failed", "expired"].includes(status) || ["failed", "expired", "cancelled"].includes(payment);
}

function activityKind(order = {}) {
  return order.transactionType || (order.fulfilment === "appointment" ? "appointment" : order.fulfilment === "booking" ? "booking" : order.fulfilment === "ticketing" ? "ticket" : order.fulfilment === "delivery" ? "delivery" : "order");
}

function activityScheduleDate(order = {}) {
  const raw = order.scheduledPickupAt || order.appointment?.date || order.booking?.startDate || order.event?.startsAt || order.event?.date || order.pickup?.date || null;
  if (!raw) return null;
  const parsed = new Date(String(raw).length === 10 ? `${raw}T12:00:00` : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function activityBucket(order = {}) {
  const status = String(order.status || "").toLowerCase();
  const payment = String(order.paymentStatus || "").toLowerCase();
  const delivery = String(order.deliveryStatus || "").toLowerCase();
  const ride = String(order.rideStatus || "").toLowerCase();
  if (["failed", "payment_failed", "disputed"].includes(status) || ["failed", "chargeback"].includes(payment) || ["failed", "returned"].includes(delivery) || ride === "failed") return "problem";
  if (["completed", "delivered", "cancelled", "canceled", "refunded", "rejected", "expired"].includes(status) || delivery === "delivered" || ["completed", "cancelled", "failed"].includes(ride) || ["refunded"].includes(payment)) return "past";
  const schedule = activityScheduleDate(order);
  if (schedule && schedule.getTime() > Date.now() + 30 * 60 * 1000 && ["appointment", "booking", "ticket", "send"].includes(activityKind(order))) return "upcoming";
  if (["submitted", "new", "requested", "confirmed", "accepted", "preparing", "ready", "awaiting_payment", "processing", "in_progress"].includes(status) || ["awaiting_dispatch", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification", "collected", "en_route", "driver_arrived_customer", "handoff_verification"].includes(delivery) || ["requested", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification", "in_trip", "driver_arrived_dropoff"].includes(ride)) return "active";
  return schedule && schedule.getTime() > Date.now() ? "upcoming" : "active";
}

function deliveryStateLabel(state) {
  return { awaiting_dispatch: "Business is preparing", searching_driver: "Finding your Driver", driver_assigned: "Driver assigned", driver_to_pickup: "Driver is going to the shop", driver_arrived_pickup: "Driver is at the shop", pickup_verification: "Pickup is being verified", collected: "Driver has your order", en_route: "Driver is on the way", driver_arrived_customer: "Driver has arrived", handoff_verification: "Confirming delivery", delivered: "Delivered" }[state] || String(state || "Business is preparing").replaceAll("_", " ");
}

function OrderCard({ order, onPay, onCancel, onOpen, highlighted = false, innerRef }) {
  const created = timestamp(order.createdAt);
  const paymentNeeded = customerPaymentNeeded(order);
  const cancellable = customerActivityCancellable(order);
  const [delivery, setDelivery] = useState(null);
  useEffect(() => {
    let active = true;
    if (order.fulfilment !== "delivery" || !order.id) { setDelivery(null); return undefined; }
    authenticatedFetch(`/api/orders/delivery-status?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" }).then((value) => { if (active) setDelivery(value.delivery || null); }).catch(() => {});
    const timer = setInterval(() => authenticatedFetch(`/api/orders/delivery-status?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" }).then((value) => { if (active) setDelivery(value.delivery || null); }).catch(() => {}), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [order.id, order.fulfilment]);
  const deliveryLabel = deliveryStateLabel(delivery?.state || order.deliveryStatus);
  const transactionKind = order.transactionType || (order.fulfilment === "appointment" ? "appointment" : order.fulfilment === "booking" ? "booking" : order.fulfilment === "ticketing" ? "ticket" : null);

  return <div ref={innerRef}>
    <Card className={cn("p-5 transition", highlighted && "border-violet ring-4 ring-violet/10")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold tracking-[.08em] text-[var(--text-3)]">{order.number || order.id}</p><h3 className="mt-2 text-lg font-semibold">{order.businessName || "Spotly activity"}</h3><p className="mt-1 text-sm text-secondary">{created ? created.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" }) : "Just now"}</p></div>
        <div className="text-right"><StatusBadge status={order.status || "submitted"} /><p className="mt-3 font-semibold">{Number(order.totals?.total || order.total || 0) > 0 ? formatCurrency(order.totals?.total || order.total || 0, order.currency) : transactionKind ? "" : formatCurrency(0, order.currency)}</p></div>
      </div>
      {transactionKind ? <TransactionSummary order={order} /> : order.fulfilment === "delivery" ? <div className="mt-4 rounded-lg bg-[var(--surface-2)] p-4 text-sm"><div className="flex items-center justify-between gap-3"><p className="font-semibold capitalize">{deliveryLabel}</p>{delivery?.number && <Badge tone="info">{delivery.number}</Badge>}</div><p className="mt-1 text-[var(--text-2)]">{order.delivery?.suburb || order.delivery?.address || "Delivery address"}</p>{delivery?.customerPin && !["delivered","cancelled","failed","returned"].includes(delivery.state) && <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"><p className="text-xs font-semibold text-tertiary">YOUR DELIVERY PIN</p><p className="mt-1 font-mono text-2xl font-semibold tracking-[.18em]">{delivery.customerPin}</p><p className="mt-1 text-xs text-secondary">Only tell the Driver this PIN when they are with you and ready to hand over the order.</p></div>}</div> : <div className="mt-4 rounded-lg bg-[var(--surface-2)] p-4 text-sm"><p className="font-semibold">Pickup: {order.pickup?.date || "To be confirmed"} · {order.pickup?.slot || "Time pending"}</p><p className="mt-1 text-[var(--text-2)]">{order.branchName || "Pickup location"}</p></div>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button className="flex-1" variant={paymentNeeded ? "outline" : "primary"} onClick={() => onOpen?.(order)}>View details</Button>{paymentNeeded ? <Button className="flex-1" onClick={() => onPay(order)}><CreditCard className="h-4 w-4" />Continue payment</Button> : null}{cancellable ? <Button className="flex-1" variant="outline" onClick={() => onCancel?.(order)}>Cancel</Button> : null}</div>
    </Card>
  </div>;
}
function ActivityDetailModal({ order, open, onClose, onPay, onCancel, onReview, onRetry }) {
  const [delivery, setDelivery] = useState(null);
  useEffect(() => {
    let active = true;
    if (!open || !order?.id || order.fulfilment !== "delivery") { setDelivery(null); return undefined; }
    authenticatedFetch(`/api/orders/delivery-status?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" }).then((value) => { if (active) setDelivery(value.delivery || null); }).catch(() => {});
    const timer = window.setInterval(() => authenticatedFetch(`/api/orders/delivery-status?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" }).then((value) => { if (active) setDelivery(value.delivery || null); }).catch(() => {}), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [open, order?.id, order?.fulfilment]);
  if (!order) return null;
  const created = timestamp(order.createdAt);
  const transactionKind = order.transactionType || (order.fulfilment === "appointment" ? "appointment" : order.fulfilment === "booking" ? "booking" : order.fulfilment === "ticketing" ? "ticket" : null);
  const paymentNeeded = customerPaymentNeeded(order);
  const cancellable = customerActivityCancellable(order);
  const total = Number(order.totals?.total ?? order.total ?? 0);
  const subtotal = Number(order.totals?.subtotal ?? 0);
  const serviceFee = Number(order.totals?.serviceFee ?? 0);
  const deliveryFee = Number(order.totals?.deliveryFee ?? 0);
  const discount = Number(order.totals?.discount ?? order.promotion?.discount ?? 0);
  const currentDeliveryState = delivery?.state || order.deliveryStatus;

  return <Modal open={open} onClose={onClose} title={order.businessName || "Spotly Activity"} description={order.number || order.orderNumber || order.id} size="lg"><div className="p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-[var(--text-3)]">{created ? created.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" }) : "Recently created"}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">{transactionKind === "ride" ? "Ride activity" : transactionKind === "send" ? "Send activity" : transactionKind === "ticket" ? "Ticket activity" : transactionKind === "appointment" ? "Appointment" : transactionKind === "booking" ? "Booking" : order.fulfilment === "delivery" ? "Delivery order" : "Pickup order"}</h2></div><div className="flex flex-wrap gap-2"><StatusBadge status={order.status || "submitted"} />{order.paymentStatus ? <Badge tone={order.paymentStatus === "paid" ? "success" : ["failed", "refunded"].includes(order.paymentStatus) ? "danger" : "warning"}>{String(order.paymentStatus).replaceAll("_", " ")}</Badge> : null}</div></div>
    {transactionKind ? <TransactionSummary order={order} /> : order.fulfilment === "delivery" ? <div className="mt-5 rounded-[16px] bg-[var(--surface-2)] p-4"><p className="font-semibold">{deliveryStateLabel(currentDeliveryState)}</p><p className="mt-1 text-sm text-[var(--text-2)]">{order.delivery?.address || order.delivery?.suburb || "Delivery address"}</p>{delivery?.customerPin && !["delivered","cancelled","failed","returned"].includes(delivery.state) ? <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--text-3)]">Delivery PIN</p><p className="mt-1 font-mono text-2xl font-semibold tracking-[.16em]">{delivery.customerPin}</p><p className="mt-1 text-xs text-[var(--text-3)]">Only share this when the Driver is with you and ready to hand over the order.</p></div> : null}</div> : <div className="mt-5 rounded-[16px] bg-[var(--surface-2)] p-4"><p className="font-semibold">Pickup</p><p className="mt-1 text-sm text-[var(--text-2)]">{order.pickup?.date || "Date pending"} · {order.pickup?.slot || "Time pending"}</p><p className="mt-1 text-sm text-[var(--text-3)]">{order.branchName || order.locationName || "Selected location"}</p></div>}
    <div className="mt-6"><h3 className="text-sm font-semibold">{transactionKind === "ride" ? "Fare" : transactionKind === "send" ? "Parcel" : transactionKind === "ticket" ? "Tickets" : transactionKind ? "Offering" : "Items"}</h3><div className="mt-3 divide-y divide-[var(--divider)] rounded-[16px] border border-[var(--border-subtle)] px-4">{(order.items || []).map((item, index) => <div key={`${item.productId || item.name}-${index}`} className="flex gap-3 py-3 text-sm"><span className="font-semibold">{Number(item.quantity || 1)}×</span><div className="min-w-0 flex-1"><p className="font-medium">{item.name || "Item"}</p>{item.variant ? <p className="mt-1 text-xs text-[var(--text-3)]">{item.variant}</p> : null}</div>{Number(item.lineTotal ?? item.unitPrice ?? 0) > 0 ? <span className="font-semibold">{formatCurrency(item.lineTotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 1), order.currency || "USD")}</span> : null}</div>)}</div></div>
    {total > 0 ? <div className="mt-5 rounded-[16px] bg-[var(--surface-2)] p-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{formatCurrency(subtotal || Math.max(0, total - serviceFee - deliveryFee), order.currency || "USD")}</span></div>{discount > 0 ? <div className="mt-2 flex justify-between text-[var(--success)]"><span>{order.promotion?.name || "Promotion"}</span><span className="font-semibold">−{formatCurrency(discount, order.currency || "USD")}</span></div> : null}{serviceFee > 0 ? <div className="mt-2 flex justify-between"><span>Service fee</span><span>{formatCurrency(serviceFee, order.currency || "USD")}</span></div> : null}{deliveryFee > 0 ? <div className="mt-2 flex justify-between"><span>Delivery</span><span>{formatCurrency(deliveryFee, order.currency || "USD")}</span></div> : null}<div className="mt-3 flex justify-between border-t border-[var(--divider)] pt-3 text-base font-semibold"><span>Total</span><span>{formatCurrency(total, order.currency || "USD")}</span></div></div> : null}
    {customerActivityRecoverable(order) ? <div className="mt-5 rounded-[16px] border border-[color-mix(in_srgb,var(--warning)_30%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm"><p className="font-semibold text-[var(--on-warning-soft)]">This payment did not complete</p><p className="mt-1 leading-6 text-[var(--text-2)]">Spotly releases inventory or held availability after a failed or expired payment. Start again to recheck current stock, price and availability before paying.</p></div> : null}
    <div className="mt-6 flex flex-col gap-2 sm:flex-row">{transactionKind === "ride" ? <Button asChild className="flex-1"><Link href="/ride">Manage ride</Link></Button> : transactionKind === "send" ? <Button asChild className="flex-1"><Link href="/send">Manage Send</Link></Button> : null}<Button asChild variant="outline" className="flex-1"><Link href={transactionKind === "ride" ? `/support?topic=ride&ride=${encodeURIComponent(order.rideTripId || order.id)}` : transactionKind === "send" ? `/support?topic=send&parcel=${encodeURIComponent(order.parcelJobId || order.id)}` : `/support?order=${encodeURIComponent(order.id)}`}>Get help</Link></Button>{customerActivityRecoverable(order) ? <Button className="flex-1" onClick={() => onRetry?.(order)}><RefreshCw className="h-4 w-4" />Start again</Button> : null}{customerReviewEligible(order) ? <Button variant="outline" className="flex-1" onClick={() => onReview?.(order)}><Star className={cn("h-4 w-4", order.customerRating && "fill-current")} />{order.customerRating ? "Update review" : "Rate experience"}</Button> : null}{paymentNeeded ? <Button className="flex-1" onClick={() => onPay(order)}><CreditCard className="h-4 w-4" />Continue payment</Button> : null}{cancellable ? <Button variant="outline" className="flex-1" onClick={() => onCancel(order)}>Cancel</Button> : null}</div>
  </div></Modal>;
}

function ReviewModal({ order, open, onClose }) {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !order) return;
    setRating(Math.max(1, Math.min(5, Number(order.customerRating || 5))));
    setComment(String(order.customerReviewComment || ""));
  }, [open, order]);

  async function submit(event) {
    event.preventDefault();
    if (!order?.id || saving) return;
    setSaving(true);
    try {
      if (order.transactionType === "ride") await authenticatedFetch("/api/customer/rides/rating", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rideId: order.rideTripId, rating, comment }) });
      else await authenticatedFetch("/api/customer/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, rating, comment }) });
      track("review_submitted", { rating, transaction_type: activityKind(order) });
      toast(order.customerRating ? "Your review has been updated." : "Thanks for sharing your experience.", { title: "Review saved" });
      onClose?.();
    } catch (error) {
      toast(error.message || "Your review could not be saved.", { type: "error", title: "Could not save review" });
    } finally { setSaving(false); }
  }

  return <Modal open={open} onClose={() => !saving && onClose?.()} title={`Rate ${order?.transactionType === "ride" ? "your Driver" : order?.businessName || "this experience"}`} description="Verified Spotly activity" size="sm"><form onSubmit={submit} className="p-5"><div><p className="text-sm font-semibold">Your rating</p><div className="mt-3 flex gap-2" role="radiogroup" aria-label="Rating from 1 to 5 stars">{[1,2,3,4,5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => setRating(value)} className="rounded-lg p-1.5 transition hover:bg-[var(--surface-hover)]"><Star className={cn("h-7 w-7", value <= rating ? "fill-[var(--warning)] text-[var(--warning)]" : "text-[var(--text-3)]")} /></button>)}</div></div><label className="mt-5 block text-sm font-semibold">Comment <span className="font-normal text-[var(--text-3)]">(optional)</span><textarea className="field-control mt-2 min-h-28 w-full" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What stood out? Keep it useful for other customers." /></label><p className="mt-2 text-xs leading-5 text-[var(--text-3)]">Your review is shown as a verified Spotly experience. Your name, email and phone are not published with it.</p><div className="mt-5 flex gap-3"><Button type="button" variant="outline" className="flex-1" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" loading={saving}>Save review</Button></div></form></Modal>;
}

function BasketContents({ cartItems, cartTotal, currency, onCheckout, onClose }) {
  const reduce = useReducedMotion();
  return <div className="p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Your basket</h2><p className="mt-1 text-xs text-secondary">Built for this exact business location</p></div>{onClose && <button onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]" aria-label="Close basket"><X className="h-5 w-5" /></button>}</div>{cartItems.length ? <><div className="mt-5 space-y-3"><AnimatePresence initial={false}>{cartItems.map((item) => <motion.div layout key={item.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, x: 12 }} className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-sm"><motion.span key={item.quantity} initial={reduce ? false : { scale: .8 }} animate={{ scale: 1 }} className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] font-semibold text-[var(--on-accent-soft)]">{item.quantity}</motion.span><span className="min-w-0 flex-1 truncate font-medium">{item.name}</span><span className="font-semibold">{formatCurrency(priceFor(item, currency) * item.quantity, currency)}</span></motion.div>)}</AnimatePresence></div><div className="my-5 border-t" /><div className="flex items-center justify-between text-lg font-semibold"><span>Subtotal</span><span>{formatCurrency(cartTotal, currency)}</span></div><p className="mt-2 text-xs leading-5 text-[var(--text-3)]">Pickup and delivery availability come from the exact location you choose.</p><Button className="mt-5 w-full" onClick={onCheckout}>Choose pickup or delivery<ChevronRight className="h-4 w-4" /></Button></> : <div className="py-7 text-center"><SpotlyLottie name="empty-basket" mode="loop" className="mx-auto h-24 w-24" ariaLabel="Empty basket" /><p className="mt-2 text-sm font-semibold">Your basket is ready when you are</p><p className="mx-auto mt-2 max-w-[240px] text-xs leading-5 text-secondary">Add a product and Spotly will keep the basket tied to this location's prices and availability.</p></div>}</div>;
}

function CheckoutModal({ open, onClose, business, branches, selectedBranchId, cartItems, currency, user, defaultFulfilment = "pickup", onComplete }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [promotion, setPromotion] = useState(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [form, setForm] = useState({ checkoutId: "", promoCode: "", branchId: "", fulfilment: defaultFulfilment === "delivery" ? "delivery" : "pickup", date: "", slot: "", slotId: "", paymentMethod: "", contactName: user?.displayName || "", contactPhone: user?.phoneNumber || "", alternativePhone: "", notes: "", substitutionPreference: "contact_me", address: "", suburb: "", landmark: "", instructions: "", lat: null, lng: null });
  const selectedBranch = branches.find((branch) => branch.id === form.branchId);
  const deliveryEnabled = Boolean(selectedBranch?.delivery?.enabled && !selectedBranch?.delivery?.paused && (selectedBranch?.fulfilment || []).includes("delivery"));
  const availability = useMemo(() => pickupAvailability(selectedBranch), [selectedBranch]);
  const methods = useMemo(() => branchPaymentMethods(selectedBranch).filter((method) => form.fulfilment !== "delivery" || !["cash", "bank_transfer"].includes(method)), [selectedBranch, form.fulfilment]);
  const total = cartItems.reduce((sum, item) => sum + (priceFor(item, currency) || 0) * item.quantity, 0);
  const deliveryFee = form.fulfilment === "delivery" ? Number(selectedBranch?.delivery?.fee ?? 3.5) : 0;
  const promotionDiscount = Number(promotion?.discount || 0);
  const estimatedTotal = Math.max(0, total - promotionDiscount + deliveryFee);
  const unresolvedPrice = cartItems.some((item) => !priceFor(item, currency));
  const cartSignature = cartItems.map((item) => `${item.id}:${item.quantity}`).join("|");
  const steps = ["Basket", "How to get it", form.fulfilment === "delivery" ? "Delivery details" : "Pickup details", "Payment", "Review"];

  useEffect(() => {
    if (!open) return;
    const saved = migrateLegacyState(CHECKOUT_KEY, user) || readState(CHECKOUT_KEY, user, null);
    const preferred = branches.some((branch) => branch.id === selectedBranchId) ? selectedBranchId : branches[0]?.id || "";
    const checkoutId = saved?.checkoutId || globalThis.crypto?.randomUUID?.() || `checkout-${new Date().getTime().toString(36)}`;
    setForm((current) => ({ ...current, ...(saved || {}), checkoutId: saved?.checkoutId || current.checkoutId || checkoutId, branchId: saved?.branchId && branches.some((branch) => branch.id === saved.branchId) ? saved.branchId : preferred, fulfilment: saved?.fulfilment || (defaultFulfilment === "delivery" ? "delivery" : "pickup"), contactName: saved?.contactName || current.contactName || user?.displayName || "", contactPhone: saved?.contactPhone || current.contactPhone || user?.phoneNumber || "" }));
  }, [open, branches, selectedBranchId, user, defaultFulfilment]);

  useEffect(() => { if (open) writeState(CHECKOUT_KEY, user, form); }, [form, open, user]);
  useEffect(() => { setPromotion(null); }, [form.branchId, currency, cartSignature]);
  useEffect(() => {
    if (!selectedBranch) return;
    const nextAvailability = pickupAvailability(selectedBranch);
    setForm((current) => {
      const nextFulfilment = current.fulfilment === "delivery" && !deliveryEnabled ? "pickup" : current.fulfilment;
      const validDay = nextAvailability.days.find((day) => day.date === current.date);
      const validSlot = validDay?.slots.find((slot) => slot.label === current.slot);
      const allowedMethods = branchPaymentMethods(selectedBranch).filter((method) => nextFulfilment !== "delivery" || method !== "cash");
      const method = allowedMethods.includes(current.paymentMethod) ? current.paymentMethod : allowedMethods[0] || "";
      const chosenSlot = validSlot || nextAvailability.earliest?.slot || null;
      return { ...current, fulfilment: nextFulfilment, date: validDay ? current.date : nextAvailability.earliest?.date || "", slot: chosenSlot?.label || "", slotId: chosenSlot?.id || "", paymentMethod: method };
    });
  }, [selectedBranch, deliveryEnabled]);

  const day = availability.days.find((item) => item.date === form.date);
  function validationFor(currentStep) {
    if (unresolvedPrice) return "One or more items do not have a valid price in the selected currency.";
    if (currentStep >= 1 && !form.branchId) return "Choose a business location.";
    if (currentStep >= 1 && form.fulfilment === "delivery" && !deliveryEnabled) return "Delivery is not currently enabled for this location.";
    if (currentStep === 2 && form.fulfilment === "pickup" && !availability.available) return availability.reason;
    if (currentStep === 2 && form.fulfilment === "pickup" && (!form.date || !form.slot)) return "Choose an available pickup date and time.";
    if (currentStep === 2 && form.fulfilment === "delivery" && (!form.address.trim() || !Number.isFinite(Number(form.lat)) || !Number.isFinite(Number(form.lng)))) return "Add the delivery address and set its map location.";
    if (currentStep === 2 && !form.contactName.trim()) return `Enter the ${form.fulfilment === "delivery" ? "delivery" : "pickup"} contact name.`;
    if (currentStep === 2 && !/^\+?[0-9\s-]{7,18}$/.test(form.contactPhone.trim())) return "Enter a valid phone number.";
    if (currentStep === 3 && !form.paymentMethod) return "This location has not configured a payment method for checkout.";
    return "";
  }
  function next() { const message = validationFor(step); if (message) { setError(message); return; } setError(""); setStep((value) => Math.min(4, value + 1)); }
  function useCurrentLocation() {
    if (!navigator.geolocation) { setError("Location is not supported in this browser. Enter an address and use a device with location access."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      setForm((current) => ({ ...current, lat: position.coords.latitude, lng: position.coords.longitude }));
      setLocating(false);
    }, () => { setLocating(false); setError("We could not read your location. Allow location access and try again."); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }
  async function quotePromotion() {
    const code = String(form.promoCode || "").trim();
    if (!user || user.isAnonymous) { setError("Sign in before applying a promotion code."); return; }
    if (!form.branchId || !cartItems.length) return;
    setPromotionLoading(true); setError("");
    try {
      const result = await authenticatedFetch("/api/customer/promotions/quote", { method: "POST", body: JSON.stringify({ businessId: business.id, branchId: form.branchId, currency, code, items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })) }) });
      setPromotion(result.promotion || null);
      if (result.promotion) track("promotion_applied", { promotion_id: result.promotion.id || "", discount: Number(result.promotion.discount || 0), currency, service: "order" });
      if (code && !result.promotion) setError("That promotion is not available for this order.");
    } catch (reason) { setPromotion(null); setError(reason.message || "That promotion could not be applied."); }
    finally { setPromotionLoading(false); }
  }

  async function submit() {
    const message = validationFor(4); if (message) { setError(message); return; }
    if (!user || user.isAnonymous) { window.location.assign(`/login?next=${encodeURIComponent("/marketplace")}`); return; }
    setSubmitting(true); setError("");
    try {
      const payload = { checkoutId: form.checkoutId, promoCode: String(form.promoCode || "").trim(), businessId: business.id, branchId: form.branchId, items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })), currency, paymentMethod: form.paymentMethod, fulfilment: form.fulfilment };
      if (form.fulfilment === "pickup") payload.pickup = { date: form.date, slot: form.slot, slotId: form.slotId, contactName: form.contactName, contactPhone: form.contactPhone, alternativePhone: form.alternativePhone, notes: form.notes, substitutionPreference: form.substitutionPreference };
      else payload.delivery = { contactName: form.contactName, contactPhone: form.contactPhone, address: form.address, suburb: form.suburb, landmark: form.landmark, instructions: form.instructions, lat: Number(form.lat), lng: Number(form.lng), substitutionPreference: form.substitutionPreference };
      const order = await authenticatedFetch("/api/orders/create", { method: "POST", body: JSON.stringify(payload) });
      track("order_created", { business_id: business.id, branch_id: form.branchId, currency, fulfilment: form.fulfilment, payment_method: form.paymentMethod, item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0), amount: Number(order.total || estimatedTotal || 0), discount: Number(order.discount || 0) });
      if (order.paymentRequired) {
        const channel = ["ecocash", "onemoney"].includes(form.paymentMethod) ? form.paymentMethod : "web";
        const payment = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: order.orderId, channel, phone: form.contactPhone }) });
        if (payment.redirectUrl) window.location.assign(payment.redirectUrl); else toast(payment.instructions || "Payment request sent.", { type: "success" });
      } else toast(form.fulfilment === "delivery" ? "Order placed. The business will prepare it for delivery." : "Order placed. The business will confirm your pickup.", { type: "success" });
      removeState(CHECKOUT_KEY, user); setStep(0); onComplete(order); onClose();
    } catch (submissionError) { setError(submissionError.message || "The order could not be placed. Try again."); }
    finally { setSubmitting(false); }
  }
  const field = (key) => ({ value: form[key] ?? "", onChange: (event) => setForm({ ...form, [key]: event.target.value }) });
  return <Modal open={open} onClose={onClose} title="Complete your order" description={`Step ${step + 1} of ${steps.length}: ${steps[step]}`} size="lg"><div className="border-b px-5 py-4"><div className="flex gap-2">{steps.map((label, index) => <div key={label} className="min-w-0 flex-1"><div className={cn("h-1.5 rounded-full", index <= step ? "bg-violet" : "bg-[var(--border)]")} /><p className={cn("mt-2 hidden text-xs sm:block", index === step ? "font-semibold text-violet" : "text-[var(--text-3)]")}>{label}</p></div>)}</div></div><div className="min-h-[380px] p-5 sm:p-6">{error && <div role="alert" className="mb-5 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-3 text-sm text-[var(--on-danger-soft)]">{error}</div>}
  {step === 0 && <div><div className="rounded-lg bg-[var(--accent-soft)] p-4"><p className="font-semibold">{business?.name}</p><p className="mt-1 text-sm text-[var(--on-accent-soft)]">{cartItems.reduce((sum,item) => sum + item.quantity,0)} items · {formatCurrency(total,currency)}</p></div><div className="mt-5 divide-y">{cartItems.map((item) => <div key={item.id} className="flex gap-3 py-3 text-sm"><span className="font-semibold">{item.quantity}×</span><span className="flex-1">{item.name}</span><span className="font-semibold">{priceFor(item,currency) ? formatCurrency(priceFor(item,currency)*item.quantity,currency) : "Price unavailable"}</span></div>)}</div><div className="mt-5 rounded-xl border border-[var(--border-subtle)] p-4"><div className="flex items-center gap-2"><BadgePercent className="h-4 w-4 text-[var(--accent)]"/><p className="text-sm font-semibold">Promotion code</p></div><div className="mt-3 flex gap-2"><input className="field-control min-w-0 flex-1 uppercase" value={form.promoCode || ""} onChange={(event) => { setForm({ ...form, promoCode: event.target.value.toUpperCase() }); setPromotion(null); }} placeholder="Optional code"/><Button type="button" variant="outline" loading={promotionLoading} onClick={quotePromotion}>Apply</Button></div>{promotion ? <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--on-success-soft)]"><span>{promotion.name || promotion.label || "Promotion applied"}</span><strong>-{formatCurrency(promotionDiscount,currency)}</strong></div> : <p className="mt-2 text-xs text-[var(--text-3)]">Eligible automatic offers are also checked securely when you place the order.</p>}</div></div>}
  {step === 1 && <div className="space-y-5"><label className="text-sm font-medium">Business location<select {...field("branchId")} className="field-control mt-2 w-full">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName || branch.name || "Main location"} · {branch.city || "Zimbabwe"}</option>)}</select></label><div><p className="text-sm font-medium">How do you want it?</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setForm((current) => ({ ...current, fulfilment: "pickup" }))} className={cn("rounded-xl border p-4 text-left", form.fulfilment === "pickup" ? "border-violet bg-violet-soft ring-2 ring-violet/10" : "bg-[var(--surface)]")}><PackageCheck className="h-5 w-5 text-violet" /><p className="mt-3 font-semibold">Pick up</p><p className="mt-1 text-sm text-secondary">Choose a time and collect from the business.</p></button><button type="button" disabled={!deliveryEnabled} onClick={() => setForm((current) => ({ ...current, fulfilment: "delivery" }))} className={cn("rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50", form.fulfilment === "delivery" ? "border-violet bg-violet-soft ring-2 ring-violet/10" : "bg-[var(--surface)]")}><MapPin className="h-5 w-5 text-violet" /><p className="mt-3 font-semibold">Delivery</p><p className="mt-1 text-sm text-secondary">{deliveryEnabled ? `Delivered from ${selectedBranch?.branchName || selectedBranch?.name || "this location"}.` : "Delivery is not enabled at this location yet."}</p></button></div></div></div>}
  {step === 2 && form.fulfilment === "pickup" && <div className="space-y-5">{availability.available ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Pickup day<select value={form.date} onChange={(event) => { const nextDay = availability.days.find((item) => item.date === event.target.value); const nextSlot = nextDay?.slots?.[0] || null; setForm({ ...form, date: event.target.value, slotId: nextSlot?.id || "", slot: nextSlot?.label || "" }); }} className="field-control mt-2 w-full">{availability.days.map((item) => <option key={item.date} value={item.date}>{item.label}</option>)}</select></label><label className="text-sm font-medium">Pickup time<select value={form.slotId} onChange={(event) => { const selected = day?.slots.find((slot) => slot.id === event.target.value); setForm({ ...form, slotId: selected?.id || "", slot: selected?.label || "" }); }} className="field-control mt-2 w-full">{(day?.slots || []).map((slot) => <option key={slot.id} value={slot.id}>{slot.label}{slot.remaining <= 3 ? ` · ${slot.remaining} left` : ""}</option>)}</select></label></div> : <div className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]"><p className="font-semibold">Pickup is not available for online checkout.</p><p className="mt-1">{availability.reason}</p></div>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Pickup contact name<input {...field("contactName")} className="field-control mt-2 w-full" /></label><label className="text-sm font-medium">Phone<input {...field("contactPhone")} className="field-control mt-2 w-full" placeholder="+263" /></label><label className="text-sm font-medium sm:col-span-2">Pickup notes <span className="font-normal text-tertiary">optional</span><textarea {...field("notes")} className="field-control mt-2 min-h-24 w-full" /></label></div></div>}
  {step === 2 && form.fulfilment === "delivery" && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Delivery address<input {...field("address")} className="field-control mt-2 w-full" placeholder="Street / complex / house" /></label><label className="text-sm font-medium">Area or suburb<input {...field("suburb")} className="field-control mt-2 w-full" placeholder="Highlands" /></label><label className="text-sm font-medium">Landmark <span className="font-normal text-tertiary">optional</span><input {...field("landmark")} className="field-control mt-2 w-full" /></label><label className="text-sm font-medium">Delivery contact name<input {...field("contactName")} className="field-control mt-2 w-full" /></label><label className="text-sm font-medium">Phone<input {...field("contactPhone")} className="field-control mt-2 w-full" placeholder="+263" /></label><label className="text-sm font-medium sm:col-span-2">Delivery instructions <span className="font-normal text-tertiary">optional</span><textarea {...field("instructions")} className="field-control mt-2 min-h-24 w-full" placeholder="Gate, entrance, landmark or handoff instructions" /></label></div><div className="rounded-xl border bg-[var(--surface-2)] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-semibold">Set the delivery pin</p><p className="mt-1 text-sm text-secondary">Spotly uses the map location for dispatch and Driver navigation.</p>{Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng)) && <p className="mt-2 text-xs font-semibold text-success">Location set · {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}</p>}</div><Button type="button" variant="outline" onClick={useCurrentLocation} loading={locating}><LocateFixed className="h-4 w-4" />Use my location</Button></div></div></div>}
  {step === 3 && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2">{methods.map((method) => <button type="button" key={method} onClick={() => setForm((current) => ({ ...current, paymentMethod: method }))} className={cn("rounded-xl border p-4 text-left", form.paymentMethod === method ? "border-violet bg-violet-soft ring-2 ring-violet/10" : "bg-[var(--surface)]")}><CreditCard className="h-5 w-5 text-violet" /><p className="mt-3 font-semibold">{method.replaceAll("_", " ")}</p></button>)}</div>{form.fulfilment === "delivery" && <p className="text-sm text-secondary">Cash on delivery is intentionally unavailable. Choose a supported digital payment method.</p>}</div>}
  {step === 4 && <div className="space-y-4"><div className="rounded-xl border p-5"><p className="text-sm font-semibold text-violet">{form.fulfilment === "delivery" ? "Delivery" : "Pickup"}</p><h3 className="mt-2 text-xl font-semibold">{selectedBranch?.branchName || selectedBranch?.name || business?.name}</h3><p className="mt-2 text-sm text-secondary">{form.fulfilment === "delivery" ? `${form.address}${form.suburb ? ` · ${form.suburb}` : ""}` : `${form.date} · ${form.slot}`}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-5 text-sm"><div className="flex justify-between"><span>Items</span><span className="font-semibold">{formatCurrency(total,currency)}</span></div>{promotionDiscount > 0 && <div className="mt-2 flex justify-between text-[var(--success)]"><span>Promotion</span><span className="font-semibold">-{formatCurrency(promotionDiscount,currency)}</span></div>}{form.fulfilment === "delivery" && <div className="mt-2 flex justify-between"><span>Delivery</span><span className="font-semibold">{formatCurrency(deliveryFee,currency)}</span></div>}<div className="mt-3 flex justify-between border-t pt-3 text-base"><span className="font-semibold">Estimated total</span><span className="font-semibold">{formatCurrency(estimatedTotal,currency)}</span></div></div><p className="text-xs leading-5 text-tertiary">The server verifies product prices, fees, branch availability and fulfilment before creating the order.</p></div>}
  </div><div className="flex items-center justify-between gap-3 border-t p-5"><Button variant="outline" onClick={() => step ? setStep((value) => value - 1) : onClose()}>{step ? "Back" : "Cancel"}</Button>{step < 4 ? <Button onClick={next}>{step === 0 ? "Choose fulfilment" : step === 1 ? (form.fulfilment === "delivery" ? "Add delivery details" : "Choose fulfilment") : step === 2 ? "Choose payment" : "Review order"}</Button> : <Button onClick={submit} loading={submitting}>Place {form.fulfilment === "delivery" ? "delivery" : "pickup"} order</Button>}</div></Modal>;
}


function BusinessDetailView({
  business,
  favorite,
  onFavorite,
  onBack,
  businessDetailLoading,
  branchError,
  branches,
  selectedBranchId,
  onBranchChange,
  locationNoun,
  catalogError,
  branchProducts,
  visibleProducts,
  categories,
  category,
  setCategory,
  productQuery,
  setProductQuery,
  archetype,
  isPickup,
  currency,
  cart,
  onQuantityChange,
  onOfferOpen,
  cartItems,
  cartTotal,
  onCheckout
}) {
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) || branches[0] || null;
  const verified = ["approved", "verified"].includes(business.verificationStatus);
  const capabilityTitle = isPickup ? (archetype.id === "restaurant_food" ? "Order from this location" : "Shop this location") : archetype.id === "ticketing_events" ? "Choose an event or ticket" : archetype.id === "appointments_services" ? "Choose a service" : archetype.id === "accommodation_activities" ? "Choose a listing" : "Explore this business";
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!business?.id) { setReviews([]); return undefined; }
    setReviewsLoading(true);
    publicApiFetch(`/api/public/reviews?businessId=${encodeURIComponent(business.id)}`, { cache: "default" }).then((result) => { if (active) setReviews(Array.isArray(result.reviews) ? result.reviews : []); }).catch(() => { if (active) setReviews([]); }).finally(() => { if (active) setReviewsLoading(false); });
    return () => { active = false; };
  }, [business?.id]);

  return <section className="pb-8">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"><ArrowLeft className="h-4 w-4" />Back</button>

    <div className="mt-4 overflow-hidden rounded-[28px] bg-[var(--surface)]">
      <div className="relative min-h-[220px] overflow-hidden bg-[var(--surface-2)] sm:min-h-[300px]">
        <BusinessVisual business={business} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-[var(--media-text)] sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[var(--media-surface)] text-[var(--media-ink)] ring-0">{business.category || archetype.shortLabel}</Badge>
            {verified ? <Badge className="bg-[var(--success)] text-[var(--on-success)] ring-0"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge> : null}{Number(business.rating || 0) > 0 ? <Badge className="bg-[var(--media-surface)] text-[var(--media-ink)] ring-0"><Star className="mr-1 h-3.5 w-3.5 fill-current" />{Number(business.rating).toFixed(1)}{Number(business.reviewCount || 0) > 0 ? ` · ${business.reviewCount}` : ""}</Badge> : null}
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="min-w-0"><h1 className="text-3xl font-semibold tracking-[-.045em] sm:text-5xl">{business.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[color-mix(in_srgb,var(--media-text)_82%,transparent)] sm:text-base">{business.description || `${archetype.label} on Spotly.`}</p></div>
            <Button size="icon" variant="outline" onClick={() => onFavorite(business.id)} aria-label={favorite ? "Remove from saved" : "Save business"} className="shrink-0 border-[color-mix(in_srgb,var(--media-surface)_40%,transparent)] bg-[var(--media-surface)] text-[var(--media-ink)] hover:opacity-95"><Heart className={cn("h-5 w-5", favorite && "fill-[var(--danger)] text-[var(--danger)]")} /></Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t border-[var(--border-subtle)] p-4 sm:grid-cols-3 sm:p-5">
        <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--text-3)]">Experience</p><p className="mt-2 text-sm font-semibold">{archetype.shortLabel}</p></div>
        <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--text-3)]">Location</p><p className="mt-2 text-sm font-semibold">{selectedBranch?.branchName || selectedBranch?.name || business.area || business.city || "Choose below"}</p></div>
        <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><p className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--text-3)]">Online</p><p className="mt-2 text-sm font-semibold">{isPickup ? "Pickup / delivery where available" : archetype.id === "ticketing_events" ? "Ticket requests" : archetype.id === "appointments_services" ? "Appointment requests" : archetype.id === "accommodation_activities" ? "Booking requests" : "Business information"}</p></div>
      </div>
    </div>

    <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        {businessDetailLoading ? <Card variant="bordered" className="p-6"><div className="flex items-center gap-3"><LoaderCircle className="h-5 w-5 animate-spin text-violet"/><div><p className="font-semibold">Loading this business</p><p className="mt-1 text-sm text-secondary">Checking locations, offerings, prices and availability.</p></div></div></Card> : branchError ? <div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{branchError}</div> : branches.length ? <div className="rounded-[20px] bg-[var(--surface)] p-5"><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-[var(--accent)]" /><div><h2 className="font-semibold">Choose the exact {locationNoun}</h2><p className="mt-1 text-sm leading-6 text-[var(--text-2)]">Prices and availability can differ by location.</p></div></div><div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">{branches.map((branch) => { const active = branch.id === selectedBranchId; const availability = pickupAvailability(branch); return <button key={branch.id} type="button" onClick={() => onBranchChange(branch.id)} className={cn("min-w-[210px] rounded-[16px] border px-4 py-3 text-left", active ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]" : "bg-[var(--surface)] hover:border-[var(--border-strong)]")}><span className="block text-sm font-semibold">{branch.branchName || branch.name || `Main ${locationNoun}`}</span><span className="mt-1 block text-xs text-[var(--text-3)]">{branch.city || "Zimbabwe"}{branch.address ? ` · ${branch.address}` : ""}</span>{isPickup ? <span className={cn("mt-2 block text-xs font-semibold", availability.available ? "text-success" : "text-warning")}>{availability.available ? `Earliest ${availability.earliest.date} ${availability.earliest.slot.label}` : availability.reason}</span> : null}</button>; })}</div></div> : <LottieEmptyState name="location-pin" title="No customer location is published" description="This business needs a public location before online activity can begin." />}

        <div className="mt-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">{archetype.shortLabel}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">{capabilityTitle}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-2)]">Open an item for full details before adding it to a basket or sending a booking request.</p></div><p className="text-sm text-[var(--text-3)]">{visibleProducts.length} available</p></div>

          {branchProducts.length > 0 ? <div className="mt-5 space-y-3"><SearchField value={productQuery} onChange={setProductQuery} label={`Search ${archetype.nouns.catalog}`} placeholder={`Search ${archetype.nouns.items}`} /><div className="no-scrollbar flex gap-2 overflow-x-auto pb-1"><button onClick={() => setCategory("all")} className={cn("rounded-full border px-3 py-2 text-sm font-semibold", category === "all" ? "border-violet bg-violet-soft text-violet-strong" : "bg-[var(--surface)]")}>All</button>{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={cn("rounded-full border px-3 py-2 text-sm font-semibold", category === item ? "border-violet bg-violet-soft text-violet-strong" : "bg-[var(--surface)]")}>{item}</button>)}</div></div> : null}

          {businessDetailLoading ? <div className="mt-5 flex items-center gap-3 rounded-xl border p-5 text-sm text-secondary"><LoaderCircle className="h-5 w-5 animate-spin text-violet"/>Loading published offerings…</div> : catalogError ? <div role="alert" className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{catalogError}</div> : visibleProducts.length ? <div className="mt-5 grid gap-3 xl:grid-cols-2">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} quantity={cart[product.id] || 0} onChange={onQuantityChange} onOpen={onOfferOpen} currency={currency} archetype={archetype} />)}</div> : branchProducts.length ? <LottieEmptyState className="mt-5" name="search-nearby" title="No matching offerings" description="Try another search or category." action={<Button variant="outline" onClick={() => { setProductQuery(""); setCategory("all"); }}>Clear filters</Button>} /> : <LottieEmptyState className="mt-5" name="storefront-open" title={`${archetype.nouns.catalog} not available yet`} description={`This business has not published available ${archetype.nouns.items} for this location.`} action={<div className="flex flex-wrap justify-center gap-2"><Button asChild variant="outline"><Link href="/support?topic=listing-update">Suggest an update</Link></Button><Button onClick={onBack}>Browse similar businesses</Button></div>} />}
        </div>

        <section className="mt-7 rounded-[20px] bg-[var(--surface)] p-5" aria-labelledby="business-reviews-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--accent)]">Verified experiences</p><h2 id="business-reviews-title" className="mt-1 text-2xl font-semibold tracking-[-.035em]">Customer reviews</h2></div>{Number(business.rating || 0) > 0 ? <div className="text-right"><p className="flex items-center justify-end gap-1 text-lg font-semibold"><Star className="h-5 w-5 fill-[var(--warning)] text-[var(--warning)]" />{Number(business.rating).toFixed(1)}</p><p className="text-xs text-[var(--text-3)]">{Number(business.reviewCount || 0)} verified review{Number(business.reviewCount || 0) === 1 ? "" : "s"}</p></div> : null}</div>{reviewsLoading ? <div className="mt-4 flex items-center gap-2 text-sm text-[var(--text-3)]"><LoaderCircle className="h-4 w-4 animate-spin" />Loading reviews…</div> : reviews.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{reviews.slice(0, 6).map((review) => <article key={review.id} className="rounded-[16px] bg-[var(--surface-2)] p-4"><div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>{[1,2,3,4,5].map((value) => <Star key={value} className={cn("h-4 w-4", value <= Number(review.rating || 0) ? "fill-[var(--warning)] text-[var(--warning)]" : "text-[var(--border-strong)]")} />)}</div>{review.comment ? <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">{review.comment}</p> : <p className="mt-3 text-sm text-[var(--text-3)]">Rated after a verified Spotly experience.</p>}<div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-3)]"><BadgeCheck className="h-3.5 w-3.5" />Verified Spotly activity{review.createdAt ? ` · ${new Date(review.createdAt).toLocaleDateString("en-ZW", { dateStyle: "medium" })}` : ""}</div></article>)}</div> : <p className="mt-4 text-sm leading-6 text-[var(--text-3)]">No customer reviews yet. Reviews can only be left after completed Spotly activity.</p>}</section>
      </div>

      {isPickup ? <aside className="h-fit rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] lg:sticky lg:top-24"><BasketContents cartItems={cartItems} cartTotal={cartTotal} currency={currency} onCheckout={onCheckout} /></aside> : <aside className="h-fit rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 lg:sticky lg:top-24"><ShieldCheck className="h-5 w-5 text-[var(--accent)]" /><h2 className="mt-4 text-lg font-semibold">Book through Spotly</h2><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Choose a published {archetype.nouns.item} to send a real request. It will appear in Activity and in the business workspace for confirmation.</p><div className="mt-5 rounded-[16px] bg-[var(--surface-2)] p-4 text-xs leading-5 text-[var(--text-3)]"><p className="font-semibold text-[var(--text)]">What happens next</p><p className="mt-2">1. Choose an offering.</p><p>2. Add the date, time or ticket quantity.</p><p>3. Spotly sends it to the business.</p><p>4. Track confirmation in Activity.</p></div></aside>}
    </div>
  </section>;
}


function normalizeMarketplaceView(value) {
  if (value === "orders") return "activity";
  if (value === "discover") return "home";
  return ["home", "search", "activity", "saved"].includes(value) ? value : "home";
}

export function MarketplaceApp({ basePath = "/marketplace", initialService = null, initialBusinessId = null, initialOfferId = null, initialCity = null }) {
  const { user, profile, authReady } = useAuth();
  const { settings, settingsReady } = usePlatform();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderRefs = useRef({});

  const requestedView = searchParams.get("view");
  const requestedOrder = searchParams.get("order");
  const requestedBusiness = searchParams.get("business") || initialBusinessId;
  const requestedOffer = searchParams.get("offer") || initialOfferId;
  const requestedService = searchParams.get("service");
  const launchCities = settings.launch?.launchCities?.length ? settings.launch.launchCities : ["Harare"];
  const defaultLocation = { city: initialCity && launchCities.includes(initialCity) ? initialCity : settings.launch?.primaryCity || launchCities[0], area: "", radiusKm: 20, coordinates: null };

  const [location, setLocation] = useState(defaultLocation);
  const [locating, setLocating] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [businesses, setBusinesses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [transactionOffer, setTransactionOffer] = useState(null);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [pendingBranchId, setPendingBranchId] = useState("");
  const [cart, setCart] = useState({});
  const [basketOpen, setBasketOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoriteBusinesses, setFavoriteBusinesses] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchCounts, setSearchCounts] = useState({});
  const [searchFilter, setSearchFilter] = useState("all");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentBusinessIds, setRecentBusinessIds] = useState([]);
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityDetail, setActivityDetail] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [view, setView] = useState(requestedOrder ? "activity" : normalizeMarketplaceView(requestedView));
  const [service, setService] = useState(MARKETPLACE_SERVICE_KEYS.has(requestedService) ? requestedService : MARKETPLACE_SERVICE_KEYS.has(initialService) ? initialService : null);
  const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [branchError, setBranchError] = useState("");
  const [businessDetailLoading, setBusinessDetailLoading] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [reloadKey, setReloadKey] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine !== false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const maintenance = settings.launch?.publicMode === "maintenance";
  const ridesEnabled = typeof settings.mobility?.ridesEnabled === "boolean" ? settings.mobility.ridesEnabled : settings.launch?.ridesEnabled === true;
  const sendEnabled = settings.mobility?.send?.enabled === true || settings.commerce?.peerDeliveryEnabled === true || settings.launch?.sendEnabled === true;

  function routeFor(params) {
    const queryString = params.toString();
    const root = basePath || "/";
    return queryString ? `${root}?${queryString}` : root;
  }

  function updateUrl(nextView, extras = {}) {
    const params = new URLSearchParams(searchParams.toString());
    const normalized = normalizeMarketplaceView(nextView);
    if (normalized === "home") params.delete("view"); else params.set("view", normalized);
    if (extras.order === null) params.delete("order"); else if (extras.order) params.set("order", extras.order);
    if (extras.business === null) params.delete("business"); else if (extras.business) params.set("business", extras.business);
    if (extras.service === null) params.delete("service"); else if (extras.service) params.set("service", extras.service);
    if (extras.offer === null) params.delete("offer"); else if (extras.offer) params.set("offer", extras.offer);
    router.push(routeFor(params), { scroll: false });
    setView(normalized);
    if (Object.prototype.hasOwnProperty.call(extras, "service")) setService(MARKETPLACE_SERVICE_KEYS.has(extras.service) ? extras.service : null);
  }

  function openHome() {
    setSelected(null);
    setSelectedOffer(null);
    setTransactionOffer(null);
    setQuery("");
    if (SERVICE_PATHS.has(basePath)) {
      router.push("/");
      return;
    }
    updateUrl("home", { business: null, order: null, service: null, offer: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function enterService(nextService) {
    setSelected(null);
    setSelectedOffer(null);
    setTransactionOffer(null);
    setQuery("");
    if (MARKETPLACE_SERVICE_KEYS.has(nextService) || nextService === "ride" || nextService === "send") {
      router.push(`/${nextService}`);
      return;
    }
    updateUrl("home", { business: null, order: null, service: nextService, offer: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSearch() {
    setSelected(null);
    setSelectedOffer(null);
    setTransactionOffer(null);
    updateUrl("search", { business: null, order: null, service, offer: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    setView(requestedOrder ? "activity" : normalizeMarketplaceView(requestedView));
  }, [requestedView, requestedOrder]);

  useEffect(() => {
    const nextService = MARKETPLACE_SERVICE_KEYS.has(requestedService) ? requestedService : MARKETPLACE_SERVICE_KEYS.has(initialService) ? initialService : null;
    setService(nextService);
  }, [requestedService, initialService]);
  useEffect(() => { if (settingsReady) track("marketplace_view", { view, service: service || "home", city: location.city || "", signed_in: Boolean(user && !user.isAnonymous) }); }, [view, service, location.city, settingsReady, user?.uid, user?.isAnonymous]);

  useEffect(() => {
    const migratedCart = migrateLegacyState(CART_KEY, user);
    setCart(migratedCart || readState(CART_KEY, user, {}));
    setLocation(migrateLegacyState(LOCATION_KEY, user) || readState(LOCATION_KEY, user, defaultLocation));
    setRecentBusinessIds(readState(RECENT_BUSINESS_KEY, user, [], "local"));
  }, [user]);

  useEffect(() => { writeState(CART_KEY, user, cart); }, [cart, user]);
  useEffect(() => { writeState(LOCATION_KEY, user, location); }, [location, user]);
  useEffect(() => {
    const preferred = profile?.preferences?.preferredCurrency;
    if (preferred && !selectedBranchId) setCurrency(preferred);
  }, [profile?.preferences?.preferredCurrency, selectedBranchId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    const timer = window.setTimeout(async () => {
      try {
        const result = await searchLiveBusinesses(query, 100, { city: location.city });
        if (active) {
          setBusinesses(result);
          setLoadError("");
        }
      } catch {
        if (active) setLoadError("Spotly could not refresh nearby businesses. You can keep using the last loaded results, or retry.");
      } finally {
        if (active) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [location.city, query, reloadKey]);

  useEffect(() => {
    let active = true;
    if (!requestedBusiness || selected?.id === requestedBusiness) return () => { active = false; };
    const found = businesses.find((business) => business.id === requestedBusiness);
    if (found) { setSelected(found); return () => { active = false; }; }
    loadPublicMarketplaceBusiness(requestedBusiness).then((result) => {
      if (!active || !result?.business) return;
      setSelected(result.business);
    }).catch(() => {});
    return () => { active = false; };
  }, [requestedBusiness, businesses, selected?.id]);

  useEffect(() => {
    let active = true;
    if (!selected?.id) {
      setProducts([]);
      setBranches([]);
      setSelectedBranchId("");
      setBusinessDetailLoading(false);
      return () => { active = false; };
    }
    setCatalogError("");
    setBranchError("");
    setBusinessDetailLoading(true);
    loadPublicMarketplaceBusiness(selected.id).then((result) => {
      if (!active) return;
      const nextProducts = (result.products || []).filter((item) => item.available !== false && item.status !== "archived");
      const nextBranches = result.branches || [];
      setProducts(nextProducts);
      setBranches(nextBranches);
      setSelectedBranchId((current) => nextBranches.some((branch) => branch.id === current) ? current : (nextBranches[0]?.id || ""));
      setBusinessDetailLoading(false);
    }).catch((reason) => {
      if (!active) return;
      setProducts([]);
      setBranches([]);
      setSelectedBranchId("");
      setCatalogError(reason.message || "This catalogue could not be loaded.");
      setBranchError(reason.message || "Locations could not be loaded for this business.");
      setBusinessDetailLoading(false);
    });
    return () => { active = false; };
  }, [selected?.id]);

  useEffect(() => {
    if (!requestedOffer || !selected?.id || !products.length) return;
    const match = products.find((product) => product.id === requestedOffer);
    if (match) setSelectedOffer(match);
  }, [requestedOffer, selected?.id, products]);

  useEffect(() => {
    setRecentSearches(readState(RECENT_SEARCH_KEY, user, [], "local"));
  }, [user]);
  useEffect(() => user?.uid && !user.isAnonymous ? subscribeFavorites(user.uid, setFavorites, () => {}) : undefined, [user?.uid, user?.isAnonymous]);
  useEffect(() => {
    if (!favorites.length) {
      setFavoriteBusinesses([]);
      return undefined;
    }
    let active = true;
    Promise.all(favorites.slice(0, 100).map(async (businessId) => {
      try {
        const result = await loadPublicMarketplaceBusiness(businessId);
        return result?.business || null;
      } catch {
        return null;
      }
    })).then((items) => {
      if (active) setFavoriteBusinesses(items.filter(Boolean));
    });
    return () => { active = false; };
  }, [favorites]);
  useEffect(() => user?.uid && !user.isAnonymous ? subscribeSavedItems(user.uid, setSavedItems, () => {}) : undefined, [user?.uid, user?.isAnonymous]);
  useEffect(() => user?.uid && !user.isAnonymous ? subscribeCustomerOrders(user.uid, setOrders, () => {}) : undefined, [user?.uid, user?.isAnonymous]);
  useEffect(() => {
    if (view !== "search") return undefined;
    const term = query.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setSearchCounts({});
      setSearchLoading(false);
      setSearchError("");
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const result = await searchSpotly(term, 60, { city: location.city, service });
        if (!active) return;
        setSearchResults(result.results || []);
        setSearchCounts(result.counts || {});
        track((result.results || []).length ? "global_search_results" : "global_search_zero_results", { query_length: term.length, result_count: (result.results || []).length, city: location.city || "", service: service || "all" });
      } catch (error) {
        if (!active) return;
        setSearchResults([]);
        setSearchCounts({});
        setSearchError(error.message || "Search could not be completed.");
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [view, query, location.city, service]);
  useEffect(() => {
    if (!requestedOrder || view !== "activity" || !orders.length) return;
    const match = orders.find((order) => order.id === requestedOrder);
    if (match) setActivityDetail(match);
    const timer = setTimeout(() => orderRefs.current[requestedOrder]?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    return () => clearTimeout(timer);
  }, [requestedOrder, view, orders]);

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
  const acceptedCurrencies = useMemo(() => branchAcceptedCurrencies(selectedBranch), [selectedBranch]);
  useEffect(() => {
    if (selectedBranch && !acceptedCurrencies.includes(currency)) setCurrency(acceptedCurrencies[0] || "USD");
  }, [selectedBranch, acceptedCurrencies, currency]);

  const businessResults = useMemo(() => businesses.map((business) => {
    const coords = business.coordinates || business.location || ((Number.isFinite(Number(business.latitude)) && Number.isFinite(Number(business.longitude))) ? { lat: Number(business.latitude), lng: Number(business.longitude) } : null);
    const distance = location.coordinates && coords ? distanceKm(location.coordinates, coords) : null;
    return { business, distance };
  }).filter(({ business, distance }) => {
    const cityMatch = !location.city || String(business.city || "").toLowerCase() === location.city.toLowerCase() || !business.city;
    const areaTerm = location.area.trim().toLowerCase();
    const areaMatch = !areaTerm || `${business.area || ""} ${business.suburb || ""} ${business.address || ""}`.toLowerCase().includes(areaTerm);
    const radiusMatch = distance === null || distance <= Number(location.radiusKm || 20);
    return cityMatch && areaMatch && radiusMatch;
  }).sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999)), [businesses, location]);

  const serviceResults = useMemo(() => {
    if (!["eat", "shop", "book", "events"].includes(service)) return businessResults;
    return businessResults.filter(({ business }) => serviceMatchesBusiness(service, business));
  }, [businessResults, service]);

  const selectedArchetype = useMemo(() => businessArchetype(selected || {}), [selected]);
  const selectedIsPickup = selectedArchetype.capabilities.includes("pickup_orders");
  const locationNoun = selectedArchetype.nouns.branch;
  const branchProducts = useMemo(() => products.filter((product) => !product.branchIds?.length || !selectedBranchId || product.branchIds.includes(selectedBranchId)).map((product) => resolveProductForBranch(product, selectedBranchId)), [products, selectedBranchId]);
  const categories = useMemo(() => [...new Set(branchProducts.map((product) => product.category).filter(Boolean))].sort(), [branchProducts]);
  const visibleProducts = useMemo(() => branchProducts.filter((product) => {
    const matchesCategory = category === "all" || product.category === category;
    const term = productQuery.trim().toLowerCase();
    return matchesCategory && (!term || `${product.name} ${product.description || ""} ${product.category || ""}`.toLowerCase().includes(term));
  }), [branchProducts, category, productQuery]);
  const cartItems = useMemo(() => products.filter((product) => cart[product.id] && priceFor(product, currency)).map((product) => ({ ...product, quantity: cart[product.id] })), [cart, products, currency]);
  const cartTotal = cartItems.reduce((sum, item) => sum + priceFor(item, currency) * item.quantity, 0);
  const shownBusinesses = view === "saved" ? businessResults.filter(({ business }) => favorites.includes(business.id)) : serviceResults;
  useEffect(() => {
    if (!activityDetail?.id) return;
    const current = orders.find((order) => order.id === activityDetail.id);
    if (current) setActivityDetail(current);
  }, [orders, activityDetail?.id]);

  const activityOrders = useMemo(() => orders.filter((order) => {
    if (activityFilter === "all") return true;
    const kind = order.transactionType || (order.fulfilment === "appointment" ? "appointment" : order.fulfilment === "booking" ? "booking" : order.fulfilment === "ticketing" ? "ticket" : "order");
    if (activityFilter === "orders") return kind === "order";
    if (activityFilter === "bookings") return ["appointment", "booking"].includes(kind);
    if (activityFilter === "tickets") return kind === "ticket";
    if (activityFilter === "deliveries") return order.fulfilment === "delivery";
    return true;
  }), [orders, activityFilter]);
  const activityGroups = useMemo(() => {
    const groups = { problem: [], active: [], upcoming: [], past: [] };
    activityOrders.forEach((order) => groups[activityBucket(order)].push(order));
    return groups;
  }, [activityOrders]);

  function locate() {
    if (!navigator.geolocation) {
      toast("Location is not supported in this browser.", { type: "error" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation((value) => ({ ...value, coordinates: { lat: position.coords.latitude, lng: position.coords.longitude } }));
      setLocating(false);
    }, () => {
      setLocating(false);
      toast("Your location could not be read. Choose an area instead.", { type: "error" });
    }, { timeout: 8000 });
  }

  function changeQuantity(product, quantity) {
    const max = Number(product.maxQuantity || 99);
    const next = Math.max(0, Math.min(max, quantity));
    const previous = Number(cart[product.id] || 0);
    setCart((current) => ({ ...current, [product.id]: next }));
    if (previous === 0 && next > 0) {
      toast(`${product.name} was added to your basket.`, { title: "Added to basket" });
      track("add_to_cart", { product_id: product.id, business_id: selected?.id || "", branch_id: selectedBranchId || "", currency });
    }
    if (previous > 0 && next === 0) track("remove_from_cart", { product_id: product.id, business_id: selected?.id || "", branch_id: selectedBranchId || "", currency });
  }

  function openOffer(product) {
    setSelectedOffer(product);
    if (selected?.id) updateUrl("home", { business: selected.id, order: null, service, offer: product.id });
    track("view_item", { product_id: product.id, business_id: selected?.id || "", branch_id: selectedBranchId || "", currency, item_type: product.itemType || selectedArchetype.nouns.item });
  }

  function closeOffer() {
    setSelectedOffer(null);
    if (selected?.id) updateUrl("home", { business: selected.id, order: null, service, offer: null });
  }

  function startTransaction(product) {
    if (!user || user.isAnonymous) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setSelectedOffer(null);
    if (selected?.id) updateUrl("home", { business: selected.id, order: null, service, offer: null });
    setTransactionOffer(product);
    track("begin_booking", { product_id: product.id, business_id: selected?.id || "", branch_id: selectedBranchId || "", currency, business_type: selectedArchetype.id });
  }

  async function toggleFavorite(id) {
    if (!user || user.isAnonymous) return window.location.assign(`/login?next=${encodeURIComponent(`${basePath || "/"}?view=saved`)}`);
    const next = !favorites.includes(id);
    setFavorites((current) => next ? [...current, id] : current.filter((item) => item !== id));
    try { await saveFavorite(user.uid, id, next); } catch (error) { toast(error.message, { type: "error" }); }
  }

  function savedTypeForProduct(product) {
    const itemType = String(product?.itemType || "").toLowerCase();
    if (["event", "ticket"].includes(itemType) || selectedArchetype.id === "ticketing_events") return "event";
    if (["service", "appointment", "booking", "activity", "stay"].includes(itemType) || ["appointments_services", "accommodation_activities"].includes(selectedArchetype.id)) return "service";
    return "product";
  }

  function isSavedResult(result) {
    if (result?.type === "business") return favorites.includes(result.entityId || result.id);
    return savedItems.some((item) => item.type === result?.type && item.entityId === (result?.entityId || result?.id));
  }

  function rememberSearch(value) {
    const term = String(value || "").trim();
    if (term.length < 2) return;
    const next = [term, ...recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 8);
    setRecentSearches(next);
    writeState(RECENT_SEARCH_KEY, user, next, "local");
    track("search_submitted", { query_length: term.length, city: location.city || "", service: service || "all" });
  }

  function clearRecentSearches() {
    setRecentSearches([]);
    writeState(RECENT_SEARCH_KEY, user, [], "local");
  }

  async function toggleSavedResult(result) {
    if (!user || user.isAnonymous) return window.location.assign(`/login?next=${encodeURIComponent(`${basePath || "/"}?view=saved`)}`);
    if (result.type === "business") return toggleFavorite(result.entityId || result.id);
    const entityId = result.entityId || result.id;
    const saved = isSavedResult(result);
    try {
      if (saved) await deleteSavedItem(user.uid, result.type, entityId);
      else await saveSavedItem(user.uid, {
        type: result.type, entityId, businessId: result.businessId || result.business?.id || null,
        title: result.title || result.name, subtitle: result.subtitle || result.description || "", image: result.image || "",
        href: result.href || "", city: result.city || "", area: result.area || "", address: result.address || "",
        metadata: { category: result.category || "", itemType: result.itemType || "", currency: result.currency || "", price: result.price ?? null }
      });
      toast(saved ? "Removed from Saved." : "Saved for later.", { title: saved ? "Removed" : "Saved" });
    } catch (error) { toast(error.message, { type: "error", title: "Saved could not be updated" }); }
  }

  async function toggleSavedProduct(product) {
    const type = savedTypeForProduct(product);
    await toggleSavedResult({
      ...product, type, entityId: product.id, businessId: selected?.id || product.businessId,
      title: product.name, subtitle: [selected?.name, product.category].filter(Boolean).join(" · "),
      href: selected?.id ? `/?business=${selected.id}&offer=${product.id}` : ""
    });
  }

  async function openSearchResult(result) {
    rememberSearch(query);
    if (result.type === "business") { openBusiness(result); return; }
    const business = result.business || businesses.find((item) => item.id === result.businessId);
    if (business) {
      setSelected(business);
      setSelectedOffer(null);
      setTransactionOffer(null);
      setProductQuery("");
      setCategory("all");
      updateUrl("home", { business: business.id, order: null, service: null, offer: ["product", "service", "event"].includes(result.type) ? result.entityId : null });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (result.businessId) {
      try {
        const loaded = await loadPublicMarketplaceBusiness(result.businessId);
        if (loaded?.business) {
          setSelected(loaded.business);
          updateUrl("home", { business: loaded.business.id, order: null, service: null, offer: ["product", "service", "event"].includes(result.type) ? result.entityId : null });
        }
      } catch (error) { toast(error.message || "This result is not available right now.", { type: "error" }); }
    }
  }

  async function openSavedItem(item) {
    if (item.type === "place" && !item.businessId) {
      setLocation((current) => ({ ...current, city: item.city || current.city, area: item.area || item.address || "", coordinates: null }));
      openHome();
      return;
    }
    await openSearchResult({ ...item, id: item.entityId, entityId: item.entityId });
  }

  async function removeSavedItem(item) {
    if (!user?.uid) return;
    try {
      await deleteSavedItem(user.uid, item.type, item.entityId);
      toast("Removed from Saved.", { title: "Removed" });
    } catch (error) { toast(error.message, { type: "error", title: "Could not update Saved" }); }
  }

  async function payOrder(order) {
    try {
      const response = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: order.id, channel: "web" }) });
      if (response.redirectUrl) window.location.assign(response.redirectUrl);
    } catch (error) {
      toast(error.message, { type: "error" });
    }
  }

  function retryActivity(order) {
    if (!order) return;
    track("activity_retry_started", { transaction_type: activityKind(order), payment_state: String(order.paymentStatus || "unknown") });
    setActivityDetail(null);
    const productId = order.items?.[0]?.productId;
    if (productId && ["appointment", "booking", "ticket", "send"].includes(activityKind(order))) {
      router.push(`/item/${encodeURIComponent(productId)}`);
      return;
    }
    if (order.businessId) {
      router.push(`/place/${encodeURIComponent(order.businessId)}`);
      return;
    }
    openHome();
  }

  async function cancelActivity() {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      toast("Add a short cancellation reason.", { type: "error", title: "Reason required" });
      return;
    }
    setCancelling(true);
    try {
      if (cancelTarget.transactionType === "send" && cancelTarget.parcelJobId) {
        await authenticatedFetch("/api/customer/parcels", { method: "POST", body: JSON.stringify({ action: "cancel", parcelJobId: cancelTarget.parcelJobId, reason: cancelReason.trim() }) });
      } else {
        await authenticatedFetch("/api/orders/cancel", { method: "POST", body: JSON.stringify({ orderId: cancelTarget.id, reason: cancelReason.trim() }) });
      }
      track("activity_cancelled", { order_id: cancelTarget.id, transaction_type: cancelTarget.transactionType || cancelTarget.fulfilment || "order" });
      toast("This activity was cancelled.", { type: "success", title: "Cancelled" });
      setCancelTarget(null);
      setCancelReason("");
      setActivityDetail(null);
      updateUrl("activity", { order: null, business: null, service: null, offer: null });
    } catch (error) {
      toast(error.message || "This activity could not be cancelled.", { type: "error", title: "Could not cancel" });
    } finally {
      setCancelling(false);
    }
  }

  function openBusiness(business) {
    if (business?.id) {
      const nextRecent = [business.id, ...recentBusinessIds.filter((id) => id !== business.id)].slice(0, 8);
      setRecentBusinessIds(nextRecent);
      writeState(RECENT_BUSINESS_KEY, user, nextRecent, "local");
    }
    track("select_business", { business_id: business.id || "", city: location.city || "", area: location.area || "", service: service || "home" });
    setSelected(business);
    setSelectedOffer(null);
    setTransactionOffer(null);
    setProductQuery("");
    setCategory("all");
    updateUrl("home", { business: business.id, order: null, service, offer: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeBusiness() {
    setSelected(null);
    setSelectedOffer(null);
    setTransactionOffer(null);
    updateUrl("home", { business: null, order: null, service, offer: null });
  }

  function requestBranchChange(id) {
    if (id === selectedBranchId) return;
    if (cartItems.length) setPendingBranchId(id); else setSelectedBranchId(id);
  }

  function confirmBranchChange() {
    setCart({});
    setSelectedBranchId(pendingBranchId);
    setPendingBranchId("");
  }

  if (!authReady || !settingsReady) return <div className="flex min-h-screen items-center justify-center bg-[var(--surface)]"><LoaderCircle className="h-8 w-8 animate-spin text-violet" /></div>;
  if (maintenance) return <MarketplaceGate privateBeta={false} />;

  const serviceUnavailable = (service === "ride" && !ridesEnabled) || (service === "send" && !sendEnabled);
  const serviceLabel = service ? service[0].toUpperCase() + service.slice(1) : "Spotly";

  return <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center gap-3 px-4 sm:px-6">
        <button type="button" onClick={openHome} className="flex shrink-0 items-center gap-2.5 font-semibold">
          <Image src="/brand/spotly.svg" alt="" width={38} height={38} className="h-9 w-9" priority />
          <span className="hidden text-lg tracking-[-.025em] sm:block">Spotly</span>
        </button>

        <nav className="ml-3 hidden items-center gap-1 lg:flex" aria-label="Customer navigation">
          <button type="button" onClick={openHome} className={cn("rounded-full px-3.5 py-2 text-sm font-semibold", view === "home" && !selected ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>Home</button>
          <button type="button" onClick={() => updateUrl("activity", { business: null, order: null, service: null })} className={cn("rounded-full px-3.5 py-2 text-sm font-semibold", view === "activity" ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>Activity{orders.length ? ` ${orders.length}` : ""}</button>
          <button type="button" onClick={() => updateUrl("saved", { business: null, order: null, service: null })} className={cn("rounded-full px-3.5 py-2 text-sm font-semibold", view === "saved" ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>Saved</button>
        </nav>

        <div className="hidden min-w-0 flex-1 md:block">
          <button type="button" onClick={openSearch} className="mx-auto flex h-11 w-full max-w-[420px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 text-left text-sm text-[var(--text-3)] transition hover:bg-[var(--surface-hover)]"><Search className="h-4 w-4" /><span className="truncate">Search Spotly in {location.city}</span></button>
        </div>

        <button type="button" onClick={() => setLocationOpen((value) => !value)} className="ml-auto hidden max-w-[180px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold sm:flex"><MapPin className="h-4 w-4 text-[var(--accent)]" /><span className="truncate">{location.area || location.city}</span></button>
        <select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold sm:text-sm">{(selectedBranch ? acceptedCurrencies : settings.commerce?.currencies || ["USD"]).map((item) => <option key={item} value={item}>{item === "ZWG" ? "ZiG" : item}</option>)}</select>
        {user && !user.isAnonymous ? <NotificationBell workspace="customer" /> : null}
        <Button asChild variant="outline" size="sm"><Link href={user && !user.isAnonymous ? "/account" : `/login?next=${encodeURIComponent(basePath || "/")}`}>{user && !user.isAnonymous ? profile?.displayName?.split(" ")[0] || "Account" : "Sign in"}</Link></Button>
      </div>
      {locationOpen ? <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)]"><div className="mx-auto max-w-[1180px] px-4 py-3 sm:px-6"><LocationControl value={location} cities={launchCities} supportedAreas={settings.launch?.supportedAreas} onChange={setLocation} onLocate={locate} locating={locating} /></div></div> : null}
    </header>

    <main className="mx-auto max-w-[1180px] px-3 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-12">
      {!online ? <div role="status" className="mb-4 rounded-[18px] border border-[color-mix(in_srgb,var(--warning)_30%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm"><p className="font-semibold text-[var(--on-warning-soft)]">You’re offline</p><p className="mt-1 leading-6 text-[var(--text-2)]">You can keep viewing anything already loaded. Search, checkout, payments and updates will resume when your connection returns.</p></div> : null}
      {loadError && businesses.length ? <div role="status" className="mb-4 flex flex-col gap-3 rounded-[18px] border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold text-[var(--on-warning-soft)]">Marketplace refresh is delayed</p><p className="mt-1 leading-6 text-secondary">{loadError}</p></div><Button variant="outline" size="sm" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="h-4 w-4" />Retry</Button></div> : null}

      {selected ? (
        <BusinessDetailView
          business={selected}
          favorite={favorites.includes(selected.id)}
          onFavorite={toggleFavorite}
          onBack={closeBusiness}
          businessDetailLoading={businessDetailLoading}
          branchError={branchError}
          branches={branches}
          selectedBranchId={selectedBranchId}
          onBranchChange={requestBranchChange}
          locationNoun={locationNoun}
          catalogError={catalogError}
          branchProducts={branchProducts}
          visibleProducts={visibleProducts}
          categories={categories}
          category={category}
          setCategory={setCategory}
          productQuery={productQuery}
          setProductQuery={setProductQuery}
          archetype={selectedArchetype}
          isPickup={selectedIsPickup}
          currency={currency}
          cart={cart}
          onQuantityChange={changeQuantity}
          onOfferOpen={openOffer}
          cartItems={cartItems}
          cartTotal={cartTotal}
          onCheckout={() => { track("begin_checkout", { business_id: selected?.id || "", branch_id: selectedBranchId || "", currency, item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0) }); setCheckout(true); }}
        />
      ) : view === "home" && !service ? (
        loading && !businesses.length ? <div className="flex min-h-[55vh] flex-col items-center justify-center text-center"><SpotlyLottie name="marketplace-discover" mode="loop" eager className="h-28 w-28" fallback={<Store className="h-9 w-9 text-violet" />} /><p className="mt-4 text-sm font-semibold">Opening Spotly in {location.city}…</p><p className="mt-2 max-w-sm text-xs leading-5 text-[var(--text-3)]">Loading verified businesses and current availability.</p></div> : loadError && !businesses.length ? <LottieEmptyState name="marketplace-discover" title="Spotly could not load nearby businesses" description={loadError} action={<Button onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="h-4 w-4" />Reload</Button>} /> : <MarketplaceHome businessResults={businessResults} orders={orders} recentBusinessIds={recentBusinessIds} location={location} ridesEnabled={ridesEnabled} sendEnabled={sendEnabled} onSelectService={enterService} onOpenBusiness={openBusiness} onSearch={openSearch} onActivity={() => updateUrl("activity", { business: null, order: null, service: null })} onLocation={() => setLocationOpen(true)} />
      ) : view === "activity" ? (
        <section className="rounded-[26px] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-semibold text-[var(--accent)]">Activity</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Everything you have in motion</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Track active orders, upcoming bookings and tickets, completed activity, payments and anything that needs attention.</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href="/support?topic=orders">Get help</Link></Button><Button variant="outline" onClick={openHome}>Back to Home</Button></div>
          </div>
          {user && !user.isAnonymous && orders.length ? <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">{[
            ["all", "All"], ["orders", "Orders"], ["deliveries", "Deliveries"], ["bookings", "Bookings"], ["tickets", "Tickets"]
          ].map(([value,label]) => <button key={value} type="button" onClick={() => setActivityFilter(value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-sm font-semibold", activityFilter === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface)]")}>{label}</button>)}</div> : null}
          {!user || user.isAnonymous ? <EmptyState className="mt-6" icon={PackageCheck} title="Sign in to see your activity" description="Your orders, bookings, tickets and delivery progress stay tied to your Spotly account." action={<Button asChild><Link href={`/login?next=${encodeURIComponent(`${basePath || "/"}?view=activity`)}`}>Sign in</Link></Button>} /> : activityOrders.length ? <div className="mt-7 space-y-8">{[
            ["problem", "Needs attention", "Payment, fulfilment or another issue needs your attention."],
            ["active", "Active now", "Orders and deliveries currently moving."],
            ["upcoming", "Upcoming", "Bookings, appointments and tickets scheduled ahead."],
            ["past", "Past", "Completed, cancelled and resolved activity."]
          ].map(([bucket, title, description]) => activityGroups[bucket].length ? <section key={bucket}><div className="mb-3 flex items-end justify-between gap-3"><div><h2 className={cn("text-lg font-semibold", bucket === "problem" && "text-[var(--danger)]")}>{title}</h2><p className="mt-1 text-xs text-[var(--text-3)]">{description}</p></div><span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--text-3)]">{activityGroups[bucket].length}</span></div><div className="grid gap-4 lg:grid-cols-2">{activityGroups[bucket].map((order) => <OrderCard key={order.id} order={order} onPay={payOrder} onCancel={(record) => { setCancelTarget(record); setCancelReason(""); }} onOpen={(record) => { setActivityDetail(record); updateUrl("activity", { order: record.id, business: null, service: null, offer: null }); }} highlighted={order.id === requestedOrder} innerRef={(node) => { orderRefs.current[order.id] = node; }} />)}</div></section> : null)}</div> : <EmptyState className="mt-6" icon={PackageCheck} title={orders.length ? "Nothing in this filter" : "Nothing here yet"} description={orders.length ? "Choose another Activity filter." : "Your orders, bookings and other Spotly activity will appear here."} action={<Button onClick={orders.length ? () => setActivityFilter("all") : openHome}>{orders.length ? "Show all Activity" : "Explore Spotly"}</Button>} />}
        </section>
      ) : view === "search" ? (
        <CustomerSearchView
          query={query}
          onQuery={setQuery}
          results={searchResults}
          loading={searchLoading}
          error={searchError}
          filter={searchFilter}
          onFilter={setSearchFilter}
          counts={searchCounts}
          recentSearches={recentSearches}
          onRecent={(term) => { setQuery(term); rememberSearch(term); }}
          onClearRecent={clearRecentSearches}
          onOpenResult={openSearchResult}
          onSaveResult={toggleSavedResult}
          isSaved={isSavedResult}
          location={location}
          onLocation={() => setLocationOpen(true)}
          service={service}
          serviceLabel={serviceLabel}
          onClearService={() => updateUrl("search", { service: null })}
          onExplore={openHome}
        />
      ) : view === "saved" ? (
        <CustomerSavedView
          user={user}
          businessEntries={favoriteBusinesses.map((business) => ({ business, distance: null }))}
          savedItems={savedItems}
          onOpenBusiness={openBusiness}
          onOpenSavedItem={openSavedItem}
          onRemoveBusiness={toggleFavorite}
          onRemoveItem={removeSavedItem}
          onExplore={openHome}
          loginHref={`/login?next=${encodeURIComponent(`${basePath || "/"}?view=saved`)}`}
        />
      ) : (
        ["eat", "shop", "book", "events"].includes(service) ? <ServiceDiscoveryView service={service} location={location} currency={currency} favorites={favorites} savedItems={savedItems} orders={orders} onOpenBusiness={openBusiness} onOpenItem={openSearchResult} onToggleFavorite={toggleFavorite} onToggleSaved={toggleSavedResult} onHome={openHome} onSelectService={enterService} onSearchAll={openSearch} onLocation={() => setLocationOpen(true)} onActivity={() => updateUrl("activity", { business: null, order: null, service: null })} /> : <div>
          <ServiceModeHeader service={service} location={location} ridesEnabled={ridesEnabled} sendEnabled={sendEnabled} onSelectService={enterService} onExit={openHome} onSearch={openSearch} />
          {serviceUnavailable ? <section className="mt-5 rounded-[24px] bg-[var(--surface)] p-6 sm:p-8"><div className="max-w-2xl"><p className="text-sm font-semibold text-[var(--accent)]">Opening area by area</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">{serviceLabel} is not accepting requests here yet.</h2><p className="mt-3 text-sm leading-7 text-[var(--text-2)]">We will only switch this on when the matching driver operations, safety support, and local availability are ready. You can keep using Spotly’s live marketplace in the meantime.</p><div className="mt-5 flex flex-wrap gap-3"><Button onClick={openHome}>Explore Spotly</Button><Button variant="outline" asChild><Link href="/support">Get support</Link></Button></div></div></section> : <section className="mt-5 rounded-[24px] bg-[var(--surface)] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">{serviceLabel} in {location.area || location.city}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">Available nearby</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Choose a verified business to see its exact locations, published offerings, prices, and availability.</p></div><p className="text-sm text-[var(--text-3)]">{shownBusinesses.length} available</p></div>{loading ? <div className="flex items-center justify-center py-16"><LoaderCircle className="h-7 w-7 animate-spin text-violet" /></div> : shownBusinesses.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shownBusinesses.map(({ business, distance }) => <BusinessCard key={business.id} business={business} distance={distance} favorite={favorites.includes(business.id)} onFavorite={toggleFavorite} onOpen={openBusiness} />)}</div> : <LottieEmptyState className="mt-6" name="search-nearby" title={`No ${serviceLabel.toLowerCase()} businesses are live here yet`} description={`Try another area or use Search to browse everything currently available in ${location.city}.`} action={<Button onClick={openSearch}>Search Spotly</Button>} />}</section>}
        </div>
      )}
    </main>

    <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-8 text-sm text-[var(--text-3)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2"><Image src="/brand/spotly.svg" alt="" width={28} height={28} /><span>Spotly · Find it nearby. Get it done.</span></div>
        <div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/claim">For businesses</Link><Link href="/drive">Drive & deliver</Link><Link href="/support">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      </div>
    </footer>

    <nav className="safe-bottom fixed inset-x-2 bottom-2 z-40 flex h-16 items-center rounded-[22px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-2 shadow-elevated backdrop-blur-xl lg:hidden" aria-label="Mobile customer navigation">
      <button type="button" onClick={openHome} className={cn("flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold", view === "home" && !selected ? "text-[var(--accent)]" : "text-[var(--text-3)]")}><Store className="h-5 w-5" />Home</button>
      <button type="button" onClick={() => updateUrl("activity", { business: null, order: null, service: null })} className={cn("flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold", view === "activity" ? "text-[var(--accent)]" : "text-[var(--text-3)]")}><PackageCheck className="h-5 w-5" />Activity</button>
      <button type="button" onClick={() => updateUrl("saved", { business: null, order: null, service: null })} className={cn("flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold", view === "saved" ? "text-[var(--accent)]" : "text-[var(--text-3)]")}><Heart className="h-5 w-5" />Saved</button>
      <button type="button" onClick={openSearch} className={cn("flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold", view === "search" ? "text-[var(--accent)]" : "text-[var(--text-3)]")}><Search className="h-5 w-5" />Search</button>
    </nav>

    {selectedIsPickup && cartItems.length > 0 ? <motion.button initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: .98 }} type="button" onClick={() => setBasketOpen(true)} className="safe-bottom fixed inset-x-3 bottom-20 z-30 flex items-center gap-3 rounded-xl bg-[var(--accent)] px-4 py-3 text-left text-[var(--on-accent)] shadow-elevated lg:bottom-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface)]/15"><ShoppingBasket className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} items</span><span className="block text-xs text-[color-mix(in_srgb,var(--on-accent)_70%,transparent)]">View basket</span></span><span className="font-semibold">{formatCurrency(cartTotal, currency)}</span></motion.button> : null}

    <Overlay open={basketOpen} onClose={() => setBasketOpen(false)} title="Your basket" description={`${cartItems.length} products`} mode="sheet"><BasketContents cartItems={cartItems} cartTotal={cartTotal} currency={currency} onClose={() => setBasketOpen(false)} onCheckout={() => { track("begin_checkout", { business_id: selected?.id || "", branch_id: selectedBranchId || "", currency, item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0) }); setBasketOpen(false); setCheckout(true); }} /></Overlay>
    <Modal open={Boolean(pendingBranchId)} onClose={() => setPendingBranchId("")} title="Switch business location?" description="Products, prices and availability can differ by location." size="sm"><div className="p-5"><p className="text-sm leading-6 text-secondary">Switching will clear the current basket so you can build an accurate order for the new location.</p><div className="mt-5 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setPendingBranchId("")}>Keep this location</Button><Button className="flex-1" onClick={confirmBranchChange}>Switch and clear</Button></div></div></Modal>
    {selectedIsPickup ? <CheckoutModal open={checkout} onClose={() => setCheckout(false)} business={selected} branches={branches} selectedBranchId={selectedBranchId} cartItems={cartItems} currency={currency} user={user} defaultFulfilment={profile?.preferences?.defaultFulfilment || "pickup"} onComplete={(order) => { setCart({}); removeState(CART_KEY, user); updateUrl("activity", { order: order.orderId || order.id, business: null, service: null, offer: null }); }} /> : null}
    <ActivityDetailModal order={activityDetail} open={Boolean(activityDetail)} onClose={() => { setActivityDetail(null); updateUrl("activity", { order: null, business: null, service: null, offer: null }); }} onPay={payOrder} onRetry={retryActivity} onReview={(record) => { setActivityDetail(null); setReviewTarget(record); }} onCancel={(record) => { setActivityDetail(null); updateUrl("activity", { order: null, business: null, service: null, offer: null }); setCancelTarget(record); setCancelReason(""); }} />
    <ReviewModal order={reviewTarget} open={Boolean(reviewTarget)} onClose={() => setReviewTarget(null)} />
    <Modal open={Boolean(cancelTarget)} onClose={() => { if (!cancelling) { setCancelTarget(null); setCancelReason(""); } }} title="Cancel this activity?" description="Spotly will release any held availability when cancellation is still allowed." size="sm"><div className="p-5"><label className="block text-sm font-medium">Reason<textarea className="field-control mt-2 min-h-24 w-full" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Tell the business why you are cancelling" /></label><p className="mt-3 text-xs leading-5 text-[var(--text-3)]">Paid activity cannot be cancelled here. Use support if a payment has already been captured.</p><div className="mt-5 flex gap-3"><Button className="flex-1" variant="outline" disabled={cancelling} onClick={() => { setCancelTarget(null); setCancelReason(""); }}>Keep it</Button><Button className="flex-1" loading={cancelling} onClick={cancelActivity}>Cancel activity</Button></div></div></Modal>
    <OfferDetailModal product={selectedOffer} open={Boolean(selectedOffer)} onClose={closeOffer} currency={currency} archetype={selectedArchetype} quantity={selectedOffer ? (cart[selectedOffer.id] || 0) : 0} onQuantityChange={changeQuantity} onBook={startTransaction} branch={selectedBranch} saved={selectedOffer ? savedItems.some((item) => item.type === savedTypeForProduct(selectedOffer) && item.entityId === selectedOffer.id) : false} onSave={toggleSavedProduct} />
    <CustomerTransactionModal open={Boolean(transactionOffer)} onClose={() => setTransactionOffer(null)} product={transactionOffer} business={selected} branches={branches} selectedBranchId={selectedBranchId} currency={currency} user={user} archetype={selectedArchetype} onComplete={(order) => { track("booking_created", { order_id: order.orderId || "", business_id: selected?.id || "", branch_id: selectedBranchId || "", transaction_type: order.transactionType || selectedArchetype.id }); }} />
  </div>;
}
