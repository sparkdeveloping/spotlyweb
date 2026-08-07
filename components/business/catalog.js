"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Edit3,
  FileSpreadsheet,
  ImagePlus,
  MapPin,
  PackageCheck,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
  UsersRound
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchField, SectionCard, StatusBadge, TabPanel, Tabs } from "@/components/ui";
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
import { BusinessSwitcher, ConfirmDialog, FieldLabel, FullScreenTask, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";

function productPrice(product) {
  const value = Number(product.price ?? product.prices?.[product.currency || "USD"]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function priceLabel(product) {
  const value = productPrice(product);
  return value ? formatCurrency(value, product.currency || "USD") : "Price required";
}

function dateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function itemDefaults(archetype) {
  const isPickup = archetype.capabilities.includes("pickup_orders");
  const itemType = archetype.id === "ticketing_events" ? "ticket" : archetype.id === "appointments_services" ? "service" : archetype.id === "accommodation_activities" ? "listing" : "product";
  return {
    ...emptyProduct,
    category: archetype.categoryHints?.[0] || "General",
    itemType,
    pickupEligible: isPickup,
    substitutionAllowed: isPickup && archetype.id === "grocery_retail",
    requiresBusinessReview: archetype.id === "directory_profile"
  };
}

function OfferingModal({ product, open, onClose }) {
  const { selectedBusinessId, user, branches, selectedBranchId, archetype } = useBusinessWorkspace();
  const defaults = useMemo(() => itemDefaults(archetype), [archetype]);
  const isInventory = archetype.capabilities.includes("inventory") || archetype.capabilities.includes("menu");
  const isPickup = archetype.capabilities.includes("pickup_orders");
  const isTicket = archetype.id === "ticketing_events";
  const isAppointment = archetype.id === "appointments_services";
  const isBooking = archetype.id === "accommodation_activities";
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [task, setTask] = useState({ open: false, state: "processing", title: "", description: "", active: 0 });
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setForm(product
      ? { ...defaults, ...product, startsAt: dateTimeValue(product.startsAt), endsAt: dateTimeValue(product.endsAt) }
      : { ...defaults, branchIds: selectedBranchId ? [selectedBranchId] : branches.map((branch) => branch.id) });
  }, [open, product, defaults, selectedBranchId, branches]);

  const update = (values) => setForm((current) => ({ ...current, ...values }));
  const toggleBranch = (id) => update({ branchIds: (form.branchIds || []).includes(id) ? form.branchIds.filter((item) => item !== id) : [...(form.branchIds || []), id] });

  async function chooseImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choose an image file.", { type: "error", title: "Image required" });
    if (file.size > 8 * 1024 * 1024) return toast("Images must be smaller than 8 MB.", { type: "error", title: "Image too large" });
    setUploadingImage(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const url = await uploadFile(`businesses/${selectedBusinessId}/catalog/${crypto.randomUUID()}.${extension}`, file, { businessId: selectedBusinessId, kind: "offering_image" });
      update({ image: url });
      toast("Image uploaded.", { title: "Image ready" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Image upload failed" });
    } finally {
      setUploadingImage(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    const noun = archetype.nouns.item;
    setTask({ open: true, state: "processing", title: product ? `Updating ${noun}` : `Creating ${noun}`, description: "Spotly is validating the customer-facing details and location availability.", active: 1 });
    try {
      await saveProduct({
        ...form,
        price: Number(form.price || 0),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
        stockQuantity: Number(form.stockQuantity || 0),
        durationMinutes: Number(form.durationMinutes || 0),
        capacity: Number(form.capacity || 0),
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        branchIds: form.branchIds?.length ? form.branchIds : branches.map((branch) => branch.id),
        prices: { ...(form.prices || {}), [form.currency || "USD"]: Number(form.price || 0) }
      }, selectedBusinessId, user);
      setTask({ open: true, state: "success", title: `${noun[0].toUpperCase()}${noun.slice(1)} saved`, description: "The latest details are now available across the business workspace.", active: 4 });
      toast(product ? "Changes saved." : `${noun[0].toUpperCase()}${noun.slice(1)} added.`, { title: `${archetype.nouns.catalog} updated` });
    } catch (error) {
      setTask({ open: true, state: "error", title: `Could not save this ${noun}`, description: error.message, active: 1 });
    } finally {
      setLoading(false);
    }
  }

  function finishTask() {
    const succeeded = task.state === "success";
    setTask((current) => ({ ...current, open: false }));
    if (succeeded) onClose();
  }

  const noun = archetype.nouns.item;
  return <>
    <Modal open={open && !task.open} onClose={onClose} title={product ? `Edit ${noun}` : `Add ${noun}`} size="xl">
      <form onSubmit={submit} className="space-y-6 p-5">
        <div className="rounded-2xl bg-business-soft p-4"><p className="text-sm font-bold">{archetype.label}</p><p className="mt-1 text-xs leading-5 text-secondary">Only fields relevant to this business model are shown. You can change the business type from Setup centre.</p></div>
        <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
          <FieldLabel label={`${noun[0].toUpperCase()}${noun.slice(1)} name`} required hint="Use the name a customer will recognize and search for."><input required value={form.name || ""} onChange={(event) => update({ name: event.target.value })} className={fieldClass} autoFocus /></FieldLabel>
          <FieldLabel label="Visibility"><select value={form.active === false ? "paused" : "active"} onChange={(event) => update({ active: event.target.value === "active" })} className={selectClass}><option value="active">Visible</option><option value="paused">Hidden</option></select></FieldLabel>
        </div>
        <FieldLabel label="Description" hint={isInventory ? "Include size, pack, flavour, preparation details, or anything that prevents confusion." : "Explain exactly what the customer receives, what is included, and any important conditions."}><textarea value={form.description || ""} onChange={(event) => update({ description: event.target.value })} className={textAreaClass} /></FieldLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldLabel label="Category" required><input required value={form.category || ""} onChange={(event) => update({ category: event.target.value })} className={fieldClass} list="spotly-offering-categories" /><datalist id="spotly-offering-categories">{businessCategories.map((item) => <option key={item} value={item} />)}</datalist></FieldLabel>
          <FieldLabel label="Currency"><select value={form.currency || "USD"} onChange={(event) => update({ currency: event.target.value })} className={selectClass}><option value="USD">USD</option><option value="ZWG">ZiG (ZWG)</option></select></FieldLabel>
          <FieldLabel label={archetype.id === "directory_profile" ? "Price, if applicable" : "Price"} required={archetype.id !== "directory_profile"}><input required={archetype.id !== "directory_profile"} type="number" min="0" step="0.01" value={form.price ?? ""} onChange={(event) => update({ price: event.target.value })} className={fieldClass} /></FieldLabel>
        </div>

        {isInventory && <div className="space-y-4 rounded-2xl border p-4"><div><h3 className="font-bold">Availability and stock</h3><p className="mt-1 text-xs text-secondary">Keep the customer promise accurate without forcing exact inventory when the business does not use it.</p></div><div className="grid gap-4 sm:grid-cols-3"><FieldLabel label="Tracking"><select value={form.stockMode || "status"} onChange={(event) => update({ stockMode: event.target.value })} className={selectClass}><option value="status">Availability only</option><option value="quantity">Exact quantity</option></select></FieldLabel><FieldLabel label="Availability"><select value={form.stockStatus || "in_stock"} onChange={(event) => update({ stockStatus: event.target.value })} className={selectClass}><option value="in_stock">Available</option><option value="low_stock">Limited</option><option value="unavailable">Unavailable</option></select></FieldLabel><FieldLabel label="Quantity" hint={form.stockMode === "quantity" ? "Used for stock alerts." : "Optional reference."}><input type="number" min="0" value={form.stockQuantity ?? 0} onChange={(event) => update({ stockQuantity: event.target.value })} className={fieldClass} /></FieldLabel></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="SKU"><input value={form.sku || ""} onChange={(event) => update({ sku: event.target.value })} className={fieldClass} autoComplete="off" /></FieldLabel><FieldLabel label="Barcode"><input value={form.barcode || ""} onChange={(event) => update({ barcode: event.target.value })} className={fieldClass} inputMode="numeric" autoComplete="off" /></FieldLabel></div></div>}

        {isTicket && <div className="space-y-4 rounded-2xl border p-4"><div><h3 className="font-bold">Event and admission</h3><p className="mt-1 text-xs text-secondary">The venue is a location under the business. Ticket types stay inside this event catalogue.</p></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Starts"><input type="datetime-local" value={form.startsAt || ""} onChange={(event) => update({ startsAt: event.target.value })} className={fieldClass} /></FieldLabel><FieldLabel label="Ends"><input type="datetime-local" value={form.endsAt || ""} onChange={(event) => update({ endsAt: event.target.value })} className={fieldClass} /></FieldLabel><FieldLabel label="Venue or area"><input value={form.venue || ""} onChange={(event) => update({ venue: event.target.value })} className={fieldClass} placeholder="Main stage, hall, or venue" /></FieldLabel><FieldLabel label="Ticket capacity"><input type="number" min="0" value={form.capacity || 0} onChange={(event) => update({ capacity: event.target.value })} className={fieldClass} /></FieldLabel></div></div>}

        {isAppointment && <div className="space-y-4 rounded-2xl border p-4"><div><h3 className="font-bold">Appointment details</h3><p className="mt-1 text-xs text-secondary">Define the normal session length and whether the team must approve each request.</p></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Duration in minutes"><input type="number" min="5" step="5" value={form.durationMinutes || 30} onChange={(event) => update({ durationMinutes: event.target.value })} className={fieldClass} /></FieldLabel><FieldLabel label="People per slot"><input type="number" min="1" value={form.capacity || 1} onChange={(event) => update({ capacity: event.target.value })} className={fieldClass} /></FieldLabel></div><label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={Boolean(form.requiresBusinessReview)} onChange={(event) => update({ requiresBusinessReview: event.target.checked })} /><span><span className="block text-sm font-semibold">Approve requests before confirming</span><span className="mt-1 block text-xs text-secondary">Useful when staff schedules or service details require a manual check.</span></span></label></div>}

        {isBooking && <div className="space-y-4 rounded-2xl border p-4"><div><h3 className="font-bold">Booking details</h3><p className="mt-1 text-xs text-secondary">Use capacity for rooms, seats, participants, or another bookable unit.</p></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Capacity"><input type="number" min="1" value={form.capacity || 1} onChange={(event) => update({ capacity: event.target.value })} className={fieldClass} /></FieldLabel><FieldLabel label="Typical duration in minutes"><input type="number" min="0" value={form.durationMinutes || 0} onChange={(event) => update({ durationMinutes: event.target.value })} className={fieldClass} placeholder="Leave 0 for overnight stays" /></FieldLabel></div><label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={Boolean(form.requiresBusinessReview)} onChange={(event) => update({ requiresBusinessReview: event.target.checked })} /><span><span className="block text-sm font-semibold">Approve requests before confirming</span><span className="mt-1 block text-xs text-secondary">Spotly will collect the request without promising unavailable capacity.</span></span></label></div>}

        {isPickup && <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={form.pickupEligible !== false} onChange={(event) => update({ pickupEligible: event.target.checked })} /><span><span className="block text-sm font-semibold">Available for pickup</span><span className="mt-1 block text-xs leading-5 text-secondary">Customers can include this item in a pickup order.</span></span></label>{archetype.id === "grocery_retail" && <label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input type="checkbox" className="mt-1" checked={form.substitutionAllowed !== false} onChange={(event) => update({ substitutionAllowed: event.target.checked })} /><span><span className="block text-sm font-semibold">Allow substitutions</span><span className="mt-1 block text-xs leading-5 text-secondary">The team can suggest a comparable item when this one is unavailable.</span></span></label>}</div>}

        {branches.length > 0 && <div><p className="text-sm font-semibold">Available at</p><p className="mt-1 text-xs text-secondary">Choose the exact locations where customers can use this offering.</p><div className="mt-3 flex flex-wrap gap-2">{branches.map((branch) => { const selected = (form.branchIds || []).includes(branch.id); return <button type="button" key={branch.id} onClick={() => toggleBranch(branch.id)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${selected ? "border-business bg-business-soft text-business" : "bg-[var(--surface)] text-secondary"}`}><MapPin className="h-4 w-4" />{branch.branchName || branch.name}{selected && <Check className="h-3.5 w-3.5" />}</button>; })}</div></div>}

        <FieldLabel label={`${noun[0].toUpperCase()}${noun.slice(1)} image`} hint="Upload an image you own or are allowed to use."><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-business-soft text-business" style={form.image ? { backgroundImage: `url(${form.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!form.image && <ImagePlus className="h-6 w-6" />}</span><div className="flex-1"><label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-[var(--surface)] px-4 text-sm font-semibold transition hover:bg-grouped ${uploadingImage ? "pointer-events-none opacity-60" : ""}`}><UploadCloud className="h-4 w-4" />{uploadingImage ? "Uploading…" : form.image ? "Replace image" : "Upload image"}<input type="file" accept="image/*" className="sr-only" onChange={chooseImage} disabled={uploadingImage} /></label>{form.image && <button type="button" onClick={() => update({ image: "" })} className="ml-3 text-sm font-semibold text-danger">Remove</button>}<p className="mt-2 text-xs text-tertiary">Maximum 8 MB. Square or landscape images work best.</p></div></div></FieldLabel>
        <Button type="submit" loading={loading} className="w-full"><Check className="h-4 w-4" />Save {noun}</Button>
      </form>
    </Modal>
    <FullScreenTask open={task.open} state={task.state} title={task.title} description={task.description} steps={["Validate customer details", "Save pricing and availability", "Attach selected locations", "Refresh the live workspace"]} activeStep={task.active} onDone={finishTask} doneLabel={task.state === "success" ? `Return to ${archetype.nouns.catalog}` : "Review details"} />
  </>;
}

function QuickAddModal({ open, onClose }) {
  const { selectedBusinessId, user, archetype, selectedBranchId } = useBusinessWorkspace();
  const starterCategory = archetype.categoryHints?.[0] || "General";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setRows(Array.from({ length: 5 }, () => ({ name: "", category: starterCategory, price: "", currency: "USD", stockStatus: "in_stock", branchIds: selectedBranchId ? [selectedBranchId] : [] })));
  }, [open, starterCategory, selectedBranchId]);

  const updateRow = (index, values) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...values } : row));
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const count = await quickAddProducts(rows.map((row) => ({ ...row, itemType: itemDefaults(archetype).itemType, pickupEligible: archetype.capabilities.includes("pickup_orders"), substitutionAllowed: archetype.id === "grocery_retail" })), selectedBusinessId, user);
      toast(`${count} ${count === 1 ? archetype.nouns.item : archetype.nouns.items} added.`, { title: "Quick add complete" });
      onClose();
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not add items" });
    } finally {
      setLoading(false);
    }
  }

  return <Modal open={open} onClose={onClose} title={`Quick add ${archetype.nouns.items}`} size="xl"><form onSubmit={submit} className="space-y-4 p-5"><p className="text-sm leading-6 text-secondary">Add the essentials first. Open any row later to add images, schedules, capacity, or detailed availability.</p><div className="space-y-3">{rows.map((row, index) => <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_120px_100px]"><input aria-label={`${archetype.nouns.item} ${index + 1} name`} placeholder={`${archetype.nouns.item[0].toUpperCase()}${archetype.nouns.item.slice(1)} name`} className={fieldClass} value={row.name} onChange={(event) => updateRow(index, { name: event.target.value })} /><input aria-label={`${archetype.nouns.item} ${index + 1} category`} placeholder="Category" className={fieldClass} value={row.category} onChange={(event) => updateRow(index, { category: event.target.value })} /><input aria-label={`${archetype.nouns.item} ${index + 1} price`} type="number" min="0" step="0.01" placeholder="Price" className={fieldClass} value={row.price} onChange={(event) => updateRow(index, { price: event.target.value })} /><select aria-label={`${archetype.nouns.item} ${index + 1} currency`} className={selectClass} value={row.currency} onChange={(event) => updateRow(index, { currency: event.target.value })}><option value="USD">USD</option><option value="ZWG">ZiG</option></select></div>)}</div><Button type="submit" className="w-full" loading={loading}><Plus className="h-4 w-4" />Add completed rows</Button></form></Modal>;
}

function TemplateModal({ open, onClose }) {
  const { templates, selectedBusinessId, user, archetype, selectedBranchId } = useBusinessWorkspace();
  const [loading, setLoading] = useState("");
  const { toast } = useToast();
  const relevant = useMemo(() => templates.filter((template) => !template.businessTypes?.length || template.businessTypes.includes(archetype.id)), [templates, archetype.id]);

  async function apply(template) {
    setLoading(template.id);
    try {
      const result = await importCatalogTemplate(template, selectedBusinessId, user, {
        currency: "USD",
        active: false,
        pickupEligible: archetype.capabilities.includes("pickup_orders"),
        substitutionAllowed: archetype.id === "grocery_retail",
        branchIds: selectedBranchId ? [selectedBranchId] : []
      });
      toast(`${result.created} draft ${result.created === 1 ? archetype.nouns.item : archetype.nouns.items} created. Review names, prices, and availability before publishing.`, { title: "Starter applied", duration: 6000 });
      onClose();
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not apply starter" });
    } finally {
      setLoading("");
    }
  }

  return <Modal open={open} onClose={onClose} title={`Start ${archetype.nouns.catalog.toLowerCase()} with a useful structure`} size="lg"><div className="space-y-3 p-5">{relevant.length ? relevant.map((template) => <Card key={template.id} className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-business-soft text-business"><Sparkles className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="font-bold">{template.name}</h3><p className="mt-1 text-sm leading-6 text-secondary">{template.description}</p><div className="mt-3 flex items-center gap-2"><Badge tone="neutral">{(template.products || template.items || []).length} drafts</Badge><Badge tone="warning">Prices need review</Badge></div></div><Button size="sm" onClick={() => apply(template)} loading={loading === template.id}>Use starter</Button></div></Card>) : <EmptyState icon={Sparkles} title="No starter is configured for this business type" description="Add the first offering manually or ask Spotly Support to publish a suitable starter." />}</div></Modal>;
}

function parseCsv(text, archetype, selectedBranchId) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes("name") && first.includes("price");
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((line) => {
    const [name, category, price, currency = "USD", code = ""] = line.split(",").map((item) => item.trim());
    return {
      name,
      category: category || archetype.categoryHints?.[0] || "General",
      price: Number(price || 0),
      currency: currency || "USD",
      sku: code,
      itemType: itemDefaults(archetype).itemType,
      pickupEligible: archetype.capabilities.includes("pickup_orders"),
      substitutionAllowed: archetype.id === "grocery_retail",
      branchIds: selectedBranchId ? [selectedBranchId] : []
    };
  }).filter((item) => item.name);
}

function CsvModal({ open, onClose }) {
  const { selectedBusinessId, user, archetype, selectedBranchId } = useBusinessWorkspace();
  const [text, setText] = useState("name,category,price,currency,code\n");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  useEffect(() => { if (open) setText("name,category,price,currency,code\n"); }, [open]);
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const items = parseCsv(text, archetype, selectedBranchId);
      if (!items.length) throw new Error(`Add at least one ${archetype.nouns.item} row.`);
      const count = await quickAddProducts(items, selectedBusinessId, user);
      toast(`${count} ${count === 1 ? archetype.nouns.item : archetype.nouns.items} imported.`, { title: "Import complete" });
      onClose();
    } catch (error) {
      toast(error.message, { type: "error", title: "Import failed" });
    } finally {
      setLoading(false);
    }
  }
  return <Modal open={open} onClose={onClose} title={`Paste a CSV ${archetype.nouns.item} list`} size="lg"><form onSubmit={submit} className="space-y-4 p-5"><p className="text-sm leading-6 text-secondary">Use one row per {archetype.nouns.item}: <strong>name, category, price, currency, code</strong>. Detailed schedules and capacity can be added after import.</p><textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-[320px] w-full rounded-2xl border p-4 font-mono text-sm outline-none" spellCheck="false" /><Button type="submit" className="w-full" loading={loading}><UploadCloud className="h-4 w-4" />Import {archetype.nouns.items}</Button></form></Modal>;
}

function OfferingSummary({ item, archetype }) {
  if (archetype.id === "ticketing_events") return <div className="space-y-1 text-xs text-secondary">{item.startsAt && <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{new Date(item.startsAt).toLocaleString("en-ZW", { timeZone: "Africa/Harare", dateStyle: "medium", timeStyle: "short" })}</p>}{item.capacity > 0 && <p className="flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5" />{item.capacity} available</p>}</div>;
  if (archetype.id === "appointments_services") return <p className="flex items-center gap-1.5 text-xs text-secondary"><Clock3 className="h-3.5 w-3.5" />{item.durationMinutes || 30} minutes</p>;
  if (archetype.id === "accommodation_activities") return <p className="flex items-center gap-1.5 text-xs text-secondary"><UsersRound className="h-3.5 w-3.5" />Capacity {item.capacity || 1}</p>;
  return <p className="text-xs text-secondary">{item.sku || item.barcode || "No internal code"}</p>;
}

function MobileOfferingCard({ item, archetype, isInventory, isPickup, busyId, onAvailability, onDuplicate, onEdit, onDelete }) {
  return <article className="rounded-xl border bg-[var(--surface)] p-4">
    <div className="flex items-start gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-business-soft text-business">{item.image ? <span role="img" aria-label={`${item.name} image`} className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${item.image})` }} /> : <PackageCheck className="h-5 w-5" />}</span>
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-xs text-secondary">{item.category || "General"}</p></div><StatusBadge status={item.active === false ? "Hidden" : "Visible"} /></div><p className="mt-3 text-lg font-semibold">{priceLabel(item)}</p><div className="mt-1"><OfferingSummary item={item} archetype={archetype} /></div></div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {isInventory ? <label className="text-xs font-semibold text-secondary">Customer availability<select aria-label={`Availability for ${item.name}`} value={item.stockStatus || "in_stock"} onChange={(event) => onAvailability(item, event.target.value)} disabled={busyId === item.id} className="mt-1 h-11 w-full rounded-lg border bg-[var(--surface)] px-3 text-sm font-semibold"><option value="in_stock">Available</option><option value="low_stock">Limited</option><option value="unavailable">Unavailable</option></select></label> : <div><p className="text-xs font-semibold text-secondary">Customer availability</p><div className="mt-2">{item.requiresBusinessReview ? <Badge tone="warning">Approval required</Badge> : <Badge tone="success">Bookable</Badge>}</div></div>}
      {isPickup && <div><p className="text-xs font-semibold text-secondary">Pickup</p><div className="mt-2">{item.pickupEligible !== false ? <Badge tone="success">Enabled</Badge> : <Badge tone="neutral">Disabled</Badge>}</div></div>}
    </div>
    <div className="mt-4 flex gap-2 border-t pt-4"><Button size="sm" variant="outline" onClick={() => onEdit(item)} className="flex-1"><Edit3 className="h-4 w-4" />Edit</Button><Button size="sm" variant="ghost" onClick={() => onDuplicate(item)} loading={busyId === item.id}><Copy className="h-4 w-4" />Copy</Button><Button size="sm" variant="ghost" onClick={() => onDelete(item)} aria-label={`Delete ${item.name}`}><Trash2 className="h-4 w-4 text-danger" /></Button></div>
  </article>;
}

export function CatalogView() {
  const { products, user, archetype, selectedBranchId, selectedBusinessId } = useBusinessWorkspace();
  const { toast } = useToast();
  const [catalogMode, setCatalogMode] = useState("quick");
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState(null);
  const [productOpen, setProductOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [busyId, setBusyId] = useState("");
  const isInventory = archetype.capabilities.includes("inventory") || archetype.capabilities.includes("menu");
  const isPickup = archetype.capabilities.includes("pickup_orders");

  const scopedProducts = useMemo(() => products.filter((item) => !selectedBranchId || !(item.branchIds || []).length || item.branchIds.includes(selectedBranchId)), [products, selectedBranchId]);
  const categories = useMemo(() => ["all", ...new Set(scopedProducts.map((item) => item.category).filter(Boolean))], [scopedProducts]);
  const visible = useMemo(() => {
    const term = queryText.trim().toLowerCase();
    return scopedProducts
      .filter((item) => status === "all" || (status === "active" ? item.active !== false : status === "paused" ? item.active === false : item.stockStatus === status))
      .filter((item) => category === "all" || item.category === category)
      .filter((item) => !term || [item.name, item.category, item.sku, item.barcode, item.venue].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [scopedProducts, queryText, status, category]);

  async function availability(item, value) {
    setBusyId(item.id);
    try {
      await updateProductAvailability(item.id, { stockStatus: value }, user);
      toast(`${item.name} is now ${value.replaceAll("_", " ")}.`, { title: "Availability updated" });
    } catch (error) {
      toast(error.message, { type: "error" });
    } finally {
      setBusyId("");
    }
  }

  async function duplicate(item) {
    setBusyId(item.id);
    try {
      await duplicateProduct(item, user);
      toast("A hidden copy was created.", { title: `${archetype.nouns.item[0].toUpperCase()}${archetype.nouns.item.slice(1)} duplicated` });
    } catch (error) {
      toast(error.message, { type: "error" });
    } finally {
      setBusyId("");
    }
  }

  async function remove() {
    if (!removeTarget) return;
    setBusyId(removeTarget.id);
    try {
      await removeProduct(removeTarget.id, user);
      toast(`${archetype.nouns.item[0].toUpperCase()}${archetype.nouns.item.slice(1)} removed.`, { title: "Deleted" });
      setRemoveTarget(null);
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not delete" });
    } finally {
      setBusyId("");
    }
  }

  const missingPrice = scopedProducts.filter((item) => item.active !== false && !productPrice(item));
  const draftItems = scopedProducts.filter((item) => item.active === false || item.published === false);
  const importedItems = scopedProducts.filter((item) => item.source || item.importSource || item.templateId);

  async function publishReadyItems() {
    const ready = scopedProducts.filter((item) => item.active !== false && productPrice(item));
    if (!ready.length) {
      toast("Add a valid price and make at least one item visible before publishing.", { type: "error", title: "Nothing is ready" });
      return;
    }
    setBusyId("publish");
    try {
      await Promise.all(ready.map((item) => saveProduct({ ...item, published: true, publishedAt: new Date().toISOString() }, selectedBusinessId, user)));
      toast(`${ready.length} ${ready.length === 1 ? archetype.nouns.item : archetype.nouns.items} published for customer preview.`, { title: "Catalogue published" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not publish" });
    } finally {
      setBusyId("");
    }
  }

  function openOffering(item = null) {
    setEditing(item);
    setProductOpen(true);
  }

  const tabs = [
    { value: "all", label: `All (${scopedProducts.length})` },
    { value: "active", label: `Visible (${scopedProducts.filter((item) => item.active !== false).length})` },
    { value: "paused", label: `Hidden (${scopedProducts.filter((item) => item.active === false).length})` },
    ...(isInventory ? [
      { value: "low_stock", label: `Limited (${scopedProducts.filter((item) => item.stockStatus === "low_stock").length})` },
      { value: "unavailable", label: `Unavailable (${scopedProducts.filter((item) => item.stockStatus === "unavailable").length})` }
    ] : [])
  ];

  const catalogModes = [
    { value: "quick", label: "Quick updates" },
    { value: "manage", label: "Catalogue manager" },
    { value: "import", label: `Import review (${importedItems.length})` },
    { value: "publish", label: `Publishing (${draftItems.length})` }
  ];

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader title={archetype.nouns.catalog} description={`Create the ${archetype.nouns.items} customers can understand and act on at the selected ${archetype.nouns.branch}.`} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTemplateOpen(true)}><Sparkles className="h-4 w-4" />Use starter</Button><Button variant="outline" onClick={() => setQuickOpen(true)}><FileSpreadsheet className="h-4 w-4" />Quick add</Button><Button onClick={() => openOffering()}><Plus className="h-4 w-4" />Add {archetype.nouns.item}</Button></div>} /><BusinessSwitcher /></div>


    <Tabs idPrefix="catalog-mode" value={catalogMode} onChange={setCatalogMode} tabs={catalogModes} />

    <TabPanel idPrefix="catalog-mode" value={catalogMode} tabValue="quick">
      <Card variant="bordered" className="p-5"><div className="grid gap-4 xl:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder={`Search ${archetype.nouns.items}, category, or code`} /><select value={category} onChange={(event) => setCategory(event.target.value)} className="surface h-[52px] rounded-xl px-4 text-sm font-semibold"><option value="all">All categories</option>{categories.filter((item) => item !== "all").map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="mt-4"><Tabs idPrefix="catalog-status-quick" value={status} onChange={setStatus} tabs={tabs} /></div></Card>
      <div className="mt-5"><SectionCard>
      {visible.length ? <><div className="space-y-3 md:hidden">{visible.map((item) => <MobileOfferingCard key={item.id} item={item} archetype={archetype} isInventory={isInventory} isPickup={isPickup} busyId={busyId} onAvailability={availability} onDuplicate={duplicate} onEdit={openOffering} onDelete={setRemoveTarget} />)}</div><div className="hidden overflow-x-auto md:block">      <table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">{archetype.nouns.item}</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Customer availability</th>{isPickup && <th className="px-5 py-3">Pickup</th>}<th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t hover:bg-[var(--surface-2)]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-business-soft text-business">{item.image ? <span role="img" aria-label={`${item.name} image`} className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${item.image})` }} /> : <PackageCheck className="h-5 w-5" />}</span><div className="min-w-0"><p className="max-w-[280px] truncate font-bold">{item.name}</p><div className="mt-1"><OfferingSummary item={item} archetype={archetype} /></div></div></div></td><td className="px-5 py-4">{item.category || "General"}</td><td className="px-5 py-4"><p className="font-bold">{priceLabel(item)}</p></td><td className="px-5 py-4">{isInventory ? <select aria-label={`Availability for ${item.name}`} value={item.stockStatus || "in_stock"} onChange={(event) => availability(item, event.target.value)} disabled={busyId === item.id} className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm font-semibold"><option value="in_stock">Available</option><option value="low_stock">Limited</option><option value="unavailable">Unavailable</option></select> : item.requiresBusinessReview ? <Badge tone="warning">Approval required</Badge> : <Badge tone="success">Bookable</Badge>}</td>{isPickup && <td className="px-5 py-4">{item.pickupEligible !== false ? <Badge tone="success">Enabled</Badge> : <Badge tone="neutral">Disabled</Badge>}</td>}<td className="px-5 py-4"><StatusBadge status={item.active === false ? "Hidden" : "Visible"} /></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => duplicate(item)} loading={busyId === item.id} aria-label={`Duplicate ${item.name}`}><Copy className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => openOffering(item)} aria-label={`Edit ${item.name}`}><Edit3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setRemoveTarget(item)} aria-label={`Delete ${item.name}`}><Trash2 className="h-4 w-4 text-danger" /></Button></div></td></tr>)}</tbody></table></div></> : <EmptyState icon={BookOpenCheck} title={queryText || category !== "all" || status !== "all" ? `No ${archetype.nouns.items} match this view` : `Add the first ${archetype.nouns.item}`} description={queryText || category !== "all" || status !== "all" ? "Clear a filter or search with a different name." : `Start with a relevant template, quick add, CSV, or one complete ${archetype.nouns.item}.`} action={!queryText && category === "all" && status === "all" && <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => setTemplateOpen(true)}><Sparkles className="h-4 w-4" />Use a starter</Button><Button variant="outline" onClick={() => setQuickOpen(true)}><Plus className="h-4 w-4" />Quick add</Button></div>} />}
    </SectionCard></div>
    </TabPanel>

    <TabPanel idPrefix="catalog-mode" value={catalogMode} tabValue="manage">
      <Card variant="bordered" className="p-5"><div className="grid gap-4 xl:grid-cols-[1fr_auto_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder={`Search ${archetype.nouns.items}, category, or code`} /><select value={category} onChange={(event) => setCategory(event.target.value)} className="surface h-[52px] rounded-xl px-4 text-sm font-semibold"><option value="all">All categories</option>{categories.filter((item) => item !== "all").map((item) => <option key={item} value={item}>{item}</option>)}</select><Button variant="outline" onClick={() => setCsvOpen(true)}><UploadCloud className="h-4 w-4" />Import CSV</Button></div><div className="mt-4"><Tabs idPrefix="catalog-status-manage" value={status} onChange={setStatus} tabs={tabs} /></div></Card>
      <div className="mt-5"><SectionCard>
      {visible.length ? <><div className="space-y-3 md:hidden">{visible.map((item) => <MobileOfferingCard key={item.id} item={item} archetype={archetype} isInventory={isInventory} isPickup={isPickup} busyId={busyId} onAvailability={availability} onDuplicate={duplicate} onEdit={openOffering} onDelete={setRemoveTarget} />)}</div><div className="hidden overflow-x-auto md:block">      <table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">{archetype.nouns.item}</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Customer availability</th>{isPickup && <th className="px-5 py-3">Pickup</th>}<th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t hover:bg-[var(--surface-2)]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-business-soft text-business">{item.image ? <span role="img" aria-label={`${item.name} image`} className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${item.image})` }} /> : <PackageCheck className="h-5 w-5" />}</span><div className="min-w-0"><p className="max-w-[280px] truncate font-bold">{item.name}</p><div className="mt-1"><OfferingSummary item={item} archetype={archetype} /></div></div></div></td><td className="px-5 py-4">{item.category || "General"}</td><td className="px-5 py-4"><p className="font-bold">{priceLabel(item)}</p></td><td className="px-5 py-4">{isInventory ? <select aria-label={`Availability for ${item.name}`} value={item.stockStatus || "in_stock"} onChange={(event) => availability(item, event.target.value)} disabled={busyId === item.id} className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm font-semibold"><option value="in_stock">Available</option><option value="low_stock">Limited</option><option value="unavailable">Unavailable</option></select> : item.requiresBusinessReview ? <Badge tone="warning">Approval required</Badge> : <Badge tone="success">Bookable</Badge>}</td>{isPickup && <td className="px-5 py-4">{item.pickupEligible !== false ? <Badge tone="success">Enabled</Badge> : <Badge tone="neutral">Disabled</Badge>}</td>}<td className="px-5 py-4"><StatusBadge status={item.active === false ? "Hidden" : "Visible"} /></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => duplicate(item)} loading={busyId === item.id} aria-label={`Duplicate ${item.name}`}><Copy className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => openOffering(item)} aria-label={`Edit ${item.name}`}><Edit3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setRemoveTarget(item)} aria-label={`Delete ${item.name}`}><Trash2 className="h-4 w-4 text-danger" /></Button></div></td></tr>)}</tbody></table></div></> : <EmptyState icon={BookOpenCheck} title={queryText || category !== "all" || status !== "all" ? `No ${archetype.nouns.items} match this view` : `Add the first ${archetype.nouns.item}`} description={queryText || category !== "all" || status !== "all" ? "Clear a filter or search with a different name." : `Start with a relevant template, quick add, CSV, or one complete ${archetype.nouns.item}.`} action={!queryText && category === "all" && status === "all" && <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => setTemplateOpen(true)}><Sparkles className="h-4 w-4" />Use a starter</Button><Button variant="outline" onClick={() => setQuickOpen(true)}><Plus className="h-4 w-4" />Quick add</Button></div>} />}
    </SectionCard></div>
    </TabPanel>

    <TabPanel idPrefix="catalog-mode" value={catalogMode} tabValue="import">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card variant="bordered" className="p-5"><h2 className="text-lg font-semibold">Bring in a starter or CSV</h2><p className="mt-2 text-sm leading-6 text-secondary">Imported items stay hidden until names, prices, images and location availability have been reviewed.</p><div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => setTemplateOpen(true)}><Sparkles className="h-4 w-4" />Use starter</Button><Button variant="outline" onClick={() => setCsvOpen(true)}><UploadCloud className="h-4 w-4" />Import CSV</Button></div></Card>
        <Card variant="bordered" className="p-5"><h2 className="text-lg font-semibold">Review queue</h2><p className="mt-2 text-sm leading-6 text-secondary">{importedItems.length ? `${importedItems.length} imported item${importedItems.length === 1 ? "" : "s"} can be reviewed below.` : "No imported items are waiting for review."}</p></Card>
      </div>
      <div className="mt-5 space-y-3">{importedItems.length ? importedItems.map((item) => <Card key={item.id} variant="bordered" className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-secondary">{item.category || "General"} · {priceLabel(item)} · {item.active === false ? "Hidden draft" : "Visible"}</p></div><Button variant="outline" onClick={() => openOffering(item)}><Edit3 className="h-4 w-4" />Review item</Button></Card>) : <EmptyState icon={UploadCloud} title="No imported items" description="Use a starter or CSV when you have a catalogue list to review." />}</div>
    </TabPanel>

    <TabPanel idPrefix="catalog-mode" value={catalogMode} tabValue="publish">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card variant="bordered" className="p-5"><h2 className="text-lg font-semibold">Customer publishing</h2><p className="mt-2 text-sm leading-6 text-secondary">Only visible items with a valid price can be published. Hidden drafts remain private until reviewed.</p>{missingPrice.length > 0 && <div className="mt-4 rounded-xl border border-warning/30 bg-warning-soft p-4"><p className="font-semibold text-warning">{missingPrice.length} visible item{missingPrice.length === 1 ? " needs" : "s need"} a price</p><p className="mt-1 text-sm text-secondary">Resolve every missing price before those items can appear to customers.</p></div>}<div className="mt-5 flex flex-wrap gap-2"><Button onClick={publishReadyItems} loading={busyId === "publish"} disabled={!scopedProducts.some((item) => item.active !== false && productPrice(item))}><Check className="h-4 w-4" />Publish ready items</Button><Button variant="outline" href="/marketplace">Customer preview</Button></div></Card>
        <Card variant="bordered" className="p-5"><p className="text-sm text-secondary">Visible and priced</p><p className="mt-2 text-3xl font-semibold">{scopedProducts.filter((item) => item.active !== false && productPrice(item)).length}</p><p className="mt-5 text-sm text-secondary">Hidden drafts</p><p className="mt-2 text-2xl font-semibold">{draftItems.length}</p></Card>
      </div>
      <div className="mt-5 space-y-3">{scopedProducts.map((item) => <Card key={item.id} variant="bordered" className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.name}</p><StatusBadge status={item.active === false ? "Hidden" : item.published ? "Published" : "Ready for review"} /></div><p className="mt-1 text-sm text-secondary">{priceLabel(item)} · {(item.branchIds || []).length ? `${item.branchIds.length} location${item.branchIds.length === 1 ? "" : "s"}` : "All locations"}</p></div><Button variant="outline" onClick={() => openOffering(item)}><Edit3 className="h-4 w-4" />Review</Button></Card>)}</div>
    </TabPanel>

    <OfferingModal product={editing} open={productOpen} onClose={() => setProductOpen(false)} />
    <QuickAddModal open={quickOpen} onClose={() => setQuickOpen(false)} />
    <TemplateModal open={templateOpen} onClose={() => setTemplateOpen(false)} />
    <CsvModal open={csvOpen} onClose={() => setCsvOpen(false)} />
    <ConfirmDialog open={Boolean(removeTarget)} onClose={() => setRemoveTarget(null)} title={`Delete this ${archetype.nouns.item}?`} description={`${removeTarget?.name || "This item"} will be removed. Existing transaction records keep their own snapshot.`} confirmLabel={`Delete ${archetype.nouns.item}`} danger loading={busyId === removeTarget?.id} onConfirm={remove} />
  </div>;
}
