"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CircleDollarSign, CreditCard, Landmark, Plus, ReceiptText, Smartphone, WalletCards } from "lucide-react";
import { Badge, Button, EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, FieldLabel, fieldClass, selectClass } from "@/components/business/shared";
import { paymentMethods } from "@/data/business-config";
import { saveBusinessFinanceSettings } from "@/lib/firebase-services";
import { requestPayout } from "@/lib/business-services";
import { formatCurrency } from "@/lib/format";

const defaults = {
  acceptedCurrencies: ["USD", "ZWG"],
  paymentMethods: ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"],
  paymentRecipient: "platform",
  payoutCadence: "weekly",
  payoutMethod: "bank_transfer",
  bankName: "",
  accountName: "",
  accountNumberMasked: "",
  bankBranch: "",
  mobileMoneyProvider: "ecocash",
  mobileMoneyNumber: "",
  taxNumber: "",
  legalName: "",
  companyRegistrationNumber: "",
  fiscalInvoiceEnabled: false,
  invoicePrefix: "SPT",
  settlementReservePercent: 0,
  payoutMinimum: 0
};

function PayoutModal({ open, onClose, available }) {
  const { business, user, finance } = useBusinessWorkspace();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => { if (open) { setAmount(available > 0 ? String(available.toFixed(2)) : ""); setCurrency(finance?.acceptedCurrencies?.[0] || "USD"); } }, [open, available, finance]);
  async function submit(event) {
    event.preventDefault(); setSaving(true);
    try { await requestPayout(business.id, amount, currency, user); toast("The payout request has been sent for review.", { title: "Payout requested" }); onClose(); }
    catch (error) { toast(error.message || "The payout could not be requested.", { type: "error", title: "Could not request payout" }); }
    finally { setSaving(false); }
  }
  return <Modal open={open} onClose={onClose} title="Request a payout" size="sm"><form onSubmit={submit} className="space-y-5 p-5"><div className="rounded-2xl bg-grouped p-4"><p className="text-sm text-secondary">Estimated available balance</p><p className="mt-1 text-2xl font-black">{formatCurrency(available, currency)}</p><p className="mt-2 text-xs leading-5 text-secondary">The finance team verifies completed orders, refunds, fees, and settlement holds before approval.</p></div><div className="grid gap-4 sm:grid-cols-[1fr_120px]"><FieldLabel label="Amount" required><input type="number" min="0.01" step="0.01" className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} /></FieldLabel><FieldLabel label="Currency"><select className={selectClass} value={currency} onChange={(event) => setCurrency(event.target.value)}>{(finance?.acceptedCurrencies || ["USD", "ZWG"]).map((item) => <option key={item}>{item}</option>)}</select></FieldLabel></div><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" loading={saving}>Request payout</Button></div></form></Modal>;
}

export function FinanceView() {
  const { business, finance, payouts, orders, user } = useBusinessWorkspace();
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const { toast } = useToast();
  useEffect(() => setForm({ ...defaults, ...(finance || {}) }), [finance]);

  const totals = useMemo(() => {
    const completed = orders.filter((item) => ["completed", "picked_up"].includes(item.status));
    const gross = completed.reduce((sum, item) => sum + Number(item.total || item.amount || 0), 0);
    const fees = completed.reduce((sum, item) => sum + Number(item.platformFee || item.fees?.platform || 0), 0);
    const refunded = orders.reduce((sum, item) => sum + Number(item.refundedAmount || 0), 0);
    const requested = payouts.filter((item) => ["requested", "reviewing", "approved", "processing"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { gross, fees, refunded, requested, available: Math.max(0, gross - fees - refunded - requested) };
  }, [orders, payouts]);

  function toggleCurrency(value) {
    setForm((current) => ({ ...current, acceptedCurrencies: current.acceptedCurrencies.includes(value) ? current.acceptedCurrencies.filter((item) => item !== value) : [...current.acceptedCurrencies, value] }));
  }
  function toggleMethod(value) {
    setForm((current) => ({ ...current, paymentMethods: current.paymentMethods.includes(value) ? current.paymentMethods.filter((item) => item !== value) : [...current.paymentMethods, value] }));
  }
  async function save() {
    if (!form.acceptedCurrencies.length) return toast("Select at least one accepted currency.", { type: "error", title: "Currency required" });
    if (!form.paymentMethods.length) return toast("Select at least one payment method.", { type: "error", title: "Payment method required" });
    setSaving(true);
    try { await saveBusinessFinanceSettings(business.id, form, user); toast("Finance and settlement settings are saved.", { title: "Finance updated" }); }
    catch (error) { toast(error.message || "Finance settings could not be saved.", { type: "error", title: "Could not save" }); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <PageHeader title="Finance" description="Choose customer payment options, settlement routing, payout details, and invoice information." actions={<><BusinessSwitcher /><Button onClick={save} loading={saving}>Save finance settings</Button></>} />
    <div className="metric-grid"><MetricCard label="Completed sales" value={formatCurrency(totals.gross)} hint={`${orders.filter((item) => ["completed", "picked_up"].includes(item.status)).length} completed orders`} icon={CircleDollarSign} /><MetricCard label="Platform fees" value={formatCurrency(totals.fees)} hint="Recorded against completed orders" icon={ReceiptText} /><MetricCard label="Requested payouts" value={formatCurrency(totals.requested)} hint="Pending, approved, or processing" icon={WalletCards} /><MetricCard label="Estimated available" value={formatCurrency(totals.available)} hint="Before final reconciliation" icon={Banknote} tone={totals.available > 0 ? "success" : "default"} /></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
      <div className="space-y-5">
        <SectionCard title="Customer payments" description="Control the currencies and payment methods offered by your business."><div className="space-y-6 p-5"><div><p className="text-sm font-semibold">Accepted currencies</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{[{ id: "USD", label: "United States dollar", detail: "US$" }, { id: "ZWG", label: "Zimbabwe Gold (ZiG)", detail: "ZiG" }].map((item) => <button key={item.id} type="button" onClick={() => toggleCurrency(item.id)} className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${form.acceptedCurrencies.includes(item.id) ? "border-business bg-business-soft" : "hover:bg-grouped"}`}><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white font-black shadow-sm">{item.detail}</span><span className="flex-1"><span className="block font-semibold">{item.label}</span><span className="mt-1 block text-xs text-secondary">{form.acceptedCurrencies.includes(item.id) ? "Accepted" : "Not offered"}</span></span>{form.acceptedCurrencies.includes(item.id) && <Badge tone="success">Selected</Badge>}</button>)}</div></div><div><p className="text-sm font-semibold">Payment methods</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{paymentMethods.map((method) => <button key={method.id} type="button" onClick={() => toggleMethod(method.id)} className={`rounded-2xl border p-4 text-left transition ${form.paymentMethods.includes(method.id) ? "border-business bg-business-soft" : "hover:bg-grouped"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{method.label}</span>{form.paymentMethods.includes(method.id) && <Badge tone="success">On</Badge>}</div><p className="mt-2 text-xs leading-5 text-secondary">{method.description}</p></button>)}</div></div><FieldLabel label="Who receives the customer payment?" hint="This can be changed as Spotly's settlement model evolves."><select className={selectClass} value={form.paymentRecipient} onChange={(event) => setForm({ ...form, paymentRecipient: event.target.value })}><option value="platform">Spotly collects and settles to the business</option><option value="business">The business receives payment directly</option><option value="hybrid">Depends on payment method</option></select></FieldLabel></div></SectionCard>
        <SectionCard title="Tax and invoice details" description="Keep the fields ready for ZIMRA-aligned fiscal invoice and reconciliation records."><div className="grid gap-4 p-5 sm:grid-cols-2"><FieldLabel label="Legal business name"><input className={fieldClass} value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></FieldLabel><FieldLabel label="Company registration number"><input className={fieldClass} value={form.companyRegistrationNumber} onChange={(event) => setForm({ ...form, companyRegistrationNumber: event.target.value })} /></FieldLabel><FieldLabel label="Tax identification number"><input className={fieldClass} value={form.taxNumber} onChange={(event) => setForm({ ...form, taxNumber: event.target.value })} /></FieldLabel><FieldLabel label="Invoice prefix"><input className={fieldClass} value={form.invoicePrefix} onChange={(event) => setForm({ ...form, invoicePrefix: event.target.value.toUpperCase().slice(0, 8) })} /></FieldLabel><label className="flex items-start gap-3 rounded-2xl bg-grouped p-4 sm:col-span-2"><input className="mt-1" type="checkbox" checked={form.fiscalInvoiceEnabled} onChange={(event) => setForm({ ...form, fiscalInvoiceEnabled: event.target.checked })} /><span><span className="block text-sm font-semibold">Fiscal invoice details confirmed</span><span className="mt-1 block text-xs leading-5 text-secondary">Enable only after the business has verified the tax and invoice information required for its operations.</span></span></label></div></SectionCard>
      </div>
      <div className="space-y-5">
        <SectionCard title="Payout destination" description="Where approved settlements should be sent."><div className="space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Payout schedule"><select className={selectClass} value={form.payoutCadence} onChange={(event) => setForm({ ...form, payoutCadence: event.target.value })}><option value="daily">Daily</option><option value="twice_weekly">Twice weekly</option><option value="weekly">Weekly</option><option value="fortnightly">Every two weeks</option><option value="monthly">Monthly</option><option value="manual">Manual request</option></select></FieldLabel><FieldLabel label="Payout method"><select className={selectClass} value={form.payoutMethod} onChange={(event) => setForm({ ...form, payoutMethod: event.target.value })}><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="manual">Arrange manually</option></select></FieldLabel></div>{form.payoutMethod === "bank_transfer" && <div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Bank"><input className={fieldClass} value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></FieldLabel><FieldLabel label="Branch"><input className={fieldClass} value={form.bankBranch} onChange={(event) => setForm({ ...form, bankBranch: event.target.value })} /></FieldLabel><FieldLabel label="Account name"><input className={fieldClass} value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} /></FieldLabel><FieldLabel label="Account number"><input className={fieldClass} value={form.accountNumberMasked} onChange={(event) => setForm({ ...form, accountNumberMasked: event.target.value })} /></FieldLabel></div>}{form.payoutMethod === "mobile_money" && <div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Provider"><select className={selectClass} value={form.mobileMoneyProvider} onChange={(event) => setForm({ ...form, mobileMoneyProvider: event.target.value })}><option value="ecocash">EcoCash</option><option value="onemoney">OneMoney</option></select></FieldLabel><FieldLabel label="Mobile money number"><input className={fieldClass} value={form.mobileMoneyNumber} onChange={(event) => setForm({ ...form, mobileMoneyNumber: event.target.value })} placeholder="+263..." /></FieldLabel></div>}<div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Minimum payout"><input type="number" min="0" className={fieldClass} value={form.payoutMinimum} onChange={(event) => setForm({ ...form, payoutMinimum: event.target.value })} /></FieldLabel><FieldLabel label="Settlement reserve %"><input type="number" min="0" max="100" className={fieldClass} value={form.settlementReservePercent} onChange={(event) => setForm({ ...form, settlementReservePercent: event.target.value })} /></FieldLabel></div><Button className="w-full" variant="outline" onClick={() => setPayoutOpen(true)}><Plus className="h-4 w-4" />Request payout</Button></div></SectionCard>
        <SectionCard title="Payout history" description="Requests and settlements remain visible from request to completion.">{payouts.length ? <div className="divide-y">{payouts.map((item) => <div key={item.id} className="flex items-center gap-4 p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grouped text-secondary">{form.payoutMethod === "mobile_money" ? <Smartphone className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="font-semibold">{formatCurrency(item.amount, item.currency)}</p><p className="mt-1 text-xs text-secondary">Requested {item.createdAt?.toDate?.().toLocaleDateString() || "recently"}</p></div><StatusBadge status={item.status || "requested"} /></div>)}</div> : <EmptyState icon={CreditCard} title="No payout records yet" description="Payout requests and completed settlements will appear here." />}</SectionCard>
      </div>
    </div>
    <PayoutModal open={payoutOpen} onClose={() => setPayoutOpen(false)} available={totals.available} />
  </div>;
}
