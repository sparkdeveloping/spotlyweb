"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Minus, Plus, ShoppingBasket } from "lucide-react";
import { authenticatedFetch, publicApiFetch } from "@/lib/api-client";
import { useAuth } from "@/components/firebase-provider";
import { spotlyLoginUrl } from "@/lib/spotly-domains";

const money = (value, currency = "USD") => new Intl.NumberFormat("en-ZW", { style: "currency", currency }).format(value);
export function BusinessAssistCatalogue({ businessId, branchId, initialCatalogue }) {
  const matching = initialCatalogue?.store && (initialCatalogue.store.directoryBranchId || `${businessId}-place`) === branchId;
  const [catalogue, setCatalogue] = useState(matching ? initialCatalogue : null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (matching) return;
    let active = true;
    publicApiFetch(`/api/public/independent-shopping?business=${encodeURIComponent(businessId)}&branch=${encodeURIComponent(branchId || "")}`)
      .then(result => { if (active) { if (!result.stores?.[0]) setError("This location is not accepting assisted orders. Choose another location."); else setCatalogue({store:result.stores[0],requestEnabled:result.requestEnabled}); } })
      .catch(failure => {if(active)setError(failure.message || "We could not load this location’s catalogue.");});
    return () => { active = false; };
  }, [businessId,branchId,matching]);
  if (error) return <p role="alert" className="rounded-2xl border p-5 text-sm text-[var(--text-2)]">{error}</p>;
  if (!catalogue) return <p role="status" className="rounded-2xl border p-5 text-sm text-[var(--text-2)]">Loading this location’s catalogue…</p>;
  return <AssistCatalogue key={catalogue.store.id} store={catalogue.store} requestEnabled={catalogue.requestEnabled}/>;
}
export function AssistCatalogue({ store, requestEnabled = true, onSubmitted }) {
  const { user, profile } = useAuth();
  const [quantities, setQuantities] = useState({});
  const [custom, setCustom] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ contactName: "", contactPhone: "", deliveryAddress: "", notes: "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [receipt, setReceipt] = useState(null);
  const requestId = useRef(null);
  const [draftReady, setDraftReady] = useState(false);
  const [returnTo, setReturnTo] = useState("/shop-for-me");
  const key = `spotly.assist.basket.v1.${store.id}`;
  useEffect(() => {
    try { const draft = JSON.parse(sessionStorage.getItem(key) || "null"); if (draft) { setQuantities(draft.quantities || {}); setCustom(draft.custom || ""); } } catch {}
    setDraftReady(true); setReturnTo(window.location.pathname + window.location.search);
  }, [key]);
  useEffect(() => { if (draftReady) try { sessionStorage.setItem(key, JSON.stringify({ quantities, custom })); } catch {} }, [key, quantities, custom, draftReady]);
  useEffect(() => { setForm(current => ({ ...current, contactName: current.contactName || profile?.fullName || profile?.displayName || user?.displayName || "", contactPhone: current.contactPhone || profile?.phone || user?.phoneNumber || "" })); }, [profile?.fullName, profile?.displayName, profile?.phone, user?.displayName, user?.phoneNumber]);
  const selections = store.items.filter(item => Number(quantities[item.id]) > 0).map(item => ({ itemId: item.id, quantity: Number(quantities[item.id]) }));
  const customItems = custom.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(\d+)\s*[x×]\s+(.+)$/i);
    return { name: match ? match[2].trim() : line, quantity: match ? Number(match[1]) : 1 };
  });
  const count = selections.length + customItems.length;
  const unknown = customItems.length > 0 || selections.some(selected => store.items.find(item => item.id === selected.itemId)?.priceEstimate == null);
  const subtotal = selections.reduce((sum, selected) => sum + (store.items.find(item => item.id === selected.itemId)?.priceEstimate || 0) * selected.quantity, 0);
  const change = (id, delta) => { requestId.current = null; setReceipt(null); setError(""); setQuantities(current => ({ ...current, [id]: Math.max(0, Math.min(10, (current[id] || 0) + delta)) })); };
  const update = (field, value) => { requestId.current = null; setReceipt(null); setForm(current => ({ ...current, [field]: value })); };
  async function submit(event) {
    event.preventDefault(); setError("");
    if (!count || count > 25 || customItems.length > 15 || customItems.some(item => item.name.length < 2 || item.name.length > 160 || item.quantity < 1 || item.quantity > 10)) { setError("Choose up to 25 different items, with 1–10 of each. Use up to 15 custom item lines."); return; }
    if (!requestEnabled) return;
    setBusy(true);
    requestId.current ||= crypto.randomUUID().replaceAll("-", "");
    try {
      const result = await authenticatedFetch("/api/customer/independent-shopping/requests", { method: "POST", body: JSON.stringify({ requestId: requestId.current, storeId: store.id, items: selections, customItems, ...form }) });
      setReceipt(result); try { sessionStorage.removeItem(key); } catch {} onSubmitted?.(result);
    } catch (failure) { setError(failure.message || "We could not save your order request. Your basket is still here."); }
    finally { setBusy(false); }
  }
  if (receipt) return <section role="status" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6"><CheckCircle2 className="h-9 w-9 text-[var(--accent)]"/><h2 className="mt-4 text-2xl font-semibold">Your order request is with Spotly</h2><p className="mt-3 text-sm leading-6 text-[var(--text-2)]">We’ll check your items and the exact collection location, then send a quote with shopping and delivery fees. Approve and pay before a shopper buys anything.</p><Link href="/activity" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Track in Activity <ArrowRight className="h-4 w-4"/></Link><button type="button" onClick={() => { setReceipt(null); setQuantities({}); setCustom(""); requestId.current = null; }} className="ml-4 mt-4 text-sm font-semibold text-[var(--accent)]">Start another request</button></section>;
  const hasMenu = store.items.some(item => item.catalogueKind === "menu_reference" || item.catalogueKind === "curated_item");
  return <section aria-label="Order with Spotly" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-7">
    <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]">Spotly Assist · We order on your behalf</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{hasMenu && store.assistService === "eat" ? "Choose from the menu" : "What would you like?"}</h2>
    <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">{hasMenu ? "Choose your items here. Spotly confirms this location’s current price and availability before you approve and pay." : "These are shopping requests, rather than confirmed store stock. Pick what you need or add an exact item. Spotly confirms availability and the final price."}</p>
    {store.address ? <p className="mt-2 text-xs text-[var(--text-3)]">Selected location: {store.address}{store.area ? ` · ${store.area}` : ""}</p> : <p className="mt-2 text-xs text-[var(--text-3)]">{store.area || store.city} · Exact collection address confirmed in your quote</p>}
    <label className="mt-5 block text-xs font-semibold">Search items<input type="search" value={query} onChange={event => setQuery(event.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-transparent px-3 text-sm font-normal" placeholder="Find an item"/></label>
    <div className="mt-3 divide-y divide-[var(--border-subtle)]">{store.items.filter(item => !query.trim() || item.name.toLowerCase().includes(query.trim().toLowerCase())).map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-[var(--text-3)]">{typeof item.priceEstimate === "number" ? `${money(item.priceEstimate, store.currency)} estimate${item.unit ? ` / ${item.unit}` : ""}` : "Price to confirm"}</p></div><div className="flex shrink-0 items-center gap-2"><button type="button" aria-label={`Remove one ${item.name}`} disabled={!quantities[item.id] || busy} onClick={() => change(item.id, -1)} className="flex h-10 w-10 items-center justify-center rounded-full border disabled:opacity-30"><Minus className="h-4 w-4"/></button><span className="w-5 text-center text-sm tabular-nums" aria-live="polite">{quantities[item.id] || 0}</span><button type="button" aria-label={`Add one ${item.name}`} disabled={quantities[item.id] >= 10 || busy} onClick={() => change(item.id, 1)} className="flex h-10 w-10 items-center justify-center rounded-full border disabled:opacity-30"><Plus className="h-4 w-4"/></button></div></div>)}</div>
    {store.allowCustomItems ? <label className="mt-5 block text-sm font-semibold">Need something specific?<textarea value={custom} maxLength={2400} onChange={event => { requestId.current = null; setCustom(event.target.value); }} rows={3} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-normal" placeholder={store.assistService === "eat" ? "2 x Your exact meal and size\nAny changes or preferences" : "2 x Exact brand, item and pack size\nYour preferred alternative"}/><span className="mt-1 block text-xs font-normal text-[var(--text-3)]">One item per line. Add a quantity as “2 x Item name”. Put preferences in the instructions below.</span></label> : null}
    <div className="mt-6 rounded-xl bg-[var(--surface-2)] p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShoppingBasket className="h-4 w-4"/>{count ? `${count} different ${count === 1 ? "item" : "items"} selected` : "Your request basket"}</div><p className="mt-2 text-sm text-[var(--text-2)]">{count && !unknown ? `Item estimate: ${money(subtotal, store.currency)}. ` : ""}Final item prices, shopping and delivery fees are confirmed in your quote before payment.</p><p className="mt-2 text-xs leading-5 text-[var(--text-3)]">Spotly shops independently on your behalf. This business is not necessarily a Spotly partner.</p></div>
    {!requestEnabled ? <p role="status" className="mt-5 rounded-xl border p-4 text-sm">Order requests are temporarily paused for this location.</p> : <form onSubmit={submit} className="mt-6 space-y-4"><h3 className="font-semibold">Delivery details</h3><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold">Your name<input required minLength={2} maxLength={120} autoComplete="name" value={form.contactName} onChange={event => update("contactName", event.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-transparent px-3 text-sm font-normal"/></label><label className="block text-xs font-semibold">Phone number<input required type="tel" minLength={7} maxLength={40} autoComplete="tel" value={form.contactPhone} onChange={event => update("contactPhone", event.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-transparent px-3 text-sm font-normal"/></label></div><label className="block text-xs font-semibold">Delivery address<textarea required minLength={10} maxLength={400} autoComplete="street-address" value={form.deliveryAddress} onChange={event => update("deliveryAddress", event.target.value)} rows={2} className="mt-2 w-full rounded-xl border bg-transparent p-3 text-sm font-normal" placeholder="Street, suburb and city"/></label><label className="block text-xs font-semibold">Shopping instructions (optional)<textarea maxLength={500} value={form.notes} onChange={event => update("notes", event.target.value)} rows={2} className="mt-2 w-full rounded-xl border bg-transparent p-3 text-sm font-normal" placeholder="Sizes, preferred brands, substitutions or delivery instructions"/></label>
      {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
      {!user || user.isAnonymous ? <Link href={spotlyLoginUrl("customer", { next: returnTo })} className="flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Sign in to send your order request</Link> : <button type="submit" disabled={busy || !count || count > 25} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-40">{busy ? "Sending…" : "Send order request"}<ArrowRight className="h-4 w-4"/></button>}
      <p className="text-xs leading-5 text-[var(--text-3)]">Nothing is charged now. Review and approve Spotly’s quote in Activity before payment and shopping.</p>
    </form>}
  </section>;
}
