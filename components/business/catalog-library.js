"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, Check, LoaderCircle, ScanBarcode, Search, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, SearchField } from "@/components/ui";
import { useToast } from "@/components/providers";
import { authenticatedFetch } from "@/lib/api-client";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { FieldLabel, fieldClass, selectClass } from "@/components/business/shared";

function Scanner({ onValue, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let stream = null;
    let timer = null;
    async function start() {
      try {
        if (!("BarcodeDetector" in window)) throw new Error("Automatic barcode scanning is not supported on this browser. Enter the barcode instead.");
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) return;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        async function tick() {
          if (!active || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            const value = results?.[0]?.rawValue;
            if (value) { onValue(value); onClose(); return; }
          } catch {}
          timer = window.setTimeout(tick, 400);
        }
        tick();
      } catch (caught) { setError(caught.message || "Camera scanning is unavailable."); }
    }
    start();
    return () => { active = false; if (timer) clearTimeout(timer); stream?.getTracks?.().forEach((track) => track.stop()); };
  }, [onValue, onClose]);
  return <div className="space-y-4"><div className="overflow-hidden rounded-xl border bg-[var(--inverse-surface)]"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" /></div>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button variant="outline" className="w-full" onClick={onClose}>Enter barcode manually</Button></div>;
}

export function CatalogLibraryModal({ open, onClose }) {
  const { selectedBusinessId, branches, selectedBranchId } = useBusinessWorkspace();
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("");
  const [collections, setCollections] = useState([]);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const defaultBranches = useMemo(() => selectedBranchId ? [selectedBranchId] : branches.map((branch) => branch.id), [selectedBranchId, branches]);
  async function load(search = query, chosenCollection = collection) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ businessId: selectedBusinessId, limit: "40" });
      if (search.trim()) params.set("query", search.trim());
      if (chosenCollection) params.set("collection", chosenCollection);
      const result = await authenticatedFetch(`/api/business/catalog-library?${params}`);
      setItems(result.items || []); setCollections(result.collections || []);
    } catch (caught) { setError(caught.message || "Spotly Library could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (open && selectedBusinessId) { setSelected({}); setQuery(""); setCollection(""); load("", ""); } }, [open, selectedBusinessId]);

  function toggle(item) {
    setSelected((current) => current[item.id] ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== item.id)) : { ...current, [item.id]: { masterProductId: item.id, price: "", currency: "USD", stockStatus: "in_stock", branchIds: defaultBranches } });
  }
  function patch(id, values) { setSelected((current) => ({ ...current, [id]: { ...current[id], ...values } })); }
  function toggleBranch(id, branchId) {
    const current = selected[id]?.branchIds || [];
    patch(id, { branchIds: current.includes(branchId) ? current.filter((value) => value !== branchId) : [...current, branchId] });
  }
  async function addSelected() {
    const records = Object.values(selected);
    if (!records.length) return;
    setAdding(true);
    try {
      const result = await authenticatedFetch("/api/business/catalog-library", { method: "POST", body: JSON.stringify({ action: "add_offers", businessId: selectedBusinessId, items: records.map((item) => ({ ...item, price: item.price === "" ? undefined : Number(item.price) })) }) });
      toast(`${result.created} product${result.created === 1 ? "" : "s"} added as catalogue drafts.${result.skipped ? ` ${result.skipped} already existed.` : ""}`, { title: "Spotly Library added" });
      onClose();
    } catch (caught) { toast(caught.message, { type: "error", title: "Could not add products" }); }
    finally { setAdding(false); }
  }
  function barcodeFound(value) { setQuery(value); window.setTimeout(() => load(value, ""), 0); }

  return <Modal open={open} onClose={onClose} title="Add from Spotly Library" description="Reuse verified product identity, then set your own prices, stock and locations." size="xl">
    <div className="space-y-5 p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
        <SearchField value={query} onChange={setQuery} onSubmit={() => load()} placeholder="Product, brand or barcode" label="Search Spotly Library" />
        <select className={selectClass} value={collection} onChange={(event) => { setCollection(event.target.value); load(query, event.target.value); }} aria-label="Catalogue collection"><option value="">All collections</option>{collections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <Button variant="outline" onClick={() => setScanner(true)}><ScanBarcode className="h-4 w-4" />Scan</Button>
      </div>
      {scanner && <Card variant="bordered" className="p-4"><div className="mb-3 flex items-center justify-between"><p className="font-semibold">Scan a barcode</p><Button size="icon" variant="ghost" onClick={() => setScanner(false)} aria-label="Close scanner"><X className="h-4 w-4" /></Button></div><Scanner onValue={barcodeFound} onClose={() => setScanner(false)} /></Card>}
      {error ? <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-[var(--on-danger-soft)]"><p>{error}</p><Button className="mt-3" variant="outline" onClick={() => load()}>Try again</Button></div> : loading ? <div className="flex justify-center py-14"><LoaderCircle className="h-7 w-7 animate-spin text-business" /></div> : items.length ? <div className="space-y-3">{items.map((item) => { const active = Boolean(selected[item.id]); const row = selected[item.id]; return <Card key={item.id} variant={active ? "selected" : "bordered"} className="p-4"><div className="flex items-start gap-4"><button type="button" onClick={() => toggle(item)} className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${active ? "border-business bg-business text-[var(--on-business)]" : "bg-[var(--surface)]"}`} aria-label={`${active ? "Remove" : "Select"} ${item.canonicalName}`}>{active && <Check className="h-4 w-4" />}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.canonicalName}</p>{item.brand && <Badge tone="neutral">{item.brand}</Badge>}<Badge tone="success">Spotly verified</Badge></div><p className="mt-1 text-sm text-secondary">{[item.variant, item.packSize, item.categoryPath?.at(-1), item.gtin ? `Barcode ${item.gtin}` : ""].filter(Boolean).join(" · ")}</p>{active && <div className="mt-4 space-y-3 border-t pt-4"><div className="grid gap-3 sm:grid-cols-[1fr_130px_160px]"><FieldLabel label="Your price"><input type="number" min="0" step="0.01" value={row.price} onChange={(event) => patch(item.id, { price: event.target.value })} className={fieldClass} placeholder="Set later" /></FieldLabel><FieldLabel label="Currency"><select value={row.currency} onChange={(event) => patch(item.id, { currency: event.target.value })} className={selectClass}><option value="USD">USD</option><option value="ZWG">ZiG</option></select></FieldLabel><FieldLabel label="Availability"><select value={row.stockStatus} onChange={(event) => patch(item.id, { stockStatus: event.target.value })} className={selectClass}><option value="in_stock">Available</option><option value="low_stock">Limited</option><option value="unavailable">Unavailable</option></select></FieldLabel></div>{branches.length > 0 && <div><p className="text-xs font-semibold text-secondary">Locations</p><div className="mt-2 flex flex-wrap gap-2">{branches.map((branch) => { const chosen = row.branchIds.includes(branch.id); return <button key={branch.id} type="button" onClick={() => toggleBranch(item.id, branch.id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${chosen ? "border-business bg-business-soft text-business" : "bg-[var(--surface)] text-secondary"}`}>{branch.branchName || branch.name}</button>; })}</div></div>}</div>}</div></div></Card>; })}</div> : <EmptyState icon={query ? Search : BookOpenCheck} title={query ? "No verified product matched" : "Spotly Library is ready to grow"} description={query ? "Try a brand, product name, or barcode. If the product is new, your business can submit it for Spotly review." : "Verified starter products and collections will appear here as Spotly staff and partners grow the library."} />}
      <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-[var(--surface)] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-secondary">{Object.keys(selected).length} selected · products are added as drafts until prices and publication are ready.</p><Button onClick={addSelected} loading={adding} disabled={!Object.keys(selected).length}>Add selected products</Button></div>
    </div>
  </Modal>;
}
