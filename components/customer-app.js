"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Heart,
  House,
  LocateFixed,
  MapPin,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Ticket,
  UserRound
} from "lucide-react";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Badge, Button, Card, EmptyState, ListRow, Modal, PageHeader, SearchField, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { customerCategories, events, initialBookings, places, quickSearches } from "@/data/customer";
import { portals } from "@/data/portals";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";

const customerTabs = [
  { id: "home", label: "Home", icon: House },
  { id: "search", label: "Search", icon: Search },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "saved", label: "Saved", icon: Heart },
  { id: "profile", label: "Profile", icon: UserRound }
];

function PlaceCard({ place, saved, onSave, onOpen }) {
  return (
    <motion.article whileHover={{ y: -3 }} className="surface group overflow-hidden rounded-[20px] shadow-card">
      <button onClick={() => onOpen(place)} className="block w-full text-left">
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image src={place.image} alt={place.name} fill className="object-cover transition duration-500 group-hover:scale-[1.035]" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/5" />
          <Badge className="absolute left-3 top-3 bg-white/92 text-gray-800 ring-0 dark:bg-black/70 dark:text-white" tone="neutral">{place.category}</Badge>
          <span className={cn("absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white", place.open ? "bg-green-600" : "bg-gray-700")}>{place.open ? "Open now" : "Closed"}</span>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[17px] font-semibold">{place.name}</h3>
              <p className="mt-1 line-clamp-1 text-sm text-secondary">{place.tagline}</p>
            </div>
            <span className="flex items-center gap-1 text-sm font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{place.rating}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-secondary">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{place.distance}</span>
            <span>{place.price}</span>
            <span>{place.eta}</span>
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2 border-t p-3">
        <Button size="sm" className="flex-1" onClick={() => onOpen(place)}>{place.action}</Button>
        <Button size="icon" variant="outline" aria-label={saved ? "Remove from saved" : "Save place"} onClick={() => onSave(place.id)}>
          <Heart className={cn("h-5 w-5", saved && "fill-red-500 text-red-500")} />
        </Button>
      </div>
    </motion.article>
  );
}

function EventCard({ event, onBook }) {
  return (
    <Card className="group min-w-[290px] overflow-hidden sm:min-w-0">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image src={event.image} alt={event.title} fill className="object-cover transition duration-500 group-hover:scale-[1.035]" sizes="(max-width: 768px) 82vw, 33vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <p className="text-sm font-semibold">{event.date} · {event.time}</p>
          <h3 className="mt-1 text-lg font-bold">{event.title}</h3>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-secondary">{event.location}</p>
          <p className="mt-1 font-semibold">From {formatCurrency(event.price)}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onBook(event)}>Tickets</Button>
      </div>
    </Card>
  );
}

function CustomerHome({ setView, savedIds, toggleSave, openPlace, addEventBooking }) {
  const [query, setQuery] = useState("");
  const filtered = query ? places.filter((place) => `${place.name} ${place.category} ${place.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())) : places.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#4E3FBF] via-[#6657D9] to-[#8B5CF6] px-5 py-8 text-white shadow-elevated sm:px-8 sm:py-12 lg:px-12">
        <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative grid items-end gap-8 lg:grid-cols-[1.3fr_.7fr]">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/80"><LocateFixed className="h-4 w-4" />Harare, Zimbabwe <ChevronRight className="h-4 w-4" /></div>
            <h1 className="mt-5 max-w-3xl text-[38px] font-bold leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[58px]">Everything worth doing, all in one spot.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">Discover trusted restaurants, groceries, events, beauty, wellness, healthcare, activities, and more.</p>
            <SearchField value={query} onChange={setQuery} placeholder="Search restaurants, events, services…" className="mt-7 max-w-2xl border-white/20 bg-white text-gray-900 shadow-lg" />
            {query && (
              <div className="mt-3 max-w-2xl rounded-2xl bg-white p-2 text-gray-900 shadow-elevated">
                {filtered.slice(0, 4).map((place) => (
                  <button key={place.id} onClick={() => openPlace(place)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-gray-100">
                    <Image src={place.image} alt="" width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{place.name}</span><span className="block truncate text-xs text-gray-500">{place.category} · {place.location}</span></span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="hidden rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Your evening</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-white/12 p-4"><p className="text-sm font-semibold">19:30 · Dinner reservation</p><p className="mt-1 text-sm text-white/70">Namaste Harare · Table for 2</p></div>
              <div className="rounded-2xl bg-white/12 p-4"><p className="text-sm font-semibold">21:30 · Sunset Jazz</p><p className="mt-1 text-sm text-white/70">The Venue · 2 tickets</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-9">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Explore</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">What are you looking for?</h2></div><button onClick={() => setView("search")} className="text-sm font-semibold text-[var(--accent)]">See all</button></div>
        <div className="no-scrollbar -mx-4 mt-5 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-8">
          {customerCategories.map((category) => (
            <button key={category.id} onClick={() => setView("search", category.id)} className="surface flex min-w-[105px] flex-col items-center rounded-2xl p-4 text-center shadow-card transition hover:-translate-y-0.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: category.tint }}>{category.emoji}</span>
              <span className="mt-3 text-sm font-semibold">{category.name}</span>
              <span className="mt-1 text-xs text-tertiary">{category.count} spots</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Recommended</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Popular near you</h2></div><button onClick={() => setView("search")} className="text-sm font-semibold text-[var(--accent)]">View more</button></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((place) => <PlaceCard key={place.id} place={place} saved={savedIds.includes(place.id)} onSave={toggleSave} onOpen={openPlace} />)}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">This week</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Events worth leaving the house for</h2></div><button onClick={() => setView("search")} className="text-sm font-semibold text-[var(--accent)]">All events</button></div>
        <div className="no-scrollbar -mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
          {events.map((event) => <EventCard key={event.id} event={event} onBook={addEventBooking} />)}
        </div>
      </section>
    </div>
  );
}

function CustomerSearch({ initialCategory, savedIds, toggleSave, openPlace }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory || "all");
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState("recommended");
  const filtered = useMemo(() => {
    let result = places.filter((place) => {
      const queryMatch = `${place.name} ${place.category} ${place.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase());
      const categoryMatch = category === "all" || place.category.toLowerCase().includes(category === "restaurants" ? "restaurant" : category.replace("s", ""));
      return queryMatch && categoryMatch && (!openOnly || place.open);
    });
    if (sort === "rating") result = [...result].sort((a, b) => b.rating - a.rating);
    if (sort === "distance") result = [...result].sort((a, b) => Number.parseFloat(a.distance) - Number.parseFloat(b.distance));
    return result;
  }, [query, category, openOnly, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="Search Spotly" description="Find trusted places, services, events, and experiences across your city." />
      <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <SearchField value={query} onChange={setQuery} placeholder="Search by name, category, or service" />
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="surface h-[52px] rounded-2xl bg-transparent px-4 text-sm font-medium outline-none"><option value="recommended">Recommended</option><option value="rating">Highest rated</option><option value="distance">Nearest first</option></select>
        <button onClick={() => setOpenOnly((value) => !value)} className={cn("surface flex h-[52px] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold", openOnly && "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]")}><SlidersHorizontal className="h-4 w-4" />Open now</button>
      </div>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setCategory("all")} className={cn("rounded-full border px-4 py-2 text-sm font-semibold", category === "all" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "surface")}>All</button>
        {customerCategories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={cn("rounded-full border px-4 py-2 text-sm font-semibold", category === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "surface")}>{item.name}</button>)}
      </div>
      <p className="mt-7 text-sm font-medium text-secondary">{filtered.length} results</p>
      {filtered.length ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((place) => <PlaceCard key={place.id} place={place} saved={savedIds.includes(place.id)} onSave={toggleSave} onOpen={openPlace} />)}</div> : <Card className="mt-4"><EmptyState icon={Search} title="No matching spots" description="Try a broader search or remove one of the active filters." /></Card>}
    </div>
  );
}

function BookingsView({ bookings }) {
  const [tab, setTab] = useState("upcoming");
  const visible = bookings.filter((booking) => tab === "past" ? booking.status === "Completed" : booking.status !== "Completed");
  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="Bookings & orders" description="Everything you have planned, reserved, or ordered through Spotly." />
      <Tabs className="mt-7" value={tab} onChange={setTab} tabs={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]} />
      <div className="mt-5 space-y-3">
        {visible.map((booking) => (
          <Card key={booking.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><CalendarDays className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{booking.business}</h3><StatusBadge status={booking.status} /></div><p className="mt-1 text-sm text-secondary">{booking.type}</p><p className="mt-2 flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-tertiary" />{booking.date} · {booking.time}</p></div>
            <div className="flex gap-2"><Button size="sm" variant="outline">Details</Button>{booking.status !== "Completed" && <Button size="sm" variant="secondary">Manage</Button>}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SavedView({ savedIds, toggleSave, openPlace, setView }) {
  const saved = places.filter((place) => savedIds.includes(place.id));
  return (
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="Saved" description="Your shortlist of places and experiences to return to." />
      {saved.length ? <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{saved.map((place) => <PlaceCard key={place.id} place={place} saved onSave={toggleSave} onOpen={openPlace} />)}</div> : <Card className="mt-7"><EmptyState icon={Heart} title="Nothing saved yet" description="Tap the heart on any place to keep it here." action={<Button onClick={() => setView("search")}>Explore Spotly</Button>} /></Card>}
    </div>
  );
}

function ProfileView() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="Profile" description="Manage your Spotly account, preferences, payments, and support." />
      <Card className="mt-7 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--accent)] text-xl font-bold text-white">TN</div>
        <div className="min-w-0 flex-1"><h2 className="text-xl font-semibold">Tinashe Nyatsanza</h2><p className="mt-1 text-sm text-secondary">tinashe@example.com · Harare</p><div className="mt-3 flex flex-wrap gap-2"><Badge tone="accent">Spotly member</Badge><Badge tone="success">Verified email</Badge></div></div>
        <Button variant="outline">Edit profile</Button>
      </Card>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden"><ListRow icon={ShoppingBag} title="Orders" subtitle="Track food and grocery orders" /><div className="mx-4 border-t" /><ListRow icon={CalendarDays} title="Bookings" subtitle="Reservations and appointments" /><div className="mx-4 border-t" /><ListRow icon={CreditCard} title="Payment methods" subtitle="Cards and mobile money" /><div className="mx-4 border-t" /><ListRow icon={Ticket} title="Promotions" subtitle="Offers and referral rewards" /></Card>
        <Card className="overflow-hidden"><ListRow icon={BellRing} title="Notifications" subtitle="Choose the updates you receive" /><div className="mx-4 border-t" /><ListRow icon={Settings} title="Preferences" subtitle="Appearance, interests, and city" /><div className="mx-4 border-t" /><ListRow icon={ShieldCheck} title="Privacy & security" subtitle="Account access and personal data" /><div className="mx-4 border-t" /><ListRow icon={CircleHelp} title="Help & support" subtitle="Get help with Spotly" /></Card>
      </div>
      <section className="mt-8"><h2 className="text-xl font-semibold">The Spotly app family</h2><p className="mt-1 text-sm text-secondary">Open another workspace in this same web platform.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{[portals.business, portals.driver, portals.admin].map((portal) => <Link key={portal.id} href={portal.href} className="surface flex items-center gap-3 rounded-2xl p-3 shadow-card hover:-translate-y-0.5"><Image src={portal.logo} alt="" width={48} height={48} className="h-12 w-12 rounded-2xl object-cover" /><span className="min-w-0"><span className="block font-semibold">{portal.name}</span><span className="mt-1 block truncate text-xs text-secondary">{portal.description}</span></span></Link>)}</div></section>
    </div>
  );
}

function CustomerNav({ view, setView }) {
  return (
    <>
      <div className="surface sticky top-20 z-20 hidden border-x-0 border-t-0 md:block">
        <nav className="mx-auto flex max-w-7xl items-center gap-1 px-6 py-2" aria-label="Customer sections">
          {customerTabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setView(tab.id)} className={cn("relative flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-secondary", view === tab.id && "text-[var(--accent-strong)]")}>
            {view === tab.id && <motion.span layoutId="customer-desktop-nav" className="absolute inset-0 rounded-xl bg-[var(--accent-soft)]" />}
            <Icon className="relative h-4 w-4" /><span className="relative">{tab.label}</span>
          </button>; })}
        </nav>
      </div>
      <nav className="surface safe-bottom fixed inset-x-0 bottom-0 z-30 flex min-h-[68px] justify-around border-x-0 border-b-0 px-2 pt-2 md:hidden">
        {customerTabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setView(tab.id)} className={cn("flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium", view === tab.id ? "text-[var(--accent)]" : "text-tertiary")}><Icon className={cn("h-5 w-5", tab.id === "saved" && savedFill(view, tab.id))} /><span>{tab.label}</span></button>; })}
      </nav>
    </>
  );
}

function savedFill(view, id) {
  return view === id ? "fill-current" : "";
}

export function CustomerApp({ initialView = "home" }) {
  const [view, setViewState] = useState(customerTabs.some((tab) => tab.id === initialView) ? initialView : "home");
  const [initialCategory, setInitialCategory] = useState("");
  const [savedIds, setSavedIds] = useState(["namaste-harare", "serenity-spa"]);
  const [bookings, setBookings] = useState(initialBookings);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const { toast } = useToast();

  function setView(next, category = "") {
    setInitialCategory(category);
    setViewState(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleSave(id) {
    setSavedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function reservePlace(place) {
    const next = { id: `bk-${Date.now()}`, business: place.name, type: place.action === "Order" || place.action === "Shop" ? "Order placed" : `${place.action} request`, date: "Today", time: "19:30", status: "Confirmed", amount: 0 };
    setBookings((current) => [next, ...current]);
    setSelectedPlace(null);
    toast(`${place.name} has been added to your bookings.`, { title: `${place.action} confirmed` });
  }

  function addEventBooking(event) {
    setBookings((current) => [{ id: `evt-${event.id}`, business: event.title, type: "Event tickets · 2 guests", date: event.date, time: event.time, status: "Confirmed", amount: event.price * 2 }, ...current]);
    toast(`Two tickets reserved for ${event.title}.`, { title: "Tickets confirmed" });
  }

  return (
    <PortalShell portalId="customer" activeSection={view} hideSidebar>
      <CustomerNav view={view} setView={setView} />
      <div className="pb-24 md:pb-0">
        {view === "home" && <CustomerHome setView={setView} savedIds={savedIds} toggleSave={toggleSave} openPlace={setSelectedPlace} addEventBooking={addEventBooking} />}
        {view === "search" && <CustomerSearch initialCategory={initialCategory} savedIds={savedIds} toggleSave={toggleSave} openPlace={setSelectedPlace} />}
        {view === "bookings" && <BookingsView bookings={bookings} />}
        {view === "saved" && <SavedView savedIds={savedIds} toggleSave={toggleSave} openPlace={setSelectedPlace} setView={setView} />}
        {view === "profile" && <ProfileView />}
      </div>
      <Modal open={Boolean(selectedPlace)} onClose={() => setSelectedPlace(null)} title={selectedPlace?.name || "Place details"} size="lg">
        {selectedPlace && (
          <div>
            <div className="relative aspect-[16/7] min-h-[230px]"><Image src={selectedPlace.image} alt={selectedPlace.name} fill className="object-cover" sizes="900px" /><div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" /><div className="absolute bottom-5 left-5 right-5 text-white"><div className="flex flex-wrap gap-2">{selectedPlace.tags.map((tag) => <Badge key={tag} className="bg-black/35 text-white ring-white/20">{tag}</Badge>)}</div><h2 className="mt-3 text-3xl font-bold">{selectedPlace.name}</h2><p className="mt-1 text-white/80">{selectedPlace.tagline}</p></div></div>
            <div className="p-5 sm:p-6">
              <div className="grid gap-5 md:grid-cols-[1fr_250px]">
                <div><div className="flex flex-wrap items-center gap-3 text-sm"><span className="flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{selectedPlace.rating} ({selectedPlace.reviews})</span><span className="text-secondary">{selectedPlace.price}</span><StatusBadge status={selectedPlace.open ? "Open now" : "Closed"} /></div><p className="mt-5 leading-7 text-secondary">{selectedPlace.description}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Location</p><p className="mt-2 text-sm font-medium">{selectedPlace.location}</p><p className="mt-1 text-xs text-secondary">{selectedPlace.distance} away</p></Card><Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Availability</p><p className="mt-2 text-sm font-medium">{selectedPlace.eta}</p><p className="mt-1 text-xs text-secondary">Verified Spotly partner</p></Card></div></div>
                <Card className="h-fit p-4"><p className="text-sm font-semibold">Ready to continue?</p><p className="mt-1 text-sm text-secondary">Complete the action now and manage it from Bookings.</p><Button className="mt-5 w-full" onClick={() => reservePlace(selectedPlace)}>{selectedPlace.action}</Button><Button className="mt-2 w-full" variant="outline" onClick={() => toggleSave(selectedPlace.id)}><Heart className={cn("h-4 w-4", savedIds.includes(selectedPlace.id) && "fill-red-500 text-red-500")} />{savedIds.includes(selectedPlace.id) ? "Saved" : "Save"}</Button><Button className="mt-2 w-full" variant="ghost"><Share2 className="h-4 w-4" />Share</Button></Card>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PortalShell>
  );
}
