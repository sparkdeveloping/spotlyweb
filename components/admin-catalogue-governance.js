"use client";

import { useCallback, useEffect, useState } from "react";
import { GitMerge, PackageSearch, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, EntityMultiPicker, EntityPicker, TabPanel, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { authenticatedFetch } from "@/lib/api-client";
import { FieldLabel, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";

export function AdminCatalogueGovernance() {
  const [tab, setTab] = useState("review");
  const [review, setReview] = useState([]);
  const [collections, setCollections] = useState([]);
  const [sources, setSources] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [merge, setMerge] = useState({ sourceMasterProductId: "", targetMasterProductId: "", reason: "Duplicate product identity" });
  const [collection, setCollection] = useState({ name: "", description: "", publicationStatus: "draft", masterProductIds: [] });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queue, collectionResult, sourceResult, productResult] = await Promise.all([
        authenticatedFetch("/api/staff/catalogue?type=review"),
        authenticatedFetch("/api/staff/catalogue?type=collections"),
        authenticatedFetch("/api/staff/catalogue?type=sources"),
        authenticatedFetch("/api/staff/catalogue?type=products")
      ]);
      setReview(queue.items || []);
      setCollections(collectionResult.items || []);
      setSources(sourceResult.items || []);
      setProducts(productResult.items || []);
    } catch (error) { toast(error.message, { type: "error", title: "Catalogue governance could not load" }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  async function reviewProduct(item, decision) {
    setBusy(item.id);
    try {
      await authenticatedFetch("/api/staff/catalogue", { method: "POST", body: JSON.stringify({ action: "review", masterProductId: item.id, decision }) });
      toast(`${item.canonicalName} ${decision === "approve" ? "approved" : "rejected"}.`, { title: "Master product reviewed" });
      await load();
    } catch (error) { toast(error.message, { type: "error", title: "Review failed" }); }
    finally { setBusy(""); }
  }

  async function mergeProducts(event) {
    event.preventDefault();
    setBusy("merge");
    try {
      const result = await authenticatedFetch("/api/staff/catalogue", { method: "POST", body: JSON.stringify({ action: "merge", ...merge }) });
      toast(`${result.updatedBusinessOffers || 0} merchant offer${result.updatedBusinessOffers === 1 ? "" : "s"} remapped to the verified product.`, { title: "Master products merged" });
      setMerge({ sourceMasterProductId: "", targetMasterProductId: "", reason: "Duplicate product identity" });
      await load();
    } catch (error) { toast(error.message, { type: "error", title: "Merge failed" }); }
    finally { setBusy(""); }
  }

  async function saveCollection(event) {
    event.preventDefault();
    setBusy("collection");
    try {
      await authenticatedFetch("/api/staff/catalogue", { method: "POST", body: JSON.stringify({ action: "collection_upsert", name: collection.name, description: collection.description, publicationStatus: collection.publicationStatus, masterProductIds: collection.masterProductIds || [] }) });
      toast("The reusable Spotly Library collection was saved.", { title: "Collection updated" });
      setCollection({ name: "", description: "", publicationStatus: "draft", masterProductIds: [] });
      await load();
    } catch (error) { toast(error.message, { type: "error", title: "Collection could not be saved" }); }
    finally { setBusy(""); }
  }

  const productOptions = products.map((item) => ({
    value: item.id,
    label: item.canonicalName || item.name || "Unnamed product",
    description: [item.brand, item.variant, item.packSize, item.verificationStatus].filter(Boolean).join(" · "),
    keywords: [item.gtin, item.barcode, item.id, ...(item.searchTerms || [])].filter(Boolean)
  }));

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold">Spotly product library governance</h2><p className="mt-1 text-sm leading-6 text-secondary">Review canonical products, resolve duplicates, manage reusable collections, and inspect catalogue source rights.</p></div><Button variant="outline" onClick={load} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button></div>
    <Tabs idPrefix="admin-catalog-governance" value={tab} onChange={setTab} tabs={[{ value: "review", label: `Review (${review.length})` }, { value: "merge", label: "Merge duplicates" }, { value: "collections", label: `Collections (${collections.length})` }, { value: "sources", label: `Sources (${sources.length})` }]} />
    <TabPanel idPrefix="admin-catalog-governance" value={tab} tabValue="review">{review.length ? <div className="space-y-3">{review.map((item) => <Card key={item.id} variant="bordered" className="p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.canonicalName}</p><Badge tone="warning">Needs review</Badge></div><p className="mt-1 text-sm text-secondary">{[item.brand, item.variant, item.packSize, item.gtin ? `Barcode ${item.gtin}` : ""].filter(Boolean).join(" · ")}</p><p className="mt-2 text-xs text-tertiary">Source: {item.sourceType || "unknown"} · Image rights: {item.imageRightsStatus || "not recorded"} · ID: {item.id}</p></div><div className="flex gap-2"><Button size="sm" onClick={() => reviewProduct(item, "approve")} loading={busy === item.id}>Approve</Button><Button size="sm" variant="outline" onClick={() => reviewProduct(item, "reject")} loading={busy === item.id}>Reject</Button></div></div></Card>)}</div> : <EmptyState icon={PackageSearch} title={loading ? "Loading product review…" : "No master products need review"} description="Field-captured and merchant-suggested product identity records appear here before they become reusable Spotly Library data." />}</TabPanel>
    <TabPanel idPrefix="admin-catalog-governance" value={tab} tabValue="merge"><Card variant="bordered" className="max-w-3xl p-5"><div className="flex gap-3"><GitMerge className="h-5 w-5 text-admin" /><div><h3 className="font-semibold">Merge a duplicate into a verified master product</h3><p className="mt-1 text-sm leading-6 text-secondary">This remaps linked merchant offers and marks the duplicate master record as merged. Use only after confirming product identity.</p></div></div><form className="mt-5 space-y-4" onSubmit={mergeProducts}><FieldLabel label="Duplicate product" required><EntityPicker value={merge.sourceMasterProductId} onChange={(value) => setMerge({ ...merge, sourceMasterProductId: value })} options={productOptions} title="Choose the duplicate product" placeholder="Search products by name, brand or barcode" allowClear={false} /></FieldLabel><FieldLabel label="Verified product to keep" required><EntityPicker value={merge.targetMasterProductId} onChange={(value) => setMerge({ ...merge, targetMasterProductId: value })} options={productOptions.filter((option) => option.value !== merge.sourceMasterProductId && products.find((item) => item.id === option.value)?.verificationStatus === "verified")} title="Choose the verified product" placeholder="Search verified products" allowClear={false} /></FieldLabel><FieldLabel label="Reason" required><textarea required className={textAreaClass} value={merge.reason} onChange={(event) => setMerge({ ...merge, reason: event.target.value })} /></FieldLabel><Button type="submit" loading={busy === "merge"}>Merge duplicate</Button></form></Card></TabPanel>
    <TabPanel idPrefix="admin-catalog-governance" value={tab} tabValue="collections"><div className="grid gap-5 xl:grid-cols-[1fr_420px]"><div className="space-y-3">{collections.map((item) => <Card key={item.id} variant="bordered" className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-secondary">{item.description || "No description"}</p></div><Badge tone={item.publicationStatus === "active" ? "success" : "neutral"}>{item.publicationStatus || "draft"}</Badge></div><p className="mt-3 text-xs text-tertiary">{(item.masterProductIds || []).length} master products · ID {item.id}</p></Card>)}{!collections.length && <EmptyState icon={PackageSearch} title="No catalogue collections" description="Create reusable groups of verified master products for merchant onboarding." />}</div><Card variant="bordered" className="p-5"><h3 className="font-semibold">Create collection</h3><form className="mt-4 space-y-4" onSubmit={saveCollection}><FieldLabel label="Name" required><input required className={fieldClass} value={collection.name} onChange={(event) => setCollection({ ...collection, name: event.target.value })} /></FieldLabel><FieldLabel label="Description"><textarea className={textAreaClass} value={collection.description} onChange={(event) => setCollection({ ...collection, description: event.target.value })} /></FieldLabel><FieldLabel label="Publication"><select className={selectClass} value={collection.publicationStatus} onChange={(event) => setCollection({ ...collection, publicationStatus: event.target.value })}><option value="draft">Draft</option><option value="active">Active for merchants</option><option value="archived">Archived</option></select></FieldLabel><FieldLabel label="Products" hint="Search and choose reviewed products. Spotly keeps the internal references automatically."><EntityMultiPicker value={collection.masterProductIds || []} onChange={(value) => setCollection({ ...collection, masterProductIds: value })} options={productOptions.filter((option) => products.find((item) => item.id === option.value)?.verificationStatus === "verified")} title="Choose products for this collection" placeholder="Search verified products" /></FieldLabel><Button type="submit" loading={busy === "collection"}>Save collection</Button></form></Card></div></TabPanel>
    <TabPanel idPrefix="admin-catalog-governance" value={tab} tabValue="sources">{sources.length ? <div className="grid gap-3 lg:grid-cols-2">{sources.map((item) => <Card key={item.id} variant="bordered" className="p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-admin" /><div className="min-w-0"><p className="font-semibold">{item.sourceName || item.id}</p><p className="mt-1 text-sm text-secondary">{item.sourceType || "source"} · rights: {item.rightsStatus || "not recorded"}</p><p className="mt-2 text-xs leading-5 text-tertiary">{(item.allowedUses || []).join(" · ") || "No approved uses recorded"}</p></div></div></Card>)}</div> : <EmptyState icon={ShieldCheck} title="No catalogue sources configured" description="Field collection, merchant feeds, manufacturers, distributors, partners, and reference-only public research sources should be registered here." />}</TabPanel>
  </div>;
}
