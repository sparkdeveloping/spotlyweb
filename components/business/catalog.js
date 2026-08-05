"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Barcode,
  BookOpenCheck,
  Check,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  ImagePlus,
  PackageCheck,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UploadCloud
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { formatCurrency } from "@/lib/format";
import { removeProduct, saveProduct, uploadFile } from "@/lib/firebase-services";
import {
  duplicateProduct,
  importCatalogTemplate,
  quickAddProducts,
  updateProductAvailability
} from "@/lib/business-services";
import { businessCategories, emptyProduct } from "@/data/business-config";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, ConfirmDialog, FieldLabel, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";

function productPrice(product) {
  return Number(product.price ?? product.prices?.[product.currency || "USD"] ?? 0);
}

function ProductModal({ product, open, onClose }) {
  const { selectedBusinessId, user, branches } = useBusinessWorkspace();
  const [form, setForm] = useState(product || emptyProduct);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(product ? { ...emptyProduct, ...product } : { ...emptyProduct });
  }, [open, product]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await saveProduct({
        ...form,
        price: Number(form.price || 0),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
        stockQuantity: Number(form.stockQuantity || 0),
        branchIds: form.branchIds || branches.map((branch) => branch.id),
        prices: { ...(form.prices || {}), [form.currency || "USD"]: Number(form.price || 0) }
      }, selectedBusinessId, user);
      toast(product ? "Product changes saved." : "Product added to the catalog.", { title: "Catalog updated" });
      onClose();
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not save product" });
    } finally { setLoading(false); }
  }

  const update = (values) => setForm((current) => ({ ...current, ...values }));
  async function chooseImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choose a JPG, PNG, WEBP, or another image file.", { type: "error", title: "Image required" });
    if (file.size > 8 * 1024 * 1024) return toast("Product images must be smaller than 8 MB.", { type: "error", title: "Image too large" });
    setUploadingImage(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const url = await uploadFile(`businesses/${selectedBusinessId}/catalog/${crypto.randomUUID()}.${extension}`, file, { businessId: selectedBusinessId, kind: "product_image" });
      update({ image: url });
      toast("Product image uploaded.", { title: "Image ready" });
    } catch (error) { toast(error.message, { type: "error", title: "Image upload failed" }); }
    finally { setUploadingImage(false); }
  }
  return <Modal open={open} onClose={onClose} title={product ? "Edit product" : "Add product"} size="lg">
    <form onSubmit={submit} className="space-y-5 p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <FieldLabel label="Product name" required hint="Use the name customers will search for."><input required value={form.name || ""} onChange={(event) => update({ name: event.target.value })} className={fieldClass} autoFocus /></FieldLabel>
        <FieldLabel label="Status"><select value={form.active === false ? "paused" : "active"} onChange={(event) => update({ active: event.target.value === "active" })} className={selectClass}><option value="active">Active</option><option value="paused">Paused</option></select></FieldLabel>
      </div>
      <FieldLabel label="Description" hint="Include size, brand, pack count, flavour, or other details that prevent confusion."><textarea value={form.description || ""} onChange={(event) => update({ description: event.target.value })} className={textAreaClass} /></FieldLabel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FieldLabel label="Category" required><input required value={form.category || ""} onChange={(event) => update({ category: event.target.value })} className={fieldClass} list="spotly-product-categories" /><datalist id="spotly-product-categories">{businessCategories.map((item) => <option key={item} value={item} />)}</datalist></FieldLabel>
        <FieldLabel label="SKU"><input value={form.sku || ""} onChange={(event) => update({ sku: event.target.value })} className={fieldClass} autoComplete="off" /></FieldLabel>
        <FieldLabel label="Barcode"><input value={form.barcode || ""} onChange={(event) => update({ barcode: event.target.value })} className={fieldClass} inputMode="numeric" autoComplete="off" /></FieldLabel>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldLabel label="Currency"><select value={form.currency || "USD"} onChange={(event) => update({ currency: event.target.value })} className={selectClass}><option value="USD">USD</option><option value="ZWG">ZiG (ZWG)</option></select></FieldLabel>
        <FieldLabel label="Selling price" required><input required type="number" min="0" step="0.01" value={form.price ?? ""} onChange={(event) => update({ price: event.target.value })} className={fieldClass} /></FieldLabel>
        <FieldLabel label="Compare-at price" hint="Optional previous price."><input type="number" min="0" step="0.01" value={form.compareAtPrice ?? ""} onChange={(event) => update({ compareAtPrice: event.target.value })} className={fieldClass} /></FieldLabel>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldLabel label="Stock tracking"><select value={form.stockMode || "status"} onChange={(event) => update({ stockMode: event.target.value })} className={selectClass}><option value="status">Simple availability</option><option value="quantity">Exact quantity</option></select></FieldLabel>
        <FieldLabel label="Availability"><select value={form.stockStatus || "in_stock"} onChange={(event) => update({ stockStatus: event.target.value })} className={selectClass}><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="unavailable">Unavailable</option></select></FieldLabel>
        <FieldLabel label="Quantity" hint={form.stockMode === "quantity" ? "Used for stock alerts." : "Optional reference."}><input type="number" min="0" value={form.stockQuantity ?? 0} onChange={(event) => update({ stockQuantity: event.target.value })} className={fieldClass} /></FieldLabel>
      </div>
      <FieldLabel label="Product image" hint="Upload an image you own or are allowed to use. Spotly stores it with this business."><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-business-soft text-business" style={form.image ? { backgroundImage: `url(${form.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!form.image && <ImagePlus className="h-6 w-6" />}</span><div className="flex-1"><label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold transition hover:bg-grouped ${uploadingImage ? "pointer-events-none opacity-60" : ""}`}><UploadCloud className="h-4 w-4" />{uploadingImage ? "Uploading image…" : form.image ? "Replace image" : "Upload image"}<input type="file" accept="image/*" className="sr-only" onChange={chooseImage} disabled={uploadingImage} /></label>{form.image && <button type="button" onClick={() => update({ image: "" })} className="ml-3 text-sm font-semibold text-danger">Remove</button>}<p className="mt-2 text-xs text-tertiary">Maximum 8 MB. Square or landscape images work best.</p></div></div></FieldLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={form.pickupEligible !== false} onChange={(event) => update({ pickupEligible: event.target.checked })} /><span><span className="block text-sm font-semibold">Available for pickup</span><span className="mt-1 block text-xs leading-5 text-secondary">Customers can add this item to grocery pickup orders.</span></span></label>
        <label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={form.substitutionAllowed !== false} onChange={(event) => update({ substitutionAllowed: event.target.checked })} /><span><span className="block text-sm font-semibold">Allow substitutions</span><span className="mt-1 block text-xs leading-5 text-secondary">The pickup team may suggest a comparable item when unavailable.</span></span></label>
      </div>
      <Button type="submit" loading={loading} className="w-full"><Check className="h-4 w-4" />{product ? "Save product" : "Add product"}</Button>
    </form>
  </Modal>;
}

function QuickAddModal({ open, onClose }) {
  const { selectedBusinessId, user } = useBusinessWorkspace();
  const [rows, setRows] = useState(Array.from({ length: 5 }, () => ({ name: "", category: "Groceries", price: "", currency: "USD", stockStatus: "in_stock" })));
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const updateRow = (index, values) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...values } : row));
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const count = await quickAddProducts(rows, selectedBusinessId, user);
      toast(`${count} product${count === 1 ? "" : "s"} added.`, { title: "Quick add complete" });
      setRows(Array.from({ length: 5 }, () => ({ name: "", category: "Groceries", price: "", currency: "USD", stockStatus: "in_stock" })));
      onClose();
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not add products" });
    } finally { setLoading(false); }
  }
  return <Modal open={open} onClose={onClose} title="Quick add products" size="xl"><form onSubmit={submit} className="p-5"><p className="text-sm leading-6 text-secondary">Add the essential information now. Descriptions, images, SKUs, and exact stock can be completed later.</p><div className="mt-5 overflow-x-auto rounded-2xl border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-grouped text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-3 py-3">Product name</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Currency</th><th className="px-3 py-3">Price</th><th className="px-3 py-3">Availability</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t"><td className="p-2"><input value={row.name} onChange={(event) => updateRow(index, { name: event.target.value })} className="h-11 w-full rounded-xl border px-3 outline-none" placeholder={`Product ${index + 1}`} /></td><td className="p-2"><input value={row.category} onChange={(event) => updateRow(index, { category: event.target.value })} className="h-11 w-full rounded-xl border px-3 outline-none" /></td><td className="p-2"><select value={row.currency} onChange={(event) => updateRow(index, { currency: event.target.value })} className="h-11 w-full rounded-xl border px-3"><option>USD</option><option>ZWG</option></select></td><td className="p-2"><input type="number" min="0" step="0.01" value={row.price} onChange={(event) => updateRow(index, { price: event.target.value })} className="h-11 w-full rounded-xl border px-3 outline-none" /></td><td className="p-2"><select value={row.stockStatus} onChange={(event) => updateRow(index, { stockStatus: event.target.value })} className="h-11 w-full rounded-xl border px-3"><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="unavailable">Unavailable</option></select></td></tr>)}</tbody></table></div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="outline" onClick={() => setRows((current) => [...current, ...Array.from({ length: 3 }, () => ({ name: "", category: "Groceries", price: "", currency: "USD", stockStatus: "in_stock" }))])}><Plus className="h-4 w-4" />Add more rows</Button><Button type="submit" loading={loading}><Check className="h-4 w-4" />Save products</Button></div></form></Modal>;
}

function TemplateModal({ open, onClose }) {
  const { templates, selectedBusinessId, user } = useBusinessWorkspace();
  const [selected, setSelected] = useState([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  async function submit() {
    if (!selected.length) return toast("Choose at least one catalog section.", { type: "error", title: "Nothing selected" });
    setLoading(true);
    try {
      let created = 0;
      let skipped = 0;
      for (const id of selected) {
        const template = templates.find((item) => item.id === id);
        const result = await importCatalogTemplate(template, selectedBusinessId, user, { currency, active: false });
        created += result.created;
        skipped += result.skipped;
      }
      toast(`${created} product${created === 1 ? "" : "s"} prepared${skipped ? ` · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""}.`, { title: "Template imported" });
      setSelected([]);
      onClose();
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not import template" });
    } finally { setLoading(false); }
  }
  return <Modal open={open} onClose={onClose} title="Start from a catalog template" size="lg"><div className="p-5"><div className="rounded-2xl bg-business-soft p-4"><div className="flex items-center gap-2 font-bold text-business-strong"><Sparkles className="h-5 w-5" />Spotly prepares the product names and categories.</div><p className="mt-2 text-sm leading-6 text-business-strong">Imported products start paused so your team only needs to add accurate prices, images, sizes, and availability before publishing.</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{templates.map((template) => <label key={template.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${selected.includes(template.id) ? "border-business bg-business-soft" : "hover:bg-grouped"}`}><input type="checkbox" className="mt-1" checked={selected.includes(template.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, template.id] : selected.filter((id) => id !== template.id))} /><span><span className="block font-semibold">{template.name}</span><span className="mt-1 block text-xs text-secondary">{template.products?.length || 0} suggested products</span></span></label>)}</div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]"><FieldLabel label="Default currency"><select value={currency} onChange={(event) => setCurrency(event.target.value)} className={selectClass}><option value="USD">USD</option><option value="ZWG">ZiG (ZWG)</option></select></FieldLabel><Button className="self-end" onClick={submit} loading={loading}><Download className="h-4 w-4" />Import {selected.length || "selected"}</Button></div></div></Modal>;
}

function CsvModal({ open, onClose }) {
  const { selectedBusinessId, user } = useBusinessWorkspace();
  const [text, setText] = useState("name,category,price,currency,sku,stock\n");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  async function submit(event) {
    event.preventDefault();
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return toast("Paste at least one product row below the header.", { type: "error" });
    const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
    const products = lines.slice(1).map((line) => {
      const values = line.split(",").map((item) => item.trim());
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
      return { name: row.name, category: row.category || "Groceries", price: row.price || 0, currency: row.currency || "USD", sku: row.sku || "", stockStatus: row.stock || "in_stock" };
    });
    setLoading(true);
    try {
      const count = await quickAddProducts(products, selectedBusinessId, user);
      toast(`${count} products imported from CSV.`, { title: "Import complete" });
      onClose();
    } catch (error) { toast(error.message, { type: "error", title: "Import failed" }); }
    finally { setLoading(false); }
  }
  return <Modal open={open} onClose={onClose} title="Paste a CSV product list" size="lg"><form onSubmit={submit} className="space-y-4 p-5"><p className="text-sm leading-6 text-secondary">Use the columns shown below. Commas inside product names are not supported in this quick importer; use a standard spreadsheet export for clean results.</p><textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-[320px] w-full rounded-2xl border p-4 font-mono text-sm outline-none" spellCheck="false" /><Button type="submit" className="w-full" loading={loading}><UploadCloud className="h-4 w-4" />Import products</Button></form></Modal>;
}

export function CatalogView() {
  const { products, selectedBusinessId, user } = useBusinessWorkspace();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState(null);
  const [productOpen, setProductOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [busyId, setBusyId] = useState("");

  const categories = useMemo(() => ["all", ...new Set(products.map((item) => item.category).filter(Boolean))], [products]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => status === "all" || (status === "active" ? product.active !== false : status === "paused" ? product.active === false : product.stockStatus === status)).filter((product) => category === "all" || product.category === category).filter((product) => !term || [product.name, product.category, product.sku, product.barcode].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [products, query, status, category]);

  async function availability(product, value) {
    setBusyId(product.id);
    try {
      await updateProductAvailability(product.id, { stockStatus: value, active: value === "unavailable" ? product.active : true }, user);
      toast(`${product.name} is now ${value.replaceAll("_", " ")}.`, { title: "Availability updated" });
    } catch (error) { toast(error.message, { type: "error" }); }
    finally { setBusyId(""); }
  }

  async function duplicate(product) {
    setBusyId(product.id);
    try { await duplicateProduct(product, user); toast("A paused copy was created.", { title: "Product duplicated" }); }
    catch (error) { toast(error.message, { type: "error" }); }
    finally { setBusyId(""); }
  }

  async function remove() {
    if (!removeTarget) return;
    setBusyId(removeTarget.id);
    try { await removeProduct(removeTarget.id, user); toast("Product removed from the catalog.", { title: "Product deleted" }); setRemoveTarget(null); }
    catch (error) { toast(error.message, { type: "error", title: "Could not delete product" }); }
    finally { setBusyId(""); }
  }

  function openProduct(product = null) {
    setEditing(product);
    setProductOpen(true);
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader title="Catalog" description="Products, prices, images, stock, substitutions, and pickup eligibility." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTemplateOpen(true)}><Sparkles className="h-4 w-4" />Use template</Button><Button variant="outline" onClick={() => setQuickOpen(true)}><FileSpreadsheet className="h-4 w-4" />Quick add</Button><Button onClick={() => openProduct()}><Plus className="h-4 w-4" />Add product</Button></div>} /><BusinessSwitcher /></div>

    <Card className="p-5"><div className="grid gap-4 xl:grid-cols-[1fr_auto_auto]"><SearchField value={query} onChange={setQuery} placeholder="Search product name, category, SKU, or barcode" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="surface h-[52px] rounded-2xl px-4 text-sm font-semibold"><option value="all">All categories</option>{categories.filter((item) => item !== "all").map((item) => <option key={item} value={item}>{item}</option>)}</select><Button variant="outline" onClick={() => setCsvOpen(true)}><UploadCloud className="h-4 w-4" />Import CSV</Button></div><div className="mt-4"><Tabs value={status} onChange={setStatus} tabs={[{ value: "all", label: `All (${products.length})` }, { value: "active", label: `Active (${products.filter((item) => item.active !== false).length})` }, { value: "paused", label: `Paused (${products.filter((item) => item.active === false).length})` }, { value: "low_stock", label: `Low stock (${products.filter((item) => item.stockStatus === "low_stock").length})` }, { value: "unavailable", label: `Unavailable (${products.filter((item) => item.stockStatus === "unavailable").length})` }]} /></div></Card>

    <SectionCard>
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Availability</th><th className="px-5 py-3">Pickup</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((product) => <tr key={product.id} className="border-t hover:bg-[var(--surface-2)]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-business-soft text-business">{product.image ? <span role="img" aria-label={`${product.name} product image`} className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${product.image})` }} /> : <PackageCheck className="h-5 w-5" />}</span><div className="min-w-0"><p className="max-w-[280px] truncate font-bold">{product.name}</p><p className="mt-1 text-xs text-secondary">{product.sku || product.barcode || "No SKU or barcode"}</p></div></div></td><td className="px-5 py-4">{product.category || "General"}</td><td className="px-5 py-4"><p className="font-bold">{formatCurrency(productPrice(product), product.currency || "USD")}</p>{product.compareAtPrice && <p className="mt-1 text-xs text-tertiary line-through">{formatCurrency(product.compareAtPrice, product.currency || "USD")}</p>}</td><td className="px-5 py-4"><select aria-label={`Availability for ${product.name}`} value={product.stockStatus || "in_stock"} onChange={(event) => availability(product, event.target.value)} disabled={busyId === product.id} className="h-10 rounded-xl border bg-white px-3 text-sm font-semibold"><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="unavailable">Unavailable</option></select>{product.stockMode === "quantity" && <p className="mt-2 text-xs text-secondary">{Number(product.stockQuantity || 0)} units</p>}</td><td className="px-5 py-4">{product.pickupEligible !== false ? <Badge tone="success">Eligible</Badge> : <Badge tone="neutral">Not eligible</Badge>}</td><td className="px-5 py-4"><StatusBadge status={product.active === false ? "Paused" : "Active"} /></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => duplicate(product)} loading={busyId === product.id} aria-label={`Duplicate ${product.name}`}><Copy className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => openProduct(product)} aria-label={`Edit ${product.name}`}><Edit3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setRemoveTarget(product)} aria-label={`Delete ${product.name}`}><Trash2 className="h-4 w-4 text-danger" /></Button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={BookOpenCheck} title={query || category !== "all" || status !== "all" ? "No products match this view" : "Build the first useful catalog"} description={query || category !== "all" || status !== "all" ? "Clear a filter or try a different product name, category, SKU, or barcode." : "Start from a prepared grocery template, add several essentials quickly, paste a CSV, or add one detailed product."} action={!query && category === "all" && status === "all" && <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => setTemplateOpen(true)}><Sparkles className="h-4 w-4" />Use a template</Button><Button variant="outline" onClick={() => setQuickOpen(true)}><Plus className="h-4 w-4" />Quick add</Button></div>} />}
    </SectionCard>

    <ProductModal product={editing} open={productOpen} onClose={() => setProductOpen(false)} />
    <QuickAddModal open={quickOpen} onClose={() => setQuickOpen(false)} />
    <TemplateModal open={templateOpen} onClose={() => setTemplateOpen(false)} />
    <CsvModal open={csvOpen} onClose={() => setCsvOpen(false)} />
    <ConfirmDialog open={Boolean(removeTarget)} onClose={() => setRemoveTarget(null)} title="Delete this product?" description={`${removeTarget?.name || "This product"} will be removed from the catalog. Existing order records keep their own product snapshot.`} confirmLabel="Delete product" danger loading={busyId === removeTarget?.id} onConfirm={remove} />
  </div>;
}
