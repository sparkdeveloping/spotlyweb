"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, PackageSearch, ScanBarcode, Search, Store, UploadCloud } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { uploadFile } from "@/lib/firebase-services";
import { useToast } from "@/components/providers";

const fieldClass = "surface h-12 w-full rounded-xl px-4 outline-none focus:ring-2 focus:ring-[var(--accent)]/20";

function BarcodeScanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function start() {
      try {
        if (!("BarcodeDetector" in window)) throw new Error("Live barcode scanning is not supported by this browser. Enter the code manually instead.");
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        async function scan() {
          if (!active || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) { onCode(codes[0].rawValue); return; }
          } catch {}
          frameRef.current = requestAnimationFrame(scan);
        }
        scan();
      } catch (reason) { setError(reason.message || "The camera could not start."); }
    }
    start();
    return () => { active = false; if (frameRef.current) cancelAnimationFrame(frameRef.current); streamRef.current?.getTracks?.().forEach((track) => track.stop()); };
  }, [onCode]);
  return <Card variant="bordered" className="overflow-hidden"><div className="aspect-[4/3] bg-[var(--inverse-surface)]"><video ref={videoRef} muted playsInline className="h-full w-full object-cover" /></div><div className="p-4">{error ? <p className="text-sm leading-6 text-danger">{error}</p> : <p className="text-sm text-secondary">Hold the barcode inside the camera view. Spotly will fill the code when it is recognized.</p>}<Button variant="outline" className="mt-3 w-full" onClick={onClose}>Close camera</Button></div></Card>;
}

export function StaffCatalogueCapture({ data }) {
  const { toast } = useToast();
  const [businessQuery, setBusinessQuery] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [business, setBusiness] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [matched, setMatched] = useState(null);
  const [scanner, setScanner] = useState(false);
  const [form, setForm] = useState({ name: "", brand: "", variant: "", packSize: "", unit: "", category: "Groceries", observedPrice: "", currency: "USD", observedAvailability: "available", notes: "" });
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const permissions = new Set([...(data.profile?.customPermissions || []), ...(data.staffProfile?.permissions || []), ...(data.rolePack?.permissions || [])]);
  const canReview = permissions.has("*") || permissions.has("master_products.review") || permissions.has("master_products.*");
  const [mode, setMode] = useState("capture");
  const [reviewItems, setReviewItems] = useState([]);
  const [reviewBusy, setReviewBusy] = useState("");

  async function searchBusinesses(query = businessQuery) {
    setSearching(true);
    try { const result = await authenticatedFetch(`/api/staff/catalogue?type=businesses&query=${encodeURIComponent(query)}`); setBusinesses(result.businesses || []); }
    catch (error) { toast(error.message, { type: "error", title: "Business search failed" }); }
    finally { setSearching(false); }
  }

  async function chooseBusiness(item) {
    setBusiness(item); setBusinesses([]); setBusinessQuery("");
    try { const result = await authenticatedFetch(`/api/staff/catalogue?type=branches&businessId=${encodeURIComponent(item.id)}`); setBranches(result.branches || []); setBranchId(result.branches?.[0]?.id || ""); }
    catch (error) { toast(error.message, { type: "error", title: "Locations could not load" }); }
  }

  async function lookupBarcode(value = barcode) {
    const normalized = String(value || "").replace(/\s+/g, "");
    setBarcode(normalized);
    if (!normalized) return;
    setSearching(true);
    try {
      const result = await authenticatedFetch(`/api/staff/catalogue?barcode=${encodeURIComponent(normalized)}`);
      const product = result.items?.[0] || null;
      setMatched(product);
      if (product) setForm((current) => ({ ...current, name: product.canonicalName || current.name, brand: product.brand || current.brand, variant: product.variant || current.variant, packSize: product.packSize || current.packSize, unit: product.unit || current.unit, category: product.categoryPath?.at(-1) || current.category }));
      else toast("No master product uses that barcode yet. Capture the product details to create a review draft.", { title: "New product" });
    } catch (error) { toast(error.message, { type: "error", title: "Barcode lookup failed" }); }
    finally { setSearching(false); }
  }

  async function uploadImage(file, kind) {
    if (!file) return { url: "", path: "" };
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error("Product photos must be images smaller than 10 MB.");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `master-products/drafts/${data.user.uid}/${crypto.randomUUID()}-${kind}.${extension}`;
    const url = await uploadFile(path, file, { kind: "master_product_capture", workerId: data.user.uid });
    return { url, path };
  }

  async function loadReview() {
    if (!canReview) return;
    setSearching(true);
    try { const result = await authenticatedFetch("/api/staff/catalogue?type=review"); setReviewItems(result.items || []); }
    catch (error) { toast(error.message, { type: "error", title: "Review queue could not load" }); }
    finally { setSearching(false); }
  }

  async function reviewProduct(item, decision) {
    setReviewBusy(item.id);
    try { await authenticatedFetch("/api/staff/catalogue", { method: "POST", body: JSON.stringify({ action: "review", masterProductId: item.id, decision }) }); toast(decision === "approve" ? "Product approved for Spotly Library." : "Product rejected from the review queue.", { title: "Master product reviewed" }); await loadReview(); }
    catch (error) { toast(error.message, { type: "error", title: "Could not review product" }); }
    finally { setReviewBusy(""); }
  }

  async function submit(event) {
    event.preventDefault();
    if (!business) return toast("Select the business where this product was observed.", { type: "error", title: "Business required" });
    if (!form.name.trim()) return toast("Enter the product name.", { type: "error", title: "Product name required" });
    setSaving(true);
    try {
      const [frontUpload, backUpload] = await Promise.all([uploadImage(front, "front"), uploadImage(back, "back")]);
      const result = await authenticatedFetch("/api/staff/catalogue", { method: "POST", body: JSON.stringify({ action: "capture", businessId: business.id, branchId: branchId || undefined, masterProductId: matched?.id || undefined, barcode, ...form, observedPrice: form.observedPrice === "" ? undefined : Number(form.observedPrice), frontImage: frontUpload.url, backImage: backUpload.url, imageStoragePath: frontUpload.path }) });
      toast(matched ? "The store observation was recorded against the existing Spotly product." : "A master-product review draft and store observation were created.", { title: "Product captured" });
      setBarcode(""); setMatched(null); setForm({ name: "", brand: "", variant: "", packSize: "", unit: "", category: "Groceries", observedPrice: "", currency: "USD", observedAvailability: "available", notes: "" }); setFront(null); setBack(null);
      return result;
    } catch (error) { toast(error.message, { type: "error", title: "Could not save product" }); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6"><PageHeader eyebrow="Spotly catalogue operations" title={mode === "review" ? "Review master products" : "Capture products in the field"} description={mode === "review" ? "Approve only products whose identity, source and imagery are suitable for Spotly's reusable library." : "Scan once, reuse everywhere. Record a product observation for this store and create a master-product review draft only when Spotly does not already know the barcode."} />
    {canReview && <Card className="p-3"><Tabs idPrefix="staff-catalogue-mode" value={mode} onChange={(next) => { setMode(next); if (next === "review") loadReview(); }} tabs={[{ value: "capture", label: "Field capture" }, { value: "review", label: `Review queue${reviewItems.length ? ` (${reviewItems.length})` : ""}` }]} /></Card>}
    {mode === "review" ? <SectionCard title="Master products needing review" description="Field observations never become customer-facing canonical products until an authorized reviewer approves them.">{reviewItems.length ? <div className="space-y-3 p-4">{reviewItems.map((item) => <Card key={item.id} variant="bordered" className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 gap-3"><span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-grouped">{item.primaryImage ? <span role="img" aria-label={`${item.canonicalName} product`} className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${item.primaryImage})` }} /> : <PackageSearch className="h-5 w-5 text-secondary" />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.canonicalName}</p><StatusBadge status={item.verificationStatus || "needs_review"} /></div><p className="mt-1 text-sm text-secondary">{[item.brand, item.variant, item.packSize, item.gtin ? `Barcode ${item.gtin}` : ""].filter(Boolean).join(" · ")}</p><p className="mt-1 text-xs text-secondary">Source: {item.sourceType || "unknown"} · image rights: {item.imageRightsStatus || "not recorded"}</p></div></div><div className="flex gap-2"><Button size="sm" onClick={() => reviewProduct(item, "approve")} loading={reviewBusy === item.id}>Approve</Button><Button size="sm" variant="outline" onClick={() => reviewProduct(item, "reject")} loading={reviewBusy === item.id}>Reject</Button></div></Card>)}</div> : <EmptyState icon={PackageSearch} title={searching ? "Loading review queue…" : "Nothing needs review"} description="New field-captured master products will appear here before they become reusable merchant catalogue data." action={!searching && <Button variant="outline" onClick={loadReview}>Refresh</Button>} />}</SectionCard> : <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <SectionCard title="1. Store and location" description="The observation belongs to a specific store. It does not automatically change that merchant's live price."><div className="space-y-4 p-5">{business ? <div className="rounded-xl border bg-[var(--surface-2)] p-4"><div className="flex items-center gap-3"><Store className="h-5 w-5 text-[var(--accent)]" /><div className="min-w-0 flex-1"><p className="font-semibold">{business.name}</p><p className="mt-1 text-xs text-secondary">{business.city || business.category || "Zimbabwe"}</p></div><Button variant="ghost" size="sm" onClick={() => { setBusiness(null); setBranches([]); setBranchId(""); }}>Change</Button></div></div> : <><div className="flex gap-2"><SearchField value={businessQuery} onChange={setBusinessQuery} placeholder="Search business…" /><Button variant="outline" onClick={() => searchBusinesses()} loading={searching}><Search className="h-4 w-4" /></Button></div>{businesses.length > 0 && <div className="space-y-2">{businesses.map((item) => <button key={item.id} type="button" onClick={() => chooseBusiness(item)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-[var(--surface-2)]"><Store className="h-4 w-4 text-[var(--accent)]" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="block truncate text-xs text-secondary">{item.city || item.category}</span></span></button>)}</div>}</>}{business && branches.length > 0 && <label className="block"><span className="mb-2 block text-sm font-semibold">Location</span><select className={fieldClass} value={branchId} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.city ? ` — ${branch.city}` : ""}</option>)}</select></label>}</div></SectionCard>
      <form onSubmit={submit} className="space-y-5"><SectionCard title="2. Identify the product" description="Barcode is the strongest match. Manual entry remains available when packaging has no readable code."><div className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"><input className={fieldClass} value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="EAN / UPC / GTIN" inputMode="numeric" /><Button type="button" variant="outline" onClick={() => lookupBarcode()} loading={searching}><PackageSearch className="h-4 w-4" />Find</Button><Button type="button" variant="outline" onClick={() => setScanner((value) => !value)}><ScanBarcode className="h-4 w-4" />Scan</Button></div>{scanner && <BarcodeScanner onCode={(code) => { setScanner(false); lookupBarcode(code); }} onClose={() => setScanner(false)} />}{matched && <div className="flex items-center gap-3 rounded-xl bg-[var(--success-soft)] p-4 text-[var(--on-success-soft)]"><CheckCircle2 className="h-5 w-5" /><div><p className="font-semibold">Matched {matched.canonicalName}</p><p className="mt-1 text-xs">This observation will update product freshness without creating a duplicate.</p></div></div>}</div></SectionCard>
      <SectionCard title="3. Confirm product details" description={matched ? "Confirm the packaging still represents this master product." : "These details create a draft for catalogue review."}><div className="grid gap-4 p-5 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Product name</span><input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="mb-2 block text-sm font-semibold">Brand</span><input className={fieldClass} value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label><label><span className="mb-2 block text-sm font-semibold">Variant</span><input className={fieldClass} value={form.variant} onChange={(event) => setForm({ ...form, variant: event.target.value })} /></label><label><span className="mb-2 block text-sm font-semibold">Pack size</span><input className={fieldClass} value={form.packSize} onChange={(event) => setForm({ ...form, packSize: event.target.value })} placeholder="e.g. 500g, 2L" /></label><label><span className="mb-2 block text-sm font-semibold">Category</span><input className={fieldClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label><label><span className="mb-2 block text-sm font-semibold">Observed price</span><div className="flex gap-2"><select className="surface h-12 rounded-xl px-3" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>USD</option><option>ZWG</option></select><input type="number" step="0.01" min="0" className={fieldClass} value={form.observedPrice} onChange={(event) => setForm({ ...form, observedPrice: event.target.value })} /></div></label><label><span className="mb-2 block text-sm font-semibold">Observed availability</span><select className={fieldClass} value={form.observedAvailability} onChange={(event) => setForm({ ...form, observedAvailability: event.target.value })}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option><option value="unknown">Unknown</option></select></label><label className="flex items-center gap-3 rounded-xl border p-4"><input type="checkbox" checked={form.packagingMatched ?? true} onChange={(event) => setForm({ ...form, packagingMatched: event.target.checked })} /><span className="text-sm font-semibold">Packaging matches the known product</span></label></div></SectionCard>
      <SectionCard title="4. Product photos" description="Spotly-owned field photos can become publishable after review. Keep front and back evidence separate."><div className="grid gap-4 p-5 sm:grid-cols-2">{[["Front photo", front, setFront], ["Back photo", back, setBack]].map(([label, file, setter]) => <label key={label} className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center hover:bg-[var(--surface-2)]"><Camera className="h-6 w-6 text-[var(--accent)]" /><span className="mt-2 text-sm font-semibold">{file?.name || label}</span><span className="mt-1 text-xs text-secondary">Camera or image file · max 10 MB</span><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => setter(event.target.files?.[0] || null)} /></label>)}</div></SectionCard>
      <div className="flex justify-end"><Button type="submit" loading={saving} disabled={!business}><UploadCloud className="h-4 w-4" />Save observation</Button></div></form>
    </div>}
  </div>;
}
