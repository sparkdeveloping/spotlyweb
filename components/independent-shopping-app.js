"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock3, MapPin, Minus, Plus, Search, ShieldCheck, ShoppingBasket, Store, Truck } from "lucide-react";
import { authenticatedFetch, publicApiFetch } from "@/lib/api-client";
import { spotlyLoginUrl } from "@/lib/spotly-domains";

const format = (value, currency = "USD") => new Intl.NumberFormat("en-ZW", { style: "currency", currency }).format(Number(value || 0));
const disclosure = "Independent shopping service. Spotly is not affiliated with or endorsed by the shops listed here. A shopper would purchase your requested items in person. Prices and availability must be confirmed before any payment.";

export function IndependentShoppingApp() {
  const [result, setResult] = useState({ enabled: false, requestEnabled: false, stores: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [quantities, setQuantities] = useState({});
  const [form, setForm] = useState({ contactName: "", contactPhone: "", deliveryAddress: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const requestId = useRef(null);

  useEffect(() => {
    let active = true;
    publicApiFetch("/api/public/independent-shopping")
      .then((data) => { if (active) { setResult(data); const initial = new URLSearchParams(window.location.search).get("store"); if (initial && data.stores?.some((store) => store.id === initial)) setSelected(initial); } })
      .catch((error) => { if (active) setLoadError(error.message || "Could not load independent shopping."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const stores = useMemo(() => (result.stores || []).filter((store) =>
    !search.trim() || [store.name, store.city, store.area, ...store.items.map((item) => item.name)].join(" ").toLowerCase().includes(search.trim().toLowerCase())
  ), [result.stores, search]);
  const store = (result.stores || []).find((item) => item.id === selected);
  const items = useMemo(() => store ? store.items.filter((item) => Number(quantities[item.id] || 0) > 0).map((item) => ({
    itemId: item.id, quantity: Number(quantities[item.id]), name: item.name, price: item.priceEstimate
  })) : [], [store, quantities]);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const setQuantity = (id, change) => {
    setReceipt(null); setRequestError(""); requestId.current = null;
    setQuantities((current) => ({ ...current, [id]: Math.max(0, Math.min(10, Number(current[id] || 0) + change)) }));
  };
  async function submit(event) {
    event.preventDefault();
    if (!store || !items.length || !result.requestEnabled) return;
    setBusy(true); setRequestError("");
    if (!requestId.current) requestId.current = crypto.randomUUID().replaceAll("-", "");
    try {
      const response = await authenticatedFetch("/api/customer/independent-shopping/requests", {
        method: "POST",
        body: JSON.stringify({
          requestId: requestId.current, storeId: store.id,
          items: items.map(({ itemId, quantity }) => ({ itemId, quantity })),
          ...form
        })
      });
      setReceipt({ ...response, storeName: store.name });
    } catch (error) {
      setRequestError(error.message || "Your quote request could not be saved.");
    } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <div className="mx-auto max-w-[1140px] px-5 pb-24 pt-8 sm:px-8">
      <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--accent)]"><ArrowLeft className="h-4 w-4"/>Spotly Shop</Link>
      <section className="relative mt-6 overflow-hidden rounded-[28px] bg-[#191338] px-7 py-10 text-white sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-[#6657d9]/40 blur-[80px]" aria-hidden="true"/>
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/90"><ShoppingBasket className="h-4 w-4"/> A different way to shop</span>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-.05em] sm:text-6xl">You choose it. We shop for it.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/75">Explore independently researched items and request a shopper to buy what you need. We check prices before confirming any purchase.</p>
          <div className="mt-7 flex flex-wrap gap-4 text-xs font-medium text-white/80"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4"/> Clear affiliation</span><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4"/> Price checks</span><span className="inline-flex items-center gap-2"><Truck className="h-4 w-4"/> Shopper delivery when enabled</span></div>
        </div>
      </section>
      <section className="mt-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6">
        <p className="text-sm font-semibold">Important: independent, not partnered</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{disclosure}</p>
      </section>
      {loading ? <p className="mt-12 text-center text-[var(--text-2)]">Checking where shopping is available…</p>
        : loadError ? <p role="alert" className="mt-10 rounded-2xl border p-6 text-sm text-[var(--danger)]">{loadError}</p>
        : !result.enabled ? <div className="mt-10 rounded-2xl border bg-[var(--surface)] px-7 py-12 text-center"><Store className="mx-auto h-10 w-10 text-[var(--text-3)]"/><h2 className="mt-4 text-2xl font-semibold">Independent shopping is being prepared</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-2)]">Existing Spotly businesses and orders continue as normal. We'll show independent-shopping locations here when the pilot is ready.</p><Link href="/shop" className="mt-6 inline-flex items-center gap-2 font-semibold text-[var(--accent)]">Explore Spotly Shop <ArrowRight className="h-4 w-4"/></Link></div>
        : receipt ? <section className="mt-10 max-w-2xl rounded-2xl border bg-[var(--surface)] p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Check className="h-6 w-6"/></span>
          <h2 className="mt-5 text-2xl font-semibold">Your price-check request was received</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">You requested items from {receipt.storeName}. Spotly has not purchased anything, charged you, or dispatched a Driver. This is not yet a confirmed order.</p>
          <p className="mt-4 rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm">Indicative total: <strong>{format(receipt.estimate?.totalEstimate, receipt.estimate?.currency)}</strong> · Final price to be confirmed</p>
          <button type="button" onClick={() => { setReceipt(null); setSelected(""); setQuantities({}); requestId.current = null; }} className="mt-5 text-sm font-semibold text-[var(--accent)]">Explore other locations</button>
        </section>
        : <div className="mt-10 grid gap-7 lg:grid-cols-[.88fr_1.12fr]">
          <section>
            <div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Independently researched</p><h2 className="mt-1 text-2xl font-semibold">Find a place</h2></div><span className="text-xs text-[var(--text-3)]">{stores.length} locations</span></div>
            <label className="mt-5 flex h-12 items-center gap-3 rounded-xl border bg-[var(--surface)] px-4"><Search className="h-4 w-4 text-[var(--text-3)]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search places and items" className="w-full bg-transparent text-sm outline-none" /></label>
            <div className="mt-4 space-y-3">
              {stores.map((entry) => <button type="button" key={entry.id} onClick={() => { setSelected(entry.id); setQuantities({}); setRequestError(""); requestId.current = null; }} className={`w-full rounded-2xl border p-5 text-left transition ${selected === entry.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface)] hover:border-[var(--accent)]/50"}`}>
                <span className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)]"><Store className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block font-semibold">{entry.name}</span><span className="mt-1 flex items-center gap-1 text-xs text-[var(--text-2)]"><MapPin className="h-3 w-3"/>{entry.area ? `${entry.area} · ` : ""}{entry.city}</span><span className="mt-2 block text-xs font-medium text-[var(--text-3)]">Independent purchase · {entry.items.length} priced items</span></span><ArrowRight className="mt-2 h-4 w-4 text-[var(--text-3)]"/></span>
              </button>)}
              {!stores.length && <p className="rounded-2xl border p-6 text-sm text-[var(--text-2)]">No independent locations match your search yet.</p>}
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-7">
            {!store ? <div className="py-16 text-center"><ShoppingBasket className="mx-auto h-10 w-10 text-[var(--text-3)]"/><h2 className="mt-5 text-xl font-semibold">Choose a location</h2><p className="mt-2 text-sm text-[var(--text-2)]">See independently checked prices before requesting a shopper.</p></div> : <>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Independent shopping</p>
              <h2 className="mt-2 text-2xl font-semibold">{store.name}</h2>
              <p className="mt-2 text-sm text-[var(--text-2)]">{store.address}</p>
              <p className="mt-2 text-xs text-[var(--text-3)]">Prices are estimates and may change at the counter. Store not affiliated with Spotly.</p>
              <div className="mt-6 divide-y border-y border-[var(--border-subtle)]">
                {store.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0"><p className="font-medium">{item.name}</p><p className="mt-1 text-sm text-[var(--text-2)]">{format(item.priceEstimate, store.currency)}{item.unit ? ` / ${item.unit}` : ""}</p><p className="mt-1 text-[11px] text-[var(--text-3)]">Price checked {new Date(item.priceCheckedAt).toLocaleDateString("en-ZW")}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><button aria-label={`Remove one ${item.name}`} type="button" onClick={() => setQuantity(item.id, -1)} disabled={!quantities[item.id]} className="flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-35"><Minus className="h-4 w-4"/></button><span className="w-5 text-center text-sm tabular-nums">{quantities[item.id] || 0}</span><button aria-label={`Add one ${item.name}`} type="button" onClick={() => setQuantity(item.id, 1)} disabled={quantities[item.id] >= 10} className="flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-35"><Plus className="h-4 w-4"/></button></div>
                </div>)}
              </div>
              {items.length > 0 && <div className="mt-5 rounded-xl bg-[var(--surface-2)] p-4"><div className="flex justify-between text-sm"><span>{items.reduce((n, i) => n + i.quantity, 0)} requested items</span><strong>{format(subtotal, store.currency)}</strong></div><p className="mt-2 text-xs leading-5 text-[var(--text-2)]">Merchandise estimate only. Shopping and delivery fees, if any, are confirmed before payment.</p></div>}
              {!result.requestEnabled ? <p className="mt-5 rounded-xl border p-4 text-sm leading-6 text-[var(--text-2)]">Price browsing is available, but quote requests have not opened in this pilot. No orders can be placed yet.</p> :
                <form onSubmit={submit} className="mt-6 space-y-3">
                  <h3 className="font-semibold">Request a price check</h3>
                  <p className="text-xs leading-5 text-[var(--text-2)]">This does not place an order, take payment or dispatch a shopper.</p>
                  <label className="block text-xs font-semibold">Your name<input required minLength={2} maxLength={120} value={form.contactName} onChange={(e) => setForm((v) => ({ ...v, contactName: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border bg-transparent px-3 text-sm font-normal" placeholder="Full name"/></label>
                  <label className="block text-xs font-semibold">Phone number<input required minLength={7} maxLength={40} value={form.contactPhone} onChange={(e) => setForm((v) => ({ ...v, contactPhone: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border bg-transparent px-3 text-sm font-normal" placeholder="+263 ..."/></label>
                  <label className="block text-xs font-semibold">Delivery address<textarea required minLength={10} maxLength={400} value={form.deliveryAddress} onChange={(e) => setForm((v) => ({ ...v, deliveryAddress: e.target.value }))} rows={2} className="mt-2 w-full rounded-xl border bg-transparent p-3 text-sm font-normal" placeholder="Street, suburb and city"/></label>
                  <label className="block text-xs font-semibold">Optional instructions<textarea maxLength={500} value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} rows={2} className="mt-2 w-full rounded-xl border bg-transparent p-3 text-sm font-normal" placeholder="Shopping preferences"/></label>
                  {requestError && <p role="alert" className="text-sm text-[var(--danger)]">{requestError} {requestError.toLowerCase().includes("sign in") && <Link href={spotlyLoginUrl("customer", { next: "/shop-for-me" })} className="font-semibold underline">Sign in</Link>}</p>}
                  <button type="submit" disabled={busy || items.length < 1 || items.length > 25} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] font-semibold text-white disabled:opacity-50">{busy ? "Submitting…" : "Request price confirmation"}<ArrowRight className="h-4 w-4"/></button>
                </form>}
            </>}
          </section>
        </div>}
    </div>
  </main>;
}
