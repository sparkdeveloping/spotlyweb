"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Banknote, CarFront, CheckCircle2, ChevronRight, Clock3, CreditCard, LocateFixed, LoaderCircle, MapPin, Navigation, Phone, RefreshCw, Search, ShieldCheck, UsersRound, X } from "lucide-react";
import { saveRideGuestDraft, consumeRideGuestDraft } from "@/lib/ride-guest-draft";
import { CustomerShell } from "@/components/customer-shell";
import { ServiceArtwork } from "@/components/service-artwork";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, Card, EmptyState, Modal, StatusBadge } from "@/components/ui";
import { authenticatedFetch, publicApiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import {PinDropMap,RoadRouteMap} from "@/components/mobility-map";
import { validateRideLabLocations } from "@/lib/ride-lab-validation";

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
  pickup_verification: ["Confirm pickup", "Tell the Driver your 6-digit pickup PIN only when you are together."],
  no_show_review:["Pickup under review","The Driver reported a no-show. Operations will review the event without assuming a cancellation fee."],
  in_trip: ["On your way", "Your ride is in progress."],
  driver_arrived_dropoff: ["Destination reached", "The Driver will complete the trip after drop-off."],
  completed: ["Ride complete", "Thanks for riding with Spotly."],
  cancelled: ["Ride cancelled", "This ride is no longer active."],
  failed: ["Ride needs attention", "Spotly could not complete this ride."],
};

function LocationSearch({ label, value, onChange, point, onSelect, city = "Harare", country="ZW", currentLocation = false }) {
  const [results, setResults] = useState([]); const [loading, setLoading] = useState(false); const [searchError,setSearchError]=useState(""); const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    let active=true;
    if (!value || value.trim().length < 3 || point?.formattedAddress === value) { setResults([]);setSearchError(""); return undefined; }
    setSearchError("");
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data=await publicApiFetch(`/api/public/geocode?q=${encodeURIComponent(value.trim())}&city=${encodeURIComponent(city)}&country=${country}`);
        if(active){setResults(data.results||[]);if(!data.results?.length)setSearchError("No matching address found. Refine the search or drop a pin on the map.");}
      } catch(error) {
        if(active){setResults([]);setSearchError(error?.message||"Address search is unavailable. Try the map pin if configured.");}
      } finally {if(active)setLoading(false);}
    }, 420);
    return () => {active=false;clearTimeout(timer.current);};
  }, [value, point?.formattedAddress, city,country]);
  return <div className="relative"><label className="block text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-3)]">{label}</label><div className="mt-2 flex items-center gap-2 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-3"><MapPin className="h-5 w-5 shrink-0 text-[var(--accent)]" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label === "Pickup" ? "Where should we pick you up?" : "Where are you going?"} className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none" />{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-[var(--text-3)]" /> : value ? <button onClick={() => { onChange(""); onSelect(null); }} aria-label={`Clear ${label}`}><X className="h-4 w-4 text-[var(--text-3)]" /></button> : null}{currentLocation ? <button type="button" onClick={currentLocation} className="rounded-[12px] p-2 text-[var(--accent)] hover:bg-[var(--accent-soft)]" aria-label="Use current location"><LocateFixed className="h-5 w-5" /></button> : null}</div>{results.length ? <div className="surface absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[16px] shadow-elevated">{results.map((item) => <button key={item.id} type="button" onClick={() => { onChange(item.label); onSelect({ lat: item.lat, lng: item.lng, label: item.label.split(",")[0], formattedAddress: item.label, area: item.area, city: item.city, country:item.country }); setResults([]); }} className="flex w-full items-start gap-3 border-b border-[var(--border-subtle)] p-3 text-left last:border-0 hover:bg-[var(--surface-hover)]"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" /><span><span className="block text-sm font-semibold">{item.label.split(",")[0]}</span><span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-[var(--text-3)]">{item.label}</span></span></button>)}</div> : null}
   {point?.formattedAddress===value?<p className="mt-2 flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5"/>Location confirmed for fare calculation</p>:
     searchError?<p role="alert" className="mt-2 text-xs text-danger">{searchError}</p>:
     value?.trim().length>=3&&!loading?<p className="mt-2 text-xs text-[var(--text-3)]">Select a suggested address or choose a location on the map to continue.</p>:null}
  </div>;
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
      <RoadRouteMap pickup={ride.pickup} dropoff={ride.dropoff} path={ride.quote?.routePath||[]} driverLocation={ride.driverLocation} driverUpdatedAt={ride.driverLocationUpdatedAt}/>
      <div className="mt-5 flex items-center justify-between rounded-[16px] bg-[var(--surface-2)] p-4"><div><p className="text-xs text-[var(--text-3)]">Estimated fare</p><p className="mt-1 text-xl font-semibold">{formatCurrency(ride.quote?.total || 0, ride.currency || "USD")}</p><p className="mt-1 text-xs text-[var(--text-3)]">{ride.quote?.distanceKm || 0} km · about {ride.quote?.durationMinutes || 0} min · {ride.paymentMethod === "cash" ? "Cash" : "Paynow"}</p></div><CarFront className="h-6 w-6 text-[var(--accent)]" /></div>
      {ride.paymentMethod==="paynow"&&ride.paymentStatus!=="paid"&&<p className="mt-3 rounded-xl border p-4 text-sm">This ride is not paid. After drop-off, complete Paynow payment from Activity. Driver earnings remain held until verified provider capture.</p>}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Button asChild variant="outline" className="flex-1"><a href={mapsHref} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" />View destination</a></Button><Button asChild variant="outline" className="flex-1"><Link href={`/support?topic=ride&ride=${encodeURIComponent(ride.id)}`}><ShieldCheck className="h-4 w-4" />Safety & support</Link></Button>{canCancel ? <Button variant="outline" className="flex-1" onClick={() => onCancel(ride)}>Cancel ride</Button> : null}</div>
    </div></Card></div>;
}

export function RideApp() {
  const { user, profile, authReady } = useAuth(); const { settings } = usePlatform(); const { toast } = useToast();
  const ridesEnabled = typeof settings?.mobility?.ridesEnabled === "boolean" ? settings.mobility.ridesEnabled : settings?.launch?.ridesEnabled === true;
  const cashEnabled = settings?.mobility?.cashEnabled !== false; const paynowEnabled = settings?.integrations?.paynowEnabled === true && (settings?.commerce?.paymentMethods || []).includes("paynow");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rideLabAllowed, setRideLabAllowed] = useState(false);
  const [rideLabTrips, setRideLabTrips] = useState([]);
  const [rideLabBusy, setRideLabBusy] = useState("");
  const [rideLabError, setRideLabError] = useState("");
  const loadRideLab = useCallback(async () => {
    try {
      const result = await authenticatedFetch("/api/mobility/ride-lab", { cache: "no-store" });
      setRideLabTrips(result.myTrips || []); setRideLabError("");
    } catch (err) { setRideLabError(err.message || "Could not load simulated rides."); }
  }, []);
  useEffect(() => {
    if (!authReady || !user?.uid || user.isAnonymous) return undefined;
    let active = true;
    authenticatedFetch("/api/driver/ride-lab", { cache: "no-store" })
      .then((result) => {
        if (!active) return;
        setRideLabAllowed(Boolean(result.allowed));
        if (result.allowed) loadRideLab();
      }).catch(() => { if (active) setRideLabAllowed(false); });
    return () => { active = false; };
  }, [authReady, user?.uid, user?.isAnonymous, loadRideLab]);

  async function testRide(action, rideId = "") {
    if (action === "request") {
      const validation = validateRideLabLocations(pickup, dropoff);
      if (!validation.ok) { setRideLabError(validation.error); return; }
    }
    setRideLabBusy(action); setRideLabError("");
    try {
      const body = action === "request" ? { action, pickup, dropoff, serviceType } : { action, rideId };
      await authenticatedFetch("/api/mobility/ride-lab", {
        method: "POST", body: JSON.stringify(body)
      });
      await loadRideLab();
      toast("Simulated Ride Lab request updated. No real booking or payment occurred.", { type: "info" });
    } catch (err) { setRideLabError(err.message || "The simulated Ride could not be updated."); }
    finally { setRideLabBusy(""); }
  }

  const [bookingStep, setBookingStep] = useState(0); const [bookingError, setBookingError] = useState("");
  const [resumeNotice, setResumeNotice] = useState("");
  const resumeCheckedRef = useRef(false);
  const bookingErrorRef = useRef(null);
  useEffect(() => {
    if (bookingError) bookingErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [bookingError]);
  const [city,setCity]=useState(settings?.launch?.primaryCity||"Harare");
  const [country,setCountry]=useState(settings?.launch?.primaryCountry==="MW"?"MW":"ZW");
  const [pickupText, setPickupText] = useState(""); const [dropoffText, setDropoffText] = useState(""); const [pickup, setPickup] = useState(null); const [dropoff, setDropoff] = useState(null);
  const rideLabLocationValidation = validateRideLabLocations(pickup, dropoff);
  useEffect(() => { setRideLabError(""); }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, pickup?.country, dropoff?.country]);
  useEffect(() => {
    if (!authReady || !user?.uid || user.isAnonymous || resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;
    const draft = consumeRideGuestDraft(window.sessionStorage);
    if (!draft) return;
    setPickup(draft.pickup); setDropoff(draft.dropoff);
    setPickupText(draft.pickup.formattedAddress || draft.pickup.label || "");
    setDropoffText(draft.dropoff.formattedAddress || draft.dropoff.label || "");
    setCountry(draft.pickup.country); setCity(draft.pickup.city || "Harare");
    setServiceType(draft.serviceType);
    setBookingStep(2); setPreviewOpen(true); setQuote(null);
    setResumeNotice("Your pickup and destination are restored. See a fresh fare before confirming your ride.");
  }, [authReady, user?.uid, user?.isAnonymous]);
  function continueToAccount(mode = "signin") {
    if (pickup && dropoff) saveRideGuestDraft(window.sessionStorage, { pickup, dropoff, serviceType });
    window.location.assign("/login?portal=customer&mode=" + encodeURIComponent(mode) + "&next=%2Fride");
  }
  const [mapTarget,setMapTarget]=useState(null); const [serviceType, setServiceType] = useState("economy"); const [paymentMethod, setPaymentMethod] = useState("cash"); const [quote, setQuote] = useState(null); const [loading, setLoading] = useState(""); const [activeRide, setActiveRide] = useState(null); const [history, setHistory] = useState([]); const [cancelRide, setCancelRide] = useState(null); const [cancelReason, setCancelReason] = useState("");
  const load = useCallback(async ({ quiet = false } = {}) => { if (!user?.uid || user.isAnonymous) return; if (!quiet) setLoading("load"); try { const data = await authenticatedFetch("/api/customer/rides", { cache: "no-store" }); setActiveRide(data.activeRide || null); setHistory(data.rides || []); } catch (error) { if (!quiet) toast(error.message, { type: "error" }); } finally { if (!quiet) setLoading(""); } }, [user, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!cashEnabled && paynowEnabled) setPaymentMethod("paynow"); else if (cashEnabled && paymentMethod === "paynow" && !paynowEnabled) setPaymentMethod("cash"); }, [cashEnabled, paynowEnabled, paymentMethod]);
  useEffect(() => { if (!activeRide?.id) return undefined; const timer = window.setInterval(async () => { try { const data = await authenticatedFetch(`/api/customer/rides?rideId=${encodeURIComponent(activeRide.id)}`, { cache: "no-store" }); const next = data.ride || null; setActiveRide(["completed", "cancelled", "failed"].includes(next?.state) ? null : next); if (["completed", "cancelled", "failed"].includes(next?.state)) load({ quiet: true });
      if(next?.state==="searching_driver")await authenticatedFetch("/api/customer/rides/refresh",{
       method:"POST",body:JSON.stringify({rideId:next.id})
      }).catch(()=>{}); } catch {} }, 8000); return () => clearInterval(timer); }, [activeRide?.id, load]);

  function useCurrentPickup() {
    if (!navigator.geolocation) return toast("This browser cannot access your location.", { type: "error" });
    setLoading("location"); navigator.geolocation.getCurrentPosition(async (position) => {
      try{
       const verified=await publicApiFetch(`/api/public/reverse-geocode?lat=${encodeURIComponent(position.coords.latitude)}&lng=${encodeURIComponent(position.coords.longitude)}`);
       setPickup({...verified.location,accuracy:position.coords.accuracy});setQuote(null);
       setPickupText(verified.location.formattedAddress);
       setCity(verified.location.city);setCountry(verified.location.country);
      }catch(e){toast(e.message||"Select your pickup address from search.",{type:"error"});}
      finally{setLoading("");}
     }, () => { setLoading(""); toast("Turn on location access and try again.", { type: "error" }); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
  }

  async function getQuote() {
    if (!pickup || !dropoff) return toast("Choose both a pickup point and destination.", { type: "error" });
    setLoading("quote"); try { const quoteFetch = user?.uid && !user.isAnonymous ? authenticatedFetch : publicApiFetch; const data = await quoteFetch("/api/customer/rides/quote", { method: "POST", body: JSON.stringify({ pickup, dropoff, serviceType }) }); setQuote({...data.quote,bookingAvailable:data.bookingAvailable===true,bookingReason:data.bookingReason||""}); setBookingStep(3); } catch (error) { setBookingError(error.message||"The fare estimate is unavailable."); toast(error.message, { type: "error" }); } finally { setLoading(""); }
  }
  useEffect(() => { setQuote(null); }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, serviceType,city,country]);

  async function requestRide() {
    if (!quote || !pickup || !dropoff) return;
    if (!authReady || !user?.uid || user.isAnonymous) return continueToAccount("signin");
    if(quote.bookingAvailable!==true)return toast(quote.bookingReason||"Ride bookings are not accepting requests yet.",{type:"error"});
    setLoading("request"); try { const data = await authenticatedFetch("/api/customer/rides", { method: "POST", body: JSON.stringify({ action: "request", pickup, dropoff, serviceType, paymentMethod, quotedTotal:quote.total,quotedCurrency:quote.currency, riderName: profile?.displayName || user?.displayName || "", riderPhone: profile?.phone || user?.phoneNumber || "" }) }); toast("Your ride request is live.", { title: "Finding a Driver" }); const next = await authenticatedFetch(`/api/customer/rides?rideId=${encodeURIComponent(data.rideId)}`, { cache: "no-store" }); setActiveRide(next.ride); setQuote(null); } catch (error) { toast(error.message, { type: "error", title: "Ride could not be requested" }); } finally { setLoading(""); }
  }
  async function confirmCancel() { if (!cancelRide || cancelReason.trim().length < 3) return; setLoading("cancel"); try { await authenticatedFetch("/api/customer/rides", { method: "POST", body: JSON.stringify({ action: "cancel", rideId: cancelRide.id, reason: cancelReason.trim() }) }); setCancelRide(null); setCancelReason(""); setActiveRide(null); await load({ quiet: true }); toast("Ride cancelled."); } catch (error) { toast(error.message, { type: "error" }); } finally { setLoading(""); } }

  if (activeRide) return <CustomerShell immersive><ActiveRide ride={activeRide} onRefresh={() => load({ quiet: true })} onCancel={setCancelRide} /></CustomerShell>;

  if (!ridesEnabled && !previewOpen) return <CustomerShell current="home" user={user} profile={profile} locationLabel={city}>
    <section className="mx-auto max-w-4xl py-8 sm:py-16">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_300px]">
        <div><p className="text-sm font-semibold text-[var(--accent)]">Spotly Ride</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Ride is coming to {city} carefully, not halfway.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-2)]">The ride request, Driver dispatch, trip lifecycle and operations system are installed. Customer requests open only when approved Driver coverage and local support are ready.</p><div className="mt-7 flex flex-wrap gap-3"><Button asChild><Link href="/">Explore what is live</Link></Button><Button variant="outline" onClick={()=>setPreviewOpen(true)}>Preview a fare</Button>{rideLabAllowed?<Button variant="outline" onClick={()=>{setPreviewOpen(true);setBookingStep(3);}}>Open my test rides</Button>:null}<Button asChild variant="outline"><Link href="/support?topic=ride">Ask about Ride</Link></Button></div></div>
        <div className="relative min-h-[250px] overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#5142c4,#7567e8)] p-6 text-[var(--service-foreground)]"><ServiceArtwork service="ride" className="absolute inset-0 h-full w-full" /><div className="relative z-10 flex h-full min-h-[200px] items-end"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[color-mix(in_srgb,var(--service-foreground)_70%,transparent)]">Not yet available here</p><p className="mt-2 text-xl font-semibold">We will only switch this on when the full ride is ready.</p></div></div></div>
      </div>
    </section>
  </CustomerShell>;

  return <CustomerShell current="home" user={user} profile={profile} locationLabel={city} mainClassName="max-w-[1180px]">
      {resumeNotice && <p role="status" className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--text)]">{resumeNotice}</p>}
      {!ridesEnabled ? <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-secondary">Fare preview only. Ride booking is still disabled until approved Drivers, dispatch and local support are verified.</div> : null}
      <section className="mx-auto grid max-w-3xl gap-6 pb-10">
        <div>
          <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#5142c4,#7567e8)] px-5 py-7 text-[var(--service-foreground)] sm:px-7 sm:py-9">
            <ServiceArtwork service="ride" className="absolute right-0 top-0 h-full w-[45%] opacity-90" />
            <div className="relative z-10 max-w-xl"><p className="text-sm font-semibold text-[color-mix(in_srgb,var(--service-foreground)_75%,transparent)]">Ride</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Where to?</h1><p className="mt-3 text-sm leading-6 text-[color-mix(in_srgb,var(--service-foreground)_80%,transparent)]">Set the exact pickup and destination. Spotly shows the estimate before any Driver is requested.</p></div>
          </div>

          <nav aria-label="Ride booking steps" className="mt-6 grid grid-cols-4 gap-2">
            {["Pickup", "Destination", "Vehicle", "Review"].map((name,index)=><button type="button" key={name}
              disabled={index > bookingStep}
              onClick={()=>{setBookingStep(index);setBookingError("");}}
              className={cn("rounded-xl border px-2 py-3 text-center text-xs font-semibold transition sm:text-sm",bookingStep===index?"border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]":"border-[var(--border)] text-secondary",index>bookingStep&&"opacity-55")}>
              <span className="block text-[10px] font-semibold uppercase tracking-wide">0{index+1}</span>{name}
            </button>)}
          </nav>
          {bookingError ? <p ref={bookingErrorRef} role="alert" className="scroll-mt-28 mt-5 rounded-xl border border-danger bg-[var(--danger-soft)] p-4 text-sm text-danger">{bookingError}</p> : null}
          {bookingStep===0 ? <div className="mt-7 space-y-5">
            <div><h2 className="text-2xl font-semibold tracking-tight">Where should your Driver meet you?</h2><p className="mt-1 text-sm text-secondary">Search an address or use the map to confirm one exact pickup point.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase">Country
                <select className="field-control mt-2 h-12 w-full" value={country} onChange={e=>{
                  const next=e.target.value;setCountry(next);setCity(next==="MW"?"Lilongwe":"Harare");
                  setPickup(null);setDropoff(null);setPickupText("");setDropoffText("");setQuote(null);
                }}><option value="ZW">Zimbabwe</option><option value="MW">Malawi</option></select>
              </label>
              <label className="block text-xs font-semibold uppercase">City
                <input className="field-control mt-2 h-12 w-full" value={city} onChange={e=>{
                  setCity(e.target.value);setPickup(null);setDropoff(null);setPickupText("");setDropoffText("");setQuote(null);
                }} placeholder="Harare or Lilongwe" />
              </label>
            </div>
            <LocationSearch label="Pickup" value={pickupText} onChange={(value)=>{
              setPickupText(value);if(value!==pickup?.formattedAddress){setPickup(null);setQuote(null);}
            }} point={pickup} onSelect={place=>{setPickup(place);if(place)setPickupText(place.formattedAddress);setQuote(null);}} city={city} country={country} currentLocation={useCurrentPickup}/>
            <Button variant="outline" onClick={()=>setMapTarget("pickup")}><MapPin className="h-4 w-4"/>Choose pickup on map</Button>
            <Button className="w-full" size="lg" disabled={!pickup} onClick={()=>{setBookingError("");setBookingStep(1);}}>Continue to destination<ChevronRight className="h-4 w-4"/></Button>
          </div> : null}
          {bookingStep===1 ? <div className="mt-7 space-y-5">
            <div><h2 className="text-2xl font-semibold tracking-tight">Where are you going?</h2><p className="mt-1 text-sm text-secondary">Pickup: {pickup?.formattedAddress||"Not selected"} · Confirm your destination to continue.</p></div>
            <LocationSearch label="Destination" value={dropoffText} onChange={(value)=>{
              setDropoffText(value);if(value!==dropoff?.formattedAddress){setDropoff(null);setQuote(null);}
            }} point={dropoff} onSelect={place=>{setDropoff(place);if(place)setDropoffText(place.formattedAddress);setQuote(null);}} city={city} country={country}/>
            <Button variant="outline" onClick={()=>setMapTarget("dropoff")}><MapPin className="h-4 w-4"/>Choose destination on map</Button>
            <div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={()=>setBookingStep(0)}>Back</Button><Button disabled={!pickup||!dropoff} onClick={()=>{setBookingError("");setBookingStep(2);}}>Choose vehicle<ChevronRight className="h-4 w-4"/></Button></div>
          </div> : null}
          <PinDropMap open={Boolean(mapTarget)} label={mapTarget==="pickup"?"Confirm pickup location":"Confirm destination location"} country={country}
            initialPoint={mapTarget==="pickup"?pickup:dropoff} onClose={()=>setMapTarget(null)}
            onSelect={place=>{
              if(mapTarget==="pickup"){setPickup(place);setPickupText(place.formattedAddress);setCity(place.city);}
              else {setDropoff(place);setDropoffText(place.formattedAddress);}
              setQuote(null);
            }}/>
          {bookingStep===2 ? <div className="mt-7">
          <section className="border-t border-[var(--border-subtle)] pt-7"><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold">Choose your ride</p><p className="mt-1 text-sm text-[var(--text-3)]">Same route, different fit.</p></div></div><div className="mt-4 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">{rideTypes.map((type) => { const selected = serviceType === type.id; return <button key={type.id} onClick={() => {setServiceType(type.id);setQuote(null);}} className="flex w-full items-center gap-4 py-4 text-left transition hover:bg-[var(--surface-hover)]"><span className={cn("flex h-11 w-11 items-center justify-center rounded-[12px]", selected ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--surface-2)] text-[var(--accent)]")}><CarFront className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-semibold">{type.label}</strong><span className="mt-1 block text-xs text-[var(--text-3)]">{type.description} · {type.seats}</span></span>{selected ? <CheckCircle2 className="h-5 w-5 text-[var(--accent)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-3)]" />}</button>; })}</div></section>
          <div className="mt-7 grid grid-cols-2 gap-3"><Button variant="outline" onClick={()=>setBookingStep(1)}>Back</Button><Button size="lg" onClick={getQuote} loading={loading==="quote"} disabled={!pickup||!dropoff}>See fare<ChevronRight className="h-4 w-4"/></Button></div>
          </div> : null}
          {bookingStep===3 && rideLabAllowed ? <div className="mt-5 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[var(--accent)]">Invitation only · Ride Lab</p><h2 className="mt-2 text-lg font-semibold">Simulated rides</h2>
              <p className="mt-1 text-xs leading-5 text-secondary">No Driver dispatch, payment, cash, PIN, or operational verification. A second invited tester accepts in Driver Ride Lab. Refresh to view status and shadow location.</p></div>
              <Button size="sm" variant="outline" onClick={loadRideLab}><RefreshCw className="h-4 w-4"/>Refresh tests</Button>
            </div>
            {pickup&&dropoff ? <>
              <Button className="mt-4 w-full" loading={rideLabBusy==="request"} disabled={Boolean(rideLabBusy) || !rideLabLocationValidation.ok} onClick={()=>testRide("request")}>Create simulated Ride request</Button>
              {rideLabLocationValidation.ok
                ? <p className="mt-2 text-xs leading-5 text-secondary">Your two pins are {Math.round(rideLabLocationValidation.separationKm * 1000)} metres apart in a straight line. Ride Lab supports distinct pins at least 20 metres apart, up to 200 km. The fare preview uses driving distance.</p>
                : <div role="alert" className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="text-sm text-danger">{rideLabLocationValidation.error}</p>
                    <button type="button" className="mt-2 text-xs font-semibold text-[var(--accent)] underline underline-offset-2" onClick={()=>{setBookingStep(1);setQuote(null);}}>Edit destination</button>
                  </div>}
            </> : <p className="mt-3 text-sm text-secondary">To create a new test request, go through pickup and destination first.</p>}
            {rideLabError?<p role="alert" className="mt-3 text-sm text-danger">{rideLabError}</p>:null}
            <div className="mt-4 space-y-3">{rideLabTrips.filter(ride=>ride.customerId===user?.uid).map(ride=><div key={ride.id} className="rounded-xl border bg-[var(--surface)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{String(ride.state).replaceAll("_"," ")}</p>
                {!["cancelled","completed"].includes(ride.state)?<Button variant="outline" size="sm" loading={rideLabBusy==="cancel"} onClick={()=>testRide("cancel",ride.id)}>Cancel test</Button>:null}</div>
              <p className="mt-2 text-xs text-secondary">{ride.pickup?.label||"Pickup"} → {ride.dropoff?.label||"Destination"}</p>
              {ride.driverPosition?<div className="mt-3"><RoadRouteMap compact pickup={ride.pickup} dropoff={ride.dropoff} driverLocation={ride.driverPosition}/><p className="mt-1 text-xs text-secondary">Simulated Driver location · not live GPS</p></div>:null}
            </div>)}</div>
          </div> : null}
          {bookingStep===3 ? <div className="mt-7 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <h2 className="text-xl font-semibold">Review your journey</h2>
            <p className="mt-3 text-sm text-secondary"><strong>Pickup:</strong> {pickup?.formattedAddress||"Not selected"}</p>
            <p className="mt-2 text-sm text-secondary"><strong>Destination:</strong> {dropoff?.formattedAddress||"Not selected"}</p>
            <Button variant="ghost" className="mt-3" onClick={()=>{setBookingStep(1);setQuote(null);}}>Edit locations</Button>
          </div> : null}
        </div>

        {bookingStep===3 && <aside className="mt-1">
          <div className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-card"><p className="text-sm font-semibold">Your estimate</p>{quote ? <><div className="mt-5 flex items-end justify-between"><div><p className="text-3xl font-semibold tracking-[-.04em]">{formatCurrency(quote.total, quote.currency)}</p><p className="mt-1 text-xs text-[var(--text-3)]">{quote.distanceKm} km · about {quote.durationMinutes} min</p></div><Badge>{quote.serviceLabel}</Badge></div><div className="mt-4"><RoadRouteMap compact pickup={pickup} dropoff={dropoff} path={quote.routePath||[]}/></div><div className="mt-5 border-t border-[var(--border-subtle)] pt-4"><p className="text-xs font-semibold text-[var(--text-3)]">Payment</p><div className="mt-3 grid grid-cols-2 gap-2">{cashEnabled ? <button onClick={() => setPaymentMethod("cash")} className={cn("rounded-[12px] border p-3 text-left", paymentMethod === "cash" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]")}><Banknote className="h-4 w-4" /><p className="mt-2 text-sm font-semibold">Cash</p></button> : null}{paynowEnabled ? <button onClick={() => setPaymentMethod("paynow")} className={cn("rounded-[12px] border p-3 text-left", paymentMethod === "paynow" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]")}><CreditCard className="h-4 w-4" /><p className="mt-2 text-sm font-semibold">Paynow</p></button> : null}</div><p className="mt-3 text-xs leading-5 text-[var(--text-3)]">Paynow rides are paid from Activity after completion. Cash is collected by the Driver at drop-off.</p></div>
           {quote.bookingAvailable!==true?<p role="status" className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--text-2)]">
              This is an informational road-based estimate, not an available booking. {quote.bookingReason||"SpotlyRide is not accepting bookings yet."}
           </p>:null}
           {quote.bookingAvailable===true && (!authReady || !user?.uid || user.isAnonymous)
             ? <div className="mt-5 space-y-3"><p className="text-sm text-secondary">Ready to request your ride? Sign in or create your Spotly account. Your two selected locations will be restored after you return, and we'll refresh your fare.</p>
                 <div className="grid gap-2 sm:grid-cols-2"><Button onClick={()=>continueToAccount("signin")} disabled={!authReady}>Sign in to continue</Button><Button variant="outline" onClick={()=>continueToAccount("signup")} disabled={!authReady}>Create an account</Button></div>
               </div>
             : <Button className="mt-5 w-full" onClick={requestRide} loading={loading === "request"}
               disabled={quote.bookingAvailable!==true||(!cashEnabled&&!paynowEnabled)}>
               {quote.bookingAvailable===true?`Request ${quote.serviceLabel}`:"Bookings not yet available"}
             </Button>}</> : <div className="py-8 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-[var(--surface-2)] text-[var(--text-3)]"><Clock3 className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold">Your fare will appear here</p><p className="mt-1 text-xs leading-5 text-[var(--text-3)]">Choose both places and a ride type first.</p></div>}</div>
          <div className="mt-4 flex gap-3 border-t border-[var(--border-subtle)] pt-5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" /><div><p className="font-semibold">Ride with verification</p><p className="mt-1 text-xs leading-5 text-[var(--text-3)]">Approved Drivers, current location and a pickup PIN protect the handoff.</p></div></div>
          {history.length ? <div className="mt-6 border-t border-[var(--border-subtle)] pt-5"><div className="flex items-center justify-between"><p className="font-semibold">Recent rides</p><Link href="/activity" className="text-xs font-semibold text-[var(--accent)]">All activity</Link></div><div className="mt-2 divide-y divide-[var(--border-subtle)]">{history.slice(0,3).map((ride) => <div key={ride.id} className="flex items-center gap-3 py-3"><CarFront className="h-4 w-4 text-[var(--accent)]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{ride.dropoff?.label || ride.dropoff?.area || "Ride"}</p><p className="mt-0.5 text-xs capitalize text-[var(--text-3)]">{String(ride.state).replaceAll("_", " ")}</p></div><span className="text-sm font-semibold">{formatCurrency(ride.quote?.total || 0, ride.currency || "USD")}</span></div>)}</div></div> : null}
        </aside>}
      </section>
      <Modal open={Boolean(cancelRide)} onClose={() => { if (loading !== "cancel") { setCancelRide(null); setCancelReason(""); } }} title="Cancel this ride?" description="Your Driver may already be heading to you." size="sm"><div className="p-5"><label className="text-sm font-semibold">Reason<textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="field-control mt-2 min-h-24 w-full" placeholder="Tell us why you need to cancel" /></label><div className="mt-5 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => { setCancelRide(null); setCancelReason(""); }}>Keep ride</Button><Button className="flex-1" onClick={confirmCancel} loading={loading === "cancel"} disabled={cancelReason.trim().length < 3}>Cancel ride</Button></div></div></Modal>
    </CustomerShell>;

}
