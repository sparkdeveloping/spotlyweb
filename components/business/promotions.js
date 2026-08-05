"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgePercent, CalendarDays, CheckCircle2, Copy, Pause, Plus, Tag, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { ConfirmDialog, FieldLabel, BusinessSwitcher, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";
import { deletePromotion, savePromotion } from "@/lib/business-services";
import { formatCurrency } from "@/lib/format";

const emptyPromotion = {
  name: "",
  description: "",
  code: "",
  type: "percentage",
  value: 10,
  currency: "USD",
  minimumSpend: 0,
  usageLimit: 0,
  audience: "all_customers",
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: "",
  branchIds: [],
  productIds: [],
  active: true
};

function PromotionModal({ open, onClose, promotion }) {
  const { business, branches, products, user } = useBusinessWorkspace();
  const [form, setForm] = useState(emptyPromotion);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setForm(promotion ? { ...emptyPromotion, ...promotion } : { ...emptyPromotion });
  }, [promotion, open]);

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return toast("Enter a promotion name.", { type: "error", title: "Name required" });
    setSaving(true);
    try {
      await savePromotion(form, business.id, user);
      toast(promotion ? "The promotion has been updated." : "The promotion is ready to use.", { title: promotion ? "Promotion updated" : "Promotion created" });
      onClose();
    } catch (error) {
      toast(error.message || "The promotion could not be saved.", { type: "error", title: "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  function toggleBranch(id) {
    setForm((current) => ({ ...current, branchIds: current.branchIds.includes(id) ? current.branchIds.filter((item) => item !== id) : [...current.branchIds, id] }));
  }

  function toggleProduct(id) {
    setForm((current) => ({ ...current, productIds: current.productIds.includes(id) ? current.productIds.filter((item) => item !== id) : [...current.productIds, id] }));
  }

  return <Modal open={open} onClose={onClose} title={promotion ? "Edit promotion" : "Create promotion"} size="lg">
    <form onSubmit={submit} className="max-h-[78vh] space-y-6 overflow-y-auto p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Promotion name" required><input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Weekend grocery savings" /></FieldLabel>
        <FieldLabel label="Customer code" hint="Leave blank for an automatic promotion."><input className={fieldClass} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s+/g, "") })} placeholder="SAVE10" /></FieldLabel>
      </div>
      <FieldLabel label="Customer-facing description"><textarea className={textAreaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Explain the offer in one clear sentence." /></FieldLabel>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldLabel label="Discount type"><select className={selectClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="percentage">Percentage off</option><option value="fixed">Fixed amount off</option><option value="free_item">Free item value</option></select></FieldLabel>
        <FieldLabel label={form.type === "percentage" ? "Percentage" : "Amount"} required><input type="number" min="0" step="0.01" className={fieldClass} value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} /></FieldLabel>
        <FieldLabel label="Currency"><select className={selectClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option value="USD">USD</option><option value="ZWG">ZiG</option></select></FieldLabel>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldLabel label="Minimum spend"><input type="number" min="0" step="0.01" className={fieldClass} value={form.minimumSpend} onChange={(event) => setForm({ ...form, minimumSpend: event.target.value })} /></FieldLabel>
        <FieldLabel label="Usage limit" hint="0 means no limit."><input type="number" min="0" className={fieldClass} value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} /></FieldLabel>
        <FieldLabel label="Audience"><select className={selectClass} value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="all_customers">All customers</option><option value="new_customers">New customers</option><option value="returning_customers">Returning customers</option><option value="private_beta">Private beta customers</option></select></FieldLabel>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Starts"><input type="date" className={fieldClass} value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></FieldLabel>
        <FieldLabel label="Ends" hint="Leave blank to keep running."><input type="date" className={fieldClass} value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></FieldLabel>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div><p className="text-sm font-semibold">Branches</p><p className="mt-1 text-xs text-secondary">No selection means every branch.</p><div className="mt-3 max-h-44 space-y-2 overflow-y-auto rounded-2xl border p-3">{branches.map((branch) => <label key={branch.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-grouped"><input type="checkbox" checked={form.branchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} /><span className="text-sm font-medium">{branch.name}</span></label>)}</div></div>
        <div><p className="text-sm font-semibold">Products</p><p className="mt-1 text-xs text-secondary">No selection applies the offer to the whole eligible basket.</p><div className="mt-3 max-h-44 space-y-2 overflow-y-auto rounded-2xl border p-3">{products.slice(0, 150).map((product) => <label key={product.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-grouped"><input type="checkbox" checked={form.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{product.name}</span></label>)}</div></div>
      </div>
      <label className="flex items-start gap-3 rounded-2xl bg-grouped p-4"><input className="mt-1" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span><span className="block text-sm font-semibold">Activate this promotion</span><span className="mt-1 block text-xs leading-5 text-secondary">Inactive promotions remain saved and can be activated later.</span></span></label>
      <div className="flex justify-end gap-3 border-t pt-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>{promotion ? "Save changes" : "Create promotion"}</Button></div>
    </form>
  </Modal>;
}

function discountLabel(item) {
  if (item.type === "percentage") return `${item.value}% off`;
  return `${formatCurrency(item.value || 0, item.currency || "USD")} off`;
}

export function PromotionsView() {
  const { promotions, business, user } = useBusinessWorkspace();
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const visible = useMemo(() => promotions.filter((item) => {
    const matches = [item.name, item.code, item.description].join(" ").toLowerCase().includes(queryText.toLowerCase());
    if (!matches) return false;
    if (filter === "active") return item.active !== false;
    if (filter === "paused") return item.active === false;
    if (filter === "scheduled") return item.startsAt && item.startsAt > new Date().toISOString().slice(0, 10);
    return true;
  }), [promotions, queryText, filter]);

  async function toggle(item) {
    setBusy(true);
    try {
      await savePromotion({ ...item, active: item.active === false }, business.id, user);
      toast(item.active === false ? "Promotion activated." : "Promotion paused.");
    } catch (error) {
      toast(error.message || "The promotion could not be changed.", { type: "error", title: "Could not update" });
    } finally { setBusy(false); }
  }

  async function copyPromotion(item) {
    setBusy(true);
    try {
      const { id, createdAt, updatedAt, usedCount, ...values } = item;
      await savePromotion({ ...values, name: `${item.name} copy`, code: item.code ? `${item.code}COPY` : "", active: false, usedCount: 0 }, business.id, user);
      toast("A paused copy was created.", { title: "Promotion duplicated" });
    } catch (error) {
      toast(error.message || "The promotion could not be copied.", { type: "error", title: "Could not duplicate" });
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deletePromotion(deleting.id, user);
      toast("The promotion has been removed.", { title: "Promotion deleted" });
      setDeleting(null);
    } catch (error) {
      toast(error.message || "The promotion could not be deleted.", { type: "error", title: "Could not delete" });
    } finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <PageHeader title="Promotions" description="Create offers now and control exactly when, where, and for whom they apply." actions={<><BusinessSwitcher /><Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" />Create promotion</Button></>} />
    <div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search promotions or codes" /><Tabs value={filter} onChange={setFilter} tabs={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "scheduled", label: "Scheduled" }, { value: "paused", label: "Paused" }]} /></div>
    {visible.length ? <div className="grid gap-4 lg:grid-cols-2">{visible.map((item) => <Card key={item.id} className="overflow-hidden"><div className="flex items-start gap-4 p-5"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-business-soft text-business"><BadgePercent className="h-6 w-6" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.name}</h2><StatusBadge status={item.active === false ? "Paused" : item.startsAt > new Date().toISOString().slice(0, 10) ? "Scheduled" : "Active"} /></div><p className="mt-1 text-sm text-secondary">{discountLabel(item)}{item.minimumSpend ? ` · minimum ${formatCurrency(item.minimumSpend, item.currency)}` : ""}</p>{item.description && <p className="mt-3 text-sm leading-6">{item.description}</p>}<div className="mt-4 flex flex-wrap gap-2">{item.code && <Badge tone="accent"><Tag className="h-3 w-3" />{item.code}</Badge>}<Badge><CalendarDays className="h-3 w-3" />{item.startsAt || "Now"}{item.endsAt ? ` – ${item.endsAt}` : " onward"}</Badge><Badge>{item.branchIds?.length ? `${item.branchIds.length} branches` : "All branches"}</Badge><Badge>{item.usedCount || 0}{item.usageLimit ? ` / ${item.usageLimit}` : " uses"}</Badge></div></div></div><div className="flex flex-wrap gap-2 border-t bg-grouped/60 p-3"><Button size="sm" variant="outline" onClick={() => { setEditing(item); setModalOpen(true); }}>Edit</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => toggle(item)}>{item.active === false ? <CheckCircle2 className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{item.active === false ? "Activate" : "Pause"}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => copyPromotion(item)}><Copy className="h-4 w-4" />Duplicate</Button><Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4" />Delete</Button></div></Card>)}</div> : <SectionCard><EmptyState icon={BadgePercent} title={promotions.length ? "No promotions match this view" : "Create your first promotion"} description={promotions.length ? "Change the search or status filter." : "Create offers now so they are ready for the customer marketplace and private beta."} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" />Create promotion</Button>} /></SectionCard>}
    <PromotionModal open={modalOpen} onClose={() => setModalOpen(false)} promotion={editing} />
    <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete this promotion?" description="This permanently removes the promotion. Existing order records remain unchanged." confirmLabel="Delete promotion" danger loading={busy} onConfirm={remove} />
  </div>;
}
