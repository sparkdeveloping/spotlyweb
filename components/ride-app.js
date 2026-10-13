"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Banknote, CarFront, CheckCircle2, ChevronRight, Clock3, CreditCard, LocateFixed, LoaderCircle, MapPin, Navigation, Phone, RefreshCw, Search, ShieldCheck, UsersRound, X } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { CustomerShell } from "@/components/customer-shell";
import { ServiceArtwork } from "@/components/service-artwork";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, Card, EmptyState, Modal, StatusBadge } from "@/components/ui";
import { authenticatedFetch, publicApiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

const rideTypes = [
  { id: "economy", label: "Economy", description: "Everyday rides", seats: "Up to 4" },
  { id: "comfort", label: "Comfort", description: "More comfort", seats: "Up to 4" },
  { id: "xl", label: "XL", description: "More room", seats: "Up to 6" }
];

const stateCopy = {
  requested: ["Request received", "Spotly is preparing your ride."],
  searching_driver: ["Finding your Driver", "Nearby eligible Drivers are being offered your ride."],
  driver_assigned: ["Driver found", "Your Driver is getting ready to head to you."],
  driver_to_pickup: ["Driver is on the way", "Stay near the pickup point and keep your phone available."],
  driver_arrived_pickup: ["Driver has arrived", "Check the vehicle and Driver before getting in."],
  pickup_verification: ["Confirm pickup", "Tell the Driver your 4-digit pickup PIN only when you are together."],
  in_trip: ["On your way", "Your ride is in progress."],
  driver_arrived_dropoff: ["Destination reached", "The Driver will complete the trip after drop-off."],
  completed: ["Ride complete", "Thanks for riding with Spotly."],
  cancelled: ["Ride cancelled", "This ride is no longer active."],
  failed: ["Ride needs attention", "Spotly could not complete this ride."],
};

function LocationSearch({ label, value, onChange, point, onSelect, city = "Harare", currentLocation = false }) {
  const [results, setResults] = useState([]); const [loading, setLoading] = useState(false); const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    if (!value || value.trim().length < 3 || point?.formattedAddress === value) { setResults([]); return undefined; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try { const data = await publicApiFetch(`/api/public/geocode?q=${encodeURIComponent(value.trim())}&city=${encodeURIComponent(city)}`); setResults(data.results || []); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 420);
    return () => clearTimeout(timer.current);
  }, [value, point?.formattedAddress, city]);
  return <div className="relative"><label className="block text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-3)]">{label}</label><div className="mt-2 flex items-center gap-2 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-3"><MapPin className="h-5 w-5 shrink-0 text-[var(--accent)]" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label === "Pickup" ? "Where should we pick you up?" : "Where are you going?"} className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none" />{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-[var(--text-3)]" /> : value ? <button onClick={() => { onChange(""); onSelect(null); }} aria-label={`Clear ${label}`}><X className="h-4 w-4 text-[var(--text-3)]" /></button> : null}{currentLocation ? <button type="button" onClick={currentLocation} className="rounded-[12px] p-2 text-[var(--accent)] hover:bg-[var(--accent-soft)]" aria-label="Use current location"><LocateFixed className="h-5 w-5" /></button> : null}</div>{results.length ? <div className="surface absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[16px] shadow-elevated">{results.map((item) => <button key={item.id} type="button" onClick={() => { onSelect({ lat: item.lat, lng: item.lng, label: item.label.split(",")[0], formattedAddress: item.label, area: item.area, city: item.city }); onChange(item.label); setResults([]); }} className="flex w-full items-start gap-3 border-b border-[var(--border-subtle)] p-3 text-left last:border-0 hover:bg-[var(--surface-hover)]"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" /><span><span className="block text-sm font-semibold">{item.label.split(",")[0]}</span><span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-[var(--text-3)]">{item.label}</span></span></button>)}</div> : null}</div>;
}

function RideTimeline({ state }) {
  const steps = ["searching_driver", "driver_to_pickup", "pickup_verification", "in_trip", "completed"];
  const normalized = state === "driver_assigned" ? "searching_driver" : state === "driver_arrived_pickup" ? "driver_to_pickup" : state === "driver_arrived_dropoff" ? "in_trip" : state;
  const activeIndex = Math.max(0, steps.indexOf(normalized));
  return <div className="mt-5 grid grid-cols-5 gap-1.5">{steps.map((step, index) => <span key={step} className={cn("h-1.5 rounded-full", index <= activeIndex ? "bg-[var(--accent)]" : "bg-[var(--border)]")} />)}</div>;
}

function ActiveRide({ ride, onRefresh, onCancel }) {
  const copy = stateCopy[ride.state] || [String(ride.state || "Ride").replaceAll("_", " "), "Your ride is updating."];
  const driver = ride.driver; const vehicle = driver?.vehicle;
  const canCancel = ["requested", "searching_driver", "driver_assigned", "driver_to_pickup", "driver_arrived_pickup", "pickup_verification"].includes(ride.state);
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${ride.dropoff?.lat},${ride.dropoff?.lng}`)}`;
  return <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6"><div className="flex items-center justify-between gap-4"><Button asChild variant="ghost"><Link href="/"><ArrowLeft className="h-4 w-4" />Home</Link></Button><Button variant="ghost" onClick={onRefresh}><RefreshCw className="h-4 w-4" />Refresh</Button></div><Card className="mt-4 overflow-hidden p-0"><div className="bg-[linear-gradient(145deg,#5142c4,#7567e8)] p-6 text-[var(--on-accent)] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[color-mix(in_srgb,var(--on-accent)_70%,transparent)]">{ride.number}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.045em]">{copy[0]}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[color-mix(in_srgb,var(--on-accent)_78%,transparent)]">{copy[1]}</p></div><span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[rgba(255,255,255,.15)]"><CarFront className="h-6 w-6" /></span></div><RideTimeline state={ride.state} /></div><div className="p-5 sm:p-6">{driver ? <div className="flex items-center gap-4 rounded-[16px] bg-[var(--surface-2)] p-4"><span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--accent-soft)] text-[var(--accent)]"><CarFront className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{driver.displayName || "Spotly Driver"}</p><p className="mt-1 text-sm text-[var(--text-2)]">{[vehicle?.color, vehicle?.make, vehicle?.model, vehicle?.registration].filter(Boolean).join(" · ") || "Driver vehicle"}</p></div>{driver.phone ? <a href={`tel:${driver.phone}`} className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[var(--border)]" aria-label="Call Driver"><Phone className="h-4 w-4" /></a> : null}</div> : <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><div className="flex items-center gap-3"><LoaderCircle className="h-5 w-5 animate-spin text-[var(--accent)]" /><div><p className="font-semibold">Matching with a Driver</p><p className="mt-1 text-sm text-[var(--text-2)]">Spotly only offers this ride to online eligible Drivers nearby.</p></div></div></div>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-[16px] border border-[var(--border)] p-4"><p className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-3)]">Pickup</p><p className="mt-2 font-semibold">{ride.pickup?.label || ride.pickup?.area || "Pickup"}</p><p className="mt-1 text-xs leading-5 text-[var(--text-3)]">{ride.pickup?.formattedAddress}</p></div><div className="rounded-[16px] border border-[var(--border)] p-4"><p className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-3)]">Destination</p><p className="mt-2 font-semibold">{ride.dropoff?.label || ride.dropoff?.area || "Destination"}</p><p className="mt-1 text-xs leading-5 text-[var(--text-3)]">{ride.dropoff?.formattedAddress}</p></div></div>
      {ride.pickupPin && ["driver_arrived_pickup", "pickup_verification"].includes(ride.state) ? <div className="mt-5 rounded-[16px] border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[var(--accent-soft)] p-5"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--on-accent-soft)]">Pickup PIN</p><p className="mt-2 font-mono text-4xl font-semibold tracking-[.2em] text-[var(--on-accent-soft)]">{ride.pickupPin}</p><p className="mt-2 text-xs leading-5 text-[var(--text-2)]">Only tell the Driver this PIN when you have checked the Driver and vehicle and are ready to start the ride.</p></div> : null}
      <div className="mt-5 flex items-center justify-between rounded-[16px] bg-[var(--surface-2)] p-4"><div><p className="text-xs text-[var(--text-3)]">Estimated fare</p><p className="mt-1 text-xl font-semibold">{formatCurrency(ride.quote?.total || 0, ride.currency || "USD")}</p><p className="mt-1 text-xs text-[var(--text-3)]">{ride.quote?.distanceKm || 0} km · about {ride.quote?.durationMinutes || 0} min · {ride.paymentMethod === "cash" ? "Cash" : "Paynow"}</p></div><CarFront className="h-6 w-6 text-[var(--accent)]" /></div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Button asChild variant="outline" className="flex-1"><a href={mapsHref} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" />View destination</a></Button><Button asChild variant="outline" className="flex-1"><Link href={`/support?topic=ride&ride=${encodeURIComponent(ride.id)}`}><ShieldCheck className="h-4 w-4" />Safety & support</Link></Button>{canCancel ? <Button variant="outline" className="flex-1" onClick={() => onCancel(ride)}>Cancel ride</Button> : null}</div>
    </div></Card></div>;
}

export function RideApp() {
  const { user, profile } = useAuth(); const { settings } = usePlatform(); const { toast } = useToast();
  const ridesEnabled = typeof settings?.mobility?.ridesEnabled === "boolean" ? settings.mobility.ridesEnabled : settings?.launch?.ridesEnabled === true;
  const cashEnabled = settings?.mobility?.cashEnabled !== false; const paynowEnabled = settings?.integrations?.paynowEnabled === true && (settings?.commerce?.paymentMethods || []).includes("paynow");
  const city = settings?.launch?.primaryCity || "Harare";
  const [pickupText, setPickupText] = useState(""); const [dropoffText, setDropoffText] = useState(""); const [pickup, setPickup] = useState(null); const [dropoff, setDropoff] = useState(null);
  const [serviceType, setServiceType] = useState("economy"); const [paymentMethod, setPaymentMethod] = useState("cash"); const [quote, setQuote] = useState(null); const [loading, setLoading] = useState(""); const [activeRide, setActiveRide] = useState(null); const [history, setHistory] = useState([]); const [cancelRide, setCancelRide] = useState(null); const [cancelReason, setCancelReason] = useState("");
  const load = useCallback(async ({ quiet = false } = {}) => { if (!user?.uid || user.isAnonymous) return; if (!quiet) setLoading("load"); try { const data = await authenticatedFetch("/api/customer/rides", { cache: "no-store" }); setActiveRide(data.activeRide || null); setHistory(data.rides || []); } catch (error) { if (!quiet) toast(error.message, { type: "error" }); } finally { if (!quiet) setLoading(""); } }, [user?.uid, user?.isAnonymous, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!cashEnabled && paynowEnabled) setPaymentMethod("paynow"); else if (cashEnabled && paymentMethod === "paynow" && !paynowEnabled) setPaymentMethod("cash"); }, [cashEnabled, paynowEnabled, paymentMethod]);
  useEffect(() => { if (!activeRide?.id) return undefined; const timer = window.setInterval(async () => { try { const data = await authenticatedFetch(`/api/customer/rides?rideId=${encodeURIComponent(activeRide.id)}`, { cache: "no-store" }); const next = data.ride || null; setActiveRide(["completed", "cancelled", "failed"].includes(next?.state) ? null : next); if (["completed", "cancelled", "failed"].includes(next?.state)) load({ quiet: true }); } catch {} }, 8000); return () => clearInterval(timer); }, [activeRide?.id, load]);

  function useCurrentPickup() {
    if (!navigator.geolocation) return toast("This browser cannot access your location.", { type: "error" });
    setLoading("location"); navigator.geolocation.getCurrentPosition((position) => { const value = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, label: "Current location", formattedAddress: "Current location", city }; setPickup(value); setPickupText("Current location"); setLoading(""); }, () => { setLoading(""); toast("Turn on location access and try again.", { type: "error" }); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
  }

  async function getQuote() {
    if (!pickup || !dropoff) return toast("Choose both a pickup point and destination.", { type: "error" });
    setLoading("quote"); try { const data = await authenticatedFetch("/api/customer/rides/quote", { method: "POST", body: JSON.stringify({ pickup, dropoff, serviceType }) }); setQuote(data.quote); } catch (error) { toast(error.message, { type: "error" }); } finally { setLoading(""); }
  }
  useEffect(() => { setQuote(null); }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, serviceType]);

  async function requestRide() {
    if (!quote || !pickup || !dropoff) return;
    setLoading("request"); try { const data = await authenticatedFetch("/api/customer/rides", { method: "POST", body: JSON.stringify({ action: "request", pickup, dropoff, serviceType, paymentMethod, riderName: profile?.displayName || user?.displayName || "", riderPhone: profile?.phone || user?.phoneNumber || "" }) }); toast("Your ride request is live.", { title: "Finding a Driver" }); const next = await authenticatedFetch(`/api/customer/rides?rideId=${encodeURIComponent(data.rideId)}`, { cache: "no-store" }); setActiveRide(next.ride); setQuote(null); } catch (error) { toast(error.message, { type: "error", title: "Ride could not be requested" }); } finally { setLoading(""); }
  }
  async function confirmCancel() { if (!cancelRide || cancelReason.trim().length < 3) return; setLoading("cancel"); try { await authenticatedFetch("/api/customer/rides", { method: "POST", body: JSON.stringify({ action: "cancel", rideId: cancelRide.id, reason: cancelReason.trim() }) }); setCancelRide(null); setCancelReason(""); setActiveRide(null); await load({ quiet: true }); toast("Ride cancelled."); } catch (error) { toast(error.message, { type: "error" }); } finally { setLoading(""); } }

  if (activeRide) return <CustomerShell immersive><ActiveRide ride={activeRide} onRefresh={() => load({ quiet: true })} onCancel={setCancelRide} /></CustomerShell>;

  if (!ridesEnabled) return <CustomerShell current="home" user={user} profile={profile} locationLabel={city}>
    <section className="mx-auto max-w-4xl py-8 sm:py-16">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_300px]">
        <div><p className="text-sm font-semibold text-[var(--accent)]">Spotly Ride</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Ride is coming to {city} carefully, not halfway.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-2)]">The ride request, Driver dispatch, trip lifecycle and operations system are installed. Customer requests open only when approved Driver coverage and local support are ready.</p><div className="mt-7 flex flex-wrap gap-3"><Button asChild><Link href="/">Explore what is live</Link></Button><Button asChild variant="outline"><Link href="/support?topic=ride">Ask about Ride</Link></Button></div></div>
        <div className="relative min-h-[250px] overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#5142c4,#7567e8)] p-6 text-[var(--service-foreground)]"><ServiceArtwork service="ride" className="absolute inset-0 h-full w-full" /><div className="relative z-10 flex h-full min-h-[200px] items-end"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[color-mix(in_srgb,var(--service-foreground)_70%,transparent)]">Not yet available here</p><p className="mt-2 text-xl font-semibold">We will only switch this on when the full ride is ready.</p></div></div></div>
      </div>
    </section>
  </CustomerShell>;

  return <AuthGate portal="customer" title="Sign in to request a ride">
    <CustomerShell current="home" user={user} profile={profile} locationLabel={city} mainClassName="max-w-[1180px]">
      <section className="grid gap-8 pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div>
          <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#5142c4,#7567e8)] px-5 py-7 text-[var(--service-foreground)] sm:px-7 sm:py-9">
            <ServiceArtwork service="ride" className="absolute right-0 top-0 h-full w-[45%] opacity-90" />
            <div className="relative z-10 max-w-xl"><p className="text-sm font-semibold text-[color-mix(in_srgb,var(--service-foreground)_75%,transparent)]">Ride</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Where to?</h1><p className="mt-3 text-sm leading-6 text-[color-mix(in_srgb,var(--service-foreground)_80%,transparent)]">Set the exact pickup and destination. Spotly shows the estimate before any Driver is requested.</p></div>
          </div>

          <div className="mt-7 space-y-4"><LocationSearch label="Pickup" value={pickupText} onChange={(value) => { setPickupText(value); if (value !== pickup?.formattedAddress) setPickup(null); }} point={pickup} onSelect={setPickup} city={city} currentLocation={useCurrentPickup} /><LocationSearch label="Destination" value={dropoffText} onChange={(value) => { setDropoffText(value); if (value !== dropoff?.formattedAddress) setDropoff(null); }} point={dropoff} onSelect={setDropoff} city={city} /></div>

          <section className="mt-8 border-t border-[var(--border-subtle)] pt-7"><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold">Choose your ride</p><p className="mt-1 text-sm text-[var(--text-3)]">Same route, different fit.</p></div></div><div className="mt-4 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">{rideTypes.map((type) => { const selected = serviceType === type.id; return <button key={type.id} onClick={() => setServiceType(type.id)} className="flex w-full items-center gap-4 py-4 text-left transition hover:bg-[var(--surface-hover)]"><span className={cn("flex h-11 w-11 items-center justify-center rounded-[12px]", selected ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--surface-2)] text-[var(--accent)]")}><CarFront className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-semibold">{type.label}</strong><span className="mt-1 block text-xs text-[var(--text-3)]">{type.description} · {type.seats}</span></span>{selected ? <CheckCircle2 className="h-5 w-5 text-[var(--accent)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-3)]" />}</button>; })}</div></section>
          <Button className="mt-7 w-full sm:w-auto" size="lg" onClick={getQuote} loading={loading === "quote"} disabled={!pickup || !dropoff}>See fare estimate<ChevronRight className="h-4 w-4" /></Button>
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-card"><p className="text-sm font-semibold">Your estimate</p>{quote ? <><div className="mt-5 flex items-end justify-between"><div><p className="text-3xl font-semibold tracking-[-.04em]">{formatCurrency(quote.total, quote.currency)}</p><p className="mt-1 text-xs text-[var(--text-3)]">{quote.distanceKm} km · about {quote.durationMinutes} min</p></div><Badge>{quote.serviceLabel}</Badge></div><div className="mt-5 border-t border-[var(--border-subtle)] pt-4"><p className="text-xs font-semibold text-[var(--text-3)]">Payment</p><div className="mt-3 grid grid-cols-2 gap-2">{cashEnabled ? <button onClick={() => setPaymentMethod("cash")} className={cn("rounded-[12px] border p-3 text-left", paymentMethod === "cash" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]")}><Banknote className="h-4 w-4" /><p className="mt-2 text-sm font-semibold">Cash</p></button> : null}{paynowEnabled ? <button onClick={() => setPaymentMethod("paynow")} className={cn("rounded-[12px] border p-3 text-left", paymentMethod === "paynow" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]")}><CreditCard className="h-4 w-4" /><p className="mt-2 text-sm font-semibold">Paynow</p></button> : null}</div><p className="mt-3 text-xs leading-5 text-[var(--text-3)]">Paynow rides are paid from Activity after completion. Cash is collected by the Driver at drop-off.</p></div><Button className="mt-5 w-full" onClick={requestRide} loading={loading === "request"} disabled={!cashEnabled && !paynowEnabled}>Request {quote.serviceLabel}</Button></> : <div className="py-8 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-[var(--surface-2)] text-[var(--text-3)]"><Clock3 className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold">Your fare will appear here</p><p className="mt-1 text-xs leading-5 text-[var(--text-3)]">Choose both places and a ride type first.</p></div>}</div>
          <div className="mt-4 flex gap-3 border-t border-[var(--border-subtle)] pt-5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" /><div><p className="font-semibold">Ride with verification</p><p className="mt-1 text-xs leading-5 text-[var(--text-3)]">Approved Drivers, current location and a pickup PIN protect the handoff.</p></div></div>
          {history.length ? <div className="mt-6 border-t border-[var(--border-subtle)] pt-5"><div className="flex items-center justify-between"><p className="font-semibold">Recent rides</p><Link href="/activity" className="text-xs font-semibold text-[var(--accent)]">All activity</Link></div><div className="mt-2 divide-y divide-[var(--border-subtle)]">{history.slice(0,3).map((ride) => <div key={ride.id} className="flex items-center gap-3 py-3"><CarFront className="h-4 w-4 text-[var(--accent)]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{ride.dropoff?.label || ride.dropoff?.area || "Ride"}</p><p className="mt-0.5 text-xs capitalize text-[var(--text-3)]">{String(ride.state).replaceAll("_", " ")}</p></div><span className="text-sm font-semibold">{formatCurrency(ride.quote?.total || 0, ride.currency || "USD")}</span></div>)}</div></div> : null}
        </aside>
      </section>
      <Modal open={Boolean(cancelRide)} onClose={() => { if (loading !== "cancel") { setCancelRide(null); setCancelReason(""); } }} title="Cancel this ride?" description="Your Driver may already be heading to you." size="sm"><div className="p-5"><label className="text-sm font-semibold">Reason<textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="field-control mt-2 min-h-24 w-full" placeholder="Tell us why you need to cancel" /></label><div className="mt-5 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => { setCancelRide(null); setCancelReason(""); }}>Keep ride</Button><Button className="flex-1" onClick={confirmCancel} loading={loading === "cancel"} disabled={cancelReason.trim().length < 3}>Cancel ride</Button></div></div></Modal>
    </CustomerShell>
  </AuthGate>;

}
