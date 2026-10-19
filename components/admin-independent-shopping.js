"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ClipboardList, LockKeyhole, Plus, RefreshCw, ShieldAlert, Store } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { useAuth } from "@/components/firebase-provider";
import { AdminAccess } from "@/components/admin-legacy-sections";
import { authenticatedFetch } from "@/lib/api-client";
import { canAccessAdminSection } from "@/lib/admin-access";

const initial = {
  id: "", name: "", city: "Harare", area: "", address: "",
  category: "Restaurant", directoryBusinessId: "", status: "draft", priceCheckMethod: "in_person"
};
const field = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-offset-2 focus:outline-[var(--accent)]";
const money = (value) => new Intl.NumberFormat("en-ZW", { style: "currency", currency: "USD" }).format(Number(value || 0));

function Editor() {
  const [form, setForm] = useState(initial);
  const [menu, setMenu] = useState("");
  const [checked, setChecked] = useState(false);
  const [list, setList] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    setLoading(true); setError("");
    try {
      const data = await authenticatedFetch("/api/admin/independent-shopping");
      setList(data.stores || []);
      try {
        const queue = await authenticatedFetch("/api/admin/independent-shopping/requests");
        setRequests(queue.requests || []);
      } catch { setRequests([]); }
    } catch (err) { setError(err.message || "Could not load independent-shopping records."); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  function select(record) {
    setForm({
      id: record.id, name: record.name || "", city: record.city || "Harare",
      area: record.area || "", address: record.address || "",
      category: record.category || "Restaurant", directoryBusinessId: record.directoryBusinessId || "",
      status: record.status || "draft", priceCheckMethod: record.priceCheckMethod || "in_person"
    });
    setMenu((record.items || []).map((item) => [item.name, item.priceEstimate, item.unit || ""].join(" | ")).join("\n"));
    setChecked(false); setError(""); setSuccess("");
    document.getElementById("independent-store-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function save(event) {
    event.preventDefault();
    setError(""); setSuccess("");
    if (!checked) { setError("Confirm that you independently rechecked every listed price today."); return; }
    const stamp = new Date().toISOString();
    const lines = menu.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length > 120) { setError("Use no more than 120 items in the pilot."); return; }
    const items = [];
    for (let index = 0; index < lines.length; index += 1) {
      const parts = lines[index].split("|").map((value) => value.trim());
      if (parts.length < 2 || parts.length > 3 || !parts[0] || !parts[1]) {
        setError(`Menu line ${index + 1} must be: Item name | USD price | optional unit`);
        return;
      }
      const amount = Number(parts[1]);
      if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
        setError(`Menu line ${index + 1} has an invalid USD price.`);
        return;
      }
      const slug = parts[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
      items.push({
        id: `item_${index + 1}_${slug || "menu"}`, name: parts[0], priceEstimate: amount,
        unit: parts[2] || "", category: "", priceCheckedAt: stamp, status: "available"
      });
    }
    setSaving(true);
    try {
      const result = await authenticatedFetch("/api/admin/independent-shopping", {
        method: "POST", body: JSON.stringify({ ...form, items })
      });
      setSuccess(`Saved ${form.name} as ${result.status}. ${result.itemCount} prices recorded. This has not created an official merchant account.`);
      setForm((current) => ({ ...current, id: result.id }));
      setChecked(false);
      await refresh();
    } catch (err) { setError(err.message || "Could not save this independent listing."); }
    finally { setSaving(false); }
  }
  return <div className="space-y-7">
    <div className="grid gap-5 lg:grid-cols-[.78fr_1.22fr]">
      <section className="rounded-2xl border bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Independent locations</h2><p className="mt-1 text-xs text-[var(--text-2)]">Separate from Spotly merchants</p></div><button type="button" onClick={refresh} aria-label="Refresh independent stores" className="rounded-xl border p-2.5"><RefreshCw className="h-4 w-4"/></button></div>
        <button type="button" onClick={() => { setForm(initial); setMenu(""); setChecked(false); setError(""); setSuccess(""); }} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)] font-semibold text-[var(--accent)]"><Plus className="h-4 w-4"/>New independent location</button>
        <div className="mt-4 space-y-2">
          {loading && <p className="text-sm text-[var(--text-2)]">Loading…</p>}
          {list.map((entry) => <button key={entry.id} type="button" onClick={() => select(entry)} className={`w-full rounded-xl border p-4 text-left text-sm transition hover:border-[var(--accent)] ${entry.id === form.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}>
            <span className="block font-semibold">{entry.name}</span>
            <span className="mt-1 block text-xs text-[var(--text-2)]">{entry.area || entry.city} · {entry.status} · {(entry.items || []).length} items</span>
          </button>)}
          {!loading && !list.length && <p className="py-6 text-center text-sm text-[var(--text-2)]">No independent stores created yet.</p>}
        </div>
      </section>
      <section id="independent-store-editor" className="rounded-2xl border bg-[var(--surface)] p-5 sm:p-7">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Store className="h-5 w-5"/></span>
        <h2 className="mt-4 text-xl font-semibold">{form.id ? "Edit independent location" : "Research a location"}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Use only original factual menu information you independently obtained. Do not paste menus, photographs, logos, creative descriptions or website-scraped content.</p>
        <form onSubmit={save} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[["name","Store name"],["city","City"],["area","Area"],["address","Street address"],["category","Category"],["directoryBusinessId","Existing directory ID (optional)"]].map(([key,label]) => <label key={key} className="block text-xs font-semibold">{label}<input required={["name","city","address"].includes(key)} value={form[key]} onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))} className={field}/></label>)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold">Listing status<select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))} className={field}><option value="draft">Draft (hidden)</option><option value="published">Published (visible only if pilot enabled)</option><option value="paused">Paused (hidden)</option><option value="archived">Archived (hidden)</option></select></label>
            <label className="block text-xs font-semibold">How did you check prices?<select value={form.priceCheckMethod} onChange={(e) => setForm((v) => ({ ...v, priceCheckMethod: e.target.value }))} className={field}><option value="in_person">In person</option><option value="phone">By phone</option><option value="business_authorized">Business-authorized information</option></select></label>
          </div>
          <label className="block text-xs font-semibold">Items and independently confirmed prices<textarea value={menu} onChange={(e) => setMenu(e.target.value)} rows={9} className={field + " font-mono"} placeholder={"Chicken meal | 8.50 | regular\nChicken meal | 12.00 | large"}/></label>
          <p className="text-xs leading-5 text-[var(--text-2)]">One item per line: <strong>Item name | USD price | optional size</strong>. Up to 120 items; each price expires after 14 days.</p>
          <label className="flex items-start gap-3 rounded-xl border bg-[var(--surface-2)] p-4 text-sm"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-4 w-4"/>I personally verified these prices today using the method selected. This listing will show an explicit no-affiliation disclosure.</label>
          {error && <p role="alert" className="text-sm font-medium text-[var(--danger)]">{error}</p>}
          {success && <p role="status" className="text-sm font-medium text-[var(--success)]">{success}</p>}
          <button type="submit" disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4"/>{saving ? "Saving…" : "Save independent location"}</button>
        </form>
      </section>
    </div>
    <section className="rounded-2xl border bg-[var(--surface)] p-5 sm:p-7">
      <div className="flex items-start gap-3"><ClipboardList className="mt-1 h-5 w-5 text-[var(--accent)]"/><div><h2 className="text-xl font-semibold">Price confirmation requests</h2><p className="mt-2 text-sm text-[var(--text-2)]">These are enquiries only. Do not buy items or dispatch a Driver from this screen. No payments have been collected.</p></div></div>
      <div className="mt-5 space-y-3">{requests.map((item) => <article key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{item.storeName} · {item.contactName}</p><span className="text-xs text-[var(--text-2)]">{item.state}</span></div><p className="mt-2 text-xs text-[var(--text-2)]">{item.contactPhone} · {item.deliveryAddress}</p><p className="mt-2 text-sm">Estimate: <strong>{money(item.estimate?.totalEstimate)}</strong> · {item.paymentStatus} · {item.dispatchStatus}</p></article>)}
        {!requests.length && <p className="rounded-xl bg-[var(--surface-2)] p-5 text-sm text-[var(--text-2)]">No open quote requests, or your role cannot access the queue.</p>}
      </div>
    </section>
  </div>;
}

export function AdminIndependentShoppingApp() {
  const { profile } = useAuth();
  const allowed = canAccessAdminSection(profile, "marketplace");
  return <AuthGate portal="admin" title="Sign in to Spotly Admin"><AdminAccess><PortalShell portalId="admin" activeSection="marketplace">
    <main className="mx-auto max-w-[1250px] px-5 py-10 sm:px-8">
      <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--accent)]"><ArrowLeft className="h-4 w-4"/>Marketplace operations</Link>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Off-by-default pilot</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Independent shopping</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Curate independent price estimates without touching verified merchants, products or orders.</p></div><Link href="https://spotlyafrica.com/shop-for-me" className="text-sm font-semibold text-[var(--accent)]">View customer preview</Link></div>
      <div className="my-7 flex items-start gap-3 rounded-xl border border-amber-300/40 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0"/><p>Listings are not partnerships. Publishing a location does not enable the pilot. Existing merchant checkout, Driver dispatch and payout systems are unchanged. Do not collect payment or shop until a separately approved release enables them.</p></div>
      {!allowed ? <div className="mt-10 rounded-2xl border bg-[var(--surface)] p-8"><LockKeyhole className="h-8 w-8"/><h2 className="mt-4 font-semibold">Administrator access required</h2><p className="mt-2 text-sm text-[var(--text-2)]">Your assigned role does not include marketplace administration.</p></div> : <Editor/>}
    </main>
  </PortalShell></AdminAccess></AuthGate>;
}
